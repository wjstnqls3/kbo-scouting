(async function () {
  const $ = id => document.getElementById(id);
  const A = KBOAnalytics, C = KBOCore, P = KBOPortfolio;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const names = {onbase:'출루형', power:'장타형', contact:'콘택트형', balanced:'균형형', custom:'사용자 지정'};
  const memoFields = ['주목한 이유','강점에 대한 분석가 의견','추가로 확인할 부분','경기 영상 또는 현장 관찰 메모','최종 의견'];
  const option = (value, name) => `<option value="${esc(value)}">${esc(name)}</option>`;
  const num = (value, digits = 3) => Number.isFinite(value) ? value.toFixed(digits) : '미산출';
  const format = (value, key) => ['contact','eye','homerun'].includes(key) && Number.isFinite(value) ? `${num(100*value, 2)}%` : num(value);
  const keyOf = row => C.selectionKey(row.id, row.year);
  const positionText = (code) => C.positionText(code);
  const table = (columns, rows) => `<table><thead><tr>${columns.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr${row.low?' class="low-sample"':''}>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  function weightText(weights) {
    const axes = P.active(weights);
    const total = axes.reduce((sum,d) => sum+weights[d.key],0);
    return axes.length ? `합계 ${total} · ${axes.map(d=>`${d.name} ${weights[d.key]} (${num(100*weights[d.key]/total,1)}%)`).join(' · ')}` : '양수 비중을 하나 이상 지정하세요.';
  }
  const weightsFromForm = () => Object.fromEntries(A.dimensions.map(d=>[d.key, $('weight-'+d.key).valueAsNumber]));
  function useProfile(profile) {
    for (const d of A.dimensions) $('weight-'+d.key).value = P.presets[profile][d.key];
    $('weight-summary').textContent = weightText(weightsFromForm());
  }
  function evidence(entry, weights) {
    return P.active(weights).sort((a,b)=>weights[b.key]-weights[a.key]).map(d => {
      const s = entry.scores[d.key], raw = P.metric(entry.row,d.key);
      const detail = s.value === null ? (!Number.isFinite(raw) ? '기록 결측' : '유효 표본 5명 미만') : `${num(s.value,1)}백분위`;
      return `${d.name} ${format(raw,d.key)} · ${detail} (${s.n}명)`;
    }).join(' / ');
  }
  function checks(row, minimum) {
    return [row.stats.pa < 200 ? '200타석 미만 · 표본 크기 확인' : '',
      row.position === 'OF' ? '외야 세부 위치 미확인' : !C.knownPosition(row.position) ? '포지션 미확인' : '시즌 표기 포지션 · 수비 출전 비중 확인',
      row.stats.pa < C.requiredPA(row.year) ? `예정 경기수 기준 ${C.requiredPA(row.year)}타석 미달` : '',
      row.stats.pa < minimum ? '탐색 최소 타석 미달' : '',
      '현재 계약·영입 가능성 별도 확인'].filter(Boolean).join(' · ');
  }

  try {
    const {records, metadata} = await KBORepository.load();
    const engine = A.create(records);
    const years = [...engine.byYear.keys()].sort((a,b)=>b-a);
    $('season').innerHTML = years.map(y=>option(y,y)).join('');
    $('position').innerHTML = option('','전체 (미확인 포함)') +
      Object.entries(C.positionNames).map(([key,name])=>option(key,name)).join('');
    $('profile').innerHTML = Object.entries(names).map(([key,name])=>option(key,name)).join('');
    $('alternate').innerHTML = Object.keys(P.presets).map(key=>option(key,names[key])).join('');
    $('alternate').value = 'power';
    $('weights').innerHTML = A.dimensions.map(d=>`<label>${d.meaning} ${d.name}<input type="number" min="0" max="10" step="1" required id="weight-${d.key}"></label>`).join('');
    useProfile('onbase');
    $('profile').onchange = () => { if ($('profile').value !== 'custom') useProfile($('profile').value); };
    $('weights').oninput = () => {
      $('profile').value = 'custom';
      $('weight-summary').textContent = weightText(weightsFromForm());
    };
    $('find').disabled = false;
    $('load-status').textContent = '';
    let applied;
    const selected = new Map();
    const drafts = new Map();
    const storageKey = row => 'kbo.scouting.memo.v1.'+keyOf(row);
    function memoFor(row) {
      const key = keyOf(row);
      if (!drafts.has(key)) {
        let values = [];
        try {
          const stored = JSON.parse(localStorage.getItem(storageKey(row)) || '[]');
          if (Array.isArray(stored)) values = stored;
        } catch {
          $('storage-status').textContent = '이 브라우저에서 저장된 메모를 읽을 수 없습니다.';
        }
        drafts.set(key, memoFields.map((_,i)=>typeof values[i] === 'string' ? values[i] : ''));
      }
      return drafts.get(key);
    }
    function historyHtml(row, minimum) {
      const history = P.timeline(engine, records, row);
      if (!history) return '<p>동일 ID에 출생 정보가 충돌하여 시즌 연결을 보류합니다.</p>';
      const rows = history.map(item => {
        if (!item.row) return [item.year, item.hasRaw?'원자료는 있으나 분석 제외':'원자료에 기록 없음', item.rawPA ?? '—','—','—','—','—'];
        const r = item.row, low = r.stats.pa < Math.max(200,minimum);
        const cells = [item.year,esc(r.team),r.stats.pa+(low?' (소타석)':''),num(r.stats.obp),num(r.stats.slg),num(r.stats.ops),num(r.index,1)];
        cells.low = low;
        return cells;
      });
      const observed = history.map(item=>item.row).filter(r=>r && Number.isFinite(r.stats.ops));
      const first = observed[0], last = observed.at(-1);
      const summary = observed.length > 1
        ? `${first.year}년 OPS ${num(first.stats.ops)} (${first.stats.pa}타석) → ${last.year}년 OPS ${num(last.stats.ops)} (${last.stats.pa}타석)`
        : 'OPS가 확인되는 시즌이 두 개 미만입니다.';
      return `<h4>선택 시즌까지 최대 5개 시즌</h4><p>${summary}</p><div class="table-wrap">${table(['시즌','구단 / 기록 상태','타석','OBP','SLG','OPS','리그 대비 OPS'],rows)}</div>`;
    }
    function renderReport() {
      const entries = [...selected.values()];
      $('portfolio-report').hidden = entries.length < 2;
      $('selection-message').textContent = `선택 ${entries.length}/3명 · 2명 이상 선택하면 비교·추이·보고서가 열립니다.`;
      if (entries.length < 2) return;
      const {weights, minimum, profile, scope, year} = applied;
      const axes = P.active(weights).sort((a,b)=>weights[b.key]-weights[a.key]);
      const samePosition = new Set(entries.map(e=>e.row.position)).size === 1 && entries.every(e=>C.knownPosition(e.row.position));
      const params = new URLSearchParams({year});
      for (const entry of entries) params.append('selection',keyOf(entry.row));
      $('open-comparison').href = 'index.html?'+params+'#final-comparison';
      $('open-lab').href = 'scouting-dashboard.html?'+params;
      $('storage-status').textContent = '';
      const comparisons = axes.map(d => {
        const ordered = [...entries].sort((a,b)=>(P.metric(b.row,d.key)-P.metric(a.row,d.key))*(d.key==='contact'?-1:1));
        const first = ordered[0].row, last = ordered.at(-1).row;
        const gap = Math.abs(P.metric(first,d.key)-P.metric(last,d.key));
        return `<li>${esc(d.name)} · ${gap < 1e-10 ? '선택 후보 기록 동일' : `${esc(first.name+' ('+first.team+')')}이(가) ${esc(last.name+' ('+last.team+')')}보다 ${d.key==='contact'?'낮음':'높음'} · 차이 ${['contact','eye','homerun'].includes(d.key) ? num(100*gap,2)+'%p' : num(gap)}`}</li>`;
      }).join('');
      $('report-content').innerHTML = `
        <h3>자동 분석 · ${esc(names[profile])} 타자 검토</h3>
        <p>${esc(scope)} · ${esc(weightText(weights))}</p>
        <p>${samePosition ? '선택 선수의 표기 포지션이 같습니다.' : '표기 포지션이 서로 다르거나 세부 포지션이 미확인입니다. 비교는 타격 기록에 한정합니다.'}</p>
        <div class="table-wrap">${table(['선수','시즌','구단','포지션','PA',...axes.map(d=>d.name),...(profile==='power'?['SLG']:[]),'참고 적합도'],entries.map(({row,value})=>[
          esc(row.name),row.year,esc(row.team),esc(positionText(row.position)),row.stats.pa,...axes.map(d=>format(P.metric(row,d.key),d.key)),...(profile==='power'?[num(row.stats.slg)]:[]),num(value,1)
        ]))}</div>
        <ul>${comparisons}</ul>
        ${entries.map(entry=>{
          const r = entry.row;
          return `<article><h3>${esc(r.name)} · ${esc(r.team)} · ${r.year}</h3>
            <p><strong>선정 근거</strong> ${entry.rank}위 · ${esc(evidence(entry,weights))}</p>
            <p><strong>추가 확인</strong> ${esc(checks(r,minimum))}</p>
            ${historyHtml(r,minimum)}
            <h4>분석가 메모</h4>
            <div class="memo-editor screen-only">${memoFor(r).map((v,i)=>`<label>${memoFields[i]}<textarea rows="2" data-id="${esc(keyOf(r))}" data-field="${i}">${esc(v)}</textarea></label>`).join('')}
            <button type="button" data-save="${esc(keyOf(r))}">이 선수 메모 저장</button></div>
            <div class="memo-print" data-memo="${esc(keyOf(r))}"></div>
          </article>`;
        }).join('')}
        <h3>자료와 해석 범위</h3>
        <p>동봉 CSV ${esc(metadata.source_file || 'kbo_batting_stats_season_1982-2026.csv')} · 원 수집 출처 ${esc(metadata.original_source || '미확인')} · 수집일 ${esc(metadata.collected_at || '미확인')} · ${year} 시즌 확정 상태 ${esc(metadata.season_status?.[year] || '미확인')}.</p>
        <p>시즌별 OPS 지수는 해당 시즌 보유 타자 기록을 합산한 리그 OPS를 100으로 둡니다. 추이 표의 소타석 표시는 ${Math.max(200,minimum)}타석 미만입니다. 시즌은 원자료의 선수 ID로 연결하며, 기록 차이는 관측된 성과를 보여줍니다.</p>
        <p>타격 기록 기준이며 파크팩터·나이·시즌 환경 보정을 적용하지 않았습니다. 수비·주력·부상·시장가치·영입 가능성과 미래 성적은 평가 범위 밖입니다.</p>`;
      updatePrintMemos();
    }
    function updatePrintMemos() {
      $('report-content').querySelectorAll('[data-memo]').forEach(div=>{
        const values = drafts.get(div.dataset.memo);
        div.innerHTML = values.map((value,i)=>`<p><strong>${memoFields[i]}</strong>\n${esc(value || '미작성')}</p>`).join('');
      });
    }
    $('report-content').oninput = event => {
      const {id,field} = event.target.dataset;
      if (!id || field === undefined) return;
      drafts.get(id)[+field] = event.target.value;
      $('storage-status').textContent = '편집 중 · 이 선수 메모 저장 버튼으로 저장하세요.';
      updatePrintMemos();
    };
    $('report-content').onclick = event => {
      const key = event.target.dataset.save;
      if (!selected.has(key)) return;
      try {
        localStorage.setItem(storageKey(selected.get(key).row),JSON.stringify(drafts.get(key)));
        $('storage-status').textContent = selected.get(key).row.name+' 메모를 저장했습니다.';
      } catch {
        $('storage-status').textContent = '메모 저장 실패 · 브라우저의 저장 공간이나 차단 설정을 확인하세요. 현재 입력은 인쇄할 수 있습니다.';
      }
    };
    $('print-report').onclick = () => { updatePrintMemos(); window.print(); };
    $('candidate-table').onchange = event => {
      const key = event.target.dataset.candidate;
      if (!key) return;
      if (!event.target.checked) selected.delete(key);
      else if (selected.size < 3) selected.set(key,applied.visible.get(key));
      else {
        event.target.checked = false;
        $('selection-message').textContent = '최대 3명입니다. 다른 선수를 해제한 뒤 선택하세요.';
        return;
      }
      renderReport();
    };
    $('search-criteria').onsubmit = event => {
      event.preventDefault();
      const weights = weightsFromForm();
      if (!P.active(weights).length) {
        $('load-status').textContent = '양수 비중을 하나 이상 지정하세요. 이전 탐색 결과를 유지합니다.';
        return;
      }
      $('load-status').textContent = '';
      const year = +$('season').value, position = $('position').value, minimum = +$('minimum').value;
      const pool = P.poolFor(engine,year,position,minimum);
      const entries = P.evaluate(pool,weights);
      const limit = +$('limit').value;
      const ranked = entries.filter(entry=>entry.rank);
      const displayed = ranked.length ? ranked.slice(0,limit) : entries.slice(0,limit);
      const visible = new Map(displayed.map(entry=>[keyOf(entry.row),entry]));
      const scope = `${year}년 · ${position ? positionText(position) : '전체 포지션 (미확인 포함)'} · 최소 ${minimum}타석 · 비교군 ${pool.length}명`;
      applied = {year, minimum, weights, pool, visible, scope, profile:$('profile').value};
      selected.clear();
      $('candidates').hidden = false;
      $('sensitivity').hidden = !pool.length;
      $('sensitivity-output').textContent = '';
      $('scope').textContent = `${scope} · ${names[applied.profile]} · 점수 산출 ${ranked.length}명 · 판단 보류 ${entries.length-ranked.length}명 · 표시 ${displayed.length}명`;
      const held = entries.filter(entry=>!entry.rank);
      const deferred = held.length > (ranked.length ? 0 : displayed.length) ? `<details><summary>판단 보류 사유 (${held.length}명)</summary><ul>${held.map(entry=>`<li>${esc(entry.row.name+' · '+entry.row.team+' · '+evidence(entry,weights))}</li>`).join('')}</ul></details>` : '';
      $('candidate-table').innerHTML = displayed.length ? table(['선택','선수 / 시즌 / 구단','포지션','타석','참고 적합도','선정 근거 · 지표별 비교군','추가 확인'],displayed.map(entry=>{
        const r = entry.row;
        return [entry.rank ? `<input type="checkbox" aria-label="${esc(r.name+' '+r.team+' 선택')}" data-candidate="${esc(keyOf(r))}">` : '—',
          esc(`${r.name} · ${r.year} · ${r.team}`),esc(positionText(r.position)),r.stats.pa,
          entry.rank ? `${entry.rank}위 · ${num(entry.value,1)}점` : '판단 보류',
          esc(evidence(entry,weights)),esc(checks(r,minimum))];
      }))+deferred : '<p>조건을 충족한 기록이 없습니다. 포지션 또는 최소 타석을 조정해 보세요.</p>';
      renderReport();
    };
    $('test-weights').onclick = () => {
      const after = P.presets[$('alternate').value];
      const {weights, pool, visible} = applied;
      const result = P.sensitivity(pool,weights,after);
      const preview = result.filter(({before})=>visible.has(keyOf(before.row)));
      $('sensitivity-output').innerHTML = `<p>앞서 적용한 조건 유지 · 두 기준에 필요한 기록을 모두 가진 공통 비교군 ${result.length}/${pool.length}명 · 앞서 표시한 후보 중 ${preview.length}명 표시</p>
        <p>변경 전 ${esc(weightText(weights))}<br>변경 후 ${esc(weightText(after))}</p>` +
        (result.length < 5 ? '<p>공통 표본 5명 미만으로 전후 순위 산출을 보류합니다.</p>' :
          !preview.length ? '<p>표시된 후보 중 두 기준으로 함께 계산할 수 있는 선수가 없습니다.</p>' :
          `<div class="table-wrap">${table(['선수 / 구단','변경 전','변경 후','순위 이동','점수 변화에 가장 크게 기여한 축'],preview.map(({before,after:next})=>{
            const total = w => Object.values(w).reduce((a,b)=>a+b,0);
            const contributions = A.dimensions.map(d=>({d,value:((next.scores[d.key]?.value ?? 0)-50)*after[d.key]/total(after)-((before.scores[d.key]?.value ?? 0)-50)*weights[d.key]/total(weights)})).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
            const rankChange = before.rank-next.rank, driver = contributions[0];
            return [esc(before.row.name+' · '+before.row.team),`${before.rank}위 · ${num(before.value,1)}점`,`${next.rank}위 · ${num(next.value,1)}점`,rankChange ? `${Math.abs(rankChange)}계단 ${rankChange>0?'상승':'하락'}` : '유지',Math.abs(driver.value)<1e-10 ? '변화 없음' : `${driver.d.name} ${driver.value>0?'+':''}${num(driver.value,1)}점 (50백분위 기준)`];
          }))}</div>`);
    };
  } catch (error) {
    $('load-status').textContent = '스카우팅 자료를 준비하지 못했습니다. 데이터 파일과 실행 주소를 확인하세요.';
    console.error(error);
  }
})();
