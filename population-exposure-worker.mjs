// Population exposure: WorldPop gridded stats and USGS PAGER products.
// Independent implementation of the published Allen/Wald/Worden (2012)
// hypocentral intensity equation. See docs/population-exposure.md.
const pending=new Map(),memory=new Map();
const YEAR=2020,VERSION='exposure-v1';
const headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
const radians=x=>x*Math.PI/180;
export function distanceKm(a,b,c,d){
 const x=Math.sin(radians(c-a)/2)**2+Math.cos(radians(a))*Math.cos(radians(c))*Math.sin(radians(d-b)/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
}
export function intensityAt(mag,depth,distance){
 const hypo=Math.hypot(distance,depth>0?Math.max(1,depth):10);
 const smoothing=-0.209+2.042*Math.exp(mag-5);
 return 2.085+1.428*mag-1.402*Math.log(Math.hypot(hypo,smoothing))+(hypo>50?0.078*Math.log(hypo/50):0);
}
export function exposureRadii(mag,depth){
 return [2.5,4.5,5.5].map((threshold,index)=>{
  let low=0,high=500;
  const empty=intensityAt(mag,depth,0)<threshold;
  if(!empty)for(let i=0;i<40;i++){const mid=(low+high)/2;if(intensityAt(mag,depth,mid)>=threshold)low=mid;else high=mid;}
  return {mmi:index===0?'III+':index===1?'V+':'VI+',label:['Fraco ou maior','Moderado ou maior','Forte ou maior'][index],threshold,radiusKm:empty?0:low,limited:!empty&&intensityAt(mag,depth,500)>=threshold};
 });
}
function clip(points,bound,keepGreater){
 const out=[];
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],inside=x=>keepGreater?x[0]>=bound:x[0]<=bound;
  if(inside(a))out.push(a);
  if(inside(a)!==inside(b)){const t=(bound-a[0])/(b[0]-a[0]);out.push([bound,a[1]+t*(b[1]-a[1])]);}
 }
 return out;
}
export function circleGeometry(lat,lng,radius){
 const points=[],angular=radius/6371,p=radians(lat),l=radians(lng);
 for(let i=0;i<96;i++){
  const bearing=2*Math.PI*i/96;
  const y=Math.asin(Math.sin(p)*Math.cos(angular)+Math.cos(p)*Math.sin(angular)*Math.cos(bearing));
  const x=l+Math.atan2(Math.sin(bearing)*Math.sin(angular)*Math.cos(p),Math.cos(angular)-Math.sin(p)*Math.sin(y));
  points.push([x*180/Math.PI,y*180/Math.PI]);
 }
 const min=Math.min(...points.map(p=>p[0])),max=Math.max(...points.map(p=>p[0])),polygons=[];
 for(let band=Math.floor((min+180)/360);band<=Math.floor((max+180)/360);band++){
  const lower=-180+360*band,upper=180+360*band;
  const ring=clip(clip(points,lower,true),upper,false).map(p=>[p[0]-360*band,p[1]]);
  if(ring.length>=3){ring.push([...ring[0]]);polygons.push([ring]);}
 }
 return polygons.length===1?{type:'Polygon',coordinates:polygons[0]}:{type:'MultiPolygon',coordinates:polygons};
}
export function parsePagerXML(xml){
 if(!/<pager(?:\s|>)/i.test(xml))throw Error('Produto PAGER inválido');
 const rows=[];
 for(const m of xml.matchAll(/<exposure\b([^>]*?)\/?\s*>/gi)){
  const attrs=Object.fromEntries([...m[1].matchAll(/([\w]+)\s*=\s*["']([^"']*)["']/g)].map(a=>[a[1],a[2]]));
  if(!attrs.dmin||!attrs.dmax||attrs.exposure===undefined||attrs.exposure.trim()==='')continue;
  const min=Number(attrs.dmin),max=Number(attrs.dmax),population=Number(attrs.exposure);
  if(![min,max,population].every(Number.isFinite)||population<0||max<=min||min<0||max>12)continue;
  rows.push({min,max,population,inside:attrs.rangeInsideMap==='1'});
 }
 if(!rows.length)throw Error('PAGER sem exposição populacional');
 rows.sort((a,b)=>a.min-b.min);
 if(rows.some((r,i)=>i&&r.min<rows[i-1].max-1e-6))throw Error('Faixas PAGER sobrepostas');
 if(rows[0].min>0.5||rows.at(-1).max<10.5||rows.some((r,i)=>i&&Math.abs(r.min-rows[i-1].max)>1e-6))throw Error('Faixas PAGER incompletas');
 const ranges=exposureRadii(5,10).map(r=>{
  const included=rows.filter(x=>x.min>=r.threshold-1e-6);
  return {mmi:r.mmi,label:r.label,population:included.reduce((s,x)=>s+x.population,0),partial:included.some(x=>!x.inside)};
 });
 return {ranges,partial:ranges.some(r=>r.partial)};
}
async function remote(url,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
 try{
  const r=await fetch(url,{...options,signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);
  return await r.text();
 }finally{clearTimeout(timer);}
}
async function officialPager(params){
 if(!params.eventId)return null;
 const url='https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid='+encodeURIComponent(params.eventId);
 const detail=JSON.parse(await remote(url)),coords=detail.geometry?.coordinates,p=detail.properties;
 if(!coords||!p||distanceKm(params.lat,params.lng,coords[1],coords[0])>80||Math.abs(Number(p.mag)-params.mag)>1.5||Math.abs(Number(p.time)-params.time)>300000)return null;
 const products=(p.products?.losspager||[]).filter(x=>x.status!=='DELETE').sort((a,b)=>Number(b.preferredWeight||0)-Number(a.preferredWeight||0)||Number(b.updateTime||0)-Number(a.updateTime||0));
 const product=products.find(x=>x.contents?.['pager.xml']?.url);if(!product)return null;
 const productURL=new URL(product.contents['pager.xml'].url);
 if(productURL.protocol!=='https:'||productURL.hostname!=='earthquake.usgs.gov')return null;
 const parsed=parsePagerXML(await remote(productURL.toString()));
 return {status:'available',provider:'USGS PAGER / ShakeMap',method:'pager',...parsed,updatedAt:product.updateTime||null,url:'https://earthquake.usgs.gov/earthquakes/eventpage/'+encodeURIComponent(params.eventId)+'/pager',note:'Exposição estimada publicada pelo USGS, baseada no tremor do ShakeMap. Não é contagem de feridos ou de relatos.'};
}
export function worldPopResult(data){
 if(data.error===true||data.error==='true'||data.status==='ERROR'||data.status==='failed')return {state:'failed'};
 const value=data.data?.total_population??data.total_population;
 if(value!==undefined&&value!==null&&String(value).trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0)return {state:'finished',population:Number(value)};
 if(data.taskid&&/^[a-zA-Z0-9_-]{1,120}$/.test(String(data.taskid)))return {state:'pending',taskid:String(data.taskid)};
 return {state:'pending'};
}
async function storageRead(env,key){
 const hit=memory.get(key);if(hit&&hit.until>Date.now())return hit.value;
 try{const stored=await env.TTS_USAGE?.get(key,'json');if(stored&&stored.until>Date.now()){memory.set(key,stored);return stored.value;}}catch{}
 return null;
}
async function storageWrite(env,key,value,seconds){
 const entry={until:Date.now()+seconds*1000,value};memory.set(key,entry);
 if(memory.size>200)memory.delete(memory.keys().next().value);
 try{await env.TTS_USAGE?.put(key,JSON.stringify(entry),{expirationTtl:Math.max(60,seconds)});}catch{}
}
async function runExposure(params,env,key){
 let state=await storageRead(env,key);
 if(state?.status==='available'||state?.status==='unsupported'||state?.status==='unavailable')return state;
 if(state?.status==='pending'&&Date.now()<state.nextPollAt)return {status:'pending',retryAfter:10,note:'Consultando população em grade…'};
 if(!state){
  try{const pager=await officialPager(params);if(pager){await storageWrite(env,key,pager,300);return pager;}}catch{}
  if(params.mag<3||params.mag>8.5||params.depth>70||Math.abs(params.lat)>85){
   const unsupported={status:'unsupported',note:'Sem PAGER disponível. O modelo do app não foi aplicado: magnitude, profundidade ou latitude fora da faixa utilizada.'};
   await storageWrite(env,key,unsupported,180);return unsupported;
  }
  state={status:'pending',created:Date.now(),ranges:exposureRadii(params.mag,params.depth)};
 }
 if(Date.now()-state.created>180000){const failed={status:'unavailable',note:'WorldPop não concluiu a consulta no prazo. A estimativa por localidades continua disponível.'};await storageWrite(env,key,failed,180);return failed;}
 let failed=false;
 // No máximo 3 consultas por sismo; tarefas pendentes são reutilizadas.
 for(const range of state.ranges){
  if(range.population!==undefined)continue;
  if(range.radiusKm===0){range.population=0;continue;}
  try{
   const options=range.taskid?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataset:'wpgppop',year:YEAR,geojson:JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:circleGeometry(params.lat,params.lng,range.radiusKm)}]}),runasync:'true',...(env.WORLDPOP_API_KEY?{key:env.WORLDPOP_API_KEY}:{})})};
   const url=range.taskid?'https://api.worldpop.org/v1/tasks/'+encodeURIComponent(range.taskid):'https://api.worldpop.org/v1/services/stats';
   const result=worldPopResult(JSON.parse(await remote(url,options)));
   if(result.state==='failed'||(!range.taskid&&result.state==='pending'&&!result.taskid)){failed=true;break;}
   if(result.state==='finished')range.population=result.population;
   else if(result.taskid)range.taskid=result.taskid;
  }catch{failed=true;break;}
 }
 if(failed){const unavailable={status:'unavailable',note:'A consulta à população em grade está indisponível. A estimativa por localidades continua disponível.'};await storageWrite(env,key,unavailable,180);return unavailable;}
 if(state.ranges.every(r=>r.population!==undefined)){
  // Círculos são inclusivos: nunca somar as faixas nem forçar monotonicidade.
  if(state.ranges.some((r,i)=>i&&r.population>state.ranges[i-1].population+1)){
   const unavailable={status:'unavailable',note:'As consultas retornaram populações inconsistentes; o total não foi exibido.'};await storageWrite(env,key,unavailable,180);return unavailable;
  }
  const available={status:'available',provider:'WorldPop',method:'worldpop',year:YEAR,ranges:state.ranges.map(({taskid,...r})=>r),partial:state.ranges.some(r=>r.limited),model:'Allen, Wald e Worden (2012), distância hipocentral',depthAssumed:params.depth===0,note:(params.depth===0?'Profundidade informada como zero: adotados 10 km no modelo; essa suposição pode alterar os totais. ':'')+'População em grade dentro de áreas de intensidade estimada pelo app. Inclui áreas rurais. Modelo radial sem efeitos locais do solo, direção da ruptura ou incerteza estatística; não equivale ao ShakeMap.'};
  await storageWrite(env,key,available,86400);return available;
 }
 state.nextPollAt=Date.now()+10000;await storageWrite(env,key,state,180);return {status:'pending',retryAfter:10,note:'Consultando população em grade…'};
}
export async function handlePopulationExposure(request,env){
 if(request.method!=='GET')return response({status:'invalid',note:'Método não permitido'},405);
 const url=new URL(request.url),params={};
 for(const field of ['lat','lng','mag','depth','time']){
  const raw=url.searchParams.get(field);if(raw===null||raw.trim()===''||!Number.isFinite(Number(raw)))return response({status:'invalid',note:'Parâmetros incompletos'},400);
  params[field]=Number(raw);
 }
 if(Math.abs(params.lat)>90||Math.abs(params.lng)>180||params.mag<0||params.mag>10||params.depth<0||params.depth>800||params.time<0||params.time>Date.now()+3600000)return response({status:'invalid',note:'Parâmetros inválidos'},400);
 params.eventId=url.searchParams.get('eventId')||'';
 if(params.eventId&&!/^[a-zA-Z0-9_-]{2,100}$/.test(params.eventId))return response({status:'invalid',note:'Identificador inválido'},400);
 const canonical=[params.lat.toFixed(4),params.lng.toFixed(4),params.mag.toFixed(2),params.depth.toFixed(1),params.eventId,Math.floor(params.time/1000)].join('|');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
 const key=VERSION+':'+[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
 if(!pending.has(key))pending.set(key,runExposure(params,env,key).finally(()=>pending.delete(key)));
 try{return response(await pending.get(key));}catch{return response({status:'unavailable',note:'A consulta de exposição está temporariamente indisponível.'},502);}
}
