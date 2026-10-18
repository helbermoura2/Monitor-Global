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
 const trigger=document.createElement('button');trigger.type='button';trigger.id='desktop-records-toggle';trigger.className='chip';trigger.textContent='Registros';trigger.setAttribute('aria-controls','sidebar-left');row.append(trigger);
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
 function idleClose(){
  cancel();if(!desktop.matches||pinned||!opened)return;
  timer=setTimeout(()=>{if(list.matches(':hover')||list.contains(document.activeElement)){idleClose();return;}setOpen(false);},20000);
 }
 function render(){
  document.body.classList.toggle('desktop-records-ready',desktop.matches);
  document.body.classList.toggle('desktop-records-open',desktop.matches&&opened);
  document.body.classList.toggle('desktop-records-pinned',desktop.matches&&pinned);
  trigger.setAttribute('aria-expanded',String(opened));trigger.textContent=pinned?'Registros · fixos':'Registros';
  trigger.title=pinned?'Escolha Tudo para voltar aos registros retráteis':'Abrir ou recolher registros';
  // Visibility also tells camera framing to ignore the retracted column.
  if(desktop.matches){list.inert=!opened;list.setAttribute('aria-hidden',String(!opened));}
  else{list.inert=false;list.removeAttribute('aria-hidden');}
  const status=document.getElementById('desktop-records-status');if(status)status.textContent=pinned?'Fixos · Tudo para recolher':'Recolhe automaticamente';
  queuePosition();window.dispatchEvent(new Event('desktop-records-change'));
 }
 function setOpen(value){opened=pinned||!!value;if(!opened&&desktop.matches&&list.contains(document.activeElement))trigger.focus({preventScroll:true});render();idleClose();}
 function filter(type){pinned=type!=='all';setOpen(pinned);}
 function toggle(){setOpen(!opened);}
 function arrivals(reason,payload){
  if(reason==='official-map'&&Number(payload.mag)>=5)setOpen(true);
  if(reason==='filter'&&pinned!==(sidebarFilter!=='all'))filter(sidebarFilter);
  if(reason==='revise'){
   if((payload.ids||[]).some(id=>{const e=window.EventStore.getById(id);return e&&(e.type==='earthquake'||e.mag!=null)&&Number(e.mag)>=5;}))setOpen(true);
  }
  if(reason!=='filter'&&reason!=='replace')return;
  const active=typeof activeAlertingIds!=='undefined'?activeAlertingIds:new Map();let arrived=false;
  for(const [id,expires]of active){if(expires>Date.now()&&!seen.has(id))arrived=true;seen.set(id,expires);}
  for(const [id,expires]of seen)if(expires<=Date.now())seen.delete(id);
  if(arrived)setOpen(true);
 }
 const status=document.createElement('small');status.id='desktop-records-status';document.getElementById('events-label')?.append(status);
 trigger.onclick=toggle;
 document.getElementById('sidebar-events-close')?.addEventListener('click',()=>{if(desktop.matches)setOpen(false);});
 list.addEventListener('pointerenter',cancel);list.addEventListener('pointerleave',idleClose);list.addEventListener('focusin',cancel);list.addEventListener('focusout',idleClose);
 document.addEventListener('click',e=>{if(desktop.matches&&row.classList.contains('expanded')&&!row.contains(e.target))row.classList.remove('expanded');});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')row.classList.remove('expanded');});
 desktop.addEventListener('change',()=>{cancel();arrange();render();idleClose();});
 window.addEventListener('resize',queuePosition,{passive:true});new ResizeObserver(queuePosition).observe(header);
 window.EventStore?.subscribe(arrivals);
 window.DesktopRecords={open:setOpen,toggle,filter,state:()=>({open:opened,pinned})};
 arrange();render();
})();
