"""Verify the offline browser data and pitcher rate denominators against both CSVs."""
import csv
import json
from collections import defaultdict
from fractions import Fraction
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


def csv_rows(mode):
    source = ROOT / f'kbo_{mode}_stats_season_1982-2026.csv'
    with source.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))


def read_js(script, *args):
    return json.loads(subprocess.check_output(['node', '-e', script, *args], cwd=ROOT))


class AuditDataTests(unittest.TestCase):
    def test_browser_rows_and_player_keys(self):
        for mode, payload in [('batting', 'data.js'), ('pitching', 'pitching-data.js')]:
            with self.subTest(mode=mode):
                rows = csv_rows(mode)
                packed = read_js(
                    "const fs=require('fs'), vm=require('vm');"
                    "console.log(JSON.stringify(vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8')+';'+process.argv[2])))",
                    payload, mode + 'Data')
                self.assertEqual(len(packed), len(rows))
                self.assertEqual(len({(r['Id'], r['Season']) for r in rows}), len(rows))
                births = defaultdict(set)
                names = defaultdict(set)
                for raw, record in zip(rows, packed):
                    self.assertEqual({key:raw[key] for key in record}, record)
                    if raw['Born']:
                        births[raw['Id']].add(raw['Born'])
                    names[raw['Player']].add(raw['Id'])
                self.assertTrue(all(len(values) == 1 for values in births.values()))
                self.assertTrue(any(len(values) > 1 for values in names.values()))

    def test_supplemental_metrics_against_source_counts(self):
        for mode in ['batting', 'pitching']:
            with self.subTest(mode=mode):
                rows = csv_rows(mode)
                stats = read_js(
                    "const D=require('./decision-audit'), pitch=process.argv[1]==='pitching';"
                    "const rows=pitch?require('vm').runInNewContext(require('fs').readFileSync('pitching-data.js','utf8')+';pitchingData'):require('./sample_data.json');"
                    "const engine=(pitch?require('./pitching'):require('./analytics')).create(rows);"
                    "console.log(JSON.stringify(Object.fromEntries([...engine.lookup].map(([key,row])=>[key,D.deepStats(row,pitch)]))))",
                    mode)
                checked = 0
                for row in rows:
                    key = row['Id'] + '|' + row['Season']
                    if key not in stats:
                        continue
                    checked += 1
                    def ratio(a, b):
                        return float(a / b) if b else None
                    h, bb, so, hr = (int(row[k]) for k in ('H', 'BB', 'SO', 'HR'))
                    if mode == 'batting':
                        xbh = int(row['2B']) + int(row['3B']) + hr
                        sb, cs = int(row['SB']), int(row['CS'])
                        expected = dict(xbh=xbh, xbhShare=ratio(xbh, h), bbk=ratio(bb, so),
                                        hrpa=ratio(hr, int(row['PA'])), stealRate=ratio(sb, sb+cs))
                    else:
                        ip = sum(map(Fraction, row['IP'].split()))
                        expected = dict(kbb=ratio(so-bb, int(row['TBF'])), bb9=ratio(9*bb, ip),
                                        h9=ratio(9*h, ip), k9=ratio(9*so, ip), hr=ratio(9*hr, ip))
                    for metric, value in expected.items():
                        self.assertAlmostEqual(stats[key][metric], value, msg=f'{key} {metric}')
                self.assertEqual(checked, len(stats))
                self.assertGreater(checked, 7000)

    def test_pitcher_rates_from_csv(self):
        rows = csv_rows('pitching')
        stats = read_js(
            "const fs=require('fs'), vm=require('vm'), P=require('./pitching');"
            "const rows=vm.runInNewContext(fs.readFileSync('pitching-data.js','utf8')+';pitchingData');"
            "console.log(JSON.stringify(rows.map(P.seasonStats)))")
        for raw, actual in zip(rows, stats):
            ip = sum(map(Fraction, raw['IP'].split()))
            self.assertEqual(actual['outs'], ip * 3)
            for key, numerator, denominator in [
                ('k', int(raw['SO']), int(raw['TBF'])),
                ('bb', int(raw['BB']), int(raw['TBF'])),
                ('hr', int(raw['HR']) * 9, ip),
                ('whip', int(raw['H']) + int(raw['BB']), ip),
            ]:
                if denominator:
                    self.assertAlmostEqual(actual[key], float(numerator / denominator))
                else:
                    self.assertIsNone(actual[key])
            if actual['era'] is not None:
                self.assertAlmostEqual(actual['era'], float(int(raw['ER']) * 9 / ip), delta=0.005001)
            else:
                self.assertTrue(not ip or raw['ERA'] in ('', '-'))


if __name__ == '__main__':
    unittest.main()
