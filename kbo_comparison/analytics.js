(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));else root.KBOAnalytics=factory(root.KBOCore);})(globalThis,function(C){
'use strict';
const num=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(+v)?+v:null;
const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const sd=a=>a.length?Math.sqrt(mean(a.map(v=>(v-mean(a))**2))):null;
const pct=(v,values)=>{const a=values.filter(Number.isFinite);if(!Number.isFinite(v)||a.length<5)return null;return 100*(a.filter(x=>x<v-1e-10).length+.5*a.filter(x=>Math.abs(x-v)<=1e-10).length)/a.length;};
// 공개된 KBO 선형 가중치로 계산한 wRC 추정치. 원본 CSV의 고의4구 분리 결측 때문에 공식값과 다를 수 있음.
const wrcWeights={bb:.758,hbp:.773,single:.928,double:1.301,triple:1.692,hr:1.998,scale:1.1406};
function woba(rows){
 const fields=['AB','H','2B','3B','HR','BB','HBP','SF'];
 // Missing event counts are unknown, not zero. Reject impossible hit breakdowns.
 if(!rows.length||rows.some(r=>fields.some(k=>num(r[k])===null||num(r[k])<0||!Number.isInteger(num(r[k])))||+r.H>+r.AB||+r['2B']+ +r['3B']+ +r.HR>+r.H))return null;
 const sum=Object.fromEntries(fields.map(k=>[k,rows.reduce((s,r)=>s+num(r[k]),0)]));
 const singles=sum.H-sum['2B']-sum['3B']-sum.HR,den=sum.AB+sum.BB+sum.SF+sum.HBP;
 if(singles<0||den<=0)return null;
 return (wrcWeights.bb*sum.BB+wrcWeights.hbp*sum.HBP+wrcWeights.single*singles+wrcWeights.double*sum['2B']+wrcWeights.triple*sum['3B']+wrcWeights.hr*sum.HR)/den;
}
const dimensions=[{key:'onbase',name:'OBP',meaning:'출루율',detail:'OBP ÷ 해당 시즌 리그 OBP · OPS와 일부 중복되는 설명용 평가축'},{key:'contact',name:'K%',meaning:'삼진율',detail:'타석 대비 삼진 비율이 낮을수록 높은 점수 · 실제 컨택률 아님'},{key:'power',name:'ISO',meaning:'순장타율',detail:'ISO의 시즌 리그 대비 비율'},{key:'eye',name:'BB%',meaning:'볼넷률',detail:'BB%의 시즌 리그 대비 비율 · 볼넷 비율이 높을수록 높은 점수'},{key:'production',name:'OPS',meaning:'출루율+장타율',detail:'OPS의 시즌 리그 대비 비율'},{key:'homerun',name:'HR%',meaning:'홈런율',detail:'홈런÷타석의 해당 시즌 리그 대비 비율 · ISO와 일부 중복'}];
const fitPresets={balanced:{onbase:1,contact:1,power:1,eye:1,production:1,homerun:1},onbase:{onbase:3,contact:1,power:0,eye:2,production:0,homerun:0},power:{onbase:0,contact:0,power:3,eye:0,production:1,homerun:2},
strikeout:{onbase:0,contact:1,power:0,eye:0,production:0,homerun:0},
walk:{onbase:0,contact:0,power:0,eye:1,production:0,homerun:0},
homerun:{onbase:0,contact:0,power:0,eye:0,production:0,homerun:1},
ops:{onbase:0,contact:0,power:0,eye:0,production:1,homerun:0}};
function fitScore(scores,weights,axes=dimensions){
 const active=axes.filter(d=>weights[d.key]>0);
 if(axes.some(d=>!Number.isFinite(weights[d.key])||weights[d.key]<0||weights[d.key]>10)||!active.length)return {value:null,reason:'비중은 0~10 · 하나 이상 양수 필요',provisional:false};
 if(active.some(d=>!Number.isFinite(scores[d.key]?.value)))return {value:null,reason:'선택한 지표의 비교 표본·기록 부족',provisional:false};
 const total=active.reduce((sum,d)=>sum+weights[d.key],0);
 return {value:active.reduce((sum,d)=>sum+scores[d.key].value*weights[d.key],0)/total,reason:null,provisional:active.some(d=>scores[d.key].provisional)};
}
function rates(rows){const c=C.stats(rows);if(!c)return null;return {pa:c['타석'],avg:c['타율'],obp:c['출루율'],slg:c['장타율'],ops:c.OPS,iso:c.ISO,bb:Number.isFinite(c['BB%'])?c['BB%']/100:null,k:Number.isFinite(c['K%'])?c['K%']/100:null,hr:c['타석']>0?c['홈런']/c['타석']:null};}
const comparisonMinPA=200;
const comparisonAxes=[
 {key:'avg',code:'AVG',name:'안타 생산력',formula:'H / AB',fields:['H','AB'],calculate:(h,ab)=>ab>0&&h<=ab?h/ab:null},
 {key:'bb',code:'BB%',name:'선구안',formula:'BB / PA',fields:['BB','PA'],calculate:(bb,pa)=>pa>0&&bb<=pa?bb/pa:null},
 {key:'k',code:'K%',name:'삼진 억제력',formula:'SO / PA',fields:['SO','PA'],direction:-1,calculate:(so,pa)=>pa>0&&so<=pa?so/pa:null},
 {key:'iso',code:'ISO',name:'순수 장타력',formula:'SLG − AVG',fields:['TB','H','AB'],calculate:(tb,h,ab)=>ab>0&&h<=ab&&tb>=h&&tb<=4*h?(tb-h)/ab:null},
 {key:'sb',code:'SB/PA',name:'도루 생산력',formula:'SB / PA',fields:['SB','PA'],calculate:(sb,pa)=>pa>0?sb/pa:null}
];
const comparisonFitPresets={
 balanced:{avg:1,bb:1,k:1,iso:1,sb:1},
 onbase:{avg:2,bb:3,k:1,iso:0,sb:0},
 power:{avg:0,bb:0,k:0,iso:1,sb:0},
 strikeout:{avg:0,bb:0,k:1,iso:0,sb:0},
 walk:{avg:0,bb:1,k:0,iso:0,sb:0},
 speed:{avg:0,bb:0,k:0,iso:0,sb:1}
};
function comparisonMetric(row,axis){
 const counts=axis.fields.map(key=>row.raw[key]);
 if(counts.some(value=>value==null||String(value).trim()===''))return {actual:null,reason:'missing'};
 const values=counts.map(num);
 const actual=values.every(value=>Number.isInteger(value)&&value>=0)?axis.calculate(...values):null;
 return {actual,reason:actual===null?'invalid':null};
}
function compareBatters(engine,batters,positionMode=false){
 return batters.map(row=>{
  const positionKnown=!positionMode||C.knownPosition(row.position);
  const pool=positionKnown?(engine.byYear.get(row.year)||[]).filter(peer=>
   peer.stats.pa>=comparisonMinPA&&(!positionMode||C.sharedPosition(row.position,peer.position))):[];
  const axes=comparisonAxes.map(axis=>{
   const metric=comparisonMetric(row,axis);
   const direction=axis.direction??1;
   const reference=pool.map(peer=>comparisonMetric(peer,axis).actual)
    .filter(Number.isFinite).map(value=>value*direction);
   const score=metric.reason===null?pct(metric.actual*direction,reference):null;
   return {...axis,...metric,score,n:reference.length,
    reason:metric.reason||(!positionKnown?'position':score===null?'sample':null)};
  });
  return {row,axes,poolSize:pool.length,positionKnown,provisional:row.stats.pa<comparisonMinPA};
 });
}
const gradeBands=[['S',90],['A',75],['B',60],['C',40],['D',25],['E',0]];
function radarGrade(scores,pa,minimum,axes=dimensions){
 const values=axes.map(d=>scores[d.key]?.value);
 if(pa<minimum||!values.every(Number.isFinite))return {value:null,grade:null};
 const value=mean(values);
 return {value,grade:gradeBands.find(([,lower])=>value>=lower)[0]};
}
function create(records,{qualifiedBaseline=false}={}){
 const audit={input:records.length,invalid:0,duplicateRows:0,pitchers:0,inactive:0,ageIssues:0,issues:[]};
 const counts=new Map();for(const r of records){const key=String(r.Id)+'|'+r.Season;counts.set(key,(counts.get(key)||0)+1);}
 const rows=[];const required=['G','PA','AB','H','HR','TB','BB','HBP','SF','SO'];
 for(const r of records){
  const key=String(r.Id)+'|'+r.Season;
  if(counts.get(key)>1){audit.duplicateRows++;continue;}
  if(r.Position==='P'){audit.pitchers++;continue;}
  if(!r.Id||!r.Player||!Number.isInteger(num(r.Season))||required.some(k=>num(r[k])===null||+r[k]<0||!Number.isInteger(+r[k]))||+r.H>+r.AB||+r.HR>+r.H||+r.TB<+r.H||+r.TB>4*+r.H||+r.PA<+r.AB||+r.SO>+r.PA){audit.invalid++;audit.issues.push(key);continue;}
  if(+r.G===0||+r.PA===0){audit.inactive++;continue;}
  const stats=rates([r]);if(!stats){audit.invalid++;continue;}
  const birth=/^\d{4}-\d{2}-\d{2}$/.test(r.Born||'')?+r.Born.slice(0,4):null;
  let age=num(r.Age);if(age===null||age<0||!Number.isInteger(age)||(birth!==null&&age!==+r.Season-birth)){age=null;audit.ageIssues++;}
  rows.push({id:String(r.Id),year:+r.Season,name:r.Player,age,position:C.positionCode(r),positionEvidence:C.positionEvidence(r),team:r.Team||'미확인',raw:r,stats});
 }
 const byYear=new Map(),byPlayer=new Map(),lookup=new Map();
 for(const r of rows){if(!byYear.has(r.year))byYear.set(r.year,[]);byYear.get(r.year).push(r);if(!byPlayer.has(r.id))byPlayer.set(r.id,[]);byPlayer.get(r.id).push(r);lookup.set(`${r.id}|${r.year}`,r);}
 const league=new Map([...byYear].map(([y,rs])=>{
  const minimum=C.requiredPA(y),qualified=rs.filter(r=>r.stats.pa>=minimum);
  const raw=(qualifiedBaseline?qualified:rs).map(r=>r.raw);
  const pa=raw.reduce((a,x)=>a+num(x.PA),0);
  const runs=raw.every(x=>Number.isInteger(num(x.R))&&num(x.R)>=0)?raw.reduce((a,x)=>a+num(x.R),0):null;
  const lgWoba=woba(raw),rpa=pa>0&&runs!==null?runs/pa:null;
  const qualifyingPA={minimum,count:qualified.length,average:mean(qualified.map(r=>r.stats.pa))};
  return [y,{...rates(raw),woba:lgWoba,rpa,wrcPer100:rpa===null?null:rpa*100,qualifyingPA}];
 }));
 for(const r of rows){
  const l=league.get(r.year),playerWoba=woba([r.raw]);
  r.stats.woba=playerWoba;
  r.stats.wrc=Number.isFinite(playerWoba)&&Number.isFinite(l.woba)&&Number.isFinite(l.rpa)?(((playerWoba-l.woba)/wrcWeights.scale)+l.rpa)*r.stats.pa:null;
  r.stats.wrcPer100=Number.isFinite(r.stats.wrc)&&r.stats.pa>0?r.stats.wrc/r.stats.pa*100:null;
 }
 for(const rs of byPlayer.values())rs.sort((a,b)=>a.year-b.year);
 for(const r of rows){const l=league.get(r.year);const ratio=k=>Number.isFinite(r.stats[k])&&Number.isFinite(l[k])&&l[k]>0?r.stats[k]/l[k]:null;r.relative={homerun:ratio('hr'),onbase:ratio('obp'),contact:ratio('k')===null?null:-ratio('k'),power:ratio('iso'),eye:ratio('bb'),production:ratio('ops')};r.index=r.relative.production===null?null:r.relative.production*100;}
 function history(r,n=3){return (byPlayer.get(r.id)||[]).filter(x=>x.year<=r.year).slice(-n);}
 function growth(r,minPA=200){const prev=lookup.get(`${r.id}|${r.year-1}`);return prev&&r.stats.pa>=minPA&&prev.stats.pa>=minPA&&prev.index>0&&Number.isFinite(r.index)?100*(r.index/prev.index-1):null;}
 function features(r){return {...r.relative};}
 function cohort(r,{era='season',group='all',minPA=200}={}){return rows.filter(x=>x.id!==r.id&&x.stats.pa>=minPA&&(era==='all'||x.year===r.year)&&(!['age','both'].includes(group)||(r.age!==null&&x.age===r.age))&&(!['position','both'].includes(group)||(C.sharedPosition(r.position,x.position))));}
 function scores(r,pool,minPA=200){
  const f=features(r);
  return Object.fromEntries(dimensions.map(d=>{
   const values=pool.map(p=>features(p)[d.key]).filter(Number.isFinite);
   // minPA selects the reference population, not whether an observed target can be plotted.
   const value=r.stats.pa>0?pct(f[d.key],values):null;
   const reason=value!==null?null:!Number.isFinite(f[d.key])||!(r.stats.pa>0)?'record':'reference';
   return [d.key,{value,n:values.length,mean:mean(values),provisional:value!==null&&r.stats.pa<minPA,reason}];
  }));
 }
 function similar(r,minPA=200){
  const vector=x=>{if(x.stats.pa<minPA)return null;const f=features(x);const v=dimensions.map(d=>f[d.key]);return v.every(Number.isFinite)?v:null;};
  const v=vector(r);if(!v)return [];
  const candidates=rows.filter(x=>x.id!==r.id&&x.year<r.year).map(x=>({row:x,v:vector(x)})).filter(x=>x.v);
  if(candidates.length<5)return [];
  const scales=v.map((_,i)=>sd([v[i],...candidates.map(x=>x.v[i])]));const active=scales.map((s,i)=>s>1e-12?i:-1).filter(i=>i>=0);if(!active.length)return [];
  const ranked=candidates.map(c=>{const distances=active.map(i=>((c.v[i]-v[i])/scales[i])**2);const distance=Math.sqrt(mean(distances));return {row:c.row,distance,score:100/(1+distance),history:[c.row],differences:{opsIndex:c.row.index-r.index,iso:c.row.stats.iso-r.stats.iso,bb:100*(c.row.stats.bb-r.stats.bb),k:100*(c.row.stats.k-r.stats.k)}};}).sort((a,b)=>a.distance-b.distance||a.row.id.localeCompare(b.row.id)||b.row.year-a.row.year);
  const seen=new Set();return ranked.filter(x=>{if(seen.has(x.row.id))return false;seen.add(x.row.id);return true;}).slice(0,5);
 }
 function discover(o){
  const w=o.weights||{production:1,growth:1};if(Object.values(w).some(x=>!Number.isFinite(x)||x<0)||!(w.production+w.growth>0))throw Error('비중은 0 이상이며 하나 이상 양수여야 합니다.');
  const base=(byYear.get(+o.year)||[]).filter(x=>x.stats.pa>=o.minPA);const indices=base.map(x=>x.index),changes=base.map(x=>growth(x,o.minPA));
  return base.filter(x=>(o.minAge===null||(x.age!==null&&x.age>=o.minAge))&&(o.maxAge===null||(x.age!==null&&x.age<=o.maxAge))&&(!o.team||C.teamId(x.team)===o.team)&&(!o.position||C.matchesPosition(x.position,o.position))&&x.index>=o.minIndex&&(o.minGrowth===null||(growth(x,o.minPA)!==null&&growth(x,o.minPA)>=o.minGrowth))).map(row=>{
   const g=growth(row,o.minPA);const ps=pct(row.index,indices),gs=pct(g,changes);const score=(w.production>0&&ps===null)||(w.growth>0&&gs===null)?null:((ps??0)*w.production+(gs??0)*w.growth)/(w.production+w.growth);return {row,growth:g,score,productionScore:ps,growthScore:gs};
  }).filter(x=>x.score!==null).sort((a,b)=>b.score-a.score||b.row.index-a.row.index||a.row.id.localeCompare(b.row.id));
 }
 return {rows,audit,byYear,byPlayer,league,lookup,history,growth,features,cohort,scores,similar,discover};
}
return {create,dimensions,num,pct,rates,sd,woba,wrcWeights,fitPresets,fitScore,radarGrade,gradeBands,comparisonMinPA,comparisonAxes,comparisonFitPresets,comparisonMetric,compareBatters};
});
