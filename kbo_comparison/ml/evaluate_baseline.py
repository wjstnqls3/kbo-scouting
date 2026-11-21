"""Random Forest를 대신했다고 주장하지 않고, 전년도 홈런 유지 기준선만 검증합니다."""
import argparse
import hashlib
import json
from pathlib import Path

from predict_home_runs import ROOT, load_seasons, make_pairs, measures


def run(csv_path, through_season=2025, min_pa=100, validation_seasons=3, output_dir=None):
    if min_pa < 1 or validation_seasons < 1:
        raise ValueError("최소타석·검증 시즌 수는 1 이상이어야 합니다.")
    seasons, audit = load_seasons(csv_path, through_season)
    pairs, candidates, missing = make_pairs(seasons, through_season, min_pa)
    years = sorted(pairs["target_year"].unique())[-validation_seasons:]
    if len(years) != validation_seasons:
        raise ValueError("기준선 검증 시즌 부족")
    validation = pairs.loc[pairs["target_year"].isin(years), [
        "Player", "Born", "Team", "Season", "target_year", "PA", "HR", "next_HR",
    ]].copy()
    validation["baseline_HR"] = validation["HR"]
    reports = []
    for year in years:
        part = validation.loc[validation["target_year"].eq(year)]
        reports.append({
            "target_year": int(year), "test_rows": len(part), "random_forest": None,
            "previous_HR_baseline": measures(part["next_HR"], part["baseline_HR"]),
            "MAE_improvement_percent": None,
        })
    destination = Path(output_dir) if output_dir else Path(__file__).parent / "output" / f"baseline_{through_season}"
    destination.mkdir(parents=True, exist_ok=True)
    validation.to_csv(destination / "backtest.csv", index=False, encoding="utf-8-sig")
    audit.update(training_pairs_available=len(pairs), missing_next_season_excluded=missing, forecast_candidates=len(candidates))
    metadata_path = Path(csv_path).parent / "data_metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8")) if metadata_path.exists() else {}
    summary = {
        "run_status": "baseline_only", "model": "전년도 홈런 수 유지 · 학습 없는 기준선",
        "through_season": through_season, "min_source_PA": min_pa,
        "source_season_status": metadata.get("season_status", {}).get(str(through_season), "미확인"), "audit": audit, "validation": reports,
        "source_csv_sha256": hashlib.sha256(Path(csv_path).read_bytes()).hexdigest(),
        "artifact_sha256": {"backtest.csv": hashlib.sha256((destination / "backtest.csv").read_bytes()).hexdigest()},
        "pooled": {"rows": len(validation), "random_forest": None,
                   "previous_HR_baseline": measures(validation["next_HR"], validation["baseline_HR"]),
                   "MAE_improvement_percent": None},
        "limitations": [
            "Random Forest 미학습. 모델 예측값·개선율·미래 예측 결과 없음",
            "동봉 CSV의 실제 기록과 전년도 홈런 유지 기준선만 비교",
            f"원자료 시즌 마감·수집일은 별도 확인 필요. {through_season + 1}년 이후는 입력·정답에서 제외",
            "입력 시즌 최소타석 충족 및 다음 시즌 기록이 확인되는 선수만 검증",
        ],
    }
    (destination / "metrics.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps(summary["validation"], ensure_ascii=False, indent=2))
    print("Random Forest 미실행 · 기준선만 저장:", destination.resolve())
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, default=ROOT / "kbo_batting_stats_season_1982-2026.csv")
    parser.add_argument("--through-season", type=int, default=2025)
    parser.add_argument("--min-pa", type=int, default=100)
    parser.add_argument("--validation-seasons", type=int, default=3)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    run(args.csv, args.through_season, args.min_pa, args.validation_seasons, args.output_dir)
