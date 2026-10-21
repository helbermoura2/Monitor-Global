/* Desktop records reuse the existing cards; no requests or polling jobs. */
(() => {
 'use strict';
 const desktop=matchMedia('(min-width:901px)'), row=document.getElementById('chips-row');
 const list=document.getElementById('sidebar-left'), header=document.getElementById('top-strip');
 if(!row||!list||!header)return;
 const more=document.getElementById('more-filters-toggle');
 more?.setAttribute('aria-controls','desktop-extra-filters');
 const extra=document.createElement('div');extra.id='desktop-extra-filters';extra.setAttribute('role','group');extra.setAttribute('aria-label','Mais filtros');
 row.append(extra);
 const trigger=row.querySelector('[data-f="all"]');
 const notices=new Map(), noticeInfo=new Map(), exiting=new Map(), animated=new WeakSet();
 let arrivalSequence=0,latestSequence=0;
 let pinned=typeof sidebarFilter!=='undefined'&&sidebarFilter!=='all', opened=pinned, timer=null, frame=null;
 const seen=new Map(),revisionSeen=new Map();
 const revisionKey=e=>JSON.stringify([e.mag,e.depth,e.coords,e.source==='USGS-RT'?'USGS':e.source,e.sourceEventId,!!e.isPreliminary]);
 const pendingPhysicalRevision=e=>(typeof activeUpdatedIds!=='undefined'&&(activeUpdatedIds.get(e.id)||0)>Date.now())&&((Number.isFinite(e._previousMag)&&Math.abs(e.mag-e._previousMag)>=.1-1e-9)||/\d+\s*→\s*\d+\s*km|preliminar\s*→\s*revisado/.test(e._deltaTxt||''));
 const labels={all:'Tudo',earthquake:'Sismos',volcano:'Vulcões',tsunami:'Tsunamis',hurricane:'Ciclones',storm:'Tempestades',fire:'Incêndios',tornado:'Tornados',civil:'Defesa Civil',wind:'Vento forte',flood:'Enchentes'};
 const originals=new Map([...row.children].filter(el=>el.tagName==='BUTTON').map(el=>[el,el.innerHTML]));
 function arrange(){
  if(desktop.matches){
   row.querySelectorAll('.advanced-filter').forEach(el=>{if(el.parentElement!==extra)extra.append(el);});
   for(const [el,html]of originals){
    const label=labels[el.dataset.f]||({'chip-meteorologia':'Meteorologia','chip-radar':'Radar','chip-geo-br':'Brasil','chip-visual-theme':'Visual','chip-menu-desktop':'Menu'})[el.id];
    if(label&&el.textContent!==label)el.textContent=label;
   }
  }else{
   [...extra.children].forEach(el=>row.insertBefore(el,extra));
   for(const [el,html]of originals)if(el.innerHTML!==html)el.innerHTML=html;
  }
 }
 function position(){
  frame=null;if(!desktop.matches)return;
  const bottom=Math.ceil(header.getBoundingClientRect().bottom);
  document.documentElement.style.setProperty('--desktop-records-top',bottom+'px');
 }
 function queuePosition(){if(frame===null)frame=requestAnimationFrame(position);}
 function cancel(){clearTimeout(timer);timer=null;}
 function prune(){
  for(const [id,until]of notices)if(until<=Date.now()&&!exiting.has(id)){
   const card=[...list.querySelectorAll('.event')].find(el=>el.dataset.eventId===String(id));
   card?.classList.add('record-notice-exit');
   const task=setTimeout(()=>{exiting.delete(id);if(notices.get(id)!==until)return;notices.delete(id);noticeInfo.delete(id);setOpen(notices.size>0);},matchMedia('(prefers-reduced-motion:reduce)').matches?0:360);
   exiting.set(id,task);
  }
 }
 function idleClose(){
  cancel();if(!desktop.matches||pinned||!opened)return;
  const deadlines=[...notices].filter(([id])=>!exiting.has(id)).map(([,until])=>until);
  if(!deadlines.length)return;
  const deadline=Math.min(...deadlines);
  timer=setTimeout(()=>{prune();setOpen(notices.size>0);},Math.max(1,deadline-Date.now()));
 }
 function dismiss(id){if(!notices.has(id))return;notices.set(id,Date.now());prune();idleClose();}
 function decorate(card,item){
  const info=noticeInfo.get(item.id);
  if(!desktop.matches||pinned||!info){
   card.querySelector('.record-arrival')?.remove();card.querySelector('.record-notice-close')?.remove();
   for(const key of ['recordKind','recordLabel','recordLatest'])delete card.dataset[key];return;
  }
  card.dataset.recordKind=info.kind;card.dataset.recordLabel=info.kind==='updated'?'ATUALIZADO':'NOVO';
  card.dataset.recordLatest=String(info.sequence===latestSequence);
  let arrival=card.querySelector('.record-arrival');
  if(!arrival){
   arrival=document.createElement('span');arrival.className='record-arrival';
   const time=document.createElement('time');time.className='record-arrival-time';
   const dot=document.createElement('span');dot.className='record-arrival-dot';dot.setAttribute('aria-hidden','true');
   arrival.append(time,dot);card.append(arrival);
  }
  const time=arrival.querySelector('time');time.dateTime=new Date(info.time).toISOString();
  const label=new Date(info.time).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  time.textContent=label;arrival.setAttribute('aria-label','Chegou ao sistema às '+label+' BRT');
  let close=card.querySelector('.record-notice-close');
  if(!close){close=document.createElement('button');close.type='button';close.className='record-notice-close';close.textContent='×';close.setAttribute('aria-label','Ocultar este registro');close.title='Ocultar este registro';close.addEventListener('click',e=>{e.stopPropagation();dismiss(item.id);});close.addEventListener('keydown',e=>e.stopPropagation());card.append(close);}
  const place=card.querySelector('.event-place');
  const country=window.CountryBoundaries?.lookup(item.coords?.[1],item.coords?.[0]);
  const code=country?.countryCode||'';
  if(place&&(!place.dataset.recordPlace||place.dataset.recordCountry!==code)){
   place.dataset.recordPlace=place.dataset.recordPlace||place.textContent.replace(/^[\s\u{1F1E6}-\u{1F1FF}🌀]+/u,'').trim();
   const state=place.querySelector('.br-state-flag')?.cloneNode(true);
   place.dataset.recordCountry=code;
   const flag=window.MainCardLayout?.countryImage(country?.countryCode,country?.nome);
   place.replaceChildren();if(flag)place.append(flag);if(state)place.append(state);place.append(document.createTextNode(place.dataset.recordPlace));
  }
 }
 function render(){
  document.body.classList.toggle('desktop-records-ready',desktop.matches);
  document.body.classList.toggle('desktop-records-open',desktop.matches&&opened);
  document.body.classList.toggle('desktop-records-pinned',desktop.matches&&pinned);
  // Visibility also tells camera framing to ignore the retracted column.
  if(desktop.matches){list.inert=!opened;list.setAttribute('aria-hidden',String(!opened));}
  else{list.inert=false;list.removeAttribute('aria-hidden');}
  const status=document.getElementById('desktop-records-status');if(status)status.textContent=pinned?'Fixos · Tudo para recolher':'Recolhe automaticamente';
  const reflowMotion=desktop.matches&&opened&&!pinned&&!matchMedia('(prefers-reduced-motion:reduce)').matches;
  const positions=new Map();if(reflowMotion){const bounds=list.getBoundingClientRect();for(const el of list.querySelectorAll('.event')){const r=el.getBoundingClientRect();if(r.top>bounds.bottom)break;if(r.bottom>=bounds.top&&r.height){positions.set(el,r.top);if(positions.size>=8)break;}}}
  if(typeof renderSidebarList==='function'&&typeof lastMerged!=='undefined')renderSidebarList(lastMerged);
  for(const card of list.querySelectorAll('.event')){
   if(desktop.matches&&opened&&!pinned&&notices.has(card.dataset.eventId)&&!animated.has(card)){animated.add(card);card.classList.add('record-notice-enter');}
   if(pinned||!opened)card.classList.remove('record-notice-enter','record-notice-exit');
   const before=positions.get(card),delta=before==null?0:before-card.getBoundingClientRect().top;
   if(reflowMotion&&Math.abs(delta)>1&&!card.classList.contains('record-notice-exit'))card.animate([{transform:'translateY('+delta+'px)'},{transform:'translateY(0)'}],{duration:220,easing:'ease-out'});
  }
  queuePosition();window.dispatchEvent(new Event('desktop-records-change'));
 }
 function setOpen(value){if(!value&&!pinned){notices.clear();noticeInfo.clear();}opened=pinned||!!value&&notices.size>0;if(!opened&&desktop.matches&&list.contains(document.activeElement))trigger.focus({preventScroll:true});render();idleClose();}
 function filter(type){pinned=type!=='all';if(!pinned){notices.clear();noticeInfo.clear();}setOpen(pinned);}
 function items(rows){latestSequence=[...notices.keys()].reduce((max,id)=>Math.max(max,noticeInfo.get(id)?.sequence||0),0);return !desktop.matches||pinned?rows:(rows||[]).filter(item=>notices.has(item.id)).sort((a,b)=>(noticeInfo.get(b.id)?.sequence||0)-(noticeInfo.get(a.id)?.sequence||0));}
 function announce(ids,kind='new'){if(!desktop.matches||pinned||!ids.length)return;prune();for(const id of ids)if(id!=null){
   clearTimeout(exiting.get(id));exiting.delete(id);
   const event=window.EventStore?.getById(id);
   if(event){revisionSeen.delete(id);revisionSeen.set(id,revisionKey(event));if(revisionSeen.size>256)revisionSeen.delete(revisionSeen.keys().next().value);}
   noticeInfo.set(id,{time:Date.now(),sequence:++arrivalSequence,kind});
   notices.set(id,Date.now()+(event?.type==='tsunami'||(event?.type==='earthquake'||event?.mag!=null)&&Number(event?.mag)>=6?60000:30000));
   [...list.querySelectorAll('.event')].find(el=>el.dataset.eventId===String(id))?.classList.remove('record-notice-exit');
  }if(notices.size)setOpen(true);}
 function toggle(){setOpen(!opened);}
 function arrivals(reason,payload){
  // Showing or refreshing a ShakeMap is informational, not a quake arrival.
  // SeismicImpact already exposes its own explicitly labelled map notice.
  if(reason==='filter'&&pinned!==(sidebarFilter!=='all'))filter(sidebarFilter);
  if(reason==='revise'){
   announce((payload.ids||[]).filter(id=>{const e=window.EventStore.getById(id);return e&&(e.type==='earthquake'||e.mag!=null)&&Number(e.mag)>=5&&revisionSeen.get(id)!==revisionKey(e);}),'updated');
  }
  if(reason!=='filter'&&reason!=='replace')return;
  // Baseline existing large quakes before later source-only notifications.
  for(const e of typeof globalEvents!=='undefined'?globalEvents:[])if(e&&Number(e.mag)>=5&&!revisionSeen.has(e.id)&&!pendingPhysicalRevision(e)){revisionSeen.set(e.id,revisionKey(e));if(revisionSeen.size>256)revisionSeen.delete(revisionSeen.keys().next().value);}
  const active=typeof activeAlertingIds!=='undefined'?activeAlertingIds:new Map();const arrived=[];
  for(const [id,expires]of active){if(expires>Date.now()&&!seen.has(id))arrived.push(id);seen.set(id,expires);}
  for(const [id,expires]of seen)if(expires<=Date.now())seen.delete(id);
  if(arrived.length)announce(arrived);
 }
 const status=document.createElement('small');status.id='desktop-records-status';document.getElementById('events-label')?.append(status);
 list.addEventListener('animationend',e=>{if(e.animationName==='record-notice-in')e.target.classList.remove('record-notice-enter');});
 document.getElementById('sidebar-events-close')?.addEventListener('click',()=>{if(desktop.matches)setOpen(false);});
 document.addEventListener('click',e=>{if(desktop.matches&&row.classList.contains('expanded')&&!row.contains(e.target))row.classList.remove('expanded');});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')row.classList.remove('expanded');});
 desktop.addEventListener('change',()=>{cancel();arrange();render();idleClose();});
 window.addEventListener('resize',queuePosition,{passive:true});new ResizeObserver(queuePosition).observe(header);
 window.EventStore?.subscribe(arrivals);
 window.DesktopRecords={open:setOpen,toggle,filter,items,decorate,dismiss,state:()=>({open:opened,pinned,ids:[...notices.keys()]})};
 arrange();render();
})();
