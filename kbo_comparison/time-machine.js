(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./analytics'), require('./core'), require('./portfolio-model'), require('./pitching'));
  } else {
    root.KBOTimeMachine = factory(root.KBOAnalytics, root.KBOCore, root.KBOPortfolio, root.KBOPitching);
  }
})(globalThis, function (A, C, battingModel, pitchingModel) {
  const labels = ['A', 'B', 'C'];
  const keyMetric = pitching => pitching ? 'era' : 'ops';
  const birth = raw => /^\d{4}-\d{2}-\d{2}$/.test(raw.Born) ? raw.Born : null;
  const count = raw => Number.isSafeInteger(A.num(raw)) && Number(raw) >= 0 ? Number(raw) : null;
  const volume = (stats, pitching) => pitching ? stats.outs : stats.pa;

  function seasons(records) {
    return [...new Set(records.map(row => count(row.Season)).filter(year => year > 0))].sort((a, b) => a - b);
  }

  function futureYears(years, year) {
    return years.filter(later => later > year && later <= year + 3);
  }

  function availableYears(records) {
    const years = seasons(records);
    return years.filter(year => futureYears(years, year).length).reverse();
  }

  const workload = row => row.stats.g > 0 && Number.isFinite(row.stats.outs)
    ? (row.stats.outs >= row.stats.g * 9 ? 'long' : 'short') : null;

  function peersOf(anchor, entries, pitching) {
    const positions = row => C.positionList(row.position).map(code => ['LF', 'CF', 'RF'].includes(code) ? 'OF' : code);
    return entries.filter(({row}) => pitching
      ? workload(anchor) !== null && workload(row) === workload(anchor)
      : positions(row).some(code => positions(anchor).includes(code)));
  }

  function createRound(records, {year, pitching, position, minimum}, random = Math.random) {
    if (!Number.isSafeInteger(minimum) || minimum < 1) return {error:'최소 출전 기준은 1 이상의 정수로 입력하세요.'};
    // The current model uses same-season reference pools. No later row reaches either evaluator.
    const historical = records.filter(raw => Number(raw.Season) <= year);
    const births = new Map();
    for (const raw of historical) {
      if (!birth(raw)) continue;
      const id = String(raw.Id);
      if (!births.has(id)) births.set(id, new Set());
      births.get(id).add(birth(raw));
    }
    const current = historical.filter(raw => Number(raw.Season) === year);
    const rawById = new Map(current.map(raw => [String(raw.Id), raw]));
    const engine = pitching ? pitchingModel.create(current) : A.create(current);
    const model = pitching ? pitchingModel : battingModel;
    let pool = pitching
      ? model.poolFor(engine, year, minimum).filter(row => position === 'P' || workload(row) === position)
      : model.poolFor(engine, year, position, minimum);
    pool = pool.filter(row => birth(rawById.get(row.id)) && births.get(row.id)?.size === 1);
    if (pool.length < 5) return {error:`조건에 맞는 선수가 ${pool.length}명입니다. 모델 비교군에 최소 5명이 필요합니다. 포지션이나 최소 출전 기준을 조정하세요.`};

    const weights = model.presets.balanced;
    const axes = model.active(weights);
    const ranked = model.evaluate(pool, weights).filter(entry => Number.isFinite(entry.value));
    if (ranked.length < 3) return {error:`평가 가능한 선수가 ${ranked.length}명입니다. 필수 지표의 결측 또는 지표별 유효 표본 부족으로 후보 3명을 구성할 수 없습니다.`};

    const groups = ranked.map(anchor => ({anchor, peers:peersOf(anchor.row, ranked, pitching)}));
    const matched = groups.filter(group => group.peers.length >= 3);
    const choices = matched.length ? matched : groups;
    const {anchor, peers:matchedPeers} = choices[Math.floor(random() * choices.length)];
    const size = entry => volume(entry.row.stats, pitching);
    const peers = (matched.length ? matchedPeers : ranked).filter(entry => entry !== anchor);
    // Keep the two nearest workloads, then shuffle independently of rank.
    peers.sort((a, b) => Math.abs(size(a) - size(anchor)) - Math.abs(size(b) - size(anchor)));
    const trio = [anchor, ...peers.slice(0, 2)];
    for (let i = trio.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [trio[i], trio[j]] = [trio[j], trio[i]];
    }
    const recommended = labels[trio.indexOf(ranked.find(entry => trio.includes(entry)))];
    const players = trio.map(({row, scores, value}, i) => {
      const stats = pitching ? row.stats : {
        ...row.stats,
        ...Object.fromEntries(axes.map(axis => [axis.key, battingModel.metric(row, axis.key)])),
      };
      const evidence = axes.map(axis => ({name:axis.name, code:axis.code, score:scores[axis.key].value}))
        .sort((a, b) => b.score - a.score);
      return {label:labels[i], stats, score:value, strongest:evidence[0], weakest:evidence.at(-1)};
    });
    const identities = trio.map(({row}) => ({id:row.id, born:birth(rawById.get(row.id)), name:row.name, team:row.team}));
    let selected = null;
    return {
      players, poolSize:pool.length,
      judge(label) {
        if (!labels.includes(label) || selected) return null;
        selected = label;
        return {selected, recommended};
      },
      reveal() {
        if (!selected) return null;
        const years = futureYears(seasons(records), year);
        return {
          years, selected, recommended,
          players:players.map((player, i) => {
            const identity = identities[i];
            return {
              ...player, name:identity.name, team:identity.team,
              future:years.map(later => futureSeason(records, identity, later, pitching, minimum)),
            };
          }),
        };
      },
    };
  }

  function futureSeason(records, identity, year, pitching, minimum) {
    const matches = records.filter(raw => String(raw.Id) === identity.id && Number(raw.Season) === year);
    if (!matches.length) return {year, status:'absent'};
    if (matches.length !== 1 || birth(matches[0]) !== identity.born) return {year, status:'unverified'};
    const raw = matches[0];
    const stats = pitching ? pitchingModel.seasonStats(raw) : {
      pa:count(raw.PA), ops:A.rates([raw])?.ops ?? null,
    };
    if (pitching) stats.kbb = Number.isFinite(stats.k) && Number.isFinite(stats.bb) ? stats.k - stats.bb : null;
    const size = volume(stats, pitching);
    const lowSample = Number.isFinite(size) && size < minimum * (pitching ? 3 : 1);
    return {year, team:raw.Team || '미확인', status:'record', stats, lowSample};
  }

  function compareFuture(picked, peer, pitching) {
    const metric = keyMetric(pitching);
    const eligible = season => season?.status === 'record' && !season.lowSample &&
      Number.isFinite(volume(season.stats, pitching)) && Number.isFinite(season.stats[metric]);
    const result = {better:0, worse:0, equal:0};
    picked.future.forEach(season => {
      const other = peer.future.find(record => record.year === season.year);
      if (!eligible(season) || !eligible(other)) return;
      // Compare at the same precision shown in the report.
      const precision = pitching ? 2 : 3;
      const delta = (Number(season.stats[metric].toFixed(precision)) -
        Number(other.stats[metric].toFixed(precision))) * (pitching ? -1 : 1);
      result[delta > 0 ? 'better' : delta < 0 ? 'worse' : 'equal']++;
    });
    return result;
  }

  return {availableYears, createRound, compareFuture};
});
