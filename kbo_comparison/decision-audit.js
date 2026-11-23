(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./analytics'), require('./portfolio-model'), require('./pitching'), require('./core'));
  else root.KBODecisionAudit = factory(root.KBOAnalytics, root.KBOPortfolio, root.KBOPitching, root.KBOCore);
})(globalThis, function (A, batters, pitchers, core) {
  'use strict';
  const nearFactor = 1.10;
  const roles = {selected:'직접 선택',alternative:'모델 추천 대안'};
  const labels = {avg:'AVG', ops:'OPS', iso:'ISO', bb:'BB%', k:'K%', sb:'SB/PA', pa:'PA', era:'ERA', hr:'HR/9', whip:'WHIP', ip:'IP'};
  const deepAxes = {
    batting: [
      {key:'hrpa', code:'HR/PA', name:'홈런 생산', formula:'HR ÷ PA'},
      {key:'xbhShare', code:'XBH/H', name:'장타 비중', formula:'(2B + 3B + HR) ÷ H'},
      {key:'bbk', code:'BB/K', name:'볼넷·삼진 균형', formula:'BB ÷ SO'},
      {key:'stealRate', code:'도루 성공률', name:'주루 효율', formula:'SB ÷ (SB + CS)'}
    ],
    pitching: [
      {key:'kbb', code:'K-BB%', name:'탈삼진·볼넷 차', formula:'(SO − BB) ÷ TBF'},
      {key:'bb9', code:'BB/9', name:'볼넷 억제', formula:'9 × BB ÷ IP', direction:-1},
      {key:'h9', code:'H/9', name:'피안타 억제', formula:'9 × H ÷ IP', direction:-1},
      {key:'hr', code:'HR/9', name:'피홈런 억제', formula:'9 × HR ÷ IP', direction:-1},
      {key:'k9', code:'K/9', name:'탈삼진 생산', formula:'9 × SO ÷ IP'}
    ]
  };
  Object.assign(labels,{obp:'OBP',slg:'SLG',hrpa:'HR/PA',kbb:'K-BB%'});
  function count(value) {
    const n = A.num(value);
    return Number.isSafeInteger(n) && n>=0 ? n : null;
  }
  function deepStats(row,pitching) {
    const r = row.raw, s = row.stats;
    if (pitching) {
      const perNine = field => {
        const n = count(r[field]);
        return s.outs>0 && n!==null ? n*27/s.outs : null;
      };
      const age = count(r.Age);
      const birthYear = /^\d{4}-\d{2}-\d{2}$/.test(r.Born) ? Number(r.Born.slice(0,4)) : null;
      const earned = perNine('ER');
      return {kbb:metric(row,'kbb',true),
        bb9:perNine('BB'),h9:perNine('H'),k9:perNine('SO'),hr:s.hr,g:s.g,
        age:birthYear===null || age===row.year-birthYear ? age : null,
        eraCheck:earned===null || s.era===null ? '검산 보류' : Math.abs(earned-s.era)<=0.005001 ? '반올림 범위 일치' : '원자료 확인'};
    }
    const stats = core.stats([r]);
    const parts = [r['2B'],r['3B'],r.HR].map(count);
    const hits = count(r.H);
    const total = parts.every(Number.isFinite) ? parts.reduce((a,b)=>a+b,0) : null;
    const xbh = hits!==null && total>hits ? null : total;
    const sb = count(r.SB), cs = count(r.CS);
    const attempts = sb!==null && cs!==null ? sb+cs : null;
    return {hrpa:s.hr,xbh,xbhShare:hits>0 && xbh!==null ? xbh/hits : null,
      bbk:stats?.['BB/K'] ?? null,stealRate:attempts>0 && Number.isFinite(stats?.['도루성공%']) ? stats['도루성공%']/100 : null,
      sb,attempts,g:count(r.G),age:row.age};
  }

  const keysFor = pitching => pitching ? ['era','k','bb','kbb','hr','whip','ip'] : ['avg','obp','slg','ops','iso','bb','k','hrpa','pa'];
  function metric(row, key, pitching) {
    if (key === 'hrpa') return row.stats.hr;
    if (key === 'kbb') return Number.isFinite(row.stats.k) && Number.isFinite(row.stats.bb) ? row.stats.k-row.stats.bb : null;
    if (key === 'ip') return Number.isFinite(row.stats.outs) ? row.stats.outs / 3 : null;
    if (!pitching && ['avg','iso','bb','k','sb'].includes(key)) return batters.metric(row,key);
    return row.stats[key] ?? null;
  }

  function scenarios(weights, axes) {
    const keys = axes.map(axis => axis.key);
    if (keys.some(key => !Number.isFinite(weights[key]) || weights[key] < 0 || weights[key] > 10)) return [];
    function normalize(vector) {
      const sum = keys.reduce((total,key) => total + vector[key], 0);
      return sum > 0 ? Object.fromEntries(keys.map(key => [key,vector[key] / sum])) : null;
    }
    const signature = vector => keys.map(key => vector[key].toFixed(13)).join('|');
    const base = normalize(weights);
    if (!base) return [];
    const seen = new Set([signature(base)]), result = [];
    for (const key of keys.filter(key => weights[key] > 0)) {
      for (const [factor,label] of [[0.8,'−20%'],[1.2,'+20%'],[0,'제외']]) {
        const normalized = normalize({...weights,[key]:weights[key]*factor});
        if (!normalized || seen.has(signature(normalized))) continue;
        seen.add(signature(normalized));
        result.push({key,label,weights:normalized});
      }
    }
    return result;
  }

  function sensitivity(pool, weights, pitching) {
    const model = pitching ? pitchers : batters;
    const baseline = model.evaluate(pool,weights);
    const variants = scenarios(weights,pitching ? pitchers.axes : A.comparisonAxes).map(scenario => {
      const ranks = new Map(model.evaluate(pool,scenario.weights).filter(e => e.rank).map(e => [e.row.id,e.rank]));
      return {...scenario,ranks};
    }).filter(s => s.ranks.size);
    const candidates = baseline.filter(e => e.rank).map(entry => {
      const changes = variants.filter(s => s.ranks.has(entry.row.id)).map(s => ({
        key:s.key,label:s.label,rank:s.ranks.get(entry.row.id)
      }));
      const ranks = changes.map(s => s.rank);
      const maxShift = Math.max(0,...ranks.map(rank => Math.abs(rank-entry.rank)));
      // Top three is uninformative if every ranked candidate fits in three places.
      const informative = variants.filter(s => s.ranks.size > 3 && s.ranks.has(entry.row.id));
      return {...entry,changes,total:ranks.length,
        best:ranks.length ? Math.min(...ranks) : null, worst:ranks.length ? Math.max(...ranks) : null,
        topTotal:informative.length, topCount:informative.filter(s => s.ranks.get(entry.row.id)<=3).length,
        influences:maxShift ? changes.filter(s => Math.abs(s.rank-entry.rank)===maxShift) : []};
    });
    return {candidates,variants};
  }

  function history(engine, records, row, pitching, minimum, seasonReference) {
    const first = Math.max(Math.min(...engine.byYear.keys()), row.year-2);
    const identity = records.filter(r => String(r.Id)===row.id && Number(r.Season)<=row.year);
    const conflict = new Set(identity.map(r => r.Born?.trim()).filter(Boolean)).size > 1;
    const keys = keysFor(pitching), volumeKey = keys.at(-1);
    const seasons = [];
    for (let year=first; year<=row.year; year++) {
      const season = engine.lookup.get(row.id+'|'+year);
      const values = {};
      if (season && !conflict) {
        values.g = count(season.raw.G);
        for (const key of keys) values[key] = metric(season,key,pitching);
      }
      let status = '기준 충족';
      if (conflict) status = '출생 정보 충돌';
      else if (!season) status = identity.some(r => +r.Season===year) ? '원자료 분석 제외' : '기록 없음';
      else if (!Number.isFinite(values[volumeKey])) status = '출전 규모 결측';
      else if (values[volumeKey] < minimum) status = '표본 부족';
      const reference = seasonReference(year);
      const inPool = !conflict && reference.rows.has(season);
      const relative = Object.fromEntries(Object.entries(reference.metrics).map(([key,ref])=>[
        key,{n:ref.values.length,pct:inPool && Number.isFinite(values[key]) ? A.pct(values[key]*ref.direction,ref.values) : null}
      ]));
      seasons.push({year,values,status,relative,inPool,poolSize:reference.rows.size,raw:conflict ? null : season?.raw});
    }
    const ranges = Object.fromEntries(['g',...keys].map(key => {
      const valid = seasons.filter(s => s.status==='기준 충족').map(s => s.values[key]).filter(Number.isFinite);
      return [key,valid.length>=2 ? Math.max(...valid)-Math.min(...valid) : null];
    }));
    return {seasons,ranges};
  }

  function review({engine,records,pool,scope,selected,pitching}) {
    const {candidates,variants} = sensitivity(pool,scope.weights,pitching);
    const byId = new Map(candidates.map(e => [e.row.id,e]));
    const selectedIds = new Set(selected.map(row => row.id));
    const picks = new Map();
    function add(row,role) {
      if (!picks.has(row.id)) picks.set(row.id,{row,roles:[]});
      picks.get(row.id).roles.push(role);
    }
    for (const row of selected) add(row,roles.selected);
    if (candidates.length) add(candidates[0].row,candidates.filter(e=>e.rank===1).length>1 ? '공동 1위 대표' : '모델 1위');
    const stable = candidates.filter(e => !selectedIds.has(e.row.id) && e.total>0)
      .sort((a,b) => a.worst-b.worst || a.rank-b.rank)[0];
    if (stable) add(stable.row,roles.alternative);

    const volumeKey = pitching ? 'ip' : 'pa';
    const rules = pitching ? [['era','bb'],['k','hr'],['whip','ip']] : [['ops','bb'],['avg','iso'],['iso','k']];
    const directions = pitching ? {era:-1,bb:-1,hr:-1,whip:-1} : {k:-1};
    const seasons = new Map();
    function seasonReference(year) {
      if (!seasons.has(year)) {
        const peers = year===scope.year ? pool : pitching ? pitchers.poolFor(engine,year,scope.minimum)
          : batters.poolFor(engine,year,scope.position,scope.minimum);
        const metrics = Object.fromEntries(['g',...keysFor(pitching)].map(key=>{
          const direction = directions[key] ?? 1;
          const values = peers.map(peer=>key==='g' ? count(peer.raw.G) : metric(peer,key,pitching))
            .filter(Number.isFinite).map(value=>value*direction);
          return [key,{direction,values}];
        }));
        seasons.set(year,{rows:new Set(peers),metrics});
      }
      return seasons.get(year);
    }
    const keys = [...new Set([volumeKey,...rules.flat()])];
    const oriented = (row,key) => {
      const value = metric(row,key,pitching);
      return Number.isFinite(value) ? value*(directions[key] ?? 1) : null;
    };
    const references = Object.fromEntries(keys.map(key => [key,pool.map(row => oriented(row,key)).filter(Number.isFinite)]));
    const traits = deepAxes[pitching ? 'pitching' : 'batting'];
    const deepMetrics = [...traits,{key:'g'},...(pitching ? [] : [{key:'xbh'}])];
    const deepByRow = new Map(pool.map(row=>[row,deepStats(row,pitching)]));
    const deepReference = Object.fromEntries(deepMetrics.map(({key,direction=1})=>[
      key,[...deepByRow.values()].map(s=>s[key]).filter(Number.isFinite).map(v=>v*direction)
    ]));
    const profiles = [...picks.values()].map(({row,roles}) => {
      const percentile = key => A.pct(oriented(row,key),references[key]);
      const conflicts = rules.filter(([high,low]) => percentile(high)>=75 && Number.isFinite(percentile(low)) && percentile(low)<=25)
        .map(([high,low]) => ({high,low,upper:percentile(high),lower:percentile(low)}));
      const volume = metric(row,volumeKey,pitching);
      const sample = volume===null ? '출전 규모 결측' : volume<scope.minimum ? '최소 기준 미달' :
        volume<=scope.minimum*nearFactor ? '최소 기준 근접' : '최소 기준 충족';
      const deep = deepByRow.get(row) || deepStats(row,pitching);
      const relative = Object.fromEntries(deepMetrics.map(({key,direction=1})=>{
        const values = deepReference[key];
        return [key,{n:values.length,pct:A.pct(Number.isFinite(deep[key]) ? deep[key]*direction : null,values)}];
      }));
      return {row,roles,deep,relative,entry:byId.get(row.id),volume,volumePct:percentile(volumeKey),sample,conflicts,
        history:history(engine,records,row,pitching,scope.minimum,seasonReference)};
    });
    const activeAxes = (pitching ? pitchers : batters).active(scope.weights);
    const metricCounts = Object.fromEntries(activeAxes.map(axis=>[axis.key,pool.filter(row=>Number.isFinite(metric(row,axis.key,pitching))).length]));
    const scenarioRanks = variants.map(({key,label,ranks}) => ({
      key,label,ranks:profiles.map(p=>ranks.get(p.row.id) ?? null)
    }));
    return {profiles,scope,metricCounts,poolSize:pool.length,ranked:candidates.length,scenarios:variants.length,scenarioRanks,pitching};
  }
  return {scenarios,sensitivity,review,deepStats,deepAxes,nearFactor,keysFor,labels,metric,roles};
});
