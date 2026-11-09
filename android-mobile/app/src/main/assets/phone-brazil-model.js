/* Open-Meteo point forecasts: regional samples, never an invented continuous weather field. */
(function(root){
'use strict';
const PLACES=[
 ['Manaus',-3.119,-60.022],['Belém',-1.455,-48.490],['Boa Vista',2.823,-60.676],
 ['Porto Velho',-8.761,-63.900],['Cuiabá',-15.601,-56.097],['Campo Grande',-20.469,-54.620],
 ['Brasília',-15.794,-47.883],['Goiânia',-16.686,-49.264],['Fortaleza',-3.732,-38.527],
 ['Recife',-8.054,-34.881],['Salvador',-12.977,-38.501],['Belo Horizonte',-19.916,-43.934],
 ['Rio de Janeiro',-22.906,-43.173],['São Paulo',-23.555,-46.635],
 ['Curitiba',-25.428,-49.273],['Porto Alegre',-30.034,-51.230]
].map(([name,lat,lon])=>Object.freeze({name,lat,lon}));
const FIELDS=['temperature_2m','wind_speed_10m','wind_direction_10m','precipitation','pressure_msl'];
const LIMITS={temperature_2m:[-50,60],wind_speed_10m:[0,300],wind_direction_10m:[0,360],precipitation:[0,500],pressure_msl:[850,1100]};
const HOUR=3600000;
function brHour(now){
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).format(new Date(now)).replace(' ','T');
}
function url(places=PLACES){
 const params=new URLSearchParams({latitude:places.map(p=>p.lat).join(','),longitude:places.map(p=>p.lon).join(','),hourly:FIELDS.join(','),timezone:'America/Sao_Paulo',forecast_days:'3',wind_speed_unit:'kmh'});
 return 'https://api.open-meteo.com/v1/forecast?'+params.toString();
}
function parse(payload,now=Date.now(),places=PLACES){
 if(!Array.isArray(places)||places.length<1||places.length>20||places.some(p=>!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||p.lat>6||p.lat< -34||p.lon> -32||p.lon< -75))return null;
 if(places.length===1&&!Array.isArray(payload))payload=[payload];
 if(!Array.isArray(payload)||payload.length!==places.length)return null;
 let times=null,first=-1;const series=[];
 for(let i=0;i<payload.length;i++){
  const entry=payload[i],hourly=entry&&entry.hourly;
  if(!hourly||entry.timezone!=='America/Sao_Paulo'||!Number.isFinite(entry.latitude)||!Number.isFinite(entry.longitude)||Math.abs(entry.latitude-places[i].lat)>0.3||Math.abs(entry.longitude-places[i].lon)>0.3)return null;
  if(!Array.isArray(hourly.time)||hourly.time.length<48||hourly.time.length>96||hourly.time.some(t=>typeof t!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:00$/.test(t)))return null;
  if(times===null){
   times=hourly.time;
   if(times.some((t,j)=>j>0&&t<=times[j-1]))return null;
   first=times.findIndex(t=>t>=brHour(now));
   if(first<0||first+24>=times.length)return null;
  }else if(hourly.time.length!==times.length||hourly.time.some((t,j)=>t!==times[j]))return null;
  const forecast={};
  for(const field of FIELDS){
   const values=hourly[field],bounds=LIMITS[field];
   if(!Array.isArray(values)||values.length!==times.length||values.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<bounds[0]||n>bounds[1]))return null;
   forecast[field]=values;
  }
  series.push(forecast);
 }
 return {series,times,first,at:now,places:places.map(p=>({name:String(p.name),lat:p.lat,lon:p.lon}))};
}
function value(data,placeIndex,step,field){
 if(!data||!FIELDS.includes(field)||!Number.isInteger(placeIndex)||placeIndex<0||placeIndex>=data.places.length||!Number.isInteger(step)||step<0||step>8)return null;
 return data.series[placeIndex][field][data.first+step*3];
}
const api={PLACES,FIELDS,url,parse,value,brHour,HOUR};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PhoneBrazilModel=api;
})(typeof window==='undefined'?globalThis:window);
