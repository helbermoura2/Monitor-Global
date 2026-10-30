// Fixed Liberdade point, sharing the existing protected hourly weather collector.
import {handleRainbowProducts} from '../rainbow-products-worker.mjs';
export const TV_WEATHER_POLICY='liberdade-hourly-weather-v1';
export function createTvWeather({read=handleRainbowProducts,clock=Date.now,cache=()=>globalThis.caches?.default}={}){
 let last,job;const key=new Request('https://black-sky-9ba0.terrestre.workers.dev/__tv-weather-liberdade-v1');
 return async function handle(request,env){
  const headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  const now=clock();let entry=last;
  if(!entry||entry.until<=now)try{const hit=await cache()?.match(key);if(hit){const d=await hit.json();if(d.until>now&&d.until<=now+3600000)entry=d;}}catch{}
  if(!entry||entry.until<=now){if(!job)job=(async()=>{let body;
   try{const r=await read(new Request('https://internal/rain-weather?lat=-23.555&lng=-46.635'),env),d=await r.json();const current=d.hourly?.find(p=>Number.isFinite(p.start)&&p.start<=now&&p.start+3600000>now);
    if(!d.ok||d.loc?.lat!==-23.555||d.loc?.lng!==-46.635||!Number.isFinite(d.at)||d.at>now+60000||!Number.isFinite(d.generatedAt)||d.generatedAt>now+60000||now-d.generatedAt>5400000||!Number.isFinite(d.expiresAt)||d.expiresAt<=now||!current||!Number.isFinite(current.temperature))throw Error('weather');
    body={version:'tv-weather-v1',area:'liberdade',ok:true,source:'Rainbow Weather',loc:d.loc,at:d.at,generatedAt:d.generatedAt,expiresAt:Math.min(d.expiresAt,current.start+3600000,d.generatedAt+5400000),current:{start:current.start,temperature:current.temperature,feels:current.feels??null,wind:current.wind??null,gust:current.gust??null,humidity:current.humidity??null,condition:typeof current.condition==='string'?current.condition.slice(0,60):null}};
   }catch{body={version:'tv-weather-v1',area:'liberdade',ok:false,detail:'Previsão horária indisponível para a Liberdade.'};}
   const value={body,until:body.ok?body.expiresAt:now+300000};last=value;try{await cache()?.put(key,Response.json(value,{headers:{'Cache-Control':'public, max-age='+Math.max(1,Math.floor((value.until-now)/1000))}}));}catch{}return value;
  })().finally(()=>job=null);entry=await job;}
  last=entry;return new Response(request.method==='HEAD'?null:JSON.stringify(entry.body),{headers:{...headers,'Cache-Control':'public, max-age='+Math.max(0,Math.floor((entry.until-clock())/1000))}});
 };
}
export const handleTvWeather=createTvWeather();
