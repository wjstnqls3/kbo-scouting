"""실제 실행 결과 파일만 읽어 PNG·PDF 그래프와 독립 HTML 보고서를 만듭니다."""
import argparse
import base64
import csv
import hashlib
from html import escape
import json
import math
import os
from pathlib import Path
import tempfile


def read_results(directory):
    directory = Path(directory)
    summary = json.loads((directory / "metrics.json").read_text(encoding="utf-8"))
    if summary.get("run_status") not in {"trained", "baseline_only"}:
        raise ValueError("학습 완료 또는 기준선 실행 상태가 있는 결과 파일이 필요합니다.")
    expected = summary.get("artifact_sha256", {}).get("backtest.csv")
    if not expected or hashlib.sha256((directory / "backtest.csv").read_bytes()).hexdigest() != expected:
        raise ValueError("검증 CSV 해시 불일치. 동일 실행에서 생성한 결과를 사용하세요.")
    with (directory / "backtest.csv").open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    trained = summary["run_status"] == "trained"
    if not rows:
        raise ValueError("검증 기록 없음")
    for row in rows:
        row["target_year"] = int(row["target_year"])
        for key in ["next_HR", "baseline_HR"] + (["predicted_HR"] if trained else []):
            row[key] = float(row[key])
            if not math.isfinite(row[key]) or row[key] < 0:
                raise ValueError("홈런 수에 결측·음수·무한대가 있습니다.")
        if int(row["Season"]) + 1 != row["target_year"]:
            raise ValueError("입력 시즌과 정답 시즌이 연속되지 않습니다.")
    # 그래프와 성능표가 서로 다른 실행 결과를 표시하지 않도록 직접 대조합니다.
    for item in summary["validation"]:
        part = [r for r in rows if r["target_year"] == item["target_year"]]
        if len(part) != item["test_rows"] or not part:
            raise ValueError("시즌별 검증 표본 수 불일치")
        for column, model in [("baseline_HR", "previous_HR_baseline")] + ([("predicted_HR", "random_forest")] if trained else []):
            mae = sum(abs(r["next_HR"] - r[column]) for r in part) / len(part)
            if not math.isclose(mae, item[model]["MAE"], abs_tol=1e-9):
                raise ValueError("CSV와 성능표의 MAE 불일치")
    return summary, rows


def draw_report(directory):
    directory = Path(directory)
    summary, rows = read_results(directory)
    trained = summary["run_status"] == "trained"
    os.environ.setdefault("MPLCONFIGDIR", str(Path(tempfile.gettempdir()) / "kbo-ml-matplotlib"))
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    fonts = {font.name for font in font_manager.fontManager.ttflist}
    for name in ["AppleGothic", "Malgun Gothic", "NanumGothic", "Noto Sans CJK KR"]:
        if name in fonts:
            plt.rcParams["font.family"] = name
            break
    plt.rcParams.update({"axes.unicode_minus": False, "figure.dpi": 140, "axes.spines.top": False,
                         "axes.spines.right": False, "axes.titleweight": "bold"})
    names = []

    def save(fig, name):
        fig.tight_layout()
        fig.savefig(directory / f"{name}.png", bbox_inches="tight")
        fig.savefig(directory / f"{name}.pdf", bbox_inches="tight")
        plt.close(fig)
        names.append(name)

    years = [item["target_year"] for item in summary["validation"]]
    baseline = [item["previous_HR_baseline"]["MAE"] for item in summary["validation"]]
    fig, ax = plt.subplots(figsize=(8, 4.6))
    x = list(range(len(years)))
    if trained:
        ax.bar([v - .18 for v in x], baseline, width=.36, color="#a77b25", label="전년도 홈런 유지")
        ax.bar([v + .18 for v in x], [item["random_forest"]["MAE"] for item in summary["validation"]], width=.36, color="#08774e", label="Random Forest")
    else:
        ax.bar(x, baseline, width=.5, color="#a77b25", label="전년도 홈런 유지")
    ax.set(xticks=x, xticklabels=years, ylabel="평균 절대 오차 (홈런 개수)", xlabel="검증 대상 시즌",
           title="연도별 MAE · 낮을수록 좋음" + ("" if trained else " · Random Forest 미실행"))
    for container in ax.containers:
        ax.bar_label(container, fmt="%.2f", padding=3)
    ax.set_ylim(0, max([1] + baseline + ([item["random_forest"]["MAE"] for item in summary["validation"]] if trained else [])) * 1.22)
    ax.legend()
    save(fig, "yearly_mae")

    columns = [("baseline_HR", "전년도 홈런 유지")]
    if trained:
        columns.append(("predicted_HR", "Random Forest"))
    fig, axes = plt.subplots(1, len(columns), figsize=(6 * len(columns), 5), squeeze=False)
    limit = max([r["next_HR"] for r in rows] + [r[key] for r in rows for key, _ in columns]) + 3
    colors = ["#08774e", "#a77b25", "#497fa8", "#975480"]
    for ax, (column, title) in zip(axes[0], columns):
        for index, year in enumerate(years):
            part = [r for r in rows if r["target_year"] == year]
            ax.scatter([r["next_HR"] for r in part], [r[column] for r in part], alpha=.5, s=24,
                       color=colors[index % len(colors)], label=str(year))
        ax.plot([0, limit], [0, limit], "--", color="#23382e", label="실제값 = 예측값")
        ax.set(xlim=(-1, limit), ylim=(-1, limit), xlabel="CSV 실제 홈런", ylabel="예측 홈런", title=title)
        ax.set_aspect("equal", adjustable="box")
        ax.legend(fontsize=8)
    save(fig, "actual_vs_predicted")

    # 선정 기준을 명시해 상위 기록만으로 전체 정확도가 좋아 보이지 않도록 합니다.
    latest = max(years)
    top = sorted([r for r in rows if r["target_year"] == latest], key=lambda r: (-r["next_HR"], r["Player"]))[:15]
    fig, ax = plt.subplots(figsize=(11, 6))
    positions = list(range(len(top)))
    width = .24 if trained else .34
    ax.barh([v - width for v in positions], [r["next_HR"] for r in top], height=width, label="CSV 실제 홈런", color="#24483b")
    ax.barh(positions, [r["baseline_HR"] for r in top], height=width, label="전년도 홈런 유지", color="#a77b25")
    if trained:
        ax.barh([v + width for v in positions], [r["predicted_HR"] for r in top], height=width, label="Random Forest", color="#5d9bb6")
    ax.set(yticks=positions, yticklabels=[f"{r['Player']} ({r['Born'][:4]}년생)" for r in top], xlabel="홈런 개수",
           title=f"{latest}년 실제 홈런 상위 {len(top)}명 · 검증 대상 중 선정")
    ax.invert_yaxis()
    ax.legend()
    save(fig, "player_comparison")

    metric_rows = []
    for item in summary["validation"] + [{"target_year": "전체 합산", "test_rows": len(rows), **summary["pooled"]}]:
        baseline_metrics = item["previous_HR_baseline"]
        model = item.get("random_forest")
        gain = item.get("MAE_improvement_percent")
        metric_rows.append([str(item["target_year"]), str(item["test_rows"]), f"{baseline_metrics['MAE']:.3f}",
                            f"{model['MAE']:.3f}" if model else "미실행",
                            f"{gain:+.2f}%" if gain is not None else "판단 불가",
                            f"{baseline_metrics['RMSE']:.3f}", f"{model['RMSE']:.3f}" if model else "미실행",
                            f"{baseline_metrics['R2']:.3f}" if baseline_metrics.get('R2') is not None else "미산출",
                            f"{model['R2']:.3f}" if model and model.get('R2') is not None else "미산출"])
    headers = ["검증 시즌", "선수 수", "기준선 MAE", "RF MAE", "MAE 개선율", "기준선 RMSE", "RF RMSE", "기준선 R²", "RF R²"]
    with (directory / "performance_table.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.writer(stream); writer.writerow(headers); writer.writerows(metric_rows)

    def table(head, body):
        return '<div class="table-wrap"><table><thead><tr>' + ''.join(f'<th>{escape(v)}</th>' for v in head) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{escape(v)}</td>' for v in row) + '</tr>' for row in body) + '</tbody></table></div>'

    title = "Random Forest 홈런 예측 검증" if trained else "기준선 검증 · Random Forest 미실행"
    note = "학습·연도순 검증 완료. 개선율이 음수면 기준선보다 오차가 큼." if trained else "전년도 홈런 유지 기준선만 실제로 실행함. Random Forest 학습·예측·개선 여부는 미확인."
    body = f'<h1>{title}</h1><p class="status">{note}</p><p>입력 마지막 시즌 {summary["through_season"]} · 입력 시즌 최소 {summary["min_source_PA"]}타석 · 검증 {len(rows)}개 선수·시즌</p><p>실제 홈런은 동봉 CSV 기준. 원자료의 시즌 확정 여부는 별도 확인 필요.</p>'
    body += '<h2>성능 비교</h2><p>MAE·RMSE는 낮을수록 좋음. 개선율 = (기준선 MAE−모델 MAE)÷기준선 MAE×100. 전체 합산은 모든 검증 행을 모아 계산.</p>' + table(headers, metric_rows)
    for name in names:
        encoded = base64.b64encode((directory / f"{name}.png").read_bytes()).decode()
        body += f'<figure><img src="data:image/png;base64,{encoded}" alt="{escape(name)}"></figure>'
    player_rows = []
    for r in sorted(rows, key=lambda r: (-r["target_year"], -r["next_HR"], r["Player"])):
        player_rows.append([str(r["target_year"]), r["Player"], r["Born"], r["Team"], f"{r['next_HR']:.0f}",
                            f"{r['baseline_HR']:.0f}", f"{r['predicted_HR']:.2f}" if trained else "미실행"])
    body += '<h2>전체 검증 선수</h2><p>구단은 입력 시즌 소속. 같은 이름은 생년월일로 구분.</p>' + table(["검증 시즌", "선수", "생년월일", "입력 시즌 구단", "실제 HR", "기준선 HR", "RF 예측 HR"], player_rows)
    body += '<h2>해석 범위</h2><ul>' + ''.join(f'<li>{escape(v)}</li>' for v in summary["limitations"]) + '</ul>'
    html = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title><style>body{font:16px/1.65 system-ui,sans-serif;background:#edf5ee;color:#193e30;margin:0}main{max-width:1100px;margin:auto;padding:24px}h1{font-size:28px}.status{background:#fff0c6;padding:16px;border-radius:10px;font-weight:700}table{border-collapse:collapse;width:100%;background:white}th,td{padding:8px;border-bottom:1px solid #cbdccc;text-align:right;white-space:nowrap}th:first-child,td:first-child{text-align:left}.table-wrap{overflow:auto;max-height:650px}figure{margin:24px 0}img{width:100%;height:auto}p,li{overflow-wrap:anywhere}@media(max-width:600px){main{padding:12px}h1{font-size:23px}table{font-size:13px}}</style><main>' + body + '</main></html>'
    (directory / "report.html").write_text(html, encoding="utf-8")
    print("그래프·성능표·독립 HTML 보고서 저장:", (directory / "report.html").resolve())
    return directory / "report.html"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("result_dir", type=Path)
    args = parser.parse_args()
    draw_report(args.result_dir)
