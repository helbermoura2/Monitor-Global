/* Telegram panoramic glass composition. Geometry remains georeferenced. */
(function(){
 const legacy=globalThis.QuakeTelegramLayout;
 const MAP_Y=0,MAP_HEIGHT=1440,ANCHOR_Y=660;
 const CONTEXT={x:32,y:754,width:190,height:164,imageX:40,imageY:788,imageWidth:174,imageHeight:120};
 const WHITE='#edf8fc',CYAN='#59dce9',MUTED='#bad4dc';
 const text=(p,s,x,y,size=20,color=WHITE,bold=false)=>p.text(String(s??''),x,y,size,color,bold);
 const glass=(p,x,y,w,h,curve=false)=>p.glass?p.glass(x,y,w,h,curve):(p.roundRect||p.rect)(x,y,w,h,'#10313e');
 function lines(p,s,x,y,width,size=27,max=3){let row='',rows=[];for(const word of String(s||'').split(/\s+/)){if(p.measure((row+' '+word).trim(),size,true)>width&&row){rows.push(row);row=word;}else row=(row+' '+word).trim();}if(row)rows.push(row);if(rows.length>max&&size>19)return lines(p,s,x,y,width,size-1,max);rows.forEach((r,i)=>text(p,r,x,y+i*(size+6),size,WHITE,true));}
 function active(ts){return !!ts&&!ts.stale&&(['warning','watch','advisory'].includes(ts.state)||(ts.regionalGroups||[]).some(g=>!g.stale&&['warning','watch','advisory'].includes(g.state)));}
 function drawTsunami(p,ts){if(!active(ts))return;glass(p,238,930,538,146);text(p,'AVISO DE TSUNAMI',256,946,20,'#ffd28b',true);const groups=(ts.regionalGroups||[]).filter(g=>!g.stale&&['warning','watch','advisory'].includes(g.state));const area=groups.length?groups.map(g=>g.regions?.join(' · ')).filter(Boolean).join(' / '):ts.areas;lines(p,area||'Consulte as regiões do boletim oficial.',256,978,498,18,2);text(p,ts.source||groups[0]?.source||'Boletim oficial',256,1044,14,MUTED);}
 function telegramFrame(ev){const old=globalThis.QuakeCardLayout.frame(ev),span=old.maxLon-old.minLon;return {...old,width:800,height:MAP_HEIGHT,anchorY:ANCHOR_Y,minLat:Number(ev.lat)-span*(MAP_HEIGHT-ANCHOR_Y)/800,maxLat:Number(ev.lat)+span*ANCHOR_Y/800};}
 function draw(p,ev){
  const m=Number(ev.mag),mag=Number.isFinite(m)?m.toFixed(1).replace('.',','):'—';
  glass(p,24,28,752,84);for(const r of [21,14,7])p.arc(57,69,r,1.3,0,345,CYAN);p.dot(57,69,3,CYAN);text(p,'MONITOR GLOBAL',94,52,28,WHITE,true);
  p.flag?.('country',ev.imageCountryCode,584,46,78,48);if(ev.brazil)p.flag?.('state',ev.imageStateCode,682,46,78,48);
  const place=globalThis.EventPortuguese?.place(ev.place)||ev.place||'Local não informado';
  glass(p,24,128,752,122);p.rect(30,143,4,76,CYAN);lines(p,place,50,140,700,32,3);
  glass(p,32,266,205,87);text(p,'M'+mag,52,276,62,CYAN,true);
  if(ev.test)text(p,'SIMULAÇÃO',260,290,18,CYAN,true);
  p.dot(400,ANCHOR_Y,9,WHITE);p.dot(400,ANCHOR_Y,6,CYAN);for(const r of [28,52,78])p.arc(400,ANCHOR_Y,r,1,0,360,CYAN);
  glass(p,455,ANCHOR_Y-57,298,42);text(p,'EPICENTRO · M'+mag,470,ANCHOR_Y-47,19,WHITE,true);
  if(!ev.imageMapAvailable){glass(p,255,450,480,70);text(p,'Mapa indisponível nesta consulta',275,474,21,MUTED);}
  drawTsunami(p,ev.imageTsunami);
  glass(p,24,1095,752,270,true);
  const d=ev.timeIso?new Date(ev.timeIso):null;const date=d&&Number.isFinite(d.getTime())?d.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Data indisponível';const hour=d&&Number.isFinite(d.getTime())?d.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})+' BRT':'';
  text(p,'DATA · BRT',50,1141,14,MUTED,true);text(p,date,50,1168,22,WHITE,true);text(p,hour,50,1198,20);
  text(p,'PROFUNDIDADE',310,1141,14,MUTED,true);text(p,ev.depth!=null&&ev.depth!==''&&Number.isFinite(Number(ev.depth))?Math.abs(Number(ev.depth)).toLocaleString('pt-BR',{maximumFractionDigits:1})+' km':'Não informada',310,1176,24,WHITE,true);
  text(p,'FONTE',575,1141,14,MUTED,true);lines(p,ev.source||'Não informada',575,1176,178,20,2);
  p.rect(50,1240,700,1,'#4b7782');
  text(p,ev.reviewed?'Revisado':ev.reviewStatus==='unknown'?'Revisão não informada':'Automático',50,1264,19,WHITE,true);
  const official=ev.shaking?.status==='available';text(p,'Intensidade '+(official?'oficial':'estimada')+' '+(ev.mmi||'indisponível'),310,1260,20,WHITE,true);
  text(p,'Estimativa não confirma danos.',310,1294,15,MUTED);
  glass(p,24,1380,752,48);text(p,'monitorglobal.top',44,1392,19,WHITE,true);text(p,'Telegram · @monitor_global',441,1392,19,CYAN,true);
 }
 globalThis.QuakeTelegramLegacyLayout=legacy;
 globalThis.QuakeTelegramLayout={version:'telegram-glass-v19',MAP_Y,MAP_HEIGHT,ANCHOR_Y,CONTEXT,TSUNAMI_Y:930,TSUNAMI_HEIGHT:146,showScale:false,telegramFrame,draw,drawTsunami,active};
})();
