/* Authorized, one-click Telegram smoke test.
 * Runs inside a dedicated Durable Object instance so simultaneous taps can only
 * reserve one send. It never touches live seismic events or daily summary state.
 */
const KEY='telegram-admin-test:v1';
const COOLDOWN_MS=10*60*1000;
const RETRY_AFTER_REJECT_MS=60*1000;
const headers={'Cache-Control':'no-store'};
const reply=(body,status=200)=>Response.json(body,{status,headers});

export async function handleTelegramAdminSmoke(storage,env,send,now=Date.now()){
 if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID)
  return reply({ok:false,reason:'missing-secrets',error:'Token do bot ou identificador do canal ausente no Worker.'},503);
 try{
  const prior=await storage.get(KEY);
  if(prior&&Number.isFinite(prior.at)&&now-prior.at>=0&&now-prior.at<COOLDOWN_MS){
   const remaining=Math.ceil((COOLDOWN_MS-(now-prior.at))/60000);
   return reply({ok:false,reason:'cooldown',minutes:remaining,error:'Teste recente ou sem confirmação. Confira o canal antes de tentar novamente. Aguarde aproximadamente '+remaining+' minuto(s).'},429);
  }
  // Persist before posting. If Telegram times out after accepting the message,
  // the reservation intentionally blocks duplicates instead of retrying blind.
  await storage.put(KEY,{at:now,status:'sending'});
 }catch{
  return reply({ok:false,reason:'storage-unavailable',error:'Proteção contra envios duplicados indisponível; nenhum teste foi enviado.'},503);
 }
 const message='🧪 TESTE DE ENVIO — ARGOS ORBIS\n\nEsta é apenas uma mensagem técnica para confirmar a integração do bot com o canal.\nNÃO é um alerta de sismo nem de outro evento.\n\n📢 @argosorbis';
 try{
  const result=await send(env,message);
  const messageId=result?.result?.message_id;
  if(!result?.ok||!Number.isSafeInteger(messageId))throw Error('Telegram não confirmou a mensagem.');
  try{await storage.put(KEY,{at:now,status:'sent',messageId});}catch{console.warn('Teste Telegram enviado; falha ao registrar confirmação');}
  return reply({ok:true,mode:'text',messageId,message:'Mensagem de teste publicada no canal @argosorbis.'});
 }catch(error){
  const explicitReject=error?.telegramRejected===true;
  try{await storage.put(KEY,{at:explicitReject?now-COOLDOWN_MS+RETRY_AFTER_REJECT_MS:now,status:explicitReject?'rejected':'uncertain'});}catch{}
  return reply(explicitReject
   ? {ok:false,reason:'telegram-rejected',error:'Telegram recusou o envio. Confira o token e a permissão de publicar do bot no canal.'}
   : {ok:false,reason:'uncertain',error:'O Telegram não confirmou o envio. Confira o canal antes de tentar novamente para evitar duplicação.'},502);
 }
}
