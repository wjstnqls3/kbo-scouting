const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {Element,parse,descendants} = require('./dom-fixture');
const A = require('../analytics');
const C = require('../core');
const P = require('../portfolio-model');
const records = require('../sample_data.json');

test('낮은 K%, 0과 결측, 동률, 유효 표본 수', () => {
  const pool = [0,0,.15,.2,.25,null].map((k,i)=>({
    id:String(i),name:String(i),stats:{k,pa:200+i}
  }));
  const entries = P.evaluate(pool,A.fitPresets.strikeout);
  assert.deepEqual(entries.map(e=>e.rank),[1,1,3,4,5,undefined]);
  assert.equal(entries[0].row.id,'1');
  assert.equal(entries[0].value,80);
  assert.equal(entries.at(-1).value,null);
  assert.ok(P.evaluate(pool.slice(2),A.fitPresets.strikeout).every(e=>e.value===null));
  assert.deepEqual(P.evaluate([],P.presets.onbase),[]);
});

test('포지션 미확인, 공통 표본, ID 기반 추이와 출생 정보 충돌', () => {
  const original = records.find(r=>r.Id==='67341' && r.Season==='2022');
  const missingPosition = {...original,Id:'synthetic',Position:''};
  const engine = A.create([...records,missingPosition]);
  const target = engine.lookup.get('67341|2022');
  const pool = P.poolFor(engine,2022,'',200);
  assert.ok(pool.some(r=>r.id==='synthetic'));
  assert.ok(!P.poolFor(engine,2022,'CF',200).some(r=>r.id==='synthetic'));
  assert.deepEqual(P.poolFor(engine,2022,'',9999),[]);
  const result = P.sensitivity(pool,P.presets.onbase,P.presets.power);
  assert.ok(result.length>=5);
  assert.ok(result.every(e=>e.before.row.id===e.after.row.id && Number.isFinite(e.after.value)));
  const history = P.timeline(engine,records,target);
  assert.deepEqual(history.map(r=>r.year),[2018,2019,2020,2021,2022]);
  assert.ok(history.every(r=>r.row.id==='67341'));
  assert.equal(P.timeline(engine,[...records,{...original,Born:'1900-01-01'}],target),null);
  const sparseRecords = [original,{...original,Season:'2020',PA:'0'},
    {...original,Id:'another-player',Season:'2019'}];
  const sparse = P.timeline(A.create(sparseRecords),sparseRecords,target);
  assert.equal(sparse.find(item=>item.year===2020).rawPA,0);
  assert.equal(sparse.find(item=>item.year===2019).hasRaw,false);
  assert.equal(sparse.at(-1).row.id,target.id);
});

test('탐색 → 후보 선택 → 기존 화면 연결 → 메모 저장 및 재진입 → 인쇄 명령', async () => {
  const file = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
  const store = new Map();
  let prints = 0;
  async function open() {
    const document = new Element('document');
    parse(file('scouting-portfolio.html').replace(/<script[\s\S]*?<\/script>/g,''),document);
    const $ = id => descendants(document).find(e=>e.attrs.id===id);
    document.getElementById = $;
    const getNumeric = Object.getOwnPropertyDescriptor(Element.prototype,'valueAsNumber');
    if (!getNumeric) Object.defineProperty(Element.prototype,'valueAsNumber',{get(){return this.value===''?NaN:Number(this.value);}});
    const errors = [];
    await vm.runInNewContext(file('portfolio.js'),{
      document,KBOAnalytics:A,KBOCore:C,KBOPortfolio:P,URLSearchParams,
      KBORepository:{load:async()=>({records,metadata:{}})},
      localStorage:{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)},
      window:{print:()=>prints++},console:{error:error=>errors.push(error)}
    });
    assert.deepEqual(errors,[]);
    return $;
  }
  function select($) {
    $('season').value='2024';
    $('search-criteria').onsubmit({preventDefault(){}});
    const options = $('candidate-table').querySelectorAll('[data-candidate]');
    assert.equal(options.length,15);
    options[0].click();
    options[1].click();
    assert.equal($('portfolio-report').hidden,false);
    assert.match($('report-content').textContent,/선정 근거.*리그 대비 OPS/s);
    assert.match($('open-comparison').href,/index.html\?.*selection=.*#final-comparison/);
    assert.equal(new URLSearchParams($('open-lab').href.split('?')[1]).getAll('selection').length,2);
    return options;
  }
  const $ = await open();
  const options = select($);
  options[2].click();
  options[3].click();
  assert.equal(options[3].checked,false);
  $('test-weights').click();
  assert.match($('sensitivity-output').textContent,/공통 비교군/);
  const input = $('report-content').querySelector('textarea');
  input.value='타석별 접근을 영상으로 확인 <관찰>';
  $('report-content').oninput({target:input});
  assert.match($('report-content').querySelector('[data-memo-status]').textContent,/자동 저장했습니다/);
  $('print-report').click();
  assert.equal(prints,1);
  assert.match($('report-content').querySelector('[data-memo]').textContent,/관찰/);
  const reopened = await open();
  select(reopened);
  assert.match(reopened('report-content').querySelector('textarea').textContent,/관찰/);
  reopened('minimum').value=9999;
  reopened('search-criteria').onsubmit({preventDefault(){}});
  assert.match(reopened('candidate-table').textContent,/충족한 기록이 없습니다/);
  assert.equal(reopened('portfolio-report').hidden,true);
});
