// KV-compatible storage for Telegram history only. Legacy KV remains read-only.
const PREFIX='tg-history-store:',META=PREFIX+'meta:',PART=PREFIX+'part:',CHUNK=60000,TTL=31*86400000,MAX=6*1024*1024;
export const historyKey=k=>/^telegram-history-m6:[0-9TZ:.\-]+:[a-f0-9-]+$/.test(k);
const summaryKey=k=>k==='telegram-daily-summary-sent'||/^telegram-history-preview:\d{4}-\d{2}-\d{2}$/.test(k);
async function schedule(storage,until){const alarm=await storage.getAlarm?.();await storage.setAlarm?.(alarm&&alarm>Date.now()?Math.min(alarm,until):until);}
async function remove(storage,key,meta){for(let i=0;i<meta.parts;i++)await storage.delete(PART+key+':'+i);await storage.delete(META+key);}
export async function persistentHistoryGet(storage,key,type){
 const meta=await storage.get(META+key);if(!meta||meta.until<=Date.now())return undefined;
 if(!Number.isInteger(meta.parts)||meta.parts<1||meta.parts>110||!Number.isSafeInteger(meta.bytes)||meta.bytes<0||meta.bytes>MAX)throw Error('Histórico persistente inválido');
 const chunks=await Promise.all(Array.from({length:meta.parts},(_,i)=>storage.get(PART+key+':'+i)));
 if(chunks.some((c,i)=>!(c instanceof Uint8Array)||c.length!==Math.min(CHUNK,meta.bytes-i*CHUNK)))throw Error('Histórico persistente incompleto');
 const bytes=new Uint8Array(meta.bytes);chunks.forEach((c,i)=>bytes.set(c,i*CHUNK));
 return type==='arrayBuffer'?bytes.buffer:new TextDecoder().decode(bytes);
}
export async function persistentHistoryPut(storage,key,value,opts={}){
 const bytes=typeof value==='string'?new TextEncoder().encode(value):value instanceof ArrayBuffer?new Uint8Array(value):value;
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX)throw Error('Histórico acima do limite');
 const old=await storage.get(META+key),parts=Math.ceil(bytes.length/CHUNK),until=Date.now()+Math.min(31*86400,Math.max(60,opts.expirationTtl||31*86400))*1000;
 const write=async tx=>{for(let i=0;i<parts;i++)await tx.put(PART+key+':'+i,bytes.slice(i*CHUNK,(i+1)*CHUNK));await tx.put(META+key,{parts,bytes:bytes.length,until,metadata:opts.metadata||null});};
 if(storage.transaction)await storage.transaction(write);else await write(storage);
 if(old)for(let i=parts;i<old.parts;i++)await storage.delete(PART+key+':'+i);
 await schedule(storage,until+1000);
}
export async function persistentHistoryList(storage,{cursor,limit=1000}={}){
 const prefix=META+'telegram-history-m6:',entries=await storage.list({prefix,limit,...(cursor?{startAfter:cursor}:{})}),keys=[];
 for(const[k,m]of entries)if(m.until>Date.now()&&m.metadata)keys.push({name:k.slice(META.length),metadata:m.metadata});
 return {keys,list_complete:entries.size<limit,cursor:entries.size?[...entries.keys()].at(-1):undefined};
}
export async function prunePersistentHistory(storage,now=Date.now()){
 let cursor,next=Infinity;
 // Bounded batches; continue cleanup shortly if a large archive has more entries.
 for(let page=0;page<5;page++){
  const entries=await storage.list({prefix:META,limit:1000,...(cursor?{startAfter:cursor}:{})});
  for(const[k,m]of entries){if(m.until<=now)await remove(storage,k.slice(META.length),m);else next=Math.min(next,m.until+1000);}
  if(entries.size<1000)break;cursor=[...entries.keys()].at(-1);if(page===4)next=Math.min(next,now+60000);
 }
 if(Number.isFinite(next))await schedule(storage,next);
}
export function telegramHistoryStorage(storage,legacy,{summary=false}={}){
 const owns=summary?summaryKey:historyKey;
 return {
  async get(key,...args){if(!owns(key))return legacy?.get(key,...args);const value=await persistentHistoryGet(storage,key,args[0]);return value===undefined?legacy?.get(key,...args):value;},
  async put(key,value,opts){if(!owns(key))return legacy?.put(key,value,opts);return persistentHistoryPut(storage,key,value,opts);},
  list:opts=>legacy?.list(opts)
 };
}
export async function handlePersistentHistory(request,storage){
 const u=new URL(request.url),key=u.searchParams.get('key')||'';
 if(u.pathname==='/__telegram-history/list')return Response.json(await persistentHistoryList(storage,{cursor:u.searchParams.get('cursor')||undefined}));
 if(u.pathname!=='/__telegram-history/get'||!historyKey(key))return Response.json({error:'invalid'},{status:400});
 const raw=await persistentHistoryGet(storage,key);return raw===undefined?Response.json({error:'not found'},{status:404}):Response.json({ok:true,record:JSON.parse(raw)});
}
