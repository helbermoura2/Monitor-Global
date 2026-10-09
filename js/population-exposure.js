// UI for gridded population exposure. Keeps the existing glass card/flip.
(function(){
 'use strict';
 const cache=new Map();let current=null;
 const signature=item=>[item.id,item.coords?.[1],item.coords?.[0],item.mag,item.depth,item.time].join('|');
 const escape=text=>String(text??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
 const count=n=>Number.isFinite(Number(n))&&Number(n)>=0?(Number(n)===0?'0':Number(n)<1000?'~'+Math.round(Number(n)).toLocaleString('pt-BR'):'~'+formatarPessoasHeadline(Number(n))):'—';
 function valid(data){
  return data?.status==='available'&&['pager','worldpop'].includes(data.method)&&Array.isArray(data.ranges)&&data.ranges.length===3&&data.ranges.every(r=>r.population!==null&&r.population!==undefined&&Number.isFinite(Number(r.population))&&Number(r.population)>=0)&&data.ranges.every((r,i)=>!i||Number(r.population)<=Number(data.ranges[i-1].population)+1);
 }
 function markup(data){
  if(!valid(data))return '';
  const names=['Fraco ou maior','Moderado ou maior','Forte ou maior'],mmi=['III+','V+','VI+'];
  const source=data.method==='pager'?'USGS PAGER / ShakeMap':'WorldPop · base '+escape(data.year);
  const rows=data.ranges.map((r,i)=>'<div class="population-exposure-row"><span>'+names[i]+' <small>MMI '+mmi[i]+'</small></span><strong>'+count(r.population)+'</strong></div>').join('');
  const note=(data.method==='pager'?'Exposição estimada publicada pelo USGS.':'População em grade; intensidade estimada pelo app. Inclui áreas rurais.')+(data.depthAssumed?' Profundidade zero na fonte: adotados 10 km no modelo.':'');
  const details=data.method==='pager'?'<a href="https://earthquake.usgs.gov/" target="_blank" rel="noopener">USGS</a>':'<a href="https://www.worldpop.org/" target="_blank" rel="noopener">WorldPop (CC BY 4.0)</a> · Allen, Wald e Worden (2012)';
  return '<div class="population-exposure-card"><div class="population-exposure-heading">População na área de tremor <span class="estimativa-badge">EST'+(data.partial?' · PARCIAL':'')+'</span></div>'+rows+'<p class="population-exposure-note">'+note+' As faixas se sobrepõem; não some os valores. Não é contagem de feridos ou relatos.</p>'+(data.partial?'<p class="population-exposure-note">Cobertura limitada à área consultada.</p>':'')+'<details class="population-exposure-method"><summary>Fonte e método · '+source+'</summary><p>'+escape(data.note||'')+'</p><p>'+details+'</p>'+(data.model?'<p>'+escape(data.model)+'</p>':'')+'</details></div>';
 }
 function box(){
  const section=document.getElementById('pd-alcance-section');if(!section)return null;
  let node=document.getElementById('pd-grid-exposure');
  if(!node){node=document.createElement('div');node.id='pd-grid-exposure';section.insertBefore(node,document.getElementById('pd-alcance'));}
  return node;
 }
 function selected(job){return current===job&&typeof eventoSelecionadoId!=='undefined'&&eventoSelecionadoId===job.item.id&&signature(job.item)===job.key;}
 function paint(job,data){
  if(!selected(job))return;
  const node=box();if(!node)return;
  if(valid(data)){
   node.className='';node.innerHTML=markup(data);cache.set(job.key,{data,until:Date.now()+(data.method==='pager'?300000:3600000)});
   if(cache.size>80)cache.delete(cache.keys().next().value);
   const flip=document.getElementById('pd-flip-grid-exposure');
   if(flip){flip.innerHTML=markup(data);const number=document.querySelector('#pd-flip-verso .pd-flip-verso-num'),sub=document.querySelector('#pd-flip-verso .pd-flip-verso-sub');if(number)number.textContent=count(data.ranges[0].population);if(sub)sub.textContent='população em área de tremor fraco ou maior · EST';}
   let brief=document.getElementById('pd-exposure-brief');
   if(!brief){const anchor=document.getElementById('pd-impact');if(anchor){brief=document.createElement('button');brief.type='button';brief.id='pd-exposure-brief';brief.onclick=event=>{event.stopPropagation();const more=document.getElementById('pd-more-details');if(more?.hidden&&typeof togglePainelMaisDetalhes==='function')togglePainelMaisDetalhes();node.scrollIntoView({block:'nearest',behavior:'smooth'});};anchor.insertAdjacentElement('afterend',brief);}}
   if(brief)brief.textContent='👥 '+count(data.ranges[0].population)+' · população em área de tremor fraco ou maior · EST';
  }
  else {node.textContent=data.note||'População em grade indisponível; consulte abaixo a cobertura por localidades.';node.className='population-exposure-status';}
 }
 function cancel(){if(current){clearTimeout(current.timer);current.controller?.abort();}current=null;document.getElementById('pd-exposure-brief')?.remove();}
 window.cancelarExposicaoPopulacional=cancel;
 window.exposicaoPopulacionalDoEvento=item=>{const hit=cache.get(signature(item));return hit&&hit.until>Date.now()?hit.data:null;};
 window.renderExposicaoPopulacionalHTML=markup;
 window.obterExposicaoPopulacionalImagem=async function(item){
  const hit=window.exposicaoPopulacionalDoEvento(item);if(hit)return hit;
  const url=new URL(WORKER_PROXY(''));url.pathname='/population-exposure';url.search='';
  const report=(item.reports||[]).find(r=>/^USGS(?:-RT)?$/i.test(r.source||''))||(/^USGS(?:-RT)?$/i.test(item.source||'')?item:null);
  const eventId=report?String(report.sourceEventId||report.id||'').replace(/^USGS-(?:RT-)?/i,''):'';
  Object.entries({lat:item.coords[1],lng:item.coords[0],mag:item.mag,depth:item.depth??0,time:item.time,...(eventId?{eventId}:{})}).forEach(([name,value])=>url.searchParams.set(name,String(value)));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3000);
  try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error();const data=await r.json();return valid(data)?data:null;}catch{return null;}finally{clearTimeout(timer);}
 };
 window.carregarExposicaoPopulacional=function(item){
  cancel();if(!item||item.type!=='earthquake')return;
  const key=signature(item),job={item,key,attempt:0,timer:null,controller:null};current=job;
  const node=box();if(!node)return;node.className='';node.textContent='Consultando exposição populacional…';
  const hit=cache.get(key);if(hit&&hit.until>Date.now()){paint(job,hit.data);return;}
  let url;
  try{
   url=new URL(WORKER_PROXY(''));url.pathname='/population-exposure';url.search='';
   const report=(item.reports||[]).find(r=>/^USGS(?:-RT)?$/i.test(r.source||''))||(/^USGS(?:-RT)?$/i.test(item.source||'')?item:null);
   const eventId=report?String(report.sourceEventId||report.id||'').replace(/^USGS-(?:RT-)?/i,''):'';
   Object.entries({lat:item.coords[1],lng:item.coords[0],mag:item.mag,depth:item.depth,time:item.time,...(eventId?{eventId}:{})}).forEach(([name,value])=>url.searchParams.set(name,String(value)));
  }catch{paint(job,{note:'Serviço de exposição populacional indisponível.'});return;}
  async function poll(){
   if(!selected(job))return;
   job.controller=new AbortController();const timeout=setTimeout(()=>job.controller.abort(),35000);
   try{
    const response=await fetch(url.toString(),{signal:job.controller.signal});if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();if(!selected(job))return;
    if(data.status==='pending'&&job.attempt++<12){paint(job,data);job.timer=setTimeout(poll,10000);return;}
    if(data.status==='available'&&!valid(data))throw Error('Exposição inválida');
    paint(job,data.status==='pending'?{note:'A consulta ainda não concluiu. A cobertura por localidades está disponível abaixo.'}:data);
   }catch(error){if(selected(job))paint(job,{note:'População em grade indisponível no momento; a estimativa por localidades permanece abaixo.'});}
   finally{clearTimeout(timeout);}
  }
  void poll();
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
})();
