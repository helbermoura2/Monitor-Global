/* Official USGS event details and aggregated DYFI cells, fetched on demand. */
(function(root){
'use strict';
const cache=new Map(),pending=new Map(),weights=new WeakMap(),MAX_BYTES=8*1024*1024;let retainedBytes=0,epoch=0;
function drop(key){const r=cache.get(key);if(r)retainedBytes-=r.bytes;cache.delete(key);}
function prune(){for(const [k,r]of cache)if(r.until<=Date.now())drop(k);while(cache.size>40||retainedBytes>MAX_BYTES)drop(cache.keys().next().value);}
const num=root.EventEvolutionModel.number;
function reportId(q){const r=(q?.reports||[]).find(r=>/^USGS(?:-RT)?$/i.test(r.source||''))||(/^USGS(?:-RT)?$/i.test(q?.source||'')?q:null);const id=String(r?.sourceEventId||r?.id||'').replace(/^USGS-(?:RT-)?/i,'');return /^[a-z0-9_-]{2,100}$/i.test(id)?id:null;}
function products(d,key){return(d?.properties?.products?.[key]||[]).filter(p=>p.status!=='DELETE').sort((a,b)=>(num(b.preferredWeight)||0)-(num(a.preferredWeight)||0)||(num(b.updateTime)||0)-(num(a.updateTime)||0));}
function matches(q,d){const c=d?.geometry?.coordinates,p=d?.properties;return Array.isArray(c)&&c.slice(0,2).every(Number.isFinite)&&Number.isFinite(p?.time)&&Math.abs(q.time-p.time)<=60000&&root.TsunamiLink.distance(q.coords,c)<=100&&Math.abs(q.mag-p.mag)<=1.5;}
async function json(url,max=2500000){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='earthquake.usgs.gov'||u.port||u.username||u.password)throw Error('Fonte inválida');const r=await fetch(u.href,{signal:AbortSignal.timeout(12000),redirect:'error'});if(!r.ok||Number(r.headers.get('content-length'))>max)throw Error('Produto indisponível');const t=await r.text();if(t.length>max)throw Error('Produto excessivo');const data=JSON.parse(t);if(data&&typeof data==='object')weights.set(data,t.length*2);return data;}
function remember(key,fn){prune();const old=cache.get(key);if(old){cache.delete(key);cache.set(key,old);return Promise.resolve(old.data);}if(pending.has(key))return pending.get(key);const generation=epoch;const job=fn().then(data=>{
 const bytes=data&&typeof data==='object'?weights.get(data)||JSON.stringify(data).length*2:0;
 if(generation===epoch&&bytes<=MAX_BYTES){drop(key);cache.set(key,{data,bytes,until:Date.now()+300000});retainedBytes+=bytes;prune();}return data;
}).finally(()=>pending.delete(key));pending.set(key,job);return job;}

function detail(q){const id=reportId(q);if(!id)return Promise.resolve(null);return remember('detail:'+id,()=>json('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid='+encodeURIComponent(id))).then(d=>d.id===id&&matches(q,d)?d:null);}
function cells(geo){
 if(geo?.type!=='FeatureCollection'||!Array.isArray(geo.features)||geo.features.length>12000)throw Error('Relatos inválidos');
 const out=[];
 for(const f of geo.features){const p=f.properties||{},n=num(p.nresp),cdi=num(p.cdi);if(!(n>=1)||cdi===null||cdi<1||cdi>12||!['Polygon','MultiPolygon'].includes(f.geometry?.type))continue;
  const points=[];const scan=c=>{if(!Array.isArray(c))throw Error('Coordenada inválida');if(typeof c[0]==='number'){if(c.length<2||!c.slice(0,2).every(Number.isFinite)||Math.abs(c[0])>180||Math.abs(c[1])>90)throw Error('Coordenada inválida');points.push(c);}else c.forEach(scan);};scan(f.geometry.coordinates);if(!points.length||points.length>2000)continue;
  // Centroid of a published aggregate cell, never a person's location.
  const anchor=points[0][0],xs=points.map(p=>anchor+((p[0]-anchor+540)%360-180));let lng=xs.reduce((a,b)=>a+b,0)/xs.length;lng=(lng+540)%360-180;
  const name=String(p.name||'Área de relatos').split(/<br\s*\/?\s*>/i).pop().replace(/<[^>]*>/g,'').slice(0,100);
  out.push({type:'Feature',geometry:{type:'Point',coordinates:[lng,points.reduce((a,p)=>a+p[1],0)/points.length]},properties:{name,nresp:Math.round(n),cdi}});
 }
 return {type:'FeatureCollection',features:out};
}
async function felt(q){const d=await detail(q);if(!d)return {status:'unsupported',count:null,data:null};root.EventInsights?.products(q,d);const p=products(d,'dyfi')[0],count=num(p?.properties?.['num-responses']??p?.properties?.numResp??d.properties.felt);if(!p)return {status:'unpublished',count,data:null,eventId:d.id};const content=p.contents?.['dyfi_geo_10km.geojson'];if(!content?.url)return {status:'unpublished',count,data:null,eventId:d.id};const data=await remember('felt:'+content.url,async()=>cells(await json(content.url)));return {status:data.features.length?'available':'empty',data,count,eventId:d.id,updatedAt:num(p.updateTime),url:'https://earthquake.usgs.gov/earthquakes/eventpage/'+d.id+'/dyfi'};}
root.addEventListener?.('pagehide',()=>{epoch++;cache.clear();retainedBytes=0;});
root.EventProducts={stats:()=>{prune();return {entries:cache.size,inflight:pending.size,estimatedTextBytes:retainedBytes,maxEstimatedTextBytes:MAX_BYTES};},detail,felt,cells,reportId,products,matches};
if(typeof module!=='undefined')module.exports=root.EventProducts;
})(typeof window!=='undefined'?window:globalThis);
