// On-demand history. Shared edge cache; no DO, population lookups or Telegram sends.
import {collectTvQuakes,mergeTvCatalog} from './tv-seismic-catalog.mjs';
import {fetchGlobalSupplements} from './global-seismic-data.mjs';
import {globalFeature} from './tv-seismic-catalog.mjs';
import {tvSnapshot} from './tv-snapshot.mjs';
const pending=new Map();
const BRAZIL_VOICE_WINDOW_MS=72*3600000;
export function brasiliaDay(now){return new Date(now-3*3600000).toISOString().slice(0,10);}
export function historyPeriod(view,now){
 const complete=view==='completed',day=brasiliaDay(now-(complete?86400000:0)),start=view==='brazil'?now-BRAZIL_VOICE_WINDOW_MS:Date.parse(day+'T00:00:00-03:00');
 return {day,complete,start,end:complete?start+86400000:now+1};
}
export function historySnapshot(features,view,now=Date.now()){
 const {day,start,end,complete}=historyPeriod(view,now),brazil=view==='brazil',summary=view!=='replay'&&!brazil;
 const selected=features.filter(f=>Number.isFinite(f.properties?.time)&&f.properties.time>=(brazil?start:summary?start:now-72*3600000)&&f.properties.time<end&&(!brazil||f.brazil===true));
 const snapshot=tvSnapshot({features:selected,ok:true},{ok:false,items:[]},now,{maxAge:72*3600000,minMagnitude:brazil?-5:summary?.1:6});
 snapshot.alerts=snapshot.alerts.filter(a=>a.kind==='earthquake').sort(summary?(a,b)=>b.magnitude-a.magnitude||b.eventTime-a.eventTime||a.id.localeCompare(b.id):(a,b)=>b.eventTime-a.eventTime||b.issuedAt-a.issuedAt).slice(0,brazil?1:summary?5:1);
 return {...snapshot,view,day,asOf:now,complete};
}
export async function handleTvHistory(request,{view,now=Date.now(),cache=globalThis.caches?.default,fetcher=fetch,regional=collectTvQuakes,supplemental=fetchGlobalSupplements,env}={}){
 const headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json','Cache-Control':'public, max-age=60'};
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 const expanded=new URL(request.url).searchParams.get('policy')==='telegram-v1';
 const {day,start:periodStart,end,complete}=historyPeriod(view,now),summary=view!=='replay'&&view!=='brazil',ttl=view==='brazil'?60000:summary?300000:60000;
 const key=new Request('https://black-sky-9ba0.terrestre.workers.dev/__tv-history-v3/'+(expanded?'telegram/':'legacy/')+view+'/'+day);
 let snapshot;try{const hit=await cache?.match(key);if(hit)snapshot=await hit.json();}catch{}
 if(!snapshot||now-snapshot.serverTime>=ttl){
  if(!pending.has(key.url))pending.set(key.url,(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
   try{
   if(view==='brazil'){
    // Use the existing multi-source Brazilian catalogue, not the worldwide M6+ shortcut.
    // Report a source failure separately from an observed zero-event result.
    const regionalData=await regional(env);
    const catalogs=regionalData.catalogs||{};
    if(!['USP','USGS_BR','EMSC','GEOFON'].some(source=>catalogs[source]===true))throw Error('Brazilian seismic catalogues unavailable');
    const merged=mergeTvCatalog([],regionalData.features.filter(f=>f.brazil===true),now)
     .map(row=>({...row.feature,tvId:row.id,aliases:row.aliases}));
    const result=historySnapshot(merged,view,now);
    result.sources={...result.sources,earthquake:true,catalogs};
    try{await cache?.put(key,new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=60'}}));}catch{}
    return result;
   }
   const start=summary?new Date(periodStart).toISOString():new Date(now-72*3600000).toISOString();
   const url=new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
   for(const [k,v] of Object.entries({format:'geojson',eventtype:'earthquake',minmagnitude:summary?(expanded?'0.1':'2.5'):'6',starttime:start,endtime:new Date(complete?end-1:now).toISOString(),orderby:summary?'magnitude':'time',limit:summary?'5':'1'}))url.searchParams.set(k,v);
   const r=await fetcher(url,{signal:controller.signal});if(!r.ok)throw Error('USGS unavailable');
   const data=await r.json();if(!Array.isArray(data.features))throw Error('Invalid catalog');
   const [brazil,extra]=await Promise.all([expanded?regional(env).catch(()=>({features:[],catalogs:{USP:false,USGS_BR:false,EMSC:false,GEOFON:false}})):Promise.resolve({features:[]}),expanded?supplemental({start,end:new Date(complete?end-1:now).toISOString(),scope:'history:'+view+':'+day,summary:true}).catch(()=>({sources:[]})):Promise.resolve({sources:[]})]);
   const additional=brazil.features.filter(f=>f.brazil);additional.push(...extra.sources.flatMap(s=>s.ok?s.events.map(globalFeature):[]));const merged=mergeTvCatalog([],[...data.features,...additional],now).map(r=>({...r.feature,tvId:r.id,aliases:r.aliases}));const result=historySnapshot(merged,view,now);if(brazil.catalogs)result.sources.catalogs={...brazil.catalogs,USGS:true,...Object.fromEntries(extra.sources.map(s=>[s.provider+'_GLOBAL',s.ok]))};
   try{await cache?.put(key,new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age='+ttl/1000}}));}catch{}
   return result;
   }finally{clearTimeout(timer);}
  })().finally(()=>pending.delete(key.url)));
  try{snapshot=await pending.get(key.url);}catch{return new Response(JSON.stringify({error:'Histórico indisponível; tente novamente.'}),{status:503,headers:{...headers,'Cache-Control':'no-store'}});}
 }
 return new Response(request.method==='HEAD'?null:JSON.stringify(snapshot),{headers});
}
