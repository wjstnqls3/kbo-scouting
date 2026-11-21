"""Copy the approved website files to the Cloudflare Pages output directory."""
from pathlib import Path
from shutil import copyfile

ROOT = Path(__file__).resolve().parent
FILES = (
    '404.html',
    'analytics.js',
    'assets/kbo-players-lower.png',
    'assets/kbo-players-upper.png',
    'charts.js',
    'core.js',
    'data.js',
    'data_metadata.json',
    'index.html',
    'metadata.js',
    'pitching-data.js',
    'pitching.js',
    'portfolio-model.js',
    'position-data.js',
    'scout-workflow.css',
    'scout-workflow.js',
    'scouting-dashboard.html',
    'scouting-portfolio.html',
)

for name in FILES:
    target = ROOT / "site" / name
    target.parent.mkdir(parents=True, exist_ok=True)
    copyfile(ROOT / "kbo_comparison" / name, target)
