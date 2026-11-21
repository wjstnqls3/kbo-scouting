const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../core.js');
const row=(Id,Season,extra={})=>({Id,Player:Id,Season,Team:'KT',Position:'1B',G:100,PA:500,AB:400,H:120,HR:20,TB:180,BB:80,HBP:5,SF:5,...extra});
test('투수 시즌은 이름 검색·시즌 선택·추천 엔진에서 제외',()=>{
 const e=C.createEngine([row('pitcher',2022,{Position:'P'}),row('both',2021,{Position:'P'}),row('both',2022),row('target',2023)]);
 assert.equal(e.players.some(p=>p.id==='pitcher'),false);
 assert.deepEqual(e.validYears('both'),[2022]);assert.equal(e.aggregate('pitcher',2022),null);
 const rec=e.recommend([{id:'target',end:2023,stats:e.aggregate('target',2023)}],{'홈런':1});
 assert.equal(rec.length,1);assert.equal(rec[0].id,'both');assert.equal(rec[0].end,2022);
});

test('선택 시즌만 집계하며 공백 시즌과 중복 선수·시즌은 합산하지 않음',()=>{
  const record=row('a',2019,{AB:100,H:50,TB:70,BB:0,HBP:0,SF:0});
  const engine=C.createEngine([record,row('a',2018,{G:0}),row('a',2017),row('a',2016)]);
  assert.deepEqual(engine.seasonYears('a',2019),[2019]);
  const stats=engine.aggregate('a',2019);
  assert.equal(stats['경기'],100);assert.equal(stats['타율'],.5);
  assert.equal(stats['출루율'],.5);assert.equal(stats['장타율'],.7);
  assert.ok(engine.aggregate('a',2017));assert.equal(engine.aggregate('a',2018),null);
  assert.equal(C.createEngine([record,{...record,Team:'LG'}]).aggregate('a',2019),null);
  assert.equal(C.stats([{...record,BB:' '}]),null);
});

test('단일 대상 12명, 복수는 각 5명, 대상 제외 및 과거 기록만 추천',()=>{
  const records=[];
  for(let id=0;id<22;id++)for(let y=2016;y<=2022;y++)records.push(row(String(id),y,{HR:id}));
  const engine=C.createEngine(records),weights=Object.fromEntries(C.metrics.map(k=>[k,1]));
  const target=id=>({id,name:id,end:2022,stats:engine.aggregate(id,2022)});
  const single=engine.recommend([target('0')],weights);assert.equal(single.length,12);assert.ok(single.every(r=>r.end<2022&&r.id!=='0'));
  const multiple=engine.recommend([target('0'),target('1')],weights);
  for(const id of ['0','1'])assert.equal(multiple.filter(r=>r.sourceId===id).length,5);
  assert.ok(multiple.every(r=>!['0','1'].includes(r.id)));
  assert.deepEqual(engine.recommend([target('0')],weights,()=>false),[]);
});

test('지표 비중 변경이 순위에 반영되고 0 비중은 제외',()=>{
  const records=[];
  for(const [id,hr,h] of [['source',10,100],['power',10,180],['contact',1,100]])for(const y of [2018,2019,2020,2021])records.push(row(id,y,{HR:hr,H:h}));
  const engine=C.createEngine(records),source={id:'source',name:'source',end:2021,stats:engine.aggregate('source',2021)};
  assert.equal(engine.recommend([source],{'홈런':1,'안타':0})[0].id,'power');
  assert.equal(engine.recommend([source],{'홈런':0,'안타':1})[0].id,'contact');
  assert.throws(()=>engine.recommend([source],{'홈런':0}),/하나 이상/);
});

test('규정 타석: 144경기 446, 445 미달. 경기 수 최고는 제외',()=>{
  assert.equal(C.requiredPA(2022),446);assert.equal(C.requiredPA(1982),248);
  const rows=[row('under',2022,{PA:445,H:399,G:144}),row('at',2022,{PA:446,H:150,G:130}),row('above',2022,{PA:500,H:100,G:144})];
  const index=C.leaderIndex(rows.map(row=>({row,stats:C.stats([row])})));
  assert.equal(index.flags(rows[0],C.stats([rows[0]]),'타율').league,false);
  assert.equal(index.flags(rows[1],C.stats([rows[1]]),'타율').league,true);
  assert.deepEqual(index.flags(rows[0],C.stats([rows[0]]),'경기'),{league:false,team:false});
});

test('선택 기간 최고와 연도별 최고가 분리됨',()=>{
  const rows=[row('old',2021,{HR:35}),row('new',2022,{HR:25})],items=rows.map(row=>({row,stats:C.stats([row])}));
  assert.equal(C.leaderIndex(items,'period').flags(rows[1],items[1].stats,'홈런').league,false);
  assert.equal(C.leaderIndex(items,'year').flags(rows[1],items[1].stats,'홈런').league,true);
});

test('SK·SSG 등 전신/후신 구단 합산 최고와 리그 최고·동률',()=>{
  const rows=[row('old',2020,{Team:'SK',HR:35}),row('new',2022,{Team:'SSG',HR:30}),row('other',2022,{Team:'KT',HR:35})];
  const items=rows.map(row=>({row,stats:C.stats([row])})),index=C.leaderIndex(items);
  assert.equal(C.teamId('SK'),C.teamId('SSG'));assert.notEqual(C.teamId('현대'),C.teamId('키움'));
  assert.equal(index.flags(rows[1],items[1].stats,'홈런').team,false);
  assert.deepEqual(index.flags(rows[0],items[0].stats,'홈런'),{team:true,league:true});
  assert.equal(index.flags(rows[2],items[2].stats,'홈런').league,true);
});

test('실제 2022 자료: 박병호 KT 35홈런, 키움 이정후 23홈런',()=>{
  const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'../sample_data.json'),'utf8')).filter(r=>+r.Season===2022);
  const park=rows.find(r=>r.Player==='박병호'),lee=rows.find(r=>r.Player==='이정후');
  assert.equal(park.Team,'KT');assert.equal(+park.HR,35);
  const index=C.leaderIndex(rows.map(row=>({row,stats:C.stats([row])})), 'year');
  assert.deepEqual(index.flags(park,C.stats([park]),'홈런'),{league:true,team:true});
  assert.equal(+lee.HR,23);assert.equal(index.flags(lee,C.stats([lee]),'홈런').team,true);
});

test('JSON과 파일 직접 열기 자료가 동일하고 선수·시즌 선택 키 안정적',()=>{
  const root=path.join(__dirname,'..'),json=JSON.parse(fs.readFileSync(path.join(root,'sample_data.json'),'utf8'));
  const js=fs.readFileSync(path.join(root,'data.js'),'utf8');
  const fallback=vm.runInNewContext(js+';JSON.stringify(battingData)');
  assert.deepEqual(JSON.parse(fallback),json);
  assert.equal(C.selectionKey('001',2022),C.selectionKey('001','2022'));
  const metadata=JSON.parse(fs.readFileSync(path.join(root,'data_metadata.json'),'utf8'));
  assert.equal(metadata.row_count,json.length);assert.equal(metadata.collected_at,null);
});

test('상세 지표 최고 기록과 규정 타석 미달 제외',()=>{
  const rows=[row('eligible',2022,{PA:500,BB:100,SO:50}),row('under',2022,{PA:200,BB:150,SO:10})];
  const items=rows.map(row=>({row,stats:C.stats([row])})),index=C.leaderIndex(items);
  assert.equal(index.flags(rows[0],items[0].stats,'BB%').league,true);
  assert.equal(index.flags(rows[1],items[1].stats,'BB%').league,false);
  assert.equal(index.flags(rows[1],items[1].stats,'볼넷').league,true);
  assert.equal(index.flags(rows[0],items[0].stats,'BB/K').team,true);
});

test('상세 주루·장타 기록 합산과 도루 시도 없는 경우',()=>{
  const a=row('x',2021,{'2B':10,'3B':2,RBI:40,R:50,SB:8,CS:2});
  const b=row('x',2022,{'2B':15,'3B':1,RBI:50,R:60,SB:2,CS:3});
  const result=C.stats([a,b]);assert.equal(result['2루타'],25);assert.equal(result['3루타'],3);
  assert.equal(result['타점'],90);assert.equal(result['득점'],110);assert.equal(result['도루성공%'],100*10/15);
  assert.equal(C.stats([row('y',2022,{SB:0,CS:0})])['도루성공%'],null);
});

test('추가한 모든 기록이 리그·구단 최고와 기간/연도별 집계에 포함',()=>{
  const metrics=['2루타','3루타','타점','득점','도루','도루실패','도루성공%'];
  assert.equal(new Set(C.detailMetrics).size,C.detailMetrics.length);
  const data=[row('best',2021,{'2B':40,'3B':8,RBI:100,R:100,SB:30,CS:5}),row('second',2021,{'2B':20,'3B':3,RBI:50,R:50,SB:10,CS:2})];
  const items=data.map(row=>({row,stats:C.stats([row])}));
  for(const scope of ['period','year']){
    const index=C.leaderIndex(items,scope);
    for(const k of metrics)assert.deepEqual(index.flags(data[0],items[0].stats,k),{league:true,team:true},`${scope} ${k}`);
  }
});

test('도루 성공률 100% 동률은 타석 수와 관계없이 모두 최고 기록으로 표시',()=>{
  const rows=[
    row('qualified',2022,{PA:500,SB:10,CS:0}),
    row('under',2022,{PA:20,SB:1,CS:0}),
    row('failed',2022,{PA:500,SB:9,CS:1}),
    row('no-attempt',2022,{PA:500,SB:0,CS:0})
  ];
  const items=rows.map(row=>({row,stats:C.stats([row])}));
  for(const scope of ['period','year']){
    const index=C.leaderIndex(items,scope);
    for(const [i,{row,stats}] of items.entries()){
      const expected=i<2;
      assert.deepEqual(index.flags(row,stats,'도루성공%'),{league:expected,team:expected});
    }
  }
});
