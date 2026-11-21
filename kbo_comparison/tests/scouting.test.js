const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../scouting.js');
const row=(id,year,extra={})=>({Id:id,Player:'같은 이름',Season:year,Age:25,Team:'KT',Position:'1B',G:100,PA:400,AB:350,H:100,HR:20,TB:160,BB:40,HBP:5,SF:5,SO:80,...extra});
test('동명이인을 ID로 구분하고 같은 시즌·나이와 200타석 기준을 적용',()=>{
 const data=[row('a',2022),row('b',2022,{Team:'LG'}),row('c',2022,{PA:199}),row('d',2022,{Age:26}),row('e',2021)];
 const a=S.create(data).analyze('a',2022);
 assert.deepEqual(a.peers.map(x=>x.id),['b']);assert.deepEqual(a.similar.map(x=>x.id),['b','d']);assert.equal(a.similar[0].distance,0);
});
test('리그 비율은 선수별 평균이 아닌 원자료 합산이고 시즌별로 보정',()=>{
 const rows=[row('a',2021),row('a',2022,{Team:'LG',H:150}),row('b',2021,{H:70}),row('b',2022,{H:80})];
 const a=S.create(rows).analyze('a',2022), league=S.calculate(rows.filter(r=>r.Season===2022));
 assert.equal(a.selected.index,100*a.selected.stats.ops/league.ops);assert.deepEqual(a.trend.map(x=>x.teams),['KT','LG']);
 assert.equal(a.trend[0].index,100*a.trend[0].stats.ops/S.calculate(rows.filter(r=>r.Season===2021)).ops);
});
test('출전하지 않은 해 건너뛰고 소타석 대상의 유사 유형 생략',()=>{
 const a=S.create([row('a',2018),row('a',2020),row('a',2022,{PA:100}),row('b',2022)]).analyze('a',2022);
 assert.deepEqual(a.trend.map(x=>x.year),[2018,2020,2022]);assert.deepEqual(a.similar,[]);
});

test('참고 등급 S~E 경계 및 타석 수 미확인 시 판정 보류',()=>{
 for(const [index,grade] of [[140,'S'],[120,'A'],[110,'B'],[95,'C'],[85,'D'],[84.9,'E']])assert.equal(S.grade(index,200),grade);
 for(const pa of [199,NaN,null,undefined])assert.equal(S.grade(140,pa),null);
 assert.equal(S.grade(null,500),null);
});
