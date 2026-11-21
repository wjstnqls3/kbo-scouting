const test=require('node:test'),assert=require('node:assert/strict'),A=require('../analytics.js');
const row=(id,year,extra={})=>({Id:id,Player:'동명이인',Age:25,Born:`${year-25}-01-01`,Position:'1B',Team:'KT',Season:year,G:100,PA:500,AB:400,H:120,HR:20,TB:200,BB:80,HBP:10,SF:10,SO:90,...extra});
test('맞춤 타격 적합도는 선택 비중으로 계산하며 결측·0점·소타석을 구분',()=>{
 const scores=Object.fromEntries(A.dimensions.map((d,i)=>[d.key,{value:i*20,provisional:false}]));
 assert.equal(A.fitScore(scores,A.fitPresets.balanced).value,50);
 assert.equal(A.fitScore(scores,A.fitPresets.onbase).value,(0*3+20+60*2)/6);
 assert.equal(A.fitScore(scores,A.fitPresets.power).value,(40*3+80+100*2)/6);
 scores.onbase={value:null,provisional:false};
 assert.equal(A.fitScore(scores,A.fitPresets.onbase).value,null);
 assert.ok(Number.isFinite(A.fitScore(scores,A.fitPresets.power).value));
 scores.homerun.provisional=true;assert.equal(A.fitScore(scores,A.fitPresets.power).provisional,true);
 const zero=Object.fromEntries(A.dimensions.map(d=>[d.key,0]));
 for(const weights of [zero,{...zero,power:-1},{...zero,power:11},{...zero,power:NaN}])assert.equal(A.fitScore(scores,weights).value,null);
 const zeroScores=Object.fromEntries(A.dimensions.map(d=>[d.key,{value:0}]));
 assert.equal(A.fitScore(zeroScores,A.fitPresets.balanced).value,0);
});
test('평균 타석은 같은 시즌 규정타석 충족 타자만 선수당 한 번 집계',()=>{
 const e=A.create([row('a',2024,{PA:446}),row('b',2024,{PA:600}),row('c',2024,{PA:445}),row('p',2024,{Position:'P',PA:700}),row('a',2023,{PA:500}),row('old',1982,{PA:248,AB:200}),row('low',1983,{PA:100,AB:80,H:20,HR:2,TB:30,BB:10,HBP:0,SF:0,SO:10})]);
 assert.deepEqual(e.league.get(2024).qualifyingPA,{minimum:446,count:2,average:523});
 assert.deepEqual(e.league.get(1982).qualifyingPA,{minimum:248,count:1,average:248});
 assert.deepEqual(e.league.get(1983).qualifyingPA,{minimum:310,count:0,average:null});
});
test('합산 분모와 0타수 볼넷 전용 행도 리그 출루율에 포함',()=>{
 const e=A.create([row('a',2020),row('b',2020,{PA:10,AB:0,H:0,HR:0,TB:0,BB:10,HBP:0,SF:0,SO:0})]);
 assert.equal(e.league.get(2020).obp,220/510);assert.equal(e.league.get(2020).slg,.5);assert.equal(e.rows[1].relative.production,null);
});
test('나이 불일치/결측을 생성하지 않고 동명이인과 시즌별 구단 분리',()=>{
 const e=A.create([row('a',2020),row('a',2021,{Born:'1995-01-01',Age:26,Team:'LG'}),row('b',2020,{Age:''}),row('c',2020,{Born:'1980-01-01'})]);
 assert.equal(e.byPlayer.size,3);assert.equal(e.lookup.get('a|2021').team,'LG');assert.equal(e.lookup.get('b|2020').age,null);assert.equal(e.lookup.get('c|2020').age,null);
 assert.equal(e.cohort(e.lookup.get('a|2020'),{group:'age'}).length,0);
});
test('중복 분할행과 합계행 혼입을 추측 합산하지 않고 제외',()=>{
 const e=A.create([row('a',2020),row('a',2020,{Team:'LG'}),row('b',2020,{H:'NaN'}),row('c',2020)]);
 assert.equal(e.audit.duplicateRows,2);assert.equal(e.audit.invalid,1);assert.equal(e.rows.length,1);
});
test('백분위 동점/최소 표본/음수 지표 방향',()=>{
 assert.equal(A.pct(5,[5,5,5,5,5]),50);assert.equal(A.pct(5,[1,2,3,4]),null);assert.equal(A.pct(-.5,[-1,-2,-3,-4,-5]),100);
});
test('연도별 리그 환경 정규화와 공백 연도 성장률 보류',()=>{
 const e=A.create([row('a',2020),row('a',2022),row('b',2020,{H:80,TB:100}),row('b',2022,{H:180,TB:300})]);
 const a=e.lookup.get('a|2020'),b=e.lookup.get('a|2022');assert.ok(a.index>b.index);assert.equal(e.growth(b),null);assert.equal('stability' in e.features(b),false);assert.equal(A.dimensions.length,6);
});
test('유사 선수는 미래와 대상 ID 제외, 선수당 하나, 표본 및 분산 보호',()=>{
 const data=[];for(let i=0;i<8;i++)for(let y=2018;y<=2023;y++)data.push(row(String(i),y,{H:100+i*5,TB:150+i*8,SO:50+i*7,Born:'1993-01-01',Age:y-1993}));
 const e=A.create(data),r=e.lookup.get('0|2022'),s=e.similar(r);assert.equal(s.length,5);assert.ok(s.every(x=>x.row.id!=='0'&&x.row.year<2022));assert.equal(new Set(s.map(x=>x.row.id)).size,5);assert.ok(s.every(x=>x.score<=100&&x.score>0));assert.deepEqual(e.similar(r,1000),[]);
});
test('발굴 가중치 검증과 결측 성장 지표 비중 0 처리',()=>{
 const e=A.create(Array.from({length:8},(_,i)=>row(String(i),2022,{H:100+i*5,TB:150+i*8})));const o={year:2022,minPA:200,minAge:null,maxAge:null,minIndex:0,minGrowth:null,weights:{production:1,growth:0}};
 assert.equal(e.discover(o).length,8);assert.deepEqual(e.discover({...o,weights:{production:1,growth:1}}),[]);assert.throws(()=>e.discover({...o,weights:{production:0,growth:0}}));
 const target=e.discover(o)[0];const filtered=e.discover({...o,minIndex:target.row.index});assert.equal(filtered[0].score,target.score);
});
test('소타석 대상도 비교군 5명 이상이면 6축 참고 점수를 계산',()=>{
 const e=A.create(Array.from({length:7},(_,i)=>row(String(i),2020,{PA:i?500:100,AB:80,H:20,HR:2,TB:30,BB:10,HBP:0,SF:0,SO:10})));const r=e.rows[0],s=e.scores(r,e.cohort(r),200);
 for(const d of A.dimensions){assert.equal(s[d.key].n,6);assert.ok(Number.isFinite(s[d.key].value));assert.equal(s[d.key].provisional,true);assert.equal(s[d.key].reason,null);}
 const short=e.scores(r,e.cohort(r).slice(0,4));assert.equal(short.production.value,null);assert.equal(short.production.reason,'reference');
 const missing=e.scores({...r,relative:{...r.relative,production:null}},e.cohort(r));assert.equal(missing.production.value,null);assert.equal(missing.production.reason,'record');assert.ok(Number.isFinite(missing.eye.value));
});

test('wOBA·wRC에 필요한 결측 기록을 0으로 대체하지 않음',()=>{
 const valid=row('a',2020,{'2B':20,'3B':0,R:60});
 const expected=(.758*80+.773*10+.928*80+1.301*20+1.998*20)/500;
 assert.equal(A.woba([valid]),expected);
 for(const key of ['2B','3B','BB'])assert.equal(A.woba([{...valid,[key]:null}]),null);
 assert.equal(A.woba([{...valid,'2B':120}]),null);
 const e=A.create([valid]);assert.equal(e.rows[0].stats.wrc,60);
 const missing=A.create([valid,{...valid,Id:'b',R:''}]);
 assert.equal(missing.league.get(2020).rpa,null);assert.equal(missing.rows[0].stats.wrc,null);
 assert.equal(A.rates([{...valid,SO:null}]).k,null);
 assert.equal(A.rates([{...valid,PA:0}]).bb,null);
});

test('랩의 리그 평균은 규정 타석 충족 기록만 합산하고 참고 등급은 6개 축을 평균',()=>{
 const A=require('../analytics'), C=require('../core');
 const records=require('../sample_data.json');
 const engine=A.create(records,{qualifiedBaseline:true});
 const year=2026, minimum=C.requiredPA(year);
 const eligible=engine.byYear.get(year).filter(r=>r.stats.pa>=minimum);
 const baseline=engine.league.get(year);
 assert.equal(minimum,446);
 assert.ok(eligible.length<engine.byYear.get(year).length);
 assert.equal(baseline.ops,A.rates(eligible.map(r=>r.raw)).ops);
 assert.notEqual(baseline.ops,A.create(records).league.get(year).ops);
 const scores=Object.fromEntries(A.dimensions.map((d,i)=>[d.key,{value:[95,85,75,65,55,45][i]}]));
 assert.deepEqual(A.radarGrade(scores,446,446),{value:70,grade:'B'});
 assert.deepEqual(A.radarGrade(scores,445,446),{value:null,grade:null});
 delete scores.eye;
 assert.deepEqual(A.radarGrade(scores,600,446),{value:null,grade:null});
});

test('5개 비교 축의 원자료 산식, 시즌·최소타석 선별, K% 방향과 미산출 사유',()=>{
 const A=require('../analytics');
 const make=(id,overrides={},year=2024,position='1B')=>({
  id,year,position,stats:{pa:Number(overrides.PA??200)},
  raw:{PA:200,AB:160,H:40,TB:64,BB:30,SO:20,SB:0,...overrides}
 });
 const target=make('target');
 const peers=[30,31,32,33,34].map((so,i)=>make(String(i),{SO:so,SB:i+1},2024,i===0?'1B':'2B'));
 const engine={byYear:new Map([[2024,[target,...peers,make('short',{PA:199})]],[2023,[make('old',{},2023)]]])};
 const [result]=A.compareBatters(engine,[target]);
 assert.equal(result.poolSize,6);
 assert.deepEqual(result.axes.map(axis=>axis.actual),[.25,.15,.1,.15,0]);
 assert.equal(result.axes[2].score,100*5.5/6);
 assert.equal(result.axes[4].score,100*.5/6);
 assert.equal(A.compareBatters(engine,[target],true)[0].axes[0].reason,'sample');
 assert.equal(A.compareBatters(engine,[make('unknown',{},2024,'OF')],true)[0].axes[0].reason,'position');
 const incomplete=make('incomplete',{AB:0,H:0,TB:0,SB:''});
 const axes=A.compareBatters(engine,[incomplete])[0].axes;
 assert.equal(axes[0].reason,'invalid');
 assert.equal(axes[4].reason,'missing');
});
