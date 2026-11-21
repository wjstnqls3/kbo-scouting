const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const M = require('../pitching');
const source = name => fs.readFileSync(path.join(__dirname,'..',name));
const {rows,metadata} = vm.runInNewContext(source('pitching-data.js').toString()+';({rows:pitchingData,metadata:pitchingMetadata})');
const close = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-10,`${actual} != ${expected}`);
const sample = {Id:'1',Player:'예시',Season:'2024',Team:'삼성',G:'5',IP:'128 2/3',TBF:'500',SO:'125',BB:'25',H:'100',HR:'10',ERA:'3.5'};

test('정수 아웃카운트로 분수 이닝과 공식 네 가지를 계산', () => {
  for (const [notation,outs] of [['128 2/3',386],['1/3',1],['2/3',2],['0',0],['3',9]]) {
    assert.equal(M.parseOuts(notation),outs);
    assert.equal(M.formatIP(outs),notation);
  }
  for (const notation of ['',null,'3/3','4 1/2','128.2','-1']) assert.equal(M.parseOuts(notation),null);
  const stats = M.seasonStats(sample);
  close(stats.k,125/500);
  close(stats.bb,25/500);
  close(stats.hr,10*9/(128+2/3));
  close(stats.whip,(100+25)/(128+2/3));
  const fraction = M.seasonStats({...sample,IP:'1/3'});
  assert.equal(fraction.hr,270);
  assert.equal(fraction.whip,375);
  assert.equal(M.seasonStats({...sample,IP:'0'}).whip,null);
  assert.equal(M.seasonStats({...sample,IP:'-'}).hr,null);
  assert.equal(M.seasonStats({...sample,TBF:'0'}).k,null);
  assert.equal(M.seasonStats({...sample,BB:''}).whip,null);
  assert.equal(M.seasonStats({...sample,HR:''}).hr,null);
  assert.equal(M.seasonStats({...sample,BB:'0'}).bb,0);
  assert.equal(M.seasonStats({...sample,ERA:'-'}).era,null);
});

test('동일 시즌 비교군에서 낮은 BB·HR·WHIP과 높은 K를 우대하고 표본 부족은 보류', () => {
  const peers = Array.from({length:6},(_,i)=>({...sample,Id:String(i+1),SO:String(125-i*10),
    BB:String(25+i*5),H:String(100+i*5),HR:String(10+i)}));
  const engine = M.create(peers);
  const best = engine.lookup.get('1|2024');
  const marks = engine.compare(best);
  assert.equal(marks.poolSize,6);
  assert.ok(marks.axes.every(axis=>axis.n===6 && axis.score>90));
  assert.equal(M.evaluate(M.poolFor(engine,2024,30),M.presets.balanced)[0].row,best);
  const partial = M.create([...peers.slice(0,4),{...peers[4],HR:''}]);
  const score = partial.compare(partial.lookup.get('1|2024'));
  assert.equal(score.axes.find(axis=>axis.key==='hr').n,4);
  assert.equal(score.axes.find(axis=>axis.key==='hr').score,null);
  assert.ok(M.evaluate(M.poolFor(partial,2024,30),M.presets.balanced).every(entry=>entry.value===null));
  const low = M.create([...peers,{...sample,Id:'7',IP:'1/3'}]);
  assert.equal(low.compare(low.lookup.get('7|2024')).provisional,true);
  assert.equal(M.poolFor(low,2024,30).length,6);
  assert.equal(M.poolFor(low,2024,0).length,7);
  assert.ok(!M.create([...peers,peers[0]]).lookup.has('1|2024'));
});

test('동봉 투수 데이터의 CSV 해시, 이닝 및 유사 선수 범위를 검증', () => {
  assert.equal(rows.length,7971);
  assert.equal(metadata.row_count,rows.length);
  assert.equal(crypto.createHash('sha256').update(source(metadata.source_file)).digest('hex'),metadata.sha256);
  assert.ok(rows.every(row=>M.parseOuts(row.IP)!==null));
  const engine = M.create(rows);
  assert.equal(engine.byYear.size,45);
  const top = M.evaluate(M.poolFor(engine,2024,30),M.presets.balanced)[0].row;
  const result = engine.similar(top);
  assert.equal(result.length,3);
  assert.equal(new Set(result.map(({row})=>row.id)).size,3);
  assert.ok(result.every(({row,distance})=>row.id!==top.id && row.year<=top.year && row.stats.outs>=90 && Number.isFinite(distance)));
});

test('볼넷과 피홈런 억제형은 각 지표의 오름차순으로만 순위를 매긴다', () => {
  const peers = Array.from({length:6},(_,i)=>({...sample,Id:String(i+1),BB:String(10+i),HR:String(10-i)}));
  const engine = M.create(peers), pool = M.poolFor(engine,2024,30);
  for (const [profile,key,top] of [['walkControl','bb','1'],['homerControl','hr','6']]) {
    const weights = M.presets[profile];
    assert.deepEqual(M.active(weights).map(axis=>axis.key),[key]);
    const rankings = M.evaluate(pool,weights);
    assert.equal(rankings[0].row.id,top);
    assert.deepEqual(rankings.map(entry=>entry.row.stats[key]),pool.map(row=>row.stats[key]).sort((a,b)=>a-b));
    close(rankings[0].value,100*5.5/6);
  }
});
