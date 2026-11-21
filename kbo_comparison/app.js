/* UI state lives in memory; calculations are shared with core.js. */
async function startApp() {
  const $ = id => document.getElementById(id);
  const C = KBOCore;
  const {records:rawRecords,metadata}=await KBORepository.load();
  const records=rawRecords.map(r=>({...r,Position:C.positionCode(r)}));
  const engine=C.createEngine(records), {players,validYears,aggregate,seasonYears}=engine;
  const playersById=new Map(players.map(p=>[p.id,p]));
  const positionNames={'전체':'전체',...C.positionNames};
  const teamNames=Object.fromEntries(['전체',...[...new Set(records.map(r=>C.teamId(r.Team)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'))].map(x=>[x,x]));
  const allYears=[...new Set(records.map(r=>Number(r.Season)).filter(Number.isFinite))].sort((a,b)=>b-a);
  $('recommend-year').innerHTML=allYears.map(y=>`<option value="${y}">${y}년</option>`).join('');
  const targets=new Map(), chosen=new Map();
  let suggestions=[], browseLimit=10,browseSort='선수',browseAscending=true;
  let recSort='차이',recAscending=true;
  let weights=Object.fromEntries(C.metrics.map(k=>[k,1]));
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(key,value)=>value==null||!Number.isFinite(Number(value))?'—':[...C.rates,...C.detailMetrics.filter(k=>!['2루타','3루타','타점','득점','도루','도루실패','볼넷','삼진'].includes(k))].includes(key)||key==='차이'?Number(value).toFixed(3):String(value);
  function displayStat(key,stats){
    if(key!=='도루성공%')return fmt(key,stats?.[key]);
    const success=stats?.['도루'],failed=stats?.['도루실패'];
    if(!Number.isFinite(success)||!Number.isFinite(failed))return '—';
    const attempts=success+failed;
    return `${attempts>0?(100*success/attempts).toFixed(1)+'%':'—'} (${success}/${attempts})`;
  }
  const period=(id,end)=>seasonYears(id,end).slice().reverse().join(', ');
  const checked=name=>[...document.querySelectorAll(`input[name="${name}"]:checked`)];
  const inputs=name=>[...document.querySelectorAll(`input[name="${name}"]`)];
  const values=name=>checked(name).map(input=>input.value);
  const teamColors = C.teamColors;
  const teamStyle = team => teamColors[C.teamId(team)] ? ` style="--club-color:${teamColors[C.teamId(team)]}"` : '';
  function makeFilter(id,name,options) {
    const legend=$(id).querySelector('legend')?.textContent||'';
    $(id).innerHTML=`<legend>${esc(legend)}</legend>`+Object.entries(options).map(([value,label])=>`<label><input type="checkbox" name="${name}" value="${esc(value)}" ${value==='전체'?'checked':''}><span${name.endsWith('-team')&&value!=='전체'?` class="club-label"${teamStyle(value)}`:''}>${esc(label)}</span></label>`).join('');
  }
  function resetGroup(name) { inputs(name).forEach(input=>input.checked=input.value==='전체'); }
  function normalizeGroup(input) {
    if(input.type!=='checkbox')return;
    const group=inputs(input.name),all=group.find(x=>x.value==='전체');
    if(input.value==='전체'&&input.checked)group.forEach(x=>x.checked=x===all);
    else {
      if(input.name.endsWith('-position')) {
        const outfield=group.find(x=>x.value==='OF'),parts=group.filter(x=>['LF','CF','RF'].includes(x.value));
        if(input.value==='OF')parts.forEach(x=>x.checked=input.checked);
        else if(['LF','CF','RF'].includes(input.value))outfield.checked=parts.every(x=>x.checked);
      }
      if(input.checked)all.checked=false;
    }
    if(!group.some(x=>x.checked))all.checked=true;
  }
  const positionMatcher=name=>{const selected=values(name);return positions=>selected.includes('전체')||selected.some(p=>positions.some(code=>C.matchesPosition(code,p)));};
  const teamMatcher=name=>{const selected=values(name);return teams=>selected.includes('전체')||selected.some(t=>teams.some(team=>C.teamId(team)===t));};
  for(const kind of ['browse','compare']) {
    makeFilter(`${kind}-positions`,`${kind}-position`,positionNames);
    makeFilter(`${kind}-teams`,`${kind}-team`,teamNames);
  }
  $('browse-year-options').innerHTML=[...new Set(allYears.map(y=>Math.floor(y/10)*10))].map(decade=>`<div class="decade-row"><strong>${decade}년대</strong><div>${allYears.filter(y=>Math.floor(y/10)*10===decade).map((year)=>`<label><input type="checkbox" name="browse-year" value="${year}" ${year===allYears[0]?'checked':''}><span>${year}</span></label>`).join('')}</div></div>`).join('');
  function selectedYears() { return $('browse-all-years').checked?allYears:values('browse-year').map(Number); }
  function metadataMarkup() {
    const statusByYear=metadata.season_status||{};
    const statuses=new Set(selectedYears().map(year=>statusByYear[year]||'미확인'));
    $('data-status').textContent=`시즌 확정 상태: ${[...statuses].join(' / ')}`;
    const safeSource=typeof metadata.original_source==='string'&&/^https?:\/\//.test(metadata.original_source)?`<a href="${esc(metadata.original_source)}" target="_blank" rel="noopener noreferrer">원출처</a>`:'미확인';
    $('data-info').innerHTML=`<div class="meta-grid"><div><small>기록 범위</small>${allYears.at(-1)}–${allYears[0]} · ${records.length.toLocaleString()}행</div><div><small>원출처</small>${safeSource}</div><div><small>수집일</small>${esc(metadata.collected_at||'미확인')}</div><div><small>자료 변환일 · 수집일 아님</small>${esc(metadata.packaged_at?metadata.packaged_at.slice(0,10):'미확인')}</div></div><p><a href="kbo_batting_stats_season_1982-2026.csv" download>↓ 원본 CSV</a> · <a href="sample_data.json" download>↓ 실행 JSON</a></p><p class="hint">출처·수집일·시즌 상태: 확인된 값만 표시 · 규정 타석: 예정 경기 수 기준 · 이적 전후 분리 미확인</p>`;
  }
  function table(rows, highlight=false) {
    const cols=['선수','기간',...C.metrics,...C.detailMetrics], limits={};
    if(highlight&&rows.length>1)for(const k of [...C.metrics,...C.detailMetrics].filter(k=>k!=='경기')) {
      const numbers=rows.filter(r=>r[k]!=null&&Number.isFinite(r[k])).map(r=>Number(fmt(k,r[k])));
      if(numbers.length)limits[k]=[Math.min(...numbers),Math.max(...numbers)];
    }
    return `<div class="table-wrap"><table><thead><tr>${cols.map(k=>`<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${cols.map(k=>{
      const n=Number(fmt(k,row[k])), range=limits[k],classes=[];
      if(range&&n===range[1])classes.push('best');if(range&&n===range[0])classes.push('lowest');
      return `<td${classes.length?` class="${classes.join(' ')}"`:''}>${k==='선수'||k==='기간'?esc(row[k]):esc(displayStat(k,row))}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  const renderScouting = typeof createScoutingView === 'function' ? createScoutingView(records) : () => {};
  function refreshSelection() {
    renderTargets();renderComparePlayers();recommend();renderComparison();
  }
  function addTarget(id,end) {
    const existing=targets.get(id);
    if(existing&&existing.end===Number(end)){
      removeTarget(id,'대상 추가 취소');
      return true;
    }
    const stats=aggregate(id,end);
    if(!stats){$('target-message').textContent='선택 시즌 기록 부족 또는 중복 · 기존 선택 유지';return false;}
    if(!targets.size)$('recommend-year').value=String(end);
    const was=targets.get(id);
    targets.set(id,{id,end:Number(end),name:playersById.get(id).name,stats});
    for(const [key,c] of chosen)if(c.id===id)chosen.delete(key);
    $('target-message').textContent=was?(was.end===Number(end)?'이미 선택한 대상':'기준 시즌 변경 완료'):'';
    $('comparison-message').textContent=''; refreshSelection();return true;
  }
  function removeTarget(id,message='') {
    targets.delete(String(id));
    $('target-message').textContent=message;
    $('comparison-message').textContent='';
    refreshSelection();renderBrowse();
  }
  function renderTargets() {
    $('target').innerHTML=targets.size?'<h3>선택한 대상</h3>'+[...targets.values()].map(t=>`<div class="target-card"><strong>${esc(t.name)}</strong><span>${period(t.id,t.end)}</span><label>기준 시즌 <select data-target-year="${esc(t.id)}">${validYears(t.id).map(y=>`<option ${y===t.end?'selected':''}>${y}</option>`).join('')}</select></label><button type="button" data-target-remove="${esc(t.id)}" class="secondary">제거</button></div>`).join('')+table([...targets.values()].map(t=>({선수:t.name,기간:period(t.id,t.end),...t.stats}))):'<p class="hint">목록에서 대상 추가</p>';
    document.querySelectorAll('[data-target-remove]').forEach(button=>button.onclick=()=>{
      removeTarget(button.dataset.targetRemove);
    });
    document.querySelectorAll('[data-target-year]').forEach(select=>select.onchange=()=>{
      if(!addTarget(select.dataset.targetYear,+select.value))renderTargets();else renderBrowse();
    });
  }
  function playerDisplayName(player) {
    const duplicate = players.some(other => other.id !== player.id && other.name === player.name);
    const born = engine.groups.get(player.id)?.[0]?.Born;
    return duplicate && born ? `${player.name} · ${born} 출생` : player.name;
  }
  function renderPlayers() {
    const old=$('player').value,q=$('search').value.trim();
    const matches=players.filter(p=>C.matchesName(p.name,q));
    $('player').innerHTML='<option value="">선수 선택</option>'+matches.map(p=>`<option value="${esc(p.id)}">${esc(playerDisplayName(p))}</option>`).join('');
    if(matches.some(p=>p.id===old))$('player').value=old;
    $('direct-selection').hidden=true;
    const list=$('name-suggestions');list.hidden=!q;$('search').setAttribute?.('aria-expanded',String(!!q));
    list.innerHTML=q?(matches.length?matches.slice(0,30).map(p=>`<button type="button" class="name-suggestion" data-name-pick="${esc(p.id)}"><strong>${esc(playerDisplayName(p))}</strong><span>${esc(p.teams.join(' · '))}</span></button>`).join('')+(matches.length>30?'<p class="hint">이름을 더 입력하면 결과가 좁혀집니다.</p>':''):'<p class="hint">일치하는 선수 없음</p>'):'';
    list.querySelectorAll('[data-name-pick]').forEach(button=>button.onclick=()=>{
      const id=button.dataset.namePick,p=playersById.get(id);if(!p)return;
      $('player').value=id;$('search').value=p.name;populateSeason(id);
      list.hidden=true;$('search').setAttribute?.('aria-expanded','false');
    });
  }
  function populateSeason(id) {
    const available=id?validYears(id).filter(year=>aggregate(id,year)):[];
    $('season').innerHTML=available.map(y=>`<option>${y}</option>`).join('');
    $('direct-player-name').textContent=playersById.has(id)?playerDisplayName(playersById.get(id)):'';
    $('direct-selection').hidden=!id;
    $('add-direct-target').disabled=!available.length;
  }
  function renderComparePlayers() {
    const old=$('compare-player').value,q=$('compare-search').value.trim(),pm=positionMatcher('compare-position'),tm=teamMatcher('compare-team');
    const year=+$('recommend-year').value;
    const matches=players.filter(p=>!targets.has(p.id)&&p.name.includes(q)&&tm(p.teams)&&(engine.groups.get(p.id)||[]).some(row=>Number(row.Season)===year&&pm([row.Position])&&aggregate(p.id,year)));
    $('compare-player').innerHTML='<option value="">선수 선택</option>'+matches.map(p=>`<option value="${esc(p.id)}">${esc(playerDisplayName(p))}</option>`).join('');
    if(matches.some(p=>p.id===old))$('compare-player').value=old;
  }
  function addComparison(id,end) {
    if(!targets.size){$('compare-message').textContent='대상 선수 먼저 추가';return;}
    if(targets.has(id)){ $('compare-message').textContent='대상에 포함된 선수';return; }
    const key=C.selectionKey(id,end);
    if(chosen.has(key)){$('compare-message').textContent='이미 선택된 선수·시즌';return;}
    if(!aggregate(id,end)){$('compare-message').textContent='선택 시즌 기록 부족 또는 중복';return;}
    chosen.set(key,{id,end:Number(end)});$('compare-message').textContent='비교 선수 추가 완료';
    renderComparison();renderRecommendations();
  }
  function recommend() {
    if(!targets.size){suggestions=[];renderRecommendations();return;}
    const pm=positionMatcher('compare-position'),tm=teamMatcher('compare-team');
    suggestions=engine.recommend([...targets.values()],weights,(p,row)=>pm([row.Position])&&tm(p.teams),+$('recommend-year').value);
    renderRecommendations();
  }
  function renderRecommendations() {
    if(!targets.size){$('recommendations').textContent='대상 선수 추가 필요';return;}
    const cols=['선수','기간','포지션','차이',...C.metrics];
    $('recommendations').innerHTML=[...targets.values()].map(t=>{
      const candidates=suggestions.filter(c=>c.sourceId===t.id).sort((a,b)=>{
        const x=recSort==='선수'?a.name:recSort==='기간'?a.end:recSort==='포지션'?(C.positionText(a.row.Position)):recSort==='차이'?a.distance:a.stats[recSort];
        const y=recSort==='선수'?b.name:recSort==='기간'?b.end:recSort==='포지션'?(C.positionText(b.row.Position)):recSort==='차이'?b.distance:b.stats[recSort];
        return (typeof x==='string'?x.localeCompare(y,'ko'):x-y)*(recAscending?1:-1)||a.name.localeCompare(b.name,'ko');
      });
      return `<section class="recommend-group"><h3>${esc(t.name)} 기준 · ${$('recommend-year').value}년 기록으로 추천 <span class="badge neutral">${candidates.length}명</span></h3>${!candidates.length?'<p class="hint">선택 시즌의 비교 후보 없음</p>':`<div class="table-wrap"><table><thead><tr><th>선택</th>${cols.map(k=>`<th aria-sort="${recSort===k?(recAscending?'ascending':'descending'):'none'}"><button type="button" data-rec-sort="${k}">${k} ${recSort===k?(recAscending?'▲':'▼'):'↕'}</button></th>`).join('')}</tr></thead><tbody>${candidates.map(c=>`<tr><td><input type="checkbox" data-rec-id="${esc(c.id)}" data-rec-end="${c.end}" aria-label="${esc(t.name)} 기준 ${esc(c.name)} ${c.end} 선택" ${chosen.has(C.selectionKey(c.id,c.end))?'checked':''}></td><td>${esc(c.name)}</td><td>${period(c.id,c.end)}</td><td>${esc(C.positionText(c.row.Position))}</td><td>${fmt('차이',c.distance)}</td>${[...C.metrics,...C.detailMetrics].map(k=>`<td>${esc(displayStat(k,c.stats))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}<div class="future-results" id="future-${esc(t.id)}"></div></section>`;
    }).join('');
    document.querySelectorAll('[data-rec-sort]').forEach(button=>button.onclick=()=>{
      const k=button.dataset.recSort;recAscending=recSort===k?!recAscending:![...C.metrics,...C.detailMetrics].includes(k);recSort=k;renderRecommendations();
    });
    document.querySelectorAll('[data-rec-id]').forEach(input=>input.onchange=()=>{
      const id=input.dataset.recId,end=+input.dataset.recEnd,key=C.selectionKey(id,end);
      if(input.checked)addComparison(id,end);else {chosen.delete(key);renderComparison();renderRecommendations();}
    });
  }
  function renderComparison() {
    renderScouting(targets,chosen);
    const rows=[...targets.values()].map(t=>({선수:t.name,기간:period(t.id,t.end),...t.stats}));
    let controls='';
    for(const [key,c] of chosen) {
      const name=playersById.get(c.id).name;
      controls+=`<div class="selection"><strong>${esc(name)}</strong><label>기준 시즌 <select data-compare-key="${esc(key)}">${validYears(c.id).map(y=>`<option ${y===c.end?'selected':''}>${y}</option>`).join('')}</select></label><button type="button" class="secondary" data-compare-remove="${esc(key)}">제거</button></div>`;
      rows.push({선수:name,기간:period(c.id,c.end),...aggregate(c.id,c.end)});
    }
    $('comparison').innerHTML=controls+(rows.length?table(rows,true):'<p class="hint">대상 2명 또는 대상+비교 선수 선택 필요</p>');
    $('download').disabled=rows.length<2;
    if(rows.length===1)$('comparison').innerHTML+='<p class="hint">1명 추가 시 비교·CSV 활성화</p>';
    document.querySelectorAll('[data-compare-remove]').forEach(button=>button.onclick=()=>{
      chosen.delete(button.dataset.compareRemove);$('comparison-message').textContent='';renderComparison();renderRecommendations();
    });
    document.querySelectorAll('[data-compare-key]').forEach(select=>select.onchange=()=>{
      const oldKey=select.dataset.compareKey,old=chosen.get(oldKey),end=+select.value,newKey=C.selectionKey(old.id,end);
      if(!aggregate(old.id,end))$('comparison-message').textContent='선택 시즌 기록 부족 또는 중복 · 기존 시즌 유지';
      else if(newKey!==oldKey&&chosen.has(newKey))$('comparison-message').textContent='선수·시즌 중복 · 기존 선택 유지';
      else {chosen.delete(oldKey);chosen.set(newKey,{id:old.id,end});$('comparison-message').textContent='';}
      renderComparison();renderRecommendations();
    });
    $('download').onclick=()=>{
      if(rows.length<2)return;
      const cols=['선수','기간',...C.metrics,...C.detailMetrics];
      const csv=[cols,...rows.map(r=>cols.map(k=>k==='선수'||k==='기간'?r[k]:fmt(k,r[k])))].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
      const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download='kbo_season_comparison.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
  }
  function compareBrowse(a,b) {
    const key={'선수':'Player','시즌':'Season','구단':'Team','포지션':'Position'}[browseSort];
    const x=key?a.row[key]:a.stats?.[browseSort],y=key?b.row[key]:b.stats?.[browseSort];
    const numeric=!key||key==='Season',missingX=x==null||numeric&&!Number.isFinite(Number(x)),missingY=y==null||numeric&&!Number.isFinite(Number(y));
    if(missingX!==missingY)return missingX?1:-1;
    const diff=missingX?0:numeric?Number(x)-Number(y):String(x).localeCompare(String(y),'ko');
    const stolenBaseTieBreak=browseSort==='도루성공%'&&!missingX
      ?b.stats['도루']-a.stats['도루']:0;
    return diff*(browseAscending?1:-1)||stolenBaseTieBreak||a.row.Player.localeCompare(b.row.Player,'ko')||Number(b.row.Season)-Number(a.row.Season)||String(a.row.Id).localeCompare(String(b.row.Id));
  }
  function renderChips() {
    const chips=[];
    function chip(text,action){chips.push({text,action});}
    if($('browse-all-years').checked)chip('전체 시즌',()=>{setLatestYear();});
    else for(const input of checked('browse-year'))chip(`${input.value}년`,()=>{
      input.checked=false;if(!checked('browse-year').length)setLatestYear();
    });
    for(const [name,label] of [['browse-team','구단'],['browse-position','포지션']])for(const input of checked(name).filter(x=>x.value!=='전체'))chip(`${label}: ${name==='browse-position'?positionNames[input.value]:input.value}`,()=>{
      input.checked=false;normalizeGroup(input);
    });
    if($('browse-leaders').checked)chip('리그 최고만',()=>$('browse-leaders').checked=false);
    if($('browse-team-leaders').checked)chip('구단 최고만',()=>{$('browse-team-leaders').checked=false;$('browse-team-scope').disabled=false;});
    chip($('leader-scope').value==='year'?'연도별 최고':'선택 기간 최고',()=>$('leader-scope').value='period');
    if($('browse-team-scope').value==='career')chip('전체 경력',()=>$('browse-team-scope').value='season');
    $('filter-chips').innerHTML=chips.map((c,i)=>`<button type="button" class="chip" data-chip="${i}" aria-label="${esc(c.text)} 조건 해제">${esc(c.text)} ×</button>`).join('');
    document.querySelectorAll('[data-chip]').forEach(button=>button.onclick=()=>{chips[+button.dataset.chip].action();browseLimit=10;renderBrowse();});
  }
  function renderBrowse() {
    const yearSummary = $('browse-year-summary');
    if (yearSummary) {
      const years = selectedYears();
      yearSummary.textContent = $('browse-all-years').checked ? '전체 시즌'
        : years.length === 1 ? `${years[0]}년`
        : `${years.length}개 시즌 선택`;
    }
    const years=new Set(selectedYears()),scope=$('leader-scope').value,teamMode=$('browse-team-leaders').checked;
    const leagueOnly=$('browse-leaders').checked;
    if(teamMode)$('browse-team-scope').value='season';
    const career=$('browse-team-scope').value==='career';$('browse-team-scope').disabled=teamMode;
    $('team-scope-info').textContent=teamMode?'구단 최고 · 기록 당시 소속':career?'경력 구단 검색 · 표: 기록 당시 소속':'기록 당시 소속';
    $('qualification-info').textContent=`${years.size}개 시즌 · ${scope==='year'?'연도별 최고':'선택 기간 최고'} · 비율: 연도별 규정 타석 · 도루성공%: 도루 시도 기준`;
    const pool=records.filter(r=>years.has(Number(r.Season))&&r.Position!=='P').map(row=>({row,stats:C.stats([row])}));
    const leaders=C.leaderIndex(pool,scope);
    const hasFlag=(item,kind)=>[...C.metrics,...C.detailMetrics].some(k=>leaders.flags(item.row,item.stats,k)[kind]);
    const pm=positionMatcher('browse-position'),tm=teamMatcher('browse-team');
    const filtered=pool.filter(({row})=>pm([row.Position])&&tm(career?playersById.get(String(row.Id)).teams:[row.Team])).filter(item=>{
      // When both modes are on, show the union; colors retain the exact distinction.
      if(teamMode||leagueOnly)return teamMode&&hasFlag(item,'team')||leagueOnly&&hasFlag(item,'league');
      return true;
    }).sort(compareBrowse);
    renderChips();metadataMarkup();
    if(!filtered.length){$('browse-results').innerHTML='<p class="hint">결과 없음 · 조건을 조정하세요.</p>';return;}
    const cols=['선수','시즌','구단','포지션',...C.metrics,...C.detailMetrics];
    $('browse-results').innerHTML=`<p>${esc(browseSort)} ${browseAscending?'▲':'▼'} · ${filtered.length.toLocaleString()}개 기록 중 ${Math.min(browseLimit,filtered.length)}개</p><div class="table-wrap"><table><thead><tr><th>선택</th>${cols.map(k=>`<th aria-sort="${browseSort===k?(browseAscending?'ascending':'descending'):'none'}"><button type="button" data-browse-sort="${k}">${k} ${browseSort===k?(browseAscending?'▲':'▼'):'↕'}</button></th>`).join('')}</tr></thead><tbody>${filtered.slice(0,browseLimit).map(({row:r,stats:record})=>`<tr><td><button type="button" data-add-target="${esc(r.Id)}" data-add-year="${esc(r.Season)}">${targets.has(String(r.Id))?(targets.get(String(r.Id)).end===Number(r.Season)?'선택 취소':'기준 시즌 변경'):'대상 추가'}</button></td><td>${esc(r.Player)}</td><td>${esc(r.Season)}</td><td title="${esc(C.teamId(r.Team))}"><span class="club-badge"${teamStyle(r.Team)}>${esc(r.Team)}</span></td><td>${esc(C.positionText(r.Position))}</td>${[...C.metrics,...C.detailMetrics].map(k=>{
      const flags=leaders.flags(r,record,k),classes=[],labels=[];
      if(flags.league){classes.push('gold');labels.push('리그 최고');}
      if(teamMode&&flags.team){classes.push('team-best');labels.push('구단 최고');}
      return `<td${classes.length?` class="${classes.join(' ')}" title="${esc(labels.join(' · '))}"`:''}>${esc(displayStat(k,record))}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>${browseLimit<filtered.length?'<button type="button" id="browse-more" class="secondary">10개 더 보기</button>':''}`;
    document.querySelectorAll('[data-browse-sort]').forEach(button=>button.onclick=()=>{
      const k=button.dataset.browseSort;browseAscending=browseSort===k?!browseAscending:![...C.metrics,...C.detailMetrics].includes(k);browseSort=k;browseLimit=10;renderBrowse();
    });
    if($('browse-more'))$('browse-more').onclick=()=>{browseLimit+=10;renderBrowse();};
    document.querySelectorAll('[data-add-target]').forEach(button=>button.onclick=()=>{
      if(addTarget(button.dataset.addTarget,+button.dataset.addYear))renderBrowse();
      $('target-message').scrollIntoView({behavior:'smooth',block:'center'});
    });
  }
  function setLatestYear() {
    $('browse-all-years').checked=false;inputs('browse-year').forEach(input=>input.checked=Number(input.value)===allYears[0]);
  }
  function renderWeightInputs() {
    $('weight-inputs').innerHTML=C.metrics.map(k=>`<label>${k}<input type="number" min="0" max="10" step="1" data-weight="${k}" value="${weights[k]}" aria-label="${k} 추천 비중"></label>`).join('');
    const active=C.metrics.filter(k=>weights[k]>0),total=active.reduce((sum,k)=>sum+weights[k],0);
    $('weight-summary').textContent=active.map(k=>`${k} ${Math.round(weights[k]/total*100)}%`).join(' · ');
  }
  $('recommend-year').onchange=()=>{renderComparePlayers();recommend();};
  $('weight-form').onsubmit=event=>{
    event.preventDefault();const next={};
    for(const input of document.querySelectorAll('[data-weight]')) {
      const n=Number(input.value);
      if(input.value===''||!Number.isInteger(n)||n<0||n>10){$('weight-message').textContent='비중은 0~10의 정수';return;}
      next[input.dataset.weight]=n;
    }
    if(!Object.values(next).some(n=>n>0)){$('weight-message').textContent='지표를 하나 이상 선택하세요. 기존 추천 유지';return;}
    weights=next;$('weight-message').textContent='';renderWeightInputs();recommend();
  };
  $('reset-weights').onclick=()=>{weights=Object.fromEntries(C.metrics.map(k=>[k,1]));$('weight-message').textContent='';renderWeightInputs();recommend();};
  for(const kind of ['browse','compare'])for(const type of ['positions','teams'])$(`${kind}-${type}`).onchange=event=>{
    if(event.target.type!=='checkbox')return;normalizeGroup(event.target);
    if(kind==='browse'){browseLimit=10;renderBrowse();}
    else {renderComparePlayers();recommend();}
  };
  $('search').oninput=renderPlayers;
  $('search').onkeydown=event=>{if(event.key==='Escape'){$('name-suggestions').hidden=true;$('search').setAttribute?.('aria-expanded','false');}if(event.key==='ArrowDown'){$('name-suggestions').querySelector('[data-name-pick]')?.focus?.();}};
  $('player').onchange=()=>populateSeason($('player').value);
  $('add-direct-target').onclick=()=>{if(!$('player').value){$('target-message').textContent='대상 선수 선택 필요';return;}if(addTarget($('player').value,+$('season').value))renderBrowse();};
  $('compare-search').oninput=renderComparePlayers;
  $('add-player').onclick=()=>{
    const id=$('compare-player').value;
    if(!id){$('compare-message').textContent='비교 선수 선택 필요';return;}
    const year=+$('recommend-year').value;
    if(!aggregate(id,year)){$('compare-message').textContent='선택 시즌 기록 부족 또는 중복';return;}
    addComparison(id,year);
  };
  $('browse-all-years').onchange=()=>{
    if($('browse-all-years').checked)inputs('browse-year').forEach(input=>input.checked=false);else setLatestYear();
    browseLimit=10;renderBrowse();
  };
  $('browse-year-options').onchange=()=>{
    $('browse-all-years').checked=!checked('browse-year').length;browseLimit=10;renderBrowse();
  };
  for(const id of ['leader-scope','browse-team-scope','browse-leaders','browse-team-leaders'])$(id).onchange=()=>{browseLimit=10;renderBrowse();};
  $('reset-filters').onclick=()=>{
    setLatestYear();resetGroup('browse-team');resetGroup('browse-position');
    $('browse-team-scope').value='season';$('browse-team-scope').disabled=false;$('leader-scope').value='period';
    $('browse-leaders').checked=false;$('browse-team-leaders').checked=false;
    browseLimit=10;browseSort='선수';browseAscending=true;renderBrowse();
  };
  const params=new URLSearchParams(globalThis.location?.search);
  if(globalThis.location?.hash==='#final-comparison'){
    const imported=params.getAll('selection').slice(0,3);
    for(const key of imported){
      const [id,year,extra]=key.split('|');
      if(extra===undefined && playersById.has(id) && !targets.has(id) && aggregate(id,Number(year))){
        targets.set(id,{id,end:Number(year),name:playersById.get(id).name,stats:aggregate(id,Number(year))});
      }
    }
    if(targets.size)$('recommend-year').value=String(targets.values().next().value.end);
    if(imported.length!==targets.size)$('comparison-message').textContent='일부 후보의 선택 시즌을 기록 비교로 불러오지 못했습니다.';
  }
  renderWeightInputs();renderPlayers();renderComparePlayers();renderTargets();renderComparison();renderBrowse();
  if(targets.size){recommend();$('final-comparison')?.scrollIntoView?.();}
}
startApp().catch(error=>{
  document.getElementById('browse-results').textContent='자료 로딩 실패 · 서버/JSON 확인 필요';
  document.getElementById('data-status').textContent='불러오기 실패';console.error(error);
});
