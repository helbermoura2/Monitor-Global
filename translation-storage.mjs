// The existing serialized translation Durable Object owns both quota and cache.
// KV is read only to import a legacy successful translation, never written here.
const PREFIX='pt-translation-cache:',TTL=30*86400_000;
const misses=new WeakMap(),cleaned=new WeakMap();
async function prune(storage,now){
 if(!storage.list||!storage.delete||now-(cleaned.get(storage)||0)<3600_000)return;
 cleaned.set(storage,now);
 const marker=await storage.get('pt-translation-cache-cleanup');
 if(marker?.at&&now-marker.at<3600_000)return;
 const entries=await storage.list({prefix:PREFIX,limit:32,...(marker?.cursor?{startAfter:marker.cursor}:{})});
 for(const [key,value] of entries)if(!value||value.until<=now)await storage.delete(key);
 await storage.put('pt-translation-cache-cleanup',{at:now,cursor:entries.size===32?[...entries.keys()].at(-1):null});
}
export function translationStorage(storage,kv,clock=Date.now){
 return {
  async get(key){
   if(key.startsWith('pt-translation-chars:')){const q=await storage.get('pt-translation-quota');return q?.day===key?q.used:0;}
   if(!key.startsWith('pt-translation-v2:'))return kv?.get(key);
   const localKey=PREFIX+key.slice('pt-translation-v2:'.length),now=clock();
   const cached=await storage.get(localKey);if(cached?.until>now&&typeof cached.value==='string')return cached.value;
   let memo=misses.get(storage);if(!memo){memo=new Map();misses.set(storage,memo);}
   if((memo.get(key)||0)>now)return null;
   try{
    const legacy=await kv?.get(key);
    if(typeof legacy==='string'&&legacy){await storage.put(localKey,{value:legacy,until:now+TTL});return legacy;}
   }catch{console.warn('[tradução] Cache antigo indisponível; usando armazenamento do objeto.');}
   memo.set(key,now+300_000);if(memo.size>256)memo.delete(memo.keys().next().value);return null;
  },
  async put(key,value,options){
   if(key.startsWith('pt-translation-chars:'))return storage.put('pt-translation-quota',{day:key,used:Number(value)});
   if(!key.startsWith('pt-translation-v2:'))return kv?.put(key,value,options);
   const now=clock();await storage.put(PREFIX+key.slice('pt-translation-v2:'.length),{value,until:now+TTL});
   // Bounded housekeeping has no KV list/delete operations.
   try{await prune(storage,now);}catch{console.warn('[tradução] Limpeza do cache adiada.');}
  }
 };
}
