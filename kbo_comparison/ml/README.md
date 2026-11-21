# 다음 시즌 홈런 예측 · Random Forest

기존 웹사이트의 실제 성적 분석과 분리된 Python 실험 코드입니다. `predict_home_runs.py`에 한국어 주석을 포함했습니다. 프로젝트 CSV를 직접 읽으며 스탯티즈 자료를 추가 수집하지 않습니다.

## 실행

Python 3.9 이상에서 프로젝트 상위 폴더(`jeonsubb`)를 기준으로 실행합니다.

설치부터 검증·학습·그래프까지 한 번에 실행하려면 일반 macOS 터미널에서 다음 명령을 사용합니다. 패키지 설치나 테스트가 실패하면 뒤의 학습 단계로 넘어가지 않습니다. 실행마다 새 결과 폴더를 만들고 로그·설치 버전을 저장합니다.

```sh
zsh kbo_comparison/ml/install_and_train.command 2025
```

아래는 단계별 실행 방법입니다.

```sh
python3 -m venv kbo_comparison/ml/.venv
kbo_comparison/ml/.venv/bin/python -m pip install -r kbo_comparison/ml/requirements.txt

# 실행 예: 2025년까지의 기록으로 학습·검증하고 2026년을 예측
# CSV의 2026년 행은 이 실행의 입력·정답·리그 평균 계산에서 모두 제외
kbo_comparison/ml/.venv/bin/python kbo_comparison/ml/predict_home_runs.py --through-season 2025
kbo_comparison/ml/.venv/bin/python kbo_comparison/ml/visualize_results.py kbo_comparison/ml/output/2026
```

`--through-season`은 사용자가 확인한 마지막 입력 시즌입니다. 기본값을 자동으로 최신 연도로 잡지 않습니다. 현재 동봉 메타데이터는 시즌별 최종 확정 여부를 제공하지 않으므로 **2025년 예시 역시 자료의 완전성을 보증하는 것은 아닙니다.** 2026년 자료의 마감·완전성을 확인한 후 `--through-season 2026`으로 실행하면 2027년을 예측합니다. 미확인 상태도 실험은 가능하나 콘솔과 출력 자료에 상태를 남깁니다.

옵션:

| 옵션 | 기본값 | 의미 |
|---|---:|---|
| `--min-pa` | 100 | 입력 시즌의 최소 타석. 다음 시즌 타석으로 선별하지 않음 |
| `--validation-seasons` | 3 | 마지막 몇 개 정답 시즌을 순차 검증할지 설정 |
| `--trees` | 300 | Random Forest 트리 수 |
| `--seed` | 42 | 재현성을 위한 난수 설정 |
| `--csv` | 프로젝트 CSV | 다른 동일 구조의 CSV 경로 |
| `--output-dir` | `ml/output/예측연도` | 결과 저장 폴더 |

## 무엇을 학습하나요?

- 입력: t년의 연 나이·경기·타석·안타·홈런·볼넷·삼진 등, 재계산한 타율·출루율·장타율·ISO·HR%·BB%·K%, 같은 시즌 리그 홈런/타석 및 상대 홈런 비율.
- 정답: 같은 선수의 **정확히 t+1년 홈런 수**. 선수 ID는 동명이인 구분·연결에만 사용하고 모델 입력과 결과 표에서는 제외합니다.
- 예측: 마지막 입력 시즌 최소타석을 충족한 타자의 다음 해 홈런 수. 신인처럼 이전 기록이 없는 선수는 예측할 수 없습니다.
- 구단은 입력 시즌 소속을 출력에 보존하지만 모델 변수로 사용하지 않습니다. 다음 시즌 구단·타석·리그 성적을 미리 아는 것처럼 사용하지 않습니다.

## 미래 자료 누출 방지

2025년 검증은 `2024년 입력 → 2025년 홈런`을 예측합니다. 이때 모델은 정답 연도가 2024년 이하인 쌍만 학습합니다. 결측치 중앙값도 해당 학습 구간에서만 구합니다. 무작위로 행을 섞지 않으며, 한 시즌 전체를 검증 단위로 사용합니다.

같은 선수의 과거 시즌을 학습하는 것은 허용합니다. 실제 사용 목적은 이미 기록이 있는 선수의 다음 해 예측이므로, 이 검증은 처음 보는 선수에 대한 일반화 성능 검증과는 다릅니다. 검증 후 하이퍼파라미터를 반복 조정하면 별도의 최종 평가 시즌을 남겨야 합니다. 현재 코드는 고정 설정을 사용합니다.

## 결과 해석

| 결과 파일 | 내용 |
|---|---|
| `predictions.csv` | 이름·생년월일·입력 시즌 구단·입력 연도·예측 연도·기존 타석/홈런·예측 홈런 |
| `backtest.csv` | 연도순 검증의 실제 홈런과 예측 홈런 |
| `metrics.json` | 시즌별 MAE·RMSE·R², 전년도 홈런 유지 기준선, 표본 수, CSV 해시, 자료 상태 |
| `model.joblib` | 최종 학습 모델과 특징 목록 |
| `report.html` | PNG를 포함한 인터넷 없이 열리는 성능·선수 비교 보고서 |
| `yearly_mae.png` / `.pdf` | 연도별 모델·기준선 MAE 비교 |
| `actual_vs_predicted.png` / `.pdf` | 실제 홈런과 예측 홈런 산점도 |
| `player_comparison.png` / `.pdf` | 마지막 검증 시즌 실제 홈런 상위 15명 비교 |
| `performance_table.csv` | 시즌별·합산 오차 및 MAE 개선율 |

- **MAE**: 예측과 실제 홈런 수의 평균 절대 차이. 작을수록 좋음. 예를 들어 MAE 4는 평균적으로 약 4개 차이.
- **RMSE**: 큰 오차를 더 크게 반영한 지표. 작을수록 좋음.
- **R²**: 실제값 변동에 대한 설명 정도. 음수도 가능하며, 일정한 정답만 있는 표본은 계산하지 않음.
- **기준선**: 전년도 홈런 수를 그대로 다음 시즌 예측으로 사용. Random Forest가 반드시 더 좋지는 않음.
- 예측 18.4는 약 18개 수준이라는 모델 출력이며, 100점 만점 적합도나 확정 기록·성공 확률이 아님.

중요한 제한: 다음 시즌 행이 없을 때 은퇴·해외 진출·자료 누락을 구별할 수 없어 정답을 0으로 만들지 않습니다. 따라서 학습·검증은 **다음 시즌 기록이 확인된 선수**에 치우치며, 모든 현역 선수에 대한 오차로 일반화할 수 없습니다. 원본에 실제로 존재하는 0타석·0홈런 행은 유효한 0 정답으로 사용할 수 있습니다. 부상·출전 기회·이적·구장 변화·리그 규정 변화는 예측하지 않습니다. 리그 평균 변수만으로 모든 시대 차이가 제거되는 것도 아닙니다.

## 검사

```sh
kbo_comparison/ml/.venv/bin/python -m unittest discover -s kbo_comparison/ml -p 'test_*.py' -v
```

연도 공백, 동명이인, 다음 시즌 소타석 선수, 명시적 0 기록과 결측의 차이, 중복 행, 미래 기록 배제, 최종 출력 저장을 검사합니다. 의존 패키지가 없으면 테스트를 건너뛰므로 실행 결과의 `skipped` 수를 확인하세요.

## 현재 실행 상태

2026-11-17 점검에서 현재 작업 환경의 외부 DNS 조회가 실패하여 새 가상환경에 패키지를 설치하지 못했습니다. 기본 Python은 3.9.6이며, 기존 `/opt/miniconda3/envs/sports/bin/python`은 Python 3.14.0·pandas 3.0.6·matplotlib 3.11.1을 갖고 있으나 scikit-learn·joblib이 없습니다.

기존 sports 환경으로 데이터·성능 산식·보고서 검사 9개 통과, 실제 학습 테스트 1개 건너뜀. 데이터 처리와 모델 가져오기를 분리해, 학습 패키지가 없어도 데이터 오류와 기준선을 검사할 수 있게 했습니다. pandas 허용 범위는 이 데이터 검사에서 확인한 3.x도 포함합니다. 이 환경에서 Random Forest는 아직 학습하지 않았습니다.

`output/baseline_2025/report.html`은 **기준선만 실행한 결과**입니다. 학습 모델의 결과가 아니며 Random Forest 값은 `미실행`으로 표시합니다. 별도 기준선 실행 명령:

```sh
python evaluate_baseline.py --through-season 2025
python visualize_results.py output/baseline_2025
```

성능표와 CSV의 MAE·파일 해시를 대조한 뒤 그래프를 생성합니다. 합산 성능은 모든 검증 행을 합쳐 계산하며, 개선율이 음수면 Random Forest가 기준선보다 나쁜 결과입니다. 보고서에 가짜 예측값이나 임의 성능을 채우지 않습니다.

참고: [RandomForestRegressor 공식 문서](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.RandomForestRegressor.html), [교차 검증 공식 문서](https://scikit-learn.org/stable/modules/cross_validation.html).
