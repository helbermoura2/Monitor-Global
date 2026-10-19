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
 const notices=new Map(), exiting=new Map(), animated=new WeakSet();
 let pinned=typeof sidebarFilter!=='undefined'&&sidebarFilter!=='all', opened=pinned, timer=null, frame=null;
 const seen=new Map();
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
 function interacting(){return list.matches(':hover')||list.contains(document.activeElement);}
 function prune(){
  for(const [id,until]of notices)if(until<=Date.now()&&!exiting.has(id)){
   const card=[...list.querySelectorAll('.event')].find(el=>el.dataset.eventId===String(id));
   card?.classList.add('record-notice-exit');
   const task=setTimeout(()=>{exiting.delete(id);if(notices.get(id)!==until)return;notices.delete(id);setOpen(notices.size>0);},matchMedia('(prefers-reduced-motion:reduce)').matches?0:360);
   exiting.set(id,task);
  }
 }
 function idleClose(){
  cancel();if(!desktop.matches||pinned||!opened||interacting())return;
  const deadlines=[...notices].filter(([id])=>!exiting.has(id)).map(([,until])=>until);
  if(!deadlines.length)return;
  const deadline=Math.min(...deadlines);
  timer=setTimeout(()=>{if(interacting())return;prune();setOpen(notices.size>0);},Math.max(1,deadline-Date.now()));
 }
 function render(){
  document.body.classList.toggle('desktop-records-ready',desktop.matches);
  document.body.classList.toggle('desktop-records-open',desktop.matches&&opened);
  document.body.classList.toggle('desktop-records-pinned',desktop.matches&&pinned);
  // Visibility also tells camera framing to ignore the retracted column.
  if(desktop.matches){list.inert=!opened;list.setAttribute('aria-hidden',String(!opened));}
  else{list.inert=false;list.removeAttribute('aria-hidden');}
  const status=document.getElementById('desktop-records-status');if(status)status.textContent=pinned?'Fixos · Tudo para recolher':'Recolhe automaticamente';
  if(typeof renderSidebarList==='function'&&typeof lastMerged!=='undefined')renderSidebarList(lastMerged);
  for(const card of list.querySelectorAll('.event')){
   if(desktop.matches&&!pinned&&!animated.has(card)){animated.add(card);card.classList.add('record-notice-enter');}
   if(pinned)card.classList.remove('record-notice-enter','record-notice-exit');
  }
  queuePosition();window.dispatchEvent(new Event('desktop-records-change'));
 }
 function setOpen(value){if(!value&&!pinned)notices.clear();opened=pinned||!!value&&notices.size>0;if(!opened&&desktop.matches&&list.contains(document.activeElement))trigger.focus({preventScroll:true});render();idleClose();}
 function filter(type){pinned=type!=='all';if(!pinned)notices.clear();setOpen(pinned);}
 function items(rows){return !desktop.matches||pinned?rows:(rows||[]).filter(item=>notices.has(item.id));}
 function announce(ids){if(!desktop.matches||pinned||!ids.length)return;if(!interacting())prune();for(const id of ids)if(id!=null){
   clearTimeout(exiting.get(id));exiting.delete(id);
   const event=window.EventStore?.getById(id);
   notices.set(id,Date.now()+((event?.type==='earthquake'||event?.mag!=null)&&Number(event?.mag)>=6?60000:30000));
   [...list.querySelectorAll('.event')].find(el=>el.dataset.eventId===String(id))?.classList.remove('record-notice-exit');
  }if(notices.size)setOpen(true);}
 function toggle(){setOpen(!opened);}
 function arrivals(reason,payload){
  if(reason==='official-map'&&Number(payload.mag)>=5)announce([payload.id]);
  if(reason==='filter'&&pinned!==(sidebarFilter!=='all'))filter(sidebarFilter);
  if(reason==='revise'){
   announce((payload.ids||[]).filter(id=>{const e=window.EventStore.getById(id);return e&&(e.type==='earthquake'||e.mag!=null)&&Number(e.mag)>=5;}));
  }
  if(reason!=='filter'&&reason!=='replace')return;
  const active=typeof activeAlertingIds!=='undefined'?activeAlertingIds:new Map();const arrived=[];
  for(const [id,expires]of active){if(expires>Date.now()&&!seen.has(id))arrived.push(id);seen.set(id,expires);}
  for(const [id,expires]of seen)if(expires<=Date.now())seen.delete(id);
  if(arrived.length)announce(arrived);
 }
 const status=document.createElement('small');status.id='desktop-records-status';document.getElementById('events-label')?.append(status);
 document.getElementById('sidebar-events-close')?.addEventListener('click',()=>{if(desktop.matches)setOpen(false);});
 list.addEventListener('pointerenter',cancel);list.addEventListener('pointerleave',idleClose);list.addEventListener('focusin',cancel);list.addEventListener('focusout',idleClose);
 document.addEventListener('click',e=>{if(desktop.matches&&row.classList.contains('expanded')&&!row.contains(e.target))row.classList.remove('expanded');});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')row.classList.remove('expanded');});
 desktop.addEventListener('change',()=>{cancel();arrange();render();idleClose();});
 window.addEventListener('resize',queuePosition,{passive:true});new ResizeObserver(queuePosition).observe(header);
 window.EventStore?.subscribe(arrivals);
 window.DesktopRecords={open:setOpen,toggle,filter,items,state:()=>({open:opened,pinned,ids:[...notices.keys()]})};
 arrange();render();
})();
