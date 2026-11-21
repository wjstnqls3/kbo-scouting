#!/bin/zsh
# 일반 macOS 터미널에서 실행. 설치 → 실제 테스트 → 학습 → 시각화를 순서대로 수행.
set -euo pipefail
ML_RUN_DIR=${0:A:h}
ML_LAST_SEASON=${1:-2025}
cd "$ML_RUN_DIR"
export PIP_CACHE_DIR="$ML_RUN_DIR/.pip-cache"
export MPLCONFIGDIR="$ML_RUN_DIR/.mpl-cache"
export PYTHONDONTWRITEBYTECODE=1
ML_RESULT_DIR="$ML_RUN_DIR/output/run_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$ML_RESULT_DIR"
exec > >(tee "$ML_RESULT_DIR/execution.log") 2>&1
print "입력 마지막 시즌: $ML_LAST_SEASON · 시즌 확정 여부 별도 확인 필요"
python3 -m venv .venv
.venv/bin/python -m pip install --retries 1 --timeout 15 -r requirements.txt
# 이 단계가 통과해야 학습 테스트가 패키지 부족으로 건너뛰어지는 것을 막을 수 있음.
.venv/bin/python -c 'import pandas, sklearn, joblib, matplotlib; print("패키지 확인:", pandas.__version__, sklearn.__version__, joblib.__version__, matplotlib.__version__)'
.venv/bin/python -m unittest discover -s . -p 'test_*.py' -v
.venv/bin/python predict_home_runs.py --through-season "$ML_LAST_SEASON" --output-dir "$ML_RESULT_DIR"
.venv/bin/python visualize_results.py "$ML_RESULT_DIR"
.venv/bin/python -m pip freeze > "$ML_RESULT_DIR/requirements.lock.txt"
print "학습·검증·보고서 생성 완료: $ML_RESULT_DIR/report.html"
