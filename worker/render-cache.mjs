// Disposable PNGs only: delivery history, reservations and edits never use this cache.
export function createRenderCache({maxEntries=2,maxBytes=8*1024*1024,now=()=>Date.now()}={}){
 const entries=new Map(),pending=new Map();let bytes=0;
 const remove=key=>{bytes-=entries.get(key).byteLength;entries.delete(key);};
 return async function render(key,ttl,compute){
  for(const [k,value]of entries)if(value.until<=now())remove(k);
  const hit=entries.get(key);if(hit)return structuredClone(hit.value);
  if(pending.has(key))return structuredClone(await pending.get(key));
  if(pending.size>=maxEntries)return compute();
  const job=(async()=>{
   const value=await compute(),png=value instanceof Uint8Array?value:value?.png;
   if(png instanceof Uint8Array&&png.byteLength<=maxBytes){
    while(entries.size>=maxEntries||bytes+png.byteLength>maxBytes)remove(entries.keys().next().value);
    entries.set(key,{value:structuredClone(value),byteLength:png.byteLength,until:now()+ttl});bytes+=png.byteLength;
   }
   return value;
  })();
  pending.set(key,job);
  try{return structuredClone(await job);}finally{pending.delete(key);}
 };
}
export async function renderIdentity(kind,data){
 // Hash the complete input so changes to text, population, grid or magnitude invalidate it.
 const text=JSON.stringify(data);
 if(text.length>4*1024*1024)return null;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return kind+':'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
