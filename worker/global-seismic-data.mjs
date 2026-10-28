// Shared supplemental global catalogs. No KV, Durable Objects or delivery calls.
import {readBoundedText} from './http.mjs';
import {telegramIsBrazil} from './brazil-boundary.mjs';
import {telegramSolutionPriority} from './seismic-solution-policy.mjs';
export const GLOBAL_SEISMIC_POLICY='global-usgs-emsc-geofon-v1';
export const GLOBAL_PROVIDERS=['EMSC','GEOFON'];
const ENDPOINTS={EMSC:'https://www.seismicportal.eu/fdsnws/event/1/query',GEOFON:'https://geofon.gfz-potsdam.de/fdsnws/event/1/query'};
const H72=72*3600000;
const epoch=value=>typeof value==='number'?value:Date.parse(/(?:Z|[+-]\d\d:\d\d)$/i.test(value||'')?value:(value||'')+'Z');
export function globalEvents(data,provider,now=Date.now()){
 if(provider==='GEOFON'&&!String(data).trim().startsWith('#EventID'))throw Error('Invalid GEOFON catalog');
 if(provider==='EMSC'&&!Array.isArray(data?.features)&&data?.type!=='Feature')throw Error('Invalid EMSC catalog');
 const rows=typeof data==='string'?data.split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith('#')).map(l=>{const c=l.split('|');return {id:c[0],time:c[1],lat:c[2],lon:c[3],depth:c[4],mag:c[10],place:c[12],type:c[13]};}):(data?.features||(data?.type==='Feature'?[data]:[])).map(f=>{const p=f.properties||{},c=f.geometry?.coordinates||[];return {id:f.id,queryId:p.source_id||f.id,time:p.time,lat:c[1],lon:c[0],depth:p.depth??c[2],mag:p.mag,place:p.place||p.flynn_region,type:p.type||({ke:'earthquake',se:'earthquake'}[p.evtype]||p.evtype),updated:p.updated||p.lastupdate,reviewed:p.status==='reviewed',reviewStatus:p.status||'unknown'};});
 if(rows.length>=100)throw Error('Supplemental catalog potentially truncated');
 return rows.flatMap(r=>{
  if([r.mag,r.lat,r.lon].some(v=>v==null||String(v).trim()===''))return [];
  const mag=Number(r.mag),lat=Number(r.lat),lon=Number(r.lon),time=epoch(r.time);
  if(![mag,lat,lon,time].every(Number.isFinite)||mag<0||mag>10||Math.abs(lat)>90||Math.abs(lon)>180||time>now+300000||now-time>H72||telegramIsBrazil(lat,lon)||r.type&&String(r.type).trim().toLowerCase()!=='earthquake'||!r.id)return [];
  const depth=r.depth!=null&&String(r.depth).trim()!==''&&Number.isFinite(Number(r.depth))?Math.abs(Number(r.depth)):null,updated=epoch(r.updated);
  return [{id:provider+'-'+String(r.id).slice(0,180),provider,providerEventId:String(r.queryId||r.id).slice(0,180),globalMultiSource:true,brazil:false,mag,lat,lon,depth,timeIso:new Date(time).toISOString(),place:String(r.place||'Local não informado').slice(0,500),source:provider,reviewed:!!r.reviewed,reviewStatus:r.reviewStatus||'unknown',sourceUpdatedAt:Number.isFinite(updated)?updated:null,url:provider==='EMSC'?'https://www.emsc-csem.org/Earthquake/':'https://geofon.gfz-potsdam.de/eqinfo/event.php?id='+encodeURIComponent(r.id)}];
 });
}
const distance=(a,b)=>{const k=Math.PI/180,v=Math.sin((a.lat-b.lat)*k/2)**2+Math.cos(a.lat*k)*Math.cos(b.lat*k)*Math.sin((a.lon-b.lon)*k/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,v)));};
export const globalRank=e=>e.provider==='USGS'?100+telegramSolutionPriority(e):e.provider==='GEOFON'?20:e.provider==='EMSC'?10:0;
export function chooseGlobalSolution(events){const candidates=events.some(e=>e.provider==='USGS'&&telegramSolutionPriority(e)===2)?events.filter(e=>e.provider!=='USGS'||telegramSolutionPriority(e)===2):events;return candidates.slice().sort((a,b)=>Number(b.mag>=6)-Number(a.mag>=6)||globalRank(b)-globalRank(a)||(Number(b.sourceUpdatedAt)||0)-(Number(a.sourceUpdatedAt)||0)||String(a.id).localeCompare(String(b.id)))[0];}
export function consolidateGlobalEvents(events){
 const groups=[],byId=new Map(),buckets=new Map();
 for(const e of events.filter(e=>!e.brazil&&Number.isFinite(e.mag)&&Number.isFinite(Date.parse(e.timeIso))).sort((a,b)=>globalRank(b)-globalRank(a))){
  const key=e.provider+':'+e.id,bucket=Math.floor(Date.parse(e.timeIso)/30000),exact=byId.get(key);
  const nearby=[...new Set([-1,0,1].flatMap(delta=>[...buckets.get(bucket+delta)||[]]))];
  const candidates=exact?[exact]:nearby.filter(g=>!g.some(r=>r.provider===e.provider&&r.source===e.source)&&g.some(r=>Math.abs(Date.parse(r.timeIso)-Date.parse(e.timeIso))<=30000&&Math.abs(r.mag-e.mag)<=1&&distance(r,e)<=50));
  let group;if(candidates.length!==1){group=[e];groups.push(group);}else{group=candidates[0];const i=group.findIndex(r=>r.id===e.id&&r.provider===e.provider);if(i<0)group.push(e);else if((e.sourceUpdatedAt||0)>=(group[i].sourceUpdatedAt||0))group[i]=e;}
  byId.set(key,group);if(!buckets.has(bucket))buckets.set(bucket,new Set());buckets.get(bucket).add(group);
 }
 return groups.map(group=>{const selected=chooseGlobalSolution(group);return {...selected,globalMultiSource:true,agencyEstimates:group.map(e=>({id:e.id,provider:e.provider,providerEventId:e.providerEventId,mag:e.mag,timeIso:e.timeIso,source:e.source})),globalAliases:group.map(e=>e.provider+':'+e.id)};});
}
export function trackedGlobalEvents(records,now=Date.now()){
 const found=new Map();for(const record of records||[]){if(record.baseline)continue;const e=record.currentEvent||record;
  for(const item of [record,e,...e.agencyEstimates||[]])if(GLOBAL_PROVIDERS.includes(item.provider)&&item.id&&now-Date.parse(item.timeIso)<=H72)found.set(item.provider+':'+item.id,item);
 }return [...found.values()].sort((a,b)=>Date.parse(b.timeIso)-Date.parse(a.timeIso)).slice(0,24);
}
export function createGlobalSupplementCollector({fetcher=(...args)=>fetch(...args),clock=()=>Date.now(),cache=()=>globalThis.caches?.default,ttl=60000}={}){
 const memory=new Map(),jobs=new Map(),followCursor={};
 async function read(provider,scope,params){
  const now=clock(),key=provider+':'+scope,urlKey=new Request('https://black-sky-9ba0.terrestre.workers.dev/__global-seismic-v1/'+encodeURIComponent(key));
  let old=memory.get(key);if(!old)try{const hit=await cache()?.match(urlKey);if(hit){const d=await hit.json();if(Number.isFinite(d.at)&&Array.isArray(d.events)&&d.events.length<100&&(d.retryAt>now||now-d.at<6*3600000))old=d;}}catch{}
  if(old?.retryAt>now)return {provider,ok:false,events:old.events.slice()};
  if(old&&old.at>0&&now-old.at<ttl)return {provider,ok:true,events:old.events.slice()};
  if(!jobs.has(key))jobs.set(key,(async()=>{
   const url=new URL(ENDPOINTS[provider]);for(const [k,v]of Object.entries({format:provider==='GEOFON'?'text':'json',...params}))url.searchParams.set(k,v);
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),scope.startsWith('event:')?8000:12000);
   try{
    const response=await fetcher(url.href,{signal:controller.signal});if(!response.ok)throw Error('Supplemental source unavailable');
    const body=await readBoundedText(response,512000,12000);if(body.length>512000)throw Error('Supplemental response too large');
    const events=response.status===204?[]:globalEvents(provider==='GEOFON'?body:JSON.parse(body),provider,now).filter(e=>params.minmagnitude==null||e.mag>=Number(params.minmagnitude));
    for(const e of events){e.collectedAt=now;const previous=old?.events.find(r=>r.id===e.id);const version=r=>JSON.stringify([r.mag,r.depth,r.lat,r.lon,r.timeIso,r.reviewed,r.place]);e.observedRevisionAt=previous&&version(previous)!==version(e)?now:previous?.observedRevisionAt||null;}
    const entry={at:now,events};memory.set(key,entry);while(memory.size>64)memory.delete(memory.keys().next().value);
    try{await cache()?.put(urlKey,new Response(JSON.stringify(entry),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=21600'}}));}catch{}
    return {provider,ok:true,events:events.slice()};
   }catch{const entry={at:old?.at||0,events:old?.events||[],retryAt:now+ttl};memory.set(key,entry);while(memory.size>64)memory.delete(memory.keys().next().value);try{await cache()?.put(urlKey,new Response(JSON.stringify(entry),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=21600'}}));}catch{}return {provider,ok:false,events:entry.events.slice()};}
   finally{clearTimeout(timer);}
  })().finally(()=>jobs.delete(key)));
  return jobs.get(key);
 }
 return async function collect({tracked=[],start,end,scope='recent',summary=false}={}){
  const now=clock(),params={starttime:start||new Date(now-6*3600000).toISOString(),endtime:end||new Date(now+300000).toISOString(),minmagnitude:summary?6:5.5,limit:100,orderby:'time'};
  const sources=await Promise.all(GLOBAL_PROVIDERS.map(p=>read(p,scope,params)));
  if(!summary)await Promise.all(sources.filter(s=>s.ok).map(async source=>{
   const all=trackedGlobalEvents(tracked,now).filter(e=>e.provider===source.provider&&!source.events.some(r=>r.id===e.id));
   const offset=(followCursor[source.provider]||0)%Math.max(1,all.length),missing=Array.from({length:Math.min(3,all.length)},(_,i)=>all[(offset+i)%all.length]);followCursor[source.provider]=offset+missing.length;
   await Promise.all(missing.map(async e=>{const query=e.providerEventId||e.id.replace(new RegExp('^'+e.provider+'-'),'');if(!/^[a-zA-Z0-9_.:-]{1,180}$/.test(query))return;const value=await read(source.provider,'event:'+query,{eventid:query});if(value.ok)source.events.push(...value.events.filter(v=>!source.events.some(r=>r.id===v.id)));}));
  }));
  return {sources,failedSources:sources.filter(s=>!s.ok).map(s=>s.provider)};
 };
}
export const fetchGlobalSupplements=createGlobalSupplementCollector();
