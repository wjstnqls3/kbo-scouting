(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./analytics'), require('./core'));
  else root.KBOPortfolio = factory(root.KBOAnalytics, root.KBOCore);
})(globalThis, function (A, C) {
  const metrics = {onbase:'obp', contact:'k', power:'iso', eye:'bb', production:'ops', homerun:'hr'};
  const presets = {
    onbase:A.fitPresets.onbase,
    power:A.fitPresets.power,
    contact:{...A.fitPresets.strikeout, onbase:1, contact:4},
    balanced:{...A.fitPresets.balanced, production:0}
  };
  const active = weights => A.dimensions.filter(d => weights[d.key] > 0);
  const metric = (row, key) => row.stats[metrics[key]];
  function evaluate(pool, weights) {
    const axes = active(weights);
    const oriented = (row, key) => {
      const value = metric(row, key);
      return Number.isFinite(value) ? value * (key === 'contact' ? -1 : 1) : null;
    };
    const reference = Object.fromEntries(axes.map(d => [d.key, pool.map(r => oriented(r, d.key)).filter(Number.isFinite)]));
    const entries = pool.map(row => {
      const scores = Object.fromEntries(axes.map(d => {
        const values = reference[d.key];
        return [d.key, {value:A.pct(oriented(row, d.key), values), n:values.length}];
      }));
      return {row, scores, ...A.fitScore(scores, weights)};
    });
    entries.sort((a,b) => (b.value ?? -1) - (a.value ?? -1) ||
      b.row.stats.pa - a.row.stats.pa || a.row.name.localeCompare(b.row.name, 'ko') || a.row.id.localeCompare(b.row.id));
    let previous = null, rank = 0;
    entries.forEach((entry, index) => {
      if (entry.value === null) return;
      if (previous === null || Math.abs(previous - entry.value) > 1e-10) rank = index + 1;
      entry.rank = rank;
      previous = entry.value;
    });
    return entries;
  }
  function poolFor(engine, year, position, minimum) {
    return (engine.byYear.get(year) || []).filter(row =>
      row.stats.pa >= minimum && (!position || C.matchesPosition(row.position, position)));
  }
  function sensitivity(pool, before, after) {
    const axes = [...active(before), ...active(after)];
    const shared = pool.filter(row => axes.every(d => Number.isFinite(metric(row, d.key))));
    const alternate = new Map(evaluate(shared, after).map(entry => [entry.row.id, entry]));
    return evaluate(shared, before).map(entry => ({before:entry, after:alternate.get(entry.row.id)}));
  }
  function timeline(engine, records, row, count = 5) {
    const identity = records.filter(r => String(r.Id) === row.id);
    const births = new Set(identity.map(r => r.Born?.trim()).filter(Boolean));
    if (births.size > 1) return null;
    const first = Math.max(Math.min(...engine.byYear.keys()), row.year - count + 1);
    return Array.from({length:row.year-first+1}, (_,i) => {
      const year = first+i;
      const raw = identity.filter(r => +r.Season === year);
      return {year, row:engine.lookup.get(C.selectionKey(row.id, year)),
        hasRaw:raw.length > 0, rawPA:raw.length === 1 ? A.num(raw[0].PA) : null};
    });
  }
  return {presets, active, metric, evaluate, poolFor, sensitivity, timeline};
});
