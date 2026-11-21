"""보고서의 실제 실행 상태·CSV 무결성을 검사합니다. 테스트 자료는 임시 폴더에만 생성."""
import csv
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from visualize_results import read_results


class ReportTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        with (self.directory / "backtest.csv").open("w", encoding="utf-8-sig", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=["Player", "Season", "target_year", "next_HR", "baseline_HR"])
            writer.writeheader()
            writer.writerow({"Player": "테스트 선수", "Season": 2023, "target_year": 2024, "next_HR": 5, "baseline_HR": 3})
        self.summary = {"run_status": "baseline_only", "artifact_sha256": {
            "backtest.csv": hashlib.sha256((self.directory / "backtest.csv").read_bytes()).hexdigest()},
            "validation": [{"target_year": 2024, "test_rows": 1, "previous_HR_baseline": {"MAE": 2}}]}
        self.write_summary()

    def write_summary(self):
        (self.directory / "metrics.json").write_text(json.dumps(self.summary), encoding="utf-8")

    def test_baseline_is_not_reported_as_random_forest(self):
        summary, rows = read_results(self.directory)
        self.assertEqual(summary["run_status"], "baseline_only")
        self.assertNotIn("predicted_HR", rows[0])

    def test_changed_csv_is_rejected(self):
        with (self.directory / "backtest.csv").open("a") as stream:
            stream.write("\n")
        with self.assertRaisesRegex(ValueError, "해시 불일치"):
            read_results(self.directory)

    def test_metrics_must_match_actual_prediction_pairs(self):
        self.summary["validation"][0]["previous_HR_baseline"]["MAE"] = 1
        self.write_summary()
        with self.assertRaisesRegex(ValueError, "MAE 불일치"):
            read_results(self.directory)

    def test_incomplete_run_is_rejected(self):
        self.summary["run_status"] = "pending"
        self.write_summary()
        with self.assertRaisesRegex(ValueError, "학습 완료"):
            read_results(self.directory)


if __name__ == "__main__":
    unittest.main()
