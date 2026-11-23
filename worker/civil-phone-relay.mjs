// Private, opt-in Cell Broadcast SCREEN relay: Android phone -> paired Android TV.
// A phone-observed notification is never presented as an independently verified CAP source.
// Uses the EXISTING Durable Object class in a dedicated instance; no KV, paid service or extra binding.
const PREFIX='argos-phone-civil-v1:', PAIR_MS=10*60_000, DEVICE_MS=90*86400_000, EVENT_MS=5*60_000;
const enc=new TextEncoder();
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store, private',
 'pragma':'no-cache','x-content-type-options':'nosniff'}});
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const code=()=>String(crypto.getRandomValues(new Uint32Array(1))[0]%100000000).padStart(8,'0');
const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const key=(type,id)=>PREFIX+type+':'+id;
const token=r=>{const raw=r.headers.get('authorization')||'';return /^Bearer [a-f0-9]{64}$/i.test(raw)?raw.slice(7).toLowerCase():'';};
async function readBody(req){
 if(Number(req.headers.get('content-length')||0)>1800)throw Error('invalid');
 const reader=req.body?.getReader();if(!reader)throw Error('invalid');
 let size=0;const pieces=[];
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;if(size>1800)throw Error('invalid');
   pieces.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;
 for(const part of pieces){bytes.set(part,offset);offset+=part.byteLength;}
 const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(!body||Array.isArray(body)||typeof body!=='object')throw Error('invalid');
 return body;
}
async function budget(storage,request,category,limit,now){
 const ip=request.headers.get('cf-connecting-ip')||'unknown';
 const k=key('budget',await sha(category+':'+ip));
 const record=await storage.get(k),active=record&&record.until>now?record:{until:now+600_000,count:0};
 if(active.count>=limit)return false;
 await storage.put(k,{until:active.until,count:active.count+1});return true;
}
const allowedSource=p=>[
 'com.android.systemui','com.samsung.android.cellbroadcastreceiver','com.sec.android.cellbroadcastreceiver',
 'com.android.cellbroadcastreceiver','com.google.android.cellbroadcastreceiver'
].includes(p)||/^com\.(?:android|google)\.cellbroadcastreceiver\.[a-z0-9_.]+$/.test(p);
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
// Remove UI-only differences between the same Cell Broadcast shown by Android
// notification and accessibility services. Never ignore locations, times,
// hazard words or warning instructions: different substantive text stays distinct.
export function civilBroadcastFingerprintText(text,severity){
 let core=normalize(text).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
 const level=severity==='Extreme'?'extremo':'severo';
 // Different Android skins sometimes repeat the entire severity heading.
 const prefix=new RegExp('^(?:(?:alerta '+level+'|defesa civil) )+');
 core=core.replace(prefix,'').replace(/(?: ok)+$/,'').trim();
 return core;
}
// The device display name is volunteered by the paired app; it is not a hardware attestation.
// Only these short, fixed labels can be shown to the owner on the paired TV.
const deviceLabel=s=>s==='Galaxy S25 Ultra'||s==='Nothing Phone 1'?s:'Celular Android';
function validatedNotice(body,now){
 if(typeof body.text!=='string'||body.text.length<28||body.text.length>500||
    /[\x00-\x08\x0b\x0e-\x1f]/.test(body.text))return null;
 const text=body.text.replace(/\s+/g,' ').trim();
 const test=body.test===true;
 if(typeof body.observedAt!=='number'||body.observedAt<now-120_000||body.observedAt>now+15_000)return null;
 const level=body.severity,source=body.source,origin=body.packageName;
 if(!['Severe','Extreme'].includes(level))return null;
 if(test){
  if(source!=='MANUAL_TEST'&&source!=='ACESSIBILIDADE')return null;
  if(origin!=='top.monitorglobal.mobile.dev'||!normalize(text).includes('teste'))return null;
 }else{
  if(!['ACESSIBILIDADE','NOTIFICACAO'].includes(source)||!allowedSource(origin))return null;
  const n=normalize(text);
  if(!n.includes('defesa civil')||!n.includes(level==='Severe'?'alerta severo':'alerta extremo')||
     n.includes('teste simulado')||n.includes('nao e um aviso real'))return null;
 }
 return {id:crypto.randomUUID(),type:test?'test':'phone',severity:level,text,observedAt:body.observedAt,
   receivedAt:now,source:source,packageName:origin,expiresAt:now+(test?120000:EVENT_MS)};
}
async function activeTV(storage,request,now){
 const t=token(request);if(!t)return null;const id=await sha(t);const row=await storage.get(key('tv',id));
 return row&&row.expiresAt>now?{id,row}:null;
}
async function activePhone(storage,request,now){
 const t=token(request);if(!t)return null;const id=await sha(t);const row=await storage.get(key('phone',id));
 if(!row||row.expiresAt<=now)return null;
 const tv=await storage.get(key('tv',row.tvId));
 return tv&&tv.expiresAt>now&&tv.phones?.includes(id)?{id,row,tv}:null;
}
async function issueCode(storage,tvId,old,now){
 if(old?.currentCode)await storage.delete(key('pair',old.currentCode));
 for(let i=0;i<4;i++){
  const fresh=code();if(await storage.get(key('pair',fresh)))continue;
  await storage.put(key('pair',fresh),{tvId,expiresAt:now+PAIR_MS});
  return fresh;
 }
 throw Error('pair_codes_busy');
}
export async function handleCivilPhoneRelay(request,storage,{now=Date.now()}={}){
 const path=new URL(request.url).pathname;
 const methods={
  '/civil-relay/v1/tv/register':'POST','/civil-relay/v1/tv/code':'POST','/civil-relay/v1/tv/poll':'GET',
  '/civil-relay/v1/phone/pair':'POST','/civil-relay/v1/phone/send':'POST'
 };
 if(!methods[path])return reply({error:'not_found'},404);
 if(request.method!==methods[path])return reply({error:'method_not_allowed'},405);
 try{
  if(path.endsWith('/tv/register')){
   if(!await budget(storage,request,'register',6,now))return reply({error:'rate_limited'},429);
   const tvToken=secret(),id=await sha(tvToken);
   const pairCode=await issueCode(storage,id,null,now);
   await storage.put(key('tv',id),{createdAt:now,expiresAt:now+DEVICE_MS,phones:[],currentCode:pairCode,events:[],recent:[]});
   return reply({tvToken,code:pairCode,codeExpiresAt:now+PAIR_MS});
  }
  if(path.endsWith('/tv/code')){
   const tv=await activeTV(storage,request,now);if(!tv)return reply({error:'not_paired'},401);
   if(!await budget(storage,request,'code',12,now))return reply({error:'rate_limited'},429);
   const pairCode=await issueCode(storage,tv.id,tv.row,now);
   await storage.put(key('tv',tv.id),{...tv.row,currentCode:pairCode});
   return reply({code:pairCode,codeExpiresAt:now+PAIR_MS});
  }
  if(path.endsWith('/phone/pair')){
   if(!await budget(storage,request,'pair',12,now))return reply({error:'rate_limited'},429);
   const data=await readBody(request),pin=String(data.code||'');
   if(!/^[0-9]{8}$/.test(pin))return reply({error:'invalid_code'},400);
   const pending=await storage.get(key('pair',pin));if(!pending||pending.expiresAt<=now)return reply({error:'expired'},404);
   const tv=await storage.get(key('tv',pending.tvId));
   await storage.delete(key('pair',pin));
   if(!tv||tv.expiresAt<=now||tv.currentCode!==pin)return reply({error:'expired'},404);
   const phoneToken=secret(),phoneId=await sha(phoneToken);
   const phones=(tv.phones||[]).slice(-1); // At most two smartphones; the newest pairing replaces the oldest after two.
   phones.push(phoneId);
   await storage.put(key('tv',pending.tvId),{...tv,currentCode:'',phones});
   await storage.put(key('phone',phoneId),{tvId:pending.tvId,expiresAt:now+DEVICE_MS,lastSend:0,count:0,windowAt:now});
   return reply({phoneToken,paired:true,phones:phones.length});
  }
  if(path.endsWith('/phone/send')){
   const phone=await activePhone(storage,request,now);if(!phone)return reply({error:'not_paired'},401);
   const body=await readBody(request);
   const alert=validatedNotice(body,now);if(!alert)return reply({error:'invalid_notice'},400);
   const row=phone.row;
   const recent=now-row.windowAt<600000?row:{...row,windowAt:now,count:0};
   if(recent.count>=20)return reply({error:'rate_limited'},429);
   await storage.put(key('phone',phone.id),{...recent,count:recent.count+1,lastSend:now});
   // Clock-independent identifier for the SAME substantive warning, including
   // text coming from the notification vs accessibility UI. Do not use a
   // coarse time/geographic heuristic that could hide a second real warning.
   const fingerprint=await sha(alert.type+':'+alert.severity+':'
     +civilBroadcastFingerprintText(alert.text,alert.severity));
   const label=deviceLabel(body.deviceLabel);
   // Read the TV record INSIDE its transaction. Two phones can POST together;
   // stale copies of the TV state could otherwise each create a separate ID.
   const decision=await storage.transaction(async tx=>{
    const tv=await tx.get(key('tv',phone.row.tvId));
    if(!tv||tv.expiresAt<=now||!tv.phones?.includes(phone.id))
     return {error:'not_paired'};
    const previous=(tv.recent||[]).filter(x=>now-x.at<150000);
    const events=(tv.events||[]).filter(x=>x.expiresAt>now).slice(-9);
    const repeated=previous.find(x=>x.hash===fingerprint);
    if(repeated){
     const prior=events.find(x=>x.id===repeated.id);
     if(prior&&phone.id!==prior.firstPhone&&!prior.secondPhone){
      prior.secondPhone=phone.id;
      prior.secondDevice=label;
      prior.secondReceivedAt=now;
      prior.secondObservedAt=alert.observedAt;
      await tx.put(key('tv',phone.row.tvId),{...tv,events});
     }
     return {accepted:true,duplicate:true,id:prior?.id||repeated.id||'',
      firstDevice:prior?.firstDevice||'Celular sem identificação',
      firstReceivedAt:prior?.firstReceivedAt||0};
    }
    alert.firstPhone=phone.id; // internal; redacted from the TV poll
    alert.firstDevice=label;
    alert.firstReceivedAt=now; // Worker server clock, not phone detection clock
    alert.firstObservedAt=alert.observedAt;
    events.push(alert);
    await tx.put(key('tv',phone.row.tvId),
      {...tv,events,recent:[...previous,{hash:fingerprint,id:alert.id,at:now}].slice(-20)});
    return {accepted:true,duplicate:false,id:alert.id,firstDevice:label,
      firstReceivedAt:now,expiresAt:alert.expiresAt};
   });
   return decision.error==='not_paired'?reply({error:'not_paired'},401):reply(decision);
  }
  if(path.endsWith('/tv/poll')){
   const tv=await activeTV(storage,request,now);if(!tv)return reply({error:'not_paired'},401);
   const events=(tv.row.events||[]).filter(e=>e.expiresAt>now&&e.receivedAt<=now+15000)
    .slice(-10).map(({firstPhone,secondPhone,...visible})=>visible);
   return reply({events,pairedPhones:(tv.row.phones||[]).length,at:now});
  }
 }catch(e){
  if(e instanceof SyntaxError||e?.message==='invalid')return reply({error:'invalid_body'},400);
  return reply({error:'temporarily_unavailable'},503);
 }
 return reply({error:'not_found'},404);
}
