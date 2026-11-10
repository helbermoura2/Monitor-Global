/* One-time, explicitly requested re-publication of the 09 Nov 2026 daily
 * bulletin after its Rajdhani v7 layout was merged. This does NOT mutate
 * the original delivery state or reset routine daily deduplication.
 * The Durable Object stores an at-most-once send marker; an ambiguous
 * Telegram response is NEVER retried automatically.
 */
export const DAILY_REPOST_REQUEST={
 day:'2026-11-09',
 design:'monitor-global-rajdhani-neon-v7',
 opensAt:Date.parse('2026-11-10T03:00:00Z'),
 closesAt:Date.parse('2026-11-12T03:00:00Z')
};
export function requestedDailyRepostReady(now=Date.now(),todayDesign){
 return now>=DAILY_REPOST_REQUEST.opensAt&&now<DAILY_REPOST_REQUEST.closesAt
  &&todayDesign===DAILY_REPOST_REQUEST.design;
}
export async function dailyRepostOnce({storage,day,now=Date.now(),load,render,post,archive,caption,chatId,photoName='monitor-global-resumo-novo-visual.png'}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day!==DAILY_REPOST_REQUEST.day)
  return {ok:false,skipped:true,reason:'Data não autorizada'};
 const key='daily-repost:'+day,token=crypto.randomUUID();
 const claim=await storage.transaction(async tx=>{
  const [delivery,history,prior]=await Promise.all([tx.get('delivery'),tx.get('history'),tx.get(key)]);
  if(delivery?.status!=='sent'||!history?.messageId||history?.status!=='sent')
   return {reason:'Boletim original não confirmado'};
  if(prior?.status==='sent'||prior?.status==='sending'||prior?.status==='uncertain')
   return {reason:'Republicação já enviada ou aguardando confirmação',status:prior.status,messageId:prior.messageId||null};
  if(prior?.status==='preparing'&&prior.until>now)
   return {reason:'Republicação em preparação',status:'preparing'};
  await tx.put(key,{status:'preparing',token,until:now+180000,at:now,originalMessageId:history.messageId});
  return {ok:true,originalMessageId:history.messageId};
 });
 if(!claim.ok)return {ok:true,skipped:true,day,...claim};
 let stage='preparing',messageId=null;
 try{
  const facts=await load(day);
  if(facts.day!==day||!Array.isArray(facts.events))throw Error('Dados do resumo inválidos');
  // Do not make a fresh summary that silently omits Brazil because upstreams failed.
  if(facts.brazilFailedSources?.length)throw Error('Fontes brasileiras incompletas');
  const image=await render(facts);
  if(!image?.png?.byteLength)throw Error('Imagem do resumo indisponível');
  const form=new FormData();
  if(!chatId)throw Error('Canal Telegram indisponível');
  form.append('chat_id',String(chatId));
  form.append('caption',caption(facts).slice(0,1024));
  form.append('photo',new Blob([image.png],{type:'image/png'}),photoName);
  // Download button is best effort; missing archive never suppresses a good photo.
  if(archive)try{
   const markup=await archive(image.png,day);
   if(markup)form.append('reply_markup',JSON.stringify(markup));
  }catch{ /* optional download unavailable */ }
  await storage.transaction(async tx=>{
   const state=await tx.get(key);
   if(state?.token!==token||state.status!=='preparing')throw Error('Reserva substituída');
   await tx.put(key,{...state,status:'sending',at:Date.now(),until:null});
  });
  stage='sending';
  const result=await post(form);
  messageId=result?.result?.message_id||null;
  await storage.transaction(async tx=>{
   const state=await tx.get(key);
   if(state?.token!==token||state?.status!=='sending')throw Error('Reserva alterada');
   await tx.put(key,{...state,status:'sent',sentAt:Date.now(),messageId,total:facts.events.length});
  });
  return {ok:true,day,resent:true,messageId,total:facts.events.length};
 }catch(error){
  await storage.transaction(async tx=>{
   const state=await tx.get(key);
   if(state?.token!==token||state?.status==='sent')return;
   const safe=stage==='preparing'||error.definitelyRejected===true;
   await tx.put(key,{...state,status:safe?'failed':'uncertain',at:Date.now(),until:safe?Date.now()+60000:null});
  });
  if(stage==='sending'&&!error.definitelyRejected)return {ok:false,day,uncertain:true,error:'Envio sem confirmação; não repetir para evitar duplicação'};
  return {ok:false,day,error:'Republicação pendente de dados ou envio'};
 }
}
