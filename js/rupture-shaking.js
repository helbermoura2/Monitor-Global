/* On-demand official products, bounded cache and one active request. */
(function(){
 const cache=new Map();let active=null;
 const signature=q=>[q.id,q.coords,q.mag,q.time].join('|');
 function cancel(){active?.controller.abort();active=null;}
 function get(q){const hit=cache.get(signature(q));return hit&&hit.until>Date.now()?hit.data:null;}
 function query(q){
  if(!q?.coords||q.mag<5||!Number.isFinite(q.time))return Promise.resolve(null);const key=signature(q),hit=cache.get(key);if(hit&&hit.until>Date.now())return Promise.resolve(hit.data);if(active?.key===key)return active.promise;cancel();
  const u=new URL(WORKER_PROXY(''));u.pathname='/rupture-shaking';u.search='';const report=(q.reports||[]).find(r=>/^USGS(?:-RT)?$/i.test(r.source||''))||(/^USGS(?:-RT)?$/i.test(q.source||'')?q:null),id=report?String(report.sourceEventId||report.id||'').replace(/^USGS-(?:RT-)?/i,''):'';
  for(const [k,v]of Object.entries({lat:q.coords[1],lng:q.coords[0],mag:q.mag,time:q.time,...(id?{eventId:id}:{})}))u.searchParams.set(k,String(v));
  const controller=new AbortController(),job={key,controller};active=job;job.promise=(async()=>{const timer=setTimeout(()=>controller.abort(),28000);try{const r=await fetch(u,{signal:controller.signal});if(!r.ok)throw Error('Produto indisponível');const d=await r.json(),data=d.status==='available'&&d.method==='usgs-shakemap-finite'&&window.RuptureShakingModel.valid(d.grid)?d:null;cache.set(key,{data,until:Date.now()+300000});if(cache.size>4)cache.delete(cache.keys().next().value);return data;}catch{return null;}finally{clearTimeout(timer);if(active===job)active=null;}})();return job.promise;
 }
 window.addEventListener('pagehide',cancel);window.RuptureShaking={query,get,cancel};
})();
