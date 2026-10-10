/* One selected event, two views. No synthetic records, alerts or audio. */
(function(){
 'use strict';
 let job=null,box=null;
 const QUAKE_MS=15000,COAST_MS=10000;
 const selected=()=>typeof eventoSelecionadoId==='undefined'?null:eventoSelecionadoId;
 const quakes=()=>typeof globalEvents==='undefined'?[]:globalEvents;
 const alerts=()=>typeof globalAlerts==='undefined'?[]:globalAlerts;
 const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const valid=j=>job===j&&(j.demo?window.TsunamiMap?.isPreview():selected()===j.hostId);
 function text(host,tag,value){const el=document.createElement(tag);el.textContent=value;host.append(el);return el;}
 function place(item){return window.EventPortuguese?.place(item.place)||item.place||'Local não informado';}
 function number(value,digits=0){return window.EventPortuguese?.number(value,digits)||Number(value).toLocaleString('pt-BR',{maximumFractionDigits:digits,minimumFractionDigits:digits});}
 function paintContext(q){return {id:q.id,lng:q.coords[0],lat:q.coords[1],mag:q.mag,depth:q.depth};}
 function clearTimers(j){clearTimeout(j?.timer);clearTimeout(j?.finalTimer);clearTimeout(j?.blueTimer);}
 function layerVisibility(coast){window.SeismicImpact?.setVisible(!coast);if(typeof setWaveFrontVisible==='function')setWaveFrontVisible(!coast);window.TsunamiMap?.setVisible(coast);}
 function stop(){const previous=job;job=null;clearTimers(previous);box?.remove();box=null;document.getElementById('painel-direito')?.classList.remove('tsunami-presenting');if(previous)layerVisibility(false);
  if(previous?.demo){if(typeof stopWaveFront==='function')stopWaveFront();window.SeismicImpact?.stop();}
 }
 function render(j){
  if(!valid(j))return;const panel=document.getElementById('painel-direito');if(!panel)return;
  box?.remove();box=document.createElement('section');box.id='pd-linked-presentation';box.dataset.phase=j.phase;box.setAttribute('aria-live','polite');
  text(box,'strong',(j.demo?'TESTE · cenário fictício · ':'')+'Sismo com boletim de tsunami');
  text(box,'small','M'+number(j.quake.mag,1)+' · '+place(j.quake)+' · '+j.alert.source);
  const content=document.createElement('div');content.className='tsunami-presentation-content';box.append(content);
  const coast=j.phase==='coast',expanded=coast||j.demo||j.hostId!==j.quake.id;
  panel.classList.toggle('tsunami-presenting',expanded);
  if(expanded){
   const color=coast?(j.alert.hazardNature==='bulletin'?'#38bdf8':'#fb7148'):'#ef4444';content.style.setProperty('--presentation-tone',color);
   const gauge=document.createElementNS('http://www.w3.org/2000/svg','svg');gauge.setAttribute('viewBox','0 0 120 70');gauge.setAttribute('aria-hidden','true');
   const arc=document.createElementNS(gauge.namespaceURI,'path');arc.setAttribute('d','M10 60 A50 50 0 0 1 110 60');arc.setAttribute('fill','none');arc.setAttribute('stroke',color);arc.setAttribute('stroke-width','7');arc.setAttribute('stroke-linecap','round');gauge.append(arc);content.append(gauge);
   text(content,'h2',coast?'🌊 '+(j.alert.hazardNature==='bulletin'?'Informativo de tsunami':'Aviso de tsunami'):'M'+number(j.quake.mag,1));
   text(content,'h3',coast?(j.stopName||'Regiões indicadas no boletim'):place(j.quake));
   text(content,'p',coast?j.alert.source+' · '+(j.alert.warningLevel||'Boletim oficial'):'Profundidade: '+number(j.quake.depth)+' km · '+(j.quake.source||'Fonte sísmica'));
   if(coast){
    const list=document.createElement('ul');content.append(list);
    for(const area of [...j.alert.affectedAreas||[],...j.alert.coverageAreas||[]].slice(0,8)){const c=window.TsunamiMapModel.category(area,j.alert);const li=text(list,'li',(window.EventPortuguese?.place(area.name)||area.name)+' · '+c.label);li.style.color=c.color;}
    text(content,'small',j.alert.hazardNature==='bulletin'?'Informativo não confirma ameaça. Consulte o boletim.':'As cores seguem o boletim. A faixa costeira não é uma previsão de inundação.');
   }else text(content,'p',j.phase==='blue'?'Onda P · passagem final pelo anel azul':'Epicentro · anel vermelho · área estimada do tremor');
   if(j.demo)text(content,'small','Dados fictícios para testar a apresentação. Não é um alerta real.');
  }
  const button=text(box,'button',j.paused?'Retomar passeio':'Pausar passeio');button.type='button';button.onclick=e=>{e.stopPropagation();if(j.paused){j.paused=false;phase(j,'quake',true);schedule(j,QUAKE_MS);}else pause();};
  const header=panel.querySelector('.pd-header-row');if(header)header.after(box);else panel.prepend(box);
 }
 function quakeCamera(j,duration=4000){
  const q=j.quake,c=paintContext(q),radius=Math.max(10,window.SeismicImpactModel?.extent(q.mag,q.depth,2.1)||30);
  const zoom=typeof zoomParaAreaPintada==='function'?zoomParaAreaPintada(c.lng,c.lat,radius):6;
  const center=typeof centroCompensado==='function'?centroCompensado(c.lng,c.lat,zoom):q.coords;
  j.cameraUntil=Date.now()+(reduce()?0:duration);map.stop();map.flyTo({center,zoom,padding:0,pitch:0,bearing:0,duration:reduce()?0:duration,curve:1.25,essential:true});
 }
 function phase(j,value,move=true){
  if(!valid(j))return;j.phase=value;
  if(value==='quake'&&!j.demo&&j.hostId!==j.quake.id)window.SeismicImpact?.start(paintContext(j.quake),true);
  layerVisibility(value==='coast');
  if(value==='coast'){if(typeof fecharViradaCardAlcance==='function')fecharViradaCardAlcance();window.EventDetailsBack?.close();window.SeismicCinema?.stop();window.CinematicCard?.stop();const target=window.TsunamiMap?.visit(j.visitIndex++,6000);j.stopName=target?.name||'Contornos indisponíveis · consulte o boletim';}
  else if(move)quakeCamera(j);
  render(j);
 }
 function schedule(j,ms){clearTimeout(j.timer);if(!valid(j)||j.final||j.paused||document.hidden)return;j.deadline=Date.now()+ms;j.timer=setTimeout(()=>{if(!valid(j)||document.hidden)return;phase(j,j.phase==='coast'?'quake':'coast');schedule(j,j.phase==='coast'?COAST_MS:QUAKE_MS);},ms);}
 function prepare(j){if(j.demo)return Promise.resolve();return window.TsunamiMap.showLinked(j.alert,j.hostId).then(()=>{if(valid(j)){window.TsunamiMap.setVisible(j.phase==='coast');render(j);}});}
 function update(item,restart=false){
  if(job?.demo){if(valid(job)&&selected()===job.hostId)return true;stop();}
  const T=window.TsunamiLink;let q=item,related;
  if(item?.type==='earthquake')related=T?.forQuake(item,alerts(),quakes()).find(r=>r.kind==='origin'&&!r.alert.cancelled);
  else if(T?.official(item)&&!item.cancelled){const r=T.match(item,quakes());if(r?.kind==='origin'){q=r.quake;related={...r,alert:item};}}
  if(!related||!q?.coords){const previous=job;stop();if(previous&&!previous.demo&&previous.hostId===selected()&&previous.phase==='coast')quakeCamera(previous);return false;}
  const a=related.alert;
  if(!restart&&job?.hostId===item.id&&job.quake.id===q.id){job.quake=q;job.alert=a;prepare(job);render(job);return true;}
  stop();const j=job={hostId:item.id,quake:q,alert:a,phase:item.type==='tsunami'?'coast':'quake',visitIndex:0,paused:false,final:false,cameraUntil:0};
  render(j);prepare(j).then(()=>{if(!valid(j))return;if(item.type==='tsunami')phase(j,'coast');else layerVisibility(false);schedule(j,j.phase==='coast'?COAST_MS:QUAKE_MS);});return true;
 }
 function finalize(id){const j=job;if(!j||j.demo||j.quake.id!==id||j.final||j.paused)return;j.final=true;clearTimers(j);j.cameraUntil=0;map.stop();phase(j,'quake',false);}
 function pause(){const j=job;if(!j||!valid(j)||j.final)return;j.paused=true;clearTimeout(j.timer);map.stop();render(j);}
 function preview(alert){
  stop();const quake={id:'tsunami-linked-demo-quake',type:'earthquake',coords:[-80.8,7.5],place:'Panamá',mag:6.6,depth:10,time:Date.now(),source:'DEMONSTRAÇÃO'};
  const j=job={hostId:selected(),quake,alert,phase:'quake',visitIndex:0,paused:false,final:false,demo:true,cameraUntil:0};
  if(typeof abrirPainelDetalhesMobile==='function'&&innerWidth<900)abrirPainelDetalhesMobile();
  if(typeof startWaveFront==='function')startWaveFront(...quake.coords,quake.mag,quake.depth,quake.time,{id:quake.id,mode:'replay',chaseCam:true,returnToEpicenter:true});
  window.SeismicImpact?.start(paintContext(quake),true);phase(j,'quake');schedule(j,QUAKE_MS);
  j.finalTimer=setTimeout(()=>{if(!valid(j)||j.paused)return;j.final=true;clearTimeout(j.timer);phase(j,'blue',false);j.cameraUntil=Infinity;
   const radius=window.GlobalQuakeTravel?.radius('p',quake.depth,(Date.now()-quake.time)/1000);if(radius){const zoom=zoomParaCaberRaio(...quake.coords,radius);map.stop();map.flyTo({center:centroCompensado(...quake.coords,zoom),zoom,padding:0,duration:reduce()?0:6000,curve:1.25,essential:true});}
   j.blueTimer=setTimeout(()=>{if(!valid(j))return;window.SeismicImpact?.finish();phase(j,'quake');j.cameraUntil=Infinity;},6000);
  },104000);
 }
 function ownsCamera(id){return !!job&&valid(job)&&job.quake.id===id&&(job.paused||job.phase==='coast'||Date.now()<job.cameraUntil);}
 function state(){return job?{hostId:job.hostId,quakeId:job.quake.id,alertId:job.alert.id,phase:job.phase,visitIndex:job.visitIndex,stopName:job.stopName,paused:job.paused,final:job.final,demo:!!job.demo}:null;}
 function install(){if(typeof map==='undefined'||!map)return;['dragstart','wheel','touchstart'].forEach(name=>map.on(name,e=>{if(e?.originalEvent)pause();}));}
 if(typeof map!=='undefined'&&map)install();else window.addEventListener('load',install,{once:true});
 document.addEventListener('click',e=>{if(job&&e.target.closest?.('#pd-focus-btn')){phase(job,'quake',false);pause();}},true);
 document.addEventListener('visibilitychange',()=>{const j=job;if(!j||j.demo)return;if(document.hidden){j.remaining=Math.max(1,(j.deadline||Date.now())-Date.now());clearTimeout(j.timer);}else if(valid(j))schedule(j,j.remaining||QUAKE_MS);});
 window.addEventListener('pagehide',stop);window.TsunamiPresentation={update,preview,stop,finalize,pause,ownsCamera,state};
})();
