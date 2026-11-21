(() => {
  const query = selector => document.querySelector(selector);
  const comparison = query('#comparison-start');
  const lab = query('#player-page');
  const main = comparison || query('main');
  const pages = comparison ? {
    summary: ['비교 요약', '.comparison-title, .comparison-title + p, .comparison-context, .comparison-summary'],
    search: ['대상 선수 찾기', 'main > section:has(> #target)'],
    similar: ['유사선수', 'main > section:has(> #recommendations)'],
    final: ['최종 성적 비교', '#final-comparison'],
    sources: ['자료 정보', 'main > details']
  } : lab ? {
    summary: ['선수 요약', '#selected-group, #report > .report-head, #report > .report-comparison, #report > .fit-summary, #report > p, .report-export'],
    settings: ['선수·분석 설정', '#controls, .age-guide, #fit-controls'],
    stats: ['시즌 기록', '#report > .report-comparison-row:has(.report-trend)'],
    assessment: ['강점·약점', '#report > .report-comparison-row:has(.report-assessment)'],
    similar: ['유사선수', '#report > .report-comparison-row:has(.report-similar), #report > .shared-method:has(+ .report-comparison-row .report-similar)'],
    context: ['등급·계약·부상', '#report > .grade-guide, #report > .report-comparison-row:has(.context-card, .report-injuries, .report-notes), #report > .shared-method:not(:has(+ .report-comparison-row .report-similar))'],
    finder: ['조건별 선수 찾기', '.finder-intro, #finder, #finder + .hint'],
    candidates: ['조건 검색 결과', '#candidates'],
    grades: ['참고 등급별 후보', '#grade-finder'],
    sources: ['자료·평가 기준', '.criteria-summary']
  } : {
    summary: ['검토 요약', '.portfolio-summary'],
    settings: ['타자 유형·탐색 조건', '#search-criteria'],
    candidates: ['검토 후보', '#candidates'],
    sensitivity: ['순위 변화', '#sensitivity'],
    report: ['선수 보고서', '#portfolio-report']
  };

  const nav = document.createElement('nav');
  nav.className = 'section-navigation';
  nav.setAttribute('aria-label', '상세 화면 이동');
  const title = document.createElement('h2');
  title.className = 'section-page-title';
  title.tabIndex = -1;
  const empty = document.createElement('p');
  empty.className = 'section-empty panel';
  empty.hidden = true;
  const links = new Map();

  function urlFor(view) {
    const url = new URL(location.href);
    if (view === 'summary') url.searchParams.delete('view');
    else url.searchParams.set('view', view);
    if (comparison) url.hash = view === 'final' ? 'final-comparison' : 'comparison-start';
    return url;
  }

  for (const [view, [label]] of Object.entries(pages)) {
    const link = document.createElement('a');
    link.href = urlFor(view);
    link.textContent = label;
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      go(view);
    });
    nav.append(link);
    links.set(view, link);
  }

  if (lab) {
    query('.tabs').after(nav, title, empty);
    query('.tabs').classList.add('section-legacy-tabs');
  } else if (comparison) {
    query('.comparison-context').after(nav, title, empty);
    const intro = document.createElement('section');
    intro.className = 'panel comparison-summary';
    intro.innerHTML = '<h2>시즌별 타격 기록을 비교하세요</h2><p>대상 선수를 찾은 뒤 유사선수를 추가하고, 최종 성적을 한 표에서 비교할 수 있습니다.</p>';
    main.insertBefore(intro, query('main > details'));
  } else {
    const settingsPanel = query('#search-criteria').closest('section');
    settingsPanel.classList.add('section-settings');
    settingsPanel.before(nav, title, empty);
    const intro = document.createElement('section');
    intro.className = 'panel portfolio-summary';
    intro.innerHTML = '<h2>타격 유형별로 후보를 탐색하세요</h2><p>시즌과 지표 비중을 선택하면 후보를 찾고, 순위 변화와 선수별 보고서를 살펴볼 수 있습니다.</p>';
    empty.after(intro);
    pages.settings[1] = '.section-settings';
  }

  function currentView() {
    const view = new URLSearchParams(location.search).get('view');
    if (view && Object.hasOwn(pages, view)) return view;
    return comparison && location.hash === '#final-comparison' ? 'final' : 'summary';
  }

  function update() {
    const view = currentView();
    const selected = new Set(document.querySelectorAll(pages[view][1]));
    for (const [, selector] of Object.values(pages)) {
      for (const node of document.querySelectorAll(selector)) {
        node.toggleAttribute('data-section-inactive', !selected.has(node));
      }
    }
    if (lab) {
      const finder = ['finder', 'candidates', 'grades'].includes(view);
      query('#finder-page').hidden = !finder;
      query('#player-page').hidden = finder;
      if (view === 'grades' && !query('#grade-results').children.length) query('#grade-filter').onchange?.();
      if (view === 'candidates' && !query('#candidates').children.length && !query('#candidates').textContent.trim()) {
        query('#finder').onchange?.({target: null});
      }
    }
    for (const [key, link] of links) {
      if (key === view) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    title.textContent = pages[view][0];
    title.hidden = view === 'summary' && Boolean(comparison);
    empty.hidden = [...selected].some(node => !node.hidden && (node.children.length || node.textContent.trim()));
    empty.textContent = lab ? '선수·분석 설정 또는 조건별 선수 찾기에서 기록을 선택하세요.' : '탐색 조건을 설정하고 후보를 선택하면 결과를 볼 수 있습니다.';
  }

  function go(view) {
    const url = urlFor(view);
    if (url.href !== location.href) history.pushState(null, '', url);
    update();
    title.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  addEventListener('popstate', update);
  if (lab) {
    const observer = new MutationObserver(update);
    for (const selector of ['#report', '#candidates']) observer.observe(query(selector), {childList: true});
    document.addEventListener('click', event => {
      if (event.target.closest('#browse-grades')) go('grades');
      if (event.target.closest('#finder-page [data-open], #finder-page [data-open-grade]')) go('summary');
    });
    query('#finder').addEventListener('submit', event => {
      if (event.defaultPrevented) go('candidates');
    });
  } else if (!comparison) {
    const observer = new MutationObserver(update);
    for (const selector of ['#candidates', '#sensitivity', '#portfolio-report']) {
      observer.observe(query(selector), {attributes: true, attributeFilter: ['hidden']});
    }
    query('#search-criteria').addEventListener('submit', () => {
      if (!query('#candidates').hidden && !query('#load-status').textContent.trim()) go('candidates');
    });
  }

  update();
})();
