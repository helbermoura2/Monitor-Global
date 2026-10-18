import {sourceEdgeResponse} from './source-edge-cache.mjs';
// Public feed snapshots only. No KV, user credentials, admin actions or paid products.
import {activity} from './kv-operation-metrics.mjs';
const VERSION='shared-sources-v1',MAX_BODY=3*1024*1024,MAX_TOTAL=12*1024*1024,MAX_ENTRIES=16,CHUNK=60000;
const routes={
 '/sp-clima':[300,900],'/global-feeds':[120,300],'/global-volcano':[120,600],'/usgs-volcano':[120,600],'/gdacs-volcano':[120,600],'/gdacs-floods':[120,300],
 '/afad-earthquakes':[30,120],'/ingv-earthquakes':[30,120],'/jma-earthquakes':[30,120],'/funvisis-earthquakes':[30,120],'/seismic-status':[120,300],
 '/official-weather-alerts':[60,180],'/cge-bulletins':[60,180],'/metar-observed':[120,300],'/tsunami-alerts':[10,60],'/v70-cyclones':[120,600]
};
const hosts=new Set(['sws.cemaden.gov.br','www.gdacs.org','earthquake.usgs.gov','volcanoes.usgs.gov','www.jma.go.jp','www.data.jma.go.jp','geofon.gfz-potsdam.de','webservices.ingv.it','www.isc.ac.uk','www.seismicportal.eu','www.osc.org.bo','www.ovsicori.una.ac.cr','www.snet.gob.sv','ide.igp.gob.pe','data.bmkg.go.id','api.geonet.org.nz','moho.iag.usp.br','api.orhanaydogdu.com.tr','deprem-api.vercel.app','sismosve.rafnixg.dev','api.gael.cloud','www.ssn.unam.mx','www.nhc.noaa.gov','www.tsunami.gov','api.weather.gov','apiprevmet3.inmet.gov.br','eonet.gsfc.nasa.gov','www.cgesp.org','feeds.meteoalarm.org','api.open-meteo.com','flood-api.open-meteo.com','air-quality-api.open-meteo.com','servicos.cptec.inpe.br']);
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'X-Monitor-Source, X-Monitor-Source-State, X-Monitor-Source-Last-Ok, X-Monitor-Source-Attempt, X-Monitor-Source-Next-Retry, Retry-After','Cache-Control':'no-store'};
const hash=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',text instanceof Uint8Array?text:new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
export function sourcePolicy(request,allowed=[...hosts],now=Date.now()){
 if(request.method!=='GET')return null;const u=new URL(request.url);if(u.href.length>5000)return null;
 let target=null,group,ttl,stale;
 if(routes[u.pathname]){
  [ttl,stale]=routes[u.pathname];group=u.pathname;
  if(u.pathname==='/official-weather-alerts'){const provider=u.searchParams.get('provider');if(!['eccc','bom'].includes(provider))return null;group+=':'+provider;}
  if(u.pathname==='/metar-observed'&&u.searchParams.has('ids')){const ids=u.searchParams.get('ids').toUpperCase().split(',');if(ids.length>60||ids.some(x=>!/^[A-Z][A-Z0-9]{3}$/.test(x)))return null;u.searchParams.set('ids',[...new Set(ids)].sort().join(','));}
  if(['/sp-clima','/global-feeds','/global-volcano','/usgs-volcano','/gdacs-volcano','/gdacs-floods','/jma-earthquakes','/tsunami-alerts','/v70-cyclones','/seismic-status','/cge-bulletins'].includes(u.pathname))u.search='';
 }else if(u.pathname==='/'&&u.searchParams.has('url')){
  try{target=new URL(u.searchParams.get('url'));}catch{return null;}
  if(target.protocol!=='https:'||target.username||target.password||target.port||!hosts.has(target.hostname)||!allowed.includes(target.hostname))return null;
  // Images and event products have separate enrichment caches and must not share feed state.
  if(/\.(?:png|jpg|jpeg|zip|pdf|kmz|bin)$/i.test(target.pathname)||/\/product\//.test(target.pathname))return null;
  group=target.hostname;ttl=30;stale=120;
  if(group==='earthquake.usgs.gov'&&target.pathname.includes('/earthquakes/feed/'))ttl=15;
  if(/(?:weather|gdacs|nhc|eonet|cgesp|inmet|cemaden|meteoalarm)/.test(group)){ttl=60;stale=180;}
  if(group.endsWith('open-meteo.com')||group==='servicos.cptec.inpe.br'){ttl=120;stale=600;}
  if(group==='www.tsunami.gov'){ttl=10;stale=60;}
  if(group==='volcanoes.usgs.gov'){ttl=120;stale=600;}
 }else return null;
 const keyUrl=target||u;
 if([...keyUrl.searchParams.keys()].some(k=>/key|token|auth|password|signature/i.test(k)))return null;
 keyUrl.hash='';
 for(const k of ['_','_t','cachebuster'])keyUrl.searchParams.delete(k);
 for(const key of ['starttime','endtime']){
  const raw=keyUrl.searchParams.get(key),at=raw&&Date.parse(/Z$|[+-]\d\d:\d\d$/.test(raw)?raw:raw+'Z');
  const minutes=Math.round((at-now)/60000);
  // Only near-exact rolling minute windows coalesce; fixed dates and filter values remain distinct.
  if(Number.isFinite(at)&&Math.abs(at-now-minutes*60000)<10000&&minutes>=-10080&&minutes<=5)keyUrl.searchParams.set(key,'rolling-minute:'+minutes);
 }
 keyUrl.searchParams.sort();return {group,ttl:ttl*1000,stale:stale*1000,key:(target?'proxy:':'route:')+keyUrl.pathname+'?'+keyUrl.searchParams.toString()};
}
export function sourceGroups(allowed=[...hosts]){return [...new Set([...Object.keys(routes).filter(p=>p!=='/official-weather-alerts'),'/official-weather-alerts:eccc','/official-weather-alerts:bom',...[...hosts].filter(h=>allowed.includes(h))])].sort();}
async function alarm(storage,at){const old=await storage.getAlarm?.();await storage.setAlarm?.(old&&old>Date.now()?Math.min(old,at):at);}
async function remove(storage,item){for(let i=0;i<item.parts;i++)await storage.delete('source-body:'+item.key+':'+i);}
export async function pruneSources(storage,now=Date.now()){
 const index=await storage.get('source-index');if(!index)return;const keep=[];
 for(const item of index){if(item.until<=now)await remove(storage,item);else keep.push(item);}
 if(keep.length!==index.length)await storage.put('source-index',keep);
 if(keep.length)await alarm(storage,Math.min(...keep.map(x=>x.until))+1000);
}
function response(entry,bytes,circuit,state,now){
 const h={...headers,...entry.headers,'X-Monitor-Source':entry.group,'X-Monitor-Source-State':state,'X-Monitor-Source-Last-Ok':String(entry.at),'X-Monitor-Source-Attempt':String(circuit?.attempt||entry.at),'X-Monitor-Source-Next-Retry':String(circuit?.next||entry.at+entry.ttl)};
 if(state==='stale'){h.Warning='110 - "Response is stale"';h['Retry-After']=String(Math.max(1,Math.ceil(((circuit?.next||now+30000)-now)/1000)));}
 return new Response(entry.status===204?null:bytes,{status:entry.status,headers:h});
}
async function readBytes(storage,entry){
 const chunks=await Promise.all(Array.from({length:entry.parts},(_,i)=>storage.get('source-body:'+entry.key+':'+i)));
 if(chunks.some((x,i)=>!(x instanceof Uint8Array)||x.length!==Math.min(CHUNK,entry.bytes-i*CHUNK)))return null;
 const bytes=new Uint8Array(entry.bytes);chunks.forEach((x,i)=>bytes.set(x,i*CHUNK));return bytes;
}
export async function handleSourceInObject(request,env,storage,compute,allowed,now=Date.now()){
 const received=Number(request.headers.get('X-Monitor-Request-At'));
 const identityAt=received>now-300000&&received<=now+1000?received:now;
 const policy=sourcePolicy(request,allowed,identityAt);if(!policy)return Response.json({error:'Source not eligible'},{status:400});activity(env,'sourceRequests');
 const key=await hash(policy.key),index=await storage.get('source-index')||[],entry=index.find(x=>x.key===key),circuit=await storage.get('source-circuit')||{};
 const body=entry&&entry.until>now?await readBytes(storage,entry):null;
 if(body&&now-entry.at<Math.min(policy.ttl,entry.ttl)){activity(env,'sourceCacheHits');return response(entry,body,circuit,entry.partial?'partial':'fresh',now);}
 async function failed(status,retryAfter=0){
  activity(env,'sourceFailures');const failures=Math.min((circuit.failures||0)+1,20),wait=Math.min(300000,30000*2**Math.min(failures-1,4));
  Object.assign(circuit,{group:policy.group,attempt:now,next:now+Math.max(wait,Math.min(3600000,retryAfter)),failures,lastStatus:status});await storage.put('source-circuit',circuit);activity(env,'sourceStateWrites');return retained();
 }
 function retained(){
  if(body&&now-entry.at<policy.stale){activity(env,'sourceRetained');return response(entry,body,circuit,'stale',now);}
  return Response.json({error:'Fonte temporariamente indisponível',retryAt:circuit.next||now+30000},{status:503,headers:{...headers,'X-Monitor-Source':policy.group,'X-Monitor-Source-State':'unavailable','Retry-After':String(Math.max(1,Math.ceil(((circuit.next||now+30000)-now)/1000)))}});
 }
 if(circuit.next>now)return retained();
 let upstream,bytes,partial=false;
 try{
  activity(env,'sourceFetches');upstream=await compute();
  if(!upstream.ok){if(upstream.status>=400&&upstream.status<500&&upstream.status!==429)return upstream;const raw=upstream.headers.get('Retry-After'),seconds=Number(raw);const delay=raw?(Number.isFinite(seconds)?seconds*1000:Math.max(0,Date.parse(raw)-now)):0;return failed(upstream.status,Number.isFinite(delay)?delay:0);}
  const length=Number(upstream.headers.get('Content-Length'));if(length>MAX_BODY)return failed(502);
  // Bound reading before allocating/persisting an unexpectedly large provider response.
  const reader=upstream.body?.getReader(),chunks=[];let total=0;
  if(reader){for(;;){const item=await reader.read();if(item.done)break;total+=item.value.byteLength;if(total>MAX_BODY){await reader.cancel();return failed(502);}chunks.push(item.value);}}
  bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  if(!bytes.length&&upstream.status!==204)return failed(502);
  const text=new TextDecoder().decode(bytes),trim=text.trim();
  const rawTarget=new URL(request.url).searchParams.get('url');
  if(rawTarget){const target=new URL(rawTarget),html=/^(?:<!doctype\s+html|<html)/i.test(trim);if(html&&!['www.osc.org.bo','www.ssn.unam.mx','www.cgesp.org','www.ovsicori.una.ac.cr','www.snet.gob.sv'].includes(target.hostname))return failed(502);if(/\.xml$/i.test(target.pathname)&&!trim.startsWith('<'))return failed(502);}
  if(trim.startsWith('{')||trim.startsWith('[')){
   const data=JSON.parse(text);
   const target=new URL(request.url).searchParams.get('url')||'';
   if(/(?:fdsnws\/event.*(?:format=geojson|format=json)|earthquake\.usgs\.gov\/earthquakes\/feed)/.test(target)&&!Array.isArray(data?.features))return failed(502);
   if(data&&typeof data==='object'&&(data.error||data.ok===false))return failed(502);
   const values=Object.values(data?.fontes||{});
   if(values.length&&values.every(x=>x===false))return failed(502);
   partial=data?.partial===true||values.some(x=>x===false)||Array.isArray(data?.fontes)&&data.fontes.some(x=>x.online===false)||Array.isArray(data?.sources)&&data.sources.some(x=>x.ok===false||x.online===false);
   if(Array.isArray(data?.fontes)&&data.fontes.length&&data.fontes.every(x=>x.online===false))return failed(502);
   if(policy.group!=='/seismic-status'&&Array.isArray(data?.sources)&&data.sources.length&&data.sources.every(x=>x.ok===false||x.online===false))return failed(502);
  }
 }catch{return failed(502);}
 const ttl=partial?Math.min(policy.ttl,30000):policy.ttl;
 const contentHash=await hash(bytes),reuse=!!body&&entry?.contentHash===contentHash;
 const fresh={key,contentHash,group:policy.group,at:now,ttl,until:now+policy.stale,parts:Math.max(1,Math.ceil(bytes.length/CHUNK)),bytes:bytes.length,status:upstream.status,partial,headers:{'Content-Type':upstream.headers.get('Content-Type')||'application/json'}};
 const keep=index.filter(x=>x.key!==key&&x.until>now);while(keep.length>=MAX_ENTRIES||keep.reduce((n,x)=>n+x.bytes,0)+bytes.length>MAX_TOTAL)keep.shift();
 const write=async tx=>{if(!reuse)for(let i=0;i<fresh.parts;i++)await tx.put('source-body:'+key+':'+i,bytes.slice(i*CHUNK,(i+1)*CHUNK));await tx.put('source-index',[...keep,fresh]);await tx.put('source-circuit',{group:policy.group,attempt:now,lastOk:now,next:0,failures:0,lastStatus:upstream.status});};
 if(storage.transaction)await storage.transaction(write);else await write(storage);
 activity(env,'sourceStateWrites');activity(env,'sourceStateWrites');if(!reuse)for(let i=0;i<fresh.parts;i++)activity(env,'sourceBodyWrites');
 for(const old of index)if(old.key!==key&&!keep.some(x=>x.key===old.key))await remove(storage,old);
 if(entry)for(let i=fresh.parts;i<entry.parts;i++)await storage.delete('source-body:'+key+':'+i);
 await alarm(storage,Math.min(...[...keep,fresh].map(x=>x.until))+1000);
 return response(fresh,bytes,{attempt:now,next:now+ttl},partial?'partial':'fresh',now);
}
export async function sourceObjectHealth(storage){
 const state=await storage.get('source-circuit'),index=await storage.get('source-index')||[],now=Date.now();
 return {...state,version:VERSION,entries:index.filter(x=>x.until>now).length,bytes:index.filter(x=>x.until>now).reduce((n,x)=>n+x.bytes,0),state:state?.failures?'retrying':index.some(x=>now-x.at<x.ttl)?(index.some(x=>now-x.at<x.ttl&&x.partial)?'partial':'fresh'):state?.lastOk?'stale':'waiting'};
}
export async function sharedSourceResponse(request,env,compute,allowed){
 const policy=sourcePolicy(request,allowed);if(!policy||env.SHARED_SOURCE_INTERNAL||!env.EARTHQUAKE_ALERTS)return compute();
 const binding=env.EARTHQUAKE_ALERTS,key=policy.group+'|'+policy.key;
 // One canonical internal key also shares snapshots across public aliases.
 const edgeKey=new Request('https://black-sky-9ba0.terrestre.workers.dev/__shared-source-cache/v2/'+await hash(key));
 const unavailable=()=>Response.json({error:'Coleta compartilhada temporariamente indisponível'},{status:503,headers:{...headers,'X-Monitor-Source-State':'unavailable','Retry-After':'30'}});
 try{return await sourceEdgeResponse(binding,key,policy,edgeKey,async()=>{try{return await binding.get(binding.idFromName('shared-source-v1:'+policy.group)).fetch(new Request(request.url,{headers:{'X-Monitor-Request-At':String(Date.now())}}));}catch{return unavailable();}});}
 catch{return unavailable();}
}
