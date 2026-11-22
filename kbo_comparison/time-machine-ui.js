(function () {
  if (new URLSearchParams(location.search).get('mode') !== 'time-machine') return;

  const $ = id => document.getElementById(id);
  const {esc, seasonTrend} = KBOCharts;
  const model = KBOTimeMachine;
  const screen = $('time-machine');
  const form = $('tm-form');
  const content = $('tm-content');
  const progress = [...$('tm-progress').querySelectorAll('li')];
  const headings = ['평가 기준 선택', '블라인드 선수 비교', '스카우팅 판단', '미래 성적 공개', '스카우팅 결과 요약'];
  const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
  const number = (value, digits, suffix = '') => Number.isFinite(value) ? value.toFixed(digits) + suffix : '결측';
  const percent = value => number(Number.isFinite(value) ? value * 100 : null, 1, '%');
  const statusLabels = {absent:'해당 시즌 기록 없음', unverified:'선수 식별 또는 시즌 기록 확인 불가'};

  let stage = 1, pitching = false, rules, records, round, judgement, outcome;

  function advance(step, focus = true) {
    stage = step;
    $('tm-heading').textContent = headings[step - 1];
    form.hidden = step !== 1;
    $('tm-context').hidden = step === 1;
    $('tm-actions').hidden = step === 1;
    $('tm-next').hidden = step < 3;
    $('tm-reset').textContent = step === 5 ? '새 스카우팅 시작' : '조건 다시 선택';
    $('tm-panel').setAttribute('data-stage', step);
    progress.forEach((item, index) => {
      if (index === step - 1) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    if (focus) $('tm-heading').focus();
  }

  function updateRule() {
    const rawMinimum = Number($('tm-min').value);
    const threshold = Number.isSafeInteger(rawMinimum) && rawMinimum > 0 ? rawMinimum : '설정값';
    const measure = pitching ? '낮은 ERA' : '높은 OPS';
    const unit = pitching ? '이닝' : '타석';
    $('tm-rule').textContent = `같은 시즌의 비교군에서 기존 균형형 모델로 평가합니다. 이후 최대 3시즌은 모든 후보에게 동일하게 ${measure}를 우선 비교하고, ${pitching ? 'K-BB%와 투구 이닝을' : '타석을'} 함께 확인합니다. 두 선수 모두 ${threshold}${unit} 이상이고 지표가 있는 시즌만 우열 비교에 포함합니다.`;
  }

  function updateType() {
    pitching = $('tm-type').value === 'pitching';
    records = pitching ? pitchingData : battingData;
    const years = model.availableYears(records);
    const previousYear = Number($('tm-year').value) || 2020;
    $('tm-year').innerHTML = years.map(year => option(year, year + '년')).join('');
    if (years.includes(previousYear)) $('tm-year').value = previousYear;
    $('tm-submit').disabled = !years.length;
    const positions = pitching
      ? [['P', '투수 전체'], ['long', '경기당 3이닝 이상'], ['short', '경기당 3이닝 미만']]
      : [['', '전체 포지션'], ...Object.entries(KBOCore.positionNames)];
    $('tm-position').innerHTML = positions.map(([value, name]) => option(value, name)).join('');
    $('tm-position-help').hidden = !pitching;
    $('tm-min-label').textContent = pitching ? '최소 이닝' : '최소 타석';
    $('tm-min').value = pitching ? KBOPitching.minimum : KBOAnalytics.comparisonMinPA;
    $('tm-error').textContent = years.length ? '' : '이후 시즌과 비교할 수 있는 기준 시즌이 없습니다.';
    $('tm-error').hidden = years.length > 0;
    updateRule();
  }

  function volume(stats) {
    if (pitching) return Number.isFinite(stats.outs) ? KBOPitching.formatIP(stats.outs) + '이닝' : '이닝 결측';
    return Number.isFinite(stats.pa) ? stats.pa + '타석' : '타석 결측';
  }

  const primary = () => pitching ? {code:'ERA', key:'era', digits:2} : {code:'OPS', key:'ops', digits:3};
  const evidence = axis => `${axis.code} ${axis.name} ${number(axis.score, 1)}백분위`;

  function statsList(stats) {
    const rows = pitching
      ? [['K%', percent(stats.k)], ['BB%', percent(stats.bb)], ['HR/9', number(stats.hr, 2)], ['WHIP', number(stats.whip, 2)], ['ERA', number(stats.era, 2)]]
      : [['AVG', number(stats.avg, 3)], ['ISO', number(stats.iso, 3)], ['BB%', percent(stats.bb)], ['K%', percent(stats.k)], ['OPS', number(stats.ops, 3)], ['SB/PA', percent(stats.sb)]];
    return `<dl>${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
  }

  function cards() {
    return `<div class="tm-cards">${round.players.map(player => {
      const {label, stats, score, strongest, weakest} = player;
      const picked = judgement?.selected === label;
      const recommended = judgement?.recommended === label;
      return `<article class="tm-card"${picked ? ' data-picked' : ''}>
        <h3>선수 ${label}</h3>
        <p class="muted">${volume(stats)}</p>
        ${stage === 2 ? '' : `<p><strong>${number(score, 1)}점</strong> ${picked ? ' · 내 선택' : ''}${recommended ? ' · 모델 추천' : ''}</p>`}
        ${statsList(stats)}
        ${stage === 2 ? `<button type="button" class="secondary" data-pick="${label}" aria-label="선수 ${label} 선택">선택</button>`
          : `<p>상대 강점 · ${evidence(strongest)}</p><p>상대 약점 · ${evidence(weakest)}</p>`}
      </article>`;
    }).join('')}</div>`;
  }

  function showJudgement(label) {
    if (stage !== 2) return;
    judgement = round.judge(label);
    if (!judgement) return;
    advance(3);
    const {selected, recommended} = judgement;
    content.innerHTML = `<p class="tm-message">내 선택 <strong>${selected}</strong> · 모델 추천 <strong>${recommended}</strong> · ${selected === recommended ? '일치' : '불일치'}</p>
      ${cards()}
      <p class="tm-message muted">강점·약점은 당시 비교군에서 가장 높고 낮은 백분위 지표입니다. 균형형 점수는 기존 모델의 백분위 가중평균입니다.</p>`;
    $('tm-next').textContent = '미래 성적 확인';
  }

  function seasonCell(season, baseline) {
    if (season.status !== 'record') return statusLabels[season.status];
    const {code, key, digits} = primary();
    const metric = season.stats[key];
    const delta = Number.isFinite(metric) && Number.isFinite(baseline)
      ? Number(metric.toFixed(digits)) - Number(baseline.toFixed(digits)) : null;
    const change = delta === null ? '' : ` · 기준 대비 ${delta > 0 ? '+' : ''}${number(delta, digits)}`;
    return `<span>${esc(season.team)} · ${volume(season.stats)}${season.lowSample ? ' · 소표본' : ''}</span>
      <span>${code} ${number(metric, digits)}${change}</span>
      ${pitching ? `<span>K-BB% ${percent(season.stats.kbb)}</span>` : ''}`;
  }

  function showFuture() {
    outcome ??= round.reveal();
    if (!outcome) return;
    advance(4);
    const {code, key, digits} = primary();
    const series = outcome.players.map(player => ({
      name:`${player.label} · ${player.name}`,
      points:[
        {year:rules.year, value:player.stats[key], sample:volume(player.stats)},
        ...player.future.map(season => ({
          year:season.year, value:season.stats?.[key], lowSample:season.lowSample,
          sample:season.stats ? volume(season.stats) : statusLabels[season.status],
        })),
      ],
    }));
    const nameHeaders = outcome.players.map(player => `<th scope="col">${player.label} · ${esc(player.name)}<br><small>${esc(player.team)} · 기준 시즌</small></th>`).join('');
    const baseline = outcome.players.map(player => `<td>${volume(player.stats)} · ${code} ${number(player.stats[key], digits)}${pitching ? `<br>K-BB% ${percent(player.stats.k - player.stats.bb)}` : ''}</td>`).join('');
    const future = outcome.years.map((year, i) => `<tr><th scope="row">${year}년</th>${outcome.players.map(player => `<td>${seasonCell(player.future[i], player.stats[key])}</td>`).join('')}</tr>`).join('');
    content.innerHTML = `<p class="tm-message">내 선택 <strong>${outcome.selected}</strong> · 모델 추천 <strong>${outcome.recommended}</strong> · ${outcome.selected === outcome.recommended ? '일치' : '불일치'}</p>
      ${seasonTrend(series, code, value => number(value, digits))}
      <div class="tm-table" tabindex="0" role="region" aria-label="선수별 시즌 기록">
        <table aria-label="기준 시즌과 이후 시즌 기록"><thead><tr><th scope="col">시즌</th>${nameHeaders}</tr></thead>
        <tbody><tr><th scope="row">${rules.year}년<br><small>기준</small></th>${baseline}</tr>${future}</tbody></table>
      </div>`;
    $('tm-next').textContent = '결과 요약 보기';
  }

  function showSummary() {
    advance(5);
    $('tm-next').textContent = '미래 성적 다시 보기';
    const picked = outcome.players.find(player => player.label === outcome.selected);
    const recommended = outcome.players.find(player => player.label === outcome.recommended);
    const comparison = outcome.players.filter(player => player !== picked).map(player => {
      const {better, worse, equal} = model.compareFuture(picked, player, pitching);
      const record = better + worse + equal ? `우세 ${better} · 열세 ${worse} · 동률 ${equal}시즌` : '같은 시즌의 기준 충족 기록 부족';
      return `<li>${player.label} · ${esc(player.name)} 대비 ${record}</li>`;
    }).join('');
    const agreement = picked === recommended ? '모델과 일치' : '모델과 불일치';
    const review = pitching
      ? '탈삼진과 볼넷의 균형, 등판 역할, 이닝을 함께 검토하고 구종·구속·부상 이력을 추가로 확인하세요.'
      : '출루와 장타의 균형, 타석을 함께 검토하고 수비·주루 기여, 부상 이력과 역할 변화를 추가로 확인하세요.';
    content.innerHTML = `<ol class="tm-report">
      <li><strong>내가 선택한 선수</strong> · ${picked.label} ${esc(picked.name)} (${esc(picked.team)})</li>
      <li><strong>당시 모델 추천</strong> · ${recommended.label} ${esc(recommended.name)} (${esc(recommended.team)}) · ${agreement}</li>
      <li><strong>이후 실제 성적 비교</strong> · ${pitching ? 'ERA가 낮을수록' : 'OPS가 높을수록'} 우세. 두 선수 모두 ${rules.minimum}${pitching ? '이닝' : '타석'} 이상인 유효 시즌을 비교했습니다.<ul>${comparison}</ul></li>
      <li><strong>내 판단의 강점과 보완점</strong> · 선택한 선수의 당시 가장 높은 상대 지표는 ${evidence(picked.strongest)}였습니다. ${evidence(picked.weakest)}는 당시 함께 살펴볼 지표였습니다.${picked === recommended ? '' : ` 추천 선수는 ${evidence(recommended.strongest)}에서 자신의 지표 중 가장 높은 백분위를 보였습니다.`}</li>
      <li><strong>다음 스카우팅에서 확인할 요소</strong> · ${review}</li>
    </ol>
    <p class="tm-rule">이후 성적은 판단을 돌아보는 자료입니다. 출전 기회와 표본 규모가 다르며, CSV만으로 결장이나 성적 변화의 원인을 확인하기 어렵습니다.</p>`;
  }

  form.onsubmit = event => {
    event.preventDefault();
    if (stage !== 1) return;
    rules = {year:Number($('tm-year').value), pitching, position:$('tm-position').value, minimum:Number($('tm-min').value)};
    round = model.createRound(records, rules);
    $('tm-error').textContent = round.error || '';
    $('tm-error').hidden = !round.error;
    if (round.error) return;

    const position = $('tm-position').selectedOptions[0].textContent;
    $('tm-context').textContent = `${rules.year}년 · ${position} · 최소 ${rules.minimum}${pitching ? '이닝' : '타석'} · 당시 비교군 ${round.poolSize}명`;
    advance(2);
    content.innerHTML = cards();
    for (const button of content.querySelectorAll('[data-pick]')) button.onclick = () => showJudgement(button.dataset.pick);
  };
  $('tm-type').onchange = updateType;
  $('tm-min').oninput = updateRule;
  $('tm-next').onclick = () => {
    if (stage === 3 || stage === 5) showFuture();
    else if (stage === 4) showSummary();
  };
  $('tm-reset').onclick = () => {
    round = judgement = outcome = null;
    content.textContent = '';
    $('tm-context').textContent = '';
    advance(1);
  };
  updateType();
  advance(1, false);
  screen.hidden = false;
})();
