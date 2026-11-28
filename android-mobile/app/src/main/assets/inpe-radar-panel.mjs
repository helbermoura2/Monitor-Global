import {discover} from './inpe-radar-catalog.mjs';
import {regionBounds,describeRadar} from './inpe-radar-panel-model.mjs';
const $=id=>document.getElementById(id);
const panel=$('inpe-catalog'),status=$('inpe-catalog-status'),results=$('inpe-catalog-results'),search=$('inpe-catalog-search');
let controller=null,serial=0,lastAttempt=0,cache=new Map(),day='',used=0;
const clock=ms=>new Date(ms).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' BRT';
function cancel(){serial++;controller?.abort();controller=null;search.disabled=false;}
function clear(){results.replaceChildren();}
function row(tag,value){const e=document.createElement(tag);e.textContent=value;return e;}
function display(data){
 clear();
 for(const radar of data.radars){
  const info=describeRadar(radar);
  if(!info)continue;
  const item=document.createElement('details');
  item.append(row('summary',info.name+' · '+info.owner),row('p','Última observação: '+clock(info.time)),row('p',info.products.join(' · ')),row('small',info.count+' quadros disponíveis no catálogo. O mapa não exibe esta refletividade nesta prévia.'));
  results.append(item);
 }
 status.textContent=data.radars.length?data.radars.length+' radares retornados'+(data.partial?' · resultado parcial':''):'Nenhum radar recente retornado para esta área. Isso não indica ausência de chuva.';
}
async function query(){
 if(controller||panel.hidden)return;
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
$('inpe-catalog-close').addEventListener('click',()=>{cancel();panel.hidden=true;});
search.addEventListener('click',query);
window.addEventListener('argos-inpe-pause',()=>{cancel();panel.hidden=true;});
