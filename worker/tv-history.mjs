// On-demand history. Shared edge cache; no DO, population lookups or Telegram sends.
import {tvSnapshot} from './tv-snapshot.mjs';
const pending=new Map();
export function brasiliaDay(now){return new Date(now-3*3600000).toISOString().slice(0,10);}
export function historySnapshot(features,view,now=Date.now()){
 const day=brasiliaDay(now),start=Date.parse(day+'T00:00:00-03:00');
 const selected=features.filter(f=>Number.isFinite(f.properties?.time)&&f.properties.time>= (view==='daily'?start:now-72*3600000));
 const snapshot=tvSnapshot({features:selected},{ok:false,items:[]},now,{maxAge:72*3600000,minMagnitude:view==='daily'?2.5:6});
 snapshot.alerts=snapshot.alerts.filter(a=>a.kind==='earthquake').sort(view==='daily'?(a,b)=>b.magnitude-a.magnitude||b.eventTime-a.eventTime||a.id.localeCompare(b.id):(a,b)=>b.eventTime-a.eventTime||b.issuedAt-a.issuedAt).slice(0,view==='daily'?5:1);
 return {...snapshot,view,day,asOf:now};
}
export async function handleTvHistory(request,{view,now=Date.now(),cache=globalThis.caches?.default,fetcher=fetch}={}){
 const headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json','Cache-Control':'public, max-age=60'};
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 const ttl=view==='daily'?300000:60000,day=brasiliaDay(now);
 const key=new Request('https://black-sky-9ba0.terrestre.workers.dev/__tv-history-v1/'+view+'/'+day);
 let snapshot;try{const hit=await cache?.match(key);if(hit)snapshot=await hit.json();}catch{}
 if(!snapshot||now-snapshot.serverTime>=ttl){
  if(!pending.has(key.url))pending.set(key.url,(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
   try{
   const start=view==='daily'?day+'T00:00:00-03:00':new Date(now-72*3600000).toISOString();
   const url=new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
   for(const [k,v] of Object.entries({format:'geojson',minmagnitude:view==='daily'?'2.5':'6',starttime:start,endtime:new Date(now).toISOString(),orderby:view==='daily'?'magnitude':'time',limit:view==='daily'?'5':'1'}))url.searchParams.set(k,v);
   const r=await fetcher(url,{signal:controller.signal});if(!r.ok)throw Error('USGS unavailable');
   const data=await r.json();if(!Array.isArray(data.features))throw Error('Invalid catalog');
   const result=historySnapshot(data.features,view,now);
   try{await cache?.put(key,new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age='+ttl/1000}}));}catch{}
   return result;
   }finally{clearTimeout(timer);}
  })().finally(()=>pending.delete(key.url)));
  try{snapshot=await pending.get(key.url);}catch{return new Response(JSON.stringify({error:'Histórico indisponível; tente novamente.'}),{status:503,headers:{...headers,'Cache-Control':'no-store'}});}
 }
 return new Response(request.method==='HEAD'?null:JSON.stringify(snapshot),{headers});
}
