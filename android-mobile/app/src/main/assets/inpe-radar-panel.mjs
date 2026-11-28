import {discover} from './inpe-radar-catalog.mjs';
import {regionBounds,describeRadar} from './inpe-radar-panel-model.mjs';
import {availableLevels,selectCappi,fetchCappi,MAX_AGE} from './inpe-radar-layer-model.mjs';
import {DBZ_PALETTE} from './inpe-radar-grid.mjs';
const $=id=>document.getElementById(id);
const panel=$('inpe-catalog'),status=$('inpe-catalog-status'),results=$('inpe-catalog-results'),search=$('inpe-catalog-search');
let controller=null,serial=0,lastAttempt=0,cache=new Map(),day='',used=0,worker=null,savedFile=null,expiry=0,renderCount=0;
const clock=ms=>new Date(ms).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' BRT';
function cancel(){serial++;controller?.abort();controller=null;worker?.terminate();worker=null;search.disabled=false;}
function removeLayer(){clearTimeout(expiry);window.MonitorMap?.clearInpe?.();}
function clear(){results.replaceChildren();}
function row(tag,value){const e=document.createElement(tag);e.textContent=value;return e;}
function option(value,label){const o=document.createElement('option');o.value=String(value);o.textContent=label;return o;}
function decode(bytes,selection,ticket){
 return new Promise((resolve,reject)=>{
  const w=new Worker(new URL('./vendor/cappi/inpe-cappi-worker.mjs',import.meta.url),{type:'module'});worker=w;
  const finish=(error,data)=>{clearTimeout(timer);w.terminate();if(worker===w)worker=null;if(error)reject(Error(error));else resolve(data);};
  const timer=setTimeout(()=>finish('Tempo de processamento excedido'),30000);
  w.onerror=e=>finish(e.message||'Leitor CAPPI indisponível');
  w.onmessage=({data})=>{if(data.id!==ticket)return;finish(data.error,data);};
  w.postMessage({id:ticket,bytes,product:selection.product,altitude:selection.altitude},[bytes]);
 });
}
async function showFrame(frame,altitude){
 const selected=selectCappi(frame,altitude);if(!selected){status.textContent='Produto indisponível ou observação expirada. Consulte novamente.';return;}
 cancel();removeLayer();const ticket=++serial,c=new AbortController();controller=c;search.disabled=true;
 status.textContent='Baixando e processando refletividade do INPE…';
 let timer=setTimeout(()=>c.abort(),20000);
 try{
  if(savedFile?.href!==selected.href){
   if(renderCount>=12)throw Error('Limite de 12 downloads nesta sessão');
   renderCount++;
   const bytes=await fetchCappi(selected.href,c.signal);
   if(ticket!==serial)return;
   savedFile={href:selected.href,bytes};
  }
  clearTimeout(timer);
  const decoded=await decode(savedFile.bytes.slice(0),selected,ticket);
  if(ticket!==serial||panel.hidden)return;
  if(Date.now()-frame.time>MAX_AGE)throw Error('Observação expirada');
  if(!(decoded.rgba instanceof Uint8ClampedArray)||decoded.rgba.length!==1000000)throw Error('Grade inválida');
  const canvas=document.createElement('canvas');canvas.width=500;canvas.height=500;
  canvas.getContext('2d').putImageData(new ImageData(decoded.rgba,500,500),0,0);
  const label=frame.radar+' · '+(altitude/1000)+' km · '+clock(frame.time)+' · INPE';
  if(!window.MonitorMap?.showInpe?.(canvas.toDataURL('image/png'),decoded.coordinates,label))throw Error('Mapa indisponível');
  status.textContent='Refletividade exibida · '+label;
  expiry=setTimeout(()=>{removeLayer();status.textContent='Observação expirada. Consulte novamente.';},Math.max(0,frame.time+MAX_AGE-Date.now()));
 }catch(e){if(ticket===serial){removeLayer();status.textContent='INPE: '+String(e.message||e).slice(0,160)+'. RainViewer continua disponível.';}}
 finally{clearTimeout(timer);if(controller===c){controller=null;search.disabled=false;}}
}
function display(data){
 clear();
 for(const radar of data.radars){
  const info=describeRadar(radar);
  if(!info)continue;
  const item=document.createElement('details');
  item.append(row('summary',info.name+' · '+info.owner),row('p','Última observação: '+clock(info.time)),row('p',info.products.join(' · ')),row('small',info.count+' quadros disponíveis no catálogo.'));
  const frames=radar.frames.filter(f=>availableLevels(f).length).reverse();
  if(frames.length){
   const times=document.createElement('select'),levels=document.createElement('select'),button=row('button','Exibir no mapa');
   times.setAttribute('aria-label','Horário da observação');levels.setAttribute('aria-label','Altitude CAPPI');button.type='button';
   frames.forEach((f,i)=>times.append(option(i,clock(f.time))));
   const update=()=>{levels.replaceChildren();for(const h of availableLevels(frames[Number(times.value)]))levels.append(option(h,h/1000+' km'));if([...levels.options].some(o=>o.value==='3000'))levels.value='3000';};
   times.addEventListener('change',update);update();
   button.addEventListener('click',()=>showFrame(frames[Number(times.value)],Number(levels.value)));
   item.append(row('p','Horário e altitude observados'),times,levels,button);
  }else item.append(row('small','Sem grade NetCDF utilizável nesta consulta; a miniatura não será sobreposta sem georreferenciamento verificado.'));
  results.append(item);
 }
 status.textContent=data.radars.length?data.radars.length+' radares retornados'+(data.partial?' · resultado parcial':''):'Nenhum radar recente retornado para esta área. Isso não indica ausência de chuva.';
}
async function query(){
 if(controller||panel.hidden)return;
 removeLayer();
 const bounds=regionBounds(window.MonitorMap?.inpeCenter?.());
 if(!bounds){clear();status.textContent='Centralize o mapa em uma região do Brasil.';return;}
 const now=Date.now(),key=bounds.join(','),saved=cache.get(key);
 if(saved&&now-saved.at<5*60000){display(saved);return;}
 if(now-lastAttempt<10000){status.textContent='Nova consulta disponível em alguns segundos.';return;}
 const today=new Date(now).toISOString().slice(0,10);
 if(day!==today){day=today;used=0;try{const old=JSON.parse(localStorage.getItem('argos-inpe-budget-v1')||'null');if(old?.day===day&&Number.isInteger(old.used)&&old.used>=0)used=old.used;}catch{}}
 if(used>=30){clear();status.textContent='Limite diário de consultas deste aparelho atingido.';return;}
 used++;try{localStorage.setItem('argos-inpe-budget-v1',JSON.stringify({day,used}));}catch{}
 lastAttempt=now;const ticket=++serial,c=new AbortController();controller=c;search.disabled=true;clear();
 status.textContent='Consultando catálogo oficial…';
 const timeout=setTimeout(()=>c.abort(),15000);
 try{
  const data=await discover(bounds,{now,signal:c.signal});
  if(serial!==ticket||panel.hidden)return;
  cache.set(key,data);if(cache.size>8)cache.delete(cache.keys().next().value);
  display(data);
 }catch{if(serial===ticket&&!panel.hidden)status.textContent='Catálogo INPE indisponível nesta consulta. O RainViewer continua disponível.';}
 finally{clearTimeout(timeout);if(controller===c){controller=null;search.disabled=false;}}
}
$('inpe-catalog-toggle').addEventListener('click',()=>{window.MonitorMap?.openInpeCatalog?.();});
$('inpe-catalog-close').addEventListener('click',()=>{cancel();removeLayer();panel.hidden=true;});
search.addEventListener('click',query);
window.addEventListener('argos-inpe-pause',()=>{cancel();panel.hidden=true;});

$('inpe-map-return').addEventListener('click',()=>window.MonitorMap?.openInpeCatalog?.());
$('inpe-map-clear').addEventListener('click',()=>{cancel();removeLayer();});
window.addEventListener('argos-inpe-dismiss',()=>{cancel();removeLayer();panel.hidden=true;});
const legend=$('inpe-map-legend');for(const [dbz,color] of DBZ_PALETTE){const chip=row('span',String(dbz));chip.style.borderTop='4px solid '+color;chip.style.padding='2px';legend.append(chip);}
