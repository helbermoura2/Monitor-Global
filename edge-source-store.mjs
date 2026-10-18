// Disposable source state only. Delivery history, quotas and population jobs stay durable.
const scopes=new WeakMap(),MAX_GROUPS=64,MAX_GROUP_BYTES=4*1024*1024,MAX_BYTES=8*1024*1024,MAX_META=65536;
const size=value=>value instanceof Uint8Array?value.byteLength:new TextEncoder().encode(JSON.stringify(value)).byteLength;
function stateFor(binding){let state=scopes.get(binding);if(!state){state={stores:new Map()};scopes.set(binding,state);}return state;}
async function readBounded(response){
 if(Number(response.headers.get('Content-Length'))>MAX_GROUP_BYTES+MAX_META+4)throw Error('oversized source state');
 const reader=response.body?.getReader(),parts=[];let total=0;
 if(reader)for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_GROUP_BYTES+MAX_META+4){await reader.cancel();throw Error('oversized source state');}parts.push(value);}
 const result=new Uint8Array(total);let at=0;for(const part of parts){result.set(part,at);at+=part.byteLength;}return result;
}
function encode(values){
 const entries=[],bodies=[];let offset=0;
 for(const [key,value]of values){if(value instanceof Uint8Array){entries.push([key,{offset,length:value.byteLength}]);bodies.push(value);offset+=value.byteLength;}else entries.push([key,{json:value}]);}
 const metadata=new TextEncoder().encode(JSON.stringify({version:1,entries}));if(metadata.length>MAX_META)throw Error('oversized metadata');
 const out=new Uint8Array(4+metadata.length+offset);new DataView(out.buffer).setUint32(0,metadata.length);out.set(metadata,4);offset=4+metadata.length;
 for(const part of bodies){out.set(part,offset);offset+=part.length;}return out;
}
function decode(bytes){
 if(bytes.length<4)throw Error('missing source state');const length=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0);
 if(length>MAX_META||length+4>bytes.length)throw Error('invalid metadata');const data=JSON.parse(new TextDecoder().decode(bytes.subarray(4,4+length)));
 if(data.version!==1||!Array.isArray(data.entries)||data.entries.length>256)throw Error('invalid source state');
 const values=new Map(),body=bytes.subarray(4+length);let decodedBytes=0;
 for(const [key,item]of data.entries){
  if(typeof key!=='string'||!/^source-(?:index$|circuit$|body:)/.test(key))throw Error('invalid source key');
  if(Object.hasOwn(item,'json'))values.set(key,item.json);
  else{if(!Number.isInteger(item.offset)||!Number.isInteger(item.length)||item.offset<0||item.length<0||item.offset+item.length>body.length)throw Error('invalid source bytes');decodedBytes+=item.length;if(decodedBytes>MAX_GROUP_BYTES)throw Error('oversized decoded state');values.set(key,body.slice(item.offset,item.offset+item.length));}
 }
 const index=values.get('source-index');
 if(index!==undefined&&(!Array.isArray(index)||index.length>16||index.some(entry=>!entry||typeof entry.key!=='string'||!Number.isSafeInteger(entry.parts)||entry.parts<1||entry.parts>53||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||entry.bytes>3*1024*1024||!Number.isFinite(entry.until)||!Number.isFinite(entry.at)||!Number.isFinite(entry.ttl))))throw Error('invalid source index');
 const circuit=values.get('source-circuit');if(circuit!==undefined&&(!circuit||typeof circuit!=='object'||Array.isArray(circuit)||['next','attempt','lastOk','failures'].some(key=>circuit[key]!==undefined&&(!Number.isFinite(circuit[key])||circuit[key]<0))))throw Error('invalid source circuit');
 return values;
}
function trim(store){
 let index=store.values.get('source-index')||[];
 const remove=entry=>{for(let i=0;i<entry.parts;i++)store.values.delete('source-body:'+entry.key+':'+i);};
 for(const entry of index)if(entry.until<=Date.now())remove(entry);
 index=index.filter(entry=>entry.until>Date.now());
 while(index.reduce((n,entry)=>n+entry.bytes,0)>MAX_GROUP_BYTES)remove(index.shift());
 if(store.values.has('source-index'))store.values.set('source-index',index);
 store.bytes=[...store.values.values()].reduce((n,value)=>n+size(value),0);
}
function evict(state){
 let total=[...state.stores.values()].reduce((n,store)=>n+store.bytes,0);
 for(const [key,store]of state.stores){
  if(state.stores.size<=MAX_GROUPS&&total<=MAX_BYTES)break;
  if(store.active)continue;state.stores.delete(key);total-=store.bytes;
 }
}
export function edgeSourceStore(binding,group,cacheKey){
 const state=stateFor(binding);let store=state.stores.get(group);
 if(store){state.stores.delete(group);state.stores.set(group,store);return store;}
 store={values:new Map(),bytes:0,active:0,loaded:false,dirty:false,queue:Promise.resolve(),persistenceDegraded:false};
 const storage={
  get:async key=>structuredClone(store.values.get(key)),
  put:async(key,value)=>{store.values.set(key,structuredClone(value));store.dirty=true;},
  delete:async key=>{store.values.delete(key);store.dirty=true;},
  transaction:async fn=>{const values=new Map(store.values),dirty=store.dirty;try{return await fn(storage);}catch(error){store.values=values;store.dirty=dirty;throw error;}}
 };
 store.run=fn=>{
  store.active++;
  const operation=store.queue.then(async()=>{
   if(!store.loaded){store.loaded=true;try{const cache=globalThis.caches?.default;if(!cache)throw Error('Cache API unavailable');const response=await cache.match(cacheKey);if(response&&Number(response.headers.get('X-Monitor-Edge-State-Until'))>Date.now())store.values=decode(await readBounded(response));}catch{store.persistenceDegraded=true;}trim(store);}
   try{return await fn(storage);}finally{
    trim(store);
    if(store.dirty){store.dirty=false;
     const until=Math.max(0,...(store.values.get('source-index')||[]).map(entry=>entry.until),Number(store.values.get('source-circuit')?.next)||0);
     if(until>Date.now())try{const cache=globalThis.caches?.default;if(!cache)throw Error('Cache API unavailable');await cache.put(cacheKey,new Response(encode(store.values),{headers:{'Content-Type':'application/octet-stream','Cache-Control':'public, max-age='+Math.max(1,Math.floor((until-Date.now())/1000)),'X-Monitor-Edge-State-Until':String(until)}}));store.persistenceDegraded=false;}catch{store.persistenceDegraded=true;}
    }
   }
  });
  store.queue=operation.catch(()=>{});
  return operation.finally(()=>{store.active--;evict(state);});
 };
 state.stores.set(group,store);evict(state);return store;
}
