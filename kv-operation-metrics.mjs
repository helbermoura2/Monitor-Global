// Application-observed KV attempts. No raw keys, texts, locations or KV counter writes.
const measured=new WeakSet(),ops={get:'read',getWithMetadata:'read',put:'write',delete:'delete',list:'list'};
const activities=new Set(['populationRequests','populationCacheHits','populationPendingPolls','populationStateWrites','voiceRequests','voiceCacheHits','voiceSyntheses','voiceQuotaDenied']);
export function kvFamily(key){
 key=String(key||'');
 if(key.startsWith('exposure-'))return 'population';
 if(/^usage-\d{4}-\d{2}$/.test(key))return 'voice';
 if(key.startsWith('pt-translation'))return 'translation';
 if(key.startsWith('telegram-history-preview:'))return 'telegramSummaryPreview';
 if(key.startsWith('telegram-history-'))return 'telegramAlertHistory';
 if(key==='telegram-daily-summary-sent')return 'telegramSummaryDelivery';
 if(key==='telegram-m6-sent-ids'||key.startsWith('telegram-brazil-baseline:'))return 'telegramDeduplication';
 if(key.startsWith('polls-'))return 'retiredPolls';
 return 'other';
}
export const activity=(env,name)=>env?.__kvUsage?.observe(name);
export async function withKvUsage(env,work,ctx){
 if(env?.__kvUsage&&measured.has(env.__kvUsage))return work(env);
 const rows={},activityCounts={};let finished=false,queued=false;
 const add=(key,count=1)=>{rows[key]=(rows[key]||0)+count;if(finished)schedule();};
 async function flush(){
  const counts={...rows},observations={...activityCounts};for(const key of Object.keys(rows))delete rows[key];for(const key of Object.keys(activityCounts))delete activityCounts[key];
  if(!Object.keys(counts).length&&!Object.keys(observations).length)return;
  if(!env?.EARTHQUAKE_ALERTS)return;
  const payload={id:crypto.randomUUID(),day:new Date().toISOString().slice(0,10),counts,activity:observations};
  try{const binding=env.EARTHQUAKE_ALERTS;const r=await binding.get(binding.idFromName('kv-operation-metrics-v1')).fetch(new Request('https://internal/__kv-usage/record',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}));if(!r.ok)throw Error();}catch{console.warn('Contagem KV: lote de métricas não confirmado.');}
 }
 function schedule(){if(queued)return;queued=true;const p=Promise.resolve().then(()=>{queued=false;return flush();});ctx?.waitUntil?.(p);return p;}
 const meter={observe(name){if(!activities.has(name))return;activityCounts[name]=(activityCounts[name]||0)+1;if(finished)schedule();}};measured.add(meter);
 const original=env?.TTS_USAGE;
 const scoped={...env,__kvUsage:meter};
 if(original)scoped.TTS_USAGE=new Proxy(original,{get(target,property){const value=Reflect.get(target,property);if(typeof value!=='function')return value;const op=ops[property];if(!op)return value.bind(target);return async(...args)=>{
  const keys=Array.isArray(args[0])?args[0]:[args[0]],families=op==='list'?['namespaceList']:keys.map(kvFamily);
  for(const family of families)add(family+'.'+op+'.attempted');
  try{const out=await value.apply(target,args);for(const family of families)add(family+'.'+op+'.succeeded');return out;}catch(error){for(const family of families)add(family+'.'+op+'.failed');throw error;}
 };}});
 try{return await work(scoped);}finally{finished=true;const p=flush();if(ctx?.waitUntil)ctx.waitUntil(p);else await p;}
}
export async function handleKvUsageObject(request,storage){
 const url=new URL(request.url),now=Date.now();
 if(url.pathname.endsWith('/record')){
  if(request.method!=='POST')return Response.json({error:'method'},{status:405});
  const text=await request.text();if(text.length>16000)return Response.json({error:'size'},{status:400});
  let p;try{p=JSON.parse(text);}catch{return Response.json({error:'json'},{status:400});}
  if(!p||typeof p!=='object'||Array.isArray(p)||!/^[a-f0-9-]{36}$/.test(p.id||'')||p.day!==new Date(now).toISOString().slice(0,10))return Response.json({error:'record'},{status:400});
  const counts=p.counts||{},observations=p.activity||{},families=new Set(['population','voice','translation','telegramSummaryPreview','telegramAlertHistory','telegramSummaryDelivery','telegramDeduplication','retiredPolls','other','namespaceList']);
  if(Object.keys(counts).some(k=>{const[f,o,s]=k.split('.');return k.split('.').length!==3||!families.has(f)||!['read','write','delete','list'].includes(o)||!['attempted','succeeded','failed'].includes(s)||!Number.isSafeInteger(counts[k])||counts[k]<0||counts[k]>10000;})||Object.keys(observations).some(k=>!activities.has(k)||!Number.isSafeInteger(observations[k])||observations[k]<0||observations[k]>10000))return Response.json({error:'counts'},{status:400});
  const key='kv-usage:'+p.day,record=await storage.get(key)||{version:1,day:p.day,startedAt:now,counts:{},activity:{},batches:0,recent:[]};
  if(record.recent.some(x=>x.id===p.id))return Response.json({ok:true,duplicate:true});
  for(const[k,v]of Object.entries(counts))record.counts[k]=(record.counts[k]||0)+v;
  for(const[k,v]of Object.entries(observations))record.activity[k]=(record.activity[k]||0)+v;
  record.updatedAt=now;record.batches++;record.recent=record.recent.filter(x=>now-x.at<600000).slice(-255);record.recent.push({id:p.id,at:now});await storage.put(key,record);
  if(record.batches===1){const old=await storage.list({prefix:'kv-usage:',limit:32});const cutoff=new Date(now-14*86400000).toISOString().slice(0,10);for(const k of old.keys())if(k.slice(9)<cutoff)await storage.delete(k);}
  return Response.json({ok:true});
 }
 const day=url.searchParams.get('day')||new Date(now).toISOString().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return Response.json({error:'day'},{status:400});
 const data=await storage.get('kv-usage:'+day);if(!data)return Response.json({available:false,day,note:'Nenhuma medição registrada para esta data; não representa histórico anterior à implantação.'});
 const {recent,...report}=data;return Response.json({available:true,...report,note:'Operações observadas pela aplicação; entrega de métricas pode falhar. Não é fatura nem atribuição retrospectiva.'});
}
export async function handleKvUsageRead(request,env){
 const supplied=request.headers.get('Authorization')||'',secret=env.KV_METRICS_READ_TOKEN;
 if(!secret||supplied!=='Bearer '+secret)return Response.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
 if(request.method!=='GET')return Response.json({error:'method'},{status:405});
 if(!env.EARTHQUAKE_ALERTS)return Response.json({available:false},{status:503});
 const url=new URL(request.url);url.pathname='/__kv-usage/read';
 const response=await env.EARTHQUAKE_ALERTS.get(env.EARTHQUAKE_ALERTS.idFromName('kv-operation-metrics-v1')).fetch(new Request(url));return new Response(response.body,{status:response.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
