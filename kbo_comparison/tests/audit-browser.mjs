import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const folder = process.argv[2] || await mkdtemp('/tmp/kbo-audit-reports-');
await mkdir(folder,{recursive:true});
const profile = await mkdtemp(folder + '/chrome-');
const start = pathToFileURL(resolve('site/index.html')).href;
const browser = spawn(process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0',
  '--user-data-dir=' + profile, 'about:blank'
], {stdio:'ignore'});
const sleep = delay => new Promise(resolve => setTimeout(resolve, delay));
let socket;
try {
  let port;
  for (let n = 0; n < 120 && !port; n++) {
    try { port = (await readFile(profile + '/DevToolsActivePort','utf8')).split('\n')[0]; }
    catch { await sleep(80); }
  }
  assert.ok(port, 'Chrome DevTools port missing');
  const [target] = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject) => {
    socket.addEventListener('open',resolve,{once:true});
    socket.addEventListener('error',reject,{once:true});
  });
  let lastId = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const response = JSON.parse(event.data);
    if (!response.id || !pending.has(response.id)) return;
    const {resolve,reject} = pending.get(response.id);
    pending.delete(response.id);
    if (response.error) reject(new Error(JSON.stringify(response.error)));
    else resolve(response.result);
  });
  const call = (method,params={}) => new Promise((resolve,reject) => {
    const id = ++lastId;
    pending.set(id,{resolve,reject});
    socket.send(JSON.stringify({id,method,params}));
  });
  async function evaluate(fn,...args) {
    const response = await call('Runtime.evaluate',{
      expression:'(' + fn.toString() + ')(...' + JSON.stringify(args) + ')',
      returnByValue:true,awaitPromise:true
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
  async function open(query,selector) {
    const url = start + query;
    await call('Page.navigate',{url});
    await waitForPage(url,selector);
  }
  async function waitForPage(url,selector) {
    for (let n=0;n<150;n++) {
      if (await evaluate((expected,marker) => {
        const element = document.querySelector(marker);
        return location.href === expected && document.readyState !== 'loading' && element?.getClientRects().length > 0;
      },url,selector)) return;
      await sleep(70);
    }
    throw new Error('No rendered page for ' + url + ' ' + selector);
  }
  async function capture(name) {
    await sleep(120);
    const {data} = await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(folder + '/' + name + '.png',Buffer.from(data,'base64'));
  }
  async function pressKey(key,codeNumber) {
    const params={key,code:key,windowsVirtualKeyCode:codeNumber};
    await call('Input.dispatchKeyEvent',{...params,type:'keyDown',...(key==='Enter'?{text:'\r'}:{})});
    await call('Input.dispatchKeyEvent',{...params,type:'keyUp'});
  }
  const layout = (selector,width,height) => evaluate((selector,width,height) => {
    const content = document.querySelector(selector);
    const bounds = content.getBoundingClientRect();
    return {width:document.documentElement.clientWidth, overflow:document.documentElement.scrollWidth-width, top:Math.round(bounds.top), bottom:Math.round(bounds.bottom), height};
  },selector,width,height);
  const pdfStyle = id=>evaluate(id=>{
    const button=document.getElementById(id), label=button.querySelector('.pdf-label');
    return [getComputedStyle(button).backgroundColor,getComputedStyle(label).color,getComputedStyle(label.querySelector('svg')).stroke,button.offsetHeight];
  },id);
  await call('Page.enable');
  await call('Network.enable');
  // Keep the report reproducible offline. Portraits use the existing fallback.
  await call('Network.setBlockedURLs',{urls:['https://*','http://*']});
  const exceptions = [];
  socket.addEventListener('message',event=>{
    const msg = JSON.parse(event.data);
    if (msg.method==='Runtime.exceptionThrown') exceptions.push(msg.params.exceptionDetails.text);
  });
  await call('Runtime.enable');
  const viewports=[[1440,900],[1920,1080],[1280,800],[375,812],[390,844],[430,932]];
  for (const [width,height] of viewports) {
    const size=width<640?'mobile':'desktop';
    const savePdf=width===1440;
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:size==='mobile'});
    await open('?mode=time-machine','#start-screen');
    assert.equal(await evaluate(()=>document.querySelectorAll('.start-card').length),2);
    for (const mode of ['batting','pitching']) {
      const hitter = mode==='batting', name = hitter?'김도영':'브랜든';
      await open('?mode='+mode+'&year=2024','#discover-form');
      await evaluate(()=>{
        const profile=document.querySelector('#profile');
        profile.value='balanced';
        profile.dispatchEvent(new Event('change'));
        document.querySelector('[data-candidate]').click();
      });
      const pdf = async suffix => {
        const {data} = await call('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
        await writeFile(folder+'/'+mode+'-'+suffix+'.pdf',Buffer.from(data,'base64'));
      };
      const basicStyle=await pdfStyle('print-report');
      assert.deepEqual(basicStyle.slice(0,3),['rgb(255, 255, 255)','rgb(185, 64, 64)','rgb(185, 64, 64)']);
      assert.ok((await layout('#dashboard',width,height)).overflow<=1);
      await capture(width+'-'+mode+'-general');
      await evaluate(()=>document.querySelector('.radar-panel').scrollIntoView({block:'start'}));
      await capture(width+'-'+mode+'-radar');
      if (savePdf) await pdf('basic');
      if (savePdf) {
        await evaluate(()=>document.querySelector('#tab-overview').focus());
        await pressKey('ArrowRight',39);
        assert.equal(await evaluate(()=>document.activeElement.id),'tab-trend');
        assert.ok(await evaluate(()=>!document.querySelector('#trend-panel').hidden));
        await evaluate(()=>document.querySelector('#open-audit').focus());
        await pressKey('Enter',13);
        assert.equal(await evaluate(()=>document.activeElement.id),'audit-heading');
      } else {
        await evaluate(()=>document.querySelector('#open-audit').click());
      }
      assert.equal(await evaluate(()=>document.querySelector('#dashboard').getClientRects().length),0);
      const content = await evaluate(()=>document.querySelector('#audit-results').innerText);
      assert.deepEqual(await pdfStyle('print-audit'),basicStyle);
      const inputLayout=await evaluate(()=>{
        const choice=document.querySelector('.audit-inputs select').getBoundingClientRect();
        const note=document.querySelector('.audit-inputs textarea').getBoundingClientRect();
        return {aligned:choice.top===note.top,stacked:choice.bottom<=note.top,sameHeight:choice.height===note.height};
      });
      assert.ok(inputLayout.sameHeight && (size==='desktop'?inputLayout.aligned:inputLayout.stacked),JSON.stringify(inputLayout));
      assert.ok(content.includes(name) && content.includes(hitter?'13/15':'11/12'),content);
      assert.ok(content.includes('상대 강점') && content.includes('평가 기준별 순위 변화'));
      assert.equal(await evaluate(()=>document.querySelectorAll('.audit-stability details[open],.audit-deep details[open]').length),0);
      assert.ok(await evaluate(()=>document.querySelector('.audit-stability tbody tr > :nth-child(5)').getBoundingClientRect().right<=document.documentElement.clientWidth));
      const bounds = await layout('#decision-audit',width,height);
      assert.ok(bounds.overflow<=1,JSON.stringify(bounds));
      await capture(width+'-'+mode+'-audit');
      const summarySelector='.audit-stability summary';
      if (size==='desktop') {
        await evaluate(selector=>document.querySelector(selector).focus(),summarySelector);
        await pressKey('Enter',13);
        assert.ok(await evaluate(()=>document.activeElement.matches(':focus-visible') && getComputedStyle(document.activeElement).outlineStyle!=='none'));
      } else {
        await call('Emulation.setTouchEmulationEnabled',{enabled:true});
        const point=await evaluate(selector=>{
          const summary=document.querySelector(selector);
          summary.scrollIntoView({block:'center'});
          const rect=summary.getBoundingClientRect();
          return {x:rect.left+16,y:rect.top+rect.height/2};
        },summarySelector);
        await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
        await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }
      assert.ok(await evaluate(()=>document.querySelector('.audit-stability details').open));
      await evaluate(selector=>document.querySelector(selector).click(),summarySelector);
      await evaluate((hitter)=>{
        const choice=document.querySelector('#audit-choice-0-0');
        choice.value=hitter?'조건부 추천':'추가 관찰 필요';
        choice.dispatchEvent(new Event('change'));
        const note=document.querySelector('#audit-note-0-0');
        note.value=hitter?'장타 비중이 낮은 역할에서는 송성문과 타석 접근법을 함께 검토한다.':'최근 세 시즌의 이닝 차이를 고려해 등판 역할과 연속 등판 후 회복을 현장에서 확인한다.';
        note.dispatchEvent(new Event('input'));
      },hitter);
      await evaluate(()=>document.querySelectorAll('#audit-results summary').forEach(s=>s.click()));
      const deep = await evaluate(()=>document.querySelector('.audit-deep').innerText);
      for (const value of hitter ? ['6.08%','40.74%','0.60','90.91%','40/44회'] : ['20.32%p','1.32','9.00','0.36','TBF 315']) assert.ok(deep.includes(value),deep);
      assert.ok(deep.includes('백분위') && await evaluate(()=>document.querySelector('.audit-method').innerText.includes('유효 선수')),deep);
      assert.equal(await evaluate(()=>document.querySelector('.audit-stability details tbody').rows.length),1+(hitter?15:12));
      assert.ok((await layout('#decision-audit',width,height)).overflow<=1);
      const tablesFit=await evaluate(()=>[...document.querySelectorAll('#audit-results .table-wrap')].every(wrap=>{
        if (wrap.scrollWidth<=wrap.clientWidth+1) return true;
        wrap.scrollLeft=wrap.scrollWidth;
        const fits=wrap.scrollLeft+wrap.clientWidth>=wrap.scrollWidth-1;
        wrap.scrollLeft=0;
        return fits;
      }));
      assert.ok(tablesFit,'detail tables scroll to their last column');
      await evaluate(()=>document.querySelector('.audit-deep details').scrollIntoView({block:'start'}));
      await capture(width+'-'+mode+'-deep');
      await evaluate(()=>document.querySelectorAll('#audit-results summary').forEach(s=>s.click()));
      await evaluate(()=>document.querySelector('.audit-decision').scrollIntoView({block:'center'}));
      await capture(width+'-'+mode+'-judgment');
      assert.equal(await evaluate(()=>document.querySelectorAll('#audit-results details[open]').length),0);
      assert.equal(await evaluate(()=>document.querySelector('#audit-choice-0-0').value),hitter?'조건부 추천':'추가 관찰 필요');
      assert.ok(await evaluate(()=>document.querySelector('#audit-note-0-0').value.length>0));
      if (savePdf) {
        await pdf('final');
        assert.equal(await evaluate(()=>document.querySelectorAll('#audit-results details[open]').length),0);
        assert.equal(await evaluate(()=>document.querySelector('#audit-target-choice-0-0').textContent),hitter?'조건부 추천':'추가 관찰 필요');
      }
      await evaluate(()=>document.querySelector('#close-audit').click());
      assert.equal(await evaluate(()=>document.querySelectorAll('[data-candidate]:checked').length),1);
      if (savePdf) await pdf('basic-after-return');
      await evaluate(()=>document.querySelector('#open-audit').click());
      assert.equal(await evaluate(()=>document.querySelector('#audit-status-0-0').textContent),'판단·근거 작성');
      assert.ok(await evaluate(()=>document.querySelector('#audit-note-0-0').value.length>0));
      console.log(size,mode,name,bounds);
    }
  }
  await open('?mode=batting&year=2026','#discover-form');
  await evaluate(()=>{
    document.querySelector('[data-candidate="67893|2026"]').click();
    document.querySelector('[data-candidate="62404|2026"]').click();
    document.querySelector('#open-audit').click();
  });
  const roles=await evaluate(()=>({
    direct:document.querySelector('.audit-target').innerText,
    decisions:[...document.querySelectorAll('.audit-decision h4')].map(el=>el.innerText),
    rows:[...document.querySelectorAll('.audit-stability tbody tr')].map(el=>el.innerText)
  }));
  assert.match(roles.direct,/박성한.*구자욱/);
  assert.ok(!roles.direct.includes('김지찬') && roles.decisions.length===2);
  assert.ok(roles.rows.some(row=>row.includes('김지찬') && row.includes('모델 추천 대안') && row.includes('0/9 (0%)')));
  await evaluate(()=>{
    const note=document.querySelector('#audit-note-0-0');
    note.value='박성한 출루형 관찰';
    note.dispatchEvent(new Event('input'));
    document.querySelector('#close-audit').click();
    document.querySelector('[data-candidate="67893|2026"]').click();
    const profile=document.querySelector('#profile');
    profile.value='balanced';
    profile.dispatchEvent(new Event('change'));
    document.querySelector('#player-search').value='박성한';
    document.querySelector('#player-search').dispatchEvent(new Event('input'));
    document.querySelector('[data-candidate="67893|2026"]').click();
    document.querySelector('#open-audit').click();
  });
  assert.deepEqual(await evaluate(()=>[...document.querySelectorAll('.audit-decision textarea')].map(t=>t.value)),['','']);
  await open('?mode=pitching&year=2026&selection=56801%7C2026&selection=69446%7C2026','#open-audit');
  assert.equal(await evaluate(()=>document.querySelectorAll('[data-candidate]:checked').length),2);
  await evaluate(()=>document.querySelector('#open-audit').click());
  assert.deepEqual(await evaluate(()=>[...document.querySelectorAll('.audit-decision h4')].map(el=>el.innerText.split(' ')[0])),['아빌라','원태인']);
  assert.match(await evaluate(()=>document.querySelector('.audit-stability tbody').innerText),/벤자민[\s\S]*모델 추천 대안/);
  await evaluate(()=>{
    document.querySelector('#close-audit').click();
    const search=document.querySelector('#player-search');
    search.value='베니지아노';
    search.dispatchEvent(new Event('input'));
    document.querySelector('[data-candidate="56841|2026"]').click();
    document.querySelector('#open-audit').click();
  });
  assert.equal(await evaluate(()=>document.querySelectorAll('.audit-decision').length),3);
  await call('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
  await evaluate(()=>document.querySelectorAll('#audit-results details').forEach(d=>d.open=true));
  assert.ok((await layout('#decision-audit',375,812)).overflow<=1);
  await evaluate(()=>document.querySelectorAll('#audit-results details').forEach(d=>d.open=false));
  const multiPDF=await call('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
  await writeFile(folder+'/pitching-three-final.pdf',Buffer.from(multiPDF.data,'base64'));
  await evaluate(()=>document.querySelector('#close-audit').click());
  await evaluate(()=>document.querySelector('#switch-batting').click());
  await waitForPage(start+'?mode=batting&year=2026','#discover-form');
  assert.equal(await evaluate(()=>document.querySelector('#open-audit').disabled),true);
  assert.equal(await evaluate(()=>document.querySelector('#dashboard-title').textContent),'KBO 타자 스카우팅');
  await open('?mode=pitching&year=2026','#discover-form');
  const actionState=()=>evaluate(()=>['print-report','open-audit'].map(id=>{
    const button=document.getElementById(id);
    return !button.disabled && button.getClientRects().length>0;
  }));
  assert.deepEqual(await actionState(),[false,false]);
  await evaluate(()=>{
    const search=document.querySelector('#player-search');
    search.value='이승현';
    search.dispatchEvent(new Event('input'));
    document.querySelector('[data-candidate="60146|2026"]').click();
  });
  assert.deepEqual(await actionState(),[true,true]);
  const fieldMemo='\n첫 번째 투수 관찰\n등판 간격 확인';
  await evaluate(value=>{
    const note=document.querySelector('#report-content textarea');
    note.value=value;
    note.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('[data-candidate="51454|2026"]').click();
  },fieldMemo);
  assert.equal(await evaluate(()=>document.querySelector('#report-content textarea').value),fieldMemo);
  await evaluate(()=>{
    document.querySelector('#open-audit').click();
  });
  const headings=await evaluate(()=>[...document.querySelectorAll('.audit-decision h4')].map(h=>h.textContent));
  assert.match(headings[0],/이승현.*60146/);
  assert.match(headings[1],/이승현.*51454/);
  const memo='\n첫 번째 투수 판단\n다음 등판 확인';
  await evaluate(value=>{
    const note=document.querySelector('#audit-note-0-0');
    note.value=value;
    note.dispatchEvent(new Event('input'));
    document.querySelector('#close-audit').click();
    document.querySelector('#open-audit').click();
  },memo);
  assert.deepEqual(await evaluate(()=>[...document.querySelectorAll('.audit-decision textarea')].map(t=>t.value)),[memo,'']);
  const namesakePdf=await call('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
  await writeFile(folder+'/pitching-namesakes-final.pdf',Buffer.from(namesakePdf.data,'base64'));
  await evaluate(()=>{
    document.querySelector('#close-audit').click();
    document.querySelector('[data-candidate="51454|2026"]').click();
    document.querySelector('[data-candidate="60146|2026"]').click();
  });
  assert.deepEqual(await actionState(),[false,false]);
  await open('?mode=pitching&year=2024&selection=74857%7C2024','#open-audit');
  assert.ok(await evaluate(()=>document.querySelector('.candidate-fit').textContent.includes('순위 보류 · 최소 이닝 미달')));
  for (const kind of ['basic','final']) {
    if (kind==='final') {
      await evaluate(()=>document.querySelector('#open-audit').click());
      assert.match(await evaluate(()=>document.querySelector('.audit-target').innerText),/직접 선택 · 정우람 산출 보류/);
    }
    const pdf=await call('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
    await writeFile(folder+'/pitching-zero-'+kind+'.pdf',Buffer.from(pdf.data,'base64'));
  }
  assert.deepEqual(exceptions,[]);
  console.log('Reports and screenshots',folder);
} finally {
  socket?.close();
  browser.kill();
}
