/* Telegram-only, compact Monitor Global earthquake bulletin.
 * Reuses the production map/image renderer but leaves the site story layout untouched.
 * All labels come from validated event or tsunami objects. */
(function(){
 const MAP_Y=349,MAP_HEIGHT=620,ANCHOR_Y=MAP_HEIGHT/2;
 const CONTEXT={x:28,y:765,width:184,height:169,imageX:35,imageY:795,imageWidth:170,imageHeight:129};
 const NAVY='#071724',FOOT='#020816',CYAN='#38bdf8',WHITE='#f1f7ff',MUTED='#bfd1df',RED='#ff6f79',ORANGE='#ffd079';
 const rgb=n=>String(n).replace(/[^0-9a-f]/ig,'').slice(0,6);
 function telegramFrame(ev){
  const old=globalThis.QuakeCardLayout.frame(ev);
  const span=old.maxLon-old.minLon,ratio=MAP_HEIGHT/(2*800);
  return {...old,height:MAP_HEIGHT,anchorY:ANCHOR_Y,
   minLat:Number(ev.lat)-span*ratio,maxLat:Number(ev.lat)+span*ratio};
 }
 function fit(p,s,size,width,bold=false){
  s=String(s??'').replace(/\s+/g,' ').trim();
  while(s.length>4&&p.measure(s,size,bold)>width)s=s.slice(0,-4)+'...';
  return s;
 }
 function label(p,s,x,y,size,color=WHITE,bold=false,max=720){
  const value=fit(p,s,size,max,bold);
  // Rajdhani Bold is the exact TV-card family already embedded in the HD font atlas.
  if(bold&&size>=25&&typeof p.brandText==='function')p.brandText(value,x,y,size,color);
  else p.text(value,x,y,size,color,bold);
 }
 function box(p,x,y,w,h,color=NAVY){(p.roundRect||p.rect)(x,y,w,h,color);}
 function stripe(p,x,y,w,color=CYAN){p.rect(x,y,w,2,color);}
 function countryTag(ev){
  if(ev.brazil===true)return 'BRASIL';
  const text=String(ev.place||'').toLowerCase();
  return /japan|japão|honshu|hokkaido|kyushu|shikoku/.test(text)?'JAPÃO':'MUNDO';
 }
 function brazilTime(ev){
  if(ev.timeIso&&Number.isFinite(Date.parse(ev.timeIso))){
   const d=new Date(ev.timeIso),date=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
   const hour=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
   return {date,hour:hour+' BRT'};
  }
  const parts=String(ev.when||'').split(/\s*[·,]\s*/);
  return {date:parts[0]||'Data indisponível',hour:(parts[1]||'Horário indisponível').replace(/\s*BRT$/,'')+' BRT'};
 }
 function tsunamiCopy(ts){
  const groups=Array.isArray(ts?.regionalGroups)?ts.regionalGroups:[];
  const state=String(ts?.state||'unknown');
  let heading='SITUAÇÃO NÃO CONFIRMADA',color=MUTED;
  if(state==='warning'){heading='AVISO OFICIAL DE TSUNAMI';color=RED;}
  else if(state==='watch'){heading='VIGILÂNCIA DE TSUNAMI';color=ORANGE;}
  else if(state==='advisory'){heading='AVISO PREVENTIVO DE TSUNAMI';color=ORANGE;}
  else if(state==='noThreat'){heading='SEM AMEAÇA SEGUNDO BOLETIM';color='#9dcbbb';}
  else if(state==='cancelled'){heading='AVISO CANCELADO';color='#9dcbbb';}
  const group=groups[0];
  const area=group?.regions?.join(' · ')||ts?.areas||(state==='unknown'?'Sem boletim oficial confirmado nesta consulta.':'Consulte a autoridade local.');
  const published=ts?.source||group?.source||'';
  return {heading,color,area,published,otherGroups:Math.max(0,groups.length-1),stale:!!ts?.stale};
 }
 function drawTsunami(p,ts){
  const t=tsunamiCopy(ts);
  box(p,24,994,752,132,'#10232c');p.rect(24,994,6,132,t.color);
  label(p,'TSUNAMI',44,1012,16,CYAN,true,215);
  label(p,t.heading,230,1008,22,t.color,true,528);
  label(p,t.area,46,1047,16,WHITE,false,704);
  label(p,[t.published,t.otherGroups?'Outras regiões no boletim':'',t.stale?'Atualização indisponível':''].filter(Boolean).join(' · ')||
   'Consulte boletins oficiais atualizados.',46,1080,12,MUTED,false,704);
  label(p,'A ausência de boletim não confirma ausência de risco.',46,1102,11,MUTED,false,704);
 }
 function draw(p,ev){
  const mag=Number(ev.mag),large=Number.isFinite(mag)&&mag>=6;
  const fmt=Number.isFinite(mag)?mag.toFixed(1).replace('.',','):'—';
  const tag=countryTag(ev),badge=ev.test?'SIMULAÇÃO':ev.revisionText||ev._deltaTxt?'REVISADO':'REGISTRADO';
  const name=String(ev.imageRegion||'').trim()||tag;
  const place=globalThis.EventPortuguese?.place(ev.place)||ev.place||'Local não informado';
  const when=brazilTime(ev);
  // Do not paint over the georeferenced satellite map already composited below.
  p.rect(0,0,800,MAP_Y,FOOT);
  p.rect(0,MAP_Y+MAP_HEIGHT,800,1440-MAP_Y-MAP_HEIGHT,FOOT);
  box(p,18,14,764,88,NAVY);
  for(const rad of [21,14,7])p.arc(51,56,rad,1.4,-90,330,CYAN);
  p.dot(51,56,3,CYAN);
  (p.brandText||p.text)('MONITOR GLOBAL',86,31,34,WHITE,true);
  label(p,'SISMOS · VULCÕES · CICLONES · ALERTAS',87,73,12,MUTED,false,500);
  label(p,badge,656,37,13,CYAN,true,120);
  stripe(p,24,107,752,CYAN);

  box(p,24,119,752,58,NAVY);p.rect(24,121,5,54,large?RED:CYAN);
  label(p,large?'SISMO DE GRANDE MAGNITUDE':'SISMO REGISTRADO NO BRASIL',46,133,25,WHITE,true,650);

  box(p,24,188,752,147,'#10232c');
  box(p,33,196,310,129,large?'#35131d':'#102f41');
  p.rect(33,196,5,129,large?RED:CYAN);
  label(p,'MAGNITUDE',52,205,18,large?RED:CYAN,true,270);
  label(p,'M'+fmt,50,232,101,WHITE,true,280);
  p.rect(357,205,2,111,CYAN);
  label(p,name,381,206,32,WHITE,true,376);
  label(p,place,381,253,19,MUTED,false,373);
  label(p,tag,381,291,17,CYAN,true,275);

  // The imagery is already drawn by the Worker underneath this scene at y=MAP_Y.
  p.rect(24,MAP_Y,752,3,CYAN);p.rect(24,MAP_Y+MAP_HEIGHT-3,752,3,CYAN);
  p.dot(400,MAP_Y+ANCHOR_Y,9,WHITE);p.dot(400,MAP_Y+ANCHOR_Y,6,large?RED:CYAN);
  for(const rad of [30,58,90])p.arc(400,MAP_Y+ANCHOR_Y,rad,1,0,360,large?RED:CYAN);
  box(p,451,MAP_Y+ANCHOR_Y-21,205,37,NAVY);
  label(p,'EPICENTRO · M'+fmt,467,MAP_Y+ANCHOR_Y-12,18,WHITE,true,182);
  if(!ev.imageMapAvailable){box(p,232,MAP_Y+53,356,44);label(p,'Mapa indisponível nesta consulta',244,MAP_Y+66,15,MUTED,false,335);}

  drawTsunami(p,ev.imageTsunami);

  box(p,24,1137,752,80,NAVY);stripe(p,24,1137,752,CYAN);
  label(p,'DATA · BRT',42,1153,13,MUTED,true,200);
  label(p,when.date+' · '+when.hour,42,1177,20,WHITE,true,325);
  p.rect(384,1152,1,51,'#304950');
  label(p,'PROFUNDIDADE',403,1153,13,MUTED,true,180);
  const depth=ev.depth!=null&&ev.depth!==''&&Number.isFinite(Number(ev.depth))?Math.round(Math.abs(Number(ev.depth)))+' km':'Não informada';
  label(p,depth,403,1177,20,WHITE,true,180);
  p.rect(603,1152,1,51,'#304950');
  label(p,'FONTE',622,1153,13,MUTED,true,146);
  label(p,ev.source||'Não informada',622,1177,18,WHITE,true,146);

  box(p,24,1227,752,112,NAVY);
  const mmi=ev.mmi&&ev.mmi!=='—'?String(ev.mmi):'Indisponível';
  label(p,'MMI ESTIMADA',41,1241,13,MUTED,true,220);
  label(p,mmi,41,1270,23,WHITE,true,220);
  p.rect(286,1244,1,80,'#304950');
  label(p,'POPULAÇÃO POTENCIAL',305,1241,13,MUTED,true,225);
  const e=ev.exposure,pop=globalThis.QuakeCardLayout.validExposure(e)?Number(e.ranges[0].population):null;
  label(p,pop!=null?('~ '+Math.round(pop).toLocaleString('pt-BR')):'Sem estimativa',305,1270,pop!=null?22:18,WHITE,true,235);
  p.rect(553,1244,1,80,'#304950');
  label(p,'ENERGIA TEÓRICA',570,1241,13,MUTED,true,195);
  label(p,ev.energy||'Indisponível',570,1270,18,WHITE,true,195);
  label(p,'Estimativas não confirmam danos ou pessoas atingidas.',41,1312,12,MUTED,false,714);

  stripe(p,28,1360,744,CYAN);
  label(p,'monitorglobal.top',32,1380,17,MUTED,true,350);
  label(p,'@monitor_global',544,1380,18,CYAN,true,222);
 }
 globalThis.QuakeTelegramLayout={version:'telegram-v18',MAP_Y,MAP_HEIGHT,ANCHOR_Y,CONTEXT,TSUNAMI_Y:994,TSUNAMI_HEIGHT:132,telegramFrame,draw,drawTsunami,tsunamiCopy};
})();
