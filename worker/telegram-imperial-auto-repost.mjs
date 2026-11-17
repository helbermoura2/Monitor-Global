/* Explicitly authorized one-time archival republication of the exact M6,6 poster.
 * GitHub raw serves the verified binary; no approximate procedural rendering.
 * This reuses the same Durable Object idempotency key as the manual admin upload.
 */
import {IMPERIAL_PREVIEW,validateImperialPreview,handleImperialPreview} from './telegram-imperial-preview.mjs';

export const APPROVED_IMPERIAL_URL='https://raw.githubusercontent.com/helbermoura2/Monitor-Global/main/assets/telegram/m6/imperial-bronze-preview-2026-11-16-m6-6.png';
const NEXT_ATTEMPT='telegram-imperial-preview:auto-next-at';
const RETRY_DELAY=15*60*1000;

export async function sendApprovedImperialOnce(storage,env,{now=Date.now(),fetcher=fetch,send}={}){
 if(now>=IMPERIAL_PREVIEW.closesAt)return {ok:false,skipped:true,reason:'expired'};
 if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID)return {ok:false,skipped:true,reason:'missing-telegram'};
 let prev,next;
 try{
  [prev,next]=await Promise.all([storage.get(IMPERIAL_PREVIEW.key),storage.get(NEXT_ATTEMPT)]);
  if(['sent','sending','uncertain'].includes(prev?.status))
   return {ok:prev.status==='sent',skipped:true,reason:prev.status,messageId:prev.messageId||null};
  if(Number.isFinite(next)&&now<next)return {ok:false,skipped:true,reason:'backoff'};
  // Reserve an upstream-fetch interval before requesting GitHub so even a CDN
  // outage cannot cause repeated free-tier requests every minute.
  await storage.put(NEXT_ATTEMPT,now+RETRY_DELAY);
 }catch{return {ok:false,skipped:true,reason:'storage-unavailable'};}
 let bytes;
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
 try{
  const response=await fetcher(APPROVED_IMPERIAL_URL,{signal:ctrl.signal,headers:{'Cache-Control':'no-cache'}});
  if(!response.ok)return {ok:false,skipped:true,reason:'github-not-ready',status:response.status};
  const length=Number(response.headers.get('Content-Length')||0);
  if(length>IMPERIAL_PREVIEW.maxBytes)return {ok:false,skipped:true,reason:'image-too-large'};
  bytes=await response.arrayBuffer();
 }catch{return {ok:false,skipped:true,reason:'github-fetch-failed'};}
 finally{clearTimeout(timer);}
 const approved=await validateImperialPreview(bytes);
 if(!approved.ok)return {ok:false,skipped:true,reason:'hash-or-image-mismatch'};
 const form=new FormData();
 form.append('photo',new Blob([bytes],{type:'image/png'}),'argos-imperial-bronze-m6-6.png');
 const req=new Request('https://internal/__telegram-imperial-preview',{method:'POST',body:form});
 const posted=await handleImperialPreview(storage,env,req,{now,...(send?{send}:{})});
 const result=await posted.json().catch(()=>({}));
 return {...result,HTTPStatus:posted.status,origin:'verified-github-original'};
}
