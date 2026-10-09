/* Records open the main panel. Regional warnings never invent a map location. */
(function(){
 function located(item){return Array.isArray(item?.coords)&&item.coords.length>=2&&item.coords.slice(0,2).every(Number.isFinite)&&Math.abs(item.coords[0])<=180&&Math.abs(item.coords[1])<=90;}
 function label(item){
  if(item?.type==='tsunami')return item.displayLabel|| (item.hazardNature==='bulletin'?'BOLETIM DE TSUNAMI':'AVISO DE TSUNAMI');
  if(item?.hazardNature==='warning'){
   if(item.type==='flood')return /storm surge|coastal|lakeshore|tidal/i.test(item.warningEvent||'')?'AVISO DE INUNDAÇÃO COSTEIRA':'ALERTA DE ENCHENTE';
   if(item.type==='wind')return 'AVISO DE VENTO';
   if(/rain/i.test(item.warningEvent||''))return 'AVISO DE CHUVA';
   return 'AVISO DE TEMPESTADE';
  }
  if(item?.hazardNature==='observed')return item.type==='wind'?'RAJADA OBSERVADA':item.type==='storm'?'TROVOADA OBSERVADA':null;
  if(item?.hazardNature==='forecast')return item.type==='wind'?'RAJADA PREVISTA':item.type==='storm'?'TEMPESTADE PREVISTA':item.type==='flood'?'PREVISÃO DE CHEIA':null;
  if(item?.hazardNature==='report'&&item.type==='flood')return 'ENCHENTE REPORTADA';
  return null;
 }
 function bulletin(item){
  if(item?.hazardNature!=='warning')return null;
  try{const u=new URL(item.link);if(u.protocol!=='https:'||!['api.weather.gc.ca','api.weather.gov','www.weather.gov','meteoalarm.org','www.meteoalarm.org','www.bom.gov.au','reg.bom.gov.au','www.tsunami.gov'].includes(u.hostname)||u.username||u.password)return null;return u.href;}catch(e){return null;}
 }
 function isBulletin(item){return item?.hazardNature==='bulletin'&&item.source==='CGE';}
 function bulletinFront(item){
  const p=document.getElementById('painel-direito');p?.classList.add('pd-bulletin');
  const source=document.getElementById('pd-source');if(source)source.textContent='BOLETIM CGE';
  const btn=document.getElementById('pd-more-toggle');if(btn&&!window.EventDetailsBack?.isOpen())btn.textContent='Ler boletim ↻';
  const section=document.createElement('section');section.id='pd-bulletin-summary';section.className='bubble-section record-notice-brief';
  const h=document.createElement('h3');h.textContent=item.detail||'Boletim meteorológico';section.append(h);
  const summary=document.createElement('p');summary.textContent=item.bulletinSummary||'Consulte o texto publicado pelo CGE da Prefeitura de São Paulo.';section.append(summary);
  const action=document.createElement('button');action.type='button';action.textContent='Ler boletim completo ↻';action.onclick=e=>{e.stopPropagation();window.EventDetailsBack?.toggle(true);};section.append(action);
  document.getElementById('pd-horario')?.after(section);
  window.EventDetailsBack?.refreshBulletin(item);
 }
 function reset(){
  document.getElementById('painel-direito')?.classList.remove('pd-warning','pd-bulletin');
  document.getElementById('pd-bulletin-summary')?.remove();
  const btn=document.getElementById('pd-more-toggle');if(btn&&!window.EventDetailsBack?.isOpen())btn.textContent='Detalhes ↻';
  document.getElementById('pd-notice-brief')?.remove();
  document.getElementById('pd-impact')?.parentNode?.style.removeProperty('display');
  for(const id of ['pd-focus-btn','pd-share-btn']){const el=document.getElementById(id);if(el){el.hidden=false;el.style.removeProperty('display');}}
 }
 function panel(item){
  const regional=!located(item);
  if(regional){const distance=document.getElementById('pd-distvoce');if(distance)distance.style.display='none';}
  for(const id of ['pd-focus-btn']){const el=document.getElementById(id);if(el&&regional){el.hidden=true;el.style.setProperty('display','none','important');}}
  const cities=document.getElementById('pd-cities-section');if(cities&&regional)cities.style.display='none';
  if(isBulletin(item)){bulletinFront(item);return;}
  if(item?.hazardNature!=='warning')return;
  document.getElementById('painel-direito')?.classList.add('pd-warning');
  const impact=document.getElementById('pd-impact')?.parentNode;if(impact)impact.style.display='none';
  const section=document.createElement('section');section.id='pd-notice-brief';section.className='bubble-section record-notice-brief';
  const title=document.createElement('h3');title.textContent=label(item);section.append(title);
  const add=text=>{const p=document.createElement('p');p.textContent=text;section.append(p);};
  add('Aviso oficial · '+(item.source||'Fonte não informada'));
  add('Severidade: '+(item.severityLabel||'Não informada'));
  if(Number.isFinite(item.onset)&&item.onset>Date.now())add('Início previsto: '+formatBrasiliaDateTime(item.onset));
  add(Number.isFinite(item.expiresAt)?'Válido até: '+formatBrasiliaDateTime(item.expiresAt):'Validade não informada pelo feed; confira o boletim oficial.');
  if(regional)add('Aviso para a região indicada. A fonte não fornece um ponto verificado no mapa.');
  else if(item.locationNote)add(item.locationNote);
  if(item.warningDescription)add(item.warningDescription.length>450?item.warningDescription.slice(0,450)+'…':item.warningDescription);
  const url=bulletin(item);if(url){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent='Abrir boletim oficial ↗';section.append(a);}
  document.getElementById('pd-impact')?.parentNode?.before(section);
 }
 window.RecordPresentation={located,label,bulletin,isBulletin,reset,panel};
})();
