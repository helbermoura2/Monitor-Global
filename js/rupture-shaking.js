/* On-demand official products, bounded cache and one request per foreground/background channel. */
(function(){
 const cache=new Map();const jobs={foreground:null,background:null};
 const signature=q=>[q.id,q.coords,q.mag,q.time].join('|');
 function cancel(channel='foreground'){jobs[channel]?.controller.abort();jobs[channel]=null;}
 function get(q){const hit=cache.get(signature(q));return hit&&hit.until>Date.now()?hit.data:null;}
 function query(q,options={}){
  const channel=options.background?'background':'foreground';
  if(!q?.coords||!Number.isFinite(Number(q.mag))||q.mag<5.5||!Number.isFinite(q.time))return Promise.resolve(null);const key=signature(q),hit=cache.get(key);if(hit&&hit.until>Date.now())return Promise.resolve(hit.data);for(const job of Object.values(jobs))if(job?.key===key)return job.promise;cancel(channel);
  const u=new URL(WORKER_PROXY(''));u.pathname='/rupture-shaking';u.search='';const report=(q.reports||[]).find(r=>/^USGS(?:-RT)?$/i.test(r.source||''))||(/^USGS(?:-RT)?$/i.test(q.source||'')?q:null),id=report?String(report.sourceEventId||report.id||'').replace(/^USGS-(?:RT-)?/i,''):'';
  for(const [k,v]of Object.entries({lat:q.coords[1],lng:q.coords[0],mag:q.mag,time:q.time,...(id?{eventId:id}:{})}))u.searchParams.set(k,String(v));
  const controller=new AbortController(),job={key,controller};jobs[channel]=job;job.promise=(async()=>{const timer=setTimeout(()=>controller.abort(),28000);try{const r=await fetch(u,{signal:controller.signal});if(!r.ok)throw Error('Produto indisponível');const d=await r.json(),data=d.status==='available'&&['usgs-shakemap-finite','usgs-shakemap-grid'].includes(d.method)&&window.RuptureShakingModel.valid(d.grid)?d:null;cache.set(key,{data,until:Date.now()+(data?300000:60000)});if(cache.size>4)cache.delete(cache.keys().next().value);return data;}catch{return null;}finally{clearTimeout(timer);if(jobs[channel]===job)jobs[channel]=null;}})();return job.promise;
 }
 window.addEventListener('pagehide',()=>{cancel();cancel('background');});window.RuptureShaking={query,get,cancel};
})();
