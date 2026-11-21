/* 기존 공개 금액·구장·참고 등급을 통합 대시보드에서 표시. */
(function(root){
const won=value=>{
 const eok=Math.floor(value/100000000),man=(value%100000000)/10000;
 return (eok?`${eok}억 `:'')+(man?`${man.toLocaleString('ko-KR')}만 `:'')+'원';
};
root.KBOScoutingContext={render(r,{grade,value,minimum}={}){
 const e=root.KBOCharts.esc;
 const data=root.KBOContractData?.lookup(r.id,r.year,r.team)||{salary:null,contracts:[],changes:[]};
 const source=x=>`<p class="contract-source"><a href="${e(x.source)}" target="_blank" rel="noopener noreferrer">${e(x.publisher)} · ${e(x.reportedAt||'발표일 미확인')} ↗</a></p>`;
 const salary=data.salary,active=data.contracts[0];
 const contractSummary=c=>`${c.period} · ${c.kind} ${c.maximum?'최대 ':''}총액 ${won(c.total)}`;
 return `<section class="panel"><h2>5. 계약·타격 참고 등급</h2><div class="cards"><div class="metric"><small>타격 기록 참고 등급 · 5각형</small><strong>${e(grade||'—')}</strong><span class="benchmark">${grade?`${value.toFixed(1)} / 100`:r.stats.pa<minimum?`평가 기준 타석 부족 · ${minimum}타석 이상`:'5개 평가 축의 유효 비교 기록 필요'}</span></div><div class="metric"><small>${r.year}년 연봉·적용 계약</small><strong>${salary?e(won(salary.amount)):active?e(contractSummary(active)):'공개 금액 미확인'}</strong>${salary?source(salary):active?source(active):''}${salary&&active?`<p class="hint">${e(contractSummary(active))}</p>`:''}${!salary&&active?'<p class="hint">개별 시즌 연봉 미확인 · 위 금액은 다년 계약 총액</p>':''}</div></div>
 ${data.contracts.length?data.contracts.map(c=>`<article class="contract-detail"><h3>${e(c.kind)} · ${e(c.team)} 계약</h3><p>${e(c.period)}</p><p><strong>계약 ${c.maximum?'최대 ':''}총액 ${e(won(c.total))}</strong></p><p>${e(c.detail)}</p>${r.team&&r.team!==c.team?'<p class="hint">계약 당시 구단 기준 · 선택 시즌 소속과 다름</p>':''}${source(c)}</article>`).join(''):''}
 ${(data.changes||[]).length?`<div class="contract-changes"><h3>선택 시즌 계약·소속 변경</h3>${data.changes.map(c=>`<p>${e(c.date)} · ${e(c.text)}</p>${source(c)}`).join('')}</div>`:''}
 </section>`;
},renderPark(parkTeam){
 const e=root.KBOCharts.esc,p=root.KBOParks.get(parkTeam);
 const m=v=>Number.isFinite(v)?`${v}m`:'미확인';
 return `<section class="panel shared-park"><h2>공통 구장 정보</h2><p class="hint">선택한 구장의 규격을 모든 선수에 공통으로 참고 · 펜스 높이와 거리만으로 타격 점수 보정 안 함</p><label>검토 구단<select id="context-park"><option value="">선택 없음</option>${Object.keys(root.KBOParks.parks).map(t=>`<option value="${e(t)}" ${parkTeam===t?'selected':''}>${e(t)}</option>`).join('')}</select></label>${p?`<h3>${e(p.name)}</h3><div class="cards">${[['좌측 거리',p.left],['중앙 거리',p.center],['우측 거리',p.right],['좌측 펜스 높이',p.wallByDirection?.left],['중앙 펜스 높이',p.wallByDirection?.center],['우측 펜스 높이',p.wallByDirection?.right]].map(([name,value])=>`<div class="metric"><small>${name}</small><strong>${m(value)}</strong></div>`).join('')}</div><p class="hint">${p.wallNote?e(p.wallNote):`공통 높이 참고: ${m(p.wall)} · 방향별 수치 미확인`}</p><p>${e(p.note)}</p><p class="warning">${e(p.caution)}</p><p class="hint">자료: ${e(p.basis)}${p.wallSource?` · <a href="${e(p.wallSource)}" target="_blank" rel="noopener noreferrer">펜스 높이 출처 ↗</a>`:''} · <a href="${e(p.source)}" target="_blank" rel="noopener noreferrer">출처 ↗</a></p>`:'<p>구단 선택 필요 · 과거 소속 구장 자동 적용 안 함</p>'}<p class="hint">검토일 ${root.KBOParks.checkedAt} · 자료 시점 규격 · 시즌별 규격 미확인 · 구장 보정 미산출</p><details><summary>10개 구단 규격·출처</summary><div class="table-wrap"><table><thead><tr><th>구단</th><th>구장</th><th>좌측</th><th>중앙</th><th>우측</th><th>좌측 높이</th><th>중앙 높이</th><th>우측 높이</th><th>높이 참고 · 자료 시점</th><th>자료</th></tr></thead><tbody>${Object.entries(root.KBOParks.parks).map(([team,q])=>`<tr><td>${e(team)}</td><td>${e(q.name)}</td><td>${m(q.left)}</td><td>${m(q.center)}</td><td>${m(q.right)}</td><td>${m(q.wallByDirection?.left)}</td><td>${m(q.wallByDirection?.center)}</td><td>${m(q.wallByDirection?.right)}</td><td>${q.wallNote?e(q.wallNote):m(q.wall)}</td><td><a href="${e(q.source)}" target="_blank" rel="noopener noreferrer">${e(q.basis)}</a>${q.wallSource?` · <a href="${e(q.wallSource)}" target="_blank" rel="noopener noreferrer">펜스 출처 ↗</a>`:''}</td></tr>`).join('')}</tbody></table></div><p class="hint">구장 이전·개조 연도 별도 확인 · 일부 자료 수치 차이</p></details></section>`;
}};
})(globalThis);
