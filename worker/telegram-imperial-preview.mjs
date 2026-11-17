/* Admin-only, at-most-once image republication for the owner's exact PNG.
 * Neither a new earthquake nor a replacement for the automatic dynamic M6 feed.
 * Auth is enforced by the public Worker before forwarding to this private DO.
 */
export const IMPERIAL_PREVIEW={
 sha256:'ed3cf9da86aa041673d98a40172649b498e879137da9a2b8a40810f6fe699a75',
 width:1024,height:1536,maxBytes:6*1024*1024,
 key:'telegram-imperial-bronze-m6-preview:2026-11-16:ed3cf9da86aa041673',
 sourceKey:'telegram-imperial-m6-6-exact-source-v1',
 closesAt:Date.parse('2026-11-18T03:00:00Z')
};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function validateImperialPreview(bytes,options=IMPERIAL_PREVIEW){
 if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<24||bytes.byteLength>options.maxBytes)return {ok:false,reason:'Tamanho de arquivo inválido'};
 const a=new DataView(bytes),sig=[137,80,78,71,13,10,26,10];
 if(sig.some((v,i)=>a.getUint8(i)!==v)||a.getUint32(12)!==0x49484452||a.getUint32(16)!==options.width||a.getUint32(20)!==options.height)
  return {ok:false,reason:'Envie o PNG original aprovado, sem redimensionar'};
 const digest=hex(await crypto.subtle.digest('SHA-256',bytes));
 if(digest!==options.sha256)return {ok:false,reason:'Este não é o arquivo original aprovado'};
 return {ok:true,digest};
}
export async function sendImperialPreviewPhoto(env,bytes){
 if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID)throw Error('Telegram não configurado');
 const form=new FormData();
 form.set('chat_id',String(env.TELEGRAM_CHAT_ID));
 form.set('caption',[
  '♻️ REPUBLICAÇÃO DE REFERÊNCIA · ARGOS ORBIS',
  '🏛️ Imperial Bronze — conferência do visual oficial M6+.',
  '🌏 Registro ilustrado: Indonésia · M6,6 · 16/11/2026, 18:11 BRT.',
  '⚠️ Prévia do modelo visual. NÃO é um novo alerta sísmico. Informações sujeitas a revisão.',
  'argosorbis.com.br · @argosorbis'
 ].join('\n'));
 form.set('photo',new Blob([bytes],{type:'image/png'}),'argos-orbis-m6-imperial-bronze-aprovado.png');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/sendPhoto',{method:'POST',body:form,signal:controller.signal});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true){
   const error=new Error(result.description||'Telegram não confirmou o envio');
   error.definitelyRejected=Boolean(result.ok===false&&response.status>=400&&response.status<500);
   throw error;
  }
  return result;
 }finally{clearTimeout(timer);}
}
export async function handleImperialPreview(storage,env,request,{now=Date.now(),send=sendImperialPreviewPhoto,options=IMPERIAL_PREVIEW}={}){
 if(request.method==='GET'){
  const existing=await storage.get(options.key).catch(()=>null);
  return json({ok:true,preview:'imperial-bronze-M6,6',status:existing?.status||'not-sent',messageId:existing?.messageId||null});
 }
 if(request.method!=='POST')return json({ok:false,error:'Método não permitido'},405);
 if(now>=options.closesAt)return json({ok:false,error:'Publicação de referência expirada, sem envio'},410);
 if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID)return json({ok:false,error:'Bot ou canal não configurado'},503);
 const length=Number(request.headers.get('Content-Length'));
 if(Number.isFinite(length)&&length>options.maxBytes+8192)return json({ok:false,error:'Arquivo muito grande'},413);
 let bytes;
 try{
  const type=request.headers.get('Content-Type')||'';
  if(!type.startsWith('multipart/form-data'))return json({ok:false,error:'Envie um arquivo PNG'},415);
  const form=await request.formData(),file=form.get('photo');
  if(!file||typeof file.arrayBuffer!=='function'||file.type!=='image/png'||file.size>options.maxBytes)return json({ok:false,error:'Envie o PNG original, sem alterações'},400);
  bytes=await file.arrayBuffer();
 }catch{return json({ok:false,error:'Arquivo não pôde ser lido'},400);}
 const valid=await validateImperialPreview(bytes,options);
 if(!valid.ok)return json({ok:false,error:valid.reason},422);
 let existing;
 try{
  existing=await storage.get(options.key);
  if(existing?.status==='sent')return json({ok:true,alreadySent:true,messageId:existing.messageId});
  if(existing?.status==='sending'||existing?.status==='uncertain')return json({ok:false,reason:'uncertain',error:'Envio anterior pode ter sido aceito. Confira o canal antes de tentar outra vez.'},409);
  await storage.put(options.key,{status:'sending',at:now,sha256:valid.digest});
 }catch{return json({ok:false,error:'Proteção contra duplicatas indisponível'},503);}
 // Store the exact original in the existing KV, so the repository's scheduled
 // asset-sync can import the binary with SHA validation; never alter the PNG.
 let stored=false;
 if(env.TTS_USAGE?.put){
  try{
   await env.TTS_USAGE.put(options.sourceKey,bytes,{expirationTtl:14*24*60*60,metadata:{sha256:valid.digest,kind:'approved-m6-preview'}});
   stored=true;
  }catch{console.warn('Imagem original não pôde ser arquivada no KV');}
 }
 try{
  const result=await send(env,bytes);
  if(result?.ok!==true||!Number.isSafeInteger(result?.result?.message_id))throw Error('Telegram não confirmou a mensagem');
  const messageId=result.result.message_id;
  try{await storage.put(options.key,{status:'sent',at:now,messageId,sha256:valid.digest});}catch{console.warn('Telegram confirmou imagem, mas o histórico local não pôde ser gravado');}
  return json({ok:true,posted:true,messageId,channel:'@argosorbis',sha256:valid.digest,storedForGitHubSync:stored});
 }catch(error){
  const explicit=error?.definitelyRejected===true;
  try{await storage.put(options.key,{status:explicit?'rejected':'uncertain',at:now,sha256:valid.digest});}catch{}
  return json({ok:false,reason:explicit?'rejected':'uncertain',error:explicit?'Telegram recusou a imagem. Verifique as permissões do bot.':'Envio sem confirmação. Confira @argosorbis antes de tentar novamente.'},502);
 }
}

/** Public, SHA-restricted binary source. This is a public Telegram poster, not
 * a private user document. Reads no arbitrary KV keys or other images. */
export async function getImperialPreviewAsset(env){
 if(!env.TTS_USAGE?.get)return new Response('Arquivo indisponível',{status:404});
 try{
  const bytes=await env.TTS_USAGE.get(IMPERIAL_PREVIEW.sourceKey,'arrayBuffer');
  if(!bytes)return new Response('Arquivo ainda não carregado',{status:404});
  const checked=await validateImperialPreview(bytes);
  if(!checked.ok)return new Response('Imagem inválida',{status:503});
  return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('Arquivo indisponível',{status:503});}
}
