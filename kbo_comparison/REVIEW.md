# 구현 후 재검토

## 반영 완료
- 최고 기록: 선택 기간 전체 / 연도별.
- 구단 통합: SK/SSG 등 동일 구단을 검색과 최고 집계에 동일하게 적용.
- 대상끼리 비교: 두 명 이상이면 추천 추가 없이 비교·CSV 가능.
- 추천 설정: 지표별 0~10 비중, 0 제외, 전체 0 거부, 기본값 복원.
- 선택 키: 선수 ID+시즌 통일. 직접 검색/추천 중복 및 시즌 변경 충돌 방지.
- 기록 부족: 기존 카드·선택 유지, 오류 별도 표시.
- 자료 신뢰도: 원출처·수집일·시즌 완료 여부 미확인 표시. 변환일 구분.
- 조건 배지: 개별 해제·필터 초기화. 대상과 비교 선택 유지.
- 데이터 동기화: CSV → JSON/실행 JS/메타데이터 재생성 스크립트 제공.

## 검증
- Node 계산 테스트 8개 통과: 미출전 연도, 3시즌 비율, 추천 수/비중, 규정 타석 경계, 연도별/기간별 최고, 구단 통합, 실제 2022 박병호·이정후 기록, JSON과 JS 일치.
- DOM 모의 환경 화면 상태/이벤트 테스트 3개 통과: 초기화, 대상끼리 비교와 CSV, 기록 부족 시 보존, 추천/검색 중복, 선택 유지, 조건 배지와 비중 오류. 실제 브라우저 검증과 구분.
- Python HTTP 핸들러 테스트 3개 통과: 선수 API, 메타데이터, 파일 누락 오류.
- JavaScript 구문 확인.
- 실제 로컬 서버 바인딩은 실행 환경에서 차단. Chrome headless 기동도 실패하여 브라우저 전체 흐름 검증은 미완료. 인수 확인표로 후속 확인 필요.

## 남은 데이터 한계
실제 팀 경기수 대신 시즌 예정 경기수로 규정 타석 계산. 출처·수집일·최신 시즌 완료 여부 미확인. 시즌 중 이적 전후 성적 분리와 시즌별 포지션 정확성은 원본 자료 보강 필요. 추천은 지표 유사도이며 가치·미래 성적 예측이 아니다.

## 레퍼런스
- [KBO 타자 기록실](https://www.koreabaseball.com/record/player/hitterbasic/basic1.aspx): 지표와 기록 표기 참고.
- [Baseball Savant Custom Leaderboards](https://baseballsavant.mlb.com/leaderboard/custom): 지표 선택과 리더보드 구성 참고.
- [FanGraphs Custom Date Range](https://blogs.fangraphs.com/instagraphs/leaderboards-update-introducing-custom-date-range/): 조회 기간을 명시하는 흐름 참고.
- [KBO 공식 규칙 9.22](https://6ptotvmi5753.edge.naverncp.com/KBO_FILE/ebook/pdf/2025_%EC%95%BC%EA%B5%AC%EA%B7%9C%EC%B9%99.pdf): 규정 타석 계산 근거.
