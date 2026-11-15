/* Read-only, authenticated diagnosis of the currently configured Telegram bot.
 * No messages sent, no secrets returned, no config modified.
 */
const output=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function callBot(fetcher,token,method,payload){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),8000);
 try{
  const response=await fetcher('https://api.telegram.org/bot'+token+'/'+method,{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(payload),signal:controller.signal
  });
  const body=await response.json().catch(()=>null);
  return {ok:response.ok&&body?.ok===true,data:body?.result||null,status:response.status};
 }finally{clearTimeout(timer);}
}
export async function diagnoseTelegramAdmin(env,fetcher=fetch){
 if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID)
  return output({ok:false,stage:'configuration',error:'Faltam as credenciais do bot ou do canal no ambiente Production.'},503);
 let me;
 try{me=await callBot(fetcher,env.TELEGRAM_BOT_TOKEN,'getMe',{});}
 catch{return output({ok:false,stage:'bot',error:'Não foi possível consultar o Telegram agora. Nenhuma mensagem foi enviada.'},502);}
 if(!me.ok||!me.data?.id)
  return output({ok:false,stage:'bot',error:me.status===401?'Token do bot inválido ou revogado. Confira TELEGRAM_BOT_TOKEN.':'O Telegram não confirmou a identidade do bot (HTTP '+me.status+').'},200);
 const botUsername=String(me.data.username||'');
 const expected='ArgosOrbisBot';
 if(botUsername.toLowerCase()!==expected.toLowerCase())
  return output({ok:false,stage:'bot',botUsername,error:'Este Worker está usando @'+botUsername+', e não @'+expected+'. Confira TELEGRAM_BOT_TOKEN.'});
 let membership;
 try{membership=await callBot(fetcher,env.TELEGRAM_BOT_TOKEN,'getChatMember',{chat_id:env.TELEGRAM_CHAT_ID,user_id:me.data.id});}
 catch{return output({ok:false,stage:'channel',botUsername,error:'Não foi possível verificar a permissão do bot no canal. Nenhuma mensagem foi enviada.'},502);}
 if(!membership.ok||!membership.data)
  return output({ok:false,stage:'channel',botUsername,error:'O Telegram não reconheceu a associação do bot com o canal configurado (HTTP '+membership.status+'). Confira TELEGRAM_CHAT_ID e os administradores do canal.'});
 const role=String(membership.data.status||'');
 const canPost=role==='creator'||(role==='administrator'&&membership.data.can_post_messages===true);
 if(!canPost)
  return output({ok:false,stage:'permissions',botUsername,error:'O bot foi encontrado, mas não tem permissão de publicar mensagens no canal.'});
 return output({ok:true,stage:'ready',botUsername,canPost:true,message:'Conexão validada: @'+botUsername+' é administrador e pode publicar no canal configurado.'});
}
