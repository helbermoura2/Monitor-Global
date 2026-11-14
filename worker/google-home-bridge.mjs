// Google Home Cloud-to-cloud developer test for Monitor Global TV.
// A one-time TV PIN links the Google OAuth session to the pre-existing Alexa TV relay.
// No new Durable Object, no KV quota, no voice recordings, no hard-coded credentials.
const A='mg-alexa-1:',G='mg-google-1:',PAIR_MS=600000,CODE_MS=600000,ACCESS_MS=3600000;
const te=new TextEncoder();
const hex=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const digest=async input=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',te.encode(input))));
const k=(type,id)=>G+type+':'+id;
// Protected, non-sensitive handshake progress, readable only by the paired TV.
const handshake=async(storage,id,stage,at)=>storage.put(k('handshake',id),{stage,at});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff'}});
const tokenOk=value=>typeof value==='string'&&/^[0-9a-f]{64}$/i.test(value);
const bearer=request=>{const value=/^Bearer ([a-f0-9]{64})$/i.exec(request.headers.get('authorization')||'');return value?value[1].toLowerCase():'';};
function same(a,b){if(typeof a!=='string'||typeof b!=='string')return false;let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return !diff;}
async function bounded(request){const text=await request.text();if(text.length>6000)throw Error('invalid_body');return text;}
async function parseJson(request){const value=JSON.parse(await bounded(request));if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_body');return value;}
async function throttle(storage,request,kind,max,now){const id=await digest(kind+':'+(request.headers.get('cf-connecting-ip')||'unknown')),key=k('rate',id);const previous=await storage.get(key),value=previous&&previous.until>now?previous:{count:0,until:now+600000};if(value.count>=max)return false;await storage.put(key,{until:value.until,count:value.count+1});return true;}
async function deviceByBearer(storage,request,now){const credential=bearer(request);if(!tokenOk(credential))return null;const id=await digest(credential),record=await storage.get(A+'device:'+id);return record&&record.expiresAt>now?{id,record}:null;}
function checkRedirect(value,projectId){if(!/^[a-z0-9-]{3,120}$/.test(projectId||''))return false;try{const u=new URL(value);return u.protocol==='https:'&&u.port===''&&u.search===''&&u.hash===''&&u.username===''&&u.password===''&&u.pathname==='/r/'+projectId&&['oauth-redirect.googleusercontent.com','oauth-redirect-sandbox.googleusercontent.com'].includes(u.hostname);}catch{return false;}}
function authParams(params,env){const clientId=params.get('client_id')||'',redirect=params.get('redirect_uri')||'',state=params.get('state')||'';return clientId===env.GOOGLE_HOME_CLIENT_ID&&checkRedirect(redirect,env.GOOGLE_HOME_PROJECT_ID)&&state.length>0&&state.length<=2048&&params.get('response_type')==='code'?{clientId,redirect,state}:null;}
const escapeHtml=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function pairingPage(info){
 const hidden=(name,value)=>'<input type="hidden" name="'+name+'" value="'+escapeHtml(value)+'">';
 const html=['<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Monitor Global · Google Home</title>',
 '<style>body{font:16px system-ui;background:#061724;color:#fff;max-width:440px;margin:40px auto;padding:20px}main{background:#102d42;border:1px solid #32627e;border-radius:16px;padding:24px}h1{color:#64caf4}p{line-height:1.5;color:#cce4f1}input[name=pin]{box-sizing:border-box;width:100%;font:24px system-ui;padding:14px;border-radius:8px;background:#081d2c;color:white;border:1px solid #8ebed3;letter-spacing:6px}button{width:100%;padding:15px;margin-top:12px;background:#c51b35;color:white;border:0;border-radius:8px;font-weight:bold;font-size:17px}</style></head><body><main><h1>Monitor Global</h1>',
 '<p>Vincule sua TV ao Google para mostrar o boletim de temperatura sem abrir o aplicativo.</p><p>No Monitor Global TV, selecione Vincular Google Home e copie o código de seis dígitos da tela.</p>',
 '<form method="post" action="/google-home/v1/authorize">',
 hidden('client_id',info.clientId),hidden('redirect_uri',info.redirect),hidden('state',info.state),hidden('response_type','code'),
 '<label for="pin">Código temporário mostrado na TV</label><input id="pin" name="pin" required inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code">',
 '<p>Ao vincular, você autoriza o Google a acionar o boletim meteorológico nesta TV. O Monitor Global não recebe o áudio nem dados da sua conta Google.</p><button type="submit">Concordo e vinculo minha TV</button></form><p>Para cancelar, volte à tela anterior.</p></main></body></html>'].join('');
 return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',"Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'"}});
}
async function accessRecord(storage,request,now){const value=bearer(request);if(!tokenOk(value))return null;const record=await storage.get(k('access',await digest(value)));if(!record||record.until<=now)return null;const link=await storage.get(k('link',record.deviceId)),device=await storage.get(A+'device:'+record.deviceId);return link&&link.refreshHash===record.refreshHash&&device&&device.expiresAt>now?{id:record.deviceId,device,refreshHash:record.refreshHash}:null;}
async function issueAccess(storage,id,refreshHash,now){const value=random();await storage.put(k('access',await digest(value)),{deviceId:id,refreshHash,until:now+ACCESS_MS});return value;}
const scene=id=>'monitor-global-'+id.slice(0,24)+'-weather';
const result=(requestId,payload)=>json({requestId,payload});
async function fulfillment(request,storage,now){
 const session=await accessRecord(storage,request,now);if(!session)return json({error:'unauthorized'},401);
 const body=await parseJson(request),requestId=body.requestId;
 if(typeof requestId!=='string'||requestId.length>128||!Array.isArray(body.inputs)||body.inputs.length!==1)return json({error:'invalid_request'},400);
 const input=body.inputs[0],intent=input?.intent,id=scene(session.id),online=now-session.device.lastSeen<=120000;
 if(intent==='action.devices.SYNC')await handshake(storage,session.id,'sync_requested',now);
 if(intent==='action.devices.SYNC')return result(requestId,{agentUserId:session.id,devices:[{
  id,type:'action.devices.types.SCENE',traits:['action.devices.traits.Scene'],
  attributes:{sceneReversible:false},name:{name:'Temperatura Monitor Global',defaultNames:['Temperatura Monitor Global'],nicknames:['Boletim do tempo Monitor Global','Tempo Monitor Global']},
  willReportState:false,roomHint:'Sala',deviceInfo:{manufacturer:'Monitor Global',model:'TV',swVersion:'google-private-v1'}
 }]});
 if(intent==='action.devices.QUERY'){
  const devices={};for(const d of input?.payload?.devices||[]){if(typeof d.id!=='string')continue;devices[d.id]=d.id===id?{online,status:online?'SUCCESS':'OFFLINE'}:{online:false,status:'ERROR',errorCode:'deviceNotFound'};}
  return result(requestId,{devices});
 }
 if(intent==='action.devices.EXECUTE'){
  const batches=input?.payload?.commands;
  if(!Array.isArray(batches)||batches.length<1||batches.length>5)return json({error:'invalid_request'},400);
  const commands=[];let accepted=false;
  for(const batch of batches){
   if(!Array.isArray(batch?.devices)||!Array.isArray(batch?.execution)||batch.execution.length!==1)return json({error:'invalid_request'},400);
   const instruction=batch.execution[0];
   for(const d of batch.devices){
    let status='ERROR',errorCode;
    if(d?.id!==id)errorCode='deviceNotFound';
    else if(instruction?.command!=='action.devices.commands.ActivateScene'||instruction?.params?.deactivate!==false)errorCode='functionNotSupported';
    else if(!online){status='OFFLINE';}
    else if(accepted||now-session.device.lastCommandAt<900||session.device.pending?.until>now)errorCode='deviceBusy';
    else{
     session.device={...session.device,lastCommandAt:now,pending:{id:crypto.randomUUID(),command:'weather',source:'google',until:now+90000}};
     await storage.put(A+'device:'+session.id,session.device);
     accepted=true;status='PENDING';
    }
    commands.push({ids:[d?.id||'unknown'],status,...(errorCode?{errorCode}:{states:{online}})});
   }
  }
  return result(requestId,{commands});
 }
 if(intent==='action.devices.DISCONNECT'){
  const link=await storage.get(k('link',session.id));if(link)await storage.delete(k('refresh',link.refreshHash));
  await storage.delete(k('link',session.id));return json({});
 }
 return json({error:'unsupported_intent'},400);
}
export async function handleGoogleHomeBridge(request,storage,{env={},now=Date.now()}={}){
 const path=new URL(request.url).pathname;
 if(!['/google-home/v1/health','/google-home/v1/pair','/google-home/v1/link-status','/google-home/v1/authorize','/google-home/v1/token','/google-home/v1/fulfillment'].includes(path))return json({error:'not_found'},404);
 if(path.endsWith('/health'))return request.method==='GET'?json({ready:Boolean(env.GOOGLE_HOME_CLIENT_ID&&env.GOOGLE_HOME_CLIENT_SECRET&&env.GOOGLE_HOME_PROJECT_ID),mode:'private-test'}):json({error:'method_not_allowed'},405);
 if(!env.GOOGLE_HOME_CLIENT_ID||!env.GOOGLE_HOME_CLIENT_SECRET||!env.GOOGLE_HOME_PROJECT_ID)return json({error:'not_configured'},503);
 try{
  if(path.endsWith('/link-status')){
   if(request.method!=='GET')return json({error:'method_not_allowed'},405);
   const device=await deviceByBearer(storage,request,now);if(!device)return json({error:'device_not_registered'},401);
   const [link,progress]=await Promise.all([storage.get(k('link',device.id)),storage.get(k('handshake',device.id))]);
   // No PIN, OAuth token, secret, Google identity or request metadata is exposed.
   return json({linked:Boolean(link),stage:progress?.stage||'no_attempt',lastChangeAt:progress?.at||null});
  }
  if(path.endsWith('/pair')){
   if(request.method!=='POST')return json({error:'method_not_allowed'},405);
   const device=await deviceByBearer(storage,request,now);if(!device)return json({error:'device_not_registered'},401);
   if(!await throttle(storage,request,'pair',8,now))return json({error:'rate_limited'},429);
   let pin='';for(let i=0;i<8;i++){const attempt=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');const existing=await storage.get(k('pin',attempt));if(!existing||existing.until<=now){pin=attempt;break;}}
   if(!pin)return json({error:'temporarily_unavailable'},503);
   await storage.put(k('pin',pin),{deviceId:device.id,until:now+PAIR_MS});
   await handshake(storage,device.id,'pin_issued',now);
   return json({code:pin,expiresAt:now+PAIR_MS});
  }
  if(path.endsWith('/authorize')){
   if(request.method!=='GET'&&request.method!=='POST')return json({error:'method_not_allowed'},405);
   const params=request.method==='GET'?new URL(request.url).searchParams:new URLSearchParams(await bounded(request));
   const info=authParams(params,env);if(!info)return json({error:'invalid_authorization_request'},400);
   if(request.method==='GET')return pairingPage(info);
   if(!await throttle(storage,request,'oauth-pin',8,now))return json({error:'too_many_attempts'},429);
   const pin=params.get('pin')||'';if(!/^[0-9]{6}$/.test(pin))return json({error:'invalid_pin'},400);
   const pairing=await storage.get(k('pin',pin));if(!pairing||pairing.until<=now)return json({error:'pin_expired'},400);
   const device=await storage.get(A+'device:'+pairing.deviceId);await storage.delete(k('pin',pin));
   if(!device||device.expiresAt<=now)return json({error:'device_expired'},400);
   const code=random();await storage.put(k('code',await digest(code)),{deviceId:pairing.deviceId,clientId:info.clientId,redirect:info.redirect,until:now+CODE_MS});
   await handshake(storage,pairing.deviceId,'authorization_accepted',now);
   const redirect=new URL(info.redirect);redirect.searchParams.set('code',code);redirect.searchParams.set('state',info.state);
   return new Response(null,{status:302,headers:{Location:redirect.toString(),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }
  if(path.endsWith('/token')){
   if(request.method!=='POST')return json({error:'method_not_allowed'},405);
   const params=new URLSearchParams(await bounded(request));
   if(!same(params.get('client_id'),env.GOOGLE_HOME_CLIENT_ID)||!same(params.get('client_secret'),env.GOOGLE_HOME_CLIENT_SECRET))return json({error:'invalid_client'},401);
   if(params.get('grant_type')==='authorization_code'){
    const code=params.get('code')||'';if(!tokenOk(code))return json({error:'invalid_grant'},400);
    const key=k('code',await digest(code)),record=await storage.get(key);
    if(!record||record.until<=now||record.clientId!==env.GOOGLE_HOME_CLIENT_ID||record.redirect!==params.get('redirect_uri'))return json({error:'invalid_grant'},400);
    const device=await storage.get(A+'device:'+record.deviceId);await storage.delete(key);
    if(!device||device.expiresAt<=now)return json({error:'invalid_grant'},400);
    const old=await storage.get(k('link',record.deviceId));if(old)await storage.delete(k('refresh',old.refreshHash));
    const refresh=random(),refreshHash=await digest(refresh);
    await storage.put(k('refresh',refreshHash),{deviceId:record.deviceId});
    await storage.put(k('link',record.deviceId),{refreshHash});
    const access=await issueAccess(storage,record.deviceId,refreshHash,now);
    await handshake(storage,record.deviceId,'token_issued',now);
    return json({token_type:'Bearer',access_token:access,refresh_token:refresh,expires_in:ACCESS_MS/1000});
   }
   if(params.get('grant_type')==='refresh_token'){
    const refresh=params.get('refresh_token')||'';if(!tokenOk(refresh))return json({error:'invalid_grant'},400);
    const refreshHash=await digest(refresh),record=await storage.get(k('refresh',refreshHash));
    if(!record)return json({error:'invalid_grant'},400);
    const link=await storage.get(k('link',record.deviceId)),device=await storage.get(A+'device:'+record.deviceId);
    if(!link||link.refreshHash!==refreshHash||!device||device.expiresAt<=now)return json({error:'invalid_grant'},400);
    const access=await issueAccess(storage,record.deviceId,refreshHash,now);
    return json({token_type:'Bearer',access_token:access,expires_in:ACCESS_MS/1000});
   }
   return json({error:'unsupported_grant_type'},400);
  }
  if(path.endsWith('/fulfillment')){
   if(request.method!=='POST')return json({error:'method_not_allowed'},405);
   return fulfillment(request,storage,now);
  }
 }catch(error){
  if(error?.message==='invalid_body'||error instanceof SyntaxError)return json({error:'invalid_body'},400);
  return json({error:'temporarily_unavailable'},503);
 }
 return json({error:'not_found'},404);
}
