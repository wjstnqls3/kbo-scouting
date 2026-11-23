const KBODecisionAuditUI = (() => {
  const D = KBODecisionAudit, {esc} = KBOCharts;
  const decisions = ['판단 미작성','추천 유지','조건부 추천','추가 관찰 필요'];
  const rank = value => Number.isFinite(value) ? value+'위' : '산출 보류';
  const pct = value => Number.isFinite(value) ? value.toFixed(1)+'백분위' : '비교 보류';

  function create({$,table,raw,pitching,displayName}) {
    const drafts = new Map();
    const axes = pitching ? KBOPitching.axes : KBOAnalytics.comparisonAxes;
    const keys = D.keysFor(pitching);
    const unit = pitching ? '이닝' : '타석';
    const labels = D.labels;
    const traits = D.deepAxes[pitching ? 'pitching' : 'batting'];
    function format(key,value) {
      if (!Number.isFinite(value)) return '—';
      if (key==='ip') return KBOPitching.formatIP(Math.round(value*3));
      if (['pa','g','xbh','age'].includes(key)) return String(value);
      if (key==='kbb') return (100*value).toFixed(2)+'%p';
      if (['hrpa','stealRate','xbhShare'].includes(key)) return (100*value).toFixed(2)+'%';
      if (['bbk','bb9','h9','k9'].includes(key)) return value.toFixed(2);
      if (key==='era' || key==='whip' || key==='hr') return value.toFixed(2);
      return raw(value,key);
    }
    function volume(p) {
      const key = keys.at(-1);
      return format(key,p.volume)+' '+labels[key];
    }
    function topThree(entry) {
      return entry?.topTotal ? entry.topCount+'/'+entry.topTotal+' ('+(100*entry.topCount/entry.topTotal).toFixed(0)+'%)' : '산출 보류';
    }
    function stability(entry) {
      return entry?.total ? entry.best+'–'+entry.worst+'위' : '산출 보류';
    }
    function evidence(p) {
      if (!p.entry) return '기준선 순위 보류';
      const ordered = axes.filter(a=>p.entry.scores[a.key]).sort((a,b)=>p.entry.scores[b.key].value-p.entry.scores[a.key].value);
      return ordered.slice(0,2).map(a=>'<span class="audit-reading">'+esc(a.code)+' '+
        primary(format(a.key,D.metric(p.row,a.key,pitching)))+' <small>'+esc(pct(p.entry.scores[a.key].value))+'</small></span>').join(' · ');
    }
    function risks(p) {
      return p.conflicts.map(c=>labels[c.high]+' 상대 강점 '+pct(c.upper)+' · '+labels[c.low]+' 추가 확인 '+pct(c.lower)).join(' / ');
    }
    function change(p) {
      const key = pitching ? 'era' : 'ops';
      const valid = p.history.seasons.filter(s=>s.status==='기준 충족' && Number.isFinite(s.values[key]));
      if (valid.length<2) return esc(labels[key]+' 비교 보류 · 기준 충족 및 유효 기록 '+valid.length+'시즌 (2시즌 필요)');
      const first = valid[0], last = valid.at(-1);
      const endpoint = season=>'<span class="audit-reading">'+esc(season.year+'년 '+format(key,season.values[key]))+'</span>';
      return esc(labels[key])+' '+endpoint(first)+' → '+endpoint(last);
    }
    const battingFields = {g:['G'],avg:['H','AB'],obp:['H','BB','HBP','AB','SF'],slg:['TB','AB'],
      ops:['H','BB','HBP','AB','SF','TB'],iso:['H','TB','AB'],bb:['BB','PA'],k:['SO','PA'],hrpa:['HR','PA'],pa:['PA']};
    const pitchingFields = {g:['G'],era:['ERA','IP'],k:['SO','TBF'],bb:['BB','TBF'],kbb:['SO','BB','TBF'],
      hr:['HR','IP'],whip:['H','BB','IP'],ip:['IP']};
    function missingRecord(season,key) {
      if (!season.raw) return season.status;
      const fields = (pitching ? pitchingFields : battingFields)[key];
      const missing = fields.filter(field=>!String(season.raw[field] ?? '').trim());
      if (missing.length) return missing.join('·')+' 결측';
      if (pitching && fields.includes('IP') && KBOPitching.parseOuts(season.raw.IP)===null) return '이닝 표기 확인';
      if (key!=='ip' && pitching && fields.includes('IP') && KBOPitching.parseOuts(season.raw.IP)===0) return '0이닝';
      if (fields.includes('TBF') && Number(season.raw.TBF)===0) return '상대 타자 0명';
      if (!pitching && ['avg','slg','ops','iso'].includes(key) && Number(season.raw.AB)===0) return '0타수';
      if (key==='obp' && ['AB','BB','HBP','SF'].every(f=>Number(season.raw[f])===0)) return '출루율 분모 0';
      return '원기록 유효성 확인';
    }
    function historyTable(p) {
      const columns = ['g',...keys];
      const rows = p.history.seasons.map(s=>{
        const cells = columns.map(key=>{
          const value = s.values[key], ref = s.relative[key];
          if (!Number.isFinite(value)) return '<td>—'+(s.raw ? secondary(missingRecord(s,key)) : '')+'</td>';
          const level = !s.inPool ? '비교 집단 외' : pct(ref.pct)+' · '+ref.n+'명';
          return '<td>'+primary(format(key,value))+secondary(level)+'</td>';
        });
        return '<tr><th scope="row">'+s.year+secondary('비교 '+s.poolSize+'명')+'</th>'+cells.join('')+'<td>'+esc(s.status)+'</td></tr>';
      });
      rows.push('<tr><th scope="row">변동 폭</th>'+columns.map(k=>'<td>'+esc(format(k,p.history.ranges[k]).replace(/%$/,'%p'))+'</td>').join('')+'<td>기준 충족 2시즌 이상</td></tr>');
      const detail = pitching ? 'ERA 검산 · '+p.deep.eraCheck :
        '장타 '+format('xbh',p.deep.xbh)+'개 ('+pct(p.relative.xbh.pct)+') · 도루 성공/시도 '+(p.deep.sb??'—')+'/'+(p.deep.attempts??'—')+'회 · 성공률 '+format('stealRate',p.deep.stealRate);
      return '<h4>'+esc(displayName(p.row)+' · '+p.row.team)+'</h4>'+
        comparisonTable(['시즌',...columns.map(k=>k==='g' ? 'G' : labels[k]),'표본 상태'],rows)+
        '<p>'+esc(detail)+'</p>'+(p.conflicts.length ? '<p>지표 불일치 · '+esc(risks(p))+'</p>' : '');
    }
    function comparisonTable(headers,rows) {
      const head = headers.map(label=>'<th scope="col">'+esc(label)+'</th>').join('');
      return '<div class="table-wrap"><table class="audit-comparison"><thead><tr>'+head+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
    }
    const secondary = value => '<small>'+esc(value)+'</small>';
    const primary = value => '<strong>'+esc(value)+'</strong>';
    function comparison(group) {
      const rows = group.profiles.map(({row,roles,entry})=>{
        const effects = entry?.influences || [];
        const first = effects[0];
        const condition = first ? labels[first.key]+' '+first.label+' · '+rank(entry.rank)+' → '+rank(first.rank)
          : entry?.total ? '순위 동일' : '산출 보류';
        return '<tr><th scope="row">'+esc(displayName(row))+secondary(roles.join(' / '))+'</th>'+
          '<td>'+primary(rank(entry?.rank))+'</td><td>'+primary(entry ? entry.value.toFixed(1)+'점' : '산출 보류')+'</td>'+
          '<td>'+primary(stability(entry))+'</td><td>'+primary(topThree(entry))+
          (entry?.total && !entry.topTotal ? secondary('순위 산출 후보 4명 미만') : '')+'</td>'+
          '<td class="audit-condition">'+esc(condition)+(effects.length>1 ? secondary('외 '+(effects.length-1)+'개 조건') : '')+'</td></tr>';
      });
      return comparisonTable(['선수 · 역할','기준 순위','평가 점수','순위 범위','상위 3위 유지','최대 변동 조건'],rows);
    }
    function stabilitySection(group) {
      const {profiles,scope} = group;
      const names = profiles.map(p=>displayName(p.row));
      const firstRow = ['기존 기준선',...profiles.map(p=>rank(p.entry?.rank))];
      const rows = group.scenarioRanks.map(s=>[labels[s.key]+' '+s.label,...s.ranks.map((value,i)=>{
        const maximum = profiles[i].entry?.influences.some(effect=>effect.key===s.key && effect.label===s.label);
        return rank(value)+(maximum ? ' · 최대 변동' : '');
      })]);
      const active = axes.filter(a=>scope.weights[a.key]>0);
      const metrics = active.map(a=>[a.code,...profiles.map(p=>{
        const score = p.entry?.scores[a.key]?.value;
        return [format(a.key,D.metric(p.row,a.key,pitching)),Number.isFinite(score) && pct(score)].filter(Boolean).join(' · ');
      }),group.metricCounts[a.key]+'명']);
      return '<section class="audit-stability"><h3>추천 순위 안정성 <small>유효 시나리오 <strong>'+group.scenarios+'개</strong></small></h3>'+
        comparison(group)+'<details data-print-expand><summary>평가 기준별 순위 변화</summary>'+
        table(['평가 기준',...names.map(name=>name+' 순위')],[firstRow,...rows])+
        (rows.length ? '' : '<p>산출 가능한 변경 조건 없음</p>')+
        (active.length ? '<h4>기준선 기록 · 백분위</h4>'+table(['활성 지표',...names,'유효 표본'],metrics) : '')+
        '</details></section>';
    }
    function methods(group,scopeName) {
      const {scope} = group;
      const weights = axes.map(a=>a.code+' '+scope.weights[a.key]).join(' · ');
      return `<details class="audit-method" data-print-expand><summary>계산 방식 · 가중치 · 판정 기준</summary>
        <h4>기준선 추천 점수</h4>
        <p>비교 집단 ${group.poolSize}명 · 순위 산출 ${group.ranked}명 · 가중치 ${esc(weights)}</p>
        <p>백분위 = 100 × (불리한 기록 수 + 동률 수 ÷ 2) ÷ 유효 기록 수</p>
        <p>추천 점수 = Σ(지표 백분위 × 가중치) ÷ 활성 가중치 합. 활성 지표 결측, 지표별 유효 기록 5명 미만, 전체 가중치 0이면 보류.</p>
        ${table(['평가 지표','산식','유리한 방향'],axes.map(a=>[a.code,a.formula,a.direction===-1?'낮을수록':'높을수록']))}
        <h4>가중치 민감도 분석(Sensitivity Analysis)</h4>
        <p>활성 지표 하나씩 ±20% 또는 제외 → 가중치 합 1로 정규화 → 같은 집단 재평가</p>
        <p>기준선과 동일한 조건·중복·산출 불가 조건 제외. 지표 제외 시 해당 지표 결측 선수도 순위 진입 가능.</p>
        <p>순위 범위 = 변경 조건의 최고~최저 순위. 상위 3위 유지율 = 상위 3위 횟수 ÷ 본인 순위가 있고 유효 후보가 4명 이상인 조건 수 (공동 순위 포함).</p>
        <p>모델 추천 대안은 직접 선택을 제외한 기준선 후보 중 유효 변경 순위가 있는 선수에서 선정. 최악 순위가 좋은 순, 동률이면 기준 순위와 기존 목록 순. 상위 3위 유지율은 참고값.</p>
        <h4>추가 지표 · 상대 강점과 추가 확인</h4>
        ${table(['지표','계산식','유리한 방향','유효 선수'],traits.map(a=>[a.code,a.formula,a.direction===-1?'낮을수록':'높을수록',group.profiles[0].relative[a.key].n+'명']))}
        <p>같은 평가 집단에서 75백분위 이상 중 최고 지표를 상대 강점, 25백분위 이하 중 최저 지표를 추가 확인으로 표시. 출전 규모 결측·최소 기준 미달 시 판정 보류.</p>
        <p>분모 0·원기록 부족은 계산 불가, 유효 기록 5명 미만은 백분위 보류. 추가 지표는 추천 점수에 가산하지 않음.</p>
        <h4>시즌 기록 · 표본과 해석 한계</h4>
        <p>${esc(scopeName)} · 시즌별 ${scope.position && !pitching ? '동일 포지션 필터와 ' : ''}최소 ${scope.minimum}${unit} 적용. 같은 선수 ID의 기준 충족 기록 2시즌 이상에서 변동 폭(최대−최소) 산출. —는 유효 기록 부족.</p>
        <p>근접 표본 = 최소 출전 기준의 100~${Math.round(D.nearFactor*100)}%. 기준 미달은 해석 주의. 경기 수·출전 규모 백분위에는 출전 기회 차이가 반영됨.</p>
        <p>지표 불일치 = 앞 지표 ≥75백분위, 뒤 지표 ≤25백분위 · ${pitching?'ERA·BB%, K%·HR/9, WHIP·IP':'OPS·BB%, AVG·ISO, ISO·K%'}</p>
        <p>시즌 환경·출전 기회 차이 존재. 순위 안정성은 가중치 변화에 대한 결과이며 미래 성공 확률은 산출하지 않음.</p></details>`;
    }
    const sourceFields = {
      hrpa:['HR','PA'], xbhShare:['2B','3B','HR','H'], bbk:['BB','SO'], stealRate:['SB','CS'],
      kbb:['SO','BB','TBF'], bb9:['BB','IP'], h9:['H','IP'], hr:['HR','IP'], k9:['SO','IP']
    };
    function deepCell(p,key) {
      const record = p.row.raw;
      const fields = sourceFields[key];
      const fieldText = field=>String(record[field] ?? '').trim();
      const original = fields.map(field=>field+' '+(fieldText(field) || '—')).join(' · ');
      const ratioNote = key==='stealRate' ? '성공/시도 '+(p.deep.sb??'—')+'/'+(p.deep.attempts??'—')+'회' : '';
      const value = p.deep[key], {n,pct:percentile} = p.relative[key];
      let note = pct(percentile);
      if (!Number.isFinite(value)) {
        const denominator = key==='stealRate' ? p.deep.attempts : KBOAnalytics.num(fieldText(fields.at(-1)));
        const missing = fields.filter(field=>!fieldText(field));
        note = missing.length ? missing.join('·')+' 결측' : denominator===0 ? '분모 0' : '유효 원기록 부족';
      } else if (!Number.isFinite(percentile)) {
        note = '비교 보류 · 유효 표본 '+n+'명';
      }
      return '<td>'+primary(Number.isFinite(value) ? format(key,value) : '계산 불가')+secondary(note)+
        secondary(original)+(ratioNote ? secondary(ratioNote) : '')+'</td>';
    }
    function deepSignals(p) {
      const levels = traits.filter(a=>Number.isFinite(p.relative[a.key].pct))
        .sort((a,b)=>p.relative[b.key].pct-p.relative[a.key].pct);
      return {high:levels.find(a=>p.relative[a.key].pct>=75),
        low:levels.filter(a=>p.relative[a.key].pct<=25).at(-1),comparable:levels.length>0};
    }
    function deepSection(group) {
      const rows = traits.map(({key,code,name})=>'<tr><th scope="row">'+esc(code)+secondary(name)+'</th>'+
        group.profiles.map(p=>deepCell(p,key)).join('')+'</tr>');
      const signals = group.profiles.map(p=>{
        const {high,low,comparable} = deepSignals(p);
        const signal = (label,axis)=>'<span>'+label+' · '+esc(axis.code)+' '+primary(format(axis.key,p.deep[axis.key]))+'</span>';
        const findings = [high && signal('상대 강점',high),low && signal('추가 확인',low)].filter(Boolean);
        const held = p.volume===null || p.volume<group.scope.minimum;
        const available = traits.find(a=>Number.isFinite(p.deep[a.key]));
        const missing = traits.filter(a=>!Number.isFinite(p.deep[a.key])).map(a=>a.code);
        const preview = available ? esc(available.code)+' '+primary(format(available.key,p.deep[available.key]))+' · ' : '';
        const sampleIssue = p.volume===null ? '출전 규모 결측' : '출전 표본 부족';
        const summary = held ? preview+sampleIssue+' · 강약점 보류'
          : findings.join('') || preview+(comparable ? '사분위 신호 없음' :
            available ? '상대평가 보류 · 유효 표본 5명 미만' : '유효 기록 없음');
        return '<li><strong>'+esc(displayName(p.row))+'</strong><div>'+summary+(missing.length ? '<span>계산 불가 · '+esc(missing.join(', '))+'</span>' : '')+'</div></li>';
      }).join('');
      return '<section class="audit-deep"><h3>추가 지표 분석</h3><ul class="audit-signals">'+signals+'</ul>'+
        '<details data-print-expand><summary>지표별 실제 기록 · 백분위 · 원기록</summary>'+
        comparisonTable(['지표',...group.profiles.map(p=>displayName(p.row))],rows)+'</details></section>';
    }
    function checks(group) {
      return group.profiles.map(p=>{
        const d = p.deep;
        const attention = p.history.seasons.filter(s=>s.status!=='기준 충족').map(s=>s.year+'년 '+s.status);
        const partial = p.history.seasons.filter(s=>s.status==='기준 충족' && keys.some(key=>!Number.isFinite(s.values[key])));
        if (partial.length) attention.push('일부 지표 계산 불가 · '+partial.map(s=>s.year+'년').join(', '));
        attention.push(...p.conflicts.map(c=>labels[c.high]+' · '+labels[c.low]+' 불일치'));
        if (p.sample!=='최소 기준 충족') attention.push(p.sample+' → 해석 주의');
        if (pitching && d.eraCheck!=='반올림 범위 일치') attention.push('ERA '+d.eraCheck);
        const age = Number.isFinite(d.age) ? d.age+'세' : '나이 미확인';
        const games = Number.isFinite(d.g) ? d.g+'경기' : '경기 수 결측';
        return `<section class="audit-finding"><h4>${esc(displayName(p.row))} <span class="muted">${esc(p.row.team+' · '+p.roles.join(' / '))}</span></h4>
          <p class="muted">${group.scope.year}년 · ${esc(age)}</p>
          <dl class="audit-facts">
          <dt>출전 규모</dt><dd><span class="audit-reading">${primary(games)} <small>${esc(pct(p.relative.g.pct))}</small></span> · <span class="audit-reading">${primary(volume(p))} <small>${esc(pct(p.volumePct))}</small></span></dd>
          <dt>최근 성적</dt><dd><strong>${change(p)}</strong></dd>
          <dt>최소 출전 기준</dt><dd>${esc(p.sample.replace('최소 기준 ',''))} <small>${group.scope.minimum}${unit}</small></dd>
          <dt>추가 확인</dt><dd>${esc(attention.join(' / ') || '확인된 신호 없음')}</dd></dl></section>`;
      }).join('');
    }
    function draftStatus(decision,note) {
      if (decision===decisions[0]) return note.trim() ? '판단 미작성 · 근거 입력' : '판단 미작성';
      return note.trim() ? '판단·근거 작성' : '판단 선택 · 근거 미작성';
    }
    function renderGroup(group,index) {
      const {scope} = group;
      const scopeName = pitching ? '전체 투수' : scope.position ? KBOCore.positionText(scope.position) : '전체 타자';
      const selected = group.profiles.filter(p=>p.roles.includes(D.roles.selected));
      const controls = selected.map((p,i)=>{
        const token = index+'-'+i;
        const id = JSON.stringify([scope.year,scope.position,scope.minimum,scope.profile,scope.weights,p.row.id]);
        const draft = drafts.get(id) || {decision:decisions[0],note:''};
        const value = esc(draft.note);
        const {high,low,comparable} = deepSignals(p);
        const eligible = Number.isFinite(p.volume) && p.volume>=scope.minimum;
        const checks = p.conflicts.map(c=>labels[c.high]+' · '+labels[c.low]+' 불일치');
        if (eligible && low) checks.push(low.code+' '+pct(p.relative[low.key].pct));
        if (p.sample!=='최소 기준 충족') checks.push(p.sample);
        if (pitching && p.deep.eraCheck!=='반올림 범위 일치') checks.push('ERA '+p.deep.eraCheck);
        if (p.entry?.influences.length) checks.push('가중치 변경 '+stability(p.entry));
        return {token,id,decision:draft.decision,html:`<section class="audit-decision"><h4>${esc(displayName(p.row))} <span class="muted">${esc(p.row.team)}</span></h4>
          <div class="audit-model"><h5>모델 분석</h5><p><b>기준선 ${esc(rank(p.entry?.rank))}${p.entry ? ' · '+p.entry.value.toFixed(1)+'점' : ''}</b></p>
          <dl class="audit-facts"><dt>추천 근거</dt><dd>${evidence(p)}</dd>
          <dt>상대 강점</dt><dd>${esc(!eligible ? '출전 표본 부족 · 판정 보류' : high ? high.code+' '+pct(p.relative[high.key].pct) : comparable ? '75백분위 이상 없음' : '유효 표본·기록 부족')}</dd>
          <dt>추가 확인</dt><dd>${esc(checks.join(' / ') || '확인된 신호 없음')}</dd></dl></div>
          <div class="audit-editor"><h5>스카우트 최종 판단 <small class="screen-only" id="audit-status-${token}">${draftStatus(draft.decision,draft.note)}</small></h5>
          <div class="audit-inputs screen-only"><label>스카우트 판단<select id="audit-choice-${token}">${decisions.map(d=>`<option ${d===draft.decision?'selected':''}>${d}</option>`).join('')}</select></label>
          <label>판단 근거와 추가 확인 사항<textarea rows="1" id="audit-note-${token}" placeholder="관찰할 내용이나 추천 조건">
${value}</textarea></label></div>
          <p class="print-only">스카우트 판단 · <strong id="audit-print-choice-${token}">${esc(draft.decision)}</strong></p>
          <p class="print-only print-note" id="audit-print-note-${token}">${value || '관찰 의견 미작성'}</p></div></section>`};
      });
      const alternative = group.profiles.find(p=>p.roles.includes(D.roles.alternative));
      const altText = alternative ? displayName(alternative.row)+' · 기준 '+rank(alternative.entry.rank)+' · 변경 후 '+stability(alternative.entry)+' · 상위 3위 '+topThree(alternative.entry)
        : '유효 시나리오 순위가 있는 미선택 후보 없음';
      const current = selected.map((p,i)=>esc(displayName(p.row)+' '+rank(p.entry?.rank)+(p.entry ? ' · '+p.entry.value.toFixed(1)+'점' : ''))+
        ' <small id="audit-target-choice-'+controls[i].token+'">'+esc(controls[i].decision)+'</small>').join(' / ');
      const html = `<article class="panel audit-group">
        <header><h2>${esc(scope.year+'년 '+scopeName+' · '+scope.profile)}</h2>
        <p class="audit-target">직접 선택 · ${current}</p>
        <p class="muted">${esc(scope.minimum+unit+' 이상 '+group.poolSize+'명 · 순위 산출 '+group.ranked+'명')}</p>
        </header>
        ${stabilitySection(group)}
        ${deepSection(group)}
        <section class="audit-reliability"><h3>기록 신뢰성</h3><div class="audit-findings">${checks(group)}</div>
        <details data-print-expand><summary>최근 3시즌 · 기록과 표본</summary>${group.profiles.map(historyTable).join('')}</details></section>
        <section><h3>최종 스카우팅 판단</h3><p><b>모델 추천 대안</b> · ${esc(altText)}</p>
        ${alternative ? '<p class="muted">선정 근거 · 미선택 후보 중 최악 순위 우선</p>' : ''}${controls.map(c=>c.html).join('')}
        <p class="muted">현장 확인 · ${pitching?'등판 역할·구종·구속·회복 상태':'수비 동작·주루 판단·회복 상태'}</p>
        <p class="muted screen-only">판단·메모 유지 범위 · 새로고침 전까지</p></section>
        ${methods(group,scopeName)}
      </article>`;
      return {html,controls};
    }
    function open(groups) {
      const views = groups.map(renderGroup);
      $('audit-results').innerHTML = views.map(v=>v.html).join('');
      for (const {token,id} of views.flatMap(v=>v.controls)) {
        const choice = $('audit-choice-'+token), note = $('audit-note-'+token);
        const update = () => {
          drafts.set(id,{decision:choice.value,note:note.value});
          $('audit-target-choice-'+token).textContent = choice.value;
          $('audit-status-'+token).textContent = draftStatus(choice.value,note.value);
          $('audit-print-choice-'+token).textContent = choice.value;
          $('audit-print-note-'+token).textContent = note.value || '관찰 의견 미작성';
        };
        choice.onchange = note.oninput = update;
      }
      $('decision-audit').hidden = false;
      $('dashboard').setAttribute('data-auditing','true');
      $('dashboard-header').setAttribute('data-auditing','true');
      $('audit-heading').focus();
    }
    $('close-audit').onclick = () => {
      $('decision-audit').hidden = true;
      $('dashboard').removeAttribute('data-auditing');
      $('dashboard-header').removeAttribute('data-auditing');
      $('open-audit').focus();
    };
    $('print-audit').onclick = () => window.print();
    return {open};
  }
  return {create};
})();
