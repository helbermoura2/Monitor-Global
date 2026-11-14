// Private Alexa-hosted skill <-> Android TV command relay.
// Runs in its own existing EarthquakeAlertDelivery Durable Object instance;
// never writes to shared earthquake records or consumes KV quotas.
const PREFIX='mg-alexa-1:',PAIR_MS=10*60000,DEVICE_MS=90*86400000,CMD_MS=90000;
const ALLOWED=new Set(['brent','weather','brazil','recent-quake','last-summary','today']);
const encoder=new TextEncoder();
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff'}});
const secureToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const pin=()=>String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const validToken=s=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s);
const key=(type,id)=>PREFIX+type+':'+id;
const bearer=req=>{const h=req.headers.get('authorization')||'';return /^Bearer [a-f0-9]{64}$/i.test(h)?h.slice(7).toLowerCase():'';};
async function readJson(request){
 if(Number(request.headers.get('content-length')||0)>2048)throw Error('oversize');
 const reader=request.body?.getReader();if(!reader)throw Error('empty body');
 const parts=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048)throw Error('oversize');parts.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const v of parts){bytes.set(v,offset);offset+=v.length;}
 const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(!data||Array.isArray(data)||typeof data!=='object')throw Error('invalid');
 return data;
}
async function throttle(storage,request,kind,limit,now){
 // Cloudflare-controlled origin IP is used only for request budgeting; never
 // persisted in plain text. Missing IP is strictly limited, not privileged.
 const ip=request.headers.get('cf-connecting-ip')||'unidentified';
 const id=await hash(kind+':'+ip);
 const storageKey=key('limit',id),previous=await storage.get(storageKey);
 const record=previous&&previous.until>now?previous:{until:now+600000,count:0};
 if(record.count>=limit)return false;
 await storage.put(storageKey,{...record,count:record.count+1});
 return true;
}
async function deviceRecord(storage,request,now){
 const token=bearer(request);if(!validToken(token))return null;
 const id=await hash(token),record=await storage.get(key('device',id));
 return record&&record.expiresAt>now?{id,record}:null;
}
async function skillRecord(storage,request,now){
 const token=bearer(request);if(!validToken(token))return null;
 const id=await hash(token),deviceId=await storage.get(key('skill',id));
 if(typeof deviceId!=='string')return null;
 const record=await storage.get(key('device',deviceId));
 return record&&record.expiresAt>now&&record.skillHash===id?{id,deviceId,record}:null;
}
export async function handleAlexaRelay(request,storage,{now=Date.now()}={}){
 const path=new URL(request.url).pathname;
 if(!/^\/alexa\/v1\/(?:register|link|next|command|ack)$/.test(path))
  return json({error:'not_found'},404);
 const method=path.endsWith('/next')?'GET':'POST';
 if(request.method!==method)return json({error:'method_not_allowed'},405);
 try{
  if(path.endsWith('/register')){
   if(!await throttle(storage,request,'register',5,now))return json({error:'rate_limited'},429);
   const deviceToken=secureToken(),deviceId=await hash(deviceToken),code=pin();
   const record={expiresAt:now+DEVICE_MS,createdAt:now,lastSeen:now,skillHash:'',pending:null,lastCommandAt:0};
   await storage.put(key('device',deviceId),record);
   await storage.put(key('pair',code),{deviceId,until:now+PAIR_MS});
   return json({deviceToken,code,expiresAt:now+PAIR_MS});
  }
  if(path.endsWith('/link')){
   if(!await throttle(storage,request,'link',8,now))return json({error:'rate_limited'},429);
   const body=await readJson(request),code=String(body.code||'');
   if(!/^\d{6}$/.test(code))return json({error:'invalid_code'},400);
   const candidate=await storage.get(key('pair',code));
   if(!candidate||candidate.until<=now)return json({error:'code_expired'},404);
   const device=await storage.get(key('device',candidate.deviceId));
   await storage.delete(key('pair',code)); // one-time, also if device disappeared
   if(!device||device.expiresAt<=now)return json({error:'code_expired'},404);
   if(device.skillHash)await storage.delete(key('skill',device.skillHash));
   const skillToken=secureToken(),skillHash=await hash(skillToken);
   await storage.put(key('skill',skillHash),candidate.deviceId);
   await storage.put(key('device',candidate.deviceId),{...device,skillHash,pending:null,lastSeen:now});
   return json({skillToken,linked:true});
  }
  if(path.endsWith('/command')){
   const authorized=await skillRecord(storage,request,now);
   if(!authorized)return json({error:'not_linked'},401);
   const body=await readJson(request);
   if(!ALLOWED.has(body.command))return json({error:'invalid_command'},400);
   const {deviceId,record}=authorized;
   if(now-record.lastSeen>120000)return json({error:'tv_offline'},409);
   if(now-record.lastCommandAt<900)return json({error:'too_fast'},429);
   const commandId=crypto.randomUUID();
   await storage.put(key('device',deviceId),{...record,lastCommandAt:now,
    pending:{id:commandId,command:body.command,until:now+CMD_MS}});
   return json({accepted:true,id:commandId});
  }
  if(path.endsWith('/next')){
   const authorized=await deviceRecord(storage,request,now);
   if(!authorized)return json({error:'invalid_device'},401);
   const {id,record}=authorized;
   if(now-record.lastSeen>=30000)await storage.put(key('device',id),{...record,lastSeen:now});
   const pending=record.pending?.until>now?record.pending:null;
   return json({command:pending?{id:pending.id,type:pending.command,source:pending.source==='google'?'google':'alexa'}:null,linked:Boolean(record.skillHash)});
  }
  if(path.endsWith('/ack')){
   const authorized=await deviceRecord(storage,request,now);
   if(!authorized)return json({error:'invalid_device'},401);
   const body=await readJson(request);
   if(typeof body.id!=='string'||!/^[0-9a-f-]{36}$/.test(body.id))return json({error:'invalid_ack'},400);
   const {id,record}=authorized;
   if(record.pending?.id===body.id)await storage.put(key('device',id),{...record,pending:null});
   return json({ok:true});
  }
 }catch(error){
  if(['oversize','empty body','invalid'].includes(error?.message)||error instanceof SyntaxError)
   return json({error:'invalid_body'},400);
  return json({error:'temporarily_unavailable'},503);
 }
 return json({error:'not_found'},404);
}
