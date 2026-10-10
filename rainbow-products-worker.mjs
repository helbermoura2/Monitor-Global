import {rainbowLocation} from './rainbow-nowcast-worker.mjs';
export const PRODUCT_LIMITS={weather:{month:4500,day:150},tiles:{month:27000,day:800}};
const CORS={'Access-Control-Allow-Origin':'*'};
const json=(data,status=200)=>Response.json(data,{status,headers:{...CORS,'Cache-Control':'no-store'}});
const unavailable=(reason,status=200,extra={})=>json({ok:false,reason,...extra,detail:'Rainbow temporariamente indisponível; usando a fonte reserva.'},status);
function route(url,now){
 if(url.pathname==='/rain-weather'){const loc=rainbowLocation(url);return loc?{product:'weather',key:`weather:${loc.lat},${loc.lng}`,loc,ttl:3600000,path:`weather/v1/forecast/${loc.lng}/${loc.lat}?forecast_days=5&forecast_hours=48`}:null;}
 if(url.pathname==='/rainbow-snapshot')return {product:'tiles',key:'tiles:snapshot',ttl:600000,path:'tiles/v1/snapshot?layer=precip-global'};
 const match=url.pathname.match(/^\/rainbow-tile\/(\d+)\/(\d+)\/(\d+)\/(\d+)$/);
 if(!match)return null;
 const [snapshot,z,x,y]=match.slice(1).map(Number);
 if(![snapshot,z,x,y].every(Number.isSafeInteger)||z>7||x>=2**z||y>=2**z||snapshot%600||snapshot*1000>now+60000||snapshot*1000<now-7200000)return null;
 return {product:'tiles',key:`tiles:${snapshot}/${z}/${x}/${y}`,binary:true,ttl:Math.min(7200000,snapshot*1000+7200000-now),path:`tiles/v1/precip-global/${snapshot}/0/${z}/${x}/${y}?color=9`};
}
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:null;
export function normalizeWeather(data,loc,now){
 if(!data?.units||data.units.temperature!=='celsius'||data.units.windSpeed!=='meter_per_second'||data.units.precipitationAmount!=='millimeters'||data.units.humidity!=='percent'||data.units.precipitationChance!=='percent')throw Error('units');
 if(!Number.isFinite(data.location?.lat)||!Number.isFinite(data.location?.lon)||Math.abs(data.location.lat-loc.lat)>.02||Math.abs(data.location.lon-loc.lng)>.02)throw Error('location');
 const generated=data.generatedAtTimestamp*1000;
 if(!Number.isFinite(generated)||generated>now+300000||generated<now-10800000)throw Error('stale');
 if(!Array.isArray(data.timelines?.hourly)||!Array.isArray(data.timelines?.daily)||data.timelines.hourly.length>168||data.timelines.daily.length>15)throw Error('series');
 let last=0;
 const hourly=data.timelines.hourly.map(p=>{
  const start=p.startTimestamp*1000;if(!Number.isFinite(start)||start<=last||(last&&start-last!==3600000))throw Error('hour');last=start;
  const temperature=finite(p.temperature,-100,70),amount=finite(p.precipitationAmount,0,1000),chance=finite(p.precipitationChance,0,100);
  if(temperature===null||amount===null||chance===null)throw Error('fields');
  return {start,temperature,feels:finite(p.feelsLikeTemperature,-120,100),humidity:finite(p.humidity,0,100),amount,chance,wind:finite(p.windSpeed,0,150)===null?null:p.windSpeed*3.6,gust:finite(p.windGust,0,150)===null?null:p.windGust*3.6,uv:finite(p.uvIndex,0,30),pressure:finite(p.pressure,800,1100)};
 });
 if(!hourly.some(p=>p.start<=now&&p.start+3600000>now)||hourly.at(-1).start<now+6*3600000)throw Error('coverage');
 const daily=data.timelines.daily.slice(0,5).map(p=>{
  const start=p.startTimestamp*1000,min=finite(p.temperatureMin,-100,70),max=finite(p.temperatureMax,-100,70);
  if(!Number.isFinite(start)||min===null||max===null||max<min)throw Error('day');
  const date=typeof p.startTimeIso==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(p.startTimeIso)&&Date.parse(p.startTimeIso)===start?p.startTimeIso.slice(0,10):new Date(start).toISOString().slice(0,10);
  return {start,date,min,max,amount:finite(p.precipitationAmount,0,2000),chance:finite(p.precipitationChance,0,100),condition:typeof p.condition==='string'?p.condition.slice(0,60):'Unknown'};
 });
 if(!daily.length)throw Error('days');
 return {ok:true,source:'Rainbow Weather',loc,at:now,generatedAt:generated,expiresAt:now+3600000,hourly,daily};
}
export async function handleRainbowProducts(request,env){
 if(request.method!=='GET')return unavailable('method',405);
 const r=route(new URL(request.url),Date.now());if(!r)return unavailable('request',400);
 if(!env.EARTHQUAKE_ALERTS)return unavailable('storage_unavailable');
 try{return await env.EARTHQUAKE_ALERTS.get(env.EARTHQUAKE_ALERTS.idFromName('global-rainbow-products-'+r.product+'-v1')).fetch(request);}catch{return unavailable('storage_unavailable');}
}
function cachedReply(c){return c.binary?new Response(c.bytes,{headers:{...CORS,'Content-Type':'image/png','Cache-Control':'public, max-age=600'}}):json(c.data);}
export async function handleRainbowProductInObject(request,env,storage,{now=Date.now(),fetcher=globalThis.fetch.bind(globalThis)}={}){
 const r=route(new URL(request.url),now);
 if(request.method!=='GET'||!r)return unavailable('request',400);
 const raw=env.RAINBOW_API_KEY,key=typeof raw==='string'&&!/[\x00-\x1f\x7f]/.test(raw)?raw.trim():'';
 if(!key)return unavailable('not_configured',r.binary?503:200);
 try{
  const cached=await storage.get(r.key);
  if(cached&&now>=cached.at&&now<cached.until)return cachedReply(cached);
  const pause=await storage.get(`${r.product}:pause`);
  if(pause>now)return unavailable('provider_unavailable',r.binary?503:200,{httpStatus});
  const month=new Date(now).toISOString().slice(0,7),day=new Date(now).toISOString().slice(0,10),old=await storage.get(`${r.product}:budget`);
  const budget={month,day,used:old?.month===month?old.used:0,dailyUsed:old?.day===day?old.dailyUsed:0},limit=PRODUCT_LIMITS[r.product];
  if(!Number.isSafeInteger(budget.used)||budget.used<0||!Number.isSafeInteger(budget.dailyUsed)||budget.dailyUsed<0)throw Error('budget');
  if(budget.used>=limit.month||budget.dailyUsed>=limit.day)return unavailable('free_limit',r.binary?429:200);
  budget.used++;budget.dailyUsed++;await storage.put(`${r.product}:budget`,budget);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  let entry,httpStatus=null;
  try{
   const res=await fetcher('https://api.rainbow.ai/'+r.path,{headers:{'Ocp-Apim-Subscription-Key':key,Accept:r.binary?'image/png':'application/json'},redirect:'manual',signal:controller.signal});
   httpStatus=res.status;if(!res.ok)throw Error('provider');
   if(r.binary){
    const bytes=new Uint8Array(await res.arrayBuffer());
    if(bytes.length>120000||bytes.length<8||![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))throw Error('png');
    entry={binary:true,bytes,at:now,until:now+r.ttl};
   }else{
    const text=await res.text();if(text.length>150000)throw Error('size');const data=JSON.parse(text);
    let normalized;
    if(r.product==='weather')normalized=normalizeWeather(data,r.loc,now);
    else{const stamp=data.snapshot;if(!Number.isSafeInteger(stamp)||stamp%600||stamp*1000>now+60000||stamp*1000<now-1800000)throw Error('snapshot');normalized={ok:true,source:'Rainbow Weather',snapshot:stamp,at:now,expiresAt:now+r.ttl};}
    entry={data:normalized,at:now,until:now+r.ttl};
   }
  }catch{await storage.put(`${r.product}:pause`,now+600000);return unavailable('provider_unavailable',r.binary?503:200,{httpStatus});}finally{clearTimeout(timer);}
  const indexKey=`${r.product}:cache-index`,index=(await storage.get(indexKey)||[]).filter(k=>k!==r.key);index.push(r.key);
  while(index.length>(r.product==='weather'?32:48))await storage.delete(index.shift());
  await storage.put(r.key,entry);await storage.put(indexKey,index);return cachedReply(entry);
 }catch{return unavailable('storage_unavailable',r.binary?503:200);}
}
