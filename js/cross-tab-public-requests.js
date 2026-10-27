/* Same-origin tabs reuse only the server's remaining public source freshness.
   Disk cache: at most eight 512 KiB bodies; no heartbeat, subscriptions or RAM cache. */
(function(root){'use strict';
 const NAME='monitor-public-source-v1',MAX=512*1024;let hits=0;
 const routes=new Set(['/sp-clima','/global-feeds','/global-volcano','/usgs-volcano','/gdacs-volcano','/gdacs-floods','/afad-earthquakes','/ingv-earthquakes','/jma-earthquakes','/funvisis-earthquakes','/seismic-status','/official-weather-alerts','/cge-bulletins','/metar-observed','/tsunami-alerts','/v70-cyclones']);
 async function run(request,key,signal,load){
  const u=new URL(request.url);
  // Only endpoints covered by the backend shared-source freshness contract.
  if(!routes.has(u.pathname)&&!(u.pathname==='/'&&u.searchParams.has('url')&&!/overpass/i.test(u.searchParams.get('url'))))return load();
  if(!root.navigator?.locks||!root.caches||!root.crypto?.subtle||u.hostname!=='black-sky-9ba0.terrestre.workers.dev'||request.cache==='reload'||request.cache==='no-cache'||request.cache==='no-store'||[...u.searchParams.keys()].some(k=>/^(?:t|_|_t|force|nocache|cachebuster)$/i.test(k))||(request.headers.has('cache-control')||request.headers.has('pragma')))return load();
  let hash;try{hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))),b=>b.toString(16).padStart(2,'0')).join('');}catch{return load();}
  let entered=false;try{return await root.navigator.locks.request(NAME+'-'+hash,{signal},async()=>{
   entered=true;
   if(signal.aborted)throw new DOMException('Consulta interrompida','AbortError');
   let store,address=new URL('/__public-source-cache__/'+hash,root.location.origin).href;
   try{
    store=await root.caches.open(NAME);
    for(const k of await store.keys()){const r=await store.match(k);if(Number(r?.headers.get('X-Monitor-Local-Until'))<=Date.now())await store.delete(k);}
    const hit=await store.match(address);
    if(hit&&Number(hit.headers.get('X-Monitor-Local-Until'))>Date.now()){const headers=[...hit.headers].filter(([n])=>n!=='x-monitor-local-until');hits++;return {status:hit.status,statusText:hit.statusText,headers,body:new Uint8Array(await hit.arrayBuffer())};}
   }catch{store=null;}
   const data=await load();if(signal.aborted)return data;
   const headers=new Headers(data.headers),until=Math.min(Number(headers.get('X-Monitor-Source-Fresh-Until')),Date.now()+15000);
   if(store&&data.status===200&&data.body.byteLength<=MAX&&headers.get('X-Monitor-Source-State')==='fresh'&&Number(headers.get('X-Monitor-Source-Last-Ok'))>0&&until>Date.now()){
    try{headers.set('X-Monitor-Local-Until',String(until));await root.navigator.locks.request(NAME+'-storage',async()=>{await store.put(address,new Response(data.body,{status:data.status,statusText:data.statusText,headers}));const keys=await store.keys();for(const k of keys.slice(0,Math.max(0,keys.length-8)))await store.delete(k);});}catch{/* Storage disabled/full: ordinary network behavior. */}
   }
   return data;
  });}catch(error){if(!entered&&!signal.aborted)return load();throw error;}
 }
 root.CrossTabPublicRequests={run,stats:()=>({hits,maxEntries:8,maxBodyBytes:MAX})};
})(window);
