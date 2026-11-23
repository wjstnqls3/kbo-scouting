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
    'pdf-button.css',
    'player-photo.js',
    'portfolio-model.js',
    'position-data.js',
    'scout-workflow.css',
    'scout-workflow.js',
    'scouting-dashboard.html',
    'scouting-portfolio.html',
    'start-motion.js',
    'decision-audit.css',
    'decision-audit.js',
    'decision-audit-ui.js',
)

for name in FILES:
    target = ROOT / "site" / name
    target.parent.mkdir(parents=True, exist_ok=True)
    copyfile(ROOT / "kbo_comparison" / name, target)

# Incremental builds may still contain assets from the retired workflow.
for name in ('time-machine.css', 'time-machine.js', 'time-machine-ui.js'):
    (ROOT / "site" / name).unlink(missing_ok=True)
