const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const TM = require('../time-machine');
const P = require('../pitching');
const B = require('../portfolio-model');
const A = require('../analytics');

const batting = require('../sample_data.json');
const pitching = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../pitching-data.js'), 'utf8') + '\npitchingData');
const fixed = () => .31;
const options = {year:2020, pitching:false, position:'OF', minimum:200};

test('미래 행의 경기 기록과 식별 정보는 판단까지 읽지 않는다', () => {
  const past = batting.filter(row => Number(row.Season) <= options.year);
  const later = batting.filter(row => row.Season === '2021').map(row => new Proxy(row, {
    get(raw, key) {
      assert.equal(key, 'Season');
      return raw[key];
    },
  }));
  const baseline = TM.createRound(past, options, fixed);
  const round = TM.createRound([...past, ...later], options, fixed);
  assert.equal(round.reveal(), null);
  assert.deepEqual(round.players, baseline.players);
  assert.deepEqual(round.judge('A'), baseline.judge('A'));
  assert.equal(round.judge('B'), null);
});

for (const [records, isPitching] of [[batting, false], [pitching, true]]) {
  test(`실제 ${isPitching ? '투수' : '타자'} 기록과 기준 시즌 모델을 재사용한다`, () => {
    const rules = {...options, pitching:isPitching, position:isPitching ? 'P' : 'OF', minimum:isPitching ? 30 : 200};
    const round = TM.createRound(records, rules, fixed);
    const past = records.filter(row => +row.Season === rules.year);
    const ranking = isPitching ? P : B;
    const engine = isPitching ? P.create(past) : A.create(past);
    const pool = isPitching ? P.poolFor(engine, rules.year, rules.minimum) : B.poolFor(engine, rules.year, rules.position, rules.minimum);
    const entries = ranking.evaluate(pool, ranking.presets.balanced);
    assert.ok(round.players.every(player => !Object.hasOwn(player, 'name') && !Object.hasOwn(player, 'team')));
    const {recommended} = round.judge('C');
    const result = round.reveal();
    assert.deepEqual(Array.from(result.years), [2021, 2022, 2023]);
    for (const player of result.players) {
      const entry = entries.find(({row, value}) => row.name === player.name && row.team === player.team && value === player.score);
      assert.ok(entry);
      const id = entry.row.id;
      for (const season of player.future) {
        const raw = records.find(row => row.Id === id && +row.Season === season.year);
        if (!raw) {
          assert.equal(season.status,'absent');
          continue;
        }
        assert.equal(season.team, raw.Team);
        if (isPitching) {
          assert.equal(P.formatIP(season.stats.outs), raw.IP);
          if (season.stats.outs > 0) assert.equal(season.stats.era, +raw.ERA);
          if (+raw.TBF > 0) assert.ok(Math.abs(season.stats.kbb - (raw.SO - raw.BB) / raw.TBF) < 1e-12);
        } else {
          assert.equal(season.stats.pa, +raw.PA);
          const denominator = +raw.AB + +raw.BB + +raw.HBP + +raw.SF;
          if (+raw.AB > 0) assert.equal(season.stats.ops, (+raw.H + +raw.BB + +raw.HBP) / denominator + raw.TB / raw.AB);
        }
      }
    }
    assert.equal(result.players.find(player => player.label === recommended).score, Math.max(...result.players.map(player => player.score)));
    assert.equal(TM.availableYears(records)[0], 2025);
  });
}

test('선수 ID와 생년월일로 연결하고 결측, 소표본, 미출전을 구분한다', () => {
  const baseline = TM.createRound(batting, options, fixed);
  baseline.judge('A');
  const identity = baseline.reveal().players[0];
  const past = batting.filter(row => +row.Season <= options.year);
  const raw = past.find(row => +row.Season === options.year && row.Player === identity.name && row.Team === identity.team);
  const future = [
    {...raw, Season:'2021', Born:'1900-01-01'},
    {...raw, Season:'2022', Id:'other-id'},
    {...raw, Season:'2023', PA:'1', TB:''},
  ];
  const round = TM.createRound([...past, ...future], options, fixed);
  round.judge('A');
  const seasons = round.reveal().players[0].future;
  assert.deepEqual(seasons.map(season => season.status), ['unverified','absent','record']);
  assert.equal(seasons[2].lowSample,true);
  assert.equal(seasons[2].stats.ops,null);
  assert.deepEqual(TM.compareFuture({future:seasons}, {future:seasons}, false), {better:0,worse:0,equal:0});
  assert.deepEqual(TM.availableYears([{Season:2016}, {Season:2020}, {Season:2023}]), [2020]);
});
