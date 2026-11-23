const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {Element, parse, descendants} = require('./dom-fixture');

const source = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const records = require('../sample_data.json');
const A = require('../analytics');
const P = require('../portfolio-model');

function boot({search='?year=2024', hash='', storage=new Map(), random=Math.random} = {}) {
  const document = new Element('document');
  parse(source('index.html').replace(/<script[\s\S]*?<\/script>/g, ''), document);
  const $ = id => descendants(document).find(element=>element.attrs.id===id);
  document.getElementById = $;
  const errors = [], events = new Map();
  let prints = 0;
  const location = {search, hash};
  const context = vm.createContext({
    document, location, URLSearchParams,
    Math: Object.create(Math, {random:{value:random}}),
    window: {addEventListener:(name,handler)=>events.set(name,handler), print:()=>prints++},
    localStorage: {getItem:key=>storage.get(key), setItem:(key,value)=>storage.set(key,value)},
    console: {error:error=>errors.push(error)},
  });
  const scripts = [...source('index.html').matchAll(/<script defer src="([^"]+)"/g)].map(([,name])=>name);
  for (const file of scripts) vm.runInContext(source(file.split('?')[0]),context);
  assert.deepEqual(errors, []);
  return {$, storage, prints:()=>prints, events};
}

test('선택 URL 복원 시 후보 체크와 직접 선택이 일치하고 모델 대안은 별도로 표시된다', () => {
  const {$} = boot({search:'?mode=pitching&year=2026&selection=56801%7C2026&selection=69446%7C2026'});
  const checked = ()=>$('candidates').querySelectorAll('[data-candidate]:checked').map(el=>el.dataset.candidate);
  assert.deepEqual(checked(),['56801|2026','69446|2026']);
  $('open-audit').click();
  assert.match($('audit-results').textContent,/벤자민 · 기준 3위 · 변경 후 2–7위/);
  assert.equal($('audit-results').querySelectorAll('textarea').length,2);
  $('close-audit').click();
  $('candidates').querySelector('[data-candidate="56801|2026"]').click();
  assert.deepEqual(checked(),['69446|2026']);
  assert.equal($('selection-count').textContent,'선택 1/3명');
});

test('같은 시즌·같은 구단의 동명이인은 선택 목록과 검증 표·판단에 각각 식별된다', () => {
  const {$} = boot({search:'?mode=pitching&year=2026'});
  $('player-search').value='이승현';
  $('player-search').oninput();
  for (const id of ['60146','51454']) {
    const candidate = $('candidates').querySelector('[data-candidate="'+id+'|2026"]');
    assert.ok(candidate.attrs['aria-label'].includes(id));
    candidate.click();
    assert.ok($('selected-players').textContent.includes(id));
  }
  $('open-audit').click();
  const rows = $('audit-results').querySelector('table').querySelectorAll('tbody')[0].querySelectorAll('th');
  for (const [index,id] of ['60146','51454'].entries()) {
    assert.ok(rows[index].textContent.includes(id));
    assert.ok($('audit-choice-0-'+index));
  }
});

test('0이닝 투수의 기본 보고서는 순위 보류 조건과 계산 불가 사유를 구분한다', () => {
  const {$} = boot({search:'?mode=pitching&year=2024'});
  $('player-search').value='정우람';
  $('player-search').oninput();
  $('candidates').querySelector('[data-candidate="74857|2024"]').click();
  const report = $('report-content').textContent;
  assert.match(report,/피홈런 억제력 \(HR\/9\).*?0이닝 · 계산 불가/);
  assert.match(report,/출루 억제력 \(WHIP\).*?0이닝 · 계산 불가/);
  assert.match(report,/탈삼진 능력 \(K%\)0.00%/);
  assert.match(report,/균형형 탐색 순위 보류 · 최소 이닝 미달 · 전체 투수 30이닝 이상 154명/);
  $('trend-metric').value='hr';
  $('trend-metric').change();
  assert.match($('trend-summary').textContent,/2024년 0이닝.*계산 불가/);
  $('open-audit').click();
  assert.match($('audit-results').textContent,/정우람 산출 보류/);
});

test('후보 기준과 순위가 기존 계산과 일치하고 한 명부터 최대 세 명까지 평가할 수 있다', () => {
  const app = boot(), {$} = app;
  const expected = P.evaluate(P.poolFor(A.create(records),2024,'',200),P.presets.onbase);
  const candidates = $('candidates').querySelectorAll('[data-candidate]');
  const portraits = $('candidates').querySelectorAll('img');
  assert.equal(portraits.length,candidates.length);
  assert.match(portraits[0].attrs.src,new RegExp(`/2024/${expected[0].row.id}\\.jpg$`));
  assert.deepEqual(candidates.map(input=>input.dataset.candidate),
    expected.slice(0,15).map(({row})=>`${row.id}|${row.year}`));
  assert.match($('candidate-method').textContent,/유효 .*명/);
  assert.equal($('dashboard').hidden,false);
  assert.ok(candidates.every(input=>!input.checked));
  assert.equal($('selection-count').textContent,'선택 0/3명');
  assert.equal($('report-empty').hidden,false);
  assert.equal($('print-report').disabled,true);
  candidates[0].click();
  assert.equal($('report-content').querySelectorAll('article').length,1);
  candidates[1].click();
  candidates[2].click();
  candidates[3].click();
  assert.equal(candidates[3].checked,false);
  assert.match($('selection-message').textContent,/최대 3명/);
  const report = $('report-content');
  assert.equal(report.querySelectorAll('article').length,3);
  assert.equal($('radar-content').querySelectorAll('svg').length,1);
  $('tab-trend').click();
  assert.equal($('trend-panel').hidden,false);
  assert.equal(report.hidden,true);
  assert.equal(report.querySelector('[data-analysis="overview"]').hidden,true);
  candidates[2].click();
  assert.equal(report.querySelectorAll('article').length,2);
  assert.equal($('trend-panel').hidden,false);
  assert.match(report.textContent,/포지션 비교군.*유사 선수.*현장 확인/s);
  assert.match($('trend-plot').textContent,/2022.*2023.*2024/s);
  assert.doesNotMatch(report.textContent,/2021년/);
  $('player-search').value='ㄱㅈㅊ';
  $('player-search').oninput();
  const results=$('candidates').querySelectorAll('[data-candidate]');
  assert.equal($('candidates').querySelectorAll('img').length,0);
  const target=results.find(input=>input.attrs['aria-label'].includes('김지찬'));
  assert.ok(target);
  target.click();
  assert.equal($('report-content').querySelectorAll('article').length,3);
  assert.match($('radar-content').textContent,/김지찬/);
});

test('사용자 지정 슬라이더는 점수와 순위를 갱신하고 0만 입력하면 계산을 보류한다', () => {
  const {$} = boot();
  $('candidates').querySelector('[data-candidate]').click();
  const pool = P.poolFor(A.create(records),2024,'',200);
  const choose = value => { $('profile').value = value; $('profile').change(); };
  const verifyRanking = weights => {
    const entries = P.evaluate(pool,weights).filter(entry=>entry.rank).slice(0,15);
    const inputs = $('candidates').querySelectorAll('[data-candidate]');
    assert.deepEqual(inputs.map(input=>input.dataset.candidate),entries.map(({row})=>row.id+'|'+row.year));
    for (const [index,input] of inputs.entries()) {
      assert.ok(input.parent.parent.textContent.includes(entries[index].value.toFixed(1)+'점'));
    }
  };
  assert.ok('hidden' in $('custom-weights').attrs);
  assert.equal($('profile').options.length,5);
  for (const preset of Object.keys(P.presets)) {
    choose(preset);
    verifyRanking(P.presets[preset]);
    assert.equal($('custom-weights').hidden,true);
  }
  choose('custom');
  assert.equal($('custom-weights').hidden,false);
  verifyRanking(P.presets.balanced);
  const controls = $('weights').querySelectorAll('input');
  assert.equal(controls.length,5);
  assert.ok(controls.every(input=>input.type==='range' && input.attrs.min==='0' && input.attrs.max==='10' && input.attrs.step==='1'));
  const custom = {avg:3,bb:0,k:0,iso:0,sb:10};
  for (const [key,value] of Object.entries(custom)) $('weight-'+key).value = value;
  $('weights').oninput();
  verifyRanking(custom);
  assert.equal($('weight-value-sb').textContent,'10');
  assert.match($('pool-summary').textContent,/사용자 지정/);
  for (const input of controls) input.value = 0;
  $('weights').oninput();
  assert.match($('form-message').textContent,/모든 가중치가 0/);
  assert.equal($('form-message').hidden,false);
  verifyRanking(custom);
  $('weight-sb').value = 10;
  $('weights').oninput();
  assert.equal($('form-message').hidden,true);
  verifyRanking({...custom,avg:0});
  choose('power');
  assert.equal($('custom-weights').hidden,true);
  verifyRanking(P.presets.power);
  choose('custom');
  verifyRanking({...custom,avg:0});
  assert.equal($('report-content').querySelectorAll('article').length,1);
});

for (const mode of ['batting','pitching']) {
  test(mode+' 시즌·최소 출전·사용자 비중을 변경하면 후보와 검증 기준선이 일치한다', () => {
    const {$} = boot({search:'?mode='+mode+'&year=2024'});
    const pitcher = mode==='pitching';
    const ranking = pitcher ? require('../pitching') : P;
    const year = 2023, minimum = pitcher ? 100 : 150;
    const weights = pitcher ? {k:7,bb:2,hr:0,whip:1} : {avg:1,bb:6,k:3,iso:0,sb:0};
    const pool = pitcher
      ? ranking.poolFor(ranking.create(vm.runInNewContext(source('pitching-data.js')+';pitchingData')),year,minimum)
      : P.poolFor(A.create(records),year,'SS',minimum);
    $('season').value = year;
    $('season').change();
    if (!pitcher) {
      $('position').value = 'SS';
      $('position').change();
    }
    $('minimum').value = minimum;
    $('profile').value = 'custom';
    $('profile').change();
    for (const [key,value] of Object.entries(weights)) $('weight-'+key).value = value;
    $('weights').oninput();
    const expected = ranking.evaluate(pool,weights).filter(entry=>entry.rank).slice(0,15);
    assert.ok(expected.length>=5);
    const candidates = $('candidates').querySelectorAll('[data-candidate]');
    assert.deepEqual(candidates.map(el=>el.dataset.candidate),expected.map(({row})=>row.id+'|'+year));
    const leader = expected[0];
    candidates[0].click();
    $('open-audit').click();
    const summary = $('audit-results').textContent;
    for (const part of [year+'년', pitcher?'전체 투수':'유격수',minimum+(pitcher?'이닝':'타석'),
      pool.length+'명',leader.row.name,'1위',leader.value.toFixed(1)+'점','사용자 지정']) {
      assert.ok(summary.includes(part),part);
    }
  });
}

test('선수 리포트가 기존 메모를 읽고 우선순위·메모를 저장하며 PDF에 반영한다', () => {
  const key = 'kbo.scouting.memo.v1.67341|2022';
  const storage = new Map([[key,JSON.stringify(['기존 관찰','','','기존 영상 메모',''])]]);
  const params = {search:'?id=67341&year=2022',hash:'#report',storage};
  const app = boot(params), {$} = app;
  const report = $('report-content'), card = report.querySelector('article');
  const note = card.querySelector('textarea'), priority = card.querySelector('select');
  note.closest = priority.closest = () => card;
  assert.match(card.textContent,/기존 관찰/);
  assert.equal(note.textContent,'기존 영상 메모');
  note.value = '다음 경기에서 수비 위치 확인';
  report.oninput({target:note});
  priority.value = '우선 관찰';
  report.onchange({target:priority});
  assert.equal(card.querySelector('[data-priority-label]').textContent,'우선 관찰');
  assert.equal(card.querySelector('[data-print-note]').textContent,note.value);
  const details = report.querySelector('[data-print-expand]');
  app.events.get('beforeprint')();
  assert.equal(details.open,true);
  app.events.get('afterprint')();
  assert.equal(details.open,false);
  $('print-report').click();
  assert.equal(app.prints(),1);
  const reopened = boot(params).$('report-content');
  assert.equal(reopened.querySelector('textarea').textContent,note.value);
  assert.equal(reopened.querySelector('select').value,'우선 관찰');
  assert.match(reopened.textContent,/기존 관찰/);
});

test('시작 화면에서 타자·투수 분석에 진입하고 투수 후보·레이더·추세·리포트를 사용한다', () => {
  const {$:start} = boot({search:''});
  assert.equal(start('start-screen').hidden,false);
  const groupLinks = id => start(id).parent.querySelectorAll('a').map(link=>link.attrs.href);
  assert.deepEqual(groupLinks('standard-scouting-title'),['?mode=pitching','?mode=batting']);
  assert.equal(start('start-screen').querySelectorAll('a').length,2);
  assert.equal(boot({search:'?mode=time-machine'}).$('start-screen').hidden,false);

  const { $, events, prints } = boot({search:'?mode=pitching&year=2024'});
  assert.equal($('switch-pitching').attrs['aria-current'],'page');
  assert.equal($('switch-batting').attrs.href,'?mode=batting&year=2024');
  assert.equal($('position-control').hidden,true);
  assert.match($('pool-summary').textContent,/2024년 · 전체 투수 · 30이닝/);
  const options = $('candidates').querySelectorAll('[data-candidate]');
  assert.ok(options.every(input=>!input.checked));
  assert.equal($('selection-count').textContent,'선택 0/3명');
  assert.equal($('report-empty').hidden,false);
  assert.equal($('print-report').disabled,true);
  options[0].click();
  options[1].click();
  assert.equal($('selection-count').textContent,'선택 2/3명');
  assert.match($('radar-content').querySelector('svg').attrs['aria-label'],/4각형/);
  assert.match($('radar-content').textContent,/K%.*BB%.*HR\/9.*WHIP/s);
  assert.match($('report-content').textContent,/ERA.*경기.*세이브.*홀드/s);
  $('tab-trend').click();
  assert.equal($('trend-panel').hidden,false);
  assert.match($('trend-plot').textContent,/2022.*2023.*2024/s);
  const order = () => $('candidates').querySelectorAll('[data-candidate]').map(input=>input.dataset.candidate);
  $('profile').value = 'walkControl';
  $('profile').change();
  const walkOrder = order();
  assert.match($('pool-summary').textContent,/볼넷 억제형/);
  $('profile').value = 'homerControl';
  $('profile').change();
  assert.notDeepEqual(order(),walkOrder);
  assert.match($('pool-summary').textContent,/피홈런 억제형/);
  $('profile').value = 'custom';
  $('profile').change();
  assert.equal($('weights').querySelectorAll('input').length,4);
  events.get('beforeprint')();
  assert.equal($('report-content').querySelector('[data-print-expand]').open,true);
  events.get('afterprint')();
  $('print-report').click();
  assert.equal(prints(),1);
});

test('성장 추세는 두 모드에서 지표 하나와 실제 기록값·표본을 표시한다', () => {
  const selectMetric = ($,key,value,direction) => {
    $('trend-metric').value = key;
    $('trend-metric').change();
    assert.equal($('trend-plot').querySelectorAll('svg').length,1);
    assert.match($('trend-direction').textContent,new RegExp(direction+' 유리'));
    const labels = $('trend-plot').querySelectorAll('text').filter(node=>node.attrs.class==='trend-value');
    assert.ok(labels.some(node=>node.textContent===value),value);
  };
  const { $: hitter } = boot({search:'?mode=batting&id=67341&year=2022'});
  for (const id of ['selected-players', 'report-content']) {
    assert.match(hitter(id).querySelector('img').attrs.src,/\/2022\/67341\.jpg$/);
  }
  hitter('tab-trend').click();
  assert.match(hitter('trend-summary').querySelector('img').attrs.src,/\/2022\/67341\.jpg$/);
  const row = records.find(row=>row.Id==='67341'&&row.Season==='2022');
  for (const [key,value,unit,direction] of [
    ['avg',row.H/row.AB,'','높을수록'],['bb',row.BB/row.PA,'%','높을수록'],
    ['k',row.SO/row.PA,'%','낮을수록'],['iso',(row.TB-row.H)/row.AB,'','높을수록'],
    ['sb',row.SB/row.PA,'%','높을수록'],
  ]) selectMetric(hitter,key,unit?(value*100).toFixed(2)+unit:value.toFixed(3),direction);
  assert.match(hitter('trend-summary').textContent,new RegExp(row.PA+'타석'));
  const { $: pitcher } = boot({search:'?mode=pitching&id=76715&year=2024'});
  for (const id of ['selected-players', 'report-content']) {
    assert.match(pitcher(id).querySelector('img').attrs.src,/\/2024\/76715\.jpg$/);
  }
  assert.equal(pitcher('candidates').querySelectorAll('img').length,
    pitcher('candidates').querySelectorAll('[data-candidate]').length);
  for (const [key,value,unit,direction] of [
    ['k',135/679,'%','높을수록'],['bb',33/679,'%','낮을수록'],
    ['hr',12*9/(158+1/3),'','낮을수록'],['whip',(182+33)/(158+1/3),'','낮을수록'],
  ]) selectMetric(pitcher,key,unit?(value*100).toFixed(2)+unit:value.toFixed(3),direction);
  assert.match(pitcher('trend-summary').textContent,/2024년 158 1\/3이닝/);
  assert.match(pitcher('trend-summary').textContent,/2023년 기록 없음/);
  assert.match(pitcher('trend-summary').textContent,/판단 보류/);
  pitcher('tab-trend').click();
  assert.match(pitcher('trend-summary').querySelector('img').attrs.src,/\/2024\/76715\.jpg$/);
  for (const [$, selectedId] of [[hitter, '67341'], [pitcher, '76715']]) {
    $('tab-similar').click();
    const similar = $('report-content').querySelector('[data-analysis="similar"]');
    assert.equal(similar.hidden,false);
    const peers = similar.querySelectorAll('img');
    assert.ok(peers.length > 0);
    assert.ok(peers.every(photo => photo.dataset.photoId !== selectedId && /\/\d{4}\/\d{5}\.jpg$/.test(photo.attrs.src)));
  }
});

test('선수 사진이 실패하면 다른 형식과 시즌을 차례대로 시도하고 아이콘을 남긴다', () => {
  const events = new Map();
  const document = {addEventListener:(name, handler)=>events.set(name, handler)};
  const context = {document, battingData:[{Id:'67341',Season:'2023'}], pitchingData:[]};
  const markup = vm.runInNewContext(source('player-photo.js') + '\nKBOPlayerPhoto.markup("67341", 2026)', context);
  const portrait = new Element('div');
  parse(markup, portrait);
  const image = portrait.querySelector('img');
  assert.match(image.attrs.src,/\/middle\/2026\/67341\.jpg$/);
  assert.equal(image.attrs.referrerpolicy,'no-referrer');
  for (const suffix of [/\/kbo\/2026\/67341\.png$/, /\/middle\/2023\/67341\.jpg$/, /\/kbo\/2023\/67341\.png$/]) {
    events.get('error')({target:image});
    assert.match(image.src,suffix);
    assert.equal(image.hidden,undefined);
  }
  events.get('error')({target:image});
  assert.equal(image.hidden,true);
  assert.equal(image.parent.attrs.class,'player-portrait');
});

for (const type of ['batting','pitching']) {
  test(type+' 선택 조건 전달·검증실·판단·기본 및 최종 인쇄·복귀', () => {
    const {$,prints,events} = boot({search:'?mode='+type+'&year=2024'});
    assert.equal($('open-audit').disabled,true);
    assert.equal($('selection-actions').hidden,true);
    assert.deepEqual($('selection-actions').querySelectorAll('button'),[$('print-report'),$('open-audit')]);
    $('profile').value = 'balanced';
    $('profile').change();
    const first = $('candidates').querySelector('[data-candidate]');
    first.click();
    assert.equal($('selection-actions').hidden,false);
    first.click();
    assert.equal($('selection-actions').hidden,true);
    first.click();
    const selected = $('selected-players').textContent;
    const baseline = $('candidates').querySelector('[data-candidate]').parent.parent.textContent;
    const score = baseline.match(/([0-9]+\.[0-9])점/)[1];
    $('season').value = '2023';
    $('season').change();
    $('candidates').querySelector('[data-candidate]').click();
    $('open-audit').click();
    const output = $('audit-results');
    assert.equal(output.querySelectorAll('article').length,2);
    assert.match(output.textContent,new RegExp('1위 · '+score+'점'));
    assert.match(output.textContent,/2024년.*2023년/s);
    assert.match(output.textContent,/모델 추천 대안/);
    assert.equal($('audit-status-0-0').textContent,'판단 미작성');
    const choice = $('audit-choice-0-0');
    choice.value = '조건부 추천';
    choice.change();
    assert.equal($('audit-print-choice-0-0').textContent,'조건부 추천');
    const ranks = output.querySelector('table').textContent;
    const note = $('audit-note-0-0');
    note.value = '다음 경기 관찰';
    note.oninput();
    assert.equal(output.querySelector('table').textContent,ranks);
    assert.equal($('audit-print-note-0-0').textContent,note.value);
    assert.equal($('audit-status-0-0').textContent,'판단·근거 작성');
    assert.equal($('audit-status-1-0').textContent,'판단 미작성');
    const panels = output.querySelectorAll('details');
    panels[0].open = true;
    events.get('beforeprint')();
    events.get('beforeprint')();
    assert.ok(panels.every(d=>d.open));
    events.get('afterprint')();
    assert.ok(panels[0].open && panels.slice(1).every(d=>!d.open));
    $('print-audit').click();
    $('close-audit').click();
    assert.equal($('decision-audit').hidden,true);
    assert.equal($('season').value,'2023');
    assert.ok($('selected-players').textContent.includes(selected));
    $('print-report').click();
    assert.equal(prints(),2);
    $('open-audit').click();
    assert.equal($('audit-choice-0-0').value,'조건부 추천');
  });
}
