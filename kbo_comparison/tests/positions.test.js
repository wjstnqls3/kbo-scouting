const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../core'),A=require('../analytics'),P=require('../position-data'),records=require('../sample_data.json');
test('확인된 외야 포지션은 선수 ID·시즌·이름·구단 일치 시만 적용, 원본 불변',()=>{
 for(const p of P.entries){
  const rows=records.filter(r=>r.Id===p.id&&+r.Season===p.year);assert.equal(rows.length,1);
  const r=rows[0];assert.equal(C.positionCode(r),p.position);assert.equal(r.Position,'OF');
  assert.equal(C.positionCode({...r,Season:1900}),'OF');
  assert.equal(C.positionCode({...r,Id:'other'}),'OF');
  assert.equal(C.positionCode({...r,Player:'동명이인'}),'OF');
  assert.equal(C.positionCode({...r,Team:'다른 구단'}),'OF');
 }
 assert.equal(new Set(P.entries.map(p=>`${p.id}|${p.year}`)).size,P.entries.length);
 const e=A.create(records);
 assert.equal(e.lookup.get('62404|2024').position,'LF');
 assert.equal(e.lookup.get('62415|2024').position,'CF');
 assert.equal(e.lookup.get('66108|2024').position,'RF');
 assert.equal(e.lookup.get('62404|2022').position,'OF');
});
test('미확인 외야를 같은 포지션으로 간주하지 않고 LF·CF·RF를 분리',()=>{
 const base=records.find(r=>r.Id==='62404'&&r.Season==='2024');
 const data=['LF','CF','RF','OF','LF','CF','RF','OF'].map((Position,i)=>({...base,Id:`test-${i}`,Position}));
 const e=A.create(data),r=e.rows[0];
 assert.deepEqual(e.cohort(r,{group:'position'}).map(x=>x.position),['LF']);
 assert.deepEqual(e.cohort(e.rows[3],{group:'position'}),[]);
 assert.equal(e.cohort(e.rows[3],{group:'all'}).length,7);
 const options={year:2024,minPA:200,minAge:null,maxAge:null,minIndex:0,minGrowth:null,weights:{production:1,growth:0},position:'CF'};
 assert.ok(e.discover(options).every(x=>x.row.position==='CF'));
});
test('추천 포지션 필터는 경력 전체가 아닌 후보의 선택 시즌에 적용',()=>{
 const base=records.find(r=>r.Id==='62404'&&r.Season==='2024');
 const data=[{...base,Id:'target',Position:'1B'}, {...base,Id:'switch',Season:2023,Position:'CF'}, {...base,Id:'switch',Season:2024,Position:'RF'}, {...base,Id:'center',Position:'CF'}];
 const e=C.createEngine(data),target={id:'target',end:2024,stats:e.aggregate('target',2024)};
 const result=e.recommend([target],{OPS:0,'홈런':1},(p,row)=>row.Position==='CF',2024);
 assert.deepEqual(result.map(x=>x.id),['center']);
});
test('복수 수비 위치를 모두 표시하고 각 위치 필터에 중복 없이 포함',()=>{
 assert.equal(C.positionText('CF/RF'),'중견수·우익수');
 assert.equal(C.positionText('CF/RF',true),'CF/RF');
 assert.equal(C.positionText('OF'),'외야수');
 assert.deepEqual(C.positionList(['RF','CF','RF','OF']),['CF','RF']);
 for(const p of ['CF','RF','OF'])assert.equal(C.matchesPosition('CF/RF',p),true);
 assert.equal(C.matchesPosition('CF/RF','LF'),false);
 assert.equal(C.matchesPosition('OF','CF'),false);
 const base=records.find(r=>r.Id==='62404'&&r.Season==='2024');
 const rows=['CF/RF','CF','RF','LF','OF','CF/RF'].map((Position,i)=>({...base,Id:`multi-${i}`,Position}));
 const e=A.create(rows);
 const pool=e.cohort(e.rows[0],{group:'position'});
 assert.deepEqual(pool.map(r=>r.id),['multi-1','multi-2','multi-5']);
 assert.equal(new Set(pool.map(r=>r.id)).size,pool.length);
 const o={year:2024,minPA:200,minAge:null,maxAge:null,minIndex:0,minGrowth:null,weights:{production:1,growth:0},position:'RF'};
 assert.deepEqual(new Set(e.discover(o).map(x=>x.row.id)),new Set(['multi-0','multi-2','multi-5']));
 const actual=A.create(records).lookup.get('61404|2024');
 assert.equal(C.positionText(actual.position),'좌익수·중견수·우익수');
 assert.equal(C.positionText(A.create(records).lookup.get('61404|2022').position),'외야수');
});
