import {handleTvWeather} from './tv-weather.mjs';
import {handleTvRain} from './tv-rain.mjs';
export const BRIEFING_MODEL='@cf/meta/llama-3.1-8b-instruct-fp8-fast';
export const BRIEFING_POLICY='source-grounded-weather-v1';
export const BRIEFING_LIMITS={day:64,month:1500};
const MIN=60000,HOUR=60*MIN,CORS={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'};
const reply=data=>Response.json({version:'weather-briefing-v1',area:'liberdade',...data},{headers:CORS});
const valid=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
const clock=at=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at)+' BRT';
const num=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:1});
const conditions={Clear:'céu limpo',MostlyClear:'predomínio de céu limpo',PartlyCloudy:'céu parcialmente nublado',MostlyCloudy:'céu nublado',Cloudy:'céu nublado',Foggy:'nevoeiro',Haze:'névoa',Drizzle:'garoa',Rain:'chuva',HeavyRain:'chuva forte',Thunderstorms:'trovoadas',StrongStorms:'trovoadas',ScatteredThunderstorms:'trovoadas isoladas',IsolatedThunderstorms:'trovoadas isoladas',Snow:'neve',HeavySnow:'neve forte'};
function route(request){const u=new URL(request.url);return request.method==='GET'&&u.pathname==='/weather-briefing'&&['hourly','rain'].includes(u.searchParams.get('kind'))&&[...u.searchParams.keys()].every(k=>k==='kind')?u.searchParams.get('kind'):null;}
function location(d){return d?.ok===true&&d.area==='liberdade'&&d.loc?.lat===-23.555&&d.loc?.lng===-46.635;}
export function briefingContext(kind,d,now){
 if(!location(d)||!valid(d.at,1,now+MIN)||!valid(d.expiresAt,now+1,Number.MAX_SAFE_INTEGER))return null;
 const facts={};let state='',referenceAt=0,dataAt=d.at;
 if(kind==='hourly'){
  const p=d.current;if(d.version!=='tv-weather-v1'||!p||!valid(p.start,now-HOUR+1,now)||!valid(d.generatedAt,now-90*MIN,now+MIN)||d.expiresAt>d.at+HOUR||!valid(p.temperature,-100,70))return null;
  referenceAt=p.start;dataAt=d.generatedAt;
  facts.temperature='Na Liberdade, a previsão horária é de '+num(p.temperature)+' °C.';
  if(valid(p.feels,-120,100))facts.feels='A sensação térmica prevista é de '+num(p.feels)+' °C.';
  if(conditions[p.condition])facts.condition='O modelo horário indica '+conditions[p.condition]+'.';
  if(valid(p.wind,0,540))facts.wind='O vento previsto é de '+num(p.wind)+' km/h'+(valid(p.gust,0,540)?', com rajadas de '+num(p.gust)+' km/h.':'.');
  if(valid(p.humidity,0,100))facts.humidity='A umidade prevista é de '+num(p.humidity)+'%.';
 }else{
  if(d.version!=='tv-rain-v1'||now-d.at>20*MIN||d.expiresAt>d.at+10*MIN||!Array.isArray(d.forecast)||d.forecast.length<60||d.forecast.length>300)return null;
  let end=0,current=-1;const all=d.forecast;
  for(let i=0;i<all.length;i++){const p=all[i];if(!Number.isSafeInteger(p.start)||!Number.isSafeInteger(p.end)||p.end-p.start!==MIN||(end&&p.start!==end)||!valid(p.rate,0,1000)||!['rain','mixed','snow','no_precipitation'].includes(p.type))return null;end=p.end;if(p.start<=now&&p.end>now)current=i;}
  if(current<0||end<now+HOUR)return null;
  const wet=p=>p.rate>=.1&&p.type!=='no_precipitation';let first=-1;for(let i=current;i<all.length;i++)if(wet(all[i])){first=i;break;}
  if(first<0||all[first].start>now+HOUR)return {notApplicable:true};
  state=wet(all[current])?'now':'soon';const rate=all[state==='now'?current:first].rate,level=rate<2.5?'fraca':rate<7.5?'moderada':rate<50?'forte':'muito forte';
  const noun=all[first].type==='snow'?'neve':'chuva';
  facts.intensity='A intensidade '+(state==='now'?'estimada agora':'prevista no início')+' é '+level+', de '+num(rate)+' mm/h.';
  let amount=0;for(const p of all)amount+=p.rate*Math.max(0,Math.min(p.end,now+HOUR)-Math.max(p.start,now))/HOUR;
  facts.amount='Entre '+clock(now)+' e '+clock(now+HOUR)+', são estimados '+num(amount)+' mm no ponto da Liberdade.';
  if(state==='soon')facts.arrival='O início da '+noun+' está previsto próximo de '+clock(all[first].start)+'.';
  for(let i=first+1;i<=all.length-10;i++)if(all.slice(i,i+10).every(p=>!wet(p))){facts.end='O modelo indica uma possível pausa na '+noun+' a partir de '+clock(all[i].start)+'.';break;}
  const baseline=all.slice(current,current+5).reduce((s,p)=>s+(wet(p)?p.rate:0),0)/5;
  if(state==='now')for(let i=current+5;i<=Math.min(all.length-5,current+60);i++)if(all.slice(i,i+5).every(p=>wet(p)&&p.rate>=Math.max(baseline*1.5,baseline+1))){facts.increase='Os dados indicam aumento sustentado da intensidade perto de '+clock(all[i].start)+'.';break;}
  referenceAt=0;
 }
 const keys=Object.keys(facts),slot=Math.floor(now/(kind==='hourly'?HOUR:30*MIN));
 return {kind,facts,state,referenceAt,dataAt,keys,key:kind+':'+slot+':'+state+':'+keys.slice().sort().join(','),until:Math.min(d.expiresAt,(slot+1)*(kind==='hourly'?HOUR:30*MIN),now+(kind==='hourly'?HOUR:5*MIN))};
}
export function parseBriefingSelection(result,context){
 try{const raw=typeof result?.response==='string'?JSON.parse(result.response.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/,'$1')):result?.response;
  if(!raw||Object.keys(raw).some(k=>k!=='facts')||!Array.isArray(raw.facts)||raw.facts.length<1||raw.facts.length>(context.kind==='rain'?2:3)||new Set(raw.facts).size!==raw.facts.length||raw.facts.some(k=>!context.keys.includes(k)))return null;
  if(context.kind==='hourly'&&!raw.facts.includes('temperature'))return null;return raw.facts;
 }catch{return null;}
}
function renderFacts(keys,context){if(context.kind==='hourly')keys=['temperature',...keys.filter(k=>k!=='temperature')];let out='';for(const key of keys){const next=(out?out+' ':'')+context.facts[key];if(next.length<=185)out=next;}return out;}
export async function handleWeatherBriefing(request,env){
 if(!route(request))return reply({status:'unavailable'});
 if(!env.EARTHQUAKE_ALERTS)return reply({status:'unavailable'});
 try{return await env.EARTHQUAKE_ALERTS.get(env.EARTHQUAKE_ALERTS.idFromName('weather-briefing-v1')).fetch(request);}catch{return reply({status:'unavailable'});}
}
export async function handleWeatherBriefingInObject(request,env,storage,{now=Date.now(),waitUntil,readWeather=handleTvWeather,readRain=handleTvRain}={}){
 const kind=route(request);if(!kind||!env.AI||typeof waitUntil!=='function')return reply({status:'unavailable'});
 let context;
 try{const source=await(kind==='hourly'?readWeather:readRain)(new Request('https://internal/'+(kind==='hourly'?'tv-weather':'tv-rain?area=liberdade')),env);context=briefingContext(kind,await source.json(),now);}catch{return reply({status:'unavailable'});}
 if(!context)return reply({status:'unavailable'});if(context.notApplicable)return reply({status:'not_applicable'});
 const key='briefing:'+context.key;
 try{
  const cached=await storage.get(key);
  if(cached?.status==='ready'&&cached.until>now&&parseBriefingSelection({response:{facts:cached.facts}},context))return reply({status:'ready',kind,policy:BRIEFING_POLICY,model:BRIEFING_MODEL,dataAt:context.dataAt,referenceAt:context.referenceAt,rainState:context.state,generatedAt:now,aiAt:cached.at,expiresAt:context.until,text:renderFacts(cached.facts,context)});
  if(cached?.until>now)return reply({status:cached.status==='pending'?'pending':'unavailable',retryAfter:cached.status==='pending'?2:300});
  const day=new Date(now).toISOString().slice(0,10),month=day.slice(0,7),old=await storage.get('briefing:budget');
  const budget={day,month,daily:old?.day===day?old.daily:0,monthly:old?.month===month?old.monthly:0};
  if(!Number.isSafeInteger(budget.daily)||budget.daily<0||!Number.isSafeInteger(budget.monthly)||budget.monthly<0||budget.daily>=BRIEFING_LIMITS.day||budget.monthly>=BRIEFING_LIMITS.month)return reply({status:'limited'});
  const prompt='Escolha os fatos mais úteis para um boletim curto em português da Liberdade, São Paulo. Retorne SOMENTE JSON {"facts":[IDs]}. Selecione no máximo '+(kind==='rain'?'2':'3')+' IDs disponíveis, sem repetir. '+(kind==='hourly'?'Inclua temperature.':'Priorize arrival ou increase quando disponíveis.')+' Não escreva números, frases ou novas previsões. Fatos validados: '+JSON.stringify(context.facts);
  if(new TextEncoder().encode(prompt).length>3500)return reply({status:'unavailable'});
  budget.daily++;budget.monthly++;await storage.put('briefing:budget',budget);
  const index=(await storage.get('briefing:index')||[]).filter(k=>k!==key);index.push(key);while(index.length>48)await storage.delete(index.shift());await storage.put('briefing:index',index);
  await storage.put(key,{status:'pending',until:now+2*MIN});
  const job=(async()=>{let timer;try{
   const result=await Promise.race([env.AI.run(BRIEFING_MODEL,{messages:[{role:'user',content:prompt}],temperature:0,max_tokens:96}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),12000);})]);
   const facts=parseBriefingSelection(result,context);if(!facts)throw Error('invalid');
   await storage.put(key,{status:'ready',facts,at:now,until:Math.floor(now/(kind==='hourly'?HOUR:30*MIN)+1)*(kind==='hourly'?HOUR:30*MIN)});
  }catch{try{await storage.put(key,{status:'error',until:now+10*MIN});}catch{}}finally{clearTimeout(timer);}})();
  waitUntil(job);return reply({status:'pending',retryAfter:2});
 }catch{return reply({status:'unavailable'});}
}
