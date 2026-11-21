const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../analytics'),records=require('../sample_data.json');
const e=A.create(records);

test('전체 선수·시즌의 6축을 원기록 비율과 직접 계산한 백분위로 검증',()=>{
 const vector=r=>{
  const s=r.raw,ab=+s.AB,pa=+s.PA,den=ab+(+s.BB)+(+s.HBP)+(+s.SF);
  const avg=ab>0?+s.H/ab:null,slg=ab>0?+s.TB/ab:null,obp=den>0?((+s.H)+(+s.BB)+(+s.HBP))/den:null;
  const lg=e.league.get(r.year);
  return {onbase:obp===null?null:obp/lg.obp,contact:-(+s.SO/pa)/lg.k,power:slg===null?null:(slg-avg)/lg.iso,eye:(+s.BB/pa)/lg.bb,production:slg===null||obp===null?null:(slg+obp)/lg.ops,homerun:(+s.HR/pa)/lg.hr};
 };
 const vectors=new Map(e.rows.map(r=>[r,vector(r)]));
 let complete=0,lowComplete=0,partial=0;
 for(const r of e.rows){
  const pool=e.cohort(r),scores=e.scores(r,pool),own=vectors.get(r);
  assert.ok(pool.every(p=>p.stats.pa>=200&&p.id!==r.id&&p.year===r.year));
  let valid=0;
  for(const d of A.dimensions){
   const values=pool.map(p=>vectors.get(p)[d.key]).filter(Number.isFinite),v=own[d.key];
   let expected=null;
   if(Number.isFinite(v)&&values.length>=5){
    let sum=0;for(const x of values)sum+=Math.abs(x-v)<=1e-10?.5:x<v?1:0;
    expected=100*sum/values.length;
   }
   const score=scores[d.key],label=`${r.name} ${r.year} ${d.name}`;
   if(expected===null){assert.equal(score.value,null,label);assert.equal(score.reason,Number.isFinite(v)?'reference':'record',label);}
   else{assert.ok(Math.abs(score.value-expected)<1e-9,label);assert.ok(score.value>=0&&score.value<=100,label);valid++;}
   assert.equal(score.provisional,expected!==null&&r.stats.pa<200,label);
  }
  if(valid===6){complete++;if(r.stats.pa<200)lowComplete++;}else partial++;
 }
 assert.equal(e.rows.length,9818);assert.equal(complete,9804);assert.equal(lowComplete,5884);assert.equal(partial,14);
});

test('2026 김성욱 실제 데이터: 기준 타석과 무관하게 계산 가능한 6축 유지',()=>{
 const r=e.lookup.get('62934|2026');assert.equal(r.name,'김성욱');assert.equal(r.team,'SSG');assert.equal(r.stats.pa,142);
 for(const minPA of [0,100,200,446]){
  const scores=e.scores(r,e.cohort(r,{minPA}),minPA);
  for(const d of A.dimensions){assert.ok(Number.isFinite(scores[d.key].value));assert.equal(scores[d.key].provisional,142<minPA);}
 }
});
