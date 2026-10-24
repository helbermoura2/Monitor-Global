// Optional, bounded TV context. Never drives alert eligibility or tsunami classification.
import {queryImageExposure,validImageExposure} from '../seismic-image-data.mjs';
import {referencePlaces} from './alert-cartography.mjs';
import {distanceKm} from '../population-exposure-worker.mjs';
const missing={populationSummary:'Estimativa de população indisponível',nearbySummary:'Cidades de referência indisponíveis'};
export function contextSummary(ev,exposure,places){
 let populationSummary=missing.populationSummary;
 if(validImageExposure(exposure)){
  const count=Math.round(Number(exposure.ranges[0].population)).toLocaleString('pt-BR');
  populationSummary=exposure.method==='geonames-localities'?`~${count} pessoas nas localidades da área estimada · GeoNames · cobertura parcial`:`População potencialmente exposta a tremor fraco ou maior (MMI III+): ~${count} · ${exposure.method==='pager'?'USGS PAGER':'WorldPop, modelo estimado'}${exposure.partial?' · parcial':''}`;
  populationSummary+=' · Não é contagem de vítimas';
 }
 const seen=new Set();const nearby=(Array.isArray(places)?places:[]).filter(p=>p.name&&typeof p.lat==='number'&&typeof p.lon==='number'&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180).map(p=>({...p,distance:distanceKm(ev.lat,ev.lon,p.lat,p.lon)})).sort((a,b)=>a.distance-b.distance).filter(p=>{const key=[p.name,p.lat,p.lon].join('|');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,5);
 const nearbySummary=nearby.length?`Cidades de referência próximas${nearby.length<5?' ('+nearby.length+' disponíveis)':''} · USGS/GeoNames: `+nearby.map(p=>String(p.name).replace(/[\r\n\t]/g,' ').slice(0,65)+' — '+Math.round(p.distance)+' km').join('; ')+' · Distâncias ao epicentro; não indica danos':missing.nearbySummary;
 return {populationSummary,nearbySummary};
}
export function createTvEnricher({exposure=queryImageExposure,places=referencePlaces,clock=Date.now,budgetMs=4000}={}){
 const cache=new Map();
 async function context(ev,env){
  const key=JSON.stringify([ev.id,ev.mag,ev.depth,ev.lat,ev.lon]),now=clock();
  for(const [k,v]of cache)if(v.until<=now)cache.delete(k);
  let entry=cache.get(key);
  if(!entry){
   entry={until:now+60000,value:missing};cache.set(key,entry);while(cache.size>24)cache.delete(cache.keys().next().value);
   entry.job=Promise.allSettled([Promise.resolve().then(()=>exposure(ev,env)),Promise.resolve().then(()=>places(ev))]).then(([e,p])=>{
    const result=contextSummary(ev,e.status==='fulfilled'?e.value:null,p.status==='fulfilled'?p.value:[]);entry.value=result;entry.until=clock()+(result.populationSummary===missing.populationSummary||result.nearbySummary===missing.nearbySummary?60000:1800000);entry.job=null;return result;
   }).catch(()=>{entry.job=null;return missing;});
   env?.TV_WAIT_UNTIL?.(entry.job);
  }
  if(!entry.job)return entry.value;
  let timer;try{return await Promise.race([entry.job,new Promise(resolve=>{timer=setTimeout(()=>resolve(entry.value),budgetMs);})]);}finally{clearTimeout(timer);}
 }
 return async function enrich(snapshot,features,env){
  // At most three latest eligible quakes per shared snapshot, not per TV/poll.
  const candidates=snapshot.alerts.filter(a=>a.kind==='earthquake'&&a.eligible).slice(0,3);
  await Promise.all(candidates.map(async a=>{
   const f=features.find(f=>'USGS:'+f.id===a.id),c=f?.geometry?.coordinates;
   if(!c||![c[0],c[1],a.magnitude].every(Number.isFinite)||Math.abs(c[0])>180||Math.abs(c[1])>90||!Number.isFinite(a.depth))return Object.assign(a,missing);
   try{Object.assign(a,await context({id:f.id,provider:'USGS',mag:a.magnitude,depth:a.depth,lat:c[1],lon:c[0],time:a.eventTime,timeIso:new Date(a.eventTime).toISOString()},env));}catch{Object.assign(a,missing);}
  }));return snapshot;
 };
}
export const enrichTvSnapshot=createTvEnricher();
