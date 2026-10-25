/* Presentation only: one minute-rain estimate, independently sourced hourly conditions. */
(() => {
 const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
 const number=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:1});
 const set=(id,text,title)=>{const el=document.getElementById(id);if(!el)return;if(el.textContent!==text)el.textContent=text;if(title&&el.title!==title)el.title=title;};
 function rain(summary,{loading=false,detail=''}={}){
  const now=Date.now(),loc=typeof weatherLoc==='object'?weatherLoc:null;
  const valid=summary?.provider==='rainbow'&&Number.isFinite(summary.consultedAt)&&summary.consultedAt<=now+60000&&now-summary.consultedAt<=20*60000&&(!loc||summary.loc&&Math.abs(summary.loc.lat-loc.lat)<=.002&&Math.abs(summary.loc.lng-loc.lng)<=.002)&&finite(summary.rate)&&['now','soon','dry'].includes(summary.status);
  const text=valid?(summary.status==='now'?summary.header+' · '+number(summary.rate)+' mm/h estimados':summary.header.replace('Sem chuva prevista','Sem chuva estimada')+' · estimativa'):loading?'Chuva: consultando estimativa':'Chuva: estimativa por minuto indisponível';
  const title=valid?summary.detail+' · Rainbow Weather · Consulta '+new Date(summary.consultedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'. Taxa em mm/h, não acumulado medido.':(detail||'Estimativa por minuto indisponível ou desatualizada. Consulte a previsão horária nos detalhes.');
  set('sp-rain-eta',text,title);set('mobile-rain','🌧️ '+text,title);set('sp-rain-eta-ico',valid&&summary.status==='now'?'🌧️':valid&&summary.status==='soon'?'🌦️':'⏱️');
  const chip=document.getElementById('sp-rain-eta-chip');if(chip){chip.title=title;chip.dataset.rainDetail=title;chip.setAttribute('aria-label',text+'. '+title);chip.classList.remove('rain-now','rain-soon','rain-clear');chip.classList.add(valid?'rain-'+(summary.status==='dry'?'clear':summary.status):'rain-clear');const badge=chip.querySelector('small');if(badge&&badge.textContent!=='chuva · estimativa por minuto')badge.textContent='chuva · estimativa por minuto';}
  return valid;
 }
 function wind(w={}){
  const loc=typeof weatherLoc==='object'?weatherLoc:null,now=Date.now(),status=window.WeatherDataStatus?.state('current')?.status;
  if(status==='stale'||status==='error'||w.loc&&loc&&(Math.abs(w.loc.lat-loc.lat)>.002||Math.abs(w.loc.lng-loc.lng)>.002)||Number.isFinite(w.sourceAt)&&(w.sourceAt>now+60000||now-w.sourceAt>90*60000))w={};
  const text=(finite(w.wind)?'Vento '+Math.round(w.wind)+' km/h':'Vento —')+(finite(w.gust)?' · rajadas '+Math.round(w.gust)+' km/h':' · rajadas —');
  const title=(w.source||'Modelo meteorológico')+' · vento e rajadas previstos'+(Number.isFinite(w.sourceAt)?' · hora de referência '+new Date(w.sourceAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'')+(Number.isFinite(w.generatedAt)?' · previsão gerada '+new Date(w.generatedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'');
  set('sp-live-gust',text,title);set('mobile-gust','💨 '+text,title);set('kpi-wind','💨 '+text,title);
 }
 function refreshRain(){const loc=typeof weatherLoc==='object'?weatherLoc:null;rain(loc&&window.RainbowNowcast?.outlook(loc),{detail:loc&&window.RainbowNowcast?.status(loc)?.detail});}
 window.WeatherHeaderSummary={rain,wind,refreshRain};
})();
