/* Event-driven UI: update only this section when either feed changes. */
(function(){
 'use strict';
 const id='pd-tsunami-link';
 let originMarker=null,lastHost=null;
 function allQuakes(){return typeof globalEvents!=='undefined'?globalEvents:[];}
 function allAlerts(){return typeof globalAlerts!=='undefined'?globalAlerts:[];}
 function selected(){return typeof eventoSelecionadoId!=='undefined'?eventoSelecionadoId:null;}
 function clear(keepMap=false){if(!keepMap)lastHost=null;document.getElementById(id)?.remove();originMarker?.remove();originMarker=null;if(!keepMap&&!window.TsunamiMap?.isPreview()&&window.TsunamiPresentation?.state()?.hostId!==selected())window.TsunamiMap?.stop();}
 function open(item){
  if(!item)return;
  window.__mgSoftCycle=false;window.__mgRotationDisplay=false;
  if(item.type==='earthquake'){const index=allQuakes().findIndex(q=>q.id===item.id);if(index>=0)showEventDetails(index,false);}
  else showAlertDetails(item,false);
 }
 function text(host,tag,value){const el=document.createElement(tag);el.textContent=value;host.append(el);return el;}
 function action(host,label,item){const button=text(host,'button',label);button.type='button';button.onclick=e=>{e.stopPropagation();open(item);};}
 function magnitude(q){return 'M'+(window.EventPortuguese?.number(q.mag,1)||Number(q.mag).toFixed(1).replace('.',','));}
 function local(item){return window.EventPortuguese?.place(item.place)||item.place||'Local não informado';}
 function date(time){return typeof formatBrasiliaDateTime==='function'?formatBrasiliaDateTime(time):new Date(time).toLocaleString('pt-BR');}
 function regionalList(box,item){
  const bundle=window.TsunamiRegional?.bundle(item,allAlerts(),allQuakes());if(!bundle?.groups.length)return;
  const list=document.createElement('div');list.className='tsunami-regional-list';list.setAttribute('aria-label','Situação por região');box.append(list);
  for(const group of bundle.groups){const row=document.createElement('section');row.className='tsunami-regional-row tsunami-link-row';row.dataset.bulletinId=group.rows[0].bulletinId;row.dataset.state=group.state;row.dataset.status=group.active?'warning':group.state==='ended'?'ended':'information';row.style.setProperty('--regional-tone',group.color);text(row,'strong',group.label);const sourceItem=bundle.bulletins.find(a=>a.id===group.rows[0].bulletinId);if(sourceItem?.warningLevel)text(row,'small',sourceItem.warningLevel);text(row,'p',group.regions.join(' · '));for(const note of [...new Set(group.rows.map(r=>r.scopeNote).filter(Boolean))])text(row,'small',note);const forecasts=group.rows.filter(r=>r.active&&/\d/.test(r.category));if(forecasts.length)text(row,'p',forecasts.map(r=>r.regionLabel+': '+areaLabel(r.category)).join(' · '));text(row,'small',group.source+' · '+date(group.issuedAt)+(group.stale?' · Última informação; atualização indisponível':''));const bulletin=bundle.bulletins.find(a=>a.id===group.rows[0].bulletinId);if(bulletin){if(bulletin.id!==item.id)action(row,'Abrir este boletim',bulletin);const link=document.createElement('a');try{const u=new URL(bulletin.bulletinUrl||bulletin.link);if(u.protocol==='https:'&&['www.tsunami.gov','api.weather.gov','www.weather.gov'].includes(u.hostname)){link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Boletim oficial';row.append(link);}}catch{}}list.append(row);}
  text(box,'small','Sem ameaça vale apenas para as regiões citadas. Ausência de informação não significa segurança.');
 }
 function render(item,restart=false){
  if(item)lastHost=item;
  clear(true);if(!window.TsunamiPresentation?.update(item,restart)){const group=item?.type==='earthquake'?window.TsunamiRegional?.bundle(item,allAlerts(),allQuakes()):null;const bulletin=group?.bulletins.find(a=>window.TsunamiRegional.hasThreat(a))||group?.bulletins[0];const drawing=bulletin?window.TsunamiMap?.showLinked(bulletin,item.id):window.TsunamiMap?.show(item);drawing?.then(()=>{if(item?.type==='tsunami'&&selected()===item.id&&!window.TsunamiPresentation?.state())window.TsunamiMap.startTour();});}if(!item||!['earthquake','tsunami'].includes(item.type)||item.id!==selected())return;
  item=(item.type==='earthquake'?allQuakes():allAlerts()).find(a=>a.id===item.id)||item;
  const T=window.TsunamiLink;if(!T)return;
  const relations=item.type==='earthquake'?T.forQuake(item,allAlerts(),allQuakes()):[];
  if(item.type==='earthquake'&&!relations.length)return;
  const box=document.createElement('section');box.id=id;box.className='bubble-section tsunami-linked-panel';
  document.getElementById('pd-horario')?.after(box);
  text(box,'h3','🌊 Situação de tsunami por região');
  regionalList(box,item);
  if(item.type==='earthquake'){
   text(box,'small','Os anéis representam o tremor. As faixas costeiras identificam regiões dos boletins; não representam inundação.');
  }else{
   const status=document.createElement('div');status.className='tsunami-status-strip';status.dataset.level=item.cancelled?'ended':item.hazardNature==='warning'?'warning':'information';
   status.setAttribute('role','status');
   const view=window.TsunamiMapModel.status(item);status.dataset.level=view.level;
   text(status,'strong',view.title);
   text(status,'small',(item.source||'Fonte oficial')+' · '+date(item.time));
   text(status,'small',view.message+' O ponto indica a origem do sismo.');box.append(status);
   if(T.origin(item)&&typeof GL!=='undefined'&&typeof map!=='undefined'&&map){
    const pin=document.createElement('div');pin.className='tsunami-bulletin-origin event-pin-surface';
    text(pin,'span','◎');text(pin,'strong','Origem do sismo · '+item.source);
    originMarker=new GL.Marker({element:pin,anchor:'top',offset:[0,-16]}).setLngLat(item.coords).addTo(map);
   }
   const relation=T.match(item,allQuakes());
   if(relation){
    const q=relation.quake;box.dataset.quakeId=q.id;
    text(box,'strong',magnitude(q)+' · '+local(q));text(box,'p','Origem: '+date(q.time));
    text(box,'p',relation.kind==='origin'?'Localização e horário de origem compatíveis com o boletim.':'Associação provável por localização e horário; a fonte não informa a hora de origem.');
    action(box,'Ver este sismo no mapa',q);
   }else text(box,'p',T.origin(item)?'Nenhum sismo do catálogo pôde ser associado com segurança. O mapa mantém a origem publicada no boletim.':'A fonte não identifica um epicentro verificável. Este aviso permanece regional, sem associação a um sismo aleatório.');
   if(Number.isFinite(item.originMag))text(box,'p','Magnitude no boletim: '+magnitude({mag:item.originMag})+' (pode diferir da revisão sísmica).');
   text(box,'small','Consulte as áreas e orientações do boletim oficial. Não há simulação de alcance do tsunami.');
  }
 }
 function areaLabel(value){const s=String(value||'');return s.replace(/less than/gi,'menos de').replace(/greater than/gi,'mais de').replace(/meters|metres/gi,'metros').replace(/Cancellation/gi,'Encerrado').replace(/No (?:tsunami )?threat/gi,'Sem ameaça').replace(/Warning/gi,'Alerta').replace(/Watch/gi,'Vigilância').replace(/Advisory/gi,'Atenção').replace(/Information/gi,'Informativo').replace(/(\d)\.(\d)/g,'$1,$2');}
 function refresh(){if(window.TsunamiMap?.isPreview())return;const item=[...allQuakes(),...allAlerts()].find(a=>a.id===selected())||(lastHost?.id===selected()?{...lastHost,_tsunamiStale:true}:null);render(item);}
 function preferred(){const q=allQuakes().find(a=>a.id===selected());return q?window.TsunamiLink?.forQuake(q,allAlerts(),allQuakes())[0]?.alert:null;}
 function choose(items){
  if(!items.length)return;
  if(items.length===1){open(items[0]);return;}
  document.getElementById('tsunami-bulletin-picker')?.remove();
  const dialog=document.createElement('dialog');dialog.id='tsunami-bulletin-picker';
  text(dialog,'h2','Boletins oficiais de tsunami');
  text(dialog,'p','Escolha a fonte e a região. Informativo não significa alerta de ameaça.');
  const related=preferred();
  for(const item of items){
   const row=document.createElement('button');row.type='button';row.dataset.bulletinId=item.id;
   text(row,'strong',item.source+' · '+(item.warningLevel||'Informativo')+' · '+local(item));
   text(row,'small',date(item.time)+' · '+(window.TsunamiLink.origin(item)?'Origem sísmica publicada':'Sem coordenadas de origem')+(related?.id===item.id?' · Relacionado ao sismo selecionado':''));
   row.onclick=()=>{dialog.close();open(item);};dialog.append(row);
  }
  const close=text(dialog,'button','Fechar');close.type='button';close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
 }
 window.TsunamiLinkedPanel={render,refresh,clear,open,preferred,choose};
})();
