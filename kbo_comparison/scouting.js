/* 기록 분석만 담당하며 화면과 데이터 취득 방식에 의존하지 않습니다. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.KBOScouting=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const minPA=200;
  const n=x=>{if(x===null||x===undefined||String(x).trim()==='')return null;const v=Number(x);return Number.isFinite(v)?v:null;};
  function calculate(rows){
    const keys=['PA','AB','H','HR','TB','BB','HBP','SF','SO'];
    if(!rows.length||rows.some(r=>keys.some(k=>n(r[k])===null)))return null;
    const a=Object.fromEntries(keys.map(k=>[k,rows.reduce((s,r)=>s+n(r[k]),0)]));
    const den=a.AB+a.BB+a.HBP+a.SF;
    if(!a.PA||!a.AB||!den)return null;
    const obp=(a.H+a.BB+a.HBP)/den,slg=a.TB/a.AB;
    return {pa:a.PA,avg:a.H/a.AB,obp,slg,ops:obp+slg,hr:a.HR/a.PA,bb:a.BB/a.PA,so:a.SO/a.PA};
  }
  function grade(index,pa){if(!Number.isFinite(index)||!Number.isFinite(pa)||pa<minPA)return null;return index>=140?'S':index>=120?'A':index>=110?'B':index>=95?'C':index>=85?'D':'E';}
  function create(records){
    const seasons=new Map(),players=new Map();
    for(const r of records){if(r.Position==='P'||n(r.G)<=0)continue;const y=n(r.Season),id=String(r.Id);if(y===null||!id)continue;
      if(!seasons.has(y))seasons.set(y,[]);seasons.get(y).push(r);
      if(!players.has(id))players.set(id,[]);players.get(id).push(r);
    }
    const league=new Map();for(const [y,rows] of seasons)league.set(y,calculate(rows));
    function analyze(id,end){
      const years=[...new Set((players.get(String(id))||[]).map(r=>n(r.Season)).filter(y=>y!==null&&y<=Number(end)))].sort((a,b)=>b-a).slice(0,3).reverse();
      const trend=years.map(year=>{const rows=players.get(String(id)).filter(r=>n(r.Season)===year),stats=calculate(rows),avg=league.get(year);return {year,teams:[...new Set(rows.map(r=>r.Team))].join(' / '),age:n(rows[0].Age),stats,league:avg,index:stats&&avg&&avg.ops>0?100*stats.ops/avg.ops:null};});
      const selected=trend.find(r=>r.year===Number(end));if(!selected||!selected.stats)return null;
      const current=(seasons.get(selected.year)||[]).filter(r=>String(r.Id)===String(id));
      const age=selected.age, peers=(seasons.get(selected.year)||[]).filter(r=>String(r.Id)!==String(id)&&age!==null&&n(r.Age)===age);
      const peerGroups=new Map();for(const r of peers){const key=String(r.Id);if(!peerGroups.has(key))peerGroups.set(key,[]);peerGroups.get(key).push(r);}
      const peerRows=[...peerGroups].map(([pid,rows])=>({id:pid,name:rows[0].Player,team:[...new Set(rows.map(r=>r.Team))].join(' / '),stats:calculate(rows)})).filter(x=>x.stats&&x.stats.pa>=minPA).sort((a,b)=>b.stats.ops-a.stats.ops||a.id.localeCompare(b.id));
      const reference=league.get(selected.year),similar=[];
      if(selected.stats.pa>=minPA&&reference){
        const grouped=new Map();for(const r of seasons.get(selected.year)||[]){const key=String(r.Id);if(key===String(id))continue;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(r);}
        for(const [pid,rows] of grouped){const stats=calculate(rows);if(!stats||stats.pa<minPA)continue;
          const metrics=['obp','slg','hr','bb','so'];if(metrics.some(k=>!reference[k]))continue;
          const distance=Math.sqrt(metrics.reduce((sum,k)=>sum+Math.pow((stats[k]-selected.stats[k])/reference[k],2),0)/metrics.length);
          similar.push({id:pid,name:rows[0].Player,team:[...new Set(rows.map(r=>r.Team))].join(' / '),stats,distance});
        }similar.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
      }
      return {id:String(id),name:current[0]?.Player,selected,trend,peers:peerRows,similar:similar.slice(0,5),minPA};
    }
    return {analyze};
  }
  return {create,calculate,grade,minPA};
});
