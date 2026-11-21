/* 출처 시점의 구장 규격. 선택 시즌의 실제 구장 또는 파크팩터로 자동 적용 금지. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.KBOParks=factory();})(globalThis,function(){
const checkedAt='2026-11-16';
const parks={
  "LG": {
    "name": "잠실야구장",
    "left": 100,
    "center": 125,
    "right": 100,
    "wall": null,
    "basis": "서울시 시설 안내 · 게시연도 미표시",
    "source": "https://stadium.seoul.go.kr/digital-archive/video/jamsil-baseball-stadium",
    "note": "중앙 타구 비거리·홈/원정 장타 기록 확인",
    "caution": "현재 시즌 규격 재측정 자료 없음",
    "fact": "좌 100m · 중앙 125m · 우 100m"
  },
  "두산": {
    "name": "잠실야구장",
    "left": 100,
    "center": 125,
    "right": 100,
    "wall": null,
    "basis": "서울시 시설 안내 · 게시연도 미표시",
    "source": "https://stadium.seoul.go.kr/digital-archive/video/jamsil-baseball-stadium",
    "note": "중앙 타구 비거리·홈/원정 장타 기록 확인",
    "caution": "현재 시즌 규격 재측정 자료 없음",
    "fact": "좌 100m · 중앙 125m · 우 100m"
  },
  "SSG": {
    "name": "인천SSG랜더스필드",
    "left": 95,
    "center": 120,
    "right": 95,
    "wall": null,
    "basis": "SSG 공식 시설 안내 · 게시연도 미표시",
    "source": "https://www.ssglanders.com/stadium/info",
    "note": "타구 방향·홈/원정 홈런 비율 확인",
    "caution": "구장 거리만으로 홈런 증가 판단 불가",
    "fact": "좌 95m · 중앙 120m · 우 95m"
  },
  "KIA": {
    "name": "광주-기아 챔피언스 필드",
    "left": 99,
    "center": 121,
    "right": 99,
    "wall": null,
    "basis": "KIA 공식 시설 안내 · 게시연도 미표시",
    "source": "https://tigers.co.kr/tigers/champions-field",
    "note": "타구 방향·비거리 확인",
    "caution": "확인된 펜스 높이 자료 없음",
    "fact": "좌 99m · 중앙 121m · 우 99m"
  },
  "키움": {
    "name": "고척스카이돔",
    "left": 99,
    "center": 122,
    "right": 99,
    "wall": 4,
    "basis": "서울시 완공 안내 · 2015년 시설 기준",
    "source": "https://news.seoul.go.kr/citybuild/archives/229225",
    "note": "실내 돔 · 구장별 장타 기록 확인",
    "caution": "좌우·중앙 거리는 반올림 표기 · 과거 목동구장과 구분",
    "fact": "좌 99m · 중앙 122m · 우 99m"
  },
  "한화": {
    "name": "대전 한화생명 볼파크",
    "left": 99,
    "center": 122,
    "right": 95,
    "wall": null,
    "wallNote": "몬스터 월 8m (2025년 개장 자료 · 구간별 높이 상이)",
    "basis": "한국프로스포츠협회 소개 · 2025년",
    "source": "https://webzine.prosports.or.kr/page/vol17/view?idx=259",
    "wallSource": "https://www.daejeon.go.kr/drh/board/boardNormalView.do?boardId=normal_0189&menuSeq=1632&ntatcSeq=1475377281&pageIndex=73",
    "note": "비대칭 외야 · 좌중간 115m / 우중간 112m · 타구 방향 확인",
    "caution": "기존 이글스파크와 다른 구장 · 몬스터 월 8m는 일부 구간 · 전체 펜스 높이 아님",
    "fact": "좌 99m · 중앙 122m · 우 95m"
  },
  "삼성": {
    "name": "대구삼성라이온즈파크",
    "left": 99.5,
    "center": 122.5,
    "right": 99.5,
    "wall": 3.2,
    "basis": "스포츠동아 개장 보도 · 2016-03-18",
    "source": "https://web.donga.com/pdf/pdf_viewer.php?vcid=2016031810W0201",
    "note": "팔각형 외야 · 좌우중간 타구 분포 확인",
    "caution": "개장 당시 규격 · 다른 자료의 중앙 122m/펜스 3.6m 표기와 차이 · 최신 실측 미확인",
    "fact": "좌 99.5m · 중앙 122.5m · 우 99.5m"
  },
  "롯데": {
    "name": "사직야구장",
    "left": 95.8,
    "center": 120.5,
    "right": 95.8,
    "wall": 6,
    "basis": "뉴스1 보도 · 2024년 (2022년 개조 후)",
    "source": "https://v.daum.net/v/5lQziDyjpc",
    "note": "높은 외야 펜스 · 타구 높이·비거리 확인",
    "caution": "개조 전 95/118/95m·4.8m와 구분 · 이후 변경 미확인",
    "fact": "좌 95.8m · 중앙 120.5m · 우 95.8m"
  },
  "KT": {
    "name": "수원 KT위즈파크",
    "left": 98,
    "center": 120,
    "right": 98,
    "wall": null,
    "basis": "수원도시공사 시설 안내 인용 · 2차 자료",
    "source": "https://www.yagoonara.com/ballparks/facilities/수원",
    "note": "홈/원정 장타 기록 확인",
    "caution": "공사 원문 접속 실패 · 2차 자료 기준 · 펜스 높이 미확인",
    "fact": "좌 98m · 중앙 120m · 우 98m"
  },
  "NC": {
    "name": "창원NC파크",
    "left": 101.2,
    "center": 122,
    "right": 101.2,
    "wall": null,
    "basis": "엔씨소프트 공식 소개 · 2020년",
    "source": "https://blog.ncsoft.net/news/article/chang-won-nc-park",
    "note": "외야 타구 비거리 확인",
    "caution": "공식 소개 수치 · 일부 자료의 좌우 101m와 정밀도 차이 · 최신 실측 미확인",
    "fact": "좌 101.2m · 중앙 122m · 우 101.2m"
  }
};
// Direction-specific measurements remain unknown unless the source distinguishes them.
for(const park of Object.values(parks))park.wallByDirection={left:null,center:null,right:null};
parks['한화'].wallByDirection={left:2.4,center:2.4,right:8};
parks['한화'].wallNote='좌측·중앙 2.4m / 우측 몬스터 월 구간 8m · 2025년 개장 자료';
parks['한화'].wallSource='https://www.daejeon.go.kr/its/ItsdjNormalboardView.do?boardGubun=itsdj01&boardSeq=3349&menuSeq=';
return {parks,checkedAt,get:team=>parks[team]||null};
});
