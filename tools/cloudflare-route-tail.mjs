/* Ephemeral observation of natural traffic. Never writes raw logs, URLs or headers. */
import {writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const routes=new Set(['/tv-alerts','/tv-daily-summary','/population-exposure','/rupture-shaking','/seismic-image','/earthquake-image','/tsunami-image','/weatherapi','/rain-weather','/rain-nowcast','/global-feeds','/tsunami-alerts','/v70-impact','/telegram-card-preview','/official-weather-alerts','/cge-bulletins','/metar-observed','/redemet-metar','/tts','/health','/global-volcano','/gdacs-floods','/seismic-status','/sp-clima']);
export function classify(message){
 let route='other';try{const u=new URL(message.event?.request?.url);route=u.pathname.startsWith('/telegram-image/')?'/telegram-image/*':u.pathname.startsWith('/telegram-summary-image/')?'/telegram-summary-image/*':routes.has(u.pathname)?u.pathname:u.pathname==='/'?(u.searchParams.has('url')?'public-proxy':'root'):'other';}catch{route=message.event?.cron?'scheduled':message.event?.scheduledTime?'alarm':'other';}
 const outcome=['ok','exception','exceededCpu','exceededMemory','exceededResources','canceled','unknown'].includes(message.outcome)?message.outcome:'other';
 return {route,outcome};
}
export const captureSeconds=value=>Math.min(300,Math.max(30,Number.parseInt(value||'120',10)||120));
export async function observe(){
 const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
 if(!token||!/^([a-f0-9]{32})$/i.test(account||''))throw Error('Missing Cloudflare Secrets');
 const base=`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/black-sky-9ba0/tails`;
 async function api(url,method,body){const r=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`Tail API HTTP ${r.status}`);const data=await r.json();if(data.success===false)throw Error('Tail API refused');return data.result;}
 const seconds=captureSeconds(process.env.TAIL_SECONDS);
 let session,ws;const counts={},report={startedAt:new Date().toISOString(),seconds,events:0,counts,rawLogsStored:false,syntheticRequests:0,cpuRouteAttribution:'Not available from legacy tail CPU metrics; outcomes only'};
 try{
  session=await api(base,'POST',{filters:[]});
  if(!/^[a-f0-9-]{32,36}$/i.test(session?.id||'')||!String(session?.url).startsWith('wss://'))throw Error('Unexpected tail response');
  ws=new WebSocket(session.url,'trace-v1');ws.binaryType='arraybuffer';
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>resolve(),seconds*1000);const end=()=>{clearTimeout(timer);resolve();};ws.addEventListener('open',()=>ws.send(JSON.stringify({debug:false})));ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Tail connection failed'));});ws.addEventListener('close',end);ws.addEventListener('message',e=>{try{if(typeof e.data!=='string'&&e.data.byteLength>1048576)return;const raw=typeof e.data==='string'?e.data:new TextDecoder().decode(e.data);if(raw.length>1048576)return;const row=classify(JSON.parse(raw)),key=row.route+' '+row.outcome;counts[key]=(counts[key]||0)+1;if(++report.events>=2000)end();}catch{/* Discard malformed records. */}});});
 }catch(e){report.blocked=true;report.reason=e.message==='Tail connection failed'?e.message:/^Tail API HTTP \d+$/.test(e.message)?e.message:'Tail observation unavailable';}
 finally{
  ws?.close();
  if(session?.id&&/^[a-f0-9-]{32,36}$/i.test(session.id)){try{await api(base+'/'+session.id,'DELETE');report.sessionRemoved=true;}catch{report.sessionRemoved=false;}}
  report.endedAt=new Date().toISOString();report.elapsedSeconds=Math.round((Date.parse(report.endedAt)-Date.parse(report.startedAt))/1000);report.noObservedEvents=report.events===0;await mkdir('audit-results',{recursive:true});await writeFile('audit-results/route-tail.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }
 if(report.blocked||report.sessionRemoved===false)process.exitCode=2;
}
// Node's WebSocket may retain a TCP close handle after session deletion.
// All report writes and the DELETE have completed before ending this CLI.
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){await observe();process.exit(process.exitCode||0);}
