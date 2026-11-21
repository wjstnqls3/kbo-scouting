/* Shared calculation rules: browser + Node verification. */
(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./position-data.js') : root.KBOPositionData);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KBOCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(P) {
  'use strict';
  const positionNames={C:'포수','1B':'1루수','2B':'2루수','3B':'3루수',SS:'유격수',LF:'좌익수',CF:'중견수',RF:'우익수',DH:'지명타자',OF:'외야수'};
  const outfield=['LF','CF','RF','OF'];
  function matchesName(name, query, prefixOnly = false) {
    const initials='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
    const letters=[...query.normalize('NFKC')];
    const normalized=name.normalize('NFC');
    const starts=prefixOnly?[0]:Array.from({length:normalized.length},(_,i)=>i);
    return !letters.length || starts.some(start=>letters.every((letter,i)=>{
      const character=normalized[start+i];
      if(!character)return false;
      const code=character.charCodeAt(0)-0xac00;
      return character===letter || (code>=0&&code<11172&&initials[Math.floor(code/588)].normalize('NFKC')===letter);
    }));
  }
  function positionList(value){
    const parts=(Array.isArray(value)?value:[value]).flatMap(x=>String(x||'').split(/[\s/,·]+/));
    return Object.keys(positionNames).filter(k=>parts.includes(k)&&!(k==='OF'&&parts.some(p=>['LF','CF','RF'].includes(p))));
  }
  const positionEvidence=row=>P?.lookup(row)||null;
  const positionCode=row=>{const value=positionEvidence(row)?.position||row.Position;return positionList(value).join('/')||value||null;};
  const knownPosition=code=>positionList(code).some(p=>p!=='OF');
  const positionText=(code,short=false)=>positionList(code).map(p=>short?p:positionNames[p]).join(short?'/':'·')||(short?'—':'포지션 미확인');
  const matchesPosition=(code,selected)=>positionList(code).some(p=>selected==='OF'?outfield.includes(p):p===selected);
  const sharedPosition=(a,b)=>positionList(a).some(p=>p!=='OF'&&positionList(b).includes(p));
  const metrics = ['경기','타석','안타','홈런','타율','출루율','장타율'];
  const rates = ['타율','출루율','장타율'];
  const detailMetrics=['2루타','3루타','타점','득점','도루','도루실패','도루성공%','볼넷','삼진','BB%','K%','BB/K','OPS','ISO','BABIP'];
  const teams = {
    'SSG / SK':['SSG','SK'], 'KIA / 해태':['KIA','해태'], '두산 / OB':['두산','OB'],
    'LG / MBC':['LG','MBC'], '한화 / 빙그레':['한화','빙그레'],
    '키움 / 넥센 / 우리 히어로즈':['키움','넥센','히어로즈','우리'],
    '현대 / 태평양 / 청보 / 삼미':['현대','태평양','청보','삼미']
  };
  const teamColors = {'SSG / SK':'#bd1731','KIA / 해태':'#a00018','두산 / OB':'#172e53','LG / MBC':'#ae1550','한화 / 빙그레':'#bd4800','키움 / 넥센 / 우리 히어로즈':'#791b40','현대 / 태평양 / 청보 / 삼미':'#15578a','KT':'#303030','NC':'#285077','롯데':'#a21d31','삼성':'#1455a0','쌍방울':'#4d426c'};
  function teamId(team) { return Object.keys(teams).find(key=>teams[key].includes(team)) || team; }
  function scheduledGames(year) {
    if(year===1982)return 80; if(year<=1984)return 100; if(year===1985)return 110;
    if(year<=1988)return 108; if(year<=1990)return 120; if(year<=1998)return 126;
    if(year<=2000)return 132; if(year<=2004)return 133; if(year<=2008)return 126;
    if(year<=2012)return 133; if(year<=2014)return 128; return 144;
  }
  const requiredPA = year => Math.floor(scheduledGames(year)*31/10);
  const selectionKey = (id, end) => `${id}|${Number(end)}`;
  const number = value => value==null || String(value).trim()==='' || !Number.isFinite(Number(value)) ? null : Number(value);
  function stats(rows) {
    const fields=['G','PA','AB','H','HR','TB','BB','HBP','SF'];
    if(!rows.length || rows.some(r=>fields.some(k=>number(r[k])===null)))return null;
    const sum=Object.fromEntries(fields.map(k=>[k,rows.reduce((n,r)=>n+Number(r[k]),0)]));
    const denominator=sum.AB+sum.BB+sum.HBP+sum.SF;
    const optional=k=>rows.every(r=>number(r[k])!==null)?rows.reduce((n,r)=>n+Number(r[k]),0):null;
    const doubles=optional('2B'),triples=optional('3B'),rbi=optional('RBI'),runs=optional('R'),sb=optional('SB'),cs=optional('CS');
    const so=rows.every(r=>number(r.SO)!==null)?rows.reduce((n,r)=>n+Number(r.SO),0):null;
    const avg=sum.AB>0?sum.H/sum.AB:null, obp=denominator>0?(sum.H+sum.BB+sum.HBP)/denominator:null, slg=sum.AB>0?sum.TB/sum.AB:null;
    const babipDen=so===null?0:sum.AB-so-sum.HR+sum.SF;
    return {'2루타':doubles,'3루타':triples,'타점':rbi,'득점':runs,'도루':sb,'도루실패':cs,'도루성공%':sb!==null&&cs!==null&&sb+cs>0?100*sb/(sb+cs):null,'볼넷':sum.BB,'삼진':so,'BB%':sum.PA>0?sum.BB/sum.PA*100:null,'K%':sum.PA>0&&so!==null?so/sum.PA*100:null,'BB/K':so>0?sum.BB/so:null,'OPS':obp!==null&&slg!==null?obp+slg:null,'ISO':avg!==null&&slg!==null?slg-avg:null,'BABIP':babipDen>0?(sum.H-sum.HR)/babipDen:null, '경기':sum.G,'타석':sum.PA,'안타':sum.H,'홈런':sum.HR,
      '타율':sum.AB>0?sum.H/sum.AB:null,
      '출루율':denominator>0?(sum.H+sum.BB+sum.HBP)/denominator:null,
      '장타율':sum.AB>0?sum.TB/sum.AB:null};
  }
  function createEngine(records) {
    const groups=new Map(), cache=new Map();
    for(const row of records) {
      // Pitching seasons are not candidates for a batting comparison.
      if(row.Position==='P')continue;
      const id=String(row.Id); if(!groups.has(id))groups.set(id,[]);
      groups.get(id).push({...row,Id:id,Position:positionCode(row)});
    }
    const players=[...groups].map(([id,rows])=>({id,name:rows[0].Player,
      positions:[...new Set(rows.flatMap(r=>positionList(r.Position)))],
      teams:[...new Set(rows.flatMap(r=>[r.Team,...(r.Career||'').split('-'),...(r.career_kbo||'').split('-')]).filter(Boolean))]
    })).sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.id.localeCompare(b.id));
    function validYears(id) {
      return [...new Set((groups.get(String(id))||[]).filter(r=>number(r.G)>0).map(r=>Number(r.Season)))].sort((a,b)=>b-a);
    }
    function seasonYears(id,end) { return validYears(id).includes(Number(end))?[Number(end)]:[]; }
    function aggregate(id,end) {
      const key=selectionKey(id,end);if(cache.has(key))return cache.get(key);
      const rows=(groups.get(String(id))||[]).filter(r=>Number(r.Season)===Number(end)&&number(r.G)>0);
      const value=rows.length===1?stats(rows):null;
      const valid=value&&rates.every(k=>Number.isFinite(value[k]))?value:null;
      cache.set(key,valid);return valid;
    }
    let windows=null;
    function recommend(targets, weights, accept=()=>true, season=null) {
      const active=metrics.filter(k=>Number.isFinite(weights[k])&&weights[k]>0);
      if(!active.length)throw new Error('추천 지표를 하나 이상 선택하세요.');
      const totalWeight=active.reduce((sum,k)=>sum+weights[k],0);
      if(!windows) windows=players.flatMap(p=>validYears(p.id).flatMap(end=>{
        const record=aggregate(p.id,end),row=groups.get(p.id).find(r=>Number(r.Season)===end&&number(r.G)>0);return record?[{id:p.id,name:p.name,end,stats:record,player:p,row}]:[];
      }));
      const excluded=new Set(targets.map(t=>t.id)), limit=targets.length===1?12:5;
      const candidates=windows.filter(c=>!excluded.has(c.id)&&accept(c.player,c.row));
      const output=[];
      for(const source of targets) {
        const eligible=candidates.filter(c=>season===null?c.end<source.end:c.end===Number(season)), range={};
        for(const k of active) {
          let min=source.stats[k],max=min;
          for(const c of eligible){min=Math.min(min,c.stats[k]);max=Math.max(max,c.stats[k]);}
          range[k]=max-min||1;
        }
        const ranked=eligible.map(c=>({...c,sourceId:source.id,sourceName:source.name,
          distance:active.reduce((sum,k)=>sum+Math.abs(c.stats[k]-source.stats[k])/range[k]*weights[k],0)/totalWeight
        })).sort((a,b)=>a.distance-b.distance||a.name.localeCompare(b.name,'ko')||b.end-a.end);
        const seen=new Set(); output.push(...ranked.filter(c=>{if(seen.has(c.id))return false;seen.add(c.id);return true;}).slice(0,limit));
      }
      return output;
    }
    return {groups,players,validYears,seasonYears,aggregate,recommend};
  }
  function leaderIndex(items, scope='period') {
    const league=new Map(), club=new Map();
    const eligible=(row,k)=>![...rates,'BB%','K%','BB/K','OPS','ISO','BABIP'].includes(k)||number(row.PA)>=requiredPA(+row.Season);
    const leagueKey=row=>scope==='year'?String(row.Season):'all';
    const clubKey=row=>`${leagueKey(row)}|${teamId(row.Team)}`;
    function add(index,key,k,value) {
      if(!index.has(key))index.set(key,{});
      const group=index.get(key);group[k]=Math.max(group[k]??-Infinity,value);
    }
    for(const {row,stats:record} of items)for(const k of [...metrics,...detailMetrics]) {
      if(k==='경기'||!record||!Number.isFinite(record[k])||!eligible(row,k))continue;
      add(league,leagueKey(row),k,record[k]);add(club,clubKey(row),k,record[k]);
    }
    const equal=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-12;
    return {flags(row,record,k) {
      if(k==='경기'||!record||!eligible(row,k))return {league:false,team:false};
      return {league:equal(record[k],league.get(leagueKey(row))?.[k]),team:equal(record[k],club.get(clubKey(row))?.[k])};
    }};
  }
  return {matchesName,positionNames,positionEvidence,positionCode,positionList,positionText,matchesPosition,sharedPosition,knownPosition,metrics,detailMetrics,rates,teams,teamColors,teamId,scheduledGames,requiredPA,selectionKey,stats,createEngine,leaderIndex};
});
