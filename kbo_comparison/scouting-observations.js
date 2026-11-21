/* Short, attributed paraphrases of verified articles. Exact season matching.
   No video is summarized without a verified transcript. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.KBOScoutingObservations=api;
})(globalThis,function(){
 const entries=[
  {id:'71564',season:2011,who:'김무관 · 롯데 타격코치',publisher:'스포츠동아',date:'2011-04-04',source:'https://www.donga.com/news/Sports/article/all/20110404/36124790/5',summary:'홈런 능력에 앞서 정확한 타격을 높게 평가. 힘을 활용해 장타도 만드는 타자로 설명.',opinion:'정확성과 장타를 함께 기대하는 중심타선 후보. 장타 수치만으로 유형을 단정하기보다 타격 정확성을 함께 검토.'},
  {id:'67341',season:2022,who:'스포츠경향 · 시즌 중 기사 분석',publisher:'스포츠경향',date:'2022-06-28',source:'https://sports.khan.co.kr/article/202206281428003',summary:'어린 나이부터 주전을 유지한 꾸준함과 타격의 발전을 평가. 2022년 출루와 장타를 함께 갖춘 타격을 조명.',opinion:'출루와 장타를 함께 맡길 수 있는 상위·중심 타순 후보로 검토. 시즌 중 기사이므로 최종 성적과 구분해서 참고.'},
  {id:'75125',season:2022,who:'이강철 · KT 감독',publisher:'OSEN',date:'2022-04-29',source:'https://www3.osen.co.kr/article/G1111829357',summary:'본래 실력을 신뢰하며 완벽하게 하려는 부담을 줄이고 편하게 타격하도록 주문.',opinion:'부진 구간에서도 역할과 출전 기회를 안정적으로 부여하는 활용을 검토. 감독의 신뢰 발언이 미래 성적을 보장하지는 않음.'},
  {id:'52605',season:2024,who:'이범호 · KIA 감독',publisher:'매일경제',date:'2024-04-03',source:'https://www.mk.co.kr/news/sports/10981105',summary:'출루 뒤 도루로 추가 진루를 만들 수 있다는 점을 평가하며 2번 타순 기용에 신뢰를 표명.',opinion:'출루 뒤 진루까지 연결하는 상위 타순 후보로 검토. 기사에서 언급한 주루 가치는 현재 타격 레이더와 별도로 참고.'},
  {id:'74540',season:2024,who:'박진만 · 삼성 감독',publisher:'머니투데이·스타뉴스',date:'2024-10-20',source:'https://www.mt.co.kr/amp/sports/2024/10/20/2024102001003511904',summary:'플레이오프 타격 흐름이 떨어진 상황에서도 결승 홈런으로 경기를 바꾼 역할을 평가.',opinion:'경기 후반 한 타석의 장타 역할을 검토할 수 있는 베테랑. 단일 경기 평가를 시즌 전체의 승부 강도로 확대하지 않고 참고.'},
  {id:'62404',season:2024,who:'박진만 · 삼성 감독',publisher:'머니투데이·스타뉴스',date:'2024-06-15',source:'https://www.mt.co.kr/sports/2024/06/15/2024061422494961826',summary:'NC전 승리 뒤 구자욱의 주장다운 역할을 칭찬.',opinion:'타선 기여와 함께 팀 내 역할을 참고할 선수. 리더십 발언을 수비력이나 금전 가치 점수로 환산하지 않고 활용.'}
 ];
 const injuries=[
  {id:'78548',date:'2026-07-29',publisher:'KBO 공식 기록',source:'https://www.koreabaseball.com/Record/Player/HitterDetail/Basic.aspx?playerId=78548',summary:'2026년 KT 소속으로 6월 17일~26일, 6월 27일~7월 6일, 7월 29일~8월 7일 부상자명단에 등재됐다. 공식 기록에는 부상 부위가 표시되지 않는다.'},
  {id:'71564',date:'2010-09-26',publisher:'스포츠경향',source:'https://sports.khan.co.kr/article/201009262225174',summary:'2010년 9월 오른쪽 발목을 다친 뒤 깁스를 풀고 타격 훈련에 복귀했다.'},
  {id:'75125',date:'2022-07-02',publisher:'연합뉴스',source:'https://www.yna.co.kr/amp/view/AKR20220702036400007',summary:'2022년 개막 전 발가락 골절로 수술을 받고 6월 4일 복귀했다. 7월에는 KT가 왼쪽 햄스트링 손상 진단을 발표했다.'},
  {id:'67341',date:'2023-07-27',publisher:'연합뉴스',source:'https://www.yna.co.kr/view/AKR20230727136200007',summary:'2023년 7월 왼쪽 발목 신전지대 봉합 수술을 받았다.'},
  {id:'67341',date:'2024-05-17',publisher:'MLB.com',source:'https://www.mlb.com/giants/news/jung-hoo-lee-shoulder-surgery-out-for-2024-season',summary:'2024년 샌프란시스코 소속으로 왼쪽 어깨 탈구 후 관절와순 수술이 결정돼 시즌을 마쳤다.'},
  {id:'52605',date:'2023-04-03',publisher:'머니투데이·스타뉴스',source:'https://www.mt.co.kr/sports/2023/04/03/2023040313113623139',summary:'2023년 4월 KIA가 왼발 다섯째 중족골 골절과 수술 계획을 발표했다.'},
  {id:'52605',date:'2023-11-21',publisher:'KBC',source:'https://ksc.ikbc.co.kr/스포츠/article/view/kbc202311210073',summary:'2023년 APBC 결승에서 왼손 엄지를 다쳤고, KIA가 인대 봉합 수술 계획을 발표했다.'},
  {id:'52605',date:'2025-08-08',publisher:'뉴시스',source:'https://www.newsis.com/view/NISX20250808_0003283838',summary:'2025년 시즌 중 세 차례 햄스트링 부상을 겪었다. 8월 왼쪽 햄스트링 손상 진단 후 KIA가 남은 시즌에 출전시키지 않기로 했다.'},
  {id:'62404',date:'2024-10-15',publisher:'연합뉴스',source:'https://www.yna.co.kr/amp/view/AKR20241015161700007',summary:'2024년 플레이오프 2차전에서 도루 도중 왼쪽 무릎 인대를 다쳐 3·4차전 출전이 무산됐다.'},
  {id:'74540',date:'2024-10-28',publisher:'연합뉴스',source:'https://www.yna.co.kr/amp/view/AKR20241028132500007',summary:'2024년 한국시리즈 5차전에서 부상으로 선발 라인업에서 빠졌다.'}
 ];
 return {lookup:(id,season)=>entries.filter(x=>x.id===String(id)&&x.season===Number(season)), injuriesFor:id=>injuries.filter(x=>x.id===String(id))};
});
