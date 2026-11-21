"""Generate the offline pitching payload from the bundled season CSV."""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'kbo_pitching_stats_season_1982-2026.csv'
FIELDS = ('Id', 'Player', 'Born', 'Season', 'Team', 'ERA', 'IP', 'G', 'SV',
          'HLD', 'TBF', 'SO', 'BB', 'H', 'HR')

def generate(source=SOURCE, output=ROOT / 'pitching-data.js'):
    with source.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        if not set(FIELDS).issubset(reader.fieldnames or []):
            raise ValueError('Missing required pitching columns')
        rows = [{field: row[field] for field in FIELDS} for row in reader]
    metadata = {'source_file': source.name, 'row_count': len(rows),
                'sha256': hashlib.sha256(source.read_bytes()).hexdigest()}
    compact = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    output.write_text(f'const pitchingData = {compact(rows)};\nconst pitchingMetadata = {compact(metadata)};\n', encoding='utf-8')

if __name__ == '__main__':
    generate()
