"""KBO 시즌 타격 기록 → 다음 시즌 홈런 수. 기존 웹 평가와 분리된 실험용 모델."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
COUNTS = ["G", "PA", "AB", "H", "2B", "3B", "HR", "TB", "BB", "HBP", "SO", "SF", "SB", "CS"]
# 이름·ID·다음 시즌 타석/구단/리그 기록은 모델 입력에 사용하지 않습니다.
FEATURES = ["Season", "Age"] + COUNTS + [
    "AVG_calc", "OBP_calc", "SLG_calc", "ISO_calc", "HR_rate", "BB_rate",
    "K_rate", "league_HR_rate", "relative_HR_rate",
]


def load_seasons(csv_path, through_season):
    """선수-시즌 유일성과 수치를 검사하고, 지정 연도까지만 특징을 만듭니다."""
    raw = pd.read_csv(csv_path, dtype={"Id": "string"}, encoding="utf-8-sig")
    required = {"Id", "Player", "Season", "Age", "Born", "Position", "Team", *COUNTS}
    missing = required - set(raw.columns)
    if missing:
        raise ValueError(f"CSV 필수 칼럼 없음: {sorted(missing)}")
    audit = {"raw_rows": len(raw)}
    df = raw.copy()
    for col in ["Season", "Age"] + COUNTS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    valid_key = df["Id"].notna() & df["Id"].str.strip().ne("") & df["Player"].notna()
    valid_key &= df["Season"].notna() & np.isfinite(df["Season"]) & df["Season"].mod(1).eq(0)
    audit["invalid_key_rows"] = int((~valid_key).sum())
    audit["future_rows_excluded"] = int((valid_key & df["Season"].gt(through_season)).sum())
    df = df.loc[valid_key & df["Season"].le(through_season)].copy()
    df["Season"] = df["Season"].astype(int)
    # 이적 시 합계행과 구단별 행을 임의로 더하면 이중 집계될 수 있으므로 중단합니다.
    duplicate = df.duplicated(["Id", "Season"], keep=False)
    if duplicate.any():
        examples = df.loc[duplicate, ["Player", "Season", "Team"]].head(6).to_dict("records")
        raise ValueError(f"중복 선수-시즌 발견. 이적 분할행/합계행을 먼저 정리하세요: {examples}")
    audit["pitcher_rows_excluded"] = int(df["Position"].eq("P").sum())
    df = df.loc[df["Position"].ne("P")].copy()
    values = df[COUNTS]
    valid = (np.isfinite(values) & values.ge(0) & values.mod(1).eq(0)).all(axis=1)
    valid &= df["HR"].le(df["H"]) & df["H"].le(df["AB"]) & df["AB"].le(df["PA"])
    valid &= df["TB"].ge(df["H"]) & df["TB"].le(4 * df["H"]) & df["SO"].le(df["PA"])
    valid &= (df["2B"] + df["3B"] + df["HR"]).le(df["H"])
    valid &= df["PA"].ge(df["AB"] + df["BB"] + df["HBP"] + df["SF"])
    valid &= df["G"].gt(0) | df["PA"].eq(0)
    audit["invalid_count_rows_excluded"] = int((~valid).sum())
    df = df.loc[valid].copy()
    if df.empty or through_season not in set(df["Season"]):
        raise ValueError("지정한 마지막 시즌의 유효 기록이 없습니다.")
    # 원본 Age는 연 나이입니다. 생년과 불일치하는 값은 결측 처리합니다.
    born_year = pd.to_numeric(df["Born"].astype(str).str.extract(r"^(\d{4})-\d{2}-\d{2}$")[0], errors="coerce")
    valid_age = df["Age"].between(0, 65) & df["Age"].mod(1).eq(0)
    valid_age &= born_year.isna() | df["Age"].eq(df["Season"] - born_year)
    audit["age_values_missing_or_invalid"] = int((~valid_age).sum())
    df.loc[~valid_age, "Age"] = np.nan
    # CSV에 반올림 저장된 비율 대신, 같은 시즌의 원기록으로 재계산합니다.
    ab = df["AB"].replace(0, np.nan)
    pa = df["PA"].replace(0, np.nan)
    obp_den = (df["AB"] + df["BB"] + df["HBP"] + df["SF"]).replace(0, np.nan)
    df["AVG_calc"] = df["H"] / ab
    df["OBP_calc"] = (df["H"] + df["BB"] + df["HBP"]) / obp_den
    df["SLG_calc"] = df["TB"] / ab
    df["ISO_calc"] = df["SLG_calc"] - df["AVG_calc"]
    df["HR_rate"], df["BB_rate"], df["K_rate"] = df["HR"] / pa, df["BB"] / pa, df["SO"] / pa
    # 최소타석 필터 적용 전 전체 유효 타자의 합계로 같은 시즌 리그 환경을 계산합니다.
    totals = df.groupby("Season")[["HR", "PA"]].sum()
    league_rates = totals["HR"] / totals["PA"].replace(0, np.nan)
    df["league_HR_rate"] = df["Season"].map(league_rates)
    df["relative_HR_rate"] = df["HR_rate"] / df["league_HR_rate"].replace(0, np.nan)
    df[FEATURES] = df[FEATURES].replace([np.inf, -np.inf], np.nan)
    audit["clean_rows"] = len(df)
    return df, audit


def make_pairs(seasons, through_season, min_pa):
    """t년 입력과 정확히 t+1년 정답을 연결. 1년 공백을 건너뛰지 않습니다."""
    source = seasons.loc[seasons["PA"].ge(min_pa) & seasons["G"].gt(0)].copy()
    source["target_year"] = source["Season"] + 1
    labels = seasons[["Id", "Season", "HR"]].rename(columns={"Season": "target_year", "HR": "next_HR"})
    paired = source.merge(labels, on=["Id", "target_year"], how="left", validate="one_to_one")
    past = paired.loc[paired["target_year"].le(through_season)]
    # 미등록/은퇴/해외 진출/자료 누락을 구별할 수 없으므로 없는 행을 0홈런으로 만들지 않습니다.
    missing_labels = int(past["next_HR"].isna().sum())
    training = past.dropna(subset=["next_HR"]).copy()
    forecast = source.loc[source["Season"].eq(through_season)].copy()
    return training, forecast, missing_labels


def make_model(trees=300, seed=42):
    # 데이터 검사만 할 때에도 모델 패키지를 요구하지 않도록 학습 시점에 가져옵니다.
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.impute import SimpleImputer
    from sklearn.pipeline import Pipeline

    return Pipeline([
        # 중앙값은 매 검증 구간의 학습 데이터로만 계산합니다.
        ("imputer", SimpleImputer(strategy="median", keep_empty_features=True)),
        ("forest", RandomForestRegressor(
            n_estimators=trees, max_depth=12, min_samples_leaf=5,
            max_features=0.8, random_state=seed, n_jobs=1,
        )),
    ])


def measures(actual, predicted):
    actual, predicted = np.asarray(actual, dtype=float), np.asarray(predicted, dtype=float)
    if actual.ndim != 1 or actual.shape != predicted.shape or not actual.size:
        raise ValueError("성능 측정에는 길이가 같은 1차원 실제값·예측값이 필요합니다.")
    if not np.isfinite(actual).all() or not np.isfinite(predicted).all():
        raise ValueError("성능 측정값에 결측 또는 무한대가 있습니다.")
    errors = actual - predicted
    sst = float(np.sum((actual - actual.mean()) ** 2))
    return {
        "MAE": float(np.mean(np.abs(errors))),
        "RMSE": float(np.sqrt(np.mean(errors ** 2))),
        "R2": float(1 - np.sum(errors ** 2) / sst) if len(actual) > 1 and sst > 0 else None,
    }


def improvement(model_mae, baseline_mae):
    """양수는 개선, 음수는 악화. 기준 오차가 0이면 개선율은 정의하지 않습니다."""
    return 100 * (baseline_mae - model_mae) / baseline_mae if baseline_mae > 0 else None


def walk_forward(pairs, validation_seasons=3, trees=300, seed=42):
    """예: 2023년 검증 때는 정답 연도가 2022년 이하인 자료로만 학습합니다."""
    years = sorted(pairs["target_year"].unique())
    if len(years) < validation_seasons + 1:
        raise ValueError("연도순 검증에 필요한 연속 시즌 쌍이 부족합니다.")
    results, reports = [], []
    for year in years[-validation_seasons:]:
        train = pairs.loc[pairs["target_year"].lt(year)]
        test = pairs.loc[pairs["target_year"].eq(year)]
        if len(train) < 20 or len(test) < 2:
            raise ValueError(f"{year}년 검증 표본 부족: 학습 {len(train)}개, 검증 {len(test)}개")
        model = make_model(trees, seed)
        model.fit(train[FEATURES], train["next_HR"])
        prediction = model.predict(test[FEATURES])
        reports.append({
            "target_year": int(year), "train_last_target_year": int(train["target_year"].max()),
            "train_rows": len(train), "test_rows": len(test),
            "random_forest": measures(test["next_HR"], prediction),
            "previous_HR_baseline": measures(test["next_HR"], test["HR"]),
        })
        reports[-1]["MAE_improvement_percent"] = improvement(
            reports[-1]["random_forest"]["MAE"], reports[-1]["previous_HR_baseline"]["MAE"]
        )
        out = test[["Player", "Born", "Team", "Season", "target_year", "PA", "HR", "next_HR"]].copy()
        out["predicted_HR"] = prediction
        out["baseline_HR"] = test["HR"]
        results.append(out)
    return reports, pd.concat(results, ignore_index=True)


def run(csv_path, through_season, min_pa=100, validation_seasons=3, trees=300, seed=42, output_dir=None):
    import joblib
    import sklearn

    if min_pa < 1 or validation_seasons < 1 or trees < 1:
        raise ValueError("최소타석·검증 시즌 수·트리 수는 1 이상이어야 합니다.")
    csv_path = Path(csv_path)
    seasons, audit = load_seasons(csv_path, through_season)
    pairs, forecast, missing = make_pairs(seasons, through_season, min_pa)
    if forecast.empty:
        raise ValueError("마지막 시즌에 최소타석 조건을 충족한 예측 대상이 없습니다.")
    audit.update(training_pairs=len(pairs), missing_next_season_excluded=missing, forecast_players=len(forecast))
    metadata_path = csv_path.parent / "data_metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8")) if metadata_path.exists() else {}
    season_status = metadata.get("season_status", {}).get(str(through_season), "미확인")
    print(f"입력 마지막 시즌: {through_season} / 메타데이터 시즌 상태: {season_status}")
    print("실험용 예측: 시즌 마감·자료 완전성은 별도 확인 필요. 다음 시즌 기록 없는 선수는 검증 대상에서 제외됩니다.")
    reports, validation = walk_forward(pairs, validation_seasons, trees, seed)
    for item in reports:
        rf = item["random_forest"]["MAE"]
        baseline = item["previous_HR_baseline"]["MAE"]
        print(f"{item['target_year']}년 검증 MAE: Random Forest {rf:.2f}개 / 전년도 홈런 유지 {baseline:.2f}개")
    # 검증을 마친 뒤, 마감 연도까지 정답을 아는 모든 쌍으로 최종 모델을 학습합니다.
    model = make_model(trees, seed)
    model.fit(pairs[FEATURES], pairs["next_HR"])
    output = forecast[["Player", "Born", "Team", "Season", "target_year", "PA", "HR"]].copy()
    output["predicted_HR"] = model.predict(forecast[FEATURES])
    output["prediction_type"] = "실험용 예측 · 실제 기록 아님"
    output["source_season_status"] = season_status
    output = output.sort_values("predicted_HR", ascending=False)
    # 소수 예측을 그대로 보존합니다. 정수로 보여주더라도 확정 홈런 수가 아닙니다.
    destination = Path(output_dir) if output_dir else Path(__file__).parent / "output" / str(through_season + 1)
    destination.mkdir(parents=True, exist_ok=True)
    output.to_csv(destination / "predictions.csv", index=False, encoding="utf-8-sig")
    validation.to_csv(destination / "backtest.csv", index=False, encoding="utf-8-sig")
    summary = {
        "run_status": "trained", "evaluation_scope": "동봉 자료에서 다음 시즌 기록이 확인된 선수",
        "model": "RandomForestRegressor", "features": FEATURES, "through_season": through_season,
        "prediction_season": through_season + 1, "min_source_PA": min_pa, "trees": trees, "seed": seed,
        "source_season_status": season_status, "source_csv_sha256": hashlib.sha256(csv_path.read_bytes()).hexdigest(),
        "sklearn_version": sklearn.__version__, "audit": audit, "validation": reports,
        "pooled": {
            "rows": len(validation),
            "random_forest": measures(validation["next_HR"], validation["predicted_HR"]),
            "previous_HR_baseline": measures(validation["next_HR"], validation["baseline_HR"]),
        },
        "limitations": [
            "실험용 예측. 미래 시즌 출전·부상·은퇴·이적·구장 변화 미반영",
            "검증은 다음 시즌 원기록이 확인된 선수에 한정. 전체 현역 선수 성능으로 일반화 불가",
            "검증 시 최소타석 조건은 입력 시즌에만 적용. 다음 시즌 소타석 기록도 포함",
            "같은 선수의 과거 시즌 학습은 허용하되 미래 시즌 기록은 입력·전처리에서 제외",
            "홈런 수에는 출전 규모가 반영됨. 홈런 능력이나 100점 만점 평가 점수와 다름",
            "2026년을 포함한 원자료의 확정 여부·수집일은 별도 확인 필요",
        ],
    }
    summary["pooled"]["MAE_improvement_percent"] = improvement(
        summary["pooled"]["random_forest"]["MAE"], summary["pooled"]["previous_HR_baseline"]["MAE"]
    )
    summary["artifact_sha256"] = {
        name: hashlib.sha256((destination / name).read_bytes()).hexdigest()
        for name in ["predictions.csv", "backtest.csv"]
    }
    joblib.dump({"pipeline": model, "features": FEATURES, "through_season": through_season}, destination / "model.joblib")
    (destination / "metrics.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    print(output[["Player", "target_year", "predicted_HR"]].head(10).to_string(index=False))
    print(f"저장 위치: {destination.resolve()}")
    return summary, output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=ROOT / "kbo_batting_stats_season_1982-2026.csv")
    parser.add_argument("--through-season", type=int, required=True, help="입력에 사용할 마지막 시즌. 확정 여부를 직접 확인한 뒤 지정")
    parser.add_argument("--min-pa", type=int, default=100, help="입력 시즌 최소타석 (기본 100)")
    parser.add_argument("--validation-seasons", type=int, default=3)
    parser.add_argument("--trees", type=int, default=300)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    try:
        run(args.csv, args.through_season, args.min_pa, args.validation_seasons, args.trees, args.seed, args.output_dir)
    except (ValueError, OSError, ImportError) as error:
        parser.exit(2, f"오류: {error}\n")


if __name__ == "__main__":
    main()
