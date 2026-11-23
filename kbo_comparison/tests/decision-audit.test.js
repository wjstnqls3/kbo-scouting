const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const A = require('../analytics'), B = require('../portfolio-model'), P = require('../pitching');
const audit = require('../decision-audit');
const batting = require('../sample_data.json');
const pitching = vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pitching-data.js'),'utf8')+';pitchingData');

test('소수점 연산 오차 범위의 공동 순위는 타석·투구 이닝 순으로 표시한다', () => {
  const cases = [
    {model:B, pool:B.poolFor(A.create(batting),2022,'',200), weights:B.presets.onbase,
      rank:36, ids:['67304','52009']},
    {model:P, pool:P.poolFor(P.create(pitching),1992,30), weights:P.presets.balanced,
      rank:68, ids:['91151','88711']}
  ];
  for (const {model,pool,weights,rank,ids} of cases) {
    const pair = model.evaluate(pool,weights).filter(entry=>ids.includes(entry.row.id));
    assert.deepEqual(pair.map(entry=>entry.rank),[rank,rank]);
    assert.ok(Math.abs(pair[0].value-pair[1].value)<1e-10);
    assert.deepEqual(pair.map(entry=>entry.row.id),ids);
  }
});

test('시나리오 정규화, 소수점, 0 유지 및 중복 기준선 제외', () => {
  const weights = Object.freeze({avg:10,bb:3,k:1,iso:0,sb:0});
  const all = audit.scenarios(weights,A.comparisonAxes);
  assert.equal(all.length,9);
  for (const s of all) {
    assert.ok(Math.abs(Object.values(s.weights).reduce((a,b)=>a+b)-1)<1e-12);
    assert.equal(s.weights.iso,0);
    assert.equal(s.weights.sb,0);
  }
  assert.equal(all[1].weights.avg,12/16);
  assert.equal(all[2].weights.avg,0);
  for (const avg of [0,1]) assert.deepEqual(audit.scenarios({...weights,avg,bb:0,k:0},A.comparisonAxes),[]);
});

for (const isPitching of [false,true]) {
  test((isPitching?'투수':'타자')+' CSV 기준선·개별 시나리오 순위·분모·대안 및 3시즌 ID 연결', () => {
    const records = isPitching ? pitching : batting;
    const model = isPitching ? P : B, engine = (isPitching ? P : A).create(records);
    const scope = {year:2024,minimum:isPitching?30:200,weights:model.presets.balanced};
    const pool = isPitching ? P.poolFor(engine,2024,30) : B.poolFor(engine,2024,'',200);
    const before = model.evaluate(pool,scope.weights);
    const focus = before[0].row;
    const report = audit.review({engine,records,pool,scope,selected:[focus],pitching:isPitching});
    assert.equal(report.scenarios,isPitching?12:15);
    assert.equal(report.profiles.length,2);
    assert.deepEqual(report.profiles[0].roles,['직접 선택','모델 1위']);
    const entry = report.profiles[0].entry;
    assert.equal(entry.value,before[0].value);
    assert.deepEqual([focus.id,pool.length,entry.best,entry.worst,entry.topCount,report.profiles[1].row.id],
      isPitching ? ['52257',154,1,4,11,'54930'] : ['52605',110,1,9,13,'65357']);
    const ranks = audit.scenarios(scope.weights,isPitching ? P.axes : A.comparisonAxes).map(s=>model.evaluate(pool,s.weights).find(e=>e.row.id===focus.id).rank);
    assert.deepEqual(entry.changes.map(s=>s.rank),ranks);
    assert.deepEqual(report.scenarioRanks.map(s=>s.ranks[0]),ranks);
    assert.equal(entry.topCount,ranks.filter(r=>r<=3).length);
    assert.equal(entry.topTotal,ranks.length);
    assert.equal(entry.worst,Math.max(...ranks));
    for (const {row,history} of report.profiles) {
      assert.deepEqual(history.seasons.map(s=>s.year),[2022,2023,2024]);
      for (const s of history.seasons) {
        const actual = engine.lookup.get(row.id+'|'+s.year);
        if (actual) assert.equal(s.values[isPitching?'era':'ops'],actual.stats[isPitching?'era':'ops']);
      }
    }
    assert.deepEqual(model.evaluate(pool,scope.weights).map(e=>e.value),before.map(e=>e.value));
  });
}

test('2026년 출루형 · 직접 선택 2명과 최악 순위 기준 대안 김지찬', () => {
  const engine=A.create(batting), pool=B.poolFor(engine,2026,'',200);
  const scope={year:2026,minimum:200,position:'',weights:B.presets.onbase};
  const selected=['67893','62404'].map(id=>engine.lookup.get(id+'|2026'));
  const {profiles}=audit.review({engine,records:batting,pool,scope,selected,pitching:false});
  assert.deepEqual(profiles.filter(p=>p.roles.includes('직접 선택')).map(p=>p.row.name),['박성한','구자욱']);
  const alt=profiles.find(p=>p.roles.includes('모델 추천 대안'));
  assert.deepEqual([alt.row.id,alt.entry.rank,alt.entry.best,alt.entry.worst,alt.entry.topCount,alt.entry.topTotal],['50458',5,4,10,0,9]);
  assert.equal(profiles.length,3);
  const history=profiles[0].history;
  assert.deepEqual(history.seasons.map(s=>s.values.pa),[564,538,627]);
  for (const s of history.seasons) {
    const peers=B.poolFor(engine,s.year,'',200);
    assert.equal(s.poolSize,peers.length);
    assert.equal(s.values.g,Number(engine.lookup.get('67893|'+s.year).raw.G));
    assert.equal(s.relative.k.pct,A.pct(-s.values.k,peers.map(r=>B.metric(r,'k')).filter(Number.isFinite).map(v=>-v)));
  }
});

test('동명이인·누락·소표본·0·결측 및 생년 충돌', () => {
  const base = {Id:'11',Player:'동명',Season:'2024',Born:'1991-01-01',IP:'30 1/3',TBF:'100',H:'40',SO:'10',HR:'0',BB:'',ERA:'2.10',G:'10'};
  const records = [base,{...base,Season:'2023',IP:'1/3',Player:'개명 전'},
    {...base,Id:'22',Season:'2022',IP:'100'}];
  const run = records => {
    const engine = P.create(records), row=engine.lookup.get('11|2024');
    return audit.review({engine,records,pool:[row],scope:{year:2024,weights:P.presets.balanced,minimum:30},selected:[row],pitching:true});
  };
  const result = run(records);
  const p = result.profiles[0];
  assert.equal(p.entry,undefined);
  assert.equal(result.scenarios,0);
  assert.equal(p.sample,'최소 기준 근접');
  assert.equal(p.volumePct,null);
  assert.equal(p.conflicts.length,0);
  assert.deepEqual(p.history.seasons.map(s=>s.status),['기록 없음','표본 부족','기준 충족']);
  assert.equal(p.history.ranges.hr,null);
  assert.equal(p.history.seasons[2].values.hr,0);
  assert.equal(p.history.seasons[2].values.bb,null);
  assert.equal(run([...records,{...base,Season:'2021',Born:'1970-03-05'}]).profiles[0].history.seasons[2].status,'출생 정보 충돌');
});

test('동률과 상위 3위 분모 제한, 전부 0일 때 순위 보류', () => {
  const pool = Array.from({length:6},(_,i)=>({id:String(i),name:'공동',stats:{outs:100,k:i<3?0.2:null,bb:i>=2?0.1:null,hr:0,whip:1}}));
  pool[3].stats.k=pool[4].stats.k=0.2;
  pool[1].stats.bb=0.1;
  pool[4].stats.bb=null;
  pool[0].stats.bb=0.1;
  // Five valid values on each axis, four complete rows.
  const weights = {k:1,bb:1,hr:0,whip:0};
  const results = audit.sensitivity(pool,weights,true);
  assert.ok(results.candidates.every(e=>e.rank===1));
  assert.equal(results.candidates[0].total,6);
  assert.equal(audit.sensitivity(pool.slice(0,3),weights,true).variants.length,0);
  assert.equal(audit.sensitivity(pool,{...weights,k:0,bb:0},true).candidates.length,0);
});

test('비교 지표가 엇갈리는 실제 조건에서만 사분위 신호를 생성한다', () => {
  const records = Array.from({length:8},(_,i)=>({
    Id:String(i),Season:'2024',Player:'선수 '+i,G:'20',IP:String(30+i),
    TBF:'200',SO:String(100-i),HR:String(8-i),H:'40',BB:String(30-i),ERA:String(2+i)
  }));
  const engine = P.create(records),pool = P.poolFor(engine,2024,30);
  const report = audit.review({engine,records,pool,scope:{year:2024,minimum:30,weights:P.presets.balanced},selected:[pool[0]],pitching:true});
  assert.deepEqual(report.profiles[0].conflicts.map(c=>[c.high,c.low]),[['era','bb'],['k','hr']]);
  assert.equal(report.profiles[0].sample,'최소 기준 근접');
});

test('순위 산출 후보 3명인 시나리오를 상위 3위 비율의 분모에서 제외', () => {
  const pool = Array.from({length:7},(_,i)=>({id:String(i),name:'선수 '+i,
    stats:{outs:90,k:i<5?0.2:null,bb:i>=2?0.05:null}}));
  const {candidates} = audit.sensitivity(pool,{k:1,bb:1,hr:0,whip:0},true);
  assert.equal(candidates.length,3);
  assert.ok(candidates.every(e=>e.total===6 && e.topTotal===2 && e.topCount===2));
});

test('심층 타격 기록은 0·결측·시도 없음을 구분하고 추천 비중에 영향을 주지 않는다', () => {
  const source = batting.find(r=>r.Id==='52605' && r.Season==='2024');
  const deep = overrides => {
    const [row] = A.create([{...source,...overrides}]).rows;
    return audit.deepStats(row,false);
  };
  const actual = deep({});
  assert.equal(actual.hrpa,38/625);
  assert.equal(actual.xbh,77);
  assert.equal(actual.xbhShare,77/189);
  assert.equal(actual.bbk,66/110);
  assert.ok(Math.abs(actual.stealRate-40/44)<1e-12);
  assert.equal(actual.age,21);
  assert.equal(actual.g,141);
  assert.equal(deep({CS:'',SO:'0','3B':''}).stealRate,null);
  assert.equal(deep({SO:'0'}).bbk,null);
  assert.equal(deep({'3B':''}).xbh,null);
  assert.equal(deep({SB:'0',CS:'0'}).stealRate,null);
  assert.equal(deep({SB:'0',CS:'1'}).stealRate,0);
  assert.equal(deep({H:'0',HR:'0',TB:'0','2B':'0','3B':'0'}).xbhShare,null);
  // CS changes only the supplemental running measure. Score scenarios still use the original axes.
  const season = batting.filter(r=>r.Season==='2024');
  const result = records => {
    const pool = B.poolFor(A.create(records),2024,'',200);
    return audit.sensitivity(pool,B.presets.balanced,false).candidates.map(e=>[e.row.id,e.value,e.rank,e.changes]);
  };
  assert.deepEqual(result(season),result(season.map(r=>({...r,CS:'0'}))));
});

test('투수 심층 지표는 정수 아웃과 TBF를 따로 쓰며 ERA·연령을 검산한다', () => {
  const source = pitching.find(r=>r.Id==='52257' && r.Season==='2024');
  const deep = overrides => {
    const row = P.create([{...source,...overrides}]).lookup.get('52257|2024');
    return audit.deepStats(row,true);
  };
  const actual = deep({});
  assert.ok(Math.abs(actual.kbb-64/315)<1e-12);
  assert.deepEqual([actual.bb9,actual.h9,actual.hr,actual.k9,actual.g,actual.age],[1.32,9,0.36,9,14,30]);
  assert.equal(actual.eraCheck,'반올림 범위 일치');
  assert.equal(deep({IP:'1/3',BB:'1'}).bb9,27);
  assert.equal(deep({IP:'0',BB:'0'}).bb9,null);
  assert.equal(deep({IP:'1.4'}).h9,null);
  assert.equal(deep({SO:''}).k9,null);
  assert.equal(deep({SO:'0'}).k9,0);
  assert.equal(deep({BB:'',TBF:'0'}).kbb,null);
  assert.equal(deep({BB:'0',SO:'0'}).kbb,0);
  assert.equal(deep({ER:''}).eraCheck,'검산 보류');
  assert.equal(deep({ER:'0'}).eraCheck,'원자료 확인');
  assert.equal(deep({Age:'31'}).age,null);
});

test('투수 심층 백분위는 같은 비교 집단에서 낮은 BB/9와 높은 K/9을 우대한다', () => {
  const records = Array.from({length:6},(_,i)=>({
    Id:String(i),Season:'2024',Player:'동명',G:'10',IP:'30',TBF:'150',SO:String(40-i),H:'20',
    BB:String(i),ER:'5',ERA:'1.50',HR:i===0?'':'1'
  }));
  const run = rows => {
    const engine = P.create(rows),pool=P.poolFor(engine,2024,30);
    return audit.review({engine,records:rows,pool,scope:{year:2024,minimum:30,weights:P.presets.balanced},selected:[pool[0]],pitching:true});
  };
  const report = run(records), p = report.profiles[0];
  assert.equal(p.entry,undefined);
  assert.equal(report.scenarioRanks.find(s=>s.key==='hr' && s.label==='제외').ranks[0],1);
  assert.ok(report.scenarioRanks.filter(s=>s.key!=='hr' || s.label!=='제외').every(s=>s.ranks[0]===null));
  assert.deepEqual(p.relative.bb9,{n:6,pct:100*5.5/6});
  assert.deepEqual(p.relative.k9,p.relative.bb9);
  assert.deepEqual(p.relative.hr,{n:5,pct:null});
  assert.deepEqual(run(records.slice(0,4)).profiles[0].relative.bb9,{n:4,pct:null});
});
