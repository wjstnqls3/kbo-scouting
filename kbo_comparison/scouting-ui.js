/* 분석 화면은 분석 모듈이 반환하는 결과만 표시합니다. */
(function(root){
  'use strict';
  root.createScoutingView=function(records){
    const engine=root.KBOScouting.create(records), panel=document.getElementById('scouting-results');
    const reports={'52605':[{season:2025,amount:'연봉 5억 원',text:'2025년 KBO 등록 선수 연봉 집계에서 확인',url:'https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=11394'}]};
    const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const fmt=(v,d=3)=>Number.isFinite(v)?v.toFixed(d):'—';
    const table=(headers,rows)=>`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    const parkChoices=new Map();
    function parkMarkup(a,team){
      const park=root.KBOParks.get(team);
      if(!park)return '<p>검토할 구단을 선택하세요. 선택 선수의 과거 소속 구장에 자동으로 적용하지 않습니다.</p>';
      const s=a.selected.stats;
      return `<p><strong>${escape(park.name||'구장 정보 미확인')}</strong></p><p>${escape(park.fact||'구장 규격 미확인')}</p><p><strong>검토 제안:</strong> ${escape(park.note)}</p><p>선택 시즌 선수 기록: 홈런/타석 ${fmt(s.hr*100,2)}% · 장타율 ${fmt(s.slg)} · 출루율 ${fmt(s.obp)}. 이 값은 구장별 기록이 아닌 시즌 전체 기록입니다.</p>${park.source?`<p><a href="${escape(park.source)}" target="_blank" rel="noopener noreferrer">구장 정보 출처 ↗</a></p>`:''}<p class="hint">자료 확인일: ${root.KBOParks.checkedAt}. 출처 시점의 시설 설명이며 선택 시즌의 규격이나 실제 출전 구장을 뜻하지 않습니다.</p>`;
    }
    return function(targets){
      if(!targets.size){panel.innerHTML='<p>위에서 대상 선수를 추가하면 분석 결과가 나타납니다.</p>';return;}
      panel.innerHTML=[...targets.values()].map(t=>{
        const a=engine.analyze(t.id,t.end);if(!a)return `<p>${escape(t.name)}: 분석할 기록이 부족합니다.</p>`;
        const x=a.selected,s=x.stats,l=x.league,grade=root.KBOScouting.grade(x.index,s.pa),report=(reports[a.id]||[]).find(r=>r.season===x.year),rank=a.peers.filter(p=>p.stats.ops>s.ops).length+1;
        const graph=a.trend.map(z=>`<div class="trend-row"><span>${z.year}</span><div class="trend-track"><div class="trend-bar" style="width:${Math.max(0,Math.min(100,(z.index||0)/2))}%"></div></div><strong>${fmt(z.index,1)}</strong></div>`).join('');
        const trend=table(['시즌','구단','타석','선수 OPS','리그 OPS','상대 지수'],a.trend.map(z=>[z.year,z.teams,z.stats?.pa??'—',fmt(z.stats?.ops),fmt(z.league?.ops),fmt(z.index,1)]));
        const peers=a.peers.slice(0,10);const peerTable=peers.length?table(['이름','구단','타석','OPS'],peers.map(p=>[p.name,p.team,p.stats.pa,fmt(p.stats.ops)])):'<p>같은 시즌에 해당 조건을 충족한 동연령 선수가 없습니다.</p>';
        const similar=a.similar.length?table(['이름','구단','타석','OPS','거리'],a.similar.map(p=>[p.name,p.team,p.stats.pa,fmt(p.stats.ops),fmt(p.distance)])):'<p>유사 유형을 계산할 수 없습니다. 대상 선수의 200타석 충족 여부를 확인하세요.</p>';
        return `<article class="scout-card"><h3>${escape(a.name)} <small>(${x.year}년 · ${escape(x.teams)})</small></h3><p>${x.age===null?'나이 미확인':`${x.age}세 (원본 기준)`} · ${s.pa}타석 ${s.pa<200?'· 표본이 적어 해석에 주의':''}</p><div class="scout-summary"><div><small>선수 OPS</small><strong>${fmt(s.ops)}</strong></div><div><small>리그 OPS</small><strong>${fmt(l?.ops)}</strong></div><div><small>리그 대비 지수</small><strong>${fmt(x.index,1)}</strong></div></div><p><a href="scouting-dashboard.html?id=${encodeURIComponent(a.id)}&amp;year=${x.year}">이 선수의 상세 대시보드와 자동 리포트 →</a></p><h4>기록 기반 스카우팅 참고 등급</h4><p><strong>${escape(grade||'판정 보류')}</strong> · ${grade?`리그 대비 OPS 지수 ${fmt(x.index,1)}`:'200타석 미만 또는 리그 기준 부족'}</p><p class="hint">지수 120 이상 매우 적합 · 110 이상 적합 · 95 이상 보통 · 85 이상 신중 검토 · 85 미만 현재 기록상 부적합. 타격 기록만 반영한 임시 기준으로, 포지션·수비·부상·계약 상황을 반영한 실제 영입 판정은 아닙니다.</p><h4>구장 환경을 고려한 검토</h4><label>검토할 구단 <select data-park-player="${escape(a.id)}"><option value="">구단 선택</option>${Object.keys(root.KBOParks.parks).map(team=>`<option value="${escape(team)}" ${parkChoices.get(a.id)===team?'selected':''}>${escape(team)}</option>`).join('')}</select></label><div data-park-result="${escape(a.id)}" aria-live="polite">${parkMarkup(a,parkChoices.get(a.id))}</div><p class="hint">구장 보정 등급: 판정 보류. 구장별 타석·홈런, 좌우 타석별 타구 분포와 연도별 파크팩터가 필요합니다. 파크팩터는 구장이 득점이나 홈런에 미치는 영향을 추정한 통계입니다. 위 5단계 등급에는 구장 가감점이 없습니다.</p><h4>공개 자료와 계약 금액</h4>${report?`<p>${escape(report.season)}년 ${escape(report.amount)} · ${escape(report.text)} · <a href="${escape(report.url)}" target="_blank" rel="noopener noreferrer">출처 확인 ↗</a></p>`:'<p>이 선수와 선택 시즌에 대해 확인된 공개 기사·금액이 없습니다.</p>'}<p class="hint">기사는 수동 확인한 자료이며 자동 검색이나 전체 선수의 연봉 정보가 아닙니다. 금액은 해당 시즌 기준입니다.</p><h4>최근 출전 3시즌 추세</h4><p class="hint">리그 대비 지수: 100이 해당 시즌 리그 평균. 막대는 200을 최대 길이로 표시합니다.</p><div role="img" aria-label="시즌별 리그 대비 지수 막대그래프. 정확한 값은 아래 표 참조">${graph}</div>${trend}<h4>같은 시즌 · 같은 나이 비교</h4><p class="hint">다른 선수 중 200타석 이상 ${a.peers.length}명${a.peers.length?` · 대상보다 OPS가 높은 선수 ${rank-1}명`:''}. 아래는 상위 10명입니다.</p>${peerTable}<h4>같은 시즌 유사 유형 선수</h4><p class="hint">출루율·장타율·홈런·볼넷·삼진을 비교하며 거리가 작을수록 유사합니다. 대상과 비교 선수 모두 200타석 이상.</p>${similar}</article>`;
      }).join('');
      panel.querySelectorAll('[data-park-player]').forEach(select=>select.addEventListener('change',()=>{
        const id=select.dataset.parkPlayer, target=targets.get(id);
        if(!target)return;
        parkChoices.set(id,select.value);
        const a=engine.analyze(id,target.end);
        const output=[...panel.querySelectorAll('[data-park-result]')].find(el=>el.dataset.parkResult===id);
        if(a&&output)output.innerHTML=parkMarkup(a,select.value);
      }));
    };
  };
})(globalThis);
