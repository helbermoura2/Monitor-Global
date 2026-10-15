/* Model 12: glass event badge. Native marker transforms stay untouched. */
(function(){'use strict';let timer=null,beacon=null,host=null,sequenceHost=null;
function clear(){beacon?.remove();host?.classList.remove('has-glass-pin');beacon=null;host=null;}
function clearSequence(){sequenceHost?.classList.remove('event-pin-active-sequence');sequenceHost=null;}
function describe(item){
 const quake=item.type==='earthquake'||(!item.type&&item.mag!=null),m=Number(item.mag);
 if(quake)return {text:item.mag!=null&&Number.isFinite(m)?'M '+m.toFixed(1).replace('.',','):'SISMO',tone:item.mag!=null&&Number.isFinite(m)?getHexColor(m):'#6de4f5',quake:true};
 const labels={hurricane:'CICLONE',volcano:'VULCÃO',tsunami:'TSUNAMI',storm:'TEMPESTADE',wind:'VENTO',tornado:'TORNADO',flood:'ENCHENTE',civil:'ALERTA',fire:'INCÊNDIO'};
 let tone=TYPE_META[item.type]?.color||'#6de4f5';
 const wind=item.windKmh!=null&&Number.isFinite(Number(item.windKmh))?Math.max(0,Math.round(Number(item.windKmh))):null;
 if(item.type==='hurricane'&&wind!=null)tone=classificarCiclone(Number(item.windKmh))?.cor||tone;
 return {text:['wind','hurricane'].includes(item.type)&&wind!=null?wind.toLocaleString('pt-BR')+' km/h':labels[item.type]||'EVENTO',tone,quake:false};
}
function update(){
 timer=null;
 if(!map||document.hidden){clear();clearSequence();return;}
 const item=window.EventStore?.getById(eventoSelecionadoId);if(!item){clear();clearSequence();return;}
 const sequence=window.AftershockSequence?.marker?.(item.id)?.getElement();
 if(sequence?.isConnected&&sequence.style.display!=='none'){
  clear();if(sequenceHost!==sequence){clearSequence();sequenceHost=sequence;sequence.classList.add('event-pin-active-sequence');}return;
 }
 clearSequence();
 let marker=null;
 for(const store of Object.values(markerStores)){const entry=store.get(item.id);if(entry){marker=entry.marker||entry;break;}}
 const el=marker?.getElement();if(!el?.isConnected||el.style.display==='none'){clear();return;}
 if(host!==el){
  clear();host=el;el.classList.add('has-glass-pin');beacon=document.createElement('span');beacon.className='event-focus-beacon';beacon.setAttribute('aria-hidden','true');
  const stem=document.createElement('span');stem.className='event-pin-stem';
  const badge=document.createElement('span');badge.className='event-pin-glass event-pin-surface';
  const text=document.createElement('span');text.className='event-pin-value';badge.append(text);beacon.append(stem,badge);el.append(beacon);
 }
 const data=describe(item),value=beacon.querySelector('.event-pin-value');
 if(value.textContent!==data.text)value.textContent=data.text;
 beacon.dataset.kind=data.quake?'earthquake':item.type||'event';host.style.setProperty('--event-pin-tone',data.tone);
}
function schedule(){if(timer===null)timer=setTimeout(update,120);}
window.EventPinBadge={describe,refresh:schedule};window.EventFocusBeacon={refresh:schedule};
window.EventStore?.subscribe(schedule);
window.addEventListener('load',()=>{map.on('render',schedule);schedule();},{once:true});
window.addEventListener('pageshow',schedule);document.addEventListener('visibilitychange',schedule);
window.addEventListener('pagehide',()=>{clearTimeout(timer);timer=null;clear();sequenceHost?.classList.remove('event-pin-active-sequence');sequenceHost=null;});
})();
