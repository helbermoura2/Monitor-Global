// All provider requests, including errors, are reserved persistently BEFORE fetch.
// This module runs in a dedicated, serialized Durable Object, never in KV alone.
export const RAINBOW_MONTHLY_LIMIT = 4500;
export const RAINBOW_DAILY_LIMIT = 150;
const TTL = 600000;
const SOURCE = 'Rainbow Weather';
const headers = {'Access-Control-Allow-Origin':'*','Cache-Control':'no-store','Content-Type':'application/json'};
const reply = (data, status=200) => Response.json(data,{status,headers});
const missing = (reason, detail, extra={}) => reply({ok:false,reason,detail,source:SOURCE,...extra});

export function rainbowLocation(url) {
  const latText=url.searchParams.get('lat'),lngText=url.searchParams.get('lng');
  if(latText===null || lngText===null || !/^-?\d+(?:\.\d+)?$/.test(latText) || !/^-?\d+(?:\.\d+)?$/.test(lngText))return null;
  const lat=Number(latText),lng=Number(lngText);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
  // About 100 m; avoids retaining the original fine-grained GPS position.
  return {lat:Number(lat.toFixed(3)),lng:Number(lng.toFixed(3))};
}

export function normalizeRainbow(data,loc,now) {
  if(!data || !Number.isFinite(data.latitude)||!Number.isFinite(data.longitude) ||
      Math.abs(data.latitude-loc.lat)>.02 || Math.abs(data.longitude-loc.lng)>.02 ||
      !Array.isArray(data.forecast) || data.forecast.length>300)throw Error('Invalid location or series');
  let previous=null;
  const forecast=data.forecast.map(p=>{
    if(!Number.isFinite(p.timestampBegin)||!Number.isFinite(p.timestampEnd)||
        p.timestampEnd-p.timestampBegin!==60 || !Number.isFinite(p.precipRate)||p.precipRate<0 || p.precipRate>1000 ||
        !['no_precipitation','rain','mixed','snow'].includes(p.precipType))throw Error('Invalid precipitation interval');
    const start=p.timestampBegin*1000,end=p.timestampEnd*1000;
    if(previous!==null && start!==previous)throw Error('Incomplete series');
    previous=end;
    return {start,end,rate:p.precipRate,type:p.precipType};
  });
  const current=forecast.findIndex(p=>p.start<=now&&p.end>now);
  if(current<0 || forecast.at(-1).end<now+60*60000 || forecast.at(-1).end>now+5*3600000)throw Error('Forecast stale or incomplete');
  // summary.intensity is the MAXIMUM across four hours, not the intensity now.
  return {ok:true,source:SOURCE,at:now,expiresAt:now+TTL,loc,forecast};
}

export async function handleRainbowNowcast(request,env) {
  const url=new URL(request.url);
  if(request.method!=='GET')return reply({ok:false,reason:'method',detail:'Método não permitido.'},405);
  if(!rainbowLocation(url))return reply({ok:false,reason:'location',detail:'Localização inválida.'},400);
  if(!env.RAINBOW_API_KEY)return missing('not_configured','Previsão por minuto ainda não configurada.');
  if(!env.EARTHQUAKE_ALERTS)return missing('storage_unavailable','Previsão por minuto temporariamente indisponível.');
  try {
    const id=env.EARTHQUAKE_ALERTS.idFromName('global-rainbow-nowcast-v1');
    return await env.EARTHQUAKE_ALERTS.get(id).fetch(request);
  } catch {
    // Never fall back to a direct provider call without a persistent budget.
    return missing('storage_unavailable','Previsão por minuto temporariamente indisponível.');
  }
}

export async function handleRainbowInObject(request,env,storage,{fetcher=fetch,now=Date.now()}={}) {
  const url=new URL(request.url),loc=rainbowLocation(url);
  if(request.method!=='GET'||!loc)return reply({ok:false,reason:'location',detail:'Consulta inválida.'},400);
  if(!env.RAINBOW_API_KEY)return missing('not_configured','Previsão por minuto ainda não configurada.');
  const key='rainbow:point:'+loc.lat+','+loc.lng;
  try {
    const cached=await storage.get(key);
    if(cached && now>=cached.at && now<cached.expiresAt)return reply(cached);
    const month=new Date(now).toISOString().slice(0,7),day=new Date(now).toISOString().slice(0,10);
    const saved=await storage.get('rainbow:budget');
    const budget={month,used:saved?.month===month?saved.used:0,day,dailyUsed:saved?.day===day?saved.dailyUsed:0};
    if(!Number.isSafeInteger(budget.used)||budget.used<0||!Number.isSafeInteger(budget.dailyUsed)||budget.dailyUsed<0)throw Error('Invalid budget');
    const usage={used:budget.used,limit:RAINBOW_MONTHLY_LIMIT};
    if(budget.used>=RAINBOW_MONTHLY_LIMIT)return missing('monthly_limit','Previsão por minuto pausada até renovar a cota gratuita.',{usage,retryAt:Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),1)});
    // Also distributes the quota and protects a provider billing-month timezone boundary.
    if(budget.dailyUsed>=RAINBOW_DAILY_LIMIT)return missing('daily_limit','Previsão por minuto temporariamente pausada para preservar a cota gratuita.',{usage,retryAt:Date.parse(day+'T00:00:00Z')+86400000});
    const pause=await storage.get('rainbow:pause');
    if(pause && pause.until>now)return missing(pause.reason,pause.detail,{retryAt:pause.until});
    budget.used++;budget.dailyUsed++;
    await storage.put('rainbow:budget',budget);
    const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
    let result;
    try {
      const response=await fetcher('https://api.rainbow.ai/nowcast/v1/precip-global/'+loc.lng+'/'+loc.lat,
        {headers:{'Ocp-Apim-Subscription-Key':env.RAINBOW_API_KEY,Accept:'application/json'},signal:c.signal,redirect:'error'});
      if(!response.ok){
        const auth=response.status===401||response.status===403;
        const reason=auth?'authentication':response.status===404?'no_coverage':response.status===429?'provider_limit':'provider_unavailable';
        const detail=auth?'Previsão por minuto indisponível: configuração da fonte pendente.':reason==='no_coverage'?'Sem previsão por minuto disponível para este local.':'Fonte da previsão por minuto temporariamente indisponível.';
        if(auth || response.status===429 || response.status>=500)await storage.put('rainbow:pause',{until:now+TTL,reason,detail});
        result={ok:false,reason,detail,source:SOURCE,at:now,expiresAt:now+TTL,loc};
      } else {
        // Reject malformed responses without returning provider bodies or credentials.
        const text=await response.text();if(text.length>100000)throw Error('Response too large');
        result=normalizeRainbow(JSON.parse(text),loc,now);
      }
    } catch {
      result={ok:false,reason:'provider_unavailable',detail:'Fonte da previsão por minuto temporariamente indisponível.',source:SOURCE,at:now,expiresAt:now+TTL,loc};
      await storage.put('rainbow:pause',{until:now+TTL,reason:result.reason,detail:result.detail});
    } finally {clearTimeout(timer);}
    // Bounded persistent cache shared by browsers and data centers, including failures.
    const index=(await storage.get('rainbow:cache-index')||[]).filter(x=>x!==key);
    index.push(key);
    while(index.length>32)await storage.delete(index.shift());
    await storage.put(key,result);await storage.put('rainbow:cache-index',index);
    return reply(result);
  } catch {
    return missing('storage_unavailable','Previsão por minuto temporariamente indisponível.');
  }
}
