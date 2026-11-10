import {tvSnapshot} from './tv-snapshot.mjs';
export {tvSnapshot} from './tv-snapshot.mjs';
import {handleTvHistory} from './tv-history.mjs';
import {enrichTvSnapshot} from './tv-context.mjs';
import {collectTvQuakes} from './tv-seismic-catalog.mjs';
import {getOfficialTsunamis} from '../tsunami-official-worker.mjs';
const VERSION='tv-alerts-v1';let last,inflight,lastTags;
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
async function collect(env){const now=Date.now();const [q,t]=await Promise.allSettled([collectTvQuakes(env),getOfficialTsunamis()]);const quakes=q.status==='fulfilled'?q.value:{ok:false,features:[],catalogs:{USGS:false,USP:false,EMSC:false,GEOFON:false}};const snapshot=tvSnapshot(quakes,t.status==='fulfilled'?t.value:{ok:false,items:[]},now,{maxAge:72*3600000});try{return await enrichTvSnapshot(snapshot,quakes.features,env);}catch{return snapshot;}}
// Preserve the existing JSON and ETag contract; compute both variants only on refresh.
function project(snapshot,expanded){
 if(expanded)return {...snapshot,policy:'telegram-v1'};
 if(!snapshot.sources.catalogs)return snapshot;
 return {...snapshot,sources:{earthquake:snapshot.sources.catalogs.USGS,tsunami:snapshot.sources.tsunami},alerts:snapshot.alerts.filter(a=>a.kind!=='earthquake'||a.provider==='USGS'&&a.magnitude>=5.5)};
}
async function etags(snapshot,expanded){
 const variant=project(snapshot,expanded);
 const tag='"'+await hash(JSON.stringify([variant.sources,variant.alerts]))+'"';
 return {serverTime:snapshot.serverTime,[expanded?'expanded':'legacy']:tag};
}
export async function handleTvAlerts(request,{read,env,now=Date.now(),cache=globalThis.caches?.default}={}){
 const params=new URL(request.url).searchParams,view=params.get('view'),expanded=params.get('policy')==='telegram-v1';
 if(view==='daily'||view==='replay'||view==='global-replay'||view==='completed'||view==='brazil')return handleTvHistory(request,{view,now,cache,env});
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'ETag','Content-Type':'application/json','Cache-Control':'public, max-age=20','X-Monitor-TV':VERSION};
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 const key=new Request('https://black-sky-9ba0.terrestre.workers.dev/__tv-alerts-v4');let snapshot,cachedTags;
 try{
  const hit=await cache?.match(key);
  if(hit){
   const timestamp=Number(hit.headers.get('X-Monitor-TV-Server-Time'));
   const cachedTag=hit.headers.get(expanded?'X-Monitor-TV-ETag-Expanded':'X-Monitor-TV-ETag-Legacy');
   // A conditional cache hit now skips JSON parsing, projection and SHA-256.
   if(timestamp>0&&now-timestamp<=30000&&cachedTag&&request.headers.get('If-None-Match')===cachedTag){
    return new Response(null,{status:304,headers:{...headers,ETag:cachedTag}});
   }
   snapshot=await hit.json();
   if(timestamp===snapshot.serverTime&&cachedTag)cachedTags={serverTime:timestamp,[expanded?'expanded':'legacy']:cachedTag};
  }
 }catch{}
 if(!snapshot||now-snapshot.serverTime>30000){
  if(last&&now-last.serverTime<30000){snapshot=last;cachedTags=lastTags;}
  else{
   if(!inflight)inflight=(async()=>{const next=await (read?read():collect(env));const tags=await etags(next,expanded);last=next;lastTags=tags;
    try{await cache?.put(key,new Response(JSON.stringify(next),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=25','X-Monitor-TV-Server-Time':String(next.serverTime),...(tags.legacy?{'X-Monitor-TV-ETag-Legacy':tags.legacy}:{}),...(tags.expanded?{'X-Monitor-TV-ETag-Expanded':tags.expanded}:{})}}));}catch{}
    return next;
   })().finally(()=>inflight=null);
   snapshot=await inflight;cachedTags=lastTags;
  }
 }
 const projected=project(snapshot,expanded);
 let etag=cachedTags?.[expanded?'expanded':'legacy'];
 if(!etag||cachedTags.serverTime!==snapshot.serverTime)etag=lastTags?.serverTime===snapshot.serverTime?lastTags[expanded?'expanded':'legacy']:null;
 if(!etag){etag='"'+await hash(JSON.stringify([projected.sources,projected.alerts]))+'"';if(lastTags?.serverTime===snapshot.serverTime)lastTags[expanded?'expanded':'legacy']=etag;}
 headers.ETag=etag;
 if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers});
 return new Response(request.method==='HEAD'?null:JSON.stringify(projected),{headers});
}
