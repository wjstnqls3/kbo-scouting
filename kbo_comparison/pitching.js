(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./analytics'));
  else root.KBOPitching = factory(root.KBOAnalytics);
})(globalThis, function (A) {
  const minimum = 30;
  const presets = {
    balanced:{k:2,bb:2,hr:2,whip:1},
    strikeout:{k:5,bb:2,hr:1,whip:0},
    walkControl:{k:0,bb:1,hr:0,whip:0},
    homerControl:{k:0,bb:0,hr:1,whip:0},
  };
  const axes = [
    {key:'k',code:'K%',name:'탈삼진 능력',formula:'SO / TBF',direction:1},
    {key:'bb',code:'BB%',name:'볼넷 억제력',formula:'BB / TBF',direction:-1},
    {key:'hr',code:'HR/9',name:'피홈런 억제력',formula:'HR / IP × 9',direction:-1},
    {key:'whip',code:'WHIP',name:'출루 억제력',formula:'(H + BB) / IP',direction:-1},
  ];
  const active = weights => axes.filter(axis=>weights[axis.key]>0);
  const number = value => {
    const result = A.num(value);
    return result !== null && result >= 0 ? result : null;
  };
  const count = value => {
    const result = number(value);
    return Number.isSafeInteger(result) ? result : null;
  };
  function parseOuts(value) {
    const text = String(value ?? '').trim();
    const match = text.match(/^(?:(\d+)(?:\s+([12])\/3)?|([12])\/3)$/);
    if (!match) return null;
    const outs = Number(match[1] || 0)*3 + Number(match[2] || match[3] || 0);
    return Number.isSafeInteger(outs) ? outs : null;
  }
  function formatIP(outs) {
    if (!Number.isSafeInteger(outs) || outs < 0) return '—';
    const whole = Math.floor(outs/3), remainder = outs%3;
    return remainder ? [whole || '',remainder+'/3'].filter(Boolean).join(' ') : String(whole);
  }
  function seasonStats(raw) {
    const outs = parseOuts(raw.IP), tbf = count(raw.TBF);
    const so = count(raw.SO), bb = count(raw.BB), h = count(raw.H), hr = count(raw.HR);
    const ratio = value => tbf > 0 && value !== null && value <= tbf ? value/tbf : null;
    return {
      outs, tbf, k:ratio(so), bb:ratio(bb),
      hr:outs > 0 && hr !== null && (h === null || hr <= h) ? hr*27/outs : null,
      whip:outs > 0 && h !== null && bb !== null ? (h+bb)*3/outs : null,
      era:outs > 0 ? number(raw.ERA) : null, g:count(raw.G), sv:count(raw.SV), hld:count(raw.HLD),
    };
  }
  function create(records) {
    const groups = new Map(), byYear = new Map(), lookup = new Map();
    for (const raw of records) {
      const year = count(raw.Season), id = String(raw.Id ?? '').trim();
      if (!year || !id || !raw.Player?.trim()) continue;
      const key = id+'|'+year;
      if (groups.has(key)) { groups.set(key,null); continue; }
      const stats = seasonStats(raw);
      groups.set(key,stats.g > 0 || stats.tbf > 0 || stats.outs > 0
        ? {id,year,name:raw.Player,team:raw.Team || '미확인',stats} : null);
    }
    for (const [key,row] of groups) {
      if (!row) continue;
      lookup.set(key,row);
      if (!byYear.has(row.year)) byYear.set(row.year,[]);
      byYear.get(row.year).push(row);
    }
    const rows = [...lookup.values()];
    const baseline = new Map([...byYear].map(([year,seasons])=>{
      const pool = seasons.filter(row=>row.stats.outs>=minimum*3);
      return [year,{size:pool.length,reference:referenceFor(pool,axes)}];
    }));
    function compare(row) {
      const {size,reference} = baseline.get(row.year);
      return {row,poolSize:size,positionKnown:true,provisional:row.stats.outs===null||row.stats.outs<minimum*3,
        axes:axes.map(axis=>{
          const actual = row.stats[axis.key], values = reference[axis.key];
          const score = A.pct(actual===null ? null : actual*axis.direction,values);
          return {...axis,actual,score,n:values.length,reason:actual===null?'missing':score===null?'sample':null};
        })};
    }
    const traitVectors = new Map();
    function vector(row) {
      if (!traitVectors.has(row)) {
        // WHIP also reflects walks. Similarity uses the three less-overlapping traits.
        traitVectors.set(row,compare(row).axes.slice(0,3).map(axis=>axis.score));
      }
      return traitVectors.get(row);
    }
    function similar(target) {
      if (!(target.stats.outs>=minimum*3)) return [];
      const focus = vector(target);
      if (!focus.every(Number.isFinite)) return [];
      const scored = [];
      for (const row of rows) {
        if (row.id===target.id || row.year>target.year || !(row.stats.outs>=minimum*3)) continue;
        const values = vector(row);
        if (!values.every(Number.isFinite)) continue;
        const distance = Math.hypot(...values.map((value,i)=>value-focus[i]))/Math.sqrt(values.length);
        scored.push({row,distance});
      }
      scored.sort((a,b)=>a.distance-b.distance||b.row.year-a.row.year||a.row.id.localeCompare(b.row.id));
      const seen = new Set();
      return scored.filter(({row})=>!seen.has(row.id)&&seen.add(row.id)).slice(0,3);
    }
    return {byYear,lookup,compare,similar};
  }
  function poolFor(engine, year, minIP) {
    const pool = engine.byYear.get(year) || [];
    return minIP === 0 ? pool : pool.filter(row=>row.stats.outs>=minIP*3);
  }
  function referenceFor(pool, selectedAxes) {
    return Object.fromEntries(selectedAxes.map(axis=>[axis.key,
      pool.map(row=>row.stats[axis.key]).filter(Number.isFinite).map(value=>value*axis.direction)]));
  }
  function evaluate(pool,weights) {
    const selectedAxes = active(weights);
    const reference = referenceFor(pool,selectedAxes);
    const entries = pool.map(row=>{
      const scores = Object.fromEntries(selectedAxes.map(axis=>{
        const values = reference[axis.key], value = row.stats[axis.key];
        return [axis.key,{value:A.pct(value===null ? null : value*axis.direction,values),n:values.length}];
      }));
      return {row,scores,...A.fitScore(scores,weights,axes)};
    }).sort((a,b)=>(b.value??-1)-(a.value??-1)||b.row.stats.outs-a.row.stats.outs||
      a.row.name.localeCompare(b.row.name,'ko')||a.row.id.localeCompare(b.row.id));
    let previous = null, rank = 0;
    entries.forEach((entry,index)=>{
      if (entry.value===null) return;
      if (previous===null || Math.abs(previous-entry.value)>1e-10) rank=index+1;
      entry.rank=rank;
      previous=entry.value;
    });
    return entries;
  }
  return {minimum,axes,presets,active,parseOuts,formatIP,seasonStats,create,poolFor,evaluate};
});
