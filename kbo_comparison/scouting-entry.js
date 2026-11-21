/* 기록 선택 화면에는 대시보드 진입만 표시. 선수 식별자는 전달용으로만 사용. */
(function(root){
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 root.createScoutingView=function(records){
  return (targets,chosen=new Map())=>{
   const panel=document.getElementById('scouting-results');
   const entries=[...targets.values(),...chosen.values()];
   panel.hidden=targets.size===0||entries.length===0;
   if(panel.hidden){panel.innerHTML='';return;}
   if(entries.length>4){panel.innerHTML='<p class="warning">스카우팅 리포트는 기준 선수 포함 최대 4명 · 선택 선수를 줄여주세요.</p>';return;}
   const params=new URLSearchParams({id:entries[0].id,year:String(entries[0].end)});
   for(const r of entries)params.append('selection',`${r.id}|${r.end}`);
   panel.innerHTML=`<a class="button-primary" id="open-scouting" href="scouting-dashboard.html?${esc(params.toString())}">스카우팅 분석 →</a>`;
  };
 };
})(globalThis);
