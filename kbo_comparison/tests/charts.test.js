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

test('성장 추세는 결측 시즌의 선을 끊고 실제 0과 소표본을 표시한다',()=>{
 const root=new Element('div');
 parse(context.KBOCharts.seasonTrend([
  {name:'선수 A',points:[{year:2022,value:0,sample:'200타석'},{year:2023,value:null},{year:2024,value:.2,sample:'14타석',lowSample:true}]},
  {name:'선수 B',points:[{year:2023,value:.1,sample:'4이닝',lowSample:true},{year:2024,value:.2,sample:'55이닝'}]},
 ],'BB%',value=>(100*value).toFixed(2)+'%'),root);
 const segments=root.querySelectorAll('line').filter(node=>node.attrs.class==='trend-segment');
 assert.equal(segments.length,1);
 assert.equal(segments[0].attrs['stroke-dasharray'],'5 4');
 assert.equal(root.querySelectorAll('circle').length,4);
 assert.equal(root.querySelectorAll('circle').filter(node=>node.attrs.fill==='white').length,2);
 assert.match(root.textContent,/0\.00%.*200타석|200타석.*0\.00%/s);
 assert.match(root.textContent,/14타석 · 소표본/);
});
