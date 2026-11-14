import test from 'node:test';
import assert from 'node:assert/strict';
import {handleGoogleHomeBridge} from '../../worker/google-home-bridge.mjs';
import {handleAlexaRelay} from '../../worker/alexa-voice-bridge.mjs';

const googleBase='https://black-sky-9ba0.terrestre.workers.dev/google-home/v1';
const alexaBase='https://black-sky-9ba0.terrestre.workers.dev/alexa/v1';
const now=Date.parse('2026-11-13T20:00:00Z');
const env={GOOGLE_HOME_CLIENT_ID:'monitor-global-test-client',GOOGLE_HOME_CLIENT_SECRET:'unique-private-test-secret',GOOGLE_HOME_PROJECT_ID:'monitor-global-test'};
const redirect='https://oauth-redirect.googleusercontent.com/r/monitor-global-test';
const store=()=>{const values=new Map();return {values,get:async key=>values.get(key),put:async(k,v)=>values.set(k,v),delete:async key=>values.delete(key)};};
const req=(url,method='POST',body,auth,form=false)=>new Request(url,{
 method,headers:{'Content-Type':form?'application/x-www-form-urlencoded':'application/json',
 'CF-Connecting-IP':'192.0.2.20',...(auth?{Authorization:'Bearer '+auth}:{})},
 ...(method==='GET'?{}:{body:form?new URLSearchParams(body).toString():JSON.stringify(body||{})})
});
async function g(s,path,method='POST',body={},auth='',time=now,form=false){
 const url=googleBase+path;
 const r=await handleGoogleHomeBridge(req(url,method,body,auth,form),s,{env,now:time});
 return {status:r.status,body:r.status===302?null:(r.headers.get('content-type')||'').includes('text/html')?await r.text():await r.json(),headers:r.headers};
}
async function a(s,path,method='POST',body={},auth='',time=now){
 const r=await handleAlexaRelay(req(alexaBase+path,method,body,auth),s,{now:time});
 return {status:r.status,body:await r.json()};
}
const param=(overrides={})=>({client_id:env.GOOGLE_HOME_CLIENT_ID,client_secret:env.GOOGLE_HOME_CLIENT_SECRET,...overrides});
async function link(s,deviceToken){
 const pair=await g(s,'/pair','POST',{},deviceToken);
 assert.equal(pair.status,200);assert.match(pair.body.code,/^[0-9]{6}$/);
 const authorize=new URLSearchParams({client_id:env.GOOGLE_HOME_CLIENT_ID,redirect_uri:redirect,state:'opaque-google-state',response_type:'code'});
 const page=await handleGoogleHomeBridge(new Request(googleBase+'/authorize?'+authorize),s,{env,now});
 assert.equal(page.status,200);assert.match(await page.text(),/Monitor Global/);
 const confirmed=await g(s,'/authorize','POST',{...Object.fromEntries(authorize),pin:pair.body.code},'',now,true);
 assert.equal(confirmed.status,302);
 const callback=new URL(confirmed.headers.get('location'));
 assert.equal(callback.origin,'https://oauth-redirect.googleusercontent.com');
 assert.equal(callback.searchParams.get('state'),'opaque-google-state');
 const code=callback.searchParams.get('code');
 const credentials=await g(s,'/token','POST',param({grant_type:'authorization_code',code,redirect_uri:redirect}),'',now,true);
 assert.equal(credentials.status,200);assert.match(credentials.body.access_token,/^[a-f0-9]{64}$/);
 return {code,access:credentials.body.access_token,refresh:credentials.body.refresh_token,pin:pair.body.code};
}
const command=(intent,payload={})=>({requestId:'request-'+intent,inputs:[{intent,payload}]});
test('fail closed when worker secrets are not deployed',async()=>{
 const s=store(),request=req(googleBase+'/pair','POST',{},'a'.repeat(64));
 const response=await handleGoogleHomeBridge(request,s,{env:{},now});
 assert.equal(response.status,503);
 const health=await handleGoogleHomeBridge(new Request(googleBase+'/health'),s,{env:{},now});
 assert.equal((await health.json()).ready,false);
 assert.equal(s.values.size,0);
});
test('OAuth pairing cannot redirect to arbitrary sites and is one-time',async()=>{
 const s=store(),registered=await a(s,'/register');
 assert.equal((await g(s,'/pair','POST',{},'0'.repeat(64))).status,401);
 const paired=await g(s,'/pair','POST',{},registered.body.deviceToken);
 assert.equal(paired.status,200);
 const p=new URLSearchParams({client_id:env.GOOGLE_HOME_CLIENT_ID,redirect_uri:'https://evil.example/steal',
  response_type:'code',state:'google-state'});
 const request=new Request(googleBase+'/authorize?'+p);
 assert.equal((await handleGoogleHomeBridge(request,s,{env,now})).status,400);
 const standard={client_id:env.GOOGLE_HOME_CLIENT_ID,redirect_uri:redirect,response_type:'code',state:'google-state'};
 const first=await g(s,'/authorize','POST',{...standard,pin:paired.body.code},'',now,true);
 assert.equal(first.status,302);
 assert.equal((await g(s,'/authorize','POST',{...standard,pin:paired.body.code},'',now,true)).status,400);
 const badCode=await g(s,'/token','POST',param({grant_type:'authorization_code',code:'0'.repeat(64),redirect_uri:redirect}),'',now,true);
 assert.equal(badCode.status,400);
});
test('Google weather scene uses existing Alexa queue without breaking the Alexa account',async()=>{
 const s=store(),registered=await a(s,'/register');const token=registered.body.deviceToken;
 const skill=await a(s,'/link','POST',{code:registered.body.code});
 assert.equal(skill.status,200);
 const {code,access,refresh}=await link(s,token);
 const oauthStatus=await g(s,'/link-status','GET',undefined,token);
 assert.equal(oauthStatus.status,200);
 assert.equal(oauthStatus.body.linked,true);
 assert.equal(oauthStatus.body.stage,'token_issued');
 assert.equal(Object.keys(oauthStatus.body).some(key=>/code|secret|token|pin/i.test(key)),false);
 assert.equal((await g(s,'/link-status','GET',undefined,'0'.repeat(64))).status,401);
 assert.equal((await g(s,'/token','POST',param({grant_type:'authorization_code',code,redirect_uri:redirect}),'',now,true)).status,400,'auth code is consumed');
 const synced=await g(s,'/fulfillment','POST',command('action.devices.SYNC'),access);
 assert.equal(synced.status,200);
 assert.equal((await g(s,'/link-status','GET',undefined,token)).body.stage,'synchronized');
 assert.equal(synced.body.payload.devices.length,1);
 const device=synced.body.payload.devices[0];
 assert.equal(device.type,'action.devices.types.SCENE');
 assert.equal(device.traits[0],'action.devices.traits.Scene');
 const query=await g(s,'/fulfillment','POST',command('action.devices.QUERY',{devices:[{id:device.id}]}),access);
 assert.equal(query.body.payload.devices[device.id].online,true);
 const execute=command('action.devices.EXECUTE',{commands:[{devices:[{id:device.id}],execution:[{command:'action.devices.commands.ActivateScene',params:{deactivate:false}}]}]});
 const launched=await g(s,'/fulfillment','POST',execute,access,now+1000);
 assert.equal(launched.status,200);assert.equal(launched.body.payload.commands[0].status,'PENDING');
 const pending=await a(s,'/next','GET',{},token,now+1500);
 assert.equal(pending.body.command.type,'weather');
 assert.equal(pending.body.command.source,'google');
 assert.equal(pending.body.linked,true,'Google pairing preserves Alexa skill link');
 assert.equal((await a(s,'/ack','POST',{id:pending.body.command.id},token,now+2000)).status,200);
 assert.equal((await a(s,'/next','GET',{},token,now+2500)).body.command,null);
 const renewed=await g(s,'/token','POST',param({grant_type:'refresh_token',refresh_token:refresh}),'',now+3600000,true);
 assert.equal(renewed.status,200);
 assert.match(renewed.body.access_token,/^[a-f0-9]{64}$/);
 assert.equal((await g(s,'/fulfillment','POST',command('action.devices.SYNC'),renewed.body.access_token,now+3600001)).status,200);
 const disconnected=await g(s,'/fulfillment','POST',command('action.devices.DISCONNECT'),renewed.body.access_token,now+3600001);
 assert.equal(disconnected.status,200);
 assert.equal((await g(s,'/token','POST',param({grant_type:'refresh_token',refresh_token:refresh}),'',now+3600002,true)).status,400);
 const alexaAllowed=await a(s,'/command','POST',{command:'brent'},skill.body.skillToken,now+3600100);
 assert.equal(alexaAllowed.status,409,'separate Alexa credentials remain valid, TV heartbeat is stale');
});
test('TV sees PIN issued and accepted before token exchange, not a false success',async()=>{
 const s=store(),registration=await a(s,'/register'),deviceToken=registration.body.deviceToken;
 assert.deepEqual((await g(s,'/link-status','GET',undefined,deviceToken)).body,
  {linked:false,stage:'no_attempt',lastChangeAt:null});
 const pairing=await g(s,'/pair','POST',{},deviceToken);
 assert.equal(pairing.status,200);
 assert.equal((await g(s,'/link-status','GET',undefined,deviceToken)).body.stage,'pin_issued');
 const params={client_id:env.GOOGLE_HOME_CLIENT_ID,redirect_uri:redirect,state:'state-value',response_type:'code',pin:pairing.body.code};
 const authorized=await g(s,'/authorize','POST',params,'',now,true);
 assert.equal(authorized.status,302);
 const after=await g(s,'/link-status','GET',undefined,deviceToken);
 assert.equal(after.body.linked,false);
 assert.equal(after.body.stage,'authorization_accepted');
 assert.equal((await g(s,'/authorize','POST',params,'',now,true)).body.error,'pin_expired');
});
test('google cannot send arbitrary actions, duplicate commands or requests while TV is offline',async()=>{
 const s=store(),registration=await a(s,'/register'),connected=await link(s,registration.body.deviceToken);
 const synced=await g(s,'/fulfillment','POST',command('action.devices.SYNC'),connected.access);
 const id=synced.body.payload.devices[0].id;
 const bad=await g(s,'/fulfillment','POST',command('action.devices.EXECUTE',{commands:[{devices:[{id}],execution:[{command:'action.devices.commands.LockUnlock',params:{lock:false}}]}]}),connected.access);
 assert.equal(bad.body.payload.commands[0].status,'ERROR');
 const disabled=await g(s,'/fulfillment','POST',command('action.devices.EXECUTE',{commands:[{devices:[{id}],execution:[{command:'action.devices.commands.ActivateScene',params:{deactivate:true}}]}]}),connected.access);
 assert.equal(disabled.body.payload.commands[0].status,'ERROR');
 const task=command('action.devices.EXECUTE',{commands:[{devices:[{id}],execution:[{command:'action.devices.commands.ActivateScene',params:{deactivate:false}}]}]});
 const first=await g(s,'/fulfillment','POST',task,connected.access,now+1000);
 assert.equal(first.body.payload.commands[0].status,'PENDING');
 const repeat=await g(s,'/fulfillment','POST',task,connected.access,now+1000);
 assert.equal(repeat.body.payload.commands[0].status,'ERROR');
 const offline=await g(s,'/fulfillment','POST',task,connected.access,now+125000);
 assert.equal(offline.body.payload.commands[0].status,'OFFLINE');
 assert.equal((await g(s,'/fulfillment','POST',task,'0'.repeat(64))).status,401);
});
