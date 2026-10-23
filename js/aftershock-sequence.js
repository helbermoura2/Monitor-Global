/* Bounded sequence labels and zoom-scale groups; only explicit clicks move the camera. */
(function(){
 'use strict';
 let model=null,signature='',pins=new Map(),box=null,summary=null,known=new Map(),initialized=false,fresh=new Map(),timer=null,visible=true,lastData=null,mapKey='',represented=new Set(),clusterCount=0,lineTargets=[],layoutFrame=0,lastLayout=0;
 const events=()=>typeof globalEvents==='undefined'?[]:globalEvents;
 const sequenceFor=id=>{const g=model?.forEvent(id);return g?.children.length?g:null;};
 const chosen=()=>typeof eventoSelecionadoId==='undefined'?null:eventoSelecionadoId;
 const mag=q=>'M'+(window.EventPortuguese?.number(q.mag,1)||q.mag.toFixed(1).replace('.',','));
 const local=q=>window.EventPortuguese?.place(q.place)||q.place||'Local não informado';
 function node(host,tag,value){const el=document.createElement(tag);el.textContent=value;host.append(el);return el;}
 function open(id){const index=events().findIndex(q=>q.id===id);if(index>=0){window.__mgSoftCycle=false;window.__mgRotationDisplay=false;showEventDetails(index,false);}}
 function clear(resetHub=true){cancelAnimationFrame(layoutFrame);layoutFrame=0;if(resetHub)window.AftershockHub?.clear();box?.remove();box=null;summary?.remove();summary=null;const slot=document.getElementById('pd-aftershock-details');if(slot){slot.style.display='none';slot.dataset.empty='true';const fold=slot.closest('details');if(fold)fold.style.display='none';}for(const pin of pins.values())pin.remove();pins.clear();signature='';mapKey='';represented.clear();clusterCount=0;restore();}
 function restore(){if(typeof markerStores==='undefined')return;markerStores.quake.forEach(m=>m.getElement().classList.remove('aftershock-covered'));}
 function setVisible(value){visible=!!value;syncMarkers();}
 function syncMarkers(){
  restore();const allowed=visible&&!(typeof layerVisibility!=='undefined'&&!layerVisibility.earthquakes)&&!window.TsunamiMap?.isPreview();
  const group=sequenceFor(chosen());
  if(group&&group.children.length&&typeof map!=='undefined'&&map&&typeof GL!=='undefined'){
   const zoom=Math.floor(map.getZoom()*2)/2,next=signature+'|'+zoom;
   if(mapKey!==next){
    mapKey=next;for(const pin of pins.values())pin.remove();pins.clear();represented.clear();
    const data=group.children.length<=40?{clusters:[],singles:group.children}:AftershockClusterModel.build(group.children,group.main.coords[0],zoom,chosen());
    const entries=[...data.clusters.map(c=>({cluster:c,rank:c.members.length})),...data.singles.map(q=>({q,rank:1}))].sort((a,b)=>Number(b.q?.id===chosen())-Number(a.q?.id===chosen())||b.rank-a.rank||Number(b.cluster?.mag??b.q.mag)-Number(a.cluster?.mag??a.q.mag));
    const shown=[{q:group.main},...entries.slice(0,40)];lineTargets=shown.map(e=>({id:e.cluster?.id||e.q.id,coords:e.cluster?.coords||e.q.coords}));clusterCount=0;
    for(const entry of shown){
     const c=entry.cluster,q=entry.q,members=c?.members||[q],isMain=q?.id===group.main.id;
     const el=document.createElement('button');el.type='button';el.className='aftershock-pin event-pin-surface'+(isMain?' main':c?'':' replica')+(zoom>=5?' close-scale':'')+(q?.id===chosen()?' hub-selected':'')+(c?' cluster':'')+(members.some(q=>fresh.has(q.id))?' fresh':'');
     el.dataset.eventId=c?.id||q.id;el.style.zIndex=q?.id===chosen()?'100':isMain?'30':c?'20':'10';
     el.style.setProperty('--quake-tone',typeof getHexColor==='function'?getHexColor(c?.mag??q.mag):'#fbbf24');
     el.textContent=c?c.members.length.toLocaleString('pt-BR'):(isMain?'Principal · ':'')+mag(q);
     if(c){clusterCount++;node(el,'span','possíveis réplicas');el.title=c.members.length.toLocaleString('pt-BR')+' possíveis réplicas · clique para aproximar';el.setAttribute('aria-label',el.title);}
     else {el.title=(isMain?'Sismo principal':'Possível réplica')+' · '+local(q)+' · '+new Date(q.time).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})+' BRT';if(!isMain){const stamp=node(el,'span',new Date(q.time).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})+' BRT');stamp.className='aftershock-pin-time';}}
     const arrivals=members.filter(q=>fresh.has(q.id)).length;if(arrivals)node(el,'em',c?'+'+arrivals+' nova'+(arrivals===1?'':'s'):'NOVA');
     el.onclick=e=>{
      e.stopPropagation();if(!c){open(q.id);return;}
      // A cluster click is a manual camera choice, never an event selection.
      window.SeismicFocus?.pause();if(typeof waveCamAbortHandler==='function')waveCamAbortHandler({originalEvent:e});if(typeof stopMapCamera==='function')stopMapCamera();
      const fit=typeof zoomParaAreaPintada==='function'?zoomParaAreaPintada(c.coords[0],c.coords[1],1,[...c.bounds[0],...c.bounds[1]]):map.cameraForBounds(c.bounds,{padding:0,maxZoom:10.5}).zoom,z=Math.min(10.5,Math.max(map.getZoom()+1.5,fit));
      const center=typeof centroCompensado==='function'?centroCompensado(c.coords[0],c.coords[1],z):c.coords;
      map.easeTo({center,zoom:z,padding:{top:0,right:0,bottom:0,left:0},duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:2200,essential:true});
     };
     const id=c?.id??q.id;for(const member of members)represented.add(member.id);
     pins.set(id,new GL.Marker({element:el,anchor:c?'center':'bottom',offset:c?[0,44]:[0,-5]}).setLngLat(c?.coords||q.coords).addTo(map));
    }
   }
  }
  for(const pin of pins.values())pin.getElement().style.display=allowed?'':'none';
  window.EventFocusBeacon?.sync?.();scheduleLayout();
  if(group?.children.length)window.AftershockHub?.update(group,chosen(),allowed,lineTargets,mapKey,signature);
  if(allowed&&typeof markerStores!=='undefined')for(const id of represented)markerStores.quake.get(id)?.getElement().classList.add('aftershock-covered');
 }

 function layoutLabels(){
  const rows=[...pins.values()].map(pin=>pin.getElement()).filter(el=>el.style.display!=='none').sort((a,b)=>Number(b.dataset.eventId===String(chosen()))-Number(a.dataset.eventId===String(chosen()))||Number(b.classList.contains('main'))-Number(a.classList.contains('main'))),boxes=[];
  for(const el of rows)el.classList.remove('sequence-compact');
  for(const el of rows){const selected=el.dataset.eventId===String(chosen()),r=el.getBoundingClientRect(),overlap=boxes.some(b=>r.left<b.right+8&&r.right>b.left-8&&r.top<b.bottom+8&&r.bottom>b.top-8);if(!selected&&overlap)el.classList.add('sequence-compact');else if(r.width>15)boxes.push(r);el.style.zIndex=selected?'100':el.classList.contains('main')?'30':'10';}
 }
 function scheduleLayout(){if(layoutFrame||!pins.size||typeof map==='undefined'||!map)return;layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;const now=performance.now();if(now-lastLayout<90){scheduleLayout();return;}lastLayout=now;layoutLabels();});}
 window.addEventListener('load',()=>map?.on('render',scheduleLayout),{once:true});
 function ingest(){
  const data=events(),now=Date.now(),ids=new Set(data.map(q=>q.id));
  if(initialized)for(const q of data)if(!known.has(q.id)&&q.time>=now-AftershockModel.WINDOW)fresh.set(q.id,now+10000);
  if(data.length)initialized=true;for(const q of data)known.set(q.id,q.time);for(const [id,time]of known)if(time<now-AftershockModel.WINDOW)known.delete(id);
  for(const [id,until]of fresh)if(until<=now||!ids.has(id))fresh.delete(id);
  model=AftershockModel.build(data,now);lastData=data;
  clearTimeout(timer);if(fresh.size)timer=setTimeout(()=>{ingest();render();},Math.max(1,Math.min(...fresh.values())-now));
 }
 function render(){
  if(!model||lastData!==events())ingest();const selected=events().find(q=>q.id===chosen()),group=selected&&sequenceFor(selected.id);
  if(!group||!group.children.length||group.main.time<Date.now()-AftershockModel.WINDOW){clear();return;}
  const strongest=[...group.children].sort((a,b)=>b.mag-a.mag||b.time-a.time).slice(0,20);
  const next=JSON.stringify([chosen(),[group.main.id,group.main.mag,group.main.time,group.main.depth,group.main.coords,group.main.place],group.children.map(q=>[q.id,q.mag,q.time,q.depth,q.coords,q.place,!!fresh.get(q.id)])]);
  if(next===signature){syncMarkers();return;}clear(false);signature=next;
  // Timeline belongs to the currently presented earthquake only.
  if(!selected||!sequenceFor(selected.id)){syncMarkers();return;}
  summary=document.createElement('section');summary.id='pd-aftershocks-summary';node(summary,'strong','Possíveis réplicas · '+group.children.length);const details=node(summary,'button','Ver sequência ↻');details.type='button';details.onclick=e=>{e.stopPropagation();if(window.AftershockHub?.show(selected?.id))return;if(window.MonitorWorkbench){MonitorWorkbench.open('sequence',selected||group.main);return;}window.EventDetailsBack?.toggle(true);const fold=document.getElementById('pd-aftershock-details')?.closest('details');if(fold)fold.open=true;};node(summary,'small','Principal: '+mag(group.main)+' · Maior possível réplica: '+mag(strongest[0]));document.getElementById('pd-horario')?.after(summary);
  box=document.createElement('section');box.id='pd-aftershocks';box.className='bubble-section';
  node(box,'h3','Possíveis réplicas · '+group.children.length);
  const mainButton=node(box,'button','Principal · '+mag(group.main)+' · '+local(group.main));mainButton.onclick=e=>{e.stopPropagation();open(group.main.id);};
  node(box,'small','Associação estimada por horário, distância, magnitude e profundidade; não é uma classificação oficial. Janela: 72 horas.');
  for(const q of group.children.slice(0,8)){const time=typeof formatBrasiliaDateTime==='function'?formatBrasiliaDateTime(q.time):new Date(q.time).toLocaleString('pt-BR');const b=node(box,'button',mag(q)+' · '+time+(fresh.has(q.id)?' · NOVA':''));b.title=local(q);b.onclick=e=>{e.stopPropagation();open(q.id);};}
  if(group.children.length>8)node(box,'small','Exibindo as 8 mais recentes; todas permanecem nos registros.');
  const slot=document.getElementById('pd-aftershock-details');if(slot){slot.style.display='';slot.dataset.empty='false';const fold=slot.closest('details');if(fold)fold.style.display='';document.getElementById('pd-aftershock-content').append(box);}
  syncMarkers();window.SeismicFinalSummary?.refresh();
 }
 function refresh(){ingest();render();window.SeismicFinalSummary?.refresh();const q=events().find(q=>q.id===chosen());if(q?.mag>=5&&window.SeismicImpact?.bounds(q.id))window.SeismicFocus?.ready({id:q.id,lng:q.coords[0],lat:q.coords[1],mag:q.mag,depth:q.depth});}
 window.EventStore?.subscribe(reason=>{if(['filter','replace','revise'].includes(reason))refresh();else if(reason==='select'){render();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('pagehide',()=>{clearTimeout(timer);clear();});
 window.AftershockSequence={marker:id=>pins.get(id)||null,summary:id=>{const g=model?.forEvent(id);return g?.children.length?{count:g.children.length,strongest:Math.max(...g.children.map(q=>q.mag))}:null;},render,refresh,clear,setVisible,syncMarkers,framePoints:id=>{const g=model?.forEvent(id);return g?(g.cameraPoints||(g.cameraPoints=[g.main.coords,...g.children.map(q=>q.coords)])):null;},state:()=>({mainId:model?.forEvent(chosen())?.main.id||null,count:model?.forEvent(chosen())?.children.length||0,markers:pins.size,clusters:clusterCount,represented:represented.size})};
})();
