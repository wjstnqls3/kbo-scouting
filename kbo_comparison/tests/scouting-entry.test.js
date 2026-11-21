const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element,descendants}=require('./dom-fixture');
test('1명 선택 시 진입 링크, 비교 선수 변경·제거 시 즉시 반영',()=>{
 const panel=new Element('div');const context={document:{getElementById:()=>panel},URLSearchParams};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../scouting-entry.js'),'utf8'),context);
 const render=context.createScoutingView([{Id:'a',Player:'대상'},{Id:'b',Player:'비교'}]),targets=new Map([['a',{id:'a',end:2022}]]),chosen=new Map();
 render(new Map(),chosen);assert.equal(panel.hidden,true);
 render(targets,chosen);assert.equal(panel.hidden,false);assert.equal(panel.querySelectorAll('a').length,1);
 chosen.set('b|2020',{id:'b',end:2020});render(targets,chosen);
 let a=panel.querySelectorAll('a')[0],params=new URL(a.attrs.href,'https://local/').searchParams;assert.deepEqual(params.getAll('selection'),['a|2022','b|2020']);
 chosen.clear();render(targets,chosen);assert.equal(panel.querySelectorAll('a').length,1);
 targets.set('b',{id:'b',end:2021});render(targets,chosen);assert.equal(panel.querySelectorAll('a').length,1);
});

test('4명까지 링크 표시, 초과 시 안내, 모든 대상 제거 시 숨김',()=>{
 const panel=new Element('div'),context={document:{getElementById:()=>panel},URLSearchParams};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../scouting-entry.js'),'utf8'),context);
 const render=context.createScoutingView([]),targets=new Map([['a',{id:'a',end:2024}]]),chosen=new Map();
 for(const id of ['b','c','d'])chosen.set(id,{id,end:2024});render(targets,chosen);assert.equal(panel.querySelectorAll('a').length,1);
 chosen.set('e',{id:'e',end:2024});render(targets,chosen);assert.equal(panel.querySelectorAll('a').length,0);assert.match(panel.textContent,/최대 4명/);
 targets.clear();render(targets,chosen);assert.equal(panel.hidden,true);assert.equal(panel.textContent,'');
});
