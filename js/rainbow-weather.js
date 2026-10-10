/* Hourly forecast shared by all weather views; never exposes a provider key. */
(function(){
'use strict';
let cached=null,inflight=null,inflightKey='',retryAt=0;
const loc=()=>typeof weatherLoc==='object'?{lat:Number(weatherLoc.lat.toFixed(3)),lng:Number(weatherLoc.lng.toFixed(3))}:null;
const same=(a,b)=>a&&b&&a.lat===b.lat&&a.lng===b.lng;
async function refresh(){
 const position=loc();if(!position||typeof workerBaseUrl!=='function')return null;
 const key=position.lat+','+position.lng;
 if(cached?.ok&&same(cached.loc,position)&&cached.expiresAt>Date.now())return cached;
 if(inflight&&inflightKey===key)return inflight;
 if(Date.now()<retryAt)return null;
 const task=(async()=>{
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);
  try{
   const response=await fetch(workerBaseUrl()+'/rain-weather?lat='+position.lat+'&lng='+position.lng,{signal:c.signal});
   const data=await response.json();
   if(!same(loc(),position))return null;
   if(!response.ok||!data.ok||!same(data.loc,position)||!Array.isArray(data.hourly)||!Array.isArray(data.daily))throw Error('forecast');
   cached=data;retryAt=0;window.MonitorFreshness?.record('RainbowWeather',true,data.generatedAt);return data;
  }catch{retryAt=Date.now()+600000;window.MonitorFreshness?.record('RainbowWeather',false);return null;}finally{clearTimeout(timer);}
 })();inflight=task;inflightKey=key;task.finally(()=>{if(inflight===task){inflight=null;inflightKey='';}});return task;
}
const current=d=>d?.hourly.find(p=>p.start<=Date.now()&&p.start+3600000>Date.now());
function applyCurrent(data){
 if(!same(data?.loc,loc()))return false;const p=current(data);if(!p)return false;
 const set=(id,value)=>{const el=document.getElementById(id);if(el){el.textContent=value;el.title='Previsão horária · Rainbow Weather';}};
 const num=n=>n==null?'—':Math.round(n),city=weatherLoc.nome||'São Paulo';
 set('sp-live-city',city.toUpperCase());if(typeof siglaCidade==='function')set('sp-city-name',siglaCidade(city));
 set('sp-live-temp',num(p.temperature)+'°');set('sp-live-feels','sens '+num(p.feels)+'°');set('sp-live-gust',num(p.gust)+' km/h');set('sp-live-hum',num(p.humidity)+'%');set('sp-live-rain',p.amount.toLocaleString('pt-BR',{maximumFractionDigits:1})+' mm previstos/h');
 set('kpi-temp',num(p.temperature)+'°');set('kpi-feels','sens '+num(p.feels)+'°');set('kpi-wind','💨 '+num(p.gust)+' km/h');set('kpi-wx-icon',p.chance>=50?'🌧️':'🌤️');
 window.__proWeather={temp:p.temperature,feels:p.feels,gust:p.gust,rain:p.amount,hum:p.humidity,code:p.chance>=50?61:2,source:'Rainbow Weather',forecast:true};
 if(typeof syncMobileWeather==='function')syncMobileWeather();if(typeof updateRisk==='function')updateRisk();return true;
}
const codes={Clear:0,MostlyClear:1,PartlyCloudy:2,MostlyCloudy:3,Cloudy:3,Foggy:45,Haze:45,Drizzle:51,Rain:61,HeavyRain:65,Thunderstorms:95,StrongStorms:95,ScatteredThunderstorms:95,IsolatedThunderstorms:95,Snow:71,HeavySnow:75};
function forecastAdapter(d){
 if(!same(d?.loc,loc()))return null;
 const h=d.hourly,days=d.daily,series=(key)=>h.map(p=>p[key]);
 return {rainbow:true,generatedAt:d.generatedAt,utc_offset_seconds:0,
 hourly:{time:h.map(p=>new Date(p.start).toISOString().slice(0,19)),temperature_2m:series('temperature'),apparent_temperature:series('feels'),precipitation_probability:series('chance'),precipitation:series('amount'),wind_gusts_10m:series('gust'),weather_code:h.map(p=>p.chance>=50?61:2)},
 daily:{time:days.map(p=>p.date||new Date(p.start).toISOString().slice(0,10)),weather_code:days.map(p=>codes[p.condition]??(p.chance>=50?61:2)),temperature_2m_max:days.map(p=>p.max),temperature_2m_min:days.map(p=>p.min),precipitation_probability_max:days.map(p=>p.chance),precipitation_sum:days.map(p=>p.amount)}};
}
window.RainbowWeather={refresh,applyCurrent,forecastAdapter,current,latest:()=>same(cached?.loc,loc())&&cached.expiresAt>Date.now()?cached:null};
})();
