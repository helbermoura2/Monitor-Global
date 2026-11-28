// Allow only observed INPE NetCDF path families, never arbitrary catalog links.
export const LIMIT=32*1024*1024;
export const MAX_AGE=90*60000;
export function officialCappiUrl(href,product){
 try{
  const u=new URL(href);
  if(u.protocol!=='https:'||u.hostname!=='data.inpe.br'||u.username||u.password||u.port||u.search||u.hash)return null;
  const m=u.pathname.match(/^\/bdc\/data\/br-weather-radar-cappi\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/cappi\/(cappi3km_nc|cappi15l)\/\d{4}\/(?:0[1-9]|1[0-2])\/[A-Za-z0-9_-]{1,100}\.nc$/);
  return m&&((product==='cappi3km'&&m[1]==='cappi3km_nc')||(product==='cappi15l'&&m[1]==='cappi15l'))?u.href:null;
 }catch{return null;}
}
export function availableLevels(frame,now=Date.now()){
 if(!frame||!Number.isFinite(frame.time)||frame.time>now+60000||now-frame.time>MAX_AGE)return [];
 if(officialCappiUrl(frame.products?.cappi15l?.href,'cappi15l'))return Array.from({length:15},(_,i)=>(i+2)*1000);
 return officialCappiUrl(frame.products?.cappi3km?.href,'cappi3km')?[3000]:[];
}
export function selectCappi(frame,altitude,now=Date.now()){
 if(!availableLevels(frame,now).includes(altitude))return null;
 const product=altitude===3000&&officialCappiUrl(frame.products?.cappi3km?.href,'cappi3km')?'cappi3km':'cappi15l';
 return {product,href:officialCappiUrl(frame.products[product].href,product),altitude};
}
export async function fetchCappi(href,signal,fetcher=fetch){
 const response=await fetcher(href,{signal,credentials:'omit',redirect:'error'});
 if(!response.ok||!response.body)throw Error('Arquivo INPE indisponível');
 if(Number(response.headers.get('content-length')||0)>LIMIT)throw Error('Arquivo excede limite');
 const reader=response.body.getReader(),parts=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT){await reader.cancel();throw Error('Arquivo excede limite');}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return bytes.buffer;
}
