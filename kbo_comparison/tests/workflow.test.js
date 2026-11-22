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

test('시작 화면에 일반 스카우팅과 타임머신 진입을 묶고 투수 후보·레이더·추세·리포트를 사용한다', () => {
  const {$:start} = boot({search:''});
  assert.equal(start('start-screen').hidden,false);
  const groupLinks = id => start(id).parent.querySelectorAll('a').map(link=>link.attrs.href);
  assert.deepEqual(groupLinks('standard-scouting-title'),['?mode=pitching','?mode=batting']);
  assert.deepEqual(groupLinks('time-machine-scouting-title'),['?mode=time-machine']);

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

for (const type of ['batting', 'pitching']) {
  test(`타임머신 ${type}: 선수 선택 후에도 익명을 유지하고 공개 버튼으로만 실명과 후속 기록을 표시한다`, () => {
    const {$} = boot({search:'?mode=time-machine', random:()=>0});
    assert.equal($('time-machine').hidden,false);
    assert.ok('hidden' in $('dashboard-main').attrs);
    $('tm-type').value = type;
    $('tm-type').change();
    assert.equal($('tm-year').value,'2020');
    assert.equal($('tm-year').options[0].value,'2025');
    $('tm-form').onsubmit({preventDefault(){}});
    const panel = $('tm-panel');
    const content = $('tm-content');
    assert.equal(panel.attrs['data-stage'],'2');
    assert.equal(content.querySelectorAll('img').length,0);
    assert.equal(content.querySelectorAll('[data-pick]').length,3);
    assert.equal($('tm-next').hidden,true);
    $('tm-next').click();
    assert.equal(panel.attrs['data-stage'],'2');
    assert.doesNotMatch(content.textContent,/202[1-3]|모델 추천/);
    const selected = type === 'pitching' ? 'C' : 'B';
    content.querySelector(`[data-pick="${selected}"]`).click();
    assert.equal(panel.attrs['data-stage'],'3');
    assert.equal(content.querySelectorAll('img').length,0);
    assert.equal(content.querySelector('strong').textContent,selected);
    assert.match(content.textContent,/내 선택.*모델 추천.*상대 강점.*상대 약점/s);
    assert.doesNotMatch(content.textContent,/202[1-3]년/);
    $('tm-next').click();
    assert.equal(panel.attrs['data-stage'],'4');
    assert.equal(content.querySelectorAll('svg').length,1);
    assert.equal(content.querySelector('span[data-picked]').textContent,`내 선택 ${selected}`);
    assert.equal(content.querySelector('span[data-recommended]').textContent,'모델 추천 C');
    assert.match(content.textContent,/2021년.*2022년.*2023년/s);
    const playerHeaders = content.querySelectorAll('th[scope="col"]').slice(1);
    assert.ok(playerHeaders.every(header=>/\/2020\/\d{5}\.jpg$/.test(header.querySelector('img')?.attrs.src)));
    const names = playerHeaders.map(el=>el.textContent.match(/^[ABC] · (.+?)$/)?.[1]);
    assert.ok(names.every(Boolean));
    const table = content.querySelector('table');
    const pickedHeader = table.querySelector('th[data-picked]');
    const recommendedHeader = table.querySelector('th[data-recommended]');
    assert.ok(pickedHeader.textContent.startsWith(selected + ' ·'));
    assert.ok(recommendedHeader.textContent.startsWith('C ·'));
    assert.match(pickedHeader.textContent,/내 선택/);
    assert.match(recommendedHeader.textContent,/모델 추천/);
    assert.equal(pickedHeader === recommendedHeader,selected === 'C');
    for (const row of table.querySelector('tbody').querySelectorAll('tr')) {
      const cells = row.querySelectorAll('td');
      assert.equal(row.querySelector('td[data-picked]'),cells[playerHeaders.indexOf(pickedHeader)]);
      assert.equal(row.querySelector('td[data-recommended]'),cells[playerHeaders.indexOf(recommendedHeader)]);
    }
    if (type === 'pitching') assert.match(content.textContent,/ERA.*K-BB%/s);
    $('tm-next').click();
    assert.equal(content.querySelectorAll('img').length,4);
    assert.match(content.querySelector('li[data-picked]').textContent,/내가 선택한 선수/);
    assert.match(content.querySelector('li[data-recommended]').textContent,/당시 모델 추천/);
    assert.match(content.textContent,/스카우팅에서 확인할 요소.*출전 기회와 표본 규모/s);
    $('tm-reset').click();
    assert.equal(content.textContent,'');
    assert.equal(panel.attrs['data-stage'],'1');
  });
}
