(async function(){
'use strict';
const $=id=>document.getElementById(id),A=KBOAnalytics,V=KBOCharts,esc=V.esc;
const fmt=(v,n=3)=>Number.isFinite(v)?v.toFixed(n):'—';
const positions=KBOCore.positionNames;
const fitAxes=A.comparisonAxes;
const fitPresets=A.comparisonFitPresets;
const zeroGuide=`<div class="zero-guide">
  <p><strong>실제 기록 0</strong> 계산 기준이 되는 기회는 있었지만, 해당 결과는 0건입니다. 삼진율 0%는 삼진 0건, 출루율 0.000은 안타·볼넷·몸에 맞는 공 0건을 뜻합니다.</p>
  <p><strong>백분위 0점</strong> 비교군의 유효 기록이 모두 해당 선수보다 유리했다는 뜻입니다. K% 백분위 0점은 비교군보다 삼진율이 높았다는 의미입니다.</p>
  <p><strong>— 또는 미산출</strong> 분모가 0이거나 기록 결측·표본 부족 등으로 계산할 수 없습니다.</p>
</div>`;
const table=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const label=r=>`${r.name} · ${r.team} · ${r.year}`;
const positionLabel=r=>KBOCore.positionText(r.position,true);
const similarLabel=r=>`${label(r)} · ${positionLabel(r)}`;
// Apply the existing club palette to the recorded season's team.
// Unknown or combined teams use a neutral tint instead of guessing a club.
function clubStyle(team){
 const color=KBOCore.teamColors[KBOCore.teamId(team)]||'#526b60';
 const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
 const tint=amount=>'#'+rgb.map(c=>Math.round(255*(1-amount)+c*amount).toString(16).padStart(2,'0')).join('');
 return `style="--scout-club-color:${color};--scout-club-soft:${tint(KBOCore.teamId(team)==='KIA / 해태'?.24:.12)};--scout-club-badge:${tint(.24)};--scout-club-line:${tint(.5)}"`;
}
const teamText=team=>`<span class="team-name" ${clubStyle(team)}>${esc(team)}</span>`;
const playerHeading=r=>`${esc(r.name)} · ${teamText(r.team)} · ${r.year}`;
const option=(v,t)=>`<option value="${esc(v)}">${esc(t)}</option>`;
const tip=$('chart-tooltip');
function showTip(el){if(!el)return;tip.textContent=el.dataset.tip;tip.hidden=false;}
document.addEventListener('pointerover',e=>showTip(e.target.closest('[data-tip]')));
document.addEventListener('focusin',e=>showTip(e.target.closest('[data-tip]')));
document.addEventListener('click',e=>{const el=e.target.closest('[data-tip]');if(el)showTip(el);else tip.hidden=true;});
document.addEventListener('pointerout',e=>{if(e.target.closest('[data-tip]'))tip.hidden=true;});
document.addEventListener('focusout',()=>tip.hidden=true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')tip.hidden=true;});
try{
 const {records,metadata}=await KBORepository.load(),engine=A.create(records,{qualifiedBaseline:true}),years=[...engine.byYear.keys()].sort((a,b)=>b-a);
 if(!years.length)throw Error('분석 가능 기록 없음');
 const seasonStatus=y=>metadata.season_status?.[String(y)]||'미확인';
 const rulesURL='https://6ptotvmi5753.edge.naverncp.com/KBO_FILE/ebook/pdf/2025_%EC%95%BC%EA%B5%AC%EA%B7%9C%EC%B9%99.pdf#page=191';
 const paReference=r=>{const q=engine.league.get(r.year).qualifyingPA;return `${r.year}년 규정 ${q.minimum}타석 이상 · 충족 ${q.count}명 평균 ${fmt(q.average,1)}타석`;};
 $('status').textContent=`${Math.min(...years)}–${Math.max(...years)} KBO 타격 기록`;
 $('audit').innerHTML=`<p><strong>${engine.rows.length.toLocaleString()}개 선수·시즌</strong> · 투수·미출전·오류 기록 제외</p><p>리그 평균은 해당 시즌 규정 타석 참고값을 충족한 타자의 원자료를 합산해 계산</p><p>프로젝트는 예정 팀 경기수를 사용하며 실제 팀 경기수 차이와 개인상 예외는 반영하지 않습니다. <a href="${rulesURL}" target="_blank" rel="noopener">KBO 공식 야구규칙 9.22</a></p>`;
 function updateSeasonNote(selected){
  const used=[...new Set(selected)],unknown=used.filter(y=>seasonStatus(y)==='미확인'),known=used.filter(y=>!unknown.includes(y));
  $('season-note').textContent=[known.map(y=>`${y}년 자료: ${seasonStatus(y)}`).join(' · '),unknown.length?`${unknown.join('·')}년 자료: 원본에 최종 확정 여부가 표기되지 않음 · 선수의 타석·평가 결과와 별개`:''].filter(Boolean).join(' / ');
 }
 const decades=[...new Set(years.map(year=>Math.floor(year/10)*10))];
 const yearOptions=years.map(y=>option(y,y)).join('');
 $('find-year').innerHTML=yearOptions;
 $('grade-year').innerHTML=yearOptions;
 $('grade-filter').innerHTML=option('all','전체 등급')+
  A.gradeBands.map(([band])=>option(band,`${band}등급만 보기`)).join('');
 $('find-pa').value=String(KBOCore.requiredPA(years[0]));
 $('year').innerHTML=option('all','전체 시즌')+decades.map(y=>option(`decade-${y}`,`${y}년대`)).join('')+yearOptions;
 $('year').value=String(years[0]);
 const teams=[...new Set(engine.rows.map(r=>KBOCore.teamId(r.team)))].sort((a,b)=>a.localeCompare(b,'ko'));
 $('find-team').innerHTML=option('','전체 구단')+teams.map(t=>option(t,t)).join('');
 $('find-position').innerHTML=option('','전체 포지션')+Object.entries(positions).map(([k,v])=>option(k,v)).join('');
 const params=new URLSearchParams(location.search);if(years.includes(+params.get('year')))$('year').value=params.get('year');
 const imported=[...new Set(params.getAll('selection'))].map(key=>engine.lookup.get(key)).filter(Boolean);
 if(imported.length>4){$('status').textContent='스카우팅 리포트는 기준 선수 포함 최대 4명 · 기록 비교 화면에서 선택을 줄여주세요.';return;}
 const importWarnings=params.getAll('selection').length-imported.length;
 // 대시보드 첫 진입 시 URL에 전달된 첫 선수를 기준 선수로 열어 카드 순서와 선택 상태를 맞춘다.
 if(imported.length){$('year').value=String(imported[0].year);}
 let searchBase=null, searchPeer=null;
 const primaryKey=imported[0]?`${imported[0].id}|${imported[0].year}`:'';
 $('selected-group').innerHTML=params.getAll('selection').length?`<section class="panel"><h2>선택 선수 ${imported.length}명</h2><div class="actions">${imported.map(x=>`<button type="button" data-select-import="${esc(x.id)}|${x.year}">${esc(label(x))}</button>`).join('')}</div><p class="hint">선택 선수 전환: 비교 유지 · 목록 밖 선수 검색: 현재 선수와 2인 비교${importWarnings?' · 분석 제외 '+importWarnings+'건':''}</p></section>`:'';
 $('selected-group').querySelectorAll('[data-select-import]').forEach(button=>button.onclick=()=>{
   const x=engine.lookup.get(button.dataset.selectImport);if(!x)return;
   searchBase=searchPeer=null;
   $('year').value=String(x.year);$('search').value='';populatePlayers(x.id);renderReport();
 });

 function populatePlayers(preferred){
  const q=$('search').value.trim(),old=preferred||$('player').value;
  const candidates=(engine.byYear.get(+$('year').value)||[]).filter(r=>r.name.includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.id.localeCompare(b.id));
  $('lab-search-results').hidden=true;
  $('lab-search-note').hidden=true;
  $('player').innerHTML=option('','선수 선택')+candidates.map(r=>option(r.id,`${r.name} · ${r.team}${r.age===null?'':` · 연 나이 ${r.age}세`}`)).join('');
  $('player').value=candidates.some(r=>r.id===old)?old:'';
 }
 function switchPage(finder){$('finder-page').hidden=!finder;$('player-page').hidden=finder;$('tab-player').setAttribute('aria-pressed',String(!finder));$('tab-finder').setAttribute('aria-pressed',String(finder));}
 $('tab-player').onclick=()=>{switchPage(false);renderReport();};$('tab-finder').onclick=()=>{
  switchPage(true);renderGrades();renderCandidates();
 };
 $('print').onclick=()=>window.print();
 $('fit-weights').innerHTML=fitAxes.map(d=>`<label>${esc(d.name+' · '+d.code)}<input id="fit-${d.key}" type="number" min="0" max="10" step="1" value="1" required></label>`).join('');
 $('fit-controls').onsubmit=e=>e.preventDefault();
 $('fit-preset').onchange=()=>{
  const weights=fitPresets[$('fit-preset').value];
  if(weights)for(const d of fitAxes)$('fit-'+d.key).value=weights[d.key];
  renderReport();
 };
 for(const d of fitAxes)$('fit-'+d.key).onchange=()=>{$('fit-preset').value='custom';renderReport();};
 let manualMinPA=false, comparePosition=false;
 function gradeMinimumFor(year){
  const required=KBOCore.requiredPA(year);
  return manualMinPA?Math.max(required,+$('minpa').value):required;
 }
 function gradeFor({row,axes}){
  const minimum=gradeMinimumFor(row.year);
  const scores=Object.fromEntries(axes.map(axis=>[axis.key,{value:axis.score}]));
  return {...A.radarGrade(scores,row.stats.pa,minimum,A.comparisonAxes),minimum};
 }
 function openFinderPlayer(id,year){
  searchBase=searchPeer=null;
  $('year').value=String(year);
  $('search').value='';
  populatePlayers(id);
  switchPage(false);
  renderReport();
  $('controls').scrollIntoView({block:'start'});
 }
 function renderGrades(){
  const year=+$('grade-year').value,filter=$('grade-filter').value;
  const season=engine.byYear.get(year)||[];
  const minimum=gradeMinimumFor(year);
  const eligible=season.filter(row=>row.stats.pa>=minimum);
  const scored=A.compareBatters(engine,eligible,comparePosition).map(item=>({row:item.row,...gradeFor(item)}));
  const ranked=scored.filter(item=>item.grade).sort((a,b)=>
   b.value-a.value||b.row.stats.pa-a.row.stats.pa||a.row.name.localeCompare(b.row.name,'ko'));
  const visible=filter==='all'?ranked:ranked.filter(item=>item.grade===filter);
  const counts=A.gradeBands.map(([band])=>`${band} ${ranked.filter(item=>item.grade===band).length}명`).join(' · ');
  $('grade-results').innerHTML=`
   <p><strong>${year}년 · ${filter==='all'?'전체 등급':filter+'등급'} · ${visible.length}명</strong></p>
   <p class="hint">5각형 평균 · 등급 최소 ${minimum}타석 · ${comparePosition?'동일 시즌·포지션':'동일 시즌 전체 타자'} ${A.comparisonMinPA}타석 이상 비교 · 등급 미산출 ${season.length-ranked.length}명</p>
   <p class="hint">${counts}</p>
   ${visible.length?table(['선수','구단','포지션','타석','등급','5각형 점수'],visible.map(({row,grade,value})=>[
    row.name,row.team,KBOCore.positionText(row.position),row.stats.pa,grade,fmt(value,1)
   ])):'<p>이 등급에 해당하는 선수가 없습니다.</p>'}
  `;
  // Keep the existing table renderer for escaping data, then add a real button in each first cell.
  const rows=$('grade-results').querySelector('tbody')?.querySelectorAll('tr')||[];
  rows.forEach((tr,i)=>{
   const row=visible[i].row;
   tr.querySelector('td').innerHTML=`<button type="button" data-open-grade="${esc(row.id)}">${esc(row.name)}</button>`;
  });
  $('grade-results').querySelectorAll('[data-open-grade]').forEach(button=>button.onclick=()=>{
   openFinderPlayer(button.dataset.openGrade,year);
  });
 }
 function comparisonChart(players,showMode=true){
  const evaluated=A.compareBatters(engine,players,comparePosition);
  const labels=A.comparisonAxes.map(axis=>`${axis.code} ${axis.name}`);
  const series=evaluated.map(({row,axes,provisional})=>({
   name:label(row),provisional,values:axes.map(axis=>axis.score)
  }));
  const reasons={missing:'기록 결측',invalid:'계산 불가',position:'포지션 미확인',sample:'유효 표본 5명 미만'};
  const raw=(value,key)=>!Number.isFinite(value)?'—':['avg','iso'].includes(key)?fmt(value):fmt(value*100,2)+'%';
  const difference=(first,second,axis,score=false)=>{
   if(!Number.isFinite(first)||!Number.isFinite(second))return '—';
   const delta=first-second, sign=delta>0?'+':'';
   return score?sign+fmt(delta,1)+'점':['avg','iso'].includes(axis.key)?sign+fmt(delta):sign+fmt(delta*100,2)+'%p';
  };
  const paired=evaluated.length===2;
  const warnings=evaluated.map(({row,axes,poolSize,positionKnown,provisional})=>{
   const issues=[
    !positionKnown?'세부 포지션 미확인':poolSize<5?'비교군 5명 미만':axes.some(axis=>axis.n<5)?'일부 축의 유효 표본 5명 미만':'',
    provisional?`소타석 참고 · ${row.stats.pa}타석`:''
   ].filter(Boolean);
   return `<li>${esc(label(row))} · 비교군 ${poolSize}명${issues.length?' · '+esc(issues.join(' · ')):''}</li>`;
  }).join('');
  const different=comparePosition&&players.length>1&&players.some(row=>!KBOCore.sharedPosition(players[0].position,row.position));
  return `<div class="comparison-charts">
    <h3>${players.length>1?'선수 비교':'선수 상세'} 레이더 · 5개 타격·도루 지표</h3>
    ${showMode?`<label class="comparison-mode">레이더 비교군 <select id="comparison-mode">${option('all','동일 시즌 전체 타자')}${option('position','동일 시즌·포지션')}</select></label>`:''}
    <p class="hint"><strong>비교 기준</strong> 동일 시즌 ${A.comparisonMinPA}타석 이상 · 기준 충족 시 본인 포함</p>
    <p class="hint"><strong>포지션 모드</strong> 세부 수비 위치가 하나 이상 겹치는 타자</p>
    <p class="hint"><strong>백분위</strong> (본인보다 불리한 값 수 + 동률 수 × 0.5) ÷ 유효 표본 수 × 100 · K%는 낮을수록 유리</p>
    <ul>${warnings}</ul>
    ${different?'<p class="warning">선수별 포지션 비교군이 다르거나 확인되지 않았습니다. 백분위 차이는 각 비교군에서의 상대 위치 차이입니다.</p>':''}
    ${new Set(players.map(row=>row.year)).size>1?'<p class="hint">선택 선수의 시즌이 서로 다릅니다. 각 시즌의 비교군으로 백분위를 계산합니다.</p>':''}
    ${V.radar(labels,series,{comparison:true})}
    ${zeroGuide}
    <p class="hint">괄호는 지표별 유효 비교 인원입니다.${paired?' 차이는 첫 번째 선수 − 두 번째 선수입니다.':''}</p>
    <p class="hint">볼넷률은 선구안의 참고 지표, 도루 생산력은 타석당 도루 빈도입니다.</p>
    ${table(['지표 · 계산식',...evaluated.map(item=>label(item.row)+' · 실제 / 백분위'),...(paired?['차이 · 실제 / 백분위']:[])],
      A.comparisonAxes.map((axis,i)=>{
       const values=evaluated.map(item=>item.axes[i]);
       const cells=values.map(value=>`${raw(value.actual,axis.key)} / ${value.score===null?reasons[value.reason]:fmt(value.score,1)+'백분위'} (${value.n}명)`);
       if(paired)cells.push(difference(values[0].actual,values[1].actual,axis)+' / '+difference(values[0].score,values[1].score,axis,true));
       return [`${axis.name} · ${axis.code} · ${axis.formula}`,...cells];
      }))}
   </div>`;
 }

 function renderReport(override=null,peerOnly=false){
  const selected=engine.lookup.get(`${$('player').value}|${$('year').value}`);
  const searchComparison=!peerOnly&&searchPeer!==null&&searchPeer===selected;
  const r=override||(searchComparison?searchBase:selected);
  const reference=engine.league.get(r?.year||+$('year').value)?.qualifyingPA;
  if(!reference){
   $('minpa-guide').textContent='기록을 열면 해당 시즌의 비교군 평균과 규정 타석 참고값을 확인할 수 있습니다.';
   $('report').innerHTML='<p class="panel">이름을 검색해 분석할 선수와 시즌을 선택하세요.</p>';
   $('print').disabled=true;
   return;
  }
  if(!manualMinPA&&!peerOnly)$('minpa').value=String(reference.minimum);
  if(!$('controls').reportValidity())return;
  const guide=`기본값 ${reference.minimum}타석 = 예정 팀 경기수 × 3.1의 소수점 버림. 규정 충족 ${reference.count}명 · 평균 ${reference.count ? fmt(reference.average,1)+'타석' : '미산출'}. 표본이 적으면 최소 타석을 낮춰 보세요.`;
  $('minpa-guide').textContent=guide;
  if(!r){
   $('report').innerHTML='<p class="panel">선수·분석 설정에서 이름을 검색하고 분석할 선수를 선택하세요.</p>';
   $('print').disabled=true;
   return;
  }
  $('print').disabled=false;
  const min=manualMinPA?+$('minpa').value:KBOCore.requiredPA(r.year),settings={minPA:min,era:$('era').value,group:$('group').value};
  const pool=engine.cohort(r,settings),l=engine.league.get(r.year),s=r.stats,change=engine.growth(r,min),similar=engine.similar(r,min);
  const averagePA=pool.length ? pool.reduce((sum,x)=>sum+x.stats.pa,0)/pool.length : null;
  if(!peerOnly)$('minpa-guide').textContent=`현재 비교군 ${pool.length}개 선수·시즌 기록 · 평균 ${averagePA===null?'미산출':fmt(averagePA,1)+'타석'}. ${guide}`;
  const previous=engine.lookup.get(`${r.id}|${r.year-1}`);
  const growthMissing=[];
  if(!previous)growthMissing.push(`${r.year-1}년 유효 기록 없음`);
  for(const x of [previous,r].filter(Boolean))if(x.stats.pa<min)growthMissing.push(`${x.year}년 ${x.stats.pa}타석 · ${min-x.stats.pa}타석 부족`);
  if(previous&&!(previous.index>0))growthMissing.push(`${previous.year}년 OPS 지수 기준값 미산출`);
  const growthText=Number.isFinite(change)?`상대 OPS ${fmt(change,1)}% 변화`:`— ${growthMissing.join(' / ')||'지표 미확인'}`;

  const unavailable=['position','both'].includes(settings.group)&&!KBOCore.knownPosition(r.position)?'비교할 세부 포지션 자료 부족':['age','both'].includes(settings.group)&&r.age===null?'비교할 나이 자료 부족':pool.length<5?`비교 표본 부족 (${pool.length}/5)`:'해당 지표 기록 부족';
  const missingScoreNote=pool.length<5?`<p class="hint">— ${esc(unavailable)} · 상대평가 비교 기준</p>${pool.length<5?'<button type="button" class="radar-reset" data-reset-radar>상대평가 비교군 초기화</button>':''}`:'';
  const inComparison=imported.some(x=>x.id===r.id&&x.year===r.year);
  const importedPeers=searchComparison?[searchPeer]:inComparison?imported.filter(x=>x!==r):[];
  const showIndividualRadar=!searchComparison&&!(peerOnly&&r===searchPeer);
  if(!peerOnly)updateSeasonNote([r.year,...importedPeers.map(x=>x.year)]);
  const delta=['avg','obp','slg','ops'].map((k,i)=>({label:['타율','출루율','장타율','OPS'][i],value:Number.isFinite(s[k])&&l[k]>0?(s[k]/l[k]-1)*100:null,detail:'선수/동시즌 리그 − 1, 백분율'}));
  const plotted=pool.slice().sort((a,b)=>a.year-b.year||a.id.localeCompare(b.id));const sample=plotted.length>300?plotted.filter((_,i)=>i%Math.ceil(plotted.length/300)===0):plotted;
    const basicStats=['avg','obp','slg','ops'];
  const statNames={avg:'타율',obp:'출루율',slg:'장타율',ops:'OPS'};
  const primary=(x)=>searchComparison?x===searchBase:primaryKey===`${x.id}|${x.year}`;
  const positionNote=r.positionEvidence?`<p class="hint">${esc(KBOCore.positionText(r.position))} · <a href="${esc(r.positionEvidence.source)}" target="_blank" rel="noopener noreferrer">${esc(r.year)}년 포지션 근거 ↗</a></p>`:r.position==='OF'&&['position','both'].includes(settings.group)?'<p class="hint">세부 위치 비교는 자료 부족으로 미산출</p>':'';
  const observations=globalThis.KBOScoutingObservations?.lookup(r.id,r.year)||[];
  const injuries=globalThis.KBOScoutingObservations?.injuriesFor(r.id)||[];
  const injuryHTML=injuries.length
    ?`<ul>${injuries.map(o=>`<li><strong>${esc(o.date.slice(0,4))}년 · ${Number(o.date.slice(0,4))===r.year?'선택 시즌':Number(o.date.slice(0,4))<r.year?'이전 시즌':'이후 시즌'}</strong><p>${esc(o.summary)}</p><a href="${esc(o.source)}" target="_blank" rel="noopener noreferrer">${esc(o.publisher)} · ${esc(o.date)} ↗</a></li>`).join('')}</ul>`
    :'<p>이 화면에 등록된 공개 부상 자료가 없습니다.</p>';
  const observationHTML=observations.length?observations.map(o=>`<article class="scouting-source-note"><p><strong>현장·기사 평가</strong> · ${esc(o.who)}</p><p>${esc(o.summary)}</p><p><strong>검토 의견 · 자체 해석</strong></p><p>${esc(o.opinion)}</p><a href="${esc(o.source)}" target="_blank" rel="noopener noreferrer">${esc(o.publisher)} · ${esc(o.date)} ↗</a></article>`).join(''):'';
  const [radarEvaluation]=A.compareBatters(engine,[r],comparePosition);
  const grade=gradeFor(radarEvaluation);
  const markup=`<section class="panel report-head team-scout-card" ${clubStyle(r.team)}><span class="eyebrow">PLAYER REPORT · 자체 분석</span><h2>${playerHeading(r)}</h2><p>${teamText(r.team)} · ${esc(KBOCore.positionText(r.position))} · ${r.age===null?'나이 미확인':'연 나이 '+r.age+'세 (시즌 연도−출생 연도)'} · ${s.pa}타석</p><div class="cards"><div class="metric"><small>타석</small><strong>${s.pa}</strong><span class="benchmark">${esc(paReference(r))}</span></div>${basicStats.map(k=>`<div class="metric"><small>${statNames[k]}</small><strong>${fmt(s[k])}</strong><span class="benchmark">그해 리그 평균 ${fmt(l[k])}</span></div>`).join('')}<div class="metric"><small>리그 대비 OPS 지수</small><strong>${fmt(r.index,1)}</strong><span class="benchmark">리그 평균 100</span></div><div class="metric"><small>추정 wRC</small><strong>${fmt(s.wrc,1)}점</strong><span class="benchmark">100타석당 ${fmt(s.wrcPer100,2)}점 · 리그 평균 ${fmt(l.wrcPer100,2)}점</span></div><div class="metric"><small>전년도 대비 상대 OPS 변화</small><strong>${Number.isFinite(change)?fmt(change,1)+'%':'—'}</strong><span class="benchmark">${esc(growthText)} · 양쪽 시즌 ${min}타석 이상 · 예측 아님</span></div></div></section>
  ${!peerOnly&&importedPeers.length>0?`<section class="panel report-comparison"><h2>선택 선수 비교 · 선수별 리포트 · ${1+importedPeers.length}명</h2><p class="hint">이중 테두리: 기준 선수 · 카드색: 시즌 소속 구단</p><div class="scout-player-grid">${[r,...importedPeers].map(x=>{const base=primary(x),lx=engine.league.get(x.year);return `<article class="compare-player-card team-scout-card ${base?'is-primary':''}" ${clubStyle(x.team)}><div class="compare-player-heading"><span class="role-pill">${base?'처음 선택한 기준 선수':'비교 선수'}</span><strong>${playerHeading(x)}</strong><span class="hint">${esc(KBOCore.positionText(x.position))}</span></div><div class="compare-player-metrics"><div><small>타석</small><strong>${x.stats.pa}</strong><span>${esc(paReference(x))}</span></div><div><small>타율</small><strong>${fmt(x.stats.avg)}</strong><span>리그 평균 ${fmt(lx.avg)}</span></div><div><small>출루율</small><strong>${fmt(x.stats.obp)}</strong><span>리그 평균 ${fmt(lx.obp)}</span></div><div><small>장타율</small><strong>${fmt(x.stats.slg)}</strong><span>리그 평균 ${fmt(lx.slg)}</span></div><div><small>OPS</small><strong>${fmt(x.stats.ops)}</strong><span>리그 평균 ${fmt(lx.ops)}</span></div><div><small>홈런율 (HR/PA)</small><strong>${fmt(100*x.stats.hr,2)}%</strong><span>시즌 실제 기록</span></div><div><small>리그 대비 OPS</small><strong>${fmt(x.index,1)}</strong><span>리그 평균 100</span></div><div><small>추정 wRC</small><strong>${fmt(x.stats.wrc,1)}</strong><span>100PA당 ${fmt(x.stats.wrcPer100,2)} · 리그 평균 ${fmt(lx.wrcPer100,2)}</span></div></div></article>`;}).join('')}</div>${comparisonChart([r,...importedPeers])}</section>`:''}
  <section class="panel report-assessment team-scout-card" ${clubStyle(r.team)}><h2>1. 강점·약점 · 상대평가</h2>${positionNote}${missingScoreNote}${showIndividualRadar?comparisonChart([r],!peerOnly&&!importedPeers.length):''}<div class="grid"><div><h3>그해 리그 평균 대비 차이 (%)</h3>${V.bars(delta,'선수/리그 평균 − 1',{max:0})}</div><div><h3>비교군 내 위치</h3>${V.scatter([...sample,r].map(x=>({x:x.stats.pa,y:x.index,label:label(x),selected:x===r})),'타석','리그 대비 OPS 지수')}<p class="hint">${pool.length>300?`비교군 ${sample.length}개 점 표시 · 계산은 전체 표본`:'비교군 전체 표시'}</p></div></div></section>
  <section class="panel report-trend team-scout-card" ${clubStyle(r.team)}><h2>2. 선택 시즌 타격 기록</h2><p>${esc(label(r))} · ${s.pa}타석</p><p class="hint">${esc(paReference(r))} · 타석은 충족자 산술평균, 타격 비율은 충족자 기록을 합산해 계산. 1~2타석 등 기준 미달 기록은 평균에서 제외</p>${table(['지표','선수 기록',`${r.year}년 리그 평균 (규정 타석 충족자)`],[['타석 · 규정 충족자 평균',String(s.pa),fmt(l.qualifyingPA.average,1)],...['avg','obp','slg','ops','hr'].map(k=>[k==='hr'?'홈런/타석 (%)':statNames[k],fmt(k==='hr'?s[k]*100:s[k]),fmt(k==='hr'?l[k]*100:l[k])])])}</section>
  <section class="panel report-similar team-scout-card" ${clubStyle(r.team)}><h2>3. 유사선수 TOP 5</h2>${similar.length?`<table class="similar-compact"><thead><tr><th>선수 · POS · 시즌</th><th>유사 점수</th><th>ΔOPS</th><th>ΔK%</th></tr></thead><tbody>${similar.map(c=>`<tr><td title="${esc(similarLabel(c.row))}">${esc(c.row.name)} ${esc(positionLabel(c.row))} ${c.row.year}</td><td>${fmt(c.score,1)}</td><td>${fmt(c.differences.opsIndex,1)}</td><td>${fmt(c.differences.k,1)}</td></tr>`).join('')}</tbody></table><p class="hint">LF 좌익수 · CF 중견수 · RF 우익수 · OF 외야수<br>ΔOPS: OPS 지수 차이 · ΔK%: 삼진률 차이(%p) · 후보−선수</p>${V.scatter([r,...similar.map(c=>c.row)].map(x=>({x:x.relative.power,y:x.relative.production,label:similarLabel(x),selected:x===r})),'ISO / 그해 리그 ISO','OPS / 그해 리그 OPS')}`:'<p class="hint">비교 가능한 과거 기록 부족</p>'}</section>
  ${observations.length?`<section class="panel report-notes team-scout-card" ${clubStyle(r.team)}><h2>4. 기사 기반 스카우팅 의견</h2>${observationHTML}</section>`:''}<section class="panel report-injuries team-scout-card" ${clubStyle(r.team)}><h2>주의사항 · 공개 부상 이력</h2>${injuryHTML}<p><a href="https://www.koreabaseball.com/Record/Player/HitterDetail/Basic.aspx?playerId=${encodeURIComponent(r.id)}" target="_blank" rel="noopener noreferrer">KBO 공식 선수 기록 ↗</a> · <a href="https://search.naver.com/search.naver?where=news&amp;query=${encodeURIComponent(r.name+" KBO 야구 부상")}" target="_blank" rel="noopener noreferrer">선수 부상 보도 검색 ↗</a></p><p class="hint">KBO는 2020년 부상 선수 보호를 위해 부상자명단 제도를 도입했습니다. 도입 당시 구단은 정규시즌 경기나 훈련 중 다친 등록 선수에 대해 10일·15일·30일 중 하나를 선택해 등재를 신청할 수 있었으며, 등재 기간은 현역선수 등록일수로 인정됐습니다. 공식 선수 기록의 엔트리 표에서 ‘부상자명단’으로 표시된 기간을 확인할 수 있습니다. 2020년 이전 이력은 당시 구단 발표나 보도를 참고하세요. <a href="https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=7651" target="_blank" rel="noopener noreferrer">KBO 도입 공지 ↗</a></p><p class="hint">보도 당시의 출전·회복 이력을 참고하세요. 현재 상태와 타격 참고 등급은 별도로 확인해야 합니다.</p></section>${KBOScoutingContext.render(r,grade).replace('<section class="panel">',`<section class="panel context-card team-scout-card" ${clubStyle(r.team)}>`)}`;
  if(peerOnly)return markup;
  const reportPlayers=[r,...importedPeers];
  const reports=reportPlayers.map((x,i)=>({row:x,html:i===0?markup:renderReport(x,true)}));
  function section(html,cls){
    const start=html.indexOf(`<section class="panel ${cls}`);
    if(start<0)return '';
    const end=html.indexOf('</section>',start);
    return html.slice(start,end+10);
  }
  const lead=importedPeers.length>0?section(markup,'report-comparison'):section(markup,'report-head');
  const gradeGuide=`<section class="panel grade-guide"><h2>타격 기록 참고 등급 · 5각형 기준</h2><button type="button" id="browse-grades">이 시즌 등급별 선수 보기</button><p>참고 점수 = (AVG 백분위 + BB% 백분위 + K% 백분위 + ISO 백분위 + SB/PA 백분위) ÷ 5. 삼진율은 낮을수록 높은 백분위를 받습니다.</p>${table(['등급','5각형 평균 점수'],A.gradeBands.map(([grade,lower],i)=>[grade,i?`${lower}점 이상 ~ ${A.gradeBands[i-1][1]}점 미만`:`${lower}점 이상`]))}<p>다섯 축 중 하나라도 미산출이거나 규정 타석 참고값과 설정 최소 타석 중 높은 기준을 충족하지 못하면 등급을 보류합니다.</p><p class="hint">5각형의 타격·도루 지표를 반영한 자체 참고 등급입니다. 수비와 미래 성적은 평가 범위 밖입니다.</p></section>`;
  const commonNotes={

    'report-similar':`<section class="panel shared-method"><h2>공통 · 유사선수 계산</h2><p>이전 시즌만 · 선수당 가장 가까운 기록 1개 · 최소 ${min}타석</p><p>출루율·삼진률·ISO·볼넷률·OPS·홈런률을 해당 시즌 리그 대비 비율로 보정한 뒤, 후보와 선수의 표준편차로 표준화한 거리 계산. 유사 점수=100÷(1+표준거리).</p><p class="hint">점수는 확률이 아님 · 차이는 후보−선수 · K% 차이 음수는 후보의 삼진 비율이 더 낮음.</p></section>`,

  };
  const blocks=['report-assessment','report-trend','report-similar','report-notes','report-injuries','context-card'];
  const weights=Object.fromEntries(fitAxes.map(d=>[d.key,A.num($('fit-'+d.key).value)]));
  const fitRows=A.compareBatters(engine,reportPlayers,comparePosition).map(({row,axes,provisional})=>{
   const scores=Object.fromEntries(axes.map(axis=>[axis.key,{value:axis.score,provisional}]));
   return {row,...A.fitScore(scores,weights,fitAxes)};
  });
  const fitHTML=`<section class="panel fit-summary"><h2>선택 목적에 따른 타격 적합도 · 100점 만점 · 자체 참고</h2><p class="hint">${esc($('fit-preset').selectedOptions[0]?.textContent||'직접 설정')} · 5각형 레이더와 같은 비교군의 백분위에 선택한 비중 적용</p><div class="fit-results">${fitRows.map(x=>`<article class="team-scout-card fit-result" ${clubStyle(x.row.team)}><h3>${playerHeading(x.row)}</h3><strong class="fit-value">${fmt(x.value,1)}${Number.isFinite(x.value)?' / 100':''}</strong><p>${esc(x.reason|| (x.provisional?'소타석 참고 · 적은 출전으로 변동 가능':'선택한 비중으로 계산'))}</p></article>`).join('')}</div></section>`;
  $('report').innerHTML=lead+fitHTML+blocks.map(cls=>{
    const available=reports.map(({row,html})=>({row,content:section(html,cls)})).filter(x=>x.content);
    if(!available.length)return '';
    return `${cls==='context-card'?gradeGuide:''}<div class="report-comparison-row" style="--report-columns:${available.length}">${available.map(({row,content})=>`<div class="report-player-cell"><div class="report-player-label" ${clubStyle(row.team)}>${playerHeading(row)}</div>${content}</div>`).join('')}</div>${commonNotes[cls]||''}`;
  }).join('');
  $('browse-grades').onclick=()=>{
   $('grade-year').value=String(r.year);
   $('tab-finder').onclick();
   $('grade-finder').scrollIntoView({block:'start'});
   $('grade-filter').focus?.();
  };
  const comparisonMode=$('comparison-mode');
  if(comparisonMode){
   comparisonMode.value=comparePosition?'position':'all';
   comparisonMode.onchange=()=>{
    comparePosition=comparisonMode.value==='position';
    renderReport();
    $('comparison-mode')?.focus?.();
   };
  }
  $('report').querySelectorAll('[data-reset-radar]').forEach(button=>button.onclick=()=>{
   $('group').value='all';$('era').value='season';manualMinPA=false;renderReport();
  });
 }
 function renderCandidates(){
  if(!$('finder').reportValidity())return;
  const minAge=A.num($('age-min').value),maxAge=A.num($('age-max').value);
  if(minAge!==null&&maxAge!==null&&minAge>maxAge){$('candidates').innerHTML='<p class="warning">나이 범위 오류 · 최소 ≤ 최대 필요</p>';return;}
  const o={year:+$('find-year').value,minAge,maxAge,team:$('find-team').value,position:$('find-position').value,minPA:+$('find-pa').value,minIndex:+$('find-index').value,minGrowth:A.num($('find-growth').value),weights:{production:+$('weight-production').value,growth:+$('weight-growth').value}};
  let results;try{results=engine.discover(o);}catch(e){$('candidates').textContent=e.message;return;}
  const top=results.slice(0,30);updateSeasonNote([o.year]);
  $('candidates').innerHTML=`<section class="panel"><h2>조건에 맞는 후보 ${results.length}명</h2><p>상위 30명 표시 · ${o.year}년 규정 타석 참고값 ${KBOCore.requiredPA(o.year)}타석 · 적용 최소 ${o.minPA}타석</p>${!top.length?'<p>조건 충족 후보 없음 · 전년도 기록 없는 선수는 성장 비중 0으로 탐색</p>':`<div class="table-wrap"><table><thead><tr><th>리포트</th><th>순위</th><th>선수</th><th>구단</th><th>연 나이</th><th>포지션</th><th>타석</th><th>상대 OPS</th><th>성장률 %</th><th>자체 점수</th></tr></thead><tbody>${top.map((c,i)=>`<tr><td><button data-open="${esc(c.row.id)}">보기</button></td><td>${i+1}</td><td>${esc(c.row.name)}</td><td>${esc(c.row.team)}</td><td>${c.row.age??'미확인'}</td><td>${esc(KBOCore.positionText(c.row.position))}</td><td>${c.row.stats.pa}</td><td>${fmt(c.row.index,1)}</td><td>${fmt(c.growth,1)}</td><td>${fmt(c.score,1)}</td></tr>`).join('')}</tbody></table></div><div class="grid"><div><h3>상위 10명 자체 점수</h3>${V.bars(top.slice(0,10).map(c=>({label:label(c.row),value:c.score,detail:`생산성 ${fmt(c.productionScore,1)} / 성장 ${fmt(c.growthScore,1)} 백분위`})), '후보 점수')}</div><div><h3>성장과 현재 생산성</h3>${V.scatter(results.map(c=>({x:c.growth,y:c.row.index,label:label(c.row)})),'성장률 (%)','리그 대비 OPS 지수')}<p class="hint">성장률 미산출 후보: 산점도 제외</p></div></div><h3>상위 5명 관찰 카드</h3><div class="candidate-grid">${top.slice(0,5).map(c=>`<article class="metric"><h4>${esc(label(c.row))}</h4><p>생산성 ${fmt(c.productionScore,1)}백분위 · 성장 ${fmt(c.growthScore,1)}백분위</p><p>상대 강점: ${c.productionScore>=75?'공격 생산성 상위권':c.growthScore>=75?'관측된 성장률 상위권':'설정한 조건을 충족하는 기록'}</p><p>관찰 필요: ${c.row.stats.pa<400?'400타석 미만으로 표본 규모를 함께 검토. ':''}${c.growth===null?'전년도 성장률 미산출. ':''}수비·부상 자료 없음 · 계약 금액은 상세 리포트에서 확인.</p></article>`).join('')}</div>`}</section>`;
  $('candidates').querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>openFinderPlayer(button.dataset.open,o.year));
 }
 $('controls').onsubmit=e=>e.preventDefault();
 $('year').onchange=()=>{
  searchPeer=null;
  $('search').value='';
  populatePlayers();
  renderReport();
 };
 function showSearchResults(){
  const query=$('search').value.trim(), results=$('lab-search-results');
  if(!query){results.hidden=true;return;}
  const scope=$('year').value, year=Number(scope);
  const decade=scope.startsWith('decade-')?Number(scope.slice(7)):null;
  const scoped=Number.isFinite(year) ? (engine.byYear.get(year)||[])
   : decade===null ? engine.rows : engine.rows.filter(r=>r.year>=decade&&r.year<decade+10);
  const matches=r=>KBOCore.matchesName(r.name,query,true);
  const current=scoped.filter(matches);
  const fallback=scope!=='all'&&!current.length;
  const candidates=(fallback?engine.rows.filter(matches):current).sort((a,b)=>
   Number(b.name===query)-Number(a.name===query)||a.name.localeCompare(b.name,'ko')||b.year-a.year||a.id.localeCompare(b.id));
  results.hidden=false;
  const multiSeason=!Number.isFinite(year);
  results.classList?.toggle('other-seasons',fallback||multiSeason);
  const scopeLabel=decade===null?`${year}년`:`${decade}년대`;
  const hint=fallback&&candidates.length
   ? `<p role="status">보유 데이터의 ${scopeLabel} 타격 기록에 일치하는 선수가 없습니다. 아래에서 기록이 있는 시즌을 선택하세요.</p>`
   : '';
  results.innerHTML=candidates.length
   ? hint+candidates.map(r=>{
    const text=`${label(r)} · ${KBOCore.positionText(r.position)}`;
    const width=[...text].reduce((sum,c)=>sum+(/[가-힣]/.test(c)?1:c===' '||c==='·'?.4:.85),0);
    return `<button type="button" data-search-player="${esc(r.id)}" data-search-year="${r.year}" style="--label-width:${width.toFixed(2)}">${esc(text)}</button>`;
   }).join('')
   : '<p role="status">보유 기록에서 검색 결과 없음</p>';
  results.querySelectorAll('[data-search-player]').forEach(button=>button.onclick=()=>{
   const row=engine.lookup.get(`${button.dataset.searchPlayer}|${button.dataset.searchYear}`);
   if(imported.includes(row)){
    searchBase=searchPeer=null;
   }else{
    searchBase ??= engine.lookup.get(`${$('player').value}|${$('year').value}`) || row;
    searchPeer=row===searchBase?null:row;
   }
   $('year').value=String(row.year);
   $('search').value=row.name;
   populatePlayers(button.dataset.searchPlayer);
   renderReport();
   $('search').focus?.();
   results.hidden=true;
   const note=$('lab-search-note');
   note.hidden=!fallback;
   if(fallback)note.textContent=`보유 데이터에 ${row.name}의 ${scopeLabel} 타격 기록이 없어 ${row.year}년 기록을 열었습니다.`;
  });
 }
 $('controls').onsubmit=e=>e.preventDefault();
 $('search').oninput=()=>{$('lab-search-note').hidden=true;showSearchResults();};
 $('search').onkeydown=e=>{
  const results=$('lab-search-results');
  if(e.key==='Escape')results.hidden=true;
  if(e.isComposing||results.hidden)return;
  const first=results.querySelector('[data-search-player]');
  if(e.key==='ArrowDown'&&first){e.preventDefault();first.focus();}
  if(e.key==='ArrowUp'&&first){
   e.preventDefault();
   [...results.querySelectorAll('[data-search-player]')].at(-1).focus();
  }
  if(e.key==='Enter'&&first){e.preventDefault();first.click();}
 };
 $('search').onfocus=showSearchResults;
 for(const control of [$('search'),$('lab-search-results')]){
  control.onfocusout=e=>{
   const next=e.relatedTarget, results=$('lab-search-results');
   if(next!==$('search')&&!results.contains(next))results.hidden=true;
  };
 }
 $('lab-search-results').onkeydown=e=>{
  if(e.isComposing)return;
  const results=$('lab-search-results');
  if(e.key==='Escape'){
   e.preventDefault();
   $('search').focus();
   results.hidden=true;
   return;
  }
  const buttons=[...results.querySelectorAll('[data-search-player]')];
  const index=buttons.indexOf(e.target);
  if(index<0)return;
  if(e.key==='Enter'){
   e.preventDefault();
   buttons[index].click();
  }
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   e.preventDefault();
   const next=index+(e.key==='ArrowDown'?1:-1);
   if(next<0)$('search').focus();
   else buttons[next]?.focus();
  }
 };
 $('minpa').onchange=()=>{manualMinPA=true;renderReport();};
 $('player').onchange=()=>{searchBase=searchPeer=null;renderReport();};
 for(const id of ['era','group'])$(id).onchange=()=>{renderReport();};
 $('grade-year').onchange=$('grade-filter').onchange=renderGrades;
 $('finder').onsubmit=e=>{e.preventDefault();renderCandidates();};
 $('finder').onchange=e=>{
  if(e.target===$('find-year'))$('find-pa').value=String(KBOCore.requiredPA(+$('find-year').value));
  renderCandidates();
 };
 populatePlayers(imported.length?imported[0].id:params.get('id'));renderReport();
}catch(error){$('status').textContent='자료 로딩 실패 · '+error.message;console.error(error);}
})();
