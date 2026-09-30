/* Idade de consultas válidas; pings e horário de ocorrência não entram aqui. */
(function(root){
  'use strict';
  const sources=new Map();
  const quakeNames=['USGS','USGS-RT','GEOFON','FUNVISIS','JMA','IGP','OSC-BOL','BMKG','GEONET','USP','CSN-Chile','SSN-Mexico','EMSC'];
  const settings={INMET:{label:'Avisos INMET',limit:12*60000},RainViewer:{label:'Radar de chuva',limit:20*60000}};
  let updating=false, dialog=null, opener=null;
  const get=name=>{if(!sources.has(name))sources.set(name,{lastOk:0,lastAttempt:0,status:'waiting',dataAt:0});return sources.get(name)};
  function age(ts,now=Date.now()){
    if(!ts)return 'sem consulta válida';
    const seconds=Math.max(0,Math.floor((now-ts)/1000));
    return seconds<60?seconds+' s':seconds<3600?Math.floor(seconds/60)+' min':Math.floor(seconds/3600)+' h';
  }
  function record(name,ok,dataAt=0){
    const s=get(name);s.lastAttempt=Date.now();s.status=ok?'ok':'error';
    if(ok){s.lastOk=s.lastAttempt;s.dataAt=Number(dataAt)||0;}
    render();
  }
  function beginQuakes(){updating=true;quakeNames.forEach(get);render()}
  function endQuakes(){updating=false;render()}
  function summary(now=Date.now()){
    const last=Number(root.__lastSismoSuccess)||0;
    const cached=Number(root.__sismoCacheAt)||0;
    const failed=quakeNames.filter(n=>get(n).status==='error').length;
    if(root.navigator && root.navigator.onLine===false)return {state:'offline',label:'SEM CONEXÃO',at:last||cached};
    if(last && (now-last>120000 || root.__sismoUsingCache))return {state:'stale',label:'DADOS ATRASADOS',at:last};
    if(!last && root.__sismoUsingCache)return {state:'stale',label:'DADOS SALVOS',at:cached};
    if(updating)return {state:'updating',label:'ATUALIZANDO',at:last};
    if(!last)return {state:failed?'stale':'waiting',label:failed?'SEM ATUALIZAÇÃO':'AGUARDANDO',at:0};
    if(failed)return {state:'partial',label:'ATUALIZAÇÃO PARCIAL',at:last};
    return {state:'fresh',label:'ATUALIZADO',at:last};
  }
  function sourceStatus(name,now=Date.now()){
    const s=get(name), cfg=settings[name]||{limit:120000};
    if(name==='RainViewer' && typeof PRO!=='undefined' && !PRO.radar)return 'Desativado';
    if(root.navigator?.onLine===false)return s.lastOk?'Sem conexão · dados anteriores':'Sem conexão';
    if(s.status==='error')return s.lastOk?'Falhou · dados anteriores':'Indisponível';
    if(!s.lastOk)return 'Aguardando consulta';
    if(now-s.lastOk>cfg.limit || (s.dataAt && now-s.dataAt>cfg.limit))return 'Dados atrasados';
    return 'Atualizado';
  }
  function node(tag,text,cls){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el}
  function renderDetails(){
    if(!dialog?.open)return;
    const body=dialog.querySelector('.mg-fresh-body');body.replaceChildren();
    const overall=summary();
    body.append(node('p','Sismos: '+overall.label.toLowerCase()+(overall.at?' · última atualização há '+age(overall.at):''),'mg-fresh-overall'));
    body.append(node('p','O horário abaixo é o da consulta válida, não o da ocorrência do evento.','mg-fresh-note'));
    for(const [title,names] of [['Sismos — consulta a cada 45 segundos',quakeNames],['Outras categorias',['INMET','RainViewer']]]){
      body.append(node('h3',title));
      names.forEach(name=>{
        const s=get(name), row=node('div',null,'mg-fresh-row');
        const text=node('div');text.append(node('strong',settings[name]?.label||name),node('span',sourceStatus(name)));
        const timing=node('div',null,'mg-fresh-times');
        timing.append(node('span',s.lastOk?'Consultado há '+age(s.lastOk):'Sem consulta válida nesta sessão'));
        if(s.dataAt)timing.append(node('span','Imagem de '+new Date(s.dataAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+' · há '+age(s.dataAt)));
        row.append(text,timing);body.append(row);
      });
    }
    body.append(node('p','Cada categoria usa seu intervalo de atualização. Radar: idade do último quadro informado pela fonte; o carregamento dos tiles depende da conexão.','mg-fresh-note'));
  }
  function render(){
    if(typeof document==='undefined')return;
    const badge=document.getElementById('ao-vivo-badge');if(!badge)return;
    const result=summary(),label=badge.querySelector('.av-label'), elapsed=badge.querySelector('.av-age');
    badge.dataset.freshness=result.state;
    if(label)label.textContent=result.label;
    if(elapsed)elapsed.textContent=result.at?'há '+age(result.at):'';
    badge.title='Atualização dos sismos. Toque para consultar as fontes e outras categorias.';
    badge.setAttribute('aria-label','Atualização dos sismos: '+result.label.toLowerCase()+(result.at?', há '+age(result.at):'')+'. Ver detalhes.');
    renderDetails();
  }
  function init(){
    const badge=document.getElementById('ao-vivo-badge');if(!badge)return;
    dialog=node('dialog',null,'mg-fresh-dialog');dialog.id='mg-fresh-dialog';
    dialog.setAttribute('aria-labelledby','mg-fresh-title');
    const head=node('div',null,'mg-fresh-head'),title=node('h2','Atualização dos dados');title.id='mg-fresh-title';
    const close=node('button','×','mg-fresh-close');close.type='button';close.setAttribute('aria-label','Fechar atualização dos dados');
    head.append(title,close);dialog.append(head,node('div',null,'mg-fresh-body'));document.body.append(dialog);
    badge.setAttribute('aria-haspopup','dialog');badge.setAttribute('aria-controls',dialog.id);
    badge.addEventListener('click',()=>{opener=badge;dialog.showModal();renderDetails()});
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
    dialog.addEventListener('close',()=>opener?.focus());
    root.addEventListener('online',render);root.addEventListener('offline',render);
    document.addEventListener('visibilitychange',render);
    setInterval(()=>{if(!document.hidden)render()},5000);render();
  }
  root.MonitorFreshness={record,beginQuakes,endQuakes,summary,sourceStatus,age};
  if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init()}
})(typeof window!=='undefined'?window:globalThis);
