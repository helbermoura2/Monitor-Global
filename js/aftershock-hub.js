/* Shared timeline and bounded static connections; no polling, fetch or catalog edits. */
(function(){
 'use strict';
 const SOURCE='sequence-hub-links',BASE=SOURCE+'-base',SELECTED=SOURCE+'-selected';
 let root=null,list=null,title=null,count=null,more=null,group=null,selected=null,rootId=null,uiKey='',lineKey='',targets=[],allowed=true,dismissed=false,expanded=true,limit=40,frame=0,mapRef=null,lastLayout='',followLatest=true,lastRowId=null,manualScroll=false;
 const mobile=matchMedia('(max-width:900px)');
 const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
 let dismissTimer=0,autoPresentation=false,manualOpen=false;
 function armDismissal(){clearTimeout(dismissTimer);dismissTimer=0;if(autoPresentation)return;dismissTimer=setTimeout(()=>{dismissTimer=0;dismissed=true;position();},60000);}
 let scrollTimer=0,scrollDirection=-1,scrollWait=0,scrollLast=0,manualUntil=0,manualRevision=0;
 function stopAutoScroll(){clearTimeout(scrollTimer);scrollTimer=0;scrollLast=0;}
 function autoScroll(){
  scrollTimer=0;if(!root||root.hidden||!expanded||document.hidden||reducedMotion.matches)return;
  const now=performance.now(),max=list.scrollHeight-list.clientHeight;
  if(max<=1){scrollLast=0;return;}
  const delta=scrollLast?Math.min(100,now-scrollLast):0;scrollLast=now;
  if(now>=manualUntil&&now>=scrollWait){
   const next=Math.max(0,Math.min(max,list.scrollTop+scrollDirection*delta*.022));list.scrollTop=next;
   if(next<=0||next>=max){scrollDirection=next<=0?1:-1;scrollWait=now+2500;}
  }
  scrollTimer=setTimeout(autoScroll,50);
 }
 function syncAutoScroll(){if(!root||root.hidden||!expanded||document.hidden||reducedMotion.matches){stopAutoScroll();return;}if(!scrollTimer)scrollTimer=setTimeout(autoScroll,50);}
 document.addEventListener('visibilitychange',syncAutoScroll);reducedMotion.addEventListener('change',syncAutoScroll);
 window.addEventListener('pagehide',()=>{stopAutoScroll();clearTimeout(dismissTimer);});

 const mag=q=>'M'+Number(q.mag).toFixed(1).replace('.',',');
 const place=q=>window.EventPortuguese?.place(q.place)||q.place||'Local não informado';
 const visible=el=>!!el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none';
 const button=(host,text,label,action)=>{const b=document.createElement('button');b.type='button';b.textContent=text;if(label)b.setAttribute('aria-label',label);b.onclick=action;host.append(b);return b;};
 function mapObject(){try{return typeof map==='undefined'?null:map;}catch{return null;}}
 function removeLines(){const m=mapObject();try{for(const id of [SELECTED,BASE])if(m?.getLayer(id))m.removeLayer(id);if(m?.getSource(SOURCE))m.removeSource(SOURCE);}catch{}lineKey='';}
 function syncLines(version,force=false){
  const m=mapObject();if(!m||!group)return;
  if(mapRef!==m){mapRef=m;m.on('style.load',()=>{lineKey='';if(group)syncLines(uiKey,true);});}
  const next=version+'|'+allowed;if(next===lineKey&&!force&&m.getSource(SOURCE))return;
  try{
   const data=AftershockHubModel.links(group.main,targets,selected);
   if(!m.getSource(SOURCE))m.addSource(SOURCE,{type:'geojson',data});else m.getSource(SOURCE).setData(data);
   if(!m.getLayer(BASE))m.addLayer({id:BASE,type:'line',source:SOURCE,filter:['==',['get','selected'],false],paint:{'line-color':'#a8dbe1','line-width':1.3,'line-opacity':.65}});
   if(!m.getLayer(SELECTED))m.addLayer({id:SELECTED,type:'line',source:SOURCE,filter:['==',['get','selected'],true],paint:{'line-color':'#6beafa','line-width':2.2,'line-opacity':.95}});
   for(const id of [BASE,SELECTED])m.setLayoutProperty(id,'visibility',allowed?'visible':'none');lineKey=next;
  }catch{/* A style still loading is restored by style.load. */}
 }
 function ensure(){
  if(root)return;
  root=document.createElement('section');root.id='sequence-hub';root.hidden=true;root.setAttribute('aria-labelledby','sequence-hub-title');
  const header=document.createElement('header');header.className='sequence-hub-header';
  const heading=document.createElement('div');title=document.createElement('h2');title.id='sequence-hub-title';heading.append(title);count=document.createElement('small');heading.append(count);header.append(heading);
  const actions=document.createElement('div');actions.className='sequence-hub-actions';
  button(actions,'Detalhes','Ver detalhes do sismo selecionado',()=>{expanded=false;position();if(typeof abrirPainelDetalhesMobile==='function')abrirPainelDetalhesMobile();}).className='sequence-hub-details';
  const toggle=button(actions,'⌄','Recolher sequência',()=>{expanded=!expanded;if(mobile.matches)document.body.classList.remove('mobile-details-mid','mobile-details-open');position();});toggle.id='sequence-hub-toggle';toggle.setAttribute('aria-controls','sequence-hub-list');
  button(actions,'×','Fechar sequência',()=>{dismissed=true;position();document.querySelector('#pd-event-insights [data-workbench="sequence"]')?.focus({preventScroll:true});}).className='sequence-hub-close';
  header.append(actions);root.append(header);list=document.createElement('div');list.id='sequence-hub-list';list.setAttribute('aria-label','Eventos em ordem de ocorrência');list.tabIndex=0;for(const type of ['wheel','touchstart','pointerdown','keydown'])list.addEventListener(type,()=>{armDismissal();manualRevision++;manualScroll=true;manualUntil=performance.now()+10000;scrollDirection=1;},{passive:true});list.addEventListener('scroll',()=>{if(manualScroll)followLatest=list.scrollHeight-list.clientHeight-list.scrollTop<24;},{passive:true});root.append(list);new ResizeObserver(()=>{if(followLatest&&!scrollLast&&!root.hidden&&!root.classList.contains('collapsed'))list.scrollTop=list.scrollHeight;syncAutoScroll();}).observe(list);
  const footer=document.createElement('footer');more=button(footer,'Mostrar anteriores',null,()=>{limit=Math.min(200,limit+40);uiKey='';renderRows();position();});more.id='sequence-hub-more';
  const note=document.createElement('small');note.textContent='Possíveis réplicas · associação estimada. Linhas não representam falhas nem propagação de energia.';footer.append(note);root.append(footer);document.body.append(root);
  const resize=new ResizeObserver(schedule);resize.observe(root);for(const id of ['top-strip','sidebar-left']){const el=document.getElementById(id);if(el)resize.observe(el);}
  window.addEventListener('desktop-records-change',schedule);for(const type of ['animationend','transitionend'])window.addEventListener(type,e=>{if(e.target.closest?.('#sidebar-left'))schedule();});window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);mobile.addEventListener('change',schedule);
 }
 function frameSelection(q){
  const m=mapObject();if(!m||!group||!window.WeatherWarningCamera)return;
  const points=q.id===group.main.id?[group.main.coords,...targets.map(t=>t.coords)]:[group.main.coords,q.coords];
  const bounds=WeatherWarningCamera.bounds(points);if(!bounds)return;
  const r=m.getContainer().getBoundingClientRect(),view={width:r.width,height:r.height,left:16,right:r.width-16,top:16,bottom:r.height-16,minZoom:m.getMinZoom()};
  for(const id of ['top-strip','latest-event-ticker']){const el=document.getElementById(id);if(visible(el))view.top=Math.max(view.top,el.getBoundingClientRect().bottom-r.top+12);}
  for(const el of [root,document.getElementById('sidebar-left'),document.getElementById('painel-direito')])if(visible(el)){
   const b=el.getBoundingClientRect();if(b.width>=r.width*.7){if(b.top<r.top+r.height*.55)view.top=Math.max(view.top,b.bottom-r.top+12);else view.bottom=Math.min(view.bottom,b.top-r.top-12);}else if(b.left<r.left+r.width*.25)view.left=Math.max(view.left,b.right-r.left+12);else view.right=Math.min(view.right,b.left-r.left-12);
  }
  for(const el of document.querySelectorAll('.wave-front-status,.seismic-impact-status,#mobile-notice-stack'))if(visible(el)&&!root.contains(el)){const b=el.getBoundingClientRect();if(b.bottom-r.top<view.bottom&&b.right-r.left>view.left&&b.left-r.left<view.right)view.top=Math.max(view.top,b.bottom-r.top+12);}
  const camera=AftershockHubModel.camera(bounds,view);
  window.EventCamera?.cancel();window.SeismicPaintTour?.stop();window.SeismicFocus?.pause();if(typeof stopWaveFront==='function')stopWaveFront(true);if(typeof stopMapCamera==='function')stopMapCamera();clearTimeout(window.__mgWaveDelayT);clearTimeout(window.__mgRadarDelayT);m.stop();
  m.easeTo({...camera,duration:matchMedia('(prefers-reduced-motion:reduce)').matches?0:650,essential:true});
 }
 function openEvent(id){
  const index=typeof globalEvents==='undefined'?-1:globalEvents.findIndex(q=>q.id===id);if(index<0)return;
  window.EventDetailsBack?.close();if(typeof fecharViradaCardAlcance==='function')fecharViradaCardAlcance();window.__mgSoftCycle=false;window.__mgRotationDisplay=false;showEventDetails(index,false);if(manualOpen&&mobile.matches)document.body.classList.remove('mobile-details-mid','mobile-details-open');frameSelection(globalEvents[index]);
 }
 function renderRows(){
  if(!root||!group)return;const focused=document.activeElement?.dataset?.sequenceId,scroll=list.scrollTop;
  title.textContent='Sequência sísmica';const data=AftershockHubModel.rows(group,selected,limit);
  count.textContent=group.children.length+' possíveis réplicas · '+place(group.main);list.replaceChildren();
  for(const q of data.items){
   const main=q.id===group.main.id,b=button(list,'',null,()=>openEvent(q.id));b.className='sequence-hub-row'+(main?' main':'');b.dataset.sequenceId=q.id;b.setAttribute('aria-pressed',String(q.id===selected));
   const label=document.createElement('strong');label.textContent=(main?'Principal · ':AftershockHubModel.elapsed(group.main,q)+' · ')+mag(q);
   const stamp=document.createElement('time');stamp.dateTime=new Date(q.time).toISOString();stamp.textContent=new Date(q.time).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' BRT · '+(Number.isFinite(q.depth)?Math.round(q.depth)+' km':'profundidade não informada');
   b.append(label,stamp);b.title=(main?'Sismo principal':'Possível réplica')+' · '+place(q);b.setAttribute('aria-label',b.title+' · '+label.textContent+' · '+stamp.textContent);
  }
  more.hidden=!data.omitted;more.disabled=limit>=200;more.textContent=limit>=200?'Limite de 200 eventos · consulte os registros':'Mostrar anteriores · '+data.omitted+' fora deste trecho';
  const newest=data.items.at(-1)?.id,follow=followLatest&&newest!==lastRowId;lastRowId=newest;list.scrollTop=scroll;
  if(follow){const revision=manualRevision;requestAnimationFrame(()=>{if(root&&!root.hidden&&manualRevision===revision)list.scrollTop=list.scrollHeight;});}
  const focus=[...list.children].find(b=>b.dataset.sequenceId===focused);if(focus)focus.focus({preventScroll:true});
 }
 function position(){
  frame=0;if(!root)return;
  if(mobile.matches&&innerHeight>=innerWidth){const bottom=Math.max(...['top-strip','ux-controlbar'].map(id=>document.getElementById(id)?.getBoundingClientRect().bottom||0));document.documentElement.style.setProperty('--mobile-event-slot-top',(bottom+8)+'px');}
  const pinned=!mobile.matches&&document.body.classList.contains('desktop-records-pinned');root.hidden=!manualOpen||!group||!allowed||dismissed||pinned;
  root.classList.toggle('collapsed',!expanded);document.getElementById('sequence-hub-toggle').setAttribute('aria-expanded',String(expanded));document.getElementById('sequence-hub-toggle').setAttribute('aria-label',expanded?'Recolher sequência':'Expandir sequência');
  syncAutoScroll();
  const active=!root.hidden;document.body.classList.toggle('sequence-hub-active',active);document.body.classList.toggle('sequence-hub-expanded',active&&expanded&&mobile.matches);
  if(active&&(!mobile.matches||innerWidth>innerHeight)){
   const header=document.getElementById('top-strip')?.getBoundingClientRect(),records=document.getElementById('sidebar-left');
   let top=(header?.bottom||110)+10;if(document.body.classList.contains('desktop-records-open')&&visible(records))top=Math.max(top,records.getBoundingClientRect().bottom+10);
   root.style.setProperty('--sequence-hub-top',Math.min(top,innerHeight-72)+'px');
  }
  const r=root.getBoundingClientRect(),layout=[active,expanded,mobile.matches,Math.round(r.top),Math.round(r.height)].join('|');
  if(layout!==lastLayout){lastLayout=layout;window.dispatchEvent(new Event('sequence-hub-layout'));}
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(position);}
 function update(next,id,show,entries,version,presentationKey=version){
  if(!next?.children?.length){clear();return;}ensure();
  const autoRequested=!!window.__mgRotationDisplay||!!window.__mgSoftCycle,newPresentation=rootId!==next.main.id||selected!==id||autoRequested&&!autoPresentation;
  if(newPresentation){autoPresentation=autoRequested;if(rootId!==next.main.id||autoRequested)manualOpen=false;dismissed=false;if(manualOpen)armDismissal();else clearTimeout(dismissTimer);}
  if(rootId!==next.main.id){stopAutoScroll();rootId=next.main.id;dismissed=false;expanded=true;limit=40;uiKey='';followLatest=true;lastRowId=null;manualScroll=false;manualUntil=0;scrollDirection=-1;scrollWait=performance.now()+2500;}
  const changed=uiKey!==presentationKey,visibility=allowed!==show;group=next;selected=id;allowed=show;targets=entries;
  if(changed){uiKey=presentationKey;renderRows();}
  if(changed||visibility||newPresentation)position();syncLines(version);
 }
 function show(id){
  if(!group||![group.main,...group.children].some(q=>q.id===id)||!mobile.matches&&document.body.classList.contains('desktop-records-pinned'))return false;
  manualOpen=true;autoPresentation=false;armDismissal();dismissed=false;expanded=true;window.EventDetailsBack?.close();if(typeof fecharViradaCardAlcance==='function')fecharViradaCardAlcance();if(mobile.matches)document.body.classList.remove('mobile-details-mid','mobile-details-open');position();root.querySelector('#sequence-hub-toggle')?.focus({preventScroll:true});return true;
 }
 function clear(){clearTimeout(dismissTimer);dismissTimer=0;manualOpen=false;group=null;rootId=null;uiKey='';targets=[];dismissed=false;removeLines();if(root){list.replaceChildren();position();}}
 window.AftershockHub={update,show,clear,position:schedule,state:()=>({mainId:group?.main.id||null,selected,expanded,visible:!!root&&!root.hidden,rows:list?.childElementCount||0})};
})();
