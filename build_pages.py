"""Copy the approved website files to the Cloudflare Pages output directory."""
from pathlib import Path
from shutil import copyfile

ROOT = Path(__file__).resolve().parent
FILES = (
    '404.html',
    'analytics.js',
    'app.js',
    'assets/baseball-field-pattern.svg',
    'assets/batting-intro.png',
    'assets/kbo-featured-players.png',
    'assets/kbo-players-lower.png',
    'assets/kbo-players-upper.png',
    'assets/kbo-teams-2026-v2.png',
    'assets/kbo-teams-2026.png',
    'button-hover.css',
    'charts.js',
    'contract-data.js',
    'core.js',
    'dashboard.css',
    'dashboard.js',
    'data.js',
    'data_metadata.json',
    'docs/계산기준.html',
    'docs/외야포지션_기준.md',
    'index.html',
    'kbo_batting_stats_season_1982-2026.csv',
    'metadata.js',
    'mongodb-theme.css',
    'parks.js',
    'portfolio-model.js',
    'portfolio.css',
    'portfolio.js',
    'position-data.js',
    'repository.js',
    'sample_data.json',
    'scouting-context.js',
    'scouting-dashboard.html',
    'scouting-entry.js',
    'scouting-observations.js',
    'scouting-portfolio.html',
    'scouting-ui.js',
    'scouting.js',
)

for name in FILES:
    target = ROOT / "site" / name
    target.parent.mkdir(parents=True, exist_ok=True)
    copyfile(ROOT / "kbo_comparison" / name, target)
