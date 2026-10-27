/* On-demand official products, bounded cache and one request per foreground/background channel. */
(function(){
 const cache=new Map();const jobs={foreground:null,background:null};
 const signature=q=>[q.id,q.coords,q.mag,q.time].join('|');
 function cancel(channel='foreground'){jobs[channel]?.controller.abort();jobs[channel]=null;}
 function get(q){const hit=cache.get(signature(q));return hit&&hit.until>Date.now()?hit.data:null;}
 // The proxy already validates event association. Fetch the geometry only
 // for that exact USGS event, never replacing its intensity grid.
 async function publishedRupture(data,signal){
  if(data.method!=='usgs-shakemap-finite'||!/^[-_a-zA-Z0-9]{2,100}$/.test(data.eventId||''))return null;
  const geometryController=new AbortController(),abort=()=>geometryController.abort(),timer=setTimeout(abort,6000);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  const read=async url=>{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='earthquake.usgs.gov'||u.port||u.username||u.password)throw Error('Fonte inválida');
   const r=await fetch(u.href,{signal:geometryController.signal,redirect:'error'});if(!r.ok||Number(r.headers?.get('content-length'))>1500000)throw Error('Geometria indisponível');const text=await r.text();if(text.length>1500000)throw Error('Geometria excessiva');return JSON.parse(text);};
  try{const detail=await read('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid='+encodeURIComponent(data.eventId));if(detail.id!==data.eventId)return null;
   const products=(detail.properties?.products?.shakemap||[]).filter(p=>p.status!=='DELETE');
   const product=products.find(p=>String(p.code)+'-'+p.updateTime===data.version);const url=product?.contents?.['download/rupture.json']?.url;
   if(!url)return null;return window.RuptureShakingModel.ruptureProjection(await read(url),data.grid);
  }catch{return null;}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
 }
 async function primaryProduct(url,signal){
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,20000);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)return null;const d=await r.json();return d.status==='available'&&['usgs-shakemap-finite','usgs-shakemap-grid'].includes(d.method)&&window.RuptureShakingModel.valid(d.grid)?d:null;}catch{return null;}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
 }
 function query(q,options={}){
  const channel=options.background?'background':'foreground';
  if(!q?.coords||!Number.isFinite(Number(q.mag))||q.mag<5.5||!Number.isFinite(q.time))return Promise.resolve(null);const key=signature(q),hit=cache.get(key);if(hit&&hit.until>Date.now())return Promise.resolve(hit.data);for(const job of Object.values(jobs))if(job?.key===key)return job.promise;cancel(channel);
  const u=new URL(WORKER_PROXY(''));u.pathname='/rupture-shaking';u.search='';const report=(q.reports||[]).find(r=>/^USGS(?:-RT)?$/i.test(r.source||''))||(/^USGS(?:-RT)?$/i.test(q.source||'')?q:null),id=report?String(report.sourceEventId||report.id||'').replace(/^USGS-(?:RT-)?/i,''):'';
  for(const [k,v]of Object.entries({lat:q.coords[1],lng:q.coords[0],mag:q.mag,time:q.time,...(id?{eventId:id}:{})}))u.searchParams.set(k,String(v));
  const controller=new AbortController(),job={key,controller};jobs[channel]=job;job.promise=(async()=>{const timer=setTimeout(()=>controller.abort(),42000);try{let data=await primaryProduct(u,controller.signal);if(!data&&!controller.signal.aborted)data=await window.OfficialMapSources?.query(q,controller.signal)||null;if(data){try{window.EventInsights?.mapProduct(q,data);}catch{}const projection=data.rupture?null:await publishedRupture(data,controller.signal);if(controller.signal.aborted)return null;if(projection)data.rupture=projection;}if(controller.signal.aborted)return null;cache.set(key,{data,until:Date.now()+(data?.status==='available'?300000:60000)});if(cache.size>4)cache.delete(cache.keys().next().value);return data;}catch{return null;}finally{clearTimeout(timer);if(jobs[channel]===job)jobs[channel]=null;}})();return job.promise;
 }
 window.addEventListener('pagehide',()=>{cancel();cancel('background');cache.clear();});window.RuptureShaking={query,get,cancel,stats:()=>({entries:cache.size,inflight:Object.values(jobs).filter(Boolean).length,gridCells:[...cache.values()].reduce((n,r)=>n+(r.data?.grid?.values?.length||0),0)})};
})();
