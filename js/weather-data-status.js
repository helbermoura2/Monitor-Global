/* Independent states for present conditions, hourly forecast and rain outlook. */
(function(root){'use strict';const states={},limits={current:90*60000,forecast:90*60000,rain:20*60000};
 const same=(a,b)=>a&&b&&Math.abs(a.lat-b.lat)<.02&&Math.abs(a.lng-b.lng)<.02;
 const loc=()=>typeof weatherLoc!=='undefined'?{lat:weatherLoc.lat,lng:weatherLoc.lng}:null;
 const valid=n=>n!=null&&String(n).trim()!==''&&Number.isFinite(Number(n));
 function state(channel,now=Date.now()){const s=states[channel];if(!s||!same(s.loc,loc()))return {status:'loading',label:'Carregando'};let status=s.status;if(status==='updated'&&(!Number.isFinite(s.at)||now-s.at>limits[channel]||s.at>now+60000||(Number.isFinite(s.sourceAt)&&(now-s.sourceAt>limits[channel]||s.sourceAt>now+60000))))status='stale';const label={loading:'Carregando',updated:'Atualizado',stale:'Desatualizado',error:'Indisponível'}[status];return {...s,status,label};}
 function record(channel,status,details={}){if(status==='updated'&&/open.?meteo/i.test(details.source||'')){const shared=root.SharedSourceDelivery?.forName('OpenMeteo');if(shared){details={...details,at:shared.at||details.at};if(shared.state==='stale')status='stale';else if(shared.state==='partial')status='stale';}}const position=details.loc||loc();if(!same(position,loc()))return;states[channel]={...states[channel],...details,loc:position,status};render();}
 function render(){if(typeof document==='undefined')return;const c=state('current'),f=state('forecast'),r=state('rain'),summary='Condições atuais: '+c.label.toLowerCase()+' · Previsão horária: '+f.label.toLowerCase()+' · Previsão de chuva: '+r.label.toLowerCase();
  const card=document.getElementById('sp-live-card');if(card){card.dataset.weatherState=c.status;card.title=summary;}
  const source=document.getElementById('sp-live-source');if(source&&c.source&&source.textContent!==c.source.split(' · ')[0])source.textContent=c.source.split(' · ')[0];
  const badge=document.getElementById('weather-current-status');if(badge){badge.textContent=c.status==='updated'?'':c.label;badge.hidden=c.status==='updated';}
  if(c.status==='stale'||c.status==='error')for(const id of ['sp-live-temp','sp-live-feels','sp-live-gust','sp-live-rain','sp-live-hum','kpi-temp','kpi-feels','kpi-wind']){const el=document.getElementById(id);if(el&&el.textContent!=='—')el.textContent='—';}
  const chip=document.getElementById('sp-rain-eta-chip');if(chip){chip.dataset.forecastState=r.status;chip.title=summary+(chip.dataset.rainDetail?' · '+chip.dataset.rainDetail:'');chip.setAttribute('aria-label',chip.title);}
  const host=document.getElementById('weather-data-status');if(host){host.replaceChildren();for(const [label,s]of [['Condições atuais',c],['Previsão horária',f],['Previsão de chuva',r]]){const row=document.createElement('p');row.style.cssText='margin:5px 0;font-size:12px;line-height:1.4';row.textContent=label+': '+s.label.toLowerCase()+(s.source?' · '+s.source:'')+(Number.isFinite(s.at)?' · consulta '+new Date(s.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'');host.append(row);}}
 }
 function modelTime(value,offset=0){if(typeof value!=='string'||!value)return null;const explicit=/Z$|[+-]\d\d:\d\d$/.test(value);const n=Date.parse(explicit?value:value+'Z')-(explicit?0:(Number(offset)||0)*1000);return Number.isFinite(n)?n:null;}
 root.WeatherDataStatus={record,state,render,valid,modelTime,location:loc};
 document.addEventListener('DOMContentLoaded',()=>{render();PeriodicScheduler.every('weather-data-status',render,30000,30000,'ui');});
})(window);
