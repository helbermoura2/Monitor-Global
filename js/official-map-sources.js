/* Additional published products. Never derive fault strike from focal nodal planes. */
(function(root){
 'use strict';
 const CODES={eu:'ShakeMap-EU',ingv:'INGV'};
 let manifest=null,manifestUntil=0,manifestJob=null;
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function distance(a,b){const r=Math.PI/180,dy=(a.lat-b.lat)*r,dx=(a.lng-b.lng)*r,h=Math.sin(dy/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dx/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,h)));}
 function matches(q,o){return o&&[q.time,q.mag,q.coords?.[0],q.coords?.[1],o.time,o.mag,o.lng,o.lat].every(finite)&&Math.abs(q.time-o.time)<=30000&&Math.abs(q.mag-o.mag)<=1.5&&distance({lng:q.coords[0],lat:q.coords[1]},o)<=80;}
 async function read(url,signal,max=1500000){
  const r=await fetch(url,{signal,redirect:'error'});if(!r.ok||Number(r.headers?.get('content-length'))>max)throw Error('Produto indisponível');
  const text=await r.text();if(text.length>max)throw Error('Produto excessivo');return JSON.parse(text);
 }
 async function catalogue(){
  if(manifestUntil>Date.now())return manifest||[];if(manifestJob)return manifestJob;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
  manifestJob=read('data/official-shaking/index.json?refresh='+Math.floor(Date.now()/60000),controller.signal).then(d=>{
   if(!Array.isArray(d.events)||d.events.length>100)throw Error('Catálogo inválido');manifest=d.events;manifestUntil=Date.now()+60000;return manifest;
  }).catch(()=>{manifestUntil=Date.now()+60000;return manifest||[];}).finally(()=>{clearTimeout(timer);manifestJob=null;});return manifestJob;
 }
 async function regional(q,signal){
  try{
   const all=await catalogue();if(signal.aborted)return null;
   // Reject ambiguous matches within each provider; never choose a nearby aftershock.
   for(const source of ['ingv','eu']){try{
    const rows=all.filter(r=>r.source===source&&matches(q,r));if(rows.length!==1)continue;const row=rows[0];
    if(!/^[\w-]{2,100}$/.test(row.eventId)||row.path!==source+'/'+row.eventId+'.json')continue;
    const d=await read('data/official-shaking/'+row.path+'?v='+encodeURIComponent(row.version),signal);
    if(d.status!=='available'||d.source!==source||d.eventId!==row.eventId||d.version!==row.version||!matches(q,d.origin)||!root.RuptureShakingModel.valid(d.grid)||root.RuptureShakingModel.sample(d.grid,q.coords[0],q.coords[1])===null)continue;
    if(d.ruptureRaw)d.rupture=root.RuptureShakingModel.ruptureProjection(d.ruptureRaw,d.grid,CODES[source]);delete d.ruptureRaw;
    return d;
   }catch{if(signal.aborted)return null;}}
  }catch{}return null;
 }
 const products=(detail,name)=>(detail.properties?.products?.[name]||[]).filter(p=>p.status!=='DELETE').sort((a,b)=>Number(b.preferredWeight||0)-Number(a.preferredWeight||0)||Number(b.updateTime||0)-Number(a.updateTime||0));
 function projectionAt(raw,q,provider){
  // Geographic validation domain only. These null cells are never a shaking map.
  const domain={nx:2,ny:2,x0:q.coords[0]-30,x1:q.coords[0]+30,y0:Math.max(-90,q.coords[1]-15),y1:Math.min(90,q.coords[1]+15),values:[null,null,null,null]};
  return root.RuptureShakingModel.ruptureProjection(raw,domain,provider);
 }
 async function usgsRupture(q,signal){
  const safeRead=async url=>{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='earthquake.usgs.gov'||u.port||u.username||u.password)throw Error('Fonte inválida');return read(u.href,signal);};
  try{
   const report=(q.reports||[]).find(r=>/^USGS(?:-RT)?$/i.test(r.source||''))||(/^USGS(?:-RT)?$/i.test(q.source||'')?q:null);
   let id=report?String(report.sourceEventId||report.id||'').replace(/^USGS-(?:RT-)?/i,''):'';
   if(!/^[a-zA-Z0-9_-]{2,100}$/.test(id)){
    const p=new URLSearchParams({format:'geojson',starttime:new Date(q.time-30000).toISOString(),endtime:new Date(q.time+30000).toISOString(),latitude:q.coords[1],longitude:q.coords[0],maxradiuskm:80,minmagnitude:Math.max(0,q.mag-1.5),limit:20});
    const found=await safeRead('https://earthquake.usgs.gov/fdsnws/event/1/query?'+p),candidates=(found.features||[]).filter(d=>matches(q,{time:d.properties?.time,mag:d.properties?.mag,lng:d.geometry?.coordinates?.[0],lat:d.geometry?.coordinates?.[1]}));
    if(candidates.length!==1)return null;id=candidates[0].id;if(!/^[a-zA-Z0-9_-]{2,100}$/.test(id))return null;
   }
   const d=await safeRead('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid='+encodeURIComponent(id));
   if(d.id!==id||!matches(q,{time:d.properties?.time,mag:d.properties?.mag,lng:d.geometry?.coordinates?.[0],lat:d.geometry?.coordinates?.[1]}))return null;
   for(const [type,file] of [['shakemap','download/rupture.json'],['finite-fault','FFM.geojson']]){
    const p=products(d,type)[0],url=p?.contents?.[file]?.url;if(!url)continue;
    try{const raw=await safeRead(url),rupture=projectionAt(raw,q,'USGS');if(!rupture)continue;
     return {status:'rupture-only',method:'usgs-finite-rupture',provider:'USGS · ruptura finita',eventId:id,version:'rupture-'+p.code+'-'+p.updateTime,updatedAt:p.updateTime,rupture,url:'https://earthquake.usgs.gov/earthquakes/eventpage/'+encodeURIComponent(id)+'/finite-fault',note:'Projeção do modelo de ruptura publicado pelo USGS. Sem mapa oficial de intensidade: este traçado não delimita a área sentida nem confirma danos ou rachaduras no solo.'};
    }catch(error){if(signal.aborted)return null;}
   }
  }catch{}return null;
 }
 async function query(q,signal){
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,12000);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  try{const grid=await regional(q,controller.signal);if(grid)return grid;return await usgsRupture(q,controller.signal);}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);}
 }
 root.OfficialMapSources={query,matches,projectionAt};
})(window);
