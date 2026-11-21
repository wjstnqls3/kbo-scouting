/* Verified season-specific outfield positions. Original batting CSV stays unchanged. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.KBOPositionData=factory();})(globalThis,function(){
 'use strict';
 const sources={
  2023:'https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=9884',
  2024:'https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=10311',
  2025:'https://www.koreabaseball.com/Player/Awards/DefensePrize.aspx'
 };
 // KBO defense-award position, not a claim that the player played only this position.
 const entries=[
  ['53827',2023,'에레디아','SSG','LF'],['68119',2023,'문성주','LG','LF'],['51463',2023,'피렐라','삼성','LF'],
  ['62415',2023,'박해민','LG','CF'],['79231',2023,'정수빈','두산','CF'],['64166',2023,'배정대','KT','CF'],['52630',2023,'소크라테스','KIA','CF'],
  ['66108',2023,'홍창기','LG','RF'],['79215',2023,'박건우','NC','RF'],['52591',2023,'윤동희','롯데','RF'],
  ['53827',2024,'에레디아','SSG','LF'],['62404',2024,'구자욱','삼성','LF'],['66209',2024,'조수행','두산','LF'],
  ['79231',2024,'정수빈','두산','CF'],['62415',2024,'박해민','LG','CF'],['50854',2024,'최지훈','SSG','CF'],
  ['66108',2024,'홍창기','LG','RF'],['67025',2024,'로하스','KT','RF'],['50167',2024,'이주형','키움','RF'],
  ['53827',2025,'에레디아','SSG','LF'],['62415',2025,'박해민','LG','CF'],['67449',2025,'김성윤','삼성','RF']
 ].map(([id,year,name,team,position])=>Object.freeze({id,year,name,team,position,source:sources[year],basis:'KBO 해당 시즌 수비상 부문',checkedAt:'2026-11-17'}));
 entries.push(Object.freeze({id:'61404',year:2024,name:'김헌곤',team:'삼성',position:'LF/CF/RF',source:'https://v.daum.net/v/20241127100547765',basis:'스포탈코리아 2024-11-27 · 시즌 수비이닝: LF 305 / CF 16 / RF 300⅓',checkedAt:'2026-11-17'}));
 const bySeason=new Map(entries.map(x=>[`${x.id}|${x.year}`,x]));
 function lookup(row){
  const found=bySeason.get(`${row.Id}|${Number(row.Season)}`);
  return row.Position==='OF'&&found&&row.Player===found.name&&row.Team===found.team?found:null;
 }
 return {entries:Object.freeze(entries),lookup};
});
