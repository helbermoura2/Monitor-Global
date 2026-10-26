import {tvSnapshot} from './tv-snapshot.mjs';
export {tvSnapshot} from './tv-snapshot.mjs';
import {handleTvHistory} from './tv-history.mjs';
import {enrichTvSnapshot} from './tv-context.mjs';
import {getOfficialTsunamis} from '../tsunami-official-worker.mjs';
const MAX_AGE=6*3600000,VERSION='tv-alerts-v1';let last,inflight;
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(n=>n.toString(16).padStart(2,'0')).join('');
async function collect(env){const now=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{const [q,t]=await Promise.allSettled([fetch('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=5.5&limit=100&orderby=time&starttime='+encodeURIComponent(new Date(now-MAX_AGE).toISOString()),{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('USGS');const data=await r.json();if(!Array.isArray(data.features))throw Error('Catalog');return data;}),getOfficialTsunamis()]);const features=q.status==='fulfilled'?q.value.features:[];return enrichTvSnapshot(tvSnapshot(q.status==='fulfilled'?q.value:{ok:false,features:[]},t.status==='fulfilled'?t.value:{ok:false,items:[]},now),features,env);}finally{clearTimeout(timer);}}
export async function handleTvAlerts(request,{read,env,now=Date.now(),cache=globalThis.caches?.default}={}){
 const view=new URL(request.url).searchParams.get('view');
 if(view==='daily'||view==='replay'||view==='completed')return handleTvHistory(request,{view,now,cache});
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'ETag','Content-Type':'application/json','Cache-Control':'public, max-age=20','X-Monitor-TV':VERSION};
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
 const key=new Request('https://black-sky-9ba0.terrestre.workers.dev/__tv-alerts-v1');let snapshot;
 try{const hit=await cache?.match(key);if(hit)snapshot=await hit.json();}catch{}
 if(!snapshot||now-snapshot.serverTime>30000){if(last&&now-last.serverTime<30000)snapshot=last;else{if(!inflight)inflight=(read?read():collect(env)).finally(()=>inflight=null);snapshot=await inflight;last=snapshot;try{await cache?.put(key,new Response(JSON.stringify(snapshot),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=25'}}));}catch{}}}
 const etag='"'+await hash(JSON.stringify([snapshot.sources,snapshot.alerts]))+'"';headers.ETag=etag;
 if(request.headers.get('If-None-Match')===etag)return new Response(null,{status:304,headers});
 return new Response(request.method==='HEAD'?null:JSON.stringify(snapshot),{headers});
}
