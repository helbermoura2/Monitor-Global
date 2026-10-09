/* Saúde dos produtos consultados. Uma falha nunca renova a última resposta válida. */
(function(root){
'use strict';
const sources=new Map();
const quakeNames=['USGS','USGS-RT','OVSICORI','MARN-SV','GEOFON','FUNVISIS','JMA','IGP','OSC-BOL','BMKG','GEONET','USP','CSN-Chile','SSN-Mexico','EMSC'];
const settings={};
function configure(names,group,interval,limit){names.forEach(name=>settings[name]={group,interval,limit});}
configure(quakeNames,'Sismos',45000,120000);
configure(['AFAD','USGS-REFORCO-GLOBAL','EMSC-REFORCO-GLOBAL'],'Sismos',60000,180000);
configure(['PTWC boletins','NTWC boletins'],'Tsunamis',30000,120000);
configure(['NWS tsunami','GDACS tsunamis','NWS tornados','NWS'],'Avisos oficiais',180000,600000);
configure(['INMET','GDACS enchentes'],'Avisos oficiais',300000,12*60000);
configure(['CGE','CGE boletins','ECCC','BOM','MeteoAlarm'],'Meteorologia',600000,25*60000);
configure(['NHC','GDACS ciclones','EONET tempestades'],'Ciclones',3600000,75*60000);
configure(['USGS-Volcano','VAAC-Global','GDACS vulcões'],'Vulcões',3600000,75*60000);
configure(['INPE','EONET incêndios','GDACS incêndios'],'Incêndios',21600000,7*3600000);
configure(['OpenMeteo','Chuva SP · modelo (Open-Meteo)','CPTEC','REDEMET','NOAA METAR'],'Clima e observações',300000,15*60000);
configure(['RainViewer'],'Radar de chuva',300000,20*60000);
configure(['ANA'],'Outras integrações',300000,15*60000);
configure(['NWS'],'Avisos oficiais',300000,12*60000);
configure(['CGE boletins'],'Meteorologia',180000,10*60000);
configure(['ECCC Canadá'],'Meteorologia',300000,12*60000);
configure(['REDEMET'],'Clima e observações',600000,25*60000);
configure(['Chuva SP · modelo (Open-Meteo)'],'Clima e observações',120000,10*60000);
let updating=false,dialog=null,opener=null;
const get=name=>{if(!sources.has(name))sources.set(name,{lastOk:0,lastAttempt:0,status:'waiting',dataAt:0,error:''});return sources.get(name)};
const cfg=name=>settings[name]||{group:/^(ECCC|BOM|MeteoAlarm)/.test(name)?'Meteorologia':'Outras fontes',interval:600000,limit:25*60000};
function age(ts,now=Date.now()){if(!ts)return 'sem consulta válida';const seconds=Math.max(0,Math.floor((now-ts)/1000));return seconds<60?seconds+' s':seconds<3600?Math.floor(seconds/60)+' min':Math.floor(seconds/3600)+' h';}
function recordStatus(name,status,error='',dataAt=0,checkedAt=0){
 const s=get(name);s.lastAttempt=Date.now();s.status=status==='ok'?'ok':status==='paused'?'paused':status==='warn'?'warn':'error';s.error=String(error||'');
 if(status==='ok'){s.lastOk=Number.isFinite(Number(checkedAt))&&Number(checkedAt)>0?Math.min(s.lastAttempt,Number(checkedAt)):s.lastAttempt;s.dataAt=Number(dataAt)||0;}
 render();
}
function record(name,ok,dataAt=0){recordStatus(name,ok?'ok':'off','',dataAt);}
function beginQuakes(){updating=true;quakeNames.forEach(get);render();}
function endQuakes(){updating=false;render();}
function snapshot(name,now=Date.now()){
 const s=get(name),config=cfg(name);let state,label;
 if(name==='RainViewer'&&typeof PRO!=='undefined'&&!PRO.radar){state='disabled';label='Desativado';}
 else if(s.status==='paused'){state='paused';label='Integração pausada';}
 else if(root.navigator?.onLine===false){state='offline';label='Sem conexão';}
 else if(s.status==='error'){state='error';label='Consulta indisponível';}
 else if(s.status==='warn'){state='partial';label='Consulta parcial';}
 else if(!s.lastOk){state='waiting';label='Aguardando consulta';}
 else if(now-s.lastOk>config.limit||(s.dataAt&&now-s.dataAt>config.limit)){state='stale';label='Dados atrasados';}
 else{state='fresh';label='Atualizado';}
 return {...s,...config,name,state,label,retained:!!s.lastOk&&['error','partial','stale','offline'].includes(state)};
}
function summary(now=Date.now()){
 const last=Number(root.__lastSismoSuccess)||0,cached=Number(root.__sismoCacheAt)||0;
 const missing=quakeNames.map(n=>snapshot(n,now)).filter(s=>['error','partial','stale'].includes(s.state)).map(s=>s.name);
 const base={missing,expected:quakeNames.length,available:quakeNames.filter(n=>snapshot(n,now).state==='fresh').length};
 if(root.navigator?.onLine===false)return {...base,state:'offline',label:'SEM CONEXÃO',at:last||cached};
 if(last&&(now-last>120000||root.__sismoUsingCache))return {...base,state:'stale',label:'DADOS ATRASADOS',at:last};
 if(!last&&root.__sismoUsingCache)return {...base,state:'stale',label:'DADOS SALVOS',at:cached};
 if(updating)return {...base,state:'updating',label:'ATUALIZANDO',at:last};
 if(!last)return {...base,state:missing.length?'stale':'waiting',label:missing.length?'SEM ATUALIZAÇÃO':'AGUARDANDO',at:0};
 if(missing.length)return {...base,state:'partial',label:'ATUALIZAÇÃO PARCIAL',at:last};
 return {...base,state:'fresh',label:'ATUALIZADO',at:last};
}
const sourceStatus=(name,now)=>{const s=snapshot(name,now);return s.label+(s.retained?' · dados anteriores':'');};
function node(tag,text,cls){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;}
function intervalLabel(ms){return ms<60000?ms/1000+' segundos':ms<3600000?ms/60000+' minutos':ms/3600000+(ms===3600000?' hora':' horas');}
function stamp(ts){return ts?new Date(ts).toLocaleString('pt-BR')+' · há '+age(ts):'nenhuma nesta sessão';}
function issueText(s){if(s.state==='disabled')return 'Ligue o radar quando quiser consultar os quadros.';if(s.state==='paused')return s.error||'Esta integração não faz consultas automáticas.';if(s.state==='offline')return 'O aparelho está sem conexão.';if(s.state==='error')return 'A última consulta não retornou dados válidos. Isso não significa ausência de eventos.';if(s.state==='partial')return 'A consulta não confirmou todos os dados esperados.';if(s.state==='stale')return 'A última resposta válida ultrapassou o prazo esperado para este produto.';return '';}
function renderDetails(){
 if(!dialog?.open)return;
 const body=dialog.querySelector('.mg-fresh-body'),scroll=body.scrollTop,opened=new Set([...body.querySelectorAll('details[open]')].map(d=>d.closest('[data-source]')?.dataset.source));body.replaceChildren();
 const overall=summary();
 body.append(node('p','Sismos: '+overall.label.toLowerCase()+(overall.at?' · última atualização há '+age(overall.at):''),'mg-fresh-overall'));
 body.append(node('p',overall.available+' de '+overall.expected+' fontes sísmicas com consulta válida recente.','mg-fresh-note'));
 const pending=[...sources.keys()].filter(n=>!quakeNames.includes(n)&&['error','partial','stale'].includes(snapshot(n).state));if(pending.length)body.append(node('p','Outras consultas com pendências: '+pending.join(', ')+'.','mg-fresh-missing'));
 if(overall.missing.length)body.append(node('p','Fontes sísmicas sem atualização válida recente: '+overall.missing.join(', ')+'.','mg-fresh-missing'));
 body.append(node('p','Consulta válida é o retorno do catálogo ou boletim, inclusive quando não há eventos. Os horários abaixo não são os horários dos eventos. Uma falha não apaga os dados anteriores.','mg-fresh-note'));
 const groups=new Map();for(const name of sources.keys()){const s=snapshot(name);if(!groups.has(s.group))groups.set(s.group,[]);groups.get(s.group).push(s);}
 for(const [title,rows] of groups){
  body.append(node('h3',title));
  rows.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).forEach(s=>{
   const row=node('article',null,'mg-fresh-row');row.dataset.source=s.name;row.dataset.state=s.state;
   const text=node('div');text.append(node('strong',root.EventPortuguese?.local(s.name)||s.name),node('span',sourceStatus(s.name),'mg-fresh-state'));
   const timing=node('div',null,'mg-fresh-times');timing.append(node('span','Última tentativa: '+stamp(s.lastAttempt)),node('span','Última consulta válida: '+stamp(s.lastOk)));
   if(!['paused','disabled'].includes(s.state))timing.append(node('span','Intervalo previsto: '+intervalLabel(s.interval)));
   if(s.dataAt)timing.append(node('span','Quadro do radar: '+stamp(s.dataAt)));
   const reason=issueText(s);if(reason)timing.append(node('span',reason,'mg-fresh-reason'));
   if(s.retained)timing.append(node('span','Os dados da última consulta válida podem continuar na tela.','mg-fresh-reason'));
   row.append(text,timing);
   if(s.error&&!['paused','disabled'].includes(s.state)){const details=node('details'),summary=node('summary','Detalhes da consulta');details.open=opened.has(s.name);details.append(summary,node('p',s.error.slice(0,400)));row.append(details);}
   body.append(row);
  });
 }
 body.append(node('p','Falha de um produto não significa que a instituição inteira esteja indisponível. As consultas pausam com a aba em segundo plano; ao voltar, os dados podem aparecer como atrasados até a próxima consulta.','mg-fresh-note'));
 body.append(node('p','Vulcões: catálogo a cada hora, com verificações mais rápidas de erupção ou escalada. Radar desativado e integrações pausadas não contam como falha.','mg-fresh-note'));
 body.scrollTop=scroll;
}
function render(){if(typeof document==='undefined')return;const badge=document.getElementById('ao-vivo-badge');if(!badge)return;
 const result=summary(),label=badge.querySelector('.av-label'),elapsed=badge.querySelector('.av-age');badge.dataset.freshness=result.state;if(label)label.textContent=result.label;if(elapsed)elapsed.textContent=result.at?'há '+age(result.at):'';
 const reason=result.missing.length?' Fontes sem atualização: '+result.missing.join(', ')+'.':'';
 badge.title='Atualização dos sismos.'+reason+' Toque para consultar todas as fontes.';badge.setAttribute('aria-label',result.label.toLowerCase()+reason+' Ver situação das fontes.');renderDetails();
}
function open(from){if(!dialog)return;opener=from||document.activeElement;if(!dialog.open)dialog.showModal();renderDetails();}
function init(){get('RainViewer');const badge=document.getElementById('ao-vivo-badge');if(!badge)return;
 dialog=node('dialog',null,'mg-fresh-dialog');dialog.id='mg-fresh-dialog';dialog.setAttribute('aria-labelledby','mg-fresh-title');
 const head=node('div',null,'mg-fresh-head'),title=node('h2','Situação das fontes');title.id='mg-fresh-title';const close=node('button','×','mg-fresh-close');close.type='button';close.setAttribute('aria-label','Fechar situação das fontes');head.append(title,close);dialog.append(head,node('div',null,'mg-fresh-body'));document.body.append(dialog);
 badge.setAttribute('aria-haspopup','dialog');badge.setAttribute('aria-controls',dialog.id);badge.addEventListener('click',()=>open(badge));close.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});dialog.addEventListener('close',()=>opener?.focus());root.addEventListener('online',render);root.addEventListener('offline',render);document.addEventListener('visibilitychange',render);
 const refresh=()=>{if(!document.hidden)render();};if(root.PeriodicScheduler)root.PeriodicScheduler.every('source-health-display',refresh,15000,15000,'ui');else setInterval(refresh,15000);render();
}
root.MonitorFreshness={record,recordStatus,beginQuakes,endQuakes,summary,sourceStatus,snapshot,open,age};
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
})(typeof window!=='undefined'?window:globalThis);
