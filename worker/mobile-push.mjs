import {createNoticeDispatcher} from './mobile-notices.mjs';
// Dedicated optional sender. Public feed only; Firebase credentials never go into the APK.
const TOPIC='monitor_global_alerts_v1',KEY='mobile-push-state-v1';
export function compactAlert(a){
 const out={};for(const k of ['id','kind','title','detail','state','source','countryCode'])out[k]=String(a[k]||'').slice(0,k==='id'?300:240);
 for(const k of ['issuedAt','eventTime','magnitude','depth','originLongitude','originLatitude'])if(Number.isFinite(a[k]))out[k]=a[k];out.eligible=a.eligible===true;
 out.version=JSON.stringify([out.title,out.detail,out.state,out.magnitude,out.depth]);return out;
}
export function createDispatcher({storage,read,send,clock=Date.now}){
 return async function tick(){
  const now=clock(),feed=await read();if(feed.version!=='tv-alerts-v1'||feed.policy!=='telegram-v1'||(!feed.sources?.earthquake&&!feed.sources?.tsunami)||!Array.isArray(feed.alerts))return {skipped:'source-unconfirmed'};
  let state=await storage.get(KEY);const alerts=feed.alerts.filter(a=>a&&['earthquake','tsunami'].includes(a.kind)&&typeof a.id==='string'&&a.id.length<=300).map(compactAlert);
  // Seed existing history once. Activation must not announce the past 72 hours.
  if(!state){if(!feed.sources?.earthquake||!feed.sources?.tsunami)return {skipped:'baseline-source-unconfirmed'};await storage.put(KEY,{records:alerts.map(a=>({id:a.id,version:a.version,at:now})),initializedAt:now});return {baseline:alerts.length,sent:0};}
  state.records=state.records.filter(r=>now-r.at<72*3600000).slice(-200);let sent=0;
  for(const a of alerts){
   if(!feed.sources[a.kind==='earthquake'?'earthquake':'tsunami'])continue;
   const old=state.records.find(r=>r.id===a.id);if(old?.version===a.version)continue;
   if(!a.title||!Number.isFinite(a.issuedAt)||a.issuedAt>now+60000||now-a.issuedAt>15*60000||!Number.isFinite(a.eventTime)||a.eventTime>now+60000)continue;
   if(a.kind==='earthquake'&&(!a.eligible||now-a.eventTime>6*3600000))continue;
   if(a.kind==='tsunami'&&!a.eligible&&!(old&&a.state==='ended'))continue;
   if(sent>=3)break;const raw=JSON.stringify(a);if(new TextEncoder().encode(raw).length>3000)continue;
   await send({topic:TOPIC,data:{alert:raw},android:{priority:'HIGH',ttl:'180s'}});
   if(old){old.version=a.version;old.at=now;}else state.records.push({id:a.id,version:a.version,at:now});
   state.records=state.records.slice(-200);await storage.put(KEY,state);sent++;
  }return {sent};
 };
}
let access;
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const encoded=value=>b64(new TextEncoder().encode(JSON.stringify(value)));
export async function sendFcm(env,message,request=fetch,now=Date.now(),validateOnly=false){
 const account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT||'{}');if(!/^[a-z][a-z0-9-]{4,62}$/.test(account.project_id||'')||typeof account.client_email!=='string'||typeof account.private_key!=='string')throw Error('Firebase service account missing or invalid');
 if(!access||access.project!==account.project_id||access.email!==account.client_email||access.until<=now){
  const payload=encoded({alg:'RS256',typ:'JWT'})+'.'+encoded({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:Math.floor(now/1000),exp:Math.floor(now/1000)+3600});
  const pem=account.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(payload));
  const response=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:payload+'.'+b64(signature)}),signal:AbortSignal.timeout(8000)});
  const data=await response.json();if(!response.ok||typeof data.access_token!=='string')throw Error('Firebase authorization failed');
  access={project:account.project_id,email:account.client_email,token:data.access_token,until:now+Math.min(Number(data.expires_in)||300,3500)*1000-30000};
 }
 const response=await request('https://fcm.googleapis.com/v1/projects/'+account.project_id+'/messages:send',{method:'POST',headers:{Authorization:'Bearer '+access.token,'Content-Type':'application/json'},body:JSON.stringify({message,...(validateOnly?{validate_only:true}:{})}),signal:AbortSignal.timeout(8000)});
 if(!response.ok){if(response.status===401)access=null;const data=await response.json().catch(()=>({}));const reasons=(data.error?.details||[]).map(x=>x.reason).filter(x=>typeof x==='string'&&/^[A-Z_]{1,80}$/.test(x));throw Error('Firebase delivery failed: HTTP '+response.status+(reasons.length?' '+reasons.join(','):''));}
}
export class MobilePushDelivery {
 constructor(state,env){this.state=state;this.env=env;this.queue=Promise.resolve();}
 fetch(){const run=this.queue.then(async()=>{
  if(!this.env.FIREBASE_SERVICE_ACCOUNT)return Response.json({configured:false});
  const read=async path=>{const response=await fetch('https://black-sky-9ba0.terrestre.workers.dev/'+path,{signal:AbortSignal.timeout(10000)});if(!response.ok||Number(response.headers.get('content-length')||0)>262144)throw Error('Public feed unavailable');const raw=await response.text();if(raw.length>262144)throw Error('Public feed oversized');return JSON.parse(raw);};
  const options={storage:this.state.storage,send:message=>sendFcm(this.env,message)};
  const events=createDispatcher({...options,read:()=>read('tv-alerts?policy=telegram-v1')}),notices=createNoticeDispatcher({...options,read});
  const results=await Promise.allSettled([events(),notices()]);return Response.json({events:results[0].status==='fulfilled'?results[0].value:{retry:true},notices:results[1].status==='fulfilled'?results[1].value:{retry:true}});
 });this.queue=run.catch(()=>{});return run;}

}
export default {
 fetch(){return Response.json({service:'monitor-global-mobile-push',delivery:'FCM; no instant delivery guarantee'});},
 scheduled(event,env,ctx){if(!env.FIREBASE_SERVICE_ACCOUNT)return;ctx.waitUntil(env.MOBILE_PUSH.get(env.MOBILE_PUSH.idFromName('mobile-v1')).fetch('https://internal/tick').then(r=>{if(!r.ok)throw Error('Mobile push tick failed');}).catch(()=>{console.error('Mobile push attempt failed; retry on next scheduled tick.');}));}
};

