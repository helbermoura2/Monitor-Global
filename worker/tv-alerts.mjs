import {tvSnapshot} from './tv-snapshot.mjs';
export {tvSnapshot} from './tv-snapshot.mjs';
import {handleTvHistory} from './tv-history.mjs';
import {enrichTvSnapshot} from './tv-context.mjs';
import {collectTvQuakes} from './tv-seismic-catalog.mjs';
import {getOfficialTsunamis} from '../tsunami-official-worker.mjs';
const VERSION='tv-alerts-v1';let last,inflight;
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
async function collect(env){const now=Date.now();const [q,t]=await Promise.allSettled([collectTvQuakes(env),getOfficialTsunamis()]);const quakes=q.status==='fulfilled'?q.value:{ok:false,features:[],catalogs:{USGS:false,USP:false,EMSC:false,GEOFON:false}};const snapshot=tvSnapshot(quakes,t.status==='fulfilled'?t.value:{ok:false,items:[]},now,{maxAge:72*3600000});try{return await enrichTvSnapshot(snapshot,quakes.features,env);}catch{return snapshot;}}
export async function handleTvAlerts(request,{read,env,now=Date.now(),cache=globalThis.caches?.default}={}){
 const params=new URL(request.url).searchParams,view=params.get('view'),expanded=params.get('policy')==='telegram-v1';
 if(view==='daily'||view==='replay'||view==='completed')return handleTvHistory(request,{view,now,cache,env});
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'ETag','Content-Type':'application/json','Cache-Control':'public, max-age=20','X-Monitor-TV':VERSION};
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 const key=new Request('https://black-sky-9ba0.terrestre.workers.dev/__tv-alerts-v4');let snapshot;
 try{const hit=await cache?.match(key);if(hit)snapshot=await hit.json();}catch{}
 if(!snapshot||now-snapshot.serverTime>30000){if(last&&now-last.serverTime<30000)snapshot=last;else{if(!inflight)inflight=(read?read():collect(env)).finally(()=>inflight=null);snapshot=await inflight;last=snapshot;try{await cache?.put(key,new Response(JSON.stringify(snapshot),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=25'}}));}catch{}}}
 if(expanded)snapshot={...snapshot,policy:'telegram-v1'};else if(snapshot.sources.catalogs)snapshot={...snapshot,sources:{earthquake:snapshot.sources.catalogs.USGS,tsunami:snapshot.sources.tsunami},alerts:snapshot.alerts.filter(a=>a.kind!=='earthquake'||a.provider==='USGS'&&a.magnitude>=5.5)};
 const etag='"'+await hash(JSON.stringify([snapshot.sources,snapshot.alerts]))+'"';headers.ETag=etag;
 if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers});
 return new Response(request.method==='HEAD'?null:JSON.stringify(snapshot),{headers});
}
