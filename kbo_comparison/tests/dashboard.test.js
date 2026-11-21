const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {Element,parse,descendants}=require('./dom-fixture');
const root=path.resolve(__dirname,'..');
async function app(search='?id=67341&year=2022'){
 const doc=new Element('document');parse(fs.readFileSync(path.join(root,'scouting-dashboard.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,''),doc);
 doc.getElementById=id=>descendants(doc).find(e=>e.attrs.id===id);const errors=[];let prints=0;
 const context={document:doc,KBOContractData:require('../contract-data'),KBOScoutingObservations:require('../scouting-observations'),KBOAnalytics:require('../analytics'),KBOScouting:require('../scouting'),KBOParks:require('../parks'),KBOCore:require('../core'),KBORepository:{load:async()=>({records:require('../sample_data.json'),metadata:{}})},location:{search},URLSearchParams,window:{print:()=>prints++},console:{error:e=>errors.push(e)}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'charts.js'),'utf8'),context);vm.runInContext(fs.readFileSync(path.join(root,'scouting-context.js'),'utf8'),context);await vm.runInContext(fs.readFileSync(path.join(root,'dashboard.js'),'utf8'),context);
 assert.deepEqual(errors,[]);return {$:id=>doc.getElementById(id),doc,errors,prints:()=>prints};
}
const panels=(e,cls)=>descendants(e.$('report')).filter(x=>x.tagName==='section'&&(x.attrs.class||'').split(' ').includes(cls));
test('개인 5각형에서 포지션 미확인 안내 후 전체 타자 모드로 복구',async()=>{
 const e=await app('?id=62934&year=2026');
 const mode=e.$('comparison-mode');
 mode.value='position';mode.change();
 let chart=panels(e,'report-assessment')[0].querySelector('svg');
 assert.equal(chart.querySelectorAll('polygon').length,4);
 assert.equal(chart.querySelectorAll('circle').length,0);
 assert.match(e.$('report').textContent,/5각형 점수 없음.*포지션 미확인|포지션 미확인.*5각형 점수 없음/s);
 e.$('comparison-mode').value='all';e.$('comparison-mode').change();
 chart=panels(e,'report-assessment')[0].querySelector('svg');
 assert.equal(chart.querySelectorAll('circle').length,5);
 assert.equal(e.$('player').value,'62934');
 assert.equal(e.$('year').value,'2026');
 assert.match(chart.textContent,/안타 생산력/);
 assert.match(chart.textContent,/삼진 억제력/);
});
test('지표 한글 뜻·연 나이 안내와 맞춤 비중 변경이 선수별 점수에 반영',async()=>{
 const e=await app('?selection=62404%7C2024&selection=62934%7C2026');
 assert.match(e.doc.textContent,/만 나이 아님/);assert.match(e.$('age-min').parent.textContent,/연 나이/);
 assert.match(e.$('tab-finder').textContent,/조건별 선수 찾기/);
 const A=require('../analytics'),engine=A.create(require('../sample_data.json'),{qualifiedBaseline:true});
 assert.match(e.$('fit-controls').textContent,/5각형 지표별 백분위/);
 assert.equal(e.$('fit-weights').querySelectorAll('input').length,5);
 const axesFor=key=>A.compareBatters(engine,[engine.lookup.get(key)])[0].axes;
 e.$('fit-preset').value='onbase';e.$('fit-preset').change();
 const cards=panels(e,'fit-summary')[0].querySelectorAll('article');assert.equal(cards.length,2);
 for(const [i,key] of ['62404|2024','62934|2026'].entries()){
  const scores=Object.fromEntries(axesFor(key).map(axis=>[axis.key,axis.score]));
  const expected=(2*scores.avg+3*scores.bb+scores.k)/6;
  assert.equal(cards[i].querySelector('strong').textContent,`${expected.toFixed(1)} / 100`);
 }
 for(const [preset,axis] of [['strikeout','k'],['walk','bb'],['power','iso'],['speed','sb']]){
  e.$('fit-preset').value=preset;e.$('fit-preset').change();
  assert.equal(e.$('fit-preset').value,preset);
  const score=axesFor('62934|2026').find(item=>item.key===axis).score;
  const result=panels(e,'fit-summary')[0];
  assert.match(result.textContent,/100점 만점/);
  assert.equal(result.querySelectorAll('article')[1].querySelector('strong').textContent,`${score.toFixed(1)} / 100`);
 }
 assert.match(panels(e,'report-similar')[0].textContent,/3\. 유사선수 TOP 5/);
 assert.doesNotMatch(e.doc.textContent,/과거 유사선수/);
 for(const d of A.comparisonAxes)e.$('fit-'+d.key).value='0';e.$('fit-avg').change();
 assert.equal(e.$('fit-preset').value,'custom');assert.match(panels(e,'fit-summary')[0].textContent,/하나 이상 양수 필요/);
 assert.equal(panels(e,'report-assessment')[1].querySelector('svg').querySelectorAll('circle').length,5);
});
test('대시보드 실제 데이터 렌더·필터·빈 검색·PDF 명령',async()=>{
 const e=await app();assert.match(e.$('report').textContent,/이정후/);assert.ok(e.$('report').querySelectorAll('svg').length>=3);
 assert.match(e.$('report').textContent,/2022년 리그 평균/);assert.match(e.$('report').textContent,/7억 5,000만 원/);
 assert.equal(e.$('span'),undefined);
 e.$('group').value='age';e.$('group').change();assert.match(e.$('report').textContent,/비교 표본 부족/);
 e.$('print').click();assert.equal(e.prints(),1);
 e.$('search').value='없는선수';e.$('search').oninput();assert.match(e.$('report').textContent,/검색 결과 없음/);assert.equal(e.$('print').disabled,true);
});
test('후보 탐색·가중치 오류·후보에서 리포트 이동',async()=>{
 const e=await app();e.$('tab-finder').click();assert.equal(e.$('player-page').hidden,true);assert.ok(e.$('candidates').querySelectorAll('[data-open]').length>0);
 const button=e.$('candidates').querySelectorAll('[data-open]')[0],id=button.dataset.open;button.click();assert.equal(e.$('player-page').hidden,false);assert.equal(e.$('player').value,id);assert.doesNotMatch(e.$('report').textContent,/선수 \(ID\)/);
 e.$('weight-production').value='0';e.$('weight-growth').value='0';e.$('finder').onsubmit({preventDefault(){}});assert.match(e.$('candidates').textContent,/하나 이상 양수/);
});

test('선택 선수·시즌 연동, 계약 출처와 선수 전환',async()=>{
 const e=await app('?id=67341&year=2022&selection=67341%7C2022&selection=75125%7C2021');
 assert.match(e.$('report').textContent,/선택 선수 비교/);assert.match(e.$('report').textContent,/공개 금액 미확인/);
 assert.equal(e.$('selected-group').querySelectorAll('[data-select-import]').length,2);
 assert.equal(e.$('context-park'),undefined);
 const b=e.$('selected-group').querySelectorAll('[data-select-import]')[1];b.click();assert.equal(e.$('year').value,'2021');assert.equal(e.$('player').value,'75125');
});
test('비교 차트는 실제 기록과 5개 백분위·차이를 표시하고 포지션 모드를 적용',async()=>{
 const e=await app('?selection=67341%7C2022&selection=75125%7C2021');
 const panel=()=>panels(e,'report-comparison')[0];
 const A=require('../analytics'),engine=A.create(require('../sample_data.json'));
 const players=['67341|2022','75125|2021'].map(key=>engine.lookup.get(key));
 const expected=A.compareBatters(engine,players);
 const rows=panel().querySelector('tbody').querySelectorAll('tr');
 assert.equal(rows.length,5);
 assert.equal(panel().querySelector('svg').querySelectorAll('circle').length,10);
 assert.match(panel().textContent,/출루율.*OPS.*홈런율.*동일 시즌 전체 타자/s);
 assert.match(panel().textContent,/차이 · 실제 \/ 백분위/);
 for(const [i,row] of rows.entries()){
  const axis=A.comparisonAxes[i],cells=row.querySelectorAll('td');
  assert.match(cells[0].textContent,new RegExp(axis.name));
  for(const [j,result] of expected.entries()){
   const value=result.axes[i];
   const actual=['avg','iso'].includes(axis.key)?value.actual.toFixed(3):(100*value.actual).toFixed(2)+'%';
   assert.equal(cells[j+1].textContent,`${actual} / ${value.score.toFixed(1)}백분위 (${value.n}명)`);
  }
  const [first,second]=expected.map(item=>item.axes[i]);
  const rawDelta=first.actual-second.actual, scoreDelta=first.score-second.score;
  const signed=(value,digits)=>`${value>0?'+':''}${value.toFixed(digits)}`;
  const actualDifference=['avg','iso'].includes(axis.key)?signed(rawDelta,3):signed(100*rawDelta,2)+'%p';
  assert.equal(cells[3].textContent,`${actualDifference} / ${signed(scoreDelta,1)}점`);
 }
 const mode=e.$('comparison-mode');mode.value='position';mode.change();
 assert.equal(e.$('comparison-mode').value,'position');
 assert.match(panel().textContent,/선수별 포지션 비교군이 다르거나/);
 assert.notEqual(panel().querySelector('tbody').textContent,rows.map(row=>row.textContent).join(''));
 assert.equal(panels(e,'report-assessment').length,2);
});
test('4명 비교에서 목록 밖 선수를 검색하면 5명으로 늘리지 않고 단독 리포트 표시',async()=>{
 const e=await app('?selection=67341%7C2022&selection=75125%7C2021&selection=71564%7C2011&selection=62404%7C2024');
 assert.equal(panels(e,'report-assessment').length,4);
 e.$('year').value='2024';e.$('year').change();e.$('player').value='52605';e.$('player').change();
 assert.equal(panels(e,'report-assessment').length,1);assert.equal(panels(e,'report-comparison').length,0);
 assert.match(panels(e,'report-head')[0].textContent,/김도영/);
 e.$('selected-group').querySelectorAll('[data-select-import]')[0].click();assert.equal(panels(e,'report-assessment').length,4);
});
test('기사 없는 선수의 의견 칸은 숨기고 해당 시즌의 기사만 표시',async()=>{
 const none=await app('?id=71564&year=2009');assert.equal(panels(none,'report-notes').length,0);
 const mixed=await app('?selection=71564%7C2009&selection=71564%7C2011');
 const notes=panels(mixed,'report-notes');assert.equal(notes.length,1);assert.match(notes[0].textContent,/김무관/);
 assert.doesNotMatch(mixed.$('report').textContent,/기사.*미확인|공통 · 해석 범위|공통 · 공개 금액 기준/);
});
test('규정타석 충족자 평균은 선수별 선택 시즌에 맞춰 표시',async()=>{
 const e=await app('?selection=67341%7C2022&selection=62404%7C2024');
 const A=require('../analytics').create(require('../sample_data.json'));
 const top=panels(e,'report-comparison')[0].textContent;
 for(const year of [2022,2024]){
  const q=A.league.get(year).qualifyingPA;
  assert.ok(top.includes(`${year}년 규정 ${q.minimum}타석 이상 · 충족 ${q.count}명 평균 ${q.average.toFixed(1)}타석`));
 }
});
test('리포트는 복수 외야 위치를 함께 표시하고 세부 자료 없으면 외야수로 표시',async()=>{
 const multi=await app('?id=61404&year=2024');
 assert.match(panels(multi,'report-head')[0].textContent,/좌익수·중견수·우익수/);
 assert.match(panels(multi,'report-assessment')[0].textContent,/좌익수·중견수·우익수/);
 const broad=await app('?id=67341&year=2022');
 assert.match(panels(broad,'report-head')[0].textContent,/외야수/);
 for(const e of [multi,broad])assert.doesNotMatch(e.$('report').textContent,/외야 세부 미확인|OF\?/);
});

test('시즌 확정 안내는 자료 요약 한 곳에 표시하고 평가 불가 원인을 구분',async()=>{
 const e=await app();
 assert.match(e.$('season-note').textContent,/2022년 자료.*최종 확정 여부가 표기되지 않음/);
 assert.doesNotMatch(e.$('report').textContent,/시즌 상태|시즌 확정 상태/);
 e.$('minpa').value='1000';e.$('minpa').change();assert.match(e.$('report').textContent,/비교 표본 부족/);
 e.$('minpa').value='200';e.$('group').value='age';e.$('group').change();assert.match(e.$('report').textContent,/비교 표본 부족/);
 assert.doesNotMatch(e.$('report').textContent,/규정타석 미달/);
});

test('2026 SSG 김성욱은 142타석도 다섯 점수와 참고 점선 표시',async()=>{
 const e=await app('?id=62934&year=2026');
 const detail=panels(e,'report-assessment')[0],radar=detail.querySelector('svg');
 assert.match(detail.textContent,/소타석 참고 · 142타석/);
 assert.equal(radar.querySelectorAll('circle').length,5);
 assert.equal(radar.querySelectorAll('polygon').filter(p=>p.attrs['stroke-dasharray']==='6 4').length,1);
 const values=detail.querySelector('tbody').querySelectorAll('tr').map(r=>r.querySelectorAll('td')[1].textContent);
 assert.equal(values.length,5);assert.ok(values.every(v=>/\d+\.\d백분위/.test(v)));
 const comparison=await app('?selection=62404%7C2024&selection=62934%7C2026');
 const top=panels(comparison,'report-comparison')[0];
 const below=panels(comparison,'report-assessment')[1].querySelector('tbody').querySelectorAll('tr').map(r=>r.querySelectorAll('td')[1].textContent);
 assert.deepEqual(below,values);
 assert.equal(top.querySelector('tbody').querySelectorAll('tr').length,5);
 const sharedValues=top.querySelector('tbody').querySelectorAll('tr').map(r=>r.querySelectorAll('td')[2].textContent);
 assert.deepEqual(sharedValues,values);
 assert.match(top.textContent,/소타석 참고 · 142타석/);
 assert.equal(top.querySelector('svg').querySelectorAll('polygon').filter(p=>p.attrs['stroke-dasharray']==='6 4').length,1);
});

test('이름 검색 결과에서 선수 선택, 최소 타석 안내에 현재 평균 표시',async()=>{
 const e=await app('?year=2022');
 e.$('search').value='이정';
 e.$('search').oninput();
 const result=e.$('lab-search-results').querySelector('[data-search-player="67341"]');
 assert.ok(result);
 assert.match(result.textContent,/이정후 · 키움 · 2022/);
 result.click();
 assert.equal(e.$('lab-search-results').hidden,true);
 assert.match(e.$('report').textContent,/이정후/);
 assert.match(panels(e,'report-assessment')[0].querySelector('svg').attrs['aria-label'],/5각형/);
 assert.match(e.$('minpa-guide').textContent,/현재 비교군.*평균.*기본값 446타석/);
});

test('선택 시즌에 없으면 보유 시즌을 제안하고 선수·시즌을 함께 전환',async()=>{
 const e=await app('?year=2026');
 e.$('search').value='이정후';
 e.$('search').oninput();
 const results=e.$('lab-search-results');
 assert.match(results.textContent,/보유 데이터의 2026년 타격 기록에 일치하는 선수가 없습니다/);
 const seasons=results.querySelectorAll('[data-search-player="67341"]');
 assert.ok(seasons.length>1);
 assert.equal(seasons[0].dataset.searchYear,'2023');
 const result=seasons.find(button=>button.dataset.searchYear==='2022');
 assert.match(result.textContent,/이정후 · 키움 · 2022/);
 result.click();
 assert.equal(e.$('year').value,'2022');
 assert.equal(e.$('player').value,'67341');
 assert.equal(results.hidden,true);
 assert.match(e.$('lab-search-note').textContent,/이정후의 2026년 타격 기록이 없어 2022년 기록/);
 assert.match(e.$('report').textContent,/이정후/);
});

test('빈 검색은 숨기고 성씨 초성·첫 글자에 맞는 후보를 최대 네 명 표시',async()=>{
 const e=await app('?year=2022');
 const search=e.$('search'), results=e.$('lab-search-results');
 search.onfocus();
 assert.equal(results.hidden,true);
 for(const [query,pattern] of [['ㅇ',/^[아-잏]/],['이',/^이/]]){
  search.value=query;
  search.oninput();
  const buttons=results.querySelectorAll('[data-search-player]');
  assert.equal(buttons.length,4);
  for(const button of buttons)assert.match(button.textContent,pattern);
 }
});

test('전체 시즌과 10년 단위로 검색한 뒤 실제 선수 시즌을 열 수 있음',async()=>{
 const e=await app('?year=2022');
 const year=e.$('year'), search=e.$('search'), results=e.$('lab-search-results');
 assert.ok(year.options.some(o=>o.value==='decade-1980'));
 assert.ok(year.options.some(o=>o.value==='all'));
 year.value='decade-2010';
 year.change();
 assert.match(e.$('report').textContent,/선수와 시즌을 선택/);
 search.value='이정후';
 search.oninput();
 const decadeResults=results.querySelectorAll('[data-search-player="67341"]');
 assert.ok(decadeResults.length>0);
 assert.ok(decadeResults.every(button=>/^201/.test(button.dataset.searchYear)));
 year.value='all';
 year.change();
 search.value='이정후';
 search.oninput();
 const result=results.querySelector('[data-search-year="2022"]');
 assert.ok(result);
 result.click();
 assert.equal(year.value,'2022');
 assert.equal(e.$('player').value,'67341');
});

test('등급표에서 검색을 열어 시즌과 등급을 고르고 같은 선수 등급을 확인',async()=>{
 const e=await app('?id=67341&year=2022');
 e.$('browse-grades').click();
 assert.equal(e.$('finder-page').hidden,false);
 assert.equal(e.$('grade-year').value,'2022');
 assert.match(e.$('grade-results').textContent,/전체 등급.*446타석/s);
 const all=e.$('grade-results').querySelector('tbody').querySelectorAll('tr');
 assert.ok(all.length>1);
 const first=all[0].querySelectorAll('td').map(cell=>cell.textContent);
 const grade=first[4];
 e.$('grade-filter').value=grade;
 e.$('grade-filter').change();
 const filtered=e.$('grade-results').querySelector('tbody').querySelectorAll('tr');
 assert.ok(filtered.every(row=>row.querySelectorAll('td')[4].textContent===grade));
 const player=filtered[0].querySelector('[data-open-grade]');
 player.click();
 assert.equal(e.$('finder-page').hidden,true);
 assert.equal(e.$('player').value,player.dataset.openGrade);
 assert.match(panels(e,'context-card')[0].textContent,new RegExp('5각형'+grade+first[5]+' / 100'));
});

test('공개 부상 이력은 선수별로 표시하고 선택 시즌 이후 보도를 구분',async()=>{
 const e=await app('?selection=67341%7C2022&selection=62404%7C2024');
 const notes=panels(e,'report-injuries')[0];
 assert.ok(notes);
 assert.match(notes.textContent,/2023년 · 이후 시즌/);
 assert.match(notes.textContent,/왼쪽 발목 신전지대/);
 assert.match(notes.textContent,/2024년 · 이후 시즌/);
 assert.doesNotMatch(notes.textContent,/햄스트링/);
 assert.match(notes.textContent,/2020년 부상 선수 보호를 위해/);
 assert.equal(notes.querySelectorAll('a').length,5);
 assert.ok(notes.querySelectorAll('a').some(link=>link.attrs.href.endsWith('playerId=67341')));
});
