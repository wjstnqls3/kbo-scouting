/* Verified public facts, not a live news feed. Amounts in KRW.
   A multi-year total never becomes an inferred annual salary.
   Contract range means reported coverage, not proof of options being exercised. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.KBOContractData=api;
})(globalThis,function(){
 const checkedAt='2026-11-16';
 const kbo2025={source:'https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=11394',publisher:'KBO',reportedAt:'2025-03-05'};
 const kbo2022={source:'https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=8273',publisher:'KBO',reportedAt:'2022-02-21'};
 const salaries=[
  {id:'71564',season:2011,team:'롯데',amount:630000000,source:'https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=3894',publisher:'KBO',reportedAt:null},
  {id:'67341',season:2022,team:'키움',amount:750000000,...kbo2022},
  {id:'68050',season:2022,team:'KT',amount:550000000,...kbo2022},
  {id:'67341',season:2023,team:'키움',amount:1100000000,source:'https://www.yna.co.kr/view/AKR20230120142151007',publisher:'연합뉴스',reportedAt:'2023-01-20'},
  {id:'52605',season:2024,team:'KIA',amount:100000000,...kbo2025},
  {id:'52605',season:2025,team:'KIA',amount:500000000,...kbo2025},
  {id:'68050',season:2025,team:'KT',amount:700000000,...kbo2025},
  {id:'75847',season:2025,team:'SSG',amount:1700000000,...kbo2025},
  {id:'62404',season:2025,team:'삼성',amount:2000000000,...kbo2025}
 ];
 const contracts=[
  {id:'71564',kind:'FA',team:'롯데',start:2021,end:2022,period:'2년 · 2021–2022',total:2600000000,maximum:true,detail:'계약금 8억 원 · 시즌 연봉 8억 원 · 우승 옵션 매년 1억 원',source:'https://www.yna.co.kr/amp/view/AKR20210129045551007',publisher:'연합뉴스',reportedAt:'2021-01-29'},
  {id:'75125',kind:'FA',team:'KT',start:2022,end:2024,period:'3년 · 2022–2024',total:3000000000,maximum:true,detail:'계약금 7억 원 · 3년 연봉 합계 20억 원 · 옵션 합계 3억 원',source:'https://www.yna.co.kr/view/AKR20211229075651007',publisher:'연합뉴스',reportedAt:'2021-12-29'},
  {id:'62415',kind:'FA',team:'LG',start:2022,end:2025,period:'4년 · 2022–2025',total:6000000000,maximum:true,detail:'계약금 32억 원 · 시즌 연봉 6억 원 · 인센티브 합계 4억 원',source:'https://www.yna.co.kr/view/AKR20211214071400007',publisher:'연합뉴스',reportedAt:'2021-12-14'},
  {id:'62907',kind:'FA',team:'NC',start:2023,end:2027,period:'5+3년 · 기본 2023–2027 / 조건부 연장 2028–2030',total:14000000000,maximum:true,detail:'기본 5년 최대 90억 원(옵션 10억 원 포함) · 조건부 연장 3년 최대 50억 원 · 연장 실행 여부 미확인',source:'https://www.yna.co.kr/view/AKR20221123125651007',publisher:'연합뉴스',reportedAt:'2022-11-23'},
  {id:'62404',kind:'비FA 다년 계약',team:'삼성',start:2022,end:2026,period:'5년 · 2022–2026',total:12000000000,maximum:true,detail:'5년 연봉 합계 90억 원 · 인센티브 합계 30억 원',source:'https://www.yna.co.kr/view/AKR20220203147800007',publisher:'연합뉴스',reportedAt:'2022-02-03'}
 ];
 // Additional sourced contract periods; no division of total amounts into yearly pay.
 contracts.push(
  {id:'71564',kind:'FA',team:'롯데',start:2017,end:2020,period:'4년 · 2017–2020',total:15000000000,maximum:true,detail:'시즌 연봉 25억 원 · 계약금·옵션 합계 50억 원',source:'https://www.yna.co.kr/view/AKR20170131141600007',publisher:'연합뉴스',reportedAt:'2017-01-31'},
  {id:'74540',kind:'FA',team:'삼성',start:2018,end:2021,period:'4년 · 2018–2021',total:8000000000,maximum:true,detail:'2017년 체결 · 4년 총액 80억 원',source:'https://www.samsunglions.com/history/stat_6_4.asp',publisher:'삼성 라이온즈 공식 FA 현황',reportedAt:null},
  {id:'74540',kind:'FA',team:'삼성',start:2022,end:2025,period:'4년 · 2022–2025',total:3600000000,maximum:true,detail:'2021년 체결 · 계약금 12억 원 · 연봉 합계 20억 원 · 인센티브 합계 4억 원',source:'https://www.yna.co.kr/view/AKR20211224079100007',publisher:'연합뉴스',reportedAt:'2021-12-24'},
  {id:'74540',kind:'FA',team:'삼성',start:2026,end:2027,period:'2년 · 2026–2027',total:2000000000,maximum:true,detail:'2025년 체결 · 계약금 10억 원 · 시즌 연봉 3억 원 · 인센티브 매년 2억 원',source:'https://www.yna.co.kr/view/AKR20251228016200007',publisher:'연합뉴스',reportedAt:'2025-12-28'},
  {id:'75847',kind:'FA',team:'SSG / SK',start:2015,end:2018,period:'4년 · 2015–2018',total:8600000000,maximum:true,detail:'당시 SK와 체결 · 4년 총액 86억 원',source:'https://www.yna.co.kr/view/AKR20241104080500007',publisher:'연합뉴스 · 과거 계약 확인',reportedAt:'2024-11-06'},
  {id:'75847',kind:'FA',team:'SSG / SK',start:2019,end:2024,period:'6년 · 2019–2024',total:10600000000,maximum:true,detail:'당시 SK와 체결 · 6년 총액 106억 원',source:'https://www.yna.co.kr/view/AKR20241104080500007',publisher:'연합뉴스 · 과거 계약 확인',reportedAt:'2024-11-06'},
  {id:'75847',kind:'FA',team:'SSG',start:2025,end:2028,period:'4년 · 2025–2028',total:11000000000,maximum:false,detail:'계약금 30억 원 · 연봉 합계 80억 원 · 전액 보장',source:'https://www.yna.co.kr/view/AKR20241104080500007',publisher:'연합뉴스',reportedAt:'2024-11-06'},
  {id:'62415',kind:'FA',team:'LG',start:2026,end:2029,period:'4년 · 2026–2029',total:6500000000,maximum:true,detail:'2025년 체결 · 계약금 35억 원 · 연봉 합계 25억 원 · 인센티브 합계 5억 원',source:'https://www.lg.co.kr/media/release/29619',publisher:'LG 공식 보도자료',reportedAt:'2025-11-21'}
 );
 const changes=[
  {id:'75125',season:2024,date:'2024-05-28',text:'소속 변경 · KT → 삼성 트레이드 · 기존 FA 계약은 2024년까지 · 총액 변경 자료 미확인',source:'https://www.samsunglions.com/intro/intro02.asp?act=view&idx=1016746&keyword=&page=22&search=',publisher:'삼성 라이온즈',reportedAt:'2024-05-28'},
  {id:'75125',season:2025,date:'2025-01-24',text:'기존 FA 계약 종료 후 연봉 3억 8천만 원으로 재계약',source:'https://www.yna.co.kr/view/AKR20250124065800007',publisher:'연합뉴스',reportedAt:'2025-01-24'},
  {id:'71564',season:2021,date:'2021-01-29',text:'2017–2020년 4년 150억 원 계약 종료 · 2021–2022년 2년 최대 26억 원 재계약',source:'https://www.yna.co.kr/amp/view/AKR20210129045551007',publisher:'연합뉴스',reportedAt:'2021-01-29'},
  {id:'74540',season:2022,date:'2021-12-24',text:'2018–2021년 4년 80억 원 계약 종료 · 2022–2025년 4년 최대 36억 원 재계약',source:'https://www.yna.co.kr/view/AKR20211224079100007',publisher:'연합뉴스',reportedAt:'2021-12-24'},
  {id:'74540',season:2026,date:'2025-12-28',text:'2022–2025년 계약 종료 · 2026–2027년 2년 최대 20억 원 재계약',source:'https://www.yna.co.kr/view/AKR20251228016200007',publisher:'연합뉴스',reportedAt:'2025-12-28'},
  {id:'62415',season:2026,date:'2025-11-21',text:'2022–2025년 계약 종료 · 2026–2029년 4년 최대 65억 원 재계약',source:'https://www.lg.co.kr/media/release/29619',publisher:'LG 공식 보도자료',reportedAt:'2025-11-21'}
 ];
 salaries.push({id:'75125',season:2025,team:'삼성',amount:380000000,source:'https://www.yna.co.kr/view/AKR20250124065800007',publisher:'연합뉴스',reportedAt:'2025-01-24'});
 for(let season=2017;season<=2020;season++)salaries.push({id:'71564',season,team:'롯데',amount:2500000000,source:'https://www.yna.co.kr/view/AKR20210304100600007',publisher:'연합뉴스 · 해당 기간 연봉 확인',reportedAt:'2021-03-04'});
 for(let season=2026;season<=2027;season++)salaries.push({id:'74540',season,team:'삼성',amount:300000000,source:'https://www.yna.co.kr/view/AKR20251228016200007',publisher:'연합뉴스',reportedAt:'2025-12-28'});
 // Annual salary only where the article explicitly gives that per-season figure.
 const lee=contracts[0],park=contracts[2];
 for(const [contract,amount] of [[lee,800000000],[park,600000000]]){
  for(let season=contract.start;season<=contract.end;season++)salaries.push({id:contract.id,season,team:contract.team,amount,source:contract.source,publisher:contract.publisher,reportedAt:contract.reportedAt});
 }
 function lookup(id,season,team){
  const year=Number(season),key=String(id);
  const salary=salaries.find(x=>x.id===key&&x.season===year&&(!team||team===x.team))||null;
  const applicable=contracts.filter(x=>x.id===key&&year>=x.start&&year<=x.end);
  return {salary,contracts:applicable,changes:changes.filter(x=>x.id===key&&x.season===year),checkedAt};
 }
 return {lookup,checkedAt};
});
