// One fixed point, sharing the site's protected Rainbow collector and its existing budget.
import {handleRainbowNowcast} from '../rainbow-nowcast-worker.mjs';
export const TV_RAIN_POLICY='liberdade-minute-rain-v2';
export const TV_RAIN_LIBERDADE={lat:-23.555,lng:-46.635,area:'liberdade',name:'Liberdade · São Paulo'};
export function createTvRain({read=handleRainbowNowcast,clock=Date.now,cache=()=>globalThis.caches?.default,location={lat:-23.55,lng:-46.63,area:'sp',name:'São Paulo'}}={}){
 let last,job;const key=new Request('https://black-sky-9ba0.terrestre.workers.dev/__tv-rain-'+location.area+'-v1');
 return async function handle(request,env){
  const headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  const now=clock();let entry=last;
  if(!entry||entry.until<=now)try{const hit=await cache()?.match(key);if(hit){const data=await hit.json();if(data.until>now&&data.until<=now+600000)entry=data;}}catch{}
  if(!entry||entry.until<=now){
   if(!job)job=(async()=>{let body;try{const r=await read(new Request('https://internal/rain-nowcast?lat='+location.lat+'&lng='+location.lng),env);const d=await r.json();
    if(d.ok===true&&d.loc?.lat===location.lat&&d.loc?.lng===location.lng&&Number.isFinite(d.at)&&d.at>0&&now-d.at<=600000&&d.at<=now+60000&&Number.isFinite(d.expiresAt)&&d.expiresAt>now&&d.expiresAt<=d.at+600000&&Array.isArray(d.forecast)&&d.forecast.length>=60&&d.forecast.length<=300){body={version:'tv-rain-v1',area:location.area,ok:true,source:'Rainbow Weather',at:d.at,expiresAt:d.expiresAt,loc:d.loc,forecast:d.forecast};}
    else body={version:'tv-rain-v1',ok:false,reason:String(d.reason||'unavailable').slice(0,60),detail:'Estimativa por minuto indisponível para '+location.name+'.'};
   }catch{body={version:'tv-rain-v1',ok:false,reason:'unavailable',detail:'Estimativa por minuto indisponível para '+location.name+'.'};}
   const value={body,until:body.ok?body.expiresAt:now+120000};last=value;try{await cache()?.put(key,Response.json(value,{headers:{'Cache-Control':'public, max-age='+Math.max(1,Math.floor((value.until-now)/1000))}}));}catch{}return value;
   })().finally(()=>job=null);
   entry=await job;
  }
  last=entry;headers['Cache-Control']='public, max-age='+Math.max(0,Math.floor((entry.until-clock())/1000));return new Response(request.method==='HEAD'?null:JSON.stringify(entry.body),{headers});
 };
}
const legacy=createTvRain(),liberdade=createTvRain({location:TV_RAIN_LIBERDADE});
export const handleTvRain=(request,env)=>new URL(request.url).searchParams.get('area')==='liberdade'?liberdade(request,env):legacy(request,env);
