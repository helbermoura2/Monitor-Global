// Per-binding, per-isolate public snapshots and in-flight coalescing. No storage writes.
const scopes=new WeakMap(),MAX_ENTRIES=48,MAX_PENDING=8,MAX_BYTES=6*1024*1024,MAX_BODY=3*1024*1024;
function scope(binding){let value=scopes.get(binding);if(!value){value={entries:new Map(),pending:new Map(),bytes:0};scopes.set(binding,value);}return value;}
function deadline(response,policy,now){
 if(policy.expires){const until=Number(policy.expires(response,now));return Number.isFinite(until)?Math.min(until,now+policy.ttl):0;}
 const state=response.headers.get('X-Monitor-Source-State'),at=Number(response.headers.get('X-Monitor-Source-Last-Ok'));
 if(response.ok&&at>0&&at<=now+1000){
  if(state==='fresh'||state==='partial')return at+Math.min(policy.ttl,state==='partial'?30000:policy.ttl);
  if(state==='stale'){const retry=Number(response.headers.get('X-Monitor-Source-Next-Retry'));return Math.min(at+policy.stale,retry||now);}
 }
 // Suppress a failure burst briefly without postponing a scheduled urgent poll.
 if(response.status===503&&state==='unavailable')return now+Math.min(5000,policy.ttl);
 return 0;
}
function mark(response,via){const headers=new Headers(response.headers);headers.set('X-Monitor-Source-Edge',via);headers.set('Access-Control-Expose-Headers',[headers.get('Access-Control-Expose-Headers'),'X-Monitor-Source-Edge'].filter(Boolean).join(', '));return new Response(response.body,{status:response.status,headers});}
function restore(snapshot,via=snapshot.via||'coordinator'){const body=snapshot.status===204?null:new ReadableStream({start(controller){controller.enqueue(snapshot.body);controller.close();}});return mark(new Response(body,{status:snapshot.status,headers:snapshot.headers}),via);}
function remember(state,key,snapshot){
 const previous=state.entries.get(key);if(previous){state.bytes-=previous.body.byteLength;state.entries.delete(key);}
 if(snapshot.until<=Date.now())return;
 for(const [old,value] of state.entries)if(value.until<=Date.now()){state.entries.delete(old);state.bytes-=value.body.byteLength;}
 while(state.entries.size>=MAX_ENTRIES||state.bytes+snapshot.body.byteLength>MAX_BYTES){const first=state.entries.keys().next();if(first.done)break;state.bytes-=state.entries.get(first.value).body.byteLength;state.entries.delete(first.value);}
 state.entries.set(key,snapshot);state.bytes+=snapshot.body.byteLength;
}
async function snapshot(response,policy){
 const length=Number(response.headers.get('Content-Length'));if(length>MAX_BODY)throw Error('Source response too large');
 const reader=response.body?.getReader(),chunks=[];let size=0;
 if(reader)for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>MAX_BODY){await reader.cancel();throw Error('Source response too large');}chunks.push(next.value);}
 const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
 return {status:response.status,headers:[...response.headers],body,until:deadline(response,policy,Date.now())};
}
export async function sourceEdgeResponse(binding,key,policy,edgeKey,load){
 const state=scope(binding),now=Date.now(),existing=state.entries.get(key);
 if(existing?.until>now)return restore(existing,'memory');
 if(existing){state.entries.delete(key);state.bytes-=existing.body.byteLength;}
 const pending=state.pending.get(key);if(pending)return restore(await pending,'joined');
 const work=async()=>{
  const cache=policy.skipResponseCache?null:globalThis.caches?.default;
  if(cache)try{
   const cached=await cache.match(edgeKey),until=Number(cached?.headers.get('X-Monitor-Source-Cache-Until'));
   if(cached&&until>Date.now()){
    const headers=new Headers(cached.headers),status=Number(headers.get('X-Monitor-Source-Cached-Status'))||cached.status;
    headers.delete('X-Monitor-Source-Cached-Status');headers.delete('X-Monitor-Source-Cache-Until');headers.set('Cache-Control','no-store');
    const restored=new Response(status===204?null:cached.body,{status,headers});
    if(deadline(restored,policy,Date.now())>Date.now()){const value=await snapshot(restored,policy);value.until=Math.min(value.until,until);value.via='edge';remember(state,key,value);return value;}
   }
  }catch{}
  const value=await snapshot(await load(),policy);value.via=policy.origin||'coordinator';remember(state,key,value);
  if(cache&&value.until>Date.now())try{
   const headers=new Headers(value.headers);headers.set('Cache-Control','public, max-age='+Math.max(1,Math.floor((value.until-Date.now())/1000)));
   // Store failures as internal 200 envelopes; restore their HTTP status on reads.
   headers.set('X-Monitor-Source-Cached-Status',String(value.status));headers.set('X-Monitor-Source-Cache-Until',String(value.until));
   await cache.put(edgeKey,new Response(value.status===204?null:value.body,{status:value.status===503?200:value.status,headers}));
  }catch{}
  return value;
 };
 // Bound pending identities too; identical requests normally occupy one slot.
 if(state.pending.size>=MAX_PENDING)return mark(await load(),'bypass');
 const promise=work();state.pending.set(key,promise);
 try{return restore(await promise);}finally{if(state.pending.get(key)===promise)state.pending.delete(key);}
}
