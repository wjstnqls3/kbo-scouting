/* 독립 SVG 렌더러: 실제 값은 title/공유 툴팁/인접 표로 제공. */
(function(root){
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=['#176143','#ad7d20','#477ea5','#9b4772','#657645','#a35335'];
const f=v=>Number.isFinite(v)?v.toFixed(3):'미산출';
const tip=t=>`tabindex="0" data-tip="${esc(t)}" aria-label="${esc(t)}"`;
function wrap(body,label){return `<svg viewBox="0 0 ${body.includes('class="baseline-label"')?740:600} 330" role="group" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;}
function legend(series){return `<div class="chart-legend">${series.map((s,i)=>`<span><i style="background:${colors[i%colors.length]}"></i>${esc(s.name)}${s.provisional?' · 소타석 참고':''}</span>`).join('')}</div>`;}
function line(series,xLabel,yLabel){
 const pts=series.flatMap(s=>s.points).filter(p=>Number.isFinite(p.y)&&Number.isFinite(p.x));if(!pts.length)return '<p>그래프 기록 부족</p>';
 let xmin=Math.min(...pts.map(p=>p.x)),xmax=Math.max(...pts.map(p=>p.x));if(xmin===xmax)xmax=xmin+1;
 const indexed=yLabel.includes('OPS 지수');let ymin=Math.min(0,...pts.map(p=>p.y)),ymax=Math.max(indexed?110:0,...pts.map(p=>p.y));if(ymax===ymin)ymax=ymin+1;
 const X=v=>65+470*(v-xmin)/(xmax-xmin),Y=v=>270-225*(v-ymin)/(ymax-ymin);
 let b=axes(X,Y,xmin,xmax,ymin,ymax,xLabel,yLabel);
 if(indexed)b+=`<line x1="65" x2="535" y1="${Y(100)}" y2="${Y(100)}" stroke="#001e2b" stroke-dasharray="6 4"/><text class="baseline-label" x="545" y="${Y(100)+4}" text-anchor="start">리그 평균 100</text>`;
 series.forEach((s,i)=>{let segment=[];const flush=()=>{if(segment.length>1)b+=`<polyline fill="none" stroke="${colors[i%6]}" stroke-width="2.5" points="${segment.join(' ')}"/>`;segment=[];};s.points.forEach(p=>{if(!Number.isFinite(p.y)){flush();return;}segment.push(`${X(p.x)},${Y(p.y)}`);});flush();s.points.filter(p=>Number.isFinite(p.y)).forEach(p=>b+=`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4.5" fill="${colors[i%6]}" ${tip(`${s.name} · ${p.label||p.x}: ${f(p.y)} · ${yLabel}`)}><title>${esc(s.name)}: ${f(p.y)}</title></circle>`);});return wrap(b,yLabel)+legend(series);
}
function axes(X,Y,xmin,xmax,ymin,ymax,xLabel,yLabel){let s='';for(let i=0;i<=4;i++){let y=ymin+(ymax-ymin)*i/4;s+=`<line x1="65" x2="535" y1="${Y(y)}" y2="${Y(y)}" stroke="#9baea6" stroke-width="1" vector-effect="non-scaling-stroke"/><text x="58" y="${Y(y)+4}" text-anchor="end">${y.toFixed(2)}</text>`;}const ticks=Number.isInteger(xmin)&&Number.isInteger(xmax)&&xmax-xmin<10?Array.from({length:xmax-xmin+1},(_,i)=>xmin+i):Array.from({length:5},(_,i)=>xmin+(xmax-xmin)*i/4);for(const x of ticks)s+=`<line x1="${X(x)}" x2="${X(x)}" y1="45" y2="270" stroke="#9baea6" stroke-width="1" vector-effect="non-scaling-stroke"/><text x="${X(x)}" y="292" text-anchor="middle">${Number.isInteger(x)?x:x.toFixed(1)}</text>`;return s+`<path d="M65 45V270H535" fill="none" stroke="#233e34" stroke-width="2" vector-effect="non-scaling-stroke"/><text x="300" y="320" text-anchor="middle">${esc(xLabel)}</text><text x="65" y="22">${esc(yLabel)}</text>`;}
function scatter(points,xLabel,yLabel){const p=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(!p.length)return '<p>산점도 기록 없음</p>';let xmin=Math.min(...p.map(p=>p.x)),xmax=Math.max(...p.map(p=>p.x)),ymin=Math.min(...p.map(p=>p.y)),ymax=Math.max(...p.map(p=>p.y));if(xmin===xmax){xmin-=1;xmax+=1;}if(yLabel.includes('그해 리그 OPS')){ymin=Math.min(ymin,.9);ymax=Math.max(ymax,1.1);}if(yLabel.includes('OPS 지수')){ymin=Math.min(ymin,90);ymax=Math.max(ymax,110);}if(ymin===ymax){ymin-=1;ymax+=1;}const X=v=>65+470*(v-xmin)/(xmax-xmin),Y=v=>270-225*(v-ymin)/(ymax-ymin);let b=axes(X,Y,xmin,xmax,ymin,ymax,xLabel,yLabel);if(yLabel.includes('OPS 지수'))b+=`<line x1="65" x2="535" y1="${Y(100)}" y2="${Y(100)}" stroke="#001e2b" stroke-dasharray="6 4"/><text class="baseline-label" x="545" y="${Y(100)+4}" text-anchor="start">리그 평균 100</text>`;if(yLabel.includes('그해 리그 OPS'))b+=`<line x1="65" x2="535" y1="${Y(1)}" y2="${Y(1)}" stroke="#001e2b" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/><text class="baseline-label" x="545" y="${Y(1)+4}" text-anchor="start">리그 평균 1</text>`;p.sort((a,b)=>!!a.selected-!!b.selected).forEach(p=>b+=`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.selected?7:4}" fill="${p.selected?'#ad7d20':'#176143'}" opacity="${p.selected?1:.65}" ${tip(`${p.label} · ${xLabel}: ${f(p.x)} · ${yLabel}: ${f(p.y)}`)}><title>${esc(p.label)}</title></circle>`);return wrap(b,`${xLabel} / ${yLabel}`)+`<p class="hint">점: 선수·시즌${p.some(x=>x.selected)?' · 금색: '+p.filter(x=>x.selected).map(x=>esc(x.label)).join(', '):''}</p>`;}
function bars(rows,label,{max=100}={}){const valid=rows.filter(r=>Number.isFinite(r.value));if(!valid.length)return '<p>표본/자료 부족 · 점수 미산출</p>';const low=Math.min(0,...valid.map(r=>r.value)),high=Math.max(max,...valid.map(r=>r.value),1);const pos=v=>100*(v-low)/(high-low),zero=pos(0);return `<div class="bars" aria-label="${esc(label)}">${rows.map(r=>`<div class="bar-row"><span>${esc(r.label)}</span><div class="bar-track" ${tip(`${r.label}: ${f(r.value)} · ${r.detail||label}`)}><i style="left:${Number.isFinite(r.value)?Math.min(zero,pos(r.value)):zero}%;width:${Number.isFinite(r.value)?Math.abs(pos(r.value)-zero):0}%;background:${r.value<0?'#a84c3b':'#176143'}"></i><b style="left:${zero}%"></b></div><strong>${Number.isFinite(r.value)?r.value.toFixed(1):'—'}</strong></div>`).join('')}</div>`;}
function radarMethod(labels){
 const formulas={'OBP':'출루율(OBP)','K%':'삼진÷타석 · 낮을수록 유리','ISO':'장타율−타율(ISO)','BB%':'볼넷÷타석','OPS':'출루율+장타율(OPS)','HR%':'홈런÷타석'};
 const meanings={'OBP':'출루율','K%':'삼진율','ISO':'순장타율','BB%':'볼넷률','OPS':'출루율+장타율','HR%':'홈런율'};
 const items=labels.filter(l=>formulas[l]);
 return items.length?`<div class="radar-method"><strong>6각형 점수 계산 · 0~100백분위</strong><dl>${items.map(l=>`<div><dt>${esc(l)} ${esc(meanings[l])}</dt><dd>${esc(formulas[l])}</dd></div>`).join('')}</dl><p>각 기록÷해당 시즌 리그 기록으로 보정한 뒤 비교군 내 순위 계산. 삼진은 낮을수록, 나머지는 높을수록 유리.</p><p>백분위=(본인보다 불리한 값 수+동점 수×0.5)÷비교 표본 수×100. 50은 중간 순위 · 비교군은 설정한 최소 타석 이상. 대상의 타석이 적어도 기록이 있으면 점선으로 표시 · 원자료 없음 또는 지표별 비교 표본 5개 미만은 —.</p><p>출루율=(안타+볼넷+사구)÷(타수+볼넷+사구+희생플라이), 장타율=루타÷타수. 항목 간 일부 중복 · 공식 스카우팅 등급 아님.</p></div>`:'';
}
function radar(labels,series,{comparison=false,compact=false}={}){
 const cx=240,cy=195,r=118;
 const point=(i,v)=>[cx+Math.sin(i*2*Math.PI/labels.length)*r*v/100,cy-Math.cos(i*2*Math.PI/labels.length)*r*v/100];
 let b='';
 [25,50,75,100].forEach(v=>b+=`<polygon class="radar-grid" points="${labels.map((_,i)=>point(i,v).join(',')).join(' ')}" fill="none" stroke="${v===100?'#526e61':'#a5b9ad'}" stroke-width="${v===100?1.5:1}" vector-effect="non-scaling-stroke"/>`);
 labels.forEach((l,i)=>{
  const end=point(i,100),p=point(i,132),split=l.indexOf(' '),code=split<0?l:l.slice(0,split),meaning=split<0?'':l.slice(split+1);
  b+=`<line x1="${cx}" y1="${cy}" x2="${end[0]}" y2="${end[1]}" stroke="#a5b9ad" vector-effect="non-scaling-stroke"/><text x="${p[0]}" y="${p[1]-5}" text-anchor="middle"><tspan x="${p[0]}">${esc(code)}</tspan><tspan class="radar-caption" x="${p[0]}" dy="18">${esc(meaning)}</tspan></text>`;
 });
 [25,50,75,100].forEach(v=>b+=`<text class="radar-tick" x="${cx+7}" y="${cy-r*v/100+4}">${v}</text>`);
 series.forEach((s,j)=>{
  const color=colors[j%colors.length],complete=s.values.length===labels.length&&s.values.every(Number.isFinite);
  const dash=s.provisional?'6 4':comparison&&j%2===1?'2 4':null;
  if(complete)b+=`<polygon class="radar-data" points="${s.values.map((v,i)=>point(i,v).join(',')).join(' ')}" fill="${color}" fill-opacity="${s.provisional?'.05':comparison?'.08':'.12'}" stroke="${color}" stroke-width="${comparison?3:2.5}" vector-effect="non-scaling-stroke" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
  s.values.forEach((v,i)=>{
   if(!Number.isFinite(v))return;
   const p=point(i,v);
   b+=`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${color}" ${tip(`${s.name} · ${labels[i]}: ${v.toFixed(2)}백분위`)}><title>${esc(labels[i])}: ${v.toFixed(2)}</title></circle>`;
  });
 });
 const any=series.some(s=>s.values.some(Number.isFinite)),partial=any&&series.some(s=>!s.values.every(Number.isFinite));
 const notice=!any?`<p class="radar-empty" role="status">${comparison?"5각형":"6각형"} 점수 없음 · 비교 표본 또는 기록 부족 · 위의 비교 조건 확인</p>`:partial?'<p class="radar-empty">일부 축 계산 불가 · 확인된 점만 표시</p>':'';
 if(compact)return `<svg class="radar-chart" viewBox="0 12 480 339" width="480" height="339" role="group" aria-label="5각형 백분위 · 0~100" xmlns="http://www.w3.org/2000/svg">${b}</svg>`+notice+legend(series);
 return `<svg class="radar-chart${comparison?' radar-comparison':''}" viewBox="0 0 480 390" width="480" height="390" role="group" aria-label="자체 백분위 ${comparison?'5각형':'6각형'} · 0~100" xmlns="http://www.w3.org/2000/svg">${b}</svg>`+notice+legend(series).replace('chart-legend','chart-legend radar-legend')+ (comparison?`<ul class="radar-line-guide" aria-label="두 선수 비교 선 범례">${series.length>1?'<li><strong>실선</strong> 첫 번째 선수</li><li><strong>짧은 점선</strong> 두 번째 선수</li>':''}<li><strong>긴 점선</strong> 200타석 미만 참고</li><li><strong>바깥쪽</strong> 높은 백분위</li></ul>`:'<p class="hint">높은 값 = 높은 상대 순위 · 점선 = 소타석 참고 · 자료 없는 축은 생략</p>');
}
root.KBOCharts={line,scatter,bars,radar,radarMethod,esc};
})(globalThis);
