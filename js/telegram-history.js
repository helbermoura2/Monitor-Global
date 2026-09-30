/* Administração do Telegram: token apenas em memória, consultas sem envio. */
(function(){
 'use strict';
 const base='https://black-sky-9ba0.terrestre.workers.dev';
 let token='',authorized=false,dialog,body,message,objectUrl,active='daily',data;
 const labels={sent:'Enviado',sending:'Envio em andamento',uncertain:'Entrega sem confirmação',failed:'Falhou',preparing:'Preparando',pending:'Pendente',unavailable:'Histórico indisponível',query:'Consultando USGS',data:'Dados obtidos',render:'Gerando imagem',prepared:'Resumo preparado','text-fallback':'Imagem falhou — usando texto','legacy-confirmed':'Envio anterior confirmado','missing-secrets':'Configuração do Telegram ausente'};
 const fmt=at=>at?new Date(at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium'}):'Horário não registrado';
 const n=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el};
 function clearPreview(){if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null}}
 function menuButtons(){
   const menu=document.getElementById('ts-more-menu');
   if(menu&&!document.getElementById('admin-telegram-history')){
     const btn=n('button','Histórico do Telegram','submenu-action');btn.type='button';btn.id='admin-telegram-history';
     btn.addEventListener('click',open);menu.append(btn);
   }
   document.querySelectorAll('#admin-telegram-history').forEach(btn=>btn.hidden=!authorized);
 }
 function logout(){
   token='';authorized=false;data=null;clearPreview();menuButtons();login();
 }
 async function request(path,blob=false){
   const credential=token;
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
   try{
     const response=await fetch(base+path,{headers:{'X-Admin-Token':token},cache:'no-store',signal:controller.signal});
     if(response.status===401){authorized=false;token='';menuButtons();throw Error('Chave inválida ou acesso administrativo não configurado.')}
     if(!response.ok)throw Error(response.status===404?'Não há imagem salva para este resumo.':'Não foi possível consultar o histórico. Tente novamente.');
     const result=await (blob?response.blob():response.json());
     if(token!==credential)throw Error('Sessão encerrada.');
     return result;
   }finally{clearTimeout(timer)}
 }
 function show(){
   if(!dialog.open)dialog.showModal();
 }
 function login(){
   clearPreview();body.replaceChildren();message.textContent='';
   body.append(n('p','Acesso administrativo. Informe a chave de acesso para consultar os envios.','tg-note'));
   const form=n('form'),label=n('label','Chave de acesso'),input=n('input');
   input.type='password';input.autocomplete='off';input.required=true;input.id='tg-admin-key';label.htmlFor=input.id;
   const submit=n('button','Entrar');submit.type='submit';
   form.append(label,input,submit);body.append(form);
   body.append(n('p','A chave é o ADMIN_TOKEN configurado no Worker. Ela fica apenas nesta aba e é removida ao sair ou recarregar.','tg-note'));
   form.addEventListener('submit',async event=>{
     event.preventDefault();submit.disabled=true;token=input.value;input.value='';message.textContent='Validando acesso…';
     try{data=await request('/telegram-history');authorized=true;menuButtons();render();}
     catch(error){token='';message.textContent=error.name==='AbortError'?'A consulta demorou demais. Tente novamente.':error.message}
     finally{submit.disabled=false}
   });
   show();input.focus();
 }
 async function refresh(){
   message.textContent='Consultando histórico…';
   try{data=await request('/telegram-history');render()}catch(error){message.textContent=error.name==='AbortError'?'A consulta demorou demais.':error.message;if(!authorized)login()}
 }
 function render(){
   clearPreview();body.replaceChildren();message.textContent='';
   const controls=n('div',null,'tg-controls');
   for(const [key,text] of [['daily','Resumos diários'],['alerts','Alertas M6+']]){
     const btn=n('button',text);btn.type='button';btn.setAttribute('aria-pressed',String(active===key));btn.onclick=()=>{active=key;render()};controls.append(btn);
   }
   const update=n('button','Atualizar');update.type='button';update.onclick=refresh;
   const exit=n('button','Sair');exit.type='button';exit.onclick=logout;controls.append(update,exit);body.append(controls);
   body.append(n('p','Últimos 30 dias · horários de Brasília. O registro detalhado começa com esta atualização.','tg-note'));
   const list=active==='daily'?[...(data.daily||[])].sort((a,b)=>b.day.localeCompare(a.day)):data.alerts||[];
   if(!list.length)body.append(n('p','Nenhum envio registrado neste período. Os próximos aparecerão aqui.','tg-empty'));
   list.forEach(row=>{
     const card=n('button',null,'tg-history-row');card.type='button';
     const title=active==='daily'?'Resumo de '+row.day.split('-').reverse().join('/'):(row.kind==='m6-update'?'Atualização':'Sismo')+' M'+Number(row.mag).toFixed(1)+' · '+row.place;
     card.append(n('strong',title),n('span',labels[row.status]||'Pendente','tg-status'),n('small',row.legacy?'Registro anterior · detalhes de tentativas não disponíveis':fmt(row.at)));
     card.onclick=()=>details(row);body.append(card);
   });
   if(data.hasMore)body.append(n('p','Há mais alertas que o limite desta consulta.','tg-note'));
 }
 async function details(row){
   clearPreview();body.replaceChildren();message.textContent='';
   const back=n('button','← Voltar');back.type='button';back.onclick=render;body.append(back);
   if(row.key){
     message.textContent='Carregando tentativas…';
     try{row=(await request('/telegram-history-detail?key='+encodeURIComponent(row.key))).record;message.textContent=''}
     catch(error){message.textContent=error.message;return}
   }
   body.append(n('h3',row.kind==='daily'?'Resumo de '+row.day.split('-').reverse().join('/'):'Alerta M'+Number(row.mag).toFixed(1)),n('p',labels[row.status]||'Pendente'));
   if(row.attempts)body.append(n('p',row.attempts+' tentativa(s) registrada(s)'));
   if(row.total!=null)body.append(n('p',row.total+' sismos · '+(row.format==='text'?'envio em texto':'envio com imagem')));
   if(row.legacy)body.append(n('p','Envio anterior confirmado. Não há histórico detalhado dessas tentativas.','tg-note'));
   if(row.status==='uncertain')body.append(n('p','A mensagem pode ter chegado ao Telegram sem confirmação. Consulte o canal antes de qualquer ação manual.','tg-note'));
   const timeline=n('ol',null,'tg-timeline');
   (row.events||[]).forEach(event=>timeline.append(n('li',fmt(event.at)+' — '+(labels[event.stage]||event.stage))));
   body.append(timeline);
   if(row.hasPreview&&row.day){
     const preview=n('button','Ver imagem do resumo');preview.type='button';
     preview.onclick=async()=>{
       preview.disabled=true;message.textContent='Carregando imagem…';
       try{
         const blob=await request('/telegram-history-preview?day='+encodeURIComponent(row.day),true);
         clearPreview();objectUrl=URL.createObjectURL(blob);const img=n('img');img.src=objectUrl;img.alt='Imagem salva do resumo de '+row.day;img.className='tg-preview';
         body.append(img);message.textContent='';
       }catch(error){message.textContent=error.message;preview.disabled=false}
     };body.append(preview);
   }
 }
 function open(){
   document.getElementById('menu-float-panel')?.classList.remove('open');
   const float=document.getElementById('menu-float-panel');if(float)float.style.display='none';
   if(!authorized){login();return}show();refresh();
 }
 function init(){
   dialog=n('dialog',null,'tg-admin-dialog');dialog.id='tg-admin-dialog';dialog.setAttribute('aria-labelledby','tg-admin-title');
   const head=n('div',null,'tg-admin-head'),title=n('h2','Histórico do Telegram');title.id='tg-admin-title';
   const close=n('button','×');close.type='button';close.setAttribute('aria-label','Fechar histórico');close.onclick=()=>dialog.close();
   head.append(title,close);message=n('p','', 'tg-admin-message');message.setAttribute('role','status');
   body=n('div',null,'tg-admin-body');dialog.append(head,message,body);document.body.append(dialog);
   dialog.addEventListener('close',clearPreview);
   window.TelegramAdmin={open,isAuthenticated:()=>authorized};
   if(new URLSearchParams(location.search).get('admin')==='1')login();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
