/**
 * Scientific interpretation endpoints: strict source contracts, never hazard triggers.
 * Both can be read by the website, Android TV and Android phone.
 * No background polling, no extra weather provider quota, no AI-generated measurements.
 */
import {handleTvRain} from './tv-rain.mjs';
import {handleTvAlerts} from './tv-alerts.mjs';
import {selectWithFallback,BRIEFING_MODEL,GEMINI_MODEL} from './weather-briefing.mjs';

const MIN=60000;
const CORS={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store','Content-Type':'application/json'};
const json=(v,status=200)=>Response.json(v,{status,headers:CORS});
const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
const fmt=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:1});
const words=s=>String(s||'').replace(/[<>{}\r\n\t]/g,' ').replace(/\s+/g,' ').trim();
const label=rate=>rate<0.1?'sem precipitação':rate<2.5?'chuva fraca':rate<7.5?'chuva moderada':rate<50?'chuva forte':'chuva muito forte';
const bRT=t=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(t)+' BRT';

export function project30(d,now=Date.now()){
 if(d?.version!=='tv-rain-v1'||d?.ok!==true||d?.area!=='liberdade'||
   d?.loc?.lat!==-23.555||d?.loc?.lng!==-46.635||
   !finite(d.at,now-10*MIN,now+MIN)||!finite(d.expiresAt,now+1,now+10*MIN)||
   !Array.isArray(d.forecast)||d.forecast.length<60||d.forecast.length>300)return null;
 const rows=d.forecast;
 let previous=null,index=-1;
 for(let i=0;i<rows.length;i++){
  const p=rows[i];
  if(!Number.isSafeInteger(p?.start)||!Number.isSafeInteger(p?.end)||p.end-p.start!==MIN||
     !finite(p.rate,0,1000)||!['rain','mixed','snow','no_precipitation'].includes(p.type)||
     previous!==null&&p.start!==previous)return null;
  previous=p.end;
  if(p.start<=now&&p.end>now)index=i;
 }
 if(index<0||index+30>rows.length||rows[index+29].end<now+29*MIN)return null;
 const next=rows.slice(index,index+30);
 const groups=[];
 for(let j=0;j<3;j++){
  const section=next.slice(j*10,(j+1)*10);
  const max=Math.max(...section.map(p=>p.type==='no_precipitation'?0:p.rate));
  const mm=section.reduce((sum,p)=>sum+(p.type==='no_precipitation'?0:p.rate)/60,0);
  groups.push({startMinute:j*10,endMinute:(j+1)*10,level:label(max),maximumRate:Math.round(max*10)/10,amountMm:Math.round(mm*10)/10});
 }
 const sum=next.reduce((n,p)=>n+(p.type==='no_precipitation'?0:p.rate)/60,0);
 const wet=groups.map(p=>p.maximumRate),last=wet[2],first=wet[0];
 const trend=last>first+2?'intensificação':last+2<first?'enfraquecimento':
   wet[0]===0&&wet[1]===0&&wet[2]===0?'sem chuva prevista':'pouca mudança indicada';
 const mixed=next.some(p=>p.type==='snow'||p.type==='mixed');
 const outlookText='Próximos 30 min: '+groups.map(g=>g.startMinute+'–'+g.endMinute+' min, '+g.level).join('; ')+
   '. Acumulado estimado: '+fmt(Math.round(sum*10)/10)+' mm. Tendência: '+trend+
   '. Estimativa Rainbow Weather; sujeita a revisão, não é medição em tempo real.';
 return {version:'rain-outlook-v1',ok:true,area:'liberdade',source:'Rainbow Weather',basedAt:d.at,
  expiresAt:Math.min(d.expiresAt,now+10*MIN),horizonMinutes:30,
  groups,totalMm:Math.round(sum*10)/10,trend,precipitationType:mixed?'mista ou neve':'chuva',
  text:outlookText};
}
export async function handleRainOutlook(request,env,{now=Date.now(),readRain=handleTvRain}={}){
 const u=new URL(request.url);
 if(request.method!=='GET'||u.pathname!=='/weather-outlook'||
  [...u.searchParams.keys()].some(k=>k!=='area')||
  u.searchParams.get('area')!==null&&u.searchParams.get('area')!=='liberdade')
  return json({version:'rain-outlook-v1',ok:false,reason:'invalid-request'},400);
 try{
  const response=await readRain(new Request('https://internal/tv-rain?area=liberdade'),env);
  if(!response.ok)return json({version:'rain-outlook-v1',ok:false,reason:'source-unavailable'});
  const source=await response.json();const projected=project30(source,now);
  return json(projected||{version:'rain-outlook-v1',ok:false,reason:'source-stale-or-invalid'});
 }catch{return json({version:'rain-outlook-v1',ok:false,reason:'source-unavailable'});}
}

const interpret=(q,now)=>{
 if(q?.kind!=='earthquake'||!finite(q.magnitude,0,10)||!finite(q.eventTime,now-72*3600000,now+300000)||
   typeof q.id!=='string'||q.id.length>170)return null;
 const place=words(q.title).slice(0,190),agency=words(q.source||q.provider||'Fonte não informada').slice(0,80);
 const mag=fmt(q.magnitude);
 const dep=finite(q.depth,0,700)?q.depth:null;
 const context={
  size:'Magnitude M'+mag+' registrada por '+agency+'. A magnitude é uma medida do tamanho do terremoto; não é a intensidade do tremor sentida em cada cidade nem uma estimativa de danos.',
  depth:dep===null?'A profundidade não foi informada de forma válida. Não há base para classificar a profundidade deste evento.':
   'Profundidade informada: '+fmt(dep)+' km. '+(dep<70?'A profundidade se enquadra na categoria rasa (menos de 70 km).':dep<300?'O registro se enquadra na categoria de profundidade intermediária (70–300 km).':'O registro se enquadra na categoria profunda (300 km ou mais).')+' Profundidade e distância influenciam os efeitos, mas não determinam danos sozinhas.',
  shaking:'A intensidade em cada local depende da distância, da propagação das ondas, das condições do solo e das características da ruptura. Sem um ShakeMap ou relatório oficial verificado, não é correto atribuir intensidades específicas nem prever danos.',
  tsunami:q.tsunamiSummary?
   'O catálogo registra boletim vinculado: '+words(q.tsunamiSummary).slice(0,230)+'. A categoria, as áreas e as revisões precisam ser conferidas no texto da autoridade; a IA não emite alertas.':
   'Este registro não apresenta um boletim oficial de tsunami vinculado neste feed. A ausência de vínculo NÃO comprova ausência de ameaça. Consulte as autoridades competentes.',
  revisions:'Os valores do catálogo podem ser revisados após análises posteriores. A comparação entre agências exige conferir se elas identificam o mesmo evento e se as publicações têm horários diferentes.',
  science:'Não é possível prever com precisão um novo terremoto, sua magnitude e seu horário a partir deste registro. Análises de réplicas, mecanismos focais e falhas específicas exigem dados e modelos científicos adicionais.'
 };
 return {id:q.id,title:place,source:agency,at:q.eventTime,
  magnitude:q.magnitude,depth:dep,tsunamiSummary:words(q.tsunamiSummary).slice(0,230),
  notes:context,keys:Object.keys(context),kind:'seismic',facts:context};
};
const LIMIT={daily:24,monthly:400};
const dayKey=now=>new Date(now).toISOString().slice(0,10);
export async function handleSeismicInsight(request,env){
 const u=new URL(request.url);
 if(request.method!=='GET'||u.pathname!=='/seismic-insight'||[...u.searchParams.keys()].some(k=>k!=='id')||
    (u.searchParams.has('id')&&u.searchParams.get('id').length>170))
  return json({version:'seismic-insight-v1',status:'unavailable',reason:'invalid-request'},400);
 if(!env.EARTHQUAKE_ALERTS)return json({version:'seismic-insight-v1',status:'unavailable',reason:'service-unavailable'});
 try{return await env.EARTHQUAKE_ALERTS.get(env.EARTHQUAKE_ALERTS.idFromName('weather-briefing-v1')).fetch(request);}
 catch{return json({version:'seismic-insight-v1',status:'unavailable',reason:'service-unavailable'});}
}
export async function handleSeismicInsightInObject(request,env,storage,{
 now=Date.now(),waitUntil,readFeed=(req,opts)=>handleTvAlerts(req,opts),
 fetchGemini=fetch
}={}){
 const u=new URL(request.url);
 if(request.method!=='GET'||u.pathname!=='/seismic-insight'||[...u.searchParams.keys()].some(k=>k!=='id')||
    (u.searchParams.has('id')&&(u.searchParams.get('id').length<2||u.searchParams.get('id').length>170)))
  return json({version:'seismic-insight-v1',status:'unavailable',reason:'invalid-request'},400);
 if(typeof waitUntil!=='function')return json({version:'seismic-insight-v1',status:'unavailable',reason:'service-unavailable'});
 let snap;
 try{
  const response=await readFeed(new Request('https://internal/tv-alerts?policy=telegram-v1'),{env});
  if(!response.ok)throw Error('feed');
  snap=await response.json();
  if(snap?.version!=='tv-alerts-v1'||!snap?.sources?.earthquake||!Array.isArray(snap.alerts))throw Error('feed');
 }catch{return json({version:'seismic-insight-v1',status:'unavailable',reason:'source-unavailable'});}
 const wanted=u.searchParams.get('id');
 const q=wanted?snap.alerts.find(a=>a.id===wanted&&a.kind==='earthquake'):
  snap.alerts.find(a=>a.kind==='earthquake'&&a.eligible!==false);
 const evidence=interpret(q,now);
 if(!evidence)return json({version:'seismic-insight-v1',status:'unavailable',reason:'no-matching-fresh-event'});
 const revision=JSON.stringify([evidence.id,evidence.at,evidence.magnitude,evidence.depth,evidence.tsunamiSummary]);
 const key='seismic-insight:v1:'+revision.slice(0,440);
 const base={version:'seismic-insight-v1',id:evidence.id,title:evidence.title,source:evidence.source,
  eventAt:evidence.at,magnitude:evidence.magnitude,depth:evidence.depth,expiresAt:Math.min(now+15*MIN,evidence.at+72*3600000),
  disclaimer:'Explicação educativa de dados publicados, não é previsão sísmica, avaliação oficial de danos ou alerta de tsunami.'};
 const section=focus=>Object.entries(evidence.notes).map(([id,text])=>({id,title:{
  size:'Magnitude e energia',depth:'Profundidade e propagação',shaking:'Intensidade e impactos',tsunami:'Tsunami e boletins',
  revisions:'Revisões das fontes',science:'Limites científicos'}[id],text,focus:focus.includes(id)}));
 try{
  const saved=await storage.get(key);
  if(saved?.status==='ready'&&saved.until>now){
   return json({...base,status:'ready',model:saved.model,sections:section(saved.focus||[]),generatedAt:saved.at});
  }
  if(saved?.until>now)return json({...base,status:saved.status==='pending'?'pending':'unavailable',
   reason:saved.reason||'',retryAfter:saved.status==='pending'?3:300});
  const haveModel=Boolean(env.GEMINI_API_KEY||env.AI);
  if(!haveModel)return json({...base,status:'ready',model:'validated-science-v1',sections:section([]),generatedAt:now});
  const stamp=dayKey(now),month=stamp.slice(0,7),old=await storage.get('seismic-insight:budget');
  const budget={day:stamp,month,daily:old?.day===stamp?old.daily:0,monthly:old?.month===month?old.monthly:0};
  if(budget.daily>=LIMIT.daily||budget.monthly>=LIMIT.monthly)
   return json({...base,status:'ready',model:'validated-science-v1',sections:section([]),generatedAt:now,limited:true});
  budget.daily++;budget.monthly++;await storage.put('seismic-insight:budget',budget);
  const keys=evidence.keys;
  const prompt='Escolha de uma a duas seções técnicas mais úteis para destacar no relatório científico deste sismo. Retorne SOMENTE JSON {"facts":["ids"]} com IDs permitidos. Não escreva outras frases nem novos números. IDs e textos baseados em fonte validada: '+JSON.stringify(evidence.notes);
  const context={kind:'seismic',keys,facts:evidence.notes};
  await storage.put(key,{status:'pending',until:now+2*MIN});
  const job=(async()=>{
   let model='validated-science-v1',focus=[];
   try{
    const result=await selectWithFallback(env,context,prompt,fetchGemini);
    model=result.model;focus=result.facts;
   }catch{ /* Keep fully grounded scientific report even when both LLMs fail. */ }
   try{await storage.put(key,{status:'ready',focus,model,at:now,until:now+15*MIN});}catch{}
  })();
  waitUntil(job);
  return json({...base,status:'pending',retryAfter:3});
 }catch{
  return json({...base,status:'ready',model:'validated-science-v1',sections:section([]),generatedAt:now,
   note:'A avaliação da IA está indisponível; explicações científicas verificadas permanecem acessíveis.'});
 }
}
