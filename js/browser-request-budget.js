/* Share public GET bodies in flight only. No result cache, credentials or server writes. */
(function(root){'use strict';
 const jobs=new Map(),solo=new Set(),MAX_SHARED=8,MAX_BODY=4*1024*1024,cooldowns=new Map();
 const workerHost='black-sky-9ba0.terrestre.workers.dev';
 const routes=new Set(['/weatherapi','/redemet-metar','/v70-impact','/population-exposure','/rupture-shaking','/rain-weather','/rain-nowcast','/rainbow-snapshot','/sp-clima','/global-feeds','/global-volcano','/usgs-volcano','/gdacs-volcano','/gdacs-floods','/afad-earthquakes','/ingv-earthquakes','/jma-earthquakes','/funvisis-earthquakes','/seismic-status','/official-weather-alerts','/cge-bulletins','/metar-observed','/tsunami-alerts','/v70-cyclones','/v70-extremes','/v70-anomalies']);
 let suppressed=0;
 const abortError=()=>new DOMException('Consulta interrompida ou pausada.','AbortError');
 function eligible(request){
  if(request.method!=='GET'||request.credentials==='include')return false;
  const u=new URL(request.url);if(u.protocol!=='https:'||u.username||u.password)return false;
  if([...request.headers.keys()].some(k=>!['accept','content-type','cache-control','pragma'].includes(k)))return false;
  if([...u.searchParams.keys()].some(k=>/key|token|auth|password|signature|callback/i.test(k)))return false;
  if(/\.(png|jpe?g|webp|pbf|zip|mp[34]|woff2?)(?:$|\?)/i.test(u.pathname))return false;
  if(u.hostname===workerHost){
   if(routes.has(u.pathname))return true;
   const target=u.pathname==='/'&&u.searchParams.get('url');return !!target&&(!!root.SharedSourceDelivery?.shouldShare(target)||/^https:\/\/(?:overpass-api\.de|overpass\.kumi\.systems)\//.test(target));
  }
  return !!root.SharedSourceDelivery?.shouldShare(u.href);
 }
 function identity(request){const url=new URL(request.url);url.hash='';url.searchParams.sort();return JSON.stringify([url.href,[...request.headers].sort(),request.credentials,request.mode,request.redirect,request.cache,request.integrity]);}
 function response(data){const body=[204,205,304].includes(data.status)?null:new ReadableStream({start(c){c.enqueue(data.body);c.close();}});return new Response(body,{status:data.status,statusText:data.statusText,headers:data.headers});}
 async function read(result){
  const reader=result.body?.getReader(),chunks=[];let size=0;
  if(reader)for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>MAX_BODY){await reader.cancel();throw Error('Resposta pública acima do limite de compartilhamento.');}chunks.push(next.value);}
  const body=new Uint8Array(size);let offset=0;for(const c of chunks){body.set(c,offset);offset+=c.byteLength;}
  return {status:result.status,statusText:result.statusText,headers:[...result.headers],body};
 }
 function cooldownIdentity(request,key){try{const u=new URL(request.url),target=new URL(u.searchParams.get('url')||request.url);return /^(overpass-api\.de|overpass\.kumi\.systems)$/.test(target.hostname)?'overpass-unavailable':key;}catch{return key;}}
 function cooldownResponse(key){const row=cooldowns.get(key);if(!row)return null;if(row.until<=Date.now()){cooldowns.delete(key);return null;}suppressed++;return new Response('{"error":"Fonte aguardando nova tentativa"}',{status:row.status,headers:{...row.headers,'Content-Type':'application/json','X-Monitor-Source-State':'unavailable','X-Monitor-Source-Next-Retry':String(row.until),'Retry-After':String(Math.ceil((row.until-Date.now())/1000))}});}
 function rememberCooldown(key,r){const now=Date.now(),next=Number(r.headers.get('X-Monitor-Source-Next-Retry')),retry=r.headers.get('Retry-After');let until=0;
  if(r.headers.get('X-Monitor-Source-State')==='unavailable'&&next>now)until=next;
  else if([429,503].includes(r.status)&&retry){const seconds=Number(retry);until=Number.isFinite(seconds)?now+seconds*1000:Date.parse(retry);}
  if(!(until>now)&&(r.status>=500||[400,403,406].includes(r.status)))until=now+60000;
  if(key==='overpass-unavailable'&&(r.status>=500||[400,403,406,429].includes(r.status)))until=Math.max(until,now+300000);
  if(!(until>now))return;until=Math.min(until,now+30*60000);for(const [k,row]of cooldowns)if(row.until<=now)cooldowns.delete(k);cooldowns.delete(key);const headers={};for(const name of ['X-Monitor-Source','X-Monitor-Source-Last-Ok','X-Monitor-Source-Attempt']){const value=r.headers.get(name);if(value)headers[name]=value.slice(0,256);}cooldowns.set(key,{status:r.status>=400?r.status:503,until,headers});while(cooldowns.size>64)cooldowns.delete(cooldowns.keys().next().value);
 }
 function stop(job){if(jobs.get(job.key)===job)jobs.delete(job.key);for(const cancel of [...job.consumers])cancel();job.controller.abort();}
 function pause(){for(const job of [...jobs.values()])stop(job);for(const controller of solo)controller.abort();}
 function fetchPublic(request,nativeFetch,timeout){
  if(document.hidden||root.navigator?.onLine===false||request.signal.aborted)return Promise.reject(abortError());
  const key=identity(request),cooldownKey=cooldownIdentity(request,key),waiting=cooldownResponse(cooldownKey);if(waiting)return Promise.resolve(waiting);let job=jobs.get(key);
  if(!job&&jobs.size>=MAX_SHARED){
   // Overflow streams directly instead of buffering more large response bodies.
   const controller=new AbortController(),abort=()=>controller.abort();
   const signal=typeof AbortSignal.any==='function'?AbortSignal.any([request.signal,controller.signal]):controller.signal;
   if(typeof AbortSignal.any!=='function')request.signal.addEventListener('abort',abort,{once:true});
   solo.add(controller);const timer=setTimeout(abort,timeout);
   return nativeFetch(new Request(request,{signal})).then(r=>{rememberCooldown(cooldownKey,r);return r;}).finally(()=>{clearTimeout(timer);solo.delete(controller);request.signal.removeEventListener('abort',abort);});
  }
  if(!job){
   job={key,controller:new AbortController(),consumers:new Set(),settled:false};
   jobs.set(job.key,job);
   job.promise=(async()=>{try{const r=await nativeFetch(new Request(request,{signal:job.controller.signal}));rememberCooldown(cooldownKey,r);return await read(r);}finally{job.settled=true;if(jobs.get(job.key)===job)jobs.delete(job.key);}})();
  }
  const shared=job;
  return new Promise((resolve,reject)=>{
   let done=false,timer;
   const finish=(error,data)=>{if(done)return;done=true;clearTimeout(timer);request.signal.removeEventListener('abort',cancel);shared.consumers.delete(cancel);if(!shared.consumers.size&&!shared.settled){if(jobs.get(shared.key)===shared)jobs.delete(shared.key);shared.controller.abort();}if(error)reject(error);else resolve(response(data));};
   const cancel=()=>finish(abortError());shared.consumers.add(cancel);request.signal.addEventListener('abort',cancel,{once:true});timer=setTimeout(cancel,timeout);
   shared.promise.then(data=>finish(null,data),error=>finish(error));
   if(request.signal.aborted)cancel();
  });
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});root.addEventListener('pagehide',pause);
 root.BrowserRequestBudget={eligible,fetch:fetchPublic,stats:()=>({inflight:jobs.size,solo:solo.size,cooldowns:cooldowns.size,suppressed})};
})(window);
