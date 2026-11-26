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
const EXTRAS=['relative_humidity_2m','apparent_temperature','wind_gusts_10m'];
const LIMITS={temperature_2m:[-50,60],wind_speed_10m:[0,300],wind_direction_10m:[0,360],precipitation:[0,500],pressure_msl:[850,1100],relative_humidity_2m:[0,100],apparent_temperature:[-80,75],wind_gusts_10m:[0,350]};
const DAILY={weather_code:[0,99],temperature_2m_min:[-50,60],temperature_2m_max:[-50,60],precipitation_probability_max:[0,100],precipitation_sum:[0,3000],wind_speed_10m_max:[0,300]};
const HOUR=3600000;
function brHour(now){
 return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(Math.floor(now/HOUR)*HOUR)).replace(' ','T');
}
function url(places=PLACES){
 const params=new URLSearchParams({latitude:places.map(p=>p.lat).join(','),longitude:places.map(p=>p.lon).join(','),hourly:[...FIELDS,...EXTRAS,...(places.length===1?['precipitation_probability']:[])].join(','),timezone:'America/Sao_Paulo',forecast_days:places.length===1?'7':'3',wind_speed_unit:'kmh'});
 if(places.length===1)params.set('daily',Object.keys(DAILY).join(','));
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
  if(!Array.isArray(hourly.time)||hourly.time.length<48||hourly.time.length>(places.length===1?168:96)||hourly.time.some(t=>typeof t!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:00$/.test(t)))return null;
  if(times===null){
   times=hourly.time;
   const stamps=times.map(time=>Date.parse(time+'Z'));
   if(stamps.some((time,j)=>!Number.isFinite(time)||j>0&&time-stamps[j-1]!==HOUR))return null;
   first=times.findIndex(t=>t>=brHour(now));
   if(first<0||first+24>=times.length)return null;
  }else if(hourly.time.length!==times.length||hourly.time.some((t,j)=>t!==times[j]))return null;
  const forecast={};
  for(const field of FIELDS){
   const values=hourly[field],bounds=LIMITS[field];
   if(!Array.isArray(values)||values.length!==times.length||values.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<bounds[0]||n>bounds[1]))return null;
   forecast[field]=values;
  }
  // New climate fields are optional so cached forecasts from earlier versions
  // stay usable; never fabricate missing humidity, wind gusts or apparent temp.
  for(const field of EXTRAS){
   const values=hourly[field],bounds=LIMITS[field];
   forecast[field]=Array.isArray(values)&&values.length===times.length&&values.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=bounds[0]&&n<=bounds[1])?values:null;
  }
  forecast.week=week(entry.daily,hourly,now);
  series.push(forecast);
 }
 return {series,times,first,at:now,places:places.map(p=>({name:String(p.name),lat:p.lat,lon:p.lon}))};
}
function week(daily,hourly,now){
 if(!Array.isArray(daily?.time)||daily.time.length!==7)return [];
 const current=brHour(now),today=Date.parse(current.slice(0,10)+'T00:00Z');
 const rows=[];
 for(let i=0;i<7;i++){
  const date=daily.time[i],expected=new Date(today+i*24*HOUR).toISOString().slice(0,10);
  if(date!==expected)return [];
  const row={date};
  for(const [field,[min,max]] of Object.entries(DAILY)){
   const n=daily[field]?.[i];
   row[field]=Number.isFinite(n)&&n>=min&&n<=max?n:null;
  }
  if(row.temperature_2m_min!==null&&row.temperature_2m_max!==null&&row.temperature_2m_min>row.temperature_2m_max)return [];
  let peak=null;
  for(let h=0;h<hourly.time.length;h++){
   const at=hourly.time[h],chance=hourly.precipitation_probability?.[h];
   if(at.slice(0,10)!==date||at<current||!Number.isFinite(chance)||chance<=0||chance>100)continue;
   if(!peak||chance>peak.chance)peak={at,chance};
  }
  row.peak=peak;
  rows.push(row);
 }
 return rows;
}
function value(data,placeIndex,step,field){
 if(!data||![...FIELDS,...EXTRAS].includes(field)||!Number.isInteger(placeIndex)||placeIndex<0||placeIndex>=data.places.length||!Number.isInteger(step)||step<0||step>24)return null;
 const values=data.series[placeIndex][field];return Array.isArray(values)?values[data.first+step]:null;
}
function rainIntervals(data,now=Date.now(),maxHours=24){
 if(!data)return [];
 const start=brHour(now);
 const first=data.times.indexOf(start);
 if(first<0)return [];
 // Start of the first complete hour. Open-Meteo records rain at the end of each hour.
 const initial=first+(now%HOUR===0?0:1),limit=brHour(now+24*HOUR);
 const result=[];
 for(let i=initial+1;i<data.times.length&&data.times[i]<=limit&&result.length<maxHours;i++){
  result.push({from:data.times[i-1],to:data.times[i],amount:data.series[0].precipitation[i]});
 }
 return result;
}
function nextRain(data){
 const hours=rainIntervals(data,Date.now(),3);
 return hours.length===3?{amount:hours.reduce((sum,hour)=>sum+hour.amount,0)}:null;
}
const api={PLACES,FIELDS,url,parse,value,nextRain,rainIntervals,brHour,HOUR};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PhoneBrazilModel=api;
})(typeof window==='undefined'?globalThis:window);
