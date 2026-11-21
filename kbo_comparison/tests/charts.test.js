const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {Element,parse}=require('./dom-fixture');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../charts.js'),'utf8'),context);
function radar(values){const root=new Element('div');parse(context.KBOCharts.radar(['OBP 출루율','K% 삼진율','ISO 순장타율','BB% 볼넷률','OPS 출루율+장타율','HR% 홈런율'],[{name:'선수',values}]),root);return root;}
test('6각형은 결측에도 외곽·축 유지, 실제 0점과 부분 결측은 구별',()=>{
 const empty=radar([null,null,null,null,null,null]);
 assert.equal(empty.querySelectorAll('polygon').length,4);assert.equal(empty.querySelectorAll('line').length,6);assert.match(empty.textContent,/6각형 점수 없음/);
 const zero=radar([0,0,0,0,0,0]);assert.equal(zero.querySelectorAll('circle').length,6);assert.equal(zero.querySelectorAll('polygon').length,5);assert.doesNotMatch(zero.textContent,/점수 없음/);
 const partial=radar([10,20,null,30,null,50]);assert.equal(partial.querySelectorAll('circle').length,4);assert.equal(partial.querySelectorAll('polygon').length,4);assert.match(partial.textContent,/일부 축 계산 불가/);
 assert.equal(partial.querySelector('svg').attrs.viewBox,'0 0 480 390');
});
