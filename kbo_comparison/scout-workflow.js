(function () {
  const $ = id => document.getElementById(id);
  const A = KBOAnalytics, C = KBOCore, P = KBOPortfolio, V = KBOCharts;
  const {esc} = V;
  const params = new URLSearchParams(location.search);
  const requestedMode = params.get('mode');
  const legacyLink = ['year','id','selection'].some(key=>params.has(key)) || location.hash === '#final-comparison';
  if (!requestedMode && !legacyLink) {
    $('start-screen').hidden = false;
    return;
  }
  const pitching = requestedMode === 'pitching';
  const mode = pitching ? 'pitching' : 'batting';
  const pitchingModel = KBOPitching;
  const axes = pitching ? pitchingModel.axes : A.comparisonAxes;
  const ranking = pitching ? pitchingModel : P;
  const unit = pitching ? '이닝' : '타석';
  const defaultMinimum = pitching ? pitchingModel.minimum : A.comparisonMinPA;
  const volume = row => pitching ? row.stats.outs/3 : row.stats.pa;
  const volumeText = row => pitching
    ? row.stats.outs === null ? '이닝 미확인' : pitchingModel.formatIP(row.stats.outs)+'이닝'
    : row.stats.pa+'타석';
  const poolFor = (year,position,minimum) => pitching
    ? pitchingModel.poolFor(engine,year,minimum)
    : P.poolFor(engine,year,position,minimum);
  const profileLabel = pitching ? '투구 유형' : '타격 유형';
  const profiles = pitching ? {balanced:'균형형', strikeout:'탈삼진형', walkControl:'볼넷 억제형', homerControl:'피홈런 억제형', custom:'사용자 지정'} : {onbase:'출루형', power:'장타형', contact:'콘택트형', balanced:'균형형', custom:'사용자 지정'};
  const priorities = ['미정', '우선 관찰', '추가 관찰', '보류'];
  const legacyMemoLabels = ['주목한 이유', '강점에 대한 의견', '추가 확인', '', '최종 의견'];
  const axisNames = pitching ? ['탈삼진','볼넷 억제','피홈런 억제','출루 억제'] : ['안타', '볼넷', '삼진 억제', '순장타', '도루'];
  const trendNames = pitching
    ? {k:'탈삼진율',bb:'볼넷률',hr:'9이닝당 피홈런',whip:'이닝당 출루 허용'}
    : {avg:'타율',bb:'볼넷률',k:'삼진율',iso:'순수 장타율',sb:'타석당 도루'};
  const pageSize = 15, maxSelected = 3;
  const keyOf = row => C.selectionKey(row.id, row.year);
  const fmt = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '—';
  const signed = (value, digits = 1) => Number.isFinite(value) ? (value > 0 ? '+' : '') + fmt(value, digits) : '—';
  const raw = (value, key) => Number.isFinite(value) && (pitching ? ['bb','k'] : ['bb','k','sb']).includes(key) ? fmt(value * 100, 2) + '%' : fmt(value, 3);
  const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
  const table = (headers, rows) => `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const playerLabel = row => `${row.name} · ${row.team} · ${row.year}`;
  const memoKey = key => (pitching ? 'kbo.scouting.pitching.memo.v1.' : 'kbo.scouting.memo.v1.') + key;

  const selected = new Map();
  const drafts = new Map();
  let engine, records, metadata, firstSeason;
  let ranked = [], visibleCount = pageSize, applied;
  let activeTab = 'overview';
  let candidates = [];

  function showWeightValues() {
    for (const {key} of axes) $('weight-value-' + key).textContent = $('weight-' + key).value;
  }

  function seasonCheckpoint(row) {
    const previous = engine.lookup.get(C.selectionKey(row.id,row.year-1));
    if (!previous || volume(previous)<defaultMinimum) return '';
    const metrics = pitching
      ? [{key:'era',name:'ERA',threshold:0.75},{key:'whip',name:'WHIP',threshold:0.15}]
      : [{key:'index',name:'리그 대비 OPS 지수',threshold:15}];
    const changes = metrics.flatMap(({key,name,threshold})=>{
      const before = pitching ? previous.stats[key] : previous.index;
      const after = pitching ? row.stats[key] : row.index;
      if (!Number.isFinite(before) || !Number.isFinite(after)) return [];
      const decline = (pitching ? after-before : before-after)/threshold;
      if (decline<1) return [];
      const digits = pitching ? 2 : 1;
      return [{decline,text:`${row.year-1}→${row.year}년 ${name} ${fmt(before,digits)} → ${fmt(after,digits)}`}];
    });
    return changes.sort((a,b)=>b.decline-a.decline)[0]?.text || '';
  }

  function scoutingCheckpoints(row) {
    if (pitching && row.stats.outs===null) return ['이닝 기록 결측 · 표본 판단 보류'];
    if (volume(row)<defaultMinimum) {
      return [`${volumeText(row)} · 비교 기준 ${defaultMinimum}${unit} 미달`];
    }
    const evaluation = pitching ? engine.compare(row) : A.compareBatters(engine,[row],true)[0];
    const rated = evaluation.axes.filter(axis=>Number.isFinite(axis.score)).sort((a,b)=>a.score-b.score);
    const change = seasonCheckpoint(row);
    if (!rated.length) {
      const reason = evaluation.positionKnown ? '기록·비교 표본 부족' : '세부 포지션 미확인';
      return [`유효 지표 0/${evaluation.axes.length}개 · ${reason}으로 상대평가 보류`,change].filter(Boolean);
    }
    const describe = axis => `${axis.code} ${raw(axis.actual,axis.key)} · ${axis.name} ${fmt(axis.score)}백분위`;
    const weakest = rated[0];
    const second = rated.slice(1).find(axis=>!pitching || !['bb','whip'].includes(weakest.key) || !['bb','whip'].includes(axis.key));
    const checks = [weakest.score<=25 ? describe(weakest) : '',change,
      second?.score<=25 ? describe(second) : ''].filter(Boolean).slice(0,2);
    if (checks.length) return checks;
    const strongest = rated.at(-1);
    return strongest.score>=85 ? [describe(strongest)] : [];
  }

  function renderCandidates() {
    const query = $('player-search').value.trim();
    candidates = ranked;
    if (query) {
      const matching = row => C.matchesName(row.name,query);
      const rankedMatches = ranked.filter(({row})=>matching(row));
      const rankedKeys = new Set(rankedMatches.map(({row})=>keyOf(row)));
      const unranked = poolFor(applied.year,applied.position,pitching ? 0 : 1)
        .filter(row=>matching(row)&&!rankedKeys.has(keyOf(row))).map(row=>({row}));
      candidates = [...rankedMatches,...unranked];
    }
    $('candidates').innerHTML = candidates.length ? candidates.slice(0, visibleCount).map(entry => {
      const {row} = entry;
      const key = keyOf(row);
      const activeAxes = ranking.active(applied.weights).sort((a,b) => (entry.scores?.[b.key].value ?? 0) - (entry.scores?.[a.key].value ?? 0));
      const evidence = !entry.rank ? (row.stats.outs === null && pitching ? '이닝 미확인' : volume(row) < applied.minimum ? '최소 '+unit+' 미달' : '유효 표본 또는 기록 부족') : activeAxes.slice(0, 2).map(axis => `${axis.name} ${fmt(entry.scores[axis.key].value)}백분위`).join(' · ');
      const checkpoints = scoutingCheckpoints(row);
      return `<article class="candidate">
        <div class="rank">${entry.rank ? entry.rank+'<small>위</small>' : '—'}</div>
        <div><h3>${esc(row.name)}</h3><p class="muted player-meta">${esc(row.team)} · ${pitching ? '' : esc(C.positionText(row.position))+' · '}${volumeText(row)}</p></div>
        <div class="candidate-notes"><p><strong>${entry.rank ? '추천 근거' : '순위 보류'}</strong> ${esc(evidence)}</p>${checkpoints.length ? `<p><strong>스카우팅 체크포인트</strong> ${esc(checkpoints.join(' / '))}</p>` : ''}</div>
        <div class="candidate-actions"><strong class="score">${entry.rank ? fmt(entry.value)+'<small>점</small>' : '—'}</strong>
        <label class="select-player"><input type="checkbox" data-candidate="${esc(key)}" ${selected.has(key)?'checked':''} aria-label="${esc(playerLabel(row))} 검토 대상 선택">선택</label></div>
      </article>`;
    }).join('') : '<p class="empty">'+(query ? (pitching ? '선택 시즌에 검색 결과가 없습니다.' : '시즌·포지션에 맞는 검색 결과가 없습니다.') : '순위를 산출할 수 있는 후보가 없습니다.')+'</p>';
    $('more-candidates').hidden = visibleCount >= candidates.length;
  }

  function search(event) {
    event?.preventDefault();
    const minimum = Number($('minimum').value);
    const profile = $('profile').value;
    const weights = profile === 'custom'
      ? Object.fromEntries(axes.map(({key})=>[key,Number($('weight-' + key).value)]))
      : ranking.presets[profile];
    const message = $('form-message');
    const issue = !ranking.active(weights).length ? '모든 가중치가 0입니다. 지표를 하나 이상 1 이상으로 올려주세요.'
      : !Number.isInteger(minimum) || minimum < 1 ? `최소 ${unit}을 1 이상의 정수로 입력하세요.` : '';
    message.hidden = !issue;
    message.textContent = issue ? issue + (applied ? ' 아래에는 마지막으로 계산한 순위를 표시합니다.' : '') : '';
    if (issue) return;
    const year = Number($('season').value), position = $('position').value;
    $('switch-batting').setAttribute('href',`?mode=batting&year=${year}`);
    $('switch-pitching').setAttribute('href',`?mode=pitching&year=${year}`);
    const pool = poolFor(year,position,minimum);
    const entries = ranking.evaluate(pool,weights);
    ranked = entries.filter(entry => entry.rank);
    visibleCount = pageSize;
    applied = {weights, year, position, minimum, poolSize:pool.length, profile:profiles[profile]};
    $('pool-summary').textContent = `${year}년 · ${pitching ? '전체 투수' : position ? C.positionText(position) : '전체 포지션'} · ${minimum}${unit} 이상 ${pool.length}명 · ${applied.profile} · 산출 ${ranked.length}명 · 보류 ${entries.length-ranked.length}명 · ${metadata.season_status?.[year] || '시즌 확정 여부 미확인'}`;
    const counts = ranking.active(weights).map(axis => `${axis.name} ${fmt(weights[axis.key],0)} 비중 · 유효 ${entries[0]?.scores[axis.key].n ?? 0}명`);
    $('candidate-method').textContent = counts.join(' / ');
    renderCandidates();
  }

  function updateSelection() {
    $('selection-count').textContent = `선택 ${selected.size}/${maxSelected}명`;
    $('selection-message').hidden = true;
    $('print-report').disabled = selected.size === 0;
    $('selected-players').innerHTML = [...selected].map(([key,{row}]) =>
      `<button class="tag" type="button" data-remove="${esc(key)}" aria-label="${esc(playerLabel(row))} 선택 해제">${esc(row.name)} ${row.year} ×</button>`).join('');
    renderReport();
  }

  function draftFor(key) {
    if (!drafts.has(key)) {
      let fields = [], readable = true;
      try {
        const stored = JSON.parse(localStorage.getItem(memoKey(key)) || '[]');
        if (Array.isArray(stored)) fields = stored;
      } catch {
        readable = false;
      }
      drafts.set(key, {fields, readable});
    }
    return drafts.get(key);
  }

  function trendHistory(row, axis) {
    const history = pitching
      ? Array.from({length:3},(_,i)=>row.year-2+i).filter(year=>year>=firstSeason)
          .map(year=>({year,row:engine.lookup.get(C.selectionKey(row.id,year))}))
      : P.timeline(engine,records,row,3);
    if (!history) return [];
    return history.map(({year,row:season,hasRaw,rawPA})=>{
      if (!season) return {year,value:null,sample:rawPA==null ? '' : rawPA+'타석',missing:hasRaw?'분석 제외':'기록 없음'};
      const value = pitching ? season.stats[axis.key] : A.comparisonMetric(season,axis).actual;
      return {year,value,sample:volumeText(season),lowSample:volume(season)<defaultMinimum,missing:'지표 결측'};
    });
  }

  function trendChange(points, axis, format) {
    if (!points.length) return '출생 정보 불일치로 추세 비교 보류';
    const qualified = points.filter(point=>Number.isFinite(point.value)&&!point.lowSample);
    if (qualified.length<2) return `${defaultMinimum}${unit} 이상 유효 기록 2시즌 미만 · 판단 보류`;
    const before = qualified[0], after = qualified.at(-1);
    const previous = format(before.value), latest = format(after.value);
    const direction = previous===latest ? '변화 없음' : (after.value-before.value)*(axis.direction??1)>0 ? '개선' : '하락';
    return `${before.year}→${after.year}년 ${direction} · ${previous} → ${latest}`;
  }

  function renderTrend() {
    const axis = axes.find(item=>item.key===$('trend-metric').value);
    const label = axis.code+' '+trendNames[axis.key];
    const format = value => raw(value,axis.key);
    const series = [...selected.values()].map(({row})=>({name:playerLabel(row),points:trendHistory(row,axis)}));
    $('trend-direction').textContent = `${label} · ${(axis.direction??1)>0?'높을수록':'낮을수록'} 유리`;
    $('trend-plot').innerHTML = V.seasonTrend(series,label,format);
    $('trend-summary').innerHTML = series.map(({name,points})=>`<section>
      <h4>${esc(name)}</h4>
      <p>${esc(trendChange(points,axis,format))}</p>
      <p class="muted">${points.map(point=>{
        const parts = [point.sample,Number.isFinite(point.value) ? (point.lowSample?'소표본':'') : point.missing];
        return esc(point.year+'년 '+parts.filter(Boolean).join(' · '));
      }).join(' / ')}</p>
    </section>`).join('');
  }

  function similar(row) {
    if (pitching) {
      const matches = engine.similar(row);
      return matches.length ? `<ol class="similar-list">${matches.map(({row:peer})=>{
        const diffs = axes.slice(0,3).map(({key,code})=>`${code} ${signed((peer.stats[key]-row.stats[key])*(key==='hr'?1:100),2)}${key==='hr'?'':'%p'}`);
        return `<li><strong>${esc(playerLabel(peer))}</strong><span>${diffs.join(' · ')}</span></li>`;
      }).join('')}</ol>` : '<p>이닝·필수 기록 또는 비교 표본이 부족합니다.</p>';
    }
    const matches = engine.similar(row, A.comparisonMinPA).slice(0, 3);
    return matches.length ? `<ol class="similar-list">${matches.map(({row:peer, differences}) =>
      `<li><strong>${esc(playerLabel(peer))}</strong><span>OPS 지수 ${signed(differences.opsIndex)}점 · ISO ${signed(differences.iso,3)} · 삼진율 ${signed(differences.k,2)}%p</span></li>`
    ).join('')}</ol>` : '<p>타석·필수 기록 또는 과거 비교 표본이 부족합니다.</p>';
  }

  function pitchingDetails(stats) {
    return `<h4>시즌 결과와 등판 기록</h4>` + table(['ERA','이닝','경기','세이브','홀드'],[[
      fmt(stats.era,2),pitchingModel.formatIP(stats.outs),fmt(stats.g,0),fmt(stats.sv,0),fmt(stats.hld,0),
    ]]);
  }
  function playerReport(evaluation) {
    const {row, axes:playerAxes, poolSize, positionKnown, provisional} = evaluation;
    const key = keyOf(row), entry = selected.get(key);
    const rated = playerAxes.filter(axis=>Number.isFinite(axis.score)).sort((a,b)=>b.score-a.score);
    const describe = list => list.slice(0,2).map(axis=>`${axis.name} ${fmt(axis.score)}백분위`).join(' · ');
    const high = describe(rated.filter(axis=>axis.score>=75));
    const low = describe([...rated].reverse().filter(axis=>axis.score<=25));
    const {fields, readable} = draftFor(key);
    const note = typeof fields[3] === 'string' ? fields[3] : '';
    const priority = priorities.includes(fields[5]) ? fields[5] : priorities[0];
    const legacyNotes = legacyMemoLabels.map((label,i)=>label && typeof fields[i] === 'string' && fields[i].trim()
      ? `<p><strong>${label}</strong> ${esc(fields[i])}</p>` : '').join('');
    const reasons = {missing:'원자료 결측',invalid:'계산 불가',position:'포지션 미확인',sample:'유효 표본 5명 미만'};
    const source = metadata.season_status?.[row.year] || '확정 여부 미확인';
    return `<article class="player-report panel">
      <header><h3>${esc(row.name)}</h3><p class="muted">${esc(row.team)} · ${row.year}년 · ${pitching ? '' : esc(C.positionText(row.position))+' · '}${volumeText(row)}</p>
      </header>
      <section data-analysis="overview"><p class="priority"><strong>검토 우선순위</strong> <span data-priority-label>${priority}</span></p>
        <p><strong>강점</strong> ${high || (rated.length ? '75백분위 이상인 지표 없음' : '비교 점수 없음')}</p>
        <p><strong>약점</strong> ${low || (rated.length ? '25백분위 이하인 지표 없음' : '비교 점수 없음')}</p>
        <p class="muted">${positionKnown ? `${pitching ? '동일 시즌' : '시즌·포지션'} 비교군 ${poolSize}명` : '세부 포지션 미확인으로 상대평가 보류'}${provisional ? (pitching ? ' · 적은 이닝 참고' : ' · 소타석 참고') : ''} · ${esc(source)}</p>
        <details data-print-expand><summary>실제 기록과 지표별 표본</summary>
          ${entry.entry ? `<p class="candidate-fit">${esc(entry.scope.profile)} 탐색 ${entry.entry.rank}위 · ${fmt(entry.entry.value)}점 · ${pitching ? '전체 투수' : entry.scope.position ? esc(C.positionText(entry.scope.position)) : '전체 포지션'} ${entry.scope.minimum}${unit} 이상 ${entry.scope.poolSize}명</p>` : ''}
          ${table(['지표','실제 기록','백분위','유효 표본'],playerAxes.map(axis=>[
            `${axis.name} (${axis.code})`,raw(axis.actual,axis.key),axis.score===null ? reasons[axis.reason] : fmt(axis.score),`${axis.n}명`
          ]))}
          ${pitching ? pitchingDetails(row.stats) : ''}
        </details>
      </section>
      <section data-analysis="similar"><h4>유사 선수</h4><p class="muted">${pitching ? '탈삼진·볼넷·피홈런 백분위가 가까운 시즌 · 차이는 유사 선수 − 평가 선수' : '과거 타격 성향이 가까운 시즌 · 차이는 유사 선수 기준'}</p>${similar(row)}</section>
      <section data-analysis="field" class="field-review"><h4>현장 확인</h4>
        <p>${pitching ? '등판 역할·등판 간격, 구속·구종·회전수, 부상·회복 상태와 계약 조건을 현장에서 확인하세요.' : '수비 위치별 출전과 수비 동작, 주루 판단, 부상·회복 상태, 계약 조건을 확인하세요.'}</p>
        <label class="screen-only">검토 우선순위<select data-review="${esc(key)}" data-field="5">${priorities.map(value=>`<option value="${value}" ${value===priority?'selected':''}>${value}</option>`).join('')}</select></label>
        <label class="screen-only">스카우트 관찰 메모<textarea data-review="${esc(key)}" data-field="3" rows="3">${esc(note)}</textarea></label>
        <p class="muted screen-only" role="status" data-storage="${esc(key)}">${readable?'이 브라우저에 자동 저장됩니다.':'이 브라우저에서 저장된 메모를 읽을 수 없습니다.'}</p>
        ${legacyNotes ? `<details data-print-expand><summary>이전 관찰 메모</summary>${legacyNotes}</details>` : ''}
        <p class="print-only print-note"><strong>관찰 메모</strong> <span data-print-note="${esc(key)}">${esc(note || '미작성')}</span></p>
      </section>
    </article>`;
  }

  function renderReport() {
    $('report-empty').hidden = selected.size > 0;
    $('analysis').hidden = selected.size === 0;
    if (!selected.size) {
      $('radar-content').textContent = '';
      $('report-content').textContent = '';
      return;
    }
    const players = [...selected.values()].map(({row})=>row);
    const evaluations = pitching ? players.map(engine.compare) : A.compareBatters(engine,players,true);
    const radar = V.radar(axes.map((axis,i)=>`${axis.code} ${axisNames[i]}`),evaluations.map(item=>({
      name:playerLabel(item.row), values:item.axes.map(axis=>axis.score), provisional:item.provisional, provisionalText:pitching ? '적은 이닝 참고' : undefined,
    })),{comparison:true, compact:true});
    $('radar-content').innerHTML = `${radar}<div class="radar-meta">
      <p class="muted radar-scope">${pitching ? `같은 시즌 · ${defaultMinimum}이닝 이상 투수 기준` : `같은 시즌 · 세부 포지션이 겹치는 ${defaultMinimum}타석 이상 타자 기준`}</p>
      <details class="method" data-print-expand><summary>계산 방식과 자료 범위</summary>
        <p>백분위 = (본인보다 불리한 값 수 + 동률 수 × 0.5) ÷ 지표별 유효 표본 × 100. 기준 충족 시 본인을 포함합니다. ${pitching ? 'K%는 높을수록, BB%·HR/9·WHIP은 낮을수록 유리합니다. 비교군은 선수별 시즌에 따라 달라집니다.' : '삼진율은 낮을수록 유리합니다. 선수별 시즌·포지션에 따라 비교군이 달라질 수 있습니다.'} 축별 유효 표본이 5명 미만이면 점수를 보류합니다.</p>
        <p>${axes.map(axis=>esc(axis.code + ' = ' + axis.formula)).join(' · ')}${pitching ? '. K%·BB%·HR/9는 투구 특성, WHIP은 허용 출루 결과입니다. ERA는 상세 기록에서 확인할 수 있습니다.' : '. 타석당 도루는 기록된 도루 빈도입니다.'}</p>
        <p>${pitching ? `유사 선수는 해당 시즌과 이전 시즌의 ${defaultMinimum}이닝 이상 기록에서 K%·BB%·HR/9의 시즌 내 백분위 거리가 가까운 순으로 선수당 한 시즌을 고릅니다. 이 세 지표 중 점수를 계산할 수 없는 항목이 있으면 유사도에서 제외합니다.` : 'OPS 지수는 선수 OPS ÷ 해당 시즌 보유 기록의 합산 OPS × 100입니다. 유사 선수는 '+defaultMinimum+'타석 이상 과거 시즌에서 출루율·삼진율·ISO·볼넷률·OPS·홈런률의 표준화 거리로 선정합니다. 각 지표를 해당 시즌 리그 값으로 나누고, 삼진율은 방향을 뒤집습니다. 선수당 가장 가까운 한 시즌을 표시하며 차이는 유사 선수 − 평가 선수입니다.'}</p>
        <p>자료 ${esc(metadata.source_file || '동봉 CSV')} · 원 수집처 ${esc(metadata.original_source || '미확인')} · 수집일 ${esc(metadata.collected_at || '미확인')}</p>
      </details></div>`;
    $('report-content').innerHTML = `<div class="player-grid" style="--players:${evaluations.length}">${evaluations.map(playerReport).join('')}</div>`;
    renderTrend();
    setTab(activeTab);
  }

  function setTab(tab) {
    activeTab = tab;
    for (const button of $('analysis-tabs').querySelectorAll('[data-tab]')) {
      const active = button.dataset.tab === tab;
      button.setAttribute('aria-selected',String(active));
      button.tabIndex = active ? 0 : -1;
    }
    $('analysis-panel').setAttribute('aria-labelledby','tab-'+tab);
    $('trend-panel').hidden = tab !== 'trend';
    $('report-content').hidden = tab === 'trend';
    for (const panel of $('report-content').querySelectorAll('[data-analysis]')) {
      panel.hidden = panel.dataset.analysis !== tab;
    }
  }

  function saveReview(event) {
    const {review:key,field} = event.target.dataset;
    if (!selected.has(key) || !['3','5'].includes(field)) return;
    const draft = draftFor(key);
    const {fields} = draft;
    fields[Number(field)] = event.target.value;
    const card = event.target.closest('.player-report');
    const status = card.querySelector('[data-storage]');
    card.querySelector('[data-priority-label]').textContent = fields[5] || priorities[0];
    card.querySelector('[data-print-note]').textContent = fields[3] || '미작성';
    try {
      if (!draft.readable) {
        // Read again before saving so an inaccessible earlier draft is never overwritten.
        const previous = JSON.parse(localStorage.getItem(memoKey(key)) || '[]');
        if (Array.isArray(previous)) {
          draft.fields = Object.assign(previous, fields);
        }
      }
      localStorage.setItem(memoKey(key),JSON.stringify(draft.fields));
      draft.readable = true;
      status.textContent = '저장했습니다.';
    } catch {
      status.textContent = '이 브라우저에 저장할 수 없습니다. 현재 메모는 PDF에 포함됩니다.';
    }
  }

  try {
    $('dashboard-header').hidden = false;
    $('dashboard-main').hidden = false;
    $('dashboard-title').textContent = pitching ? 'KBO 투수 스카우팅' : 'KBO 타자 스카우팅';
    $('switch-'+mode).setAttribute('aria-current','page');
    records = pitching ? pitchingData : battingData;
    metadata = pitching ? pitchingMetadata : typeof battingMetadata === 'undefined' ? {} : battingMetadata;
    engine = pitching ? pitchingModel.create(records) : A.create(records);
    const years = [...engine.byYear.keys()].sort((a,b)=>b-a);
    if (!years.length) throw Error('분석할 시즌 기록이 없습니다.');
    firstSeason = years.at(-1);
    if (pitching) {
      $('dashboard').setAttribute('data-mode','pitching');
      $('position-control').hidden = true;
      $('profile-label').textContent = profileLabel;
      $('radar-heading').textContent = '4개 투구 지표';
      $('minimum-summary').textContent = '최소 이닝 설정';
      $('minimum-label').textContent = '최소 이닝';
      $('minimum').value = String(defaultMinimum);
      $('candidate-explanation').textContent = '지표별 백분위의 가중평균입니다. 동률은 절반씩 반영합니다. K%는 높을수록, BB%·HR/9·WHIP은 낮을수록 유리합니다. 지표별 유효 표본이 5명 미만이거나 필수 기록이 없으면 순위를 보류합니다.';
    }
    $('season').innerHTML = years.map(year=>option(year,year)).join('');
    $('season').value = String(years.includes(Number(params.get('year'))) ? params.get('year') : years[0]);
    $('position').innerHTML = option('','전체 포지션') + Object.entries(C.positionNames).map(([key,label])=>option(key,label)).join('');
    $('profile').innerHTML = Object.entries(profiles).map(([key,label])=>option(key,label)).join('');
    $('trend-metric').innerHTML = axes.map(axis=>option(axis.key,axis.code+' '+trendNames[axis.key])).join('');
    $('trend-metric').onchange = renderTrend;
    $('weights').innerHTML = axes.map(({key,name})=>
      `<div class="weight-control"><label for="weight-${key}">${esc(name)}</label><span id="weight-value-${key}" class="weight-value" aria-hidden="true"></span><input id="weight-${key}" type="range" min="0" max="10" step="1"></div>`).join('');
    $('profile').value = pitching ? 'balanced' : 'onbase';
    let lastPreset = $('profile').value, customStarted = false;
    $('profile').onchange = () => {
      const profile = $('profile').value;
      $('custom-weights').hidden = profile !== 'custom';
      if (profile !== 'custom') lastPreset = profile;
      else if (!customStarted) {
        for (const {key} of axes) $('weight-' + key).value = ranking.presets[lastPreset][key];
        showWeightValues();
        customStarted = true;
      }
      search();
    };
    $('season').onchange = $('position').onchange = () => search();
    $('player-search').oninput = () => { visibleCount = pageSize; renderCandidates(); };
    $('player-search').onkeydown = event => {
      if (event.isComposing || !$('player-search').value.trim()) return;
      const first = $('candidates').querySelector('[data-candidate]');
      if (!first || !['ArrowDown','Enter'].includes(event.key)) return;
      event.preventDefault();
      first.focus();
      if (event.key === 'Enter' && !first.checked) first.click();
    };
    $('candidates').onkeydown = event => {
      if (!event.target.dataset.candidate || !['ArrowDown','ArrowUp','Enter'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Enter') { event.target.click(); return; }
      const inputs = [...$('candidates').querySelectorAll('[data-candidate]')];
      const next = inputs.indexOf(event.target) + (event.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) $('player-search').focus();
      else inputs[next]?.focus();
    };
    $('weights').oninput = () => {
      showWeightValues();
      search();
    };
    $('discover-form').noValidate = true;
    $('discover-form').onsubmit = search;
    $('more-candidates').onclick = () => {
      const firstNew = visibleCount;
      visibleCount += pageSize;
      renderCandidates();
      $('candidates').querySelectorAll('[data-candidate]')[firstNew]?.focus();
    };
    $('candidates').onchange = event => {
      const input = event.target, key = input.dataset.candidate;
      if (!key) return;
      if (!input.checked) selected.delete(key);
      else {
        if (selected.size >= maxSelected) {
          input.checked = false;
          $('selection-message').textContent = '최대 3명까지 선택할 수 있습니다.';
          $('selection-message').hidden = false;
          return;
        }
        const entry = candidates.find(item=>keyOf(item.row)===key);
        if (entry) selected.set(key,{row:entry.row,entry:entry.rank ? entry : null,scope:applied});
      }
      updateSelection();
    };
    $('selected-players').onclick = event => {
      const key = event.target.dataset.remove;
      if (!key) return;
      selected.delete(key);
      renderCandidates();
      updateSelection();
      const input = [...$('candidates').querySelectorAll('[data-candidate]')].find(item=>item.dataset.candidate===key);
      if (input) input.focus();
      else $('season').focus();
    };
    const tabs = [...$('analysis-tabs').querySelectorAll('[data-tab]')];
    for (const tab of tabs) tab.onclick = () => setTab(tab.dataset.tab);
    $('analysis-tabs').onkeydown = event => {
      const index = tabs.indexOf(event.target);
      const moves = {ArrowLeft:(index+tabs.length-1)%tabs.length, ArrowRight:(index+1)%tabs.length, Home:0, End:tabs.length-1};
      if (index < 0 || !Object.hasOwn(moves,event.key)) return;
      event.preventDefault();
      const next = tabs[moves[event.key]];
      setTab(next.dataset.tab);
      next.focus();
    };
    $('print-report').onclick = () => window.print();
    $('report-content').oninput = event => { if (event.target.dataset.field === '3') saveReview(event); };
    $('report-content').onchange = event => { if (event.target.dataset.field === '5') saveReview(event); };

    const requested = [...new Set(params.getAll('selection'))];
    if (!requested.length && params.has('id')) requested.push(C.selectionKey(params.get('id'),Number($('season').value)));
    for (const key of requested) {
      const row = engine.lookup.get(key);
      if (row && selected.size < maxSelected) selected.set(key,{row});
    }
    let expandedForPrint = [];
    window.addEventListener('beforeprint', () => {
      expandedForPrint = ['radar-content','report-content'].flatMap(id=>[...$(id).querySelectorAll('[data-print-expand]')]).filter(panel=>!panel.open);
      for (const panel of expandedForPrint) panel.open = true;
    });
    window.addEventListener('afterprint', () => {
      for (const panel of expandedForPrint) panel.open = false;
      expandedForPrint = [];
    });
    search();
    updateSelection();
    $('load-status').hidden = true;
    $('dashboard').hidden = false;
  } catch (error) {
    $('load-status').textContent = '스카우팅 자료를 불러올 수 없습니다. 데이터 파일을 확인하세요.';
    console.error(error);
  }
})();
