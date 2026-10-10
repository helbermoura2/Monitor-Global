/* Automatic rain notices reuse the validated Nowcast; no additional API polling. */
(function(){
'use strict';
const MINUTE=60000,STORE='mg-rain-arrival-v1',records=new Map();
let root=null,closeTimer=null,retryTimer=null,removeTimer=null,removing=null,generation=0,currentKey=null;
const mobile=()=>matchMedia('(max-width:900px)').matches;
const location=()=>typeof weatherLoc==='object'?weatherLoc:null;
const key=loc=>loc&&Number.isFinite(loc.lat)&&Number.isFinite(loc.lng)?loc.lat.toFixed(3)+','+loc.lng.toFixed(3):null;
const latest=()=>window.RainbowNowcast?.outlook(location());
const number=v=>v.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
const intensity=rate=>rate<2.5?'fraca':rate<7.5?'moderada':rate<50?'forte':'muito forte';
function candidate(summary,now=Date.now()){
 const loc=location();
 if(!summary||summary.provider!=='rainbow'||!loc||Math.abs(summary.loc?.lat-loc.lat)>.002||Math.abs(summary.loc?.lng-loc.lng)>.002||!key(summary.loc)||!Number.isFinite(summary.consultedAt)||summary.consultedAt>now+MINUTE||now-summary.consultedAt>20*MINUTE||!Number.isFinite(summary.now)||now-summary.now>90000||summary.now>now+MINUTE||!Number.isFinite(summary.amount)||summary.amount<0||!Array.isArray(summary.series))return null;
 if(!['now','soon'].includes(summary.status)||!Number.isFinite(summary.arrivalMinutes)||summary.arrivalMinutes<0||summary.arrivalMinutes>20)return null;
 const wet=summary.series.filter(p=>['rain','mixed'].includes(p.type)&&Number.isFinite(p.rate)&&p.rate>=.1&&p.rate<=1000&&p.end>now);
 if(!wet.length)return null;
 const peak=Math.max(...wet.map(p=>p.rate));
 return {key:key(summary.loc),summary,peak,intensity:intensity(peak),now:summary.status==='now',arrival:summary.arrivalMinutes};
}
function save(){
 while(records.size>16)records.delete(records.keys().next().value);
 try{sessionStorage.setItem(STORE,JSON.stringify([...records]));}catch{}
}
try{
 const saved=JSON.parse(sessionStorage.getItem(STORE)||'[]');
 if(Array.isArray(saved))for(const [k,r]of saved.slice(-16))if(typeof k==='string'&&r&&Number.isFinite(r.lastWet)&&Date.now()-r.lastWet<86400000&&r.lastWet<=Date.now())records.set(k,{lastWet:r.lastWet,drySince:Number(r.drySince)||0,notified:r.notified===true});
}catch{}
function selected(){return window.EventStore?.getSelected?.()||(typeof globalEvents!=='undefined'?globalEvents.find(e=>e.id===eventoSelecionadoId):null);}
function blocked(){
 if(document.hidden||document.body.classList.contains('weather-view')||window.EventDetailsBack?.isOpen())return true;
 const item=selected();
 if(Number(item?.mag)>=5||item?.type==='tsunami')return true;
 if(typeof getAutoCycleProtectionRemaining==='function'&&getAutoCycleProtectionRemaining()>0)return true;
 if(window.__mgLiveQuakeId===item?.id&&Date.now()<(window.__mgLiveQuakeUntil||0))return true;
 if(document.getElementById('pd-flip-verso')||document.getElementById('pd-details-verso'))return true;
 if(!mobile()){
  const panel=document.getElementById('painel-direito'),rect=panel?.getBoundingClientRect();
  if(!rect?.width||!rect.height||getComputedStyle(panel).visibility==='hidden')return true;
 }
 return false;
}
function scheduleRetry(){
 if(retryTimer||document.hidden)return;
 retryTimer=setTimeout(()=>{retryTimer=null;consider(latest());},15000);
}
function position(){
 if(!root||mobile())return;
 const panel=document.getElementById('painel-direito'),rect=panel?.getBoundingClientRect();if(!rect)return;
 Object.assign(root.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',zIndex:String(Math.max(700,Number(getComputedStyle(panel).zIndex)||0)+1)});
}
function close(immediate=false){
 generation++;clearTimeout(closeTimer);clearTimeout(removeTimer);closeTimer=null;
 const panel=document.getElementById('painel-direito');
 if(removing){removing.remove();removing=null;if(!root&&!document.getElementById('pd-flip-verso')&&!document.getElementById('pd-details-verso'))panel?.classList.remove('pd-flip-preparado');}
 if(!root)return;
 const old=root;root=null;currentKey=null;
 const desktop=old.classList.contains('rain-arrival-desktop');
 if(desktop&&!document.getElementById('pd-flip-verso')&&!document.getElementById('pd-details-verso')){
  if(immediate){const transition=panel.style.transition;panel.style.transition='none';panel.classList.remove('pd-flip-girado','pd-flip-preparado');void panel.offsetWidth;panel.style.transition=transition;}
  else panel?.classList.remove('pd-flip-girado');
 }
 old.classList.remove('pd-flip-visivel','rain-arrival-visible');document.body.classList.remove('rain-arrival-open');
 if(immediate)old.remove();else {removing=old;removeTimer=setTimeout(()=>{old.remove();removing=null;if(!root&&!document.getElementById('pd-flip-verso')&&!document.getElementById('pd-details-verso'))panel?.classList.remove('pd-flip-preparado');},750);}
}
function element(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;}
function show(c){
 close(true);const isMobile=mobile(),token=++generation;
 root=element('section','rain-arrival-notice '+(isMobile?'rain-arrival-mobile':'pd-flip-verso rain-arrival-desktop'));root.id='rain-arrival-notice';root.setAttribute('aria-label','Chuva se aproximando');root.setAttribute('role','region');
 const top=element('header','rain-arrival-top'),tag=element('strong','rain-arrival-tag',c.now?'CHUVA PREVISTA AGORA':'CHUVA SE APROXIMANDO'),dismiss=element('button','rain-arrival-close','×');dismiss.type='button';dismiss.setAttribute('aria-label',isMobile?'Dispensar aviso de chuva':'Voltar ao evento');dismiss.onclick=()=>close();top.append(tag,dismiss);root.append(top);
 const hero=element('div','rain-arrival-hero');hero.append(element('span','rain-arrival-icon','🌧️'),element('h2','rain-arrival-time',c.now?'Agora':'≈ '+c.arrival+' min'));hero.setAttribute('aria-live','polite');root.append(hero);
 root.append(element('p','rain-arrival-city',location()?.nome||'Local selecionado'));
 const metrics=element('div','rain-arrival-metrics');
 for(const [label,value]of [['Pico previsto · próxima hora',c.intensity],['Acumulado previsto · 1 h','≈ '+number(c.summary.amount)+' mm']]){const metric=element('div');metric.append(element('small',null,label),element('strong',null,value));metrics.append(metric);}root.append(metrics);
 const chart=element('div','rain-arrival-chart');window.RainbowNowcast.appendChart(chart,c.summary,{id:'rain-arrival-chart',compact:true});root.append(chart);
 const actions=element('div','rain-arrival-actions'),back=element('button','rain-arrival-return',isMobile?'Dispensar':'↶ Voltar ao evento'),details=element('button','rain-arrival-details','Ver previsão');back.type=details.type='button';back.onclick=()=>close();details.onclick=()=>{close(true);window.WeatherPanel?.show();};actions.append(back,details);root.append(actions);
 root.append(element('small','rain-arrival-note','Estimativa Rainbow · sujeita a mudanças'));
 document.body.append(root);currentKey=c.key;document.body.classList.add('rain-arrival-open');
 if(!isMobile){position();document.getElementById('painel-direito').classList.add('pd-flip-preparado');}
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(!root||token!==generation)return;
  if(blocked()){close(true);scheduleRetry();return;}
  if(isMobile)root.classList.add('rain-arrival-visible');else{document.getElementById('painel-direito').classList.add('pd-flip-girado');root.classList.add('pd-flip-visivel');}
  const record=records.get(c.key);if(record){record.notified=true;save();}
  closeTimer=setTimeout(()=>close(),isMobile?20000:12000);
 }));
}
function consider(summary){
 clearTimeout(retryTimer);retryTimer=null;
 const now=Date.now(),locKey=key(location()),c=candidate(summary,now);
 if(root&&(currentKey!==locKey||!c||blocked()))close(true);
 if(!c){
  if(summary?.provider==='rainbow'&&summary.status==='dry'&&key(summary.loc)===locKey&&now-summary.consultedAt<20*MINUTE){
   const record=records.get(locKey);if(record){record.drySince=record.drySince||now;if(now-record.drySince>=20*MINUTE)records.delete(locKey);save();}
  }
  return;
 }
 let record=records.get(c.key);
 if(!record||now-record.lastWet>6*3600000){record={notified:false,drySince:0,lastWet:now};records.set(c.key,record);}
 record.drySince=0;record.lastWet=now;
 if(record.notified||root)return;
 if(blocked()){scheduleRetry();return;}
 show(c);
}
function init(){
 window.EventStore?.subscribe(reason=>{
  if(reason==='select'){if(root&&(!mobile()||blocked()))close(true);if(!root){const c=candidate(latest());if(c&&!records.get(c.key)?.notified)scheduleRetry();}}
  else if(root&&blocked())close(true);
 });
 const panel=document.getElementById('painel-direito');if(panel)new ResizeObserver(position).observe(panel);
 consider(latest());
}
window.RainArrivalNotice={consider,close,candidate};
document.addEventListener('DOMContentLoaded',init,{once:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){close(true);clearTimeout(retryTimer);retryTimer=null;}else consider(latest());});
window.addEventListener('resize',()=>{if(root&&mobile()!==root.classList.contains('rain-arrival-mobile'))close(true);else position();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&root)close();});
})();
