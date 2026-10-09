const {test,expect}=require('@playwright/test');
test.use({serviceWorkers:'block',reducedMotion:'reduce'});
async function boot(page,width){
 const base=process.env.PUBLIC_SITE_URL||'http://127.0.0.1:4173';
 await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 await page.setViewportSize({width,height:844});await page.goto(base+'/?verify=20261009-incremental-list',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento);
 await page.evaluate(()=>{pausarBuscas();pendingNewCameraQuakes.clear();pendingQuakeRevisions.clear();clearTimeout(cycleTimeout);stopWaveFront();stopFeltZone();SeismicCinema.stop();activeAlertingIds.clear();activeUpdatedIds.clear();activeLateIds.clear();});
 await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
}
for(const width of [1280,390])test('incremental records preserve nodes, scroll, selection, revisions and age '+width,async({page})=>{
 await boot(page,width);
 const initial=await page.evaluate(()=>{
  const now=Date.now();globalEvents=Array.from({length:125},(_,i)=>({id:'list-'+i,type:'earthquake',mag:3,depth:10,coords:[-60,-10],time:now-600000-i*1000,place:'Registro '+i,source:'QA',bandeira:'🇧🇷'}));
  globalAlerts=[];lastMerged=globalEvents.slice();eventoSelecionadoId='list-8';renderSidebarList(lastMerged);
  const c=document.getElementById('events');c.style.setProperty('height','400px','important');c.style.setProperty('overflow','auto','important');
  if(innerWidth<900)toggleMobileEventsModal(true);
  window.__listNodes=new Map([...c.querySelectorAll('.event')].map(n=>[n.dataset.eventId,n]));
  window.__listChildren=new Map([...__listNodes].map(([id,n])=>[id,n.firstElementChild]));
  window.__listObserver=new MutationObserver(()=>{});__listObserver.observe(c,{subtree:true,childList:true,attributes:true,characterData:true});
  renderSidebarList(lastMerged);__listObserver.takeRecords();
  const formatter=recordCardTime;window.__recordTimeFormats=0;window.recordCardTime=time=>{__recordTimeFormats++;return formatter(time);};
  for(let i=0;i<50;i++)renderSidebarList(lastMerged);
  const unchanged=__listObserver.takeRecords().length;
  __listNodes.get('list-8').focus({preventScroll:true});c.scrollTop=600;const scroll=c.scrollTop;
  eventoSelecionadoId='list-9';renderSidebarList(lastMerged);
  const selection=__listObserver.takeRecords();
  return {count:c.querySelectorAll('.event').length,unchanged,timeFormats:__recordTimeFormats,selectionRebuilds:selection.filter(r=>r.type==='childList').length,scroll,afterScroll:c.scrollTop,sameNodes:[...__listNodes].every(([id,n])=>c.querySelector('[data-event-id="'+id+'"]')===n)};
 });
 expect(initial.count).toBe(120);expect(initial.unchanged).toBe(0);expect(initial.timeFormats).toBe(0);expect(initial.selectionRebuilds).toBe(0);expect(initial.sameNodes).toBe(true);expect(initial.afterScroll).toBe(initial.scroll);
 const revised=await page.evaluate(()=>{
  const old=globalEvents[60];globalEvents[60]={...old,mag:6.3,depth:18,place:'Local revisado',source:'Fonte revisada',sources:['Fonte revisada']};lastMerged=globalEvents.slice();
  renderSidebarList(lastMerged);const c=document.getElementById('events');
  const changes=__listObserver.takeRecords().filter(r=>r.type==='childList');
  return {rows:[...new Set(changes.map(r=>r.target.closest?.('.event')?.dataset.eventId).filter(Boolean))],sameNodes:[...__listNodes].every(([id,n])=>c.querySelector('[data-event-id="'+id+'"]')===n),untouchedChildren:[...__listChildren].every(([id,n])=>id==='list-60'||__listNodes.get(id).firstElementChild===n)};
 });
 expect(revised.rows).toEqual(['list-60']);expect(revised.sameNodes).toBe(true);expect(revised.untouchedChildren).toBe(true);
 await expect(page.locator('[data-event-id="list-60"]')).toContainText('6.3');await expect(page.locator('[data-event-id="list-60"]')).toContainText('Local revisado');await expect(page.locator('[data-event-id="list-60"]')).toContainText('18 km');
 const appended=await page.evaluate(()=>{
  const c=document.getElementById('events'),n=__listNodes.get('list-8');n.focus({preventScroll:true});c.scrollTop=600;const before=c.scrollTop;
  const fresh={...globalEvents[0],id:'list-new',time:Date.now(),place:'Novo registro',mag:5.2};activeAlertingIds.set(fresh.id,Date.now()+60000);globalEvents.unshift(fresh);lastMerged=globalEvents.slice();renderSidebarList(lastMerged);
  return {first:c.querySelector('.event').dataset.eventId,count:c.querySelectorAll('.event').length,preserved:[...__listNodes].filter(([id])=>id!=='list-119').every(([id,node])=>c.querySelector('[data-event-id="'+id+'"]')===node),before,after:c.scrollTop,focus:document.activeElement===n,removed:__listNodes.get('list-119').isConnected};
 });
 expect(appended).toMatchObject({first:'list-new',count:120,preserved:true,focus:true,removed:false});expect(appended.after).toBe(appended.before);
 // Moving time forward changes only the age text, leaving structural children intact.
 await page.clock.fastForward(61000);
 const aged=await page.evaluate(()=>{
  renderSidebarList(lastMerged);return {firstChild:__listNodes.get('list-8').firstElementChild===__listChildren.get('list-8'),age:__listNodes.get('list-8').querySelector('.ev-age').textContent,newBadge:document.querySelector('[data-event-id="list-new"]').classList.contains('new-event')};
 });expect(aged.firstChild).toBe(true);expect(aged.age).toBe('11m atrás');expect(aged.newBadge).toBe(false);
 const filtered=await page.evaluate(()=>{
  const newNode=document.querySelector('[data-event-id="list-new"]'),revision=__listNodes.get('list-60');
  renderSidebarList(lastMerged.filter(item=>item.mag>=5));
  const c=document.getElementById('events');const kept=c.querySelectorAll('.event').length===2&&newNode.isConnected&&revision.isConnected;
  renderSidebarList(lastMerged);
  globalEvents[0].time=Date.now()-2*3600000;renderSidebarList(lastMerged);
  return {kept,count:c.querySelectorAll('.event').length,sameNode:document.querySelector('[data-event-id="list-new"]')===newNode,group:newNode.previousElementSibling.textContent};
 });expect(filtered).toEqual({kept:true,count:120,sameNode:true,group:'🕐 1–6h atrás'});
 console.log(JSON.stringify({width,visibleRecords:120,unchangedRenders:50,unchangedDomMutations:initial.unchanged,revisedRecords:revised.rows.length,preservedOnInsertion:119}));
});
for(const width of [1280,390])test('incremental warning cards use current data and cancel obsolete badge timers '+width,async({page})=>{
 await boot(page,width);
 await page.evaluate(()=>{
  const item={id:'warning-list',type:'wind',hazardNature:'warning',regionalWarning:true,time:Date.now(),place:'Victoria — Austrália',source:'BOM',severityLabel:'Moderado',detail:'Aviso inicial',link:'https://reg.bom.gov.au/vic/warnings/marinewind.shtml'};
  globalEvents=[];globalAlerts=[item];lastMerged=[item];eventoSelecionadoId='keep';activeAlertingIds.set(item.id,Date.now()+2000);renderSidebarList(lastMerged);
  window.__warningNode=document.querySelector('[data-event-id="warning-list"]');window.__initialBadgeTimer=sidebarCardStates.get(__warningNode).timer;
  for(let i=0;i<20;i++)renderSidebarList(lastMerged);
  window.__sourceOpened=[];window.abrirEvidenciasFontes=item=>__sourceOpened.push(item.detail);
  if(innerWidth<900)toggleMobileEventsModal(true);
 });
 expect(await page.evaluate(()=>sidebarCardStates.get(__warningNode).timer===__initialBadgeTimer)).toBe(true);
 await page.clock.runFor(1000);
 await page.evaluate(()=>{
  const revised={...globalAlerts[0],detail:'Aviso revisado',severityLabel:'Severo',link:'https://reg.bom.gov.au/vic/warnings/'};globalAlerts=[revised];lastMerged=[revised];activeAlertingIds.set(revised.id,Date.now()+5000);renderSidebarList(lastMerged);
 });
 await page.clock.runFor(1100);expect(await page.evaluate(()=>__warningNode.classList.contains('new-event'))).toBe(true);
 const card=page.locator('[data-event-id="warning-list"]');await expect(card).toContainText('Aviso revisado');await expect(card.locator('.ev-bulletin-link')).toHaveAttribute('href','https://reg.bom.gov.au/vic/warnings/');
 await card.locator('.source-evidence-trigger').evaluate(el=>el.click());expect(await page.evaluate(()=>__sourceOpened)).toEqual(['Aviso revisado']);expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('keep');
 await card.locator('.source-evidence-trigger').focus();await card.locator('.source-evidence-trigger').press('Enter');expect(await page.evaluate(()=>__sourceOpened)).toEqual(['Aviso revisado','Aviso revisado']);expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('keep');
 await card.locator('.ev-bulletin-link').evaluate(el=>{el.addEventListener('click',e=>e.preventDefault());el.click();});expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('keep');
 const removed=await page.evaluate(()=>{
  renderSidebarList([]);const state=sidebarCardStates.get(__warningNode);return {connected:__warningNode.isConnected,timer:state.timer};
 });expect(removed).toEqual({connected:false,timer:null});
 await page.clock.runFor(6000);
 await page.evaluate(()=>{renderSidebarList([]);lastMerged=globalAlerts.slice();renderSidebarList(lastMerged);});
 await expect(card).not.toHaveClass(/new-event/);await expect(card).toContainText('Aviso revisado');
 await page.evaluate(()=>{globalAlerts[0]._deltaTxt='Severidade revisada';activeUpdatedIds.set('warning-list',Date.now()+500);renderSidebarList(lastMerged);});
 await expect(card).toHaveClass(/updated-event/);await expect(card).toContainText('Severidade revisada');
 await page.clock.runFor(600);await page.evaluate(()=>renderSidebarList(lastMerged));await expect(card).not.toHaveClass(/updated-event/);await expect(card).not.toContainText('Severidade revisada');
 await card.focus();await card.press('Enter');await expect(page.locator('#pd-local')).toContainText('Victoria');expect(await page.evaluate(()=>eventoSelecionadoId)).toBe('warning-list');
 await page.evaluate(()=>{globalAlerts=[];lastMerged=[];renderSidebarList(lastMerged);});await expect(page.locator('#events')).toContainText('Nenhum evento neste filtro');
});
