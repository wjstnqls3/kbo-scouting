(function () {
  const $ = id => document.getElementById(id);
  const A = KBOAnalytics, C = KBOCore, P = KBOPortfolio, V = KBOCharts;
  const {esc} = V;
  const profiles = {onbase:'출루형', power:'장타형', contact:'콘택트형', balanced:'균형형', custom:'사용자 지정'};
  const priorities = ['미정', '우선 관찰', '추가 관찰', '보류'];
  const legacyMemoLabels = ['주목한 이유', '강점에 대한 의견', '추가 확인', '', '최종 의견'];
  const axisNames = ['안타', '볼넷', '삼진 억제', '순장타', '도루'];
  const pageSize = 15, maxSelected = 3;
  const keyOf = row => C.selectionKey(row.id, row.year);
  const fmt = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : '—';
  const signed = (value, digits = 1) => Number.isFinite(value) ? (value > 0 ? '+' : '') + fmt(value, digits) : '—';
  const raw = (value, key) => Number.isFinite(value) && ['bb','k','sb'].includes(key) ? fmt(value * 100, 2) + '%' : fmt(value, 3);
  const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
  const table = (headers, rows) => `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(value=>`<td>${esc(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const playerLabel = row => `${row.name} · ${row.team} · ${row.year}`;
  const hasPosition = row => C.knownPosition(row.position);
  const memoKey = key => 'kbo.scouting.memo.v1.' + key;

  const selected = new Map();
  const drafts = new Map();
  let engine, records, metadata;
  let ranked = [], visibleCount = pageSize, applied;
  let displayScreen;

  function usePreset(profile) {
    for (const {key} of A.comparisonAxes) $('weight-' + key).value = P.presets[profile][key];
  }

  function renderCandidates() {
    $('candidates').innerHTML = ranked.length ? ranked.slice(0, visibleCount).map(entry => {
      const {row} = entry;
      const key = keyOf(row);
      const axes = P.active(applied.weights).sort((a,b) => entry.scores[b.key].value - entry.scores[a.key].value);
      const evidence = axes.slice(0, 2).map(axis => `${axis.name} ${fmt(entry.scores[axis.key].value)}백분위`).join(' · ');
      const last = axes.at(-1);
      const cautions = [
        entry.scores[last.key].value < 50 ? `${last.name} ${fmt(entry.scores[last.key].value)}백분위` : '',
        row.stats.pa < C.requiredPA(row.year) ? '시즌 규정타석 참고값 미달' : '',
        !hasPosition(row) ? '세부 포지션 미확인' : '',
      ].filter(Boolean);
      return `<article class="candidate panel">
        <div class="rank" aria-label="${entry.rank}위">${entry.rank}<small>위</small></div>
        <div><h3>${esc(row.name)}</h3><p class="muted player-meta">${esc(row.team)} · ${esc(C.positionText(row.position))} · ${row.stats.pa}타석</p></div>
        <div class="candidate-notes"><p><strong>추천 근거</strong> ${esc(evidence)}</p><p><strong>검토 사항</strong> ${esc(cautions.join(' · ') || '시즌 기록의 재현성과 수비 출전 확인')}</p></div>
        <div class="candidate-actions"><strong class="score">${fmt(entry.value)}<small>점</small></strong>
        <label class="select-player"><input type="checkbox" data-candidate="${esc(key)}" ${selected.has(key)?'checked':''} aria-label="${esc(playerLabel(row))} 검토 대상 선택">선택</label></div>
      </article>`;
    }).join('') : '<p class="panel">순위를 산출할 수 있는 후보가 없습니다. 포지션이나 최소 타석을 조정해 보세요.</p>';
    $('more-candidates').hidden = visibleCount >= ranked.length;
  }

  function search(event) {
    event?.preventDefault();
    const minimum = Number($('minimum').value);
    const weights = Object.fromEntries(A.comparisonAxes.map(({key}) => {
      const value = $('weight-' + key).value;
      return [key, value === '' ? NaN : Number(value)];
    }));
    const message = $('form-message');
    if (!Number.isInteger(minimum) || minimum < 1 || !P.active(weights).length ||
        Object.values(weights).some(value => !Number.isInteger(value) || value < 0 || value > 10)) {
      message.textContent = '최소 타석은 1 이상, 지표 비중은 0~10의 정수로 입력하세요. 양수 비중이 하나 이상 필요합니다.';
      message.hidden = false;
      return;
    }
    message.hidden = true;
    const year = Number($('season').value), position = $('position').value;
    const pool = P.poolFor(engine, year, position, minimum);
    const entries = P.evaluate(pool, weights);
    ranked = entries.filter(entry => entry.rank);
    visibleCount = pageSize;
    applied = {weights, year, position, minimum, poolSize:pool.length, profile:profiles[$('profile').value]};
    $('pool-summary').textContent = `${year}년 · ${position ? C.positionText(position) : '전체 포지션'} · ${minimum}타석 이상 ${pool.length}명 · ${applied.profile} · 산출 ${ranked.length}명 · 보류 ${entries.length-ranked.length}명 · ${metadata.season_status?.[year] || '시즌 확정 여부 미확인'}`;
    const counts = P.active(weights).map(axis => `${axis.name} ${fmt(weights[axis.key],0)} 비중 · 유효 ${entries[0]?.scores[axis.key].n ?? 0}명`);
    $('candidate-method').textContent = counts.join(' / ');
    renderCandidates();
  }

  function updateSelection() {
    $('selection-count').textContent = `선택 ${selected.size}/${maxSelected}명`;
    $('selection-message').hidden = true;
    $('open-report').disabled = selected.size === 0;
    $('selected-players').innerHTML = [...selected].map(([key,{row}]) =>
      `<button class="tag" type="button" data-remove="${esc(key)}" aria-label="${esc(playerLabel(row))} 선택 해제">${esc(row.name)} ${row.year} ×</button>`).join('');
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

  function trend(row) {
    const history = P.timeline(engine, records, row, 3);
    if (!history) return '<p>동일 선수 ID의 출생 정보가 충돌해 시즌 연결을 보류합니다.</p>';
    const recorded = history.map(item=>item.row).filter(season=>Number.isFinite(season?.index));
    const first = recorded[0], last = recorded.at(-1);
    const summary = recorded.length > 1
      ? `${first.year}→${last.year}년 리그 대비 OPS ${signed(last.index-first.index)}점`
      : '비교 가능한 OPS 지수가 2시즌 미만입니다.';
    return `<p><strong>${summary}</strong></p>` + table(['시즌','타석','OPS','OPS 지수'],history.map(item=>
      item.row ? [item.year, item.row.stats.pa, fmt(item.row.stats.ops,3), fmt(item.row.index) + (item.row.stats.pa < A.comparisonMinPA ? ' (소타석)' : '')]
        : [item.year,item.rawPA ?? '—','—',item.hasRaw?'분석 제외':'기록 없음']));
  }

  function similar(row) {
    const matches = engine.similar(row, A.comparisonMinPA).slice(0, 3);
    return matches.length ? `<ol class="similar-list">${matches.map(({row:peer, differences}) =>
      `<li><strong>${esc(playerLabel(peer))}</strong><span>OPS 지수 ${signed(differences.opsIndex)}점 · ISO ${signed(differences.iso,3)} · 삼진율 ${signed(differences.k,2)}%p</span></li>`
    ).join('')}</ol>` : '<p>타석·필수 기록 또는 과거 비교 표본이 부족합니다.</p>';
  }

  function playerReport(evaluation) {
    const {row, axes, poolSize, positionKnown, provisional} = evaluation;
    const key = keyOf(row), entry = selected.get(key);
    const rated = axes.filter(axis=>Number.isFinite(axis.score)).sort((a,b)=>b.score-a.score);
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
      <header><h3>${esc(row.name)}</h3><p class="muted">${esc(row.team)} · ${row.year}년 · ${esc(C.positionText(row.position))} · ${row.stats.pa}타석</p>
      ${entry.entry ? `<p class="candidate-fit">${esc(entry.scope.profile)} 탐색 ${entry.entry.rank}위 · ${fmt(entry.entry.value)}점 · ${entry.scope.position ? esc(C.positionText(entry.scope.position)) : '전체 포지션'} ${entry.scope.minimum}타석 이상 ${entry.scope.poolSize}명</p>` : ''}</header>
      <section><h4>강점과 약점</h4>
        <p><strong>강점</strong> ${high || (rated.length ? '75백분위 이상인 지표 없음' : '비교 점수 없음')}</p>
        <p><strong>약점</strong> ${low || (rated.length ? '25백분위 이하인 지표 없음' : '비교 점수 없음')}</p>
        <p class="muted">${positionKnown ? `시즌·포지션 비교군 ${poolSize}명` : '세부 포지션 미확인으로 상대평가 보류'}${provisional ? ' · 소타석 참고' : ''} · ${esc(source)}</p>
        <details data-print-expand><summary>실제 기록과 지표별 표본</summary>
          ${table(['지표','실제 기록','백분위','유효 표본'],axes.map(axis=>[
            `${axis.name} (${axis.code})`,raw(axis.actual,axis.key),axis.score===null ? reasons[axis.reason] : fmt(axis.score),`${axis.n}명`
          ]))}
        </details>
      </section>
      <section><h4>최근 3시즌 성장 추세</h4>${trend(row)}</section>
      <section><h4>유사 선수</h4><p class="muted">과거 타격 성향이 가까운 시즌 · 차이는 유사 선수 기준</p>${similar(row)}</section>
      <section class="field-review"><h4>현장 확인</h4>
        <p>수비 위치별 출전과 수비 동작, 주루 판단, 부상·회복 상태, 계약 조건을 확인하세요.</p>
        <label class="screen-only">검토 우선순위<select data-review="${esc(key)}" data-field="5">${priorities.map(value=>`<option value="${value}" ${value===priority?'selected':''}>${value}</option>`).join('')}</select></label>
        <label class="screen-only">스카우트 관찰 메모<textarea data-review="${esc(key)}" data-field="3" rows="3">${esc(note)}</textarea></label>
        <p class="muted screen-only" role="status" data-storage="${esc(key)}">${readable?'이 브라우저에 자동 저장됩니다.':'이 브라우저에서 저장된 메모를 읽을 수 없습니다.'}</p>
        ${legacyNotes ? `<details data-print-expand><summary>이전 관찰 메모</summary>${legacyNotes}</details>` : ''}
        <p class="print-only"><strong>검토 우선순위</strong> <span data-print-priority="${esc(key)}">${priority}</span></p>
        <p class="print-only print-note"><strong>관찰 메모</strong> <span data-print-note="${esc(key)}">${esc(note || '미작성')}</span></p>
      </section>
    </article>`;
  }

  function renderReport() {
    $('report-empty').hidden = selected.size > 0;
    $('print-report').hidden = selected.size === 0;
    if (!selected.size) {
      $('report-subtitle').textContent = '';
      $('report-content').textContent = '';
      return;
    }
    const evaluations = A.compareBatters(engine,[...selected.values()].map(({row})=>row),true);
    $('report-subtitle').textContent = evaluations.map(({row})=>playerLabel(row)).join(' / ');
    const radar = V.radar(A.comparisonAxes.map((axis,i)=>`${axis.code} ${axisNames[i]}`),evaluations.map(item=>({
      name:playerLabel(item.row), values:item.axes.map(axis=>axis.score), provisional:item.provisional,
    })),{comparison:true, compact:true});
    $('report-content').innerHTML = `<section class="panel radar-panel">
      <h2>5개 타격·주루 지표</h2>
      <p class="muted">동일 시즌에서 세부 포지션이 하나 이상 겹치는 ${A.comparisonMinPA}타석 이상 타자와 비교합니다.</p>
      ${radar}
      <details class="method print-expand"><summary>계산 방식과 자료 범위</summary>
        <p>백분위 = (본인보다 불리한 값 수 + 동률 수 × 0.5) ÷ 지표별 유효 표본 × 100. 기준 충족 시 본인을 포함하며 삼진율은 낮을수록 유리합니다. 축별 유효 표본이 5명 미만이면 점수를 보류합니다. 선수별 시즌·포지션에 따라 비교군이 달라질 수 있습니다.</p>
        <p>${A.comparisonAxes.map(axis=>esc(axis.code + ' = ' + axis.formula)).join(' · ')}. 타석당 도루는 기록된 도루 빈도입니다.</p>
        <p>OPS 지수는 선수 OPS ÷ 해당 시즌 보유 기록의 합산 OPS × 100입니다. 유사 선수는 ${A.comparisonMinPA}타석 이상 과거 시즌에서 출루율·삼진율·ISO·볼넷률·OPS·홈런률의 표준화 거리로 선정합니다. 각 지표를 해당 시즌 리그 값으로 나누고, 삼진율은 방향을 뒤집습니다. 선수당 가장 가까운 한 시즌을 표시하며 차이는 유사 선수 − 평가 선수입니다.</p>
        <p>자료 ${esc(metadata.source_file || '동봉 CSV')} · 원 수집처 ${esc(metadata.original_source || '미확인')} · 수집일 ${esc(metadata.collected_at || '미확인')}</p>
      </details>
    </section><section class="player-grid" style="--players:${evaluations.length}" aria-label="선수별 평가">${evaluations.map(playerReport).join('')}</section>`;
  }

  function showScreen() {
    const next = ['#report','#final-comparison'].includes(location.hash) ? 'report' : 'discover';
    $('discover-screen').hidden = next !== 'discover';
    $('report-screen').hidden = next !== 'report';
    for (const name of ['discover','report']) {
      $(name + '-link').setAttribute('aria-current',name === next ? 'page' : 'false');
    }
    if (next === 'report') renderReport();
    if (displayScreen && displayScreen !== next) $(next + '-heading').focus();
    displayScreen = next;
  }

  function saveReview(event) {
    const {review:key,field} = event.target.dataset;
    if (!selected.has(key) || !['3','5'].includes(field)) return;
    const draft = draftFor(key);
    const {fields} = draft;
    fields[Number(field)] = event.target.value;
    const card = event.target.closest('.player-report');
    const status = card.querySelector('[data-storage]');
    card.querySelector('[data-print-priority]').textContent = fields[5] || priorities[0];
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
    records = battingData;
    metadata = typeof battingMetadata === 'undefined' ? {} : battingMetadata;
    engine = A.create(records);
    const years = [...engine.byYear.keys()].sort((a,b)=>b-a);
    if (!years.length) throw Error('분석할 시즌 기록이 없습니다.');
    const params = new URLSearchParams(location.search);
    $('season').innerHTML = years.map(year=>option(year,year)).join('');
    $('season').value = String(years.includes(Number(params.get('year'))) ? params.get('year') : years[0]);
    $('position').innerHTML = option('','전체 포지션') + Object.entries(C.positionNames).map(([key,label])=>option(key,label)).join('');
    $('profile').innerHTML = Object.entries(profiles).map(([key,label])=>option(key,label)).join('');
    $('weights').innerHTML = A.comparisonAxes.map(axis=>
      `<label>${esc(axis.name)}<input id="weight-${axis.key}" type="number" min="0" max="10" step="1"></label>`).join('');
    $('profile').value = 'onbase';
    usePreset('onbase');
    $('profile').onchange = () => { if ($('profile').value !== 'custom') usePreset($('profile').value); };
    $('weights').oninput = () => { $('profile').value = 'custom'; };
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
        const entry = ranked.find(item=>keyOf(item.row)===key);
        if (entry) selected.set(key,{row:entry.row,entry,scope:applied});
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
    $('open-report').onclick = () => { location.hash = 'report'; };
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
      expandedForPrint = [...$('report-content').querySelectorAll('[data-print-expand]')].filter(panel=>!panel.open);
      for (const panel of expandedForPrint) panel.open = true;
    });
    window.addEventListener('afterprint', () => {
      for (const panel of expandedForPrint) panel.open = false;
      expandedForPrint = [];
    });
    window.addEventListener('hashchange',showScreen);
    search();
    updateSelection();
    $('load-status').hidden = true;
    showScreen();
  } catch (error) {
    $('load-status').textContent = '스카우팅 자료를 불러올 수 없습니다. 데이터 파일을 확인하세요.';
    console.error(error);
  }
})();
