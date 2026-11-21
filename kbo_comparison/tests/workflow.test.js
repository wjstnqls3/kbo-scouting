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

function boot({search='?year=2024', hash='', storage=new Map()} = {}) {
  const document = new Element('document');
  parse(source('index.html').replace(/<script[\s\S]*?<\/script>/g, ''), document);
  const $ = id => descendants(document).find(element=>element.attrs.id===id);
  document.getElementById = $;
  const errors = [], events = new Map();
  let prints = 0;
  const location = {search, hash};
  const context = vm.createContext({
    document, location, URLSearchParams,
    window: {addEventListener:(name,handler)=>events.set(name,handler), print:()=>prints++},
    localStorage: {getItem:key=>storage.get(key), setItem:(key,value)=>storage.set(key,value)},
    console: {error:error=>errors.push(error)},
  });
  const scripts = [...source('index.html').matchAll(/<script defer src="([^"]+)"/g)].map(([,name])=>name);
  for (const file of scripts) vm.runInContext(source(file),context);
  assert.deepEqual(errors, []);
  return {$, storage, prints:()=>prints, events};
}

test('후보 기준과 순위가 기존 계산과 일치하고 한 명부터 최대 세 명까지 평가할 수 있다', () => {
  const app = boot(), {$} = app;
  const expected = P.evaluate(P.poolFor(A.create(records),2024,'',200),P.presets.onbase);
  const candidates = $('candidates').querySelectorAll('[data-candidate]');
  assert.deepEqual(candidates.map(input=>input.dataset.candidate),
    expected.slice(0,15).map(({row})=>`${row.id}|${row.year}`));
  assert.match($('candidate-method').textContent,/유효 .*명/);
  assert.equal($('dashboard').hidden,false);
  assert.equal(candidates[0].checked,true);
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
  assert.equal(report.querySelector('[data-analysis="trend"]').hidden,false);
  assert.equal(report.querySelector('[data-analysis="overview"]').hidden,true);
  candidates[2].click();
  assert.equal(report.querySelectorAll('article').length,2);
  assert.equal(report.querySelector('[data-analysis="trend"]').hidden,false);
  assert.match(report.textContent,/포지션 비교군.*최근 3시즌.*유사 선수.*현장 확인/s);
  assert.match(report.textContent,/2022.*2023.*2024/s);
  assert.doesNotMatch(report.textContent,/2021년/);
  $('player-search').value='ㄱㅈㅊ';
  $('player-search').oninput();
  const results=$('candidates').querySelectorAll('[data-candidate]');
  const target=results.find(input=>input.attrs['aria-label'].includes('김지찬'));
  assert.ok(target);
  target.click();
  assert.equal($('report-content').querySelectorAll('article').length,3);
  assert.match($('radar-content').textContent,/김지찬/);
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
