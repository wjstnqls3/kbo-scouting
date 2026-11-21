"""Regenerate JSON and file-opening fallback from the local source CSV."""
from pathlib import Path
from datetime import datetime, timezone
import csv
import hashlib
import json

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'kbo_batting_stats_season_1982-2026.csv'
FIELDS = ['Id','Player','Age','Born','Position','Season','Team','Career','career_kbo','G','PA','AB','H','HR','TB','BB','HBP','SF','SO','2B','3B','RBI','SB','CS','R']

def sync():
    with SOURCE.open(encoding='utf-8-sig', newline='') as stream:
        rows = [{field: row[field] for field in FIELDS} for row in csv.DictReader(stream)]
    text = json.dumps(rows, ensure_ascii=False, separators=(',', ':'))
    (ROOT / 'sample_data.json').write_text(text, encoding='utf-8')
    (ROOT / 'data.js').write_text('const battingData = ' + text + ';\n', encoding='utf-8')
    metadata_path = ROOT / 'data_metadata.json'
    metadata = json.loads(metadata_path.read_text(encoding='utf-8')) if metadata_path.exists() else {}
    metadata.setdefault('original_source', None)
    metadata.setdefault('collected_at', None)
    metadata.setdefault('season_status', {})
    metadata.update({'source_file': SOURCE.name, 'packaged_at': datetime.now(timezone.utc).isoformat(),
                     'sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'row_count': len(rows),
                     'min_season': min(int(r['Season']) for r in rows), 'max_season': max(int(r['Season']) for r in rows)})
    meta_text = json.dumps(metadata, ensure_ascii=False, indent=2)
    metadata_path.write_text(meta_text, encoding='utf-8')
    (ROOT / 'metadata.js').write_text('const battingMetadata = '+meta_text+';\n', encoding='utf-8')
    return len(rows)

if __name__ == '__main__':
    print(f'{sync():,}개 기록 동기화 완료')
