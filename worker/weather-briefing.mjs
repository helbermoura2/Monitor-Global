import {handleTvWeather} from './tv-weather.mjs';
import {handleTvRain} from './tv-rain.mjs';
// This supported -fast variant replaces the FP8 model scheduled for retirement on 2026-11-20.
// Cache keys are already model-specific; the previous model's stale errors are not reused.
export const BRIEFING_MODEL='@cf/meta/llama-3.1-8b-instruct-fp8-fast';
export const GEMINI_MODEL='gemini-3.8-flash';
export const BRIEFING_PRIMARY_MODEL=GEMINI_MODEL;
export const BRIEFING_POLICY='source-grounded-weather-v1';
export const BRIEFING_LIMITS={day:64,month:1500};
const MIN=60000,HOUR=60*MIN,CORS={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'};
const reply=data=>Response.json({version:'weather-briefing-v1',area:'liberdade',engine:'validated-insight-selection-v4',...data},{headers:CORS});
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
  // The card already shows temperature, humidity, wind and conditions.
  // AI selects only verified, *non-redundant interpretations*, never raw numbers.
  if(valid(p.humidity,0,100)&&valid(p.wind,0,540)&&p.humidity>=85&&p.wind<=5)
   facts.humidCalm='O modelo prevê ar muito úmido e vento praticamente parado. Umidade alta, sozinha, não indica chuva.';
  else if(valid(p.humidity,0,100)&&p.humidity>=85)
   facts.humid='A previsão indica umidade muito alta, mas isso, por si só, não confirma chuva.';
  else if(valid(p.humidity,0,100)&&p.humidity<=30)
   facts.dry='O modelo aponta ar seco; atenção ao conforto e à hidratação.';
  if(valid(p.feels,-120,100)&&p.feels-p.temperature>=4&&p.feels>=30)
   facts.heat='A sensação prevista é bem mais quente do que a temperatura indicada; maior desconforto térmico é possível.';
  else if(valid(p.feels,-120,100)&&p.temperature-p.feels>=4&&p.feels<=15)
   facts.chill='A sensação prevista é significativamente mais fria que a temperatura indicada.';
  if(valid(p.gust,0,540)&&p.gust>=50)
   facts.gusts='Há previsão de rajadas fortes; acompanhe os avisos oficiais e tenha atenção em locais expostos.';
  else if(valid(p.wind,0,540)&&p.wind>=35)
   facts.wind='O modelo aponta vento persistente forte, especialmente relevante em áreas abertas.';
  if(['Thunderstorms','StrongStorms','ScatteredThunderstorms','IsolatedThunderstorms'].includes(p.condition))
   facts.storm='O modelo sinaliza trovoadas; acompanhe os avisos oficiais antes de atividades externas.';
  if(p.condition==='Foggy')
   facts.fog='O modelo indica nevoeiro; a visibilidade pode ficar reduzida.';
 }else{
  if(d.version!=='tv-rain-v1'||now-d.at>20*MIN||d.expiresAt>d.at+10*MIN||!Array.isArray(d.forecast)||d.forecast.length<60||d.forecast.length>300)return null;
  let end=0,current=-1;const all=d.forecast;
  for(let i=0;i<all.length;i++){const p=all[i];if(!Number.isSafeInteger(p.start)||!Number.isSafeInteger(p.end)||p.end-p.start!==MIN||(end&&p.start!==end)||!valid(p.rate,0,1000)||!['rain','mixed','snow','no_precipitation'].includes(p.type))return null;end=p.end;if(p.start<=now&&p.end>now)current=i;}
  if(current<0||end<now+HOUR)return null;
  const wet=p=>p.rate>=.1&&p.type!=='no_precipitation';let first=-1;for(let i=current;i<all.length;i++)if(wet(all[i])){first=i;break;}
  if(first<0||all[first].start>now+HOUR)return {notApplicable:true};
  state=wet(all[current])?'now':'soon';const rate=all[state==='now'?current:first].rate,level=rate<2.5?'fraca':rate<7.5?'moderada':rate<50?'forte':'muito forte';
  const noun=all[first].type==='snow'?'neve':'chuva';
  // Rain amount, intensity and duration are already on the TV card.
  // Only highlight changes or continuity backed by the minute-by-minute series.

  const strongStart=state==='now'?current:first;
  if(all.slice(strongStart,strongStart+5).length===5&&all.slice(strongStart,strongStart+5).every(p=>wet(p)&&p.rate>=7.5))
   facts.strong='O modelo sinaliza '+noun+' forte sustentada; acompanhe os avisos oficiais, pois a intensidade pode mudar.';
  if(state==='now')for(let i=first+1;i<=all.length-10&&all[i].start<=now+HOUR;i++)if(all.slice(i,i+10).every(p=>!wet(p))){facts.pause='Há indicação de possível pausa na '+noun+' na próxima hora, sujeita a revisão.';break;}
  const baseline=all.slice(current,current+5).reduce((s,p)=>s+(wet(p)?p.rate:0),0)/5;
  if(state==='now')for(let i=current+5;i<=Math.min(all.length-5,current+60);i++)if(all.slice(i,i+5).every(p=>wet(p)&&p.rate>=Math.max(baseline*1.5,baseline+1))){facts.increase='O modelo indica que a '+noun+' pode ganhar força ao longo da próxima hora.';break;}
  if(state==='now'&&all.slice(current,current+45).length===45&&all.slice(current,current+45).every(wet))
   facts.persistent='A previsão sugere '+noun+' persistente durante boa parte da próxima hora.';
  referenceAt=0;
 }
 const keys=Object.keys(facts);
 if(!keys.length)return {notApplicable:true};
 const slot=Math.floor(now/(kind==='hourly'?HOUR:30*MIN));
 return {kind,facts,state,referenceAt,dataAt,keys,key:kind+':'+slot+':'+state+':'+keys.slice().sort().join(','),until:Math.min(d.expiresAt,(slot+1)*(kind==='hourly'?HOUR:30*MIN),now+(kind==='hourly'?HOUR:5*MIN))};
}
export function parseBriefingSelection(result,context){
 try{let raw=result?.response;if(typeof raw==='string'){raw=raw.trim();if(raw.length>2000)return null;try{raw=JSON.parse(raw);}catch{const start=raw.indexOf('{'),end=raw.lastIndexOf('}');if(start<0||end<start)return null;raw=JSON.parse(raw.slice(start,end+1));}}
  if(Array.isArray(raw))raw={facts:raw};
  if(!raw||Object.keys(raw).some(k=>k!=='facts')||!Array.isArray(raw.facts)||raw.facts.length<1||raw.facts.length>2||raw.facts.length>context.keys.length||new Set(raw.facts).size!==raw.facts.length||raw.facts.some(k=>!context.keys.includes(k)))return null;
  // A high-priority signal must not be hidden by a weaker selected fact.
  // The model still ranks optional interpretations, but cannot suppress a
  // verified storm, strong gust, sustained heavy rain or intensification.
  const priority=context.kind==='rain'
   ? ['increase','strong','persistent','pause']
   : ['storm','gusts','heat','chill','dry','fog','wind','humidCalm','humid'];
  const mandatory=context.kind==='rain'?['increase','strong']:['storm','gusts'];
  return [...new Set([...mandatory.filter(key=>context.keys.includes(key)),...raw.facts])]
   .sort((a,b)=>priority.indexOf(a)-priority.indexOf(b)).slice(0,2);
 }catch{return null;}
}
function renderFacts(keys,context){let out='';for(const key of keys){const next=(out?out+' ':'')+context.facts[key];if(next.length<=185)out=next;}return out;}

/** Fixed-place, verified IDs only. The API key is a Cloudflare secret. */
export async function geminiSelection(env,context,prompt,fetcher=fetch){
 if(typeof env.GEMINI_API_KEY!=='string'||!env.GEMINI_API_KEY.trim())throw Error('gemini-unconfigured');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),11000);
 try{
  const response=await fetcher('https://generativelanguage.googleapis.com/v1beta/models/'+GEMINI_MODEL+':generateContent',{
   method:'POST',headers:{'content-type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
   signal:controller.signal,
   body:JSON.stringify({
    systemInstruction:{parts:[{text:'Select only verified IDs from the supplied weather fact map. Reply only as JSON {"facts":["id"]}. No new text, measurements, warning levels or predictions.'}]},
    contents:[{role:'user',parts:[{text:prompt}]}],
    generationConfig:{thinkingConfig:{thinkingLevel:'LOW'},maxOutputTokens:512,responseMimeType:'application/json'}
   })
  });
  if(!response.ok)throw Error('gemini-unavailable');
  if(Number(response.headers?.get?.('content-length')||0)>6000)throw Error('gemini-size');
  const raw=await response.text();if(raw.length>6000)throw Error('gemini-size');
  let payload;try{payload=JSON.parse(raw);}catch{throw Error('gemini-response');}
  const content=payload?.candidates?.[0]?.content?.parts?.filter(p=>!p?.thought).map(p=>p?.text||'').join('')||'';
  if(typeof content!=='string'||content.length>2000)throw Error('gemini-response');
  const facts=parseBriefingSelection({response:content},context);
  if(!facts)throw Error('invalid');
  return facts;
 }finally{clearTimeout(timer);}
}
async function workersSelection(env,context,prompt){
 if(!env.AI)throw Error('model-unconfigured');
 let timer;
 try{
  const result=await Promise.race([
   env.AI.run(BRIEFING_MODEL,{messages:[
    {role:'system',content:'Select only the provided interpretation IDs. Return compact JSON, for example {"facts":["humidCalm"]}. Never return explanations or fact sentences.'},
    {role:'user',content:prompt}
   ],temperature:0,max_tokens:96}),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),12000);})
  ]);
  const facts=parseBriefingSelection(result,context);
  if(!facts)throw Error('invalid');
  return facts;
 }finally{clearTimeout(timer);}
}
export async function selectWithFallback(env,context,prompt,fetchGemini=fetch){
 if(env.GEMINI_API_KEY){
  try{return {facts:await geminiSelection(env,context,prompt,fetchGemini),model:GEMINI_MODEL};}
  catch(error){
   // Gemini errors are not weather insights. Existing Workers AI is
   // attempted once as backup; provider error text is never exposed.
   if(!env.AI)throw error;
  }
 }
 if(env.AI)return {facts:await workersSelection(env,context,prompt),model:BRIEFING_MODEL};
 throw Error('model-unconfigured');
}

export async function handleWeatherBriefing(request,env){
 if(!route(request))return reply({status:'unavailable',reason:'invalid-request'});
 if(!env.EARTHQUAKE_ALERTS)return reply({status:'unavailable',reason:'service-unavailable'});
 try{return await env.EARTHQUAKE_ALERTS.get(env.EARTHQUAKE_ALERTS.idFromName('weather-briefing-v1')).fetch(request);}catch{return reply({status:'unavailable',reason:'service-unavailable'});}
}
export async function handleWeatherBriefingInObject(request,env,storage,{now=Date.now(),waitUntil,readWeather=handleTvWeather,readRain=handleTvRain,fetchGemini=fetch}={}){
 const kind=route(request);
 if(!kind)return reply({status:'unavailable',reason:'invalid-request'});
 if(!env.AI&&!env.GEMINI_API_KEY)return reply({status:'unavailable',reason:'model-unconfigured'});
 if(typeof waitUntil!=='function')return reply({status:'unavailable',reason:'service-unavailable'});
 let context;
 try{
  const source=await(kind==='hourly'?readWeather:readRain)(
   new Request('https://internal/'+(kind==='hourly'?'tv-weather':'tv-rain?area=liberdade')),env);
  const payload=await source.json();
  if(!source.ok||payload?.ok!==true)return reply({status:'unavailable',reason:'source-unavailable'});
  context=briefingContext(kind,payload,now);
 }catch{return reply({status:'unavailable',reason:'source-unavailable'});}
 if(!context)return reply({status:'unavailable',reason:'source-stale-or-invalid'});
 if(context.notApplicable)return reply({status:'not_applicable'});
 const key='briefing:'+GEMINI_MODEL+':cf-'+BRIEFING_MODEL+':validated-insights-v5:'+context.key;
 try{
  const cached=await storage.get(key);
  if(cached?.status==='ready'&&cached.until>now&&[GEMINI_MODEL,BRIEFING_MODEL].includes(cached.model)&&parseBriefingSelection({response:{facts:cached.facts}},context))return reply({status:'ready',kind,policy:BRIEFING_POLICY,model:cached.model,dataAt:context.dataAt,referenceAt:context.referenceAt,rainState:context.state,generatedAt:now,aiAt:cached.at,expiresAt:context.until,text:renderFacts(cached.facts,context)});
  if(cached?.until>now)return reply({status:cached.status==='pending'?'pending':'unavailable',retryAfter:cached.status==='pending'?2:300,...(cached.reason?{reason:cached.reason,providerCode:cached.providerCode||null}:{})});
  const day=new Date(now).toISOString().slice(0,10),month=day.slice(0,7),old=await storage.get('briefing:budget');
  const budget={day,month,daily:old?.day===day?old.daily:0,monthly:old?.month===month?old.monthly:0};
  if(!Number.isSafeInteger(budget.daily)||budget.daily<0||!Number.isSafeInteger(budget.monthly)||budget.monthly<0||budget.daily>=BRIEFING_LIMITS.day||budget.monthly>=BRIEFING_LIMITS.month)return reply({status:'limited'});
  const prompt='Escolha até 2 interpretações mais úteis para um destaque meteorológico curto. Retorne SOMENTE JSON {"facts":[IDs]}. Selecione apenas IDs disponíveis, sem repetir. Priorize mudanças, riscos moderados e combinações de condições; nunca repita os valores do cartão. Não escreva números, frases ou novas previsões. Interpretações derivadas exclusivamente dos dados válidos: '+JSON.stringify(context.facts);
  if(new TextEncoder().encode(prompt).length>3500)return reply({status:'unavailable',reason:'invalid-prompt'});
  budget.daily++;budget.monthly++;await storage.put('briefing:budget',budget);
  const index=(await storage.get('briefing:index')||[]).filter(k=>k!==key);index.push(key);while(index.length>48)await storage.delete(index.shift());await storage.put('briefing:index',index);
  await storage.put(key,{status:'pending',until:now+2*MIN});
  const job=(async()=>{
   try{
    const selected=await selectWithFallback(env,context,prompt,fetchGemini);
    await storage.put(key,{status:'ready',facts:selected.facts,model:selected.model,
     at:now,until:Math.floor(now/(kind==='hourly'?HOUR:30*MIN)+1)*(kind==='hourly'?HOUR:30*MIN)});
   }catch(error){
    const reason=error?.message==='invalid'?'invalid-selection':error?.message==='timeout'?'model-timeout':'model-error';
    try{await storage.put(key,{status:'error',reason,until:now+10*MIN});}catch{}
   }
  })();
  waitUntil(job);return reply({status:'pending',retryAfter:2});
 }catch{return reply({status:'unavailable',reason:'storage-unavailable'});}
}
