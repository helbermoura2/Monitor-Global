/* Versioned code/styles are reusable; HTML is network-first. Live data bypass caches. */
const SHELL='monitor-global-shell-v20261017',ASSETS='monitor-global-assets-v20261017',LIMIT=240;
let writes=Promise.resolve();
function store(name,request,response){
 writes=writes.catch(()=>{}).then(async()=>{
  const cache=await caches.open(name);await cache.put(request,response);
  const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-(name===ASSETS?LIMIT:5))))await cache.delete(key);
 });return writes;
}
self.addEventListener('install',event=>{event.waitUntil((async()=>{
 const cache=await caches.open(SHELL);
 await Promise.all(['./','./index.html','./manifest.webmanifest'].map(u=>cache.add(u).catch(()=>null)));
 await self.skipWaiting();
})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('monitor-global-')&&k!==SHELL&&k!==ASSETS).map(k=>caches.delete(k)));
 await self.clients.claim();
})());});
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET'||request.cache==='no-store')return;
 const url=new URL(request.url);if(url.origin!==self.location.origin)return;
 // Only explicitly versioned executable assets. No API, JSON, tiles, credentials or images.
 const versioned=url.searchParams.has('v')&&/(?:^|\/)(?:js|css|vendor)\/[^?#]+\.(?:js|css)$/.test(url.pathname);
 const navigation=request.mode==='navigate',manifest=/\/manifest\.webmanifest$/.test(url.pathname);
 if(!versioned&&!navigation&&!manifest)return;
 event.respondWith((async()=>{
  const cache=await caches.open(versioned?ASSETS:SHELL),cached=await cache.match(request);
  if(versioned&&cached)return cached;
  try{
   const response=await fetch(request);
   const appDocument=navigation&&/(?:\/|\/index\.html)$/.test(url.pathname)&&response.headers.get('content-type')?.includes('text/html');
   if(response.ok&&response.type!=='opaque'&&(versioned||manifest||appDocument))event.waitUntil(store(versioned?ASSETS:SHELL,appDocument?'./index.html':request,response.clone()));
   return response;
  }catch(error){
   if(cached)return cached;
   if(navigation){const fallback=await cache.match('./index.html')||await cache.match('./');if(fallback)return fallback;}
   throw error;
  }
 })());
});
