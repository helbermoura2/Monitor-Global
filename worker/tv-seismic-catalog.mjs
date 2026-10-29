// TV uses the same Brazilian parsers, boundary and solution selection as Telegram.
// Shared snapshots + a bounded watch list; KV changes only when that list changes.
// No Telegram delivery or new Durable Object calls.
import {fetchTelegramBrazilRecent} from './telegram-seismic-data.mjs';
import {telegramSolutionMayReplace,telegramSolutionPriority} from './seismic-solution-policy.mjs';
import {fetchGlobalSupplements,chooseGlobalSolution} from './global-seismic-data.mjs';
import {telegramIsBrazil} from './brazil-boundary.mjs';
const WATCH_KEY='tv-seismic-watch-v1';
const HOURS72=72*3600000,KEY='https://black-sky-9ba0.terrestre.workers.dev/__tv-seismic-watch-v2';
const event=f=>({id:f.id,provider:f.provider||'USGS',source:f.properties?.net||f.provider||'USGS',reviewed:f.properties?.status==='reviewed',providerEventId:f.providerEventId,globalMultiSource:f.globalMultiSource,sourceUpdatedAt:f.sourceUpdatedAt||f.observedRevisionAt||f.properties?.updated,mag:f.properties?.mag,lat:f.geometry?.coordinates?.[1],lon:f.geometry?.coordinates?.[0],timeIso:new Date(f.properties.time).toISOString()});
const distance=(a,b)=>{const r=Math.PI/180,x=Math.sin((a.lat-b.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((a.lon-b.lon)*r/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,x)));};
const valid=(f,now)=>f?.id&&Number.isFinite(f.properties?.mag)&&f.properties.mag<=10&&Number.isFinite(f.properties?.time)&&f.properties.time<=now+300000&&now-f.properties.time<=HOURS72&&Array.isArray(f.geometry?.coordinates)&&Number.isFinite(f.geometry.coordinates[0])&&Math.abs(f.geometry.coordinates[0])<=180&&Number.isFinite(f.geometry.coordinates[1])&&Math.abs(f.geometry.coordinates[1])<=90&&(!f.properties.type||f.properties.type==='earthquake');
export function brazilFeature(e,now){return {id:e.id,provider:e.provider,brazil:true,properties:{mag:e.mag,time:Date.parse(e.timeIso),updated:now,type:'earthquake',place:e.place,net:e.source,status:e.reviewed?'reviewed':'automatic'},geometry:{coordinates:[e.lon,e.lat,e.depth]}};}
export function globalFeature(e){return {id:e.id,provider:e.provider,providerEventId:e.providerEventId,globalMultiSource:true,collectedAt:e.collectedAt,sourceUpdatedAt:e.sourceUpdatedAt,observedRevisionAt:e.observedRevisionAt,brazil:false,properties:{mag:e.mag,time:Date.parse(e.timeIso),updated:e.sourceUpdatedAt||Date.parse(e.timeIso),type:'earthquake',place:e.place,net:e.source,status:e.reviewStatus==='unknown'?'unknown':e.reviewed?'reviewed':'automatic'},geometry:{coordinates:[e.lon,e.lat,e.depth]}};}
export function mergeTvCatalog(previous,incoming,now){
 const records=previous.filter(r=>valid(r.feature,now)).map(r=>({...r,aliases:[...r.aliases],providers:[...r.providers],versions:{...(r.versions||{})},networks:[...(r.networks||[event(r.feature).source])],solutions:{...(r.solutions||(!r.feature.brazil?{[(r.feature.provider||'USGS')+':'+r.feature.id]:r.feature}:{}))}}));
 for(const f of incoming.filter(f=>valid(f,now)).sort((a,b)=>telegramSolutionPriority(event(b))-telegramSolutionPriority(event(a)))){
  f.id=String(f.id).slice(0,180);const p=f.properties;f.properties={mag:p.mag,time:p.time,updated:p.updated,type:p.type,place:String(p.place||'Local não informado').slice(0,500),net:String(p.net||f.provider||'USGS').toUpperCase().slice(0,30),status:p.status};
  const raw=(f.provider||'USGS')+':'+f.id,ev=event(f);f.brazil=telegramIsBrazil(ev.lat,ev.lon);
  let row=records.find(r=>r.aliases.includes(raw));
  if(!row){const matches=records.filter(r=>{const before=event(r.feature),small=f.brazil||r.feature.brazil;return (!r.providers.includes(ev.provider)||ev.provider==='USGS')&&!r.networks.includes(ev.source)&&Math.abs(Date.parse(before.timeIso)-Date.parse(ev.timeIso))<=30000&&Math.abs(before.mag-ev.mag)<=(small?.6:1)&&distance(before,ev)<=(small?20:50);});if(matches.length===1)row=matches[0];}
  const version=JSON.stringify([f.properties.mag,f.geometry.coordinates,f.properties.time,f.properties.net,f.properties.status,f.properties.place]);
  if(!row){records.push({id:raw,aliases:[raw],providers:[ev.provider],versions:{[raw]:version},networks:[ev.source],solutions:f.brazil?{}:{[raw]:f},feature:f});continue;}
  if(!f.brazil){const previous=row.solutions[raw];if(previous&&f.collectedAt>0&&previous.collectedAt>0&&f.collectedAt<previous.collectedAt)continue;if(previous&&row.versions[raw]!==version&&f.globalMultiSource&&!f.sourceUpdatedAt&&!f.observedRevisionAt)f.observedRevisionAt=now;if(previous&&!telegramSolutionMayReplace(event(previous),event(f)))continue;if(row.versions[raw]!==version)row.solutions[raw]=f;}
  if(row.versions[raw]===version)continue;row.versions[raw]=version;
  if(!row.aliases.includes(raw))row.aliases.push(raw);if(!row.providers.includes(ev.provider))row.providers.push(ev.provider);if(!row.networks.includes(ev.source))row.networks.push(ev.source);
  // Prevent lower-priority rapid solutions or an older revision flipping the display back.
  if(telegramSolutionMayReplace(event(row.feature),ev))row.feature=f;
 }
 for(const row of records)if(!row.feature.brazil&&Object.keys(row.solutions||{}).length){const candidates=Object.values(row.solutions).filter(f=>valid(f,now)).map(f=>({...event(f),feature:f}));if(candidates.length)row.feature=chooseGlobalSolution(candidates).feature;const selected=(row.feature.provider||'USGS')+':'+row.feature.id;row.solutions=Object.fromEntries(Object.entries(row.solutions).sort(([a],[b])=>Number(b===selected)-Number(a===selected)).slice(0,4));}
 return records.sort((a,b)=>b.feature.properties.time-a.feature.properties.time).slice(0,120).map(r=>({...r,aliases:r.aliases.slice(0,12),providers:r.providers.slice(0,4),networks:r.networks.slice(0,12),versions:Object.fromEntries(r.aliases.slice(0,12).map(id=>[id,r.versions[id]]))}));
}
export function createTvCatalog({fetcher=fetch,brazil=fetchTelegramBrazilRecent,clock=Date.now,cache=()=>globalThis.caches?.default,supplemental=fetchGlobalSupplements}={}){
 let records=[],loaded=false,brazilResult,brazilAt=0,brazilJob,persisted="",lastWrite=0,snapshot,job;
 async function json(url,timeout=12000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const r=await fetcher(url,{signal:controller.signal});if(!r.ok)throw Error('USGS HTTP '+r.status);return await r.json();}finally{clearTimeout(timer);}}
 async function brazilRead(now){if(brazilResult&&now-brazilAt<120000)return brazilResult;if(!brazilJob)brazilJob=brazil(null,{start:new Date(now-HOURS72).toISOString(),end:new Date(now+300000).toISOString(),summary:true}).then(value=>{brazilResult=value;brazilAt=now;return value;}).finally(()=>brazilJob=null);return brazilJob;}
 async function run(env){
  const now=clock();
  if(!loaded){
   loaded=true;
   try{
    const hit=await cache()?.match(new Request(KEY));
    if(hit){const data=await hit.json();if(Array.isArray(data))records=data.filter(r=>Array.isArray(r.aliases)&&Array.isArray(r.providers)&&valid(r.feature,now)).slice(0,120);}
   }catch{}
   if(env?.TTS_USAGE)try{
    const raw=await env.TTS_USAGE.get(WATCH_KEY);
    if(raw&&raw.length<=240000){
     const data=JSON.parse(raw);
     if(Array.isArray(data)){
      if(!records.length)records=data.filter(r=>Array.isArray(r.aliases)&&Array.isArray(r.providers)&&valid(r.feature,now)).slice(0,120);
      persisted=JSON.stringify(data);
     }
    }
   }catch{}
  }
  const [global,regional,extra]=await Promise.allSettled([json('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=5&limit=100&orderby=time&starttime='+encodeURIComponent(new Date(now-6*3600000).toISOString())).then(d=>{if(!Array.isArray(d.features))throw Error('Invalid USGS catalog');return d.features;}),brazilRead(now),supplemental({tracked:records.filter(r=>r.tracked||r.feature.properties.mag>=6).flatMap(r=>Object.values(r.solutions||{one:r.feature}).map(event))})]);
  const incoming=global.status==='fulfilled'?global.value:[],catalogs={USGS:global.status==='fulfilled',USGS_BR:false,USP:false,EMSC:false,GEOFON:false,EMSC_GLOBAL:false,GEOFON_GLOBAL:false};
  if(regional.status==='fulfilled')for(const source of regional.value.sources){if(source.provider==='USGS')catalogs.USGS_BR=true;else catalogs[source.provider]=true;incoming.push(...source.events.filter(e=>!incoming.some(f=>(f.provider||'USGS')===source.provider&&String(f.id)===String(e.id))).map(e=>brazilFeature(e,now)));}
  if(extra.status==='fulfilled')for(const source of extra.value.sources){catalogs[source.provider+'_GLOBAL']=source.ok;incoming.push(...source.events.map(globalFeature));}
  // Follow already observed M6+ USGS IDs even after M5.5 or a six-hour catalogue window.
  const missing=records.filter(r=>r.aliases.some(id=>id.startsWith('USGS:'))&&(r.feature.properties.mag>=6||r.tracked)&&now-r.feature.properties.time<=HOURS72&&!incoming.some(f=>r.aliases.includes((f.provider||'USGS')+':'+f.id))).slice(0,24);
  await Promise.all(missing.map(async r=>{const id=r.aliases.find(id=>id.startsWith('USGS:')).slice(5);try{const d=await json('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid='+encodeURIComponent(id),8000);if(valid(d,now))incoming.push(d);}catch{}}));
  records=mergeTvCatalog(records,incoming,now).map(r=>({...r,tracked:r.tracked||r.feature.properties.mag>=6||r.feature.brazil}));
  const serialized=JSON.stringify(records);
  if(serialized!==persisted&&serialized.length<=240000&&env?.TTS_USAGE&&now-lastWrite>=60000)try{await env.TTS_USAGE.put(WATCH_KEY,serialized,{expirationTtl:259200});persisted=serialized;lastWrite=now;}catch{}
  try{await cache()?.put(new Request(KEY),new Response(serialized,{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=259200'}}));}catch{}
  const observed=new Set(incoming.map(f=>(f.provider||'USGS')+':'+f.id));
  const features=records.filter(r=>r.aliases.some(id=>observed.has(id))).map(r=>({...r.feature,tvId:r.id,aliases:r.aliases,tracked:r.tracked}));
  return {features,ok:Object.values(catalogs).some(Boolean),catalogs,failedSources:Object.keys(catalogs).filter(k=>!catalogs[k])};
 }
 return async function collect(env){if(snapshot&&clock()-snapshot.at<30000)return snapshot.value;if(!job)job=run(env).then(value=>{snapshot={at:clock(),value};return value;}).finally(()=>job=null);return job;};
}
export const collectTvQuakes=createTvCatalog();
