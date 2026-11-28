// INPE BIG/STAC CAPPI discovery. No credentials, paid API, or synthetic data.
// Metadata only until actual PNG geometry, orientation and availability are verified.
export const COLLECTION='br-weather-radar-cappi-1';
export const ENDPOINT='https://data.inpe.br/bdc/stac/v1/search';
export const MAX_AGE_MS=90*60000;
export const MAX_BYTES=2*1024*1024;
export const ATTRIBUTION='INPE · Programa Nowcasting / BIG · Rede Brasileira de Radares Meteorológicos – CAPPI · CC BY 4.0';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function validBounds(b){return Array.isArray(b)&&b.length===4&&b.every(finite)&&b[0]>=-180&&b[2]<=180&&b[1]>=-85&&b[3]<=85&&b[0]<b[2]&&b[1]<b[3];}
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const clean=v=>typeof v==='string'&&v.length<=160?v.trim():'';
export function searchUrl(bounds,now=Date.now(),minutes=90){
 if(!validBounds(bounds)||bounds[2]-bounds[0]>10||bounds[3]-bounds[1]>10||!finite(now)||!Number.isInteger(minutes)||minutes<15||minutes>180)throw Error('Invalid bounded radar query');
 const u=new URL(ENDPOINT);
 u.searchParams.set('collections',COLLECTION);u.searchParams.set('bbox',bounds.join(','));
 u.searchParams.set('datetime',new Date(now-minutes*60000).toISOString()+'/'+new Date(now).toISOString());
 u.searchParams.set('limit','100');return u.href;
}
function asset(item,key){
 const a=item.assets?.[key];if(!a||typeof a.href!=='string'||a.href.length>2048)return null;
 try{const u=new URL(a.href);if(u.protocol!=='https:'||u.username||u.password||u.port||!(u.hostname==='inpe.br'||u.hostname.endsWith('.inpe.br')))return null;
 const type=key==='thumbnail'?'image/png':'application/netcdf';
 if(a.type!==type)return null;
 return {href:u.href,type};
 }catch{return null;}
}
export function normalize(data,bounds,now=Date.now()){
 if(!validBounds(bounds)||data?.type!=='FeatureCollection'||!Array.isArray(data.features)||data.features.length>100||!finite(now))throw Error('Invalid STAC response');
 const groups=new Map(),seen=new Set();let rejected=0,stale=0;
 for(const item of data.features){
  const id=clean(item?.id),radar=clean(item?.properties?.radar),owner=clean(item?.properties?.owner),stamp=item?.properties?.datetime;
  const time=typeof stamp==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/.test(stamp)?Date.parse(stamp):NaN;
  if(!id||!radar||!owner||item.collection!==COLLECTION||!validBounds(item.bbox)||!intersects(bounds,item.bbox)||!Number.isFinite(time)||time>now+60000){rejected++;continue;}
  if(now-time>MAX_AGE_MS){stale++;continue;}
  if(seen.has(id))continue;seen.add(id);
  const products={thumbnail:asset(item,'thumbnail'),cappi3km:asset(item,'cappi3km'),cappi15l:asset(item,'cappi15l')};
  if(!Object.values(products).some(Boolean)){rejected++;continue;}
  const k=owner+'|'+radar;const list=groups.get(k)||[];
  list.push({id,radar,owner,time,bounds:[...item.bbox],products});groups.set(k,list);
 }
 const radars=[...groups.values()].map(frames=>{frames.sort((a,b)=>b.time-a.time);return {radar:frames[0].radar,owner:frames[0].owner,frames:frames.slice(0,6).reverse()};}).sort((a,b)=>b.frames.at(-1).time-a.frames.at(-1).time||a.radar.localeCompare(b.radar));
 return {radars:radars.slice(0,12),rejected,stale,partial:(data.links||[]).some(l=>l.rel==='next')||radars.length>12,at:now};
}
export async function discover(bounds,{fetcher=fetch,now=Date.now(),signal}={}){
 const response=await fetcher(searchUrl(bounds,now),{signal:signal||AbortSignal.timeout(15000),credentials:'omit',redirect:'error',headers:{Accept:'application/geo+json, application/json'}});
 if(!response.ok)throw Error('INPE STAC HTTP '+response.status);
 if(Number(response.headers.get('content-length')||0)>MAX_BYTES)throw Error('STAC response too large');
 const reader=response.body.getReader();let size=0,parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw Error('STAC response too large');}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of parts){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return normalize(JSON.parse(new TextDecoder().decode(bytes)),bounds,now);
}
