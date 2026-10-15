/* A small, anchored locator for the selected point when no paint covers it. */
(function(){'use strict';let timer=null,beacon=null,host=null;
function clear(){beacon?.remove();beacon=null;host=null;}
function painted(point,id){
 const state=window.__mgSeismicImpactState;
 if(state?.id!==id||!state.features||!map.getLayer('quake-impact-fill')||map.getLayoutProperty('quake-impact-fill','visibility')==='none')return false;
 try{const p=map.project(point);return map.queryRenderedFeatures([[p.x-3,p.y-3],[p.x+3,p.y+3]],{layers:['quake-impact-fill']}).length>0;}catch{return false;}
}
function update(){
 timer=null;if(!map||document.hidden){clear();return;}
 let marker=null;
 for(const store of Object.values(markerStores)){
  const entry=store.get(eventoSelecionadoId);if(entry){marker=entry.marker||entry;break;}
 }
 const el=marker?.getElement();
 if(!el?.isConnected||el.style.display==='none'||painted(marker.getLngLat(),eventoSelecionadoId)){clear();return;}
 if(host!==el){clear();host=el;beacon=document.createElement('span');beacon.className='event-focus-beacon';beacon.setAttribute('aria-hidden','true');el.appendChild(beacon);}
 const quake=globalEvents.find(q=>q.id===eventoSelecionadoId);
 beacon.style.setProperty('--beacon-color',quake?getHexColor(quake.mag):'#6de4f5');
}
function schedule(){if(timer===null)timer=setTimeout(update,120);}
window.EventFocusBeacon={refresh:schedule};
window.EventStore?.subscribe(schedule);
window.addEventListener('load',()=>{map.on('render',schedule);schedule();},{once:true});
window.addEventListener('pagehide',()=>{clearTimeout(timer);timer=null;clear();});
})();
