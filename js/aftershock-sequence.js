/* Event-driven, bounded map labels. Does not change selection, camera or alerts. */
(function(){
 'use strict';
 let model=null,signature='',pins=new Map(),box=null,summary=null,known=new Map(),initialized=false,fresh=new Map(),timer=null,visible=true,lastData=null;
 const events=()=>typeof globalEvents==='undefined'?[]:globalEvents;
 const chosen=()=>typeof eventoSelecionadoId==='undefined'?null:eventoSelecionadoId;
 const mag=q=>'M'+(window.EventPortuguese?.number(q.mag,1)||q.mag.toFixed(1).replace('.',','));
 const local=q=>window.EventPortuguese?.place(q.place)||q.place||'Local não informado';
 function node(host,tag,value){const el=document.createElement(tag);el.textContent=value;host.append(el);return el;}
 function open(id){const index=events().findIndex(q=>q.id===id);if(index>=0){window.__mgSoftCycle=false;window.__mgRotationDisplay=false;showEventDetails(index,false);}}
 function clear(){box?.remove();box=null;summary?.remove();summary=null;const slot=document.getElementById('pd-aftershock-details');if(slot){slot.style.display='none';slot.dataset.empty='true';const fold=slot.closest('details');if(fold)fold.style.display='none';}for(const pin of pins.values())pin.remove();pins.clear();signature='';restore();}
 function restore(){if(typeof markerStores==='undefined')return;markerStores.quake.forEach(m=>m.getElement().classList.remove('aftershock-covered'));}
 function setVisible(value){visible=!!value;syncMarkers();}
 function syncMarkers(){restore();const allowed=visible&&!(typeof layerVisibility!=='undefined'&&!layerVisibility.earthquakes)&&!window.TsunamiMap?.isPreview();const limit=typeof map!=='undefined'&&map.getZoom()<4?7:typeof map!=='undefined'&&map.getZoom()<5?13:41;let rank=0;for(const [id,pin]of pins){const show=allowed&&(rank++<limit||id===chosen());pin.getElement().style.display=show?'':'none';if(show&&typeof markerStores!=='undefined')markerStores.quake.get(id)?.getElement().classList.add('aftershock-covered');}}
 function ingest(){
  const data=events(),now=Date.now(),ids=new Set(data.map(q=>q.id));
  if(initialized)for(const q of data)if(!known.has(q.id)&&q.time>=now-AftershockModel.WINDOW)fresh.set(q.id,now+10000);
  if(data.length)initialized=true;for(const q of data)known.set(q.id,q.time);for(const [id,time]of known)if(time<now-AftershockModel.WINDOW)known.delete(id);
  for(const [id,until]of fresh)if(until<=now||!ids.has(id))fresh.delete(id);
  model=AftershockModel.build(data,now);lastData=data;
  clearTimeout(timer);if(fresh.size)timer=setTimeout(()=>{ingest();render();},Math.max(1,Math.min(...fresh.values())-now));
 }
 function render(){
  if(!model||lastData!==events())ingest();const selected=events().find(q=>q.id===chosen()),group=selected&&model.forEvent(selected.id);
  if(!group||!group.children.length||group.main.time<Date.now()-AftershockModel.WINDOW){clear();return;}
  const strongest=[...group.children].sort((a,b)=>b.mag-a.mag||b.time-a.time).slice(0,20),recent=group.children.slice(0,20);
  const mixed=[];for(let i=0;i<20;i++){if(recent[i])mixed.push(recent[i]);if(strongest[i])mixed.push(strongest[i]);}const shown=[group.main,...new Map(mixed.map(q=>[q.id,q])).values()];
  const next=JSON.stringify([chosen(),[group.main.id,group.main.mag,group.main.time,group.main.depth,group.main.coords,group.main.place],group.children.map(q=>[q.id,q.mag,q.time,q.depth,q.coords,q.place,!!fresh.get(q.id)])]);
  if(next===signature){syncMarkers();return;}clear();signature=next;
  summary=document.createElement('section');summary.id='pd-aftershocks-summary';node(summary,'strong','Possíveis réplicas · '+group.children.length);const details=node(summary,'button','Ver sequência ↻');details.type='button';details.onclick=e=>{e.stopPropagation();window.EventDetailsBack?.toggle(true);const fold=document.getElementById('pd-aftershock-details')?.closest('details');if(fold)fold.open=true;};node(summary,'small','Principal: '+mag(group.main)+' · Maior possível réplica: '+mag(strongest[0]));document.getElementById('pd-horario')?.after(summary);
  box=document.createElement('section');box.id='pd-aftershocks';box.className='bubble-section';
  node(box,'h3','Possíveis réplicas · '+group.children.length);
  const mainButton=node(box,'button','Principal · '+mag(group.main)+' · '+local(group.main));mainButton.onclick=e=>{e.stopPropagation();open(group.main.id);};
  node(box,'small','Associação estimada por horário, distância, magnitude e profundidade; não é uma classificação oficial. Janela: 72 horas.');
  for(const q of group.children.slice(0,8)){const time=typeof formatBrasiliaDateTime==='function'?formatBrasiliaDateTime(q.time):new Date(q.time).toLocaleString('pt-BR');const b=node(box,'button',mag(q)+' · '+time+(fresh.has(q.id)?' · NOVA':''));b.title=local(q);b.onclick=e=>{e.stopPropagation();open(q.id);};}
  if(group.children.length>8)node(box,'small','Exibindo as 8 mais recentes; todas permanecem nos registros.');
  const slot=document.getElementById('pd-aftershock-details');if(slot){slot.style.display='';slot.dataset.empty='false';const fold=slot.closest('details');if(fold)fold.style.display='';document.getElementById('pd-aftershock-content').append(box);}
  if(typeof map!=='undefined'&&map&&typeof GL!=='undefined')for(const q of shown){
   const el=document.createElement('button');el.type='button';el.className='aftershock-pin'+(q.id===group.main.id?' main':'')+(fresh.has(q.id)?' fresh':'');el.style.setProperty('--quake-tone',typeof getHexColor==='function'?getHexColor(q.mag):'#fbbf24');el.textContent=(q.id===group.main.id?'Principal · ':'')+mag(q);
   if(fresh.has(q.id))node(el,'em','NOVA');el.title=(q.id===group.main.id?'Sismo principal':'Possível réplica')+' · '+local(q);el.onclick=e=>{e.stopPropagation();open(q.id);};pins.set(q.id,new GL.Marker({element:el,anchor:'bottom',offset:[0,-5]}).setLngLat(q.coords).addTo(map));
  }
  syncMarkers();
 }
 function refresh(){ingest();render();}
 window.EventStore?.subscribe(reason=>{if(['filter','replace','revise'].includes(reason))refresh();else if(reason==='select')render();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('pagehide',()=>{clearTimeout(timer);clear();});
 window.AftershockSequence={render,refresh,clear,setVisible,syncMarkers,state:()=>({mainId:model?.forEvent(chosen())?.main.id||null,count:model?.forEvent(chosen())?.children.length||0,markers:pins.size})};
})();
