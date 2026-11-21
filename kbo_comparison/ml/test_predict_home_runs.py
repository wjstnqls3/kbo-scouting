"""실행: python -m unittest discover -s kbo_comparison/ml -p 'test_*.py' -v"""
import importlib.util
from pathlib import Path
import tempfile
import unittest

DATA_AVAILABLE = all(importlib.util.find_spec(name) for name in ["pandas", "numpy"])
MODEL_AVAILABLE = DATA_AVAILABLE and all(importlib.util.find_spec(name) for name in ["sklearn", "joblib"])
if DATA_AVAILABLE:
    import pandas as pd
    from predict_home_runs import FEATURES, load_seasons, make_pairs, run, measures, improvement


def record(player_id="1", year=2020, **changes):
    row = dict(Id=player_id, Player="동명이인", Born="1995-07-01", Season=year,
               Age=year - 1995, Position="OF", Team="SSG", G=100, PA=400, AB=340,
               H=100, HR=10, TB=150, BB=40, HBP=5, SO=80, SF=5, SB=4, CS=2)
    row.update({"2B": 20, "3B": 0})
    row.update(changes)
    return row


@unittest.skipUnless(DATA_AVAILABLE, "pandas/numpy 설치 필요")
class ForecastTests(unittest.TestCase):
    def load(self, rows, through):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        path = Path(temp.name) / "input.csv"
        pd.DataFrame(rows).to_csv(path, index=False)
        return load_seasons(path, through)

    def test_exact_next_year_and_distinct_names(self):
        rows = [record("1", 2020), record("1", 2022), record("2", 2020),
                record("2", 2021, HR=1, H=2, TB=5, PA=15, AB=10, BB=3, HBP=0,
                       SF=0, SO=4, **{"2B": 0}), record("2", 2022)]
        seasons, _ = self.load(rows, 2022)
        pairs, forecast, missing = make_pairs(seasons, 2022, 100)
        # 1번 선수의 2020→2022를 다음 해로 연결하면 안 됩니다.
        self.assertEqual(list(pairs["Id"]), ["2"])
        self.assertEqual(list(pairs["next_HR"]), [1])  # 다음 시즌 최소타석 조건은 적용하지 않음.
        self.assertEqual(missing, 1)
        self.assertEqual(len(forecast), 2)
        self.assertNotIn("Id", FEATURES)
        self.assertNotIn("next_HR", FEATURES)

    def test_future_records_cannot_change_features(self):
        historical = [record("1", 2020), record("1", 2021)]
        a, _ = self.load(historical, 2021)
        b, audit = self.load(historical + [record("9", 2022, HR=70, TB=310)], 2021)
        pd.testing.assert_frame_equal(a[FEATURES], b[FEATURES])
        self.assertEqual(audit["future_rows_excluded"], 1)

    def test_duplicates_fail_instead_of_double_counting(self):
        with self.assertRaisesRegex(ValueError, "중복 선수-시즌"):
            self.load([record(), record(Team="LG")], 2020)

    def test_observed_zero_is_a_label_but_absence_is_not(self):
        zero = {k: 0 for k in ["G", "PA", "AB", "H", "2B", "3B", "HR", "TB", "BB", "HBP", "SO", "SF", "SB", "CS"]}
        seasons, _ = self.load([record(), record(year=2021, **zero), record("2", 2020)], 2021)
        pairs, _, missing = make_pairs(seasons, 2021, 100)
        self.assertEqual(pairs["next_HR"].tolist(), [0])
        self.assertEqual(missing, 1)

    def test_metrics_and_improvement(self):
        self.assertEqual(measures([0, 2, 4], [1, 2, 3])["MAE"], 2 / 3)
        self.assertEqual(measures([0, 2, 4], [1, 2, 3])["R2"], .75)
        self.assertEqual(measures([3, 3], [3, 3])["R2"], None)
        self.assertEqual(improvement(3, 4), 25)
        self.assertEqual(improvement(5, 4), -25)
        self.assertIsNone(improvement(1, 0))
        with self.assertRaises(ValueError):
            measures([0, float("nan")], [0, 1])

    @unittest.skipUnless(MODEL_AVAILABLE, "scikit-learn/joblib 설치 필요 · 학습 검증 미실행")
    def test_end_to_end_year_splits_and_model_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            rows = [record(str(i), year, HR=i + year - 2018, TB=170 + i * 3)
                    for year in range(2018, 2024) for i in range(12)]
            path = root / "input.csv"
            pd.DataFrame(rows).to_csv(path, index=False)
            summary, forecast = run(path, 2023, trees=5, output_dir=root / "output")
            self.assertEqual(len(forecast), 12)
            self.assertTrue(forecast["target_year"].eq(2024).all())
            self.assertTrue(forecast["predicted_HR"].ge(0).all())
            for fold in summary["validation"]:
                self.assertLess(fold["train_last_target_year"], fold["target_year"])
                self.assertIn("previous_HR_baseline", fold)
            for name in ["predictions.csv", "backtest.csv", "metrics.json", "model.joblib"]:
                self.assertTrue((root / "output" / name).exists())


if __name__ == "__main__":
    unittest.main()
