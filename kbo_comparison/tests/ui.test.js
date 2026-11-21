// Lightweight DOM adapter for application event/state checks, not layout/browser validation.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../core.js');
const root=path.join(__dirname,'..');
const decode=s=>String(s).replace(/&(amp|lt|gt|quot|#39);/g,(_,key)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[key]));
class Element {
  constructor(tag,attrs={}) {
    this.tagName=tag;this.attrs=attrs;this.children=[];this.parent=null;this._text='';
    this.checked='checked' in attrs;this.disabled='disabled' in attrs;
    this.selected='selected' in attrs;this.dataset={};
    for(const key of Object.keys(attrs))if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=attrs[key];
    this._value=attrs.value||'';
  }
  get type(){return this.attrs.type||'';}
  get name(){return this.attrs.name||'';}
  get value(){return this.tagName==='select'?(this.options.find(x=>x.selected)||this.options[0])?.value||'':this.tagName==='option'?(this.attrs.value||this.textContent):this._value;}
  set value(value){this._value=String(value);if(this.tagName==='select')for(const option of this.options)option.selected=option.value===String(value);}
  get options(){return this.querySelectorAll('option');}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set textContent(text){this.children=[];this._text=String(text);}
  set innerHTML(html){this.children=[];this._text='';parse(String(html),this);}
  get innerHTML(){return this.textContent;}
  querySelectorAll(selector){return descendants(this).filter(e=>matches(e,selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  scrollIntoView(){}
  click(){if(this.disabled)return;if(this.tagName==='input'&&this.type==='checkbox'){this.checked=!this.checked;this.change();}else if(this.onclick)this.onclick({target:this});}
  change(){for(let node=this;node;node=node.parent)if(node.onchange)node.onchange({target:this});}
}
function descendants(el){return el.children.flatMap(child=>[child,...descendants(child)]);}
function matches(el,selector){
  const tag=selector.match(/^[a-z]+/);if(tag&&el.tagName!==tag[0])return false;
  for(const [,key,value] of selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g))if(!(key in el.attrs)||(value!==undefined&&el.attrs[key]!==value))return false;
  if(selector.includes(':checked')&&!el.checked)return false;
  return true;
}
function parse(html,parent){
  const stack=[parent],voids=new Set(['input','meta','link','br','hr','img']);
  for(const token of html.match(/<[^>]+>|[^<]+/g)||[]) {
    if(token.startsWith('</')){const tag=token.slice(2).replace('>','').trim();let i=stack.length-1;while(i>0&&stack[i].tagName!==tag)i--;if(i>0)stack.length=i;continue;}
    if(token.startsWith('<!'))continue;
    if(token.startsWith('<')){
      const m=token.match(/^<([a-z][a-z0-9-]*)/i);if(!m)continue;
      const tag=m[1].toLowerCase(),attrs={};
      const raw=token.slice(m[0].length,-1);
      for(const [,key,double,single,plain] of raw.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))attrs[key]=decode(double??single??plain??'');
      const el=new Element(tag,attrs);el.parent=stack.at(-1);el.parent.children.push(el);
      if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(el);
    }else stack.at(-1)._text+=decode(token);
  }
}
async function app(locationOverrides={}){
  const doc=new Element('document');parse(fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,''),doc);
  doc.getElementById=id=>descendants(doc).find(e=>e.attrs.id===id)||null;
  doc.createElement=tag=>new Element(tag);
  const errors=[],downloads=[];
  const data=JSON.parse(fs.readFileSync(path.join(root,'sample_data.json'),'utf8'));
  const context={URLSearchParams,document:doc,location:{protocol:'file:',...locationOverrides},battingData:data,battingMetadata:{},KBOCore:C,
    console:{error:e=>errors.push(e)},setTimeout:()=>0,URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:test';},revokeObjectURL(){}},Blob};
  vm.runInNewContext(fs.readFileSync(path.join(root,'scouting-entry.js'),'utf8'),context);
  vm.runInNewContext(fs.readFileSync(path.join(root,'repository.js'),'utf8'),context);
  await vm.runInNewContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context);
  await Promise.resolve();assert.deepEqual(errors,[],'application initialization');
  return {doc,data,$:id=>doc.getElementById(id),errors,downloads};
}
function addDirect(env,name,end){
  const player=env.data.find(row=>row.Player===name);assert.ok(player);
  env.$('player').value=player.Id;env.$('player').change();env.$('season').value=String(end);env.$('add-direct-target').click();
}
const comparisonRows=env=>env.$('comparison').querySelectorAll('tbody')[0]?.querySelectorAll('tr').length||0;

test('이름 일부 입력 후 후보를 선택하면 해당 선수의 시즌 선택이 열림',async()=>{
 const env=await app();
 env.$('search').value='강';env.$('search').oninput();
 assert.equal(env.$('name-suggestions').hidden,false);
 const minho=env.data.find(r=>r.Player==='강민호');
 const pick=env.doc.querySelectorAll('[data-name-pick]').find(b=>b.dataset.namePick===String(minho.Id));
 assert.ok(pick);pick.click();
 assert.equal(env.$('player').value,String(minho.Id));
 assert.equal(env.$('name-suggestions').hidden,true);
 assert.equal(env.$('direct-selection').hidden,false);
 assert.ok(env.$('season').options.length>1);
 env.$('season').value='2024';env.$('add-direct-target').click();
 assert.equal(env.doc.querySelectorAll('[data-target-remove]').length,1);
 env.$('search').value='존재하지않는선수';env.$('search').oninput();
 assert.match(env.$('name-suggestions').textContent,/없음/);
 assert.equal(env.$('direct-selection').hidden,true);
});

test('UI 초기화, 대상 두 명 단일 시즌 CSV, 다른 시즌으로 변경',async()=>{
  const env=await app();assert.equal(env.doc.querySelectorAll('[data-add-target]').length,10);
  addDirect(env,'박병호',2022);assert.equal(env.doc.querySelectorAll('[data-rec-id]').length,12);
  addDirect(env,'이정후',2022);assert.equal(env.doc.querySelectorAll('[data-rec-id]').length,10);
  assert.equal(comparisonRows(env),2);assert.equal(env.$('download').disabled,false);
  env.$('download').click();const csv=await env.downloads.at(-1).text();assert.match(csv,/박병호/);assert.match(csv,/이정후/);assert.match(csv,/\"박병호\",\"2022\"/);assert.doesNotMatch(csv,/2020, 2021, 2022/);
  addDirect(env,'이정후',2017);assert.match(env.$('target-message').textContent,/시즌 변경/);assert.equal(env.doc.querySelectorAll('[data-target-year]').find(x=>x.dataset.targetYear==='67341').value,'2017');
  assert.equal(env.doc.querySelectorAll('[data-target-remove]').length,2);assert.equal(comparisonRows(env),2);
});

test('추천 기준 시즌을 바꾸면 해당 연도 기록을 기준으로 후보가 다시 계산됨',async()=>{
  const env=await app();addDirect(env,'박병호',2022);
  const year=env.$('recommend-year');
  for(const selected of [2024,2022]){
    year.value=String(selected);year.change();
    const candidates=env.doc.querySelectorAll('[data-rec-id]');
    assert.ok(candidates.length>0,`${selected}년 후보 표시`);
    assert.ok(candidates.every(item=>Number(item.dataset.recEnd)===selected),`${selected}년 기록만 표시`);
  }
});

test('대상 추가를 다시 누르면 선택 취소되고 기존 제거 버튼도 동작함',async()=>{
  const env=await app();addDirect(env,'박병호',2022);
  assert.equal(env.doc.querySelectorAll('[data-target-remove]').length,1);
  env.$('add-direct-target').click();
  assert.equal(env.doc.querySelectorAll('[data-target-remove]').length,0);
  assert.match(env.$('target-message').textContent,/취소/);
  addDirect(env,'박병호',2022);env.doc.querySelectorAll('[data-target-remove]')[0].click();
  assert.equal(env.doc.querySelectorAll('[data-target-remove]').length,0);
});

test('UI 추천/검색 중복 방지, 대상 추가와 필터 초기화 시 비교 선택 유지',async()=>{
  const env=await app();addDirect(env,'박병호',2022);
  const option=env.doc.querySelectorAll('[data-rec-id]')[0],id=option.dataset.recId,end=+option.dataset.recEnd;
  option.click();assert.equal(comparisonRows(env),2);
  // Manual add uses the selected recommendation season.
  const latest=+env.$('recommend-year').value;
  const season=env.doc.querySelectorAll('[data-compare-key]')[0];season.value=String(latest);season.change();
  env.$('compare-player').value=id;env.$('add-player').click();
  assert.match(env.$('compare-message').textContent,/이미 선택/);assert.equal(comparisonRows(env),2);
  addDirect(env,'이정후',2022);assert.equal(comparisonRows(env),3);
  env.$('reset-filters').click();assert.equal(comparisonRows(env),3);assert.equal(env.doc.querySelectorAll('[data-target-remove]').length,2);
});

test('UI 연도별 최고, 조건 배지 해제, 비중 전체 0 거부',async()=>{
  const env=await app();
  const year=env.doc.querySelectorAll('input[name="browse-year"]').find(e=>e.value==='2022');year.click();
  env.$('leader-scope').value='year';env.$('leader-scope').change();
  assert.match(env.$('qualification-info').textContent,/연도별/);
  assert.ok(env.doc.querySelectorAll('[data-chip]').some(e=>e.textContent.includes('2022')));
  const chip=env.doc.querySelectorAll('[data-chip]').find(e=>e.textContent.includes('2022'));chip.click();
  assert.equal(year.checked,false);
  addDirect(env,'박병호',2022);const count=env.doc.querySelectorAll('[data-rec-id]').length;
  env.doc.querySelectorAll('[data-weight]').forEach(input=>input.value='0');
  env.$('weight-form').onsubmit({preventDefault(){}});assert.match(env.$('weight-message').textContent,/하나 이상/);
  assert.equal(env.doc.querySelectorAll('[data-rec-id]').length,count);
});

test('기록 화면은 대상·비교 선택 후 통합 스카우팅 진입만 표시',async()=>{
 const env=await app();assert.equal(env.$('scouting-results').querySelectorAll('a').length,0);
 addDirect(env,'이정후',2022);assert.equal(env.$('scouting-results').querySelectorAll('a').length,1);
 const rec=env.doc.querySelectorAll('[data-rec-id]')[0];rec.click();
 const link=env.$('scouting-results').querySelectorAll('a')[0];assert.ok(link);
 const params=new URL(link.attrs.href,'https://local/').searchParams;assert.equal(params.getAll('selection').length,2);assert.ok(params.getAll('selection').includes(`${rec.dataset.recId}|${rec.dataset.recEnd}`));
 assert.equal(env.$('scouting-results').querySelectorAll('table').length,0);
 env.doc.querySelectorAll('[data-compare-remove]')[0].click();assert.equal(env.$('scouting-results').querySelectorAll('a').length,1);
 env.doc.querySelectorAll('[data-target-remove]')[0].click();assert.equal(env.$('scouting-results').hidden,true);
});
test('좌·중·우익수 필터와 비교 직접 추가에 선택한 연도 적용',async()=>{
 const e=await app();addDirect(e,'박병호',2024);
 const lf=e.doc.querySelectorAll('input[name="compare-position"]').find(x=>x.value==='LF');assert.ok(lf);lf.click();
 const candidates=e.doc.querySelectorAll('[data-rec-id]');assert.ok(candidates.length>0);
 for(const c of candidates){const row=e.data.find(r=>r.Id===c.dataset.recId&&r.Season===c.dataset.recEnd);assert.ok(C.matchesPosition(C.positionCode(row),'LF'));}
 assert.match(e.$('recommendations').textContent,/좌익수/);
 const koo=e.data.find(r=>r.Player==='구자욱');e.$('compare-player').value=koo.Id;e.$('add-player').click();
 assert.equal(e.doc.querySelectorAll('[data-compare-key]')[0].value,'2024');
 e.$('recommend-year').value='2022';e.$('recommend-year').change();
 assert.equal(e.doc.querySelectorAll('[data-rec-id]').length,0);
 assert.equal(e.$('compare-player').options.length,1);
});
test('외야수는 좌·중·우를 함께 선택·해제하고 개별 선택 및 조건 배지도 동기화',async()=>{
 const e=await app();
 for(const name of ['browse-position','compare-position']){
  const inputs=e.doc.querySelectorAll(`input[name="${name}"]`),get=v=>inputs.find(x=>x.value===v);
  get('OF').click();
  for(const v of ['OF','LF','CF','RF'])assert.equal(get(v).checked,true);
  assert.equal(get('전체').checked,false);
  get('CF').click();assert.equal(get('OF').checked,false);assert.equal(get('LF').checked,true);assert.equal(get('RF').checked,true);
  get('CF').click();assert.equal(get('OF').checked,true);
  get('C').click();get('OF').click();
  for(const v of ['OF','LF','CF','RF'])assert.equal(get(v).checked,false);
  assert.equal(get('C').checked,true);
  get('전체').click();get('OF').click();get('OF').click();assert.equal(get('전체').checked,true);
 }
 const of=e.doc.querySelectorAll('input[name="browse-position"]').find(x=>x.value==='OF');of.click();
 const chip=e.doc.querySelectorAll('[data-chip]').find(x=>x.textContent.includes('포지션: 중견수'));chip.click();
 assert.equal(of.checked,false);
 const remaining=e.doc.querySelectorAll('input[name="browse-position"]:checked').map(x=>x.value);assert.deepEqual(remaining,['LF','RF']);
 of.click();e.doc.querySelectorAll('[data-chip]').find(x=>x.textContent.includes('포지션: 외야수')).click();
 assert.deepEqual(e.doc.querySelectorAll('input[name="browse-position"]:checked').map(x=>x.value),['전체']);
});


test('스카우팅 검토 후보를 기록 비교로 가져와 CSV 생성',async()=>{
  const env=await app({hash:'#final-comparison',search:'?selection=67341%7C2022&selection=75125%7C2022'});
  assert.equal(comparisonRows(env),2);
  assert.equal(env.$('download').disabled,false);
  env.$('download').click();
  const csv=await env.downloads.at(-1).text();
  assert.match(csv,/"이정후","2022"/);
  const second=env.data.find(row=>row.Id==='75125' && row.Season==='2022');
  assert.ok(csv.includes(`"${second.Player}","2022"`));
});

test('이름으로 선수 검색에서 한글 초성으로 선수를 찾을 수 있음',async()=>{
 const env=await app();
 env.$('search').value='ㅇㅈㅎ';
 env.$('search').oninput();
 const name=env.doc.querySelectorAll('[data-name-pick]').find(b=>b.dataset.namePick==='67341');
 assert.ok(name);
 assert.match(name.textContent,/이정후/);
});

test('도루 성공률 내림차순에서 공동 100%는 도루 성공 횟수가 많은 순서로 표시',async()=>{
  const env=await app();
  env.$('browse-all-years').click();
  env.doc.querySelector('[data-browse-sort="도루성공%"]').click();
  const results=env.doc.querySelectorAll('[data-add-target]').map(button=>{
    const row=env.data.find(row=>String(row.Id)===button.dataset.addTarget&&String(row.Season)===button.dataset.addYear);
    return C.stats([row]);
  });
  assert.equal(results.length,10);
  assert.ok(results.every(stats=>stats['도루성공%']===100));
  const steals=results.map(stats=>stats['도루']);
  assert.ok(steals[0]>steals.at(-1));
  assert.deepEqual(steals,[...steals].sort((a,b)=>b-a));
});
