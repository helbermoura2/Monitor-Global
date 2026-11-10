/* Static site sharing: one Concept 6 composition, factual fields per event. */
(function(root){
 'use strict';
 const W=1080,H=1920,CYAN='#37def5',WHITE='#f4faff',MUTED='#b9d4df',RED='#ff364f';
 const number=(n,suffix='',digits=1)=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:digits})+suffix:'Não informado';
 const located=e=>Array.isArray(e.coords)&&e.coords.length>=2&&e.coords.slice(0,2).every(Number.isFinite)&&Math.abs(e.coords[0])<=180&&Math.abs(e.coords[1])<=85;
 function profile(e){
  const quake=e.type==='earthquake'||(!e.type&&e.mag!=null),weather=['capital-weather','temperature','weather','heat','cold'].includes(e.type);
  const labels={fire:'INCÊNDIO',storm:'TEMPESTADE',hurricane:'CICLONE',tornado:'TORNADO',tsunami:'TSUNAMI',civil:'INFORMATIVO',wind:'VENTO',flood:'ENCHENTE',volcano:'VULCÃO'};
  const title=quake?'SISMO':weather?'TEMPERATURA':(root.RecordPresentation?.label(e)||e.displayLabel||e.cycloneLabel||labels[e.type]||e.type||'EVENTO').toUpperCase();
  const metric=quake?'M'+number(e.mag):weather?number(e.temperature,' °C'):e.severityLabel||e.alertLevel||(e.type==='hurricane'?e.classification:null)||'REGISTRO';
  let stats;
  if(quake){const knownDepth=typeof e.depth==='number'&&Number.isFinite(e.depth);let mmi='Indisponível';if(knownDepth&&typeof e.mag==='number'&&Number.isFinite(e.mag)&&root.QuakeImagePaint)try{const k=QuakeImagePaint.estimatedMmi({mag:e.mag,depth:e.depth});mmi=k+' · '+({I:'Não perceptível',II:'Muito fraca',III:'Fraca',IV:'Leve',V:'Moderada',VI:'Forte',VII:'Muito forte',VIII:'Severa',IX:'Violenta',X:'Extrema',XI:'Extrema',XII:'Extrema'}[k]||'Estimativa');}catch{}const status=e.imageTsunami?.state;const ts={noThreat:'Sem ameaça (boletim)',warning:'Aviso por região',watch:'Atenção por região',advisory:'Atenção por região',cancelled:'Aviso encerrado'}[status]||'Não confirmado';stats=[['PROFUNDIDADE',number(e.depth,' km')],['INTENSIDADE EST.',mmi],['TSUNAMI',ts]];}
  else if(weather)stats=[['SENSAÇÃO',number(e.feels,' °C')],['UMIDADE',number(e.humidity,'%')],['VENTO',number(e.wind,' km/h')]];
  else if(e.type==='hurricane')stats=[['CLASSIFICAÇÃO',e.cycloneLabel||e.classification||'Não informada'],['VENTO MÁXIMO',number(e.windKmh,' km/h')],['PRESSÃO',number(e.pressureMb,' hPa')]];
  else stats=[['SITUAÇÃO',e.severityLabel||e.statusLabel||'Conforme a fonte'],['REGIÃO',e.region||e.uf||e.country||'Ver localização'],['TIPO',e.hazardNature==='forecast'?'Previsão':e.hazardNature==='observed'?'Observado':e.hazardNature==='warning'?'Aviso oficial':'Registro da fonte']];
  return {quake,weather,title,metric,stats,marker:quake?'EPICENTRO · '+metric:weather?'LOCAL DA PREVISÃO':'REFERÊNCIA DO EVENTO',note:quake?'Intensidade estimada. Anéis de localização; não indicam raio de dano.':weather?'Condições conforme a fonte indicada; sujeitas a atualização.':'A referência no mapa não delimita a área de risco. Consulte a fonte oficial.'};
 }
 function frame(e,p){let span=1;if(p.quake&&root.QuakeSiteCard)try{const f=QuakeSiteCard.frame({mag:e.mag,depth:e.depth,lon:e.coords[0],lat:e.coords[1]});span=(f.maxLon-f.minLon)/2;}catch{}else if(!p.weather)span=3;
  const [lon,lat]=e.coords;return {minLon:lon-span,maxLon:lon+span,minLat:Math.max(-85,lat-2*span*940/W),maxLat:Math.min(85,lat+2*span*820/W)};
 }
 function load(url,timeout=4500){return new Promise(resolve=>{const img=new Image();img.crossOrigin='anonymous';const timer=setTimeout(()=>{img.onload=img.onerror=null;resolve(null);},timeout);img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);resolve(null);};img.src=url;});}
 function mapUrl(service,f,width,height){return 'https://server.arcgisonline.com/ArcGIS/rest/services/'+service+'/MapServer/export?'+new URLSearchParams({bbox:[f.minLon,f.minLat,f.maxLon,f.maxLat].join(','),bboxSR:'4326',imageSR:'4326',size:width+','+height,format:'png32',transparent:'true',f:'image'});}
 let fonts;
 async function render(e){
  const p=profile(e),hasLocation=located(e),canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');
  if(!fonts)fonts=(async()=>{if(!root.FontFace)return;try{const loaded=await Promise.all([new FontFace('StoryInter','url(assets/summary-fonts/Inter.ttf)',{weight:'100 900'}).load(),new FontFace('StoryRajdhani','url(assets/summary-fonts/Rajdhani-Bold.ttf)',{weight:'700'}).load()]);loaded.forEach(f=>document.fonts.add(f));}catch{}})();
  const f=hasLocation?frame(e,p):null,cf=hasLocation?{minLon:e.coords[0]-8,maxLon:e.coords[0]+8,minLat:Math.max(-85,e.coords[1]-5.7),maxLat:Math.min(85,e.coords[1]+5.7)}:null;
  const flagsTask=root.QuakeSiteFlags?QuakeSiteFlags.resolve(e).then(async meta=>({meta,images:await QuakeSiteFlags.images(meta)})).catch(()=>null):null;
  const [sat,labels,regional,flags]=await Promise.all([hasLocation?load(mapUrl('World_Imagery',f,W,1760)):null,hasLocation?load(mapUrl('Reference/World_Boundaries_and_Places',f,W,1760)):null,hasLocation?load(mapUrl('World_Topo_Map',cf,280,194)):null,flagsTask,fonts]);
  const font=(size,bold=false)=>`${bold?'700':'500'} ${size}px StoryInter, sans-serif`;
  function text(value,x,y,size=25,color=WHITE,maxWidth=1000,bold=false){c.font=font(size,bold);let t=String(value??'Não informado');while(t.length>2&&c.measureText(t).width>maxWidth)t=t.slice(0,-2)+'…';c.fillStyle=color;c.textAlign='left';c.textBaseline='top';c.fillText(t,x,y);}
  function lines(value,x,y,width,size=24,maxLines=2,color=WHITE){c.font=font(size);const words=String(value||'').split(/\s+/),out=[];let line='';for(const word of words){if(c.measureText((line+' '+word).trim()).width>width&&line){out.push(line);line=word;}else line=(line+' '+word).trim();}if(line)out.push(line);out.slice(0,maxLines).forEach((s,i)=>text(i===maxLines-1&&out.length>maxLines?out.slice(i).join(' '):s,x,y+i*(size+8),size,color,width));}
  function box(x,y,w,h,r=22,fill='rgba(3,30,43,.88)',glow=12){c.save();c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();c.strokeStyle='#80deec';c.lineWidth=1.5;c.shadowColor=CYAN;c.shadowBlur=glow;c.stroke();c.restore();}
  function stroke(x1,y1,x2,y2){c.strokeStyle='rgba(178,225,231,.55)';c.lineWidth=1;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
  c.fillStyle='#02141e';c.fillRect(0,0,W,H);
  // A decorative horizon clips the real regional map; map coordinates are never warped.
  c.save();c.beginPath();c.ellipse(540,1410,1500,1320,0,0,Math.PI*2);c.clip();
  if(sat)c.drawImage(sat,0,0,W,1760);if(labels&&sat)c.drawImage(labels,0,0,W,1760);
  const shade=c.createLinearGradient(0,100,0,1810);shade.addColorStop(0,'rgba(0,20,30,.68)');shade.addColorStop(.28,'rgba(0,18,24,.05)');shade.addColorStop(.72,'rgba(0,20,26,.05)');shade.addColorStop(1,'rgba(0,19,28,.94)');c.fillStyle=shade;c.fillRect(0,0,W,H);c.restore();
  c.save();c.beginPath();c.ellipse(540,1410,1500,1320,0,Math.PI*1.17,Math.PI*1.83);c.strokeStyle=CYAN;c.lineWidth=2;c.shadowColor='#04c8ff';c.shadowBlur=28;c.stroke();c.restore();
  // Radar mark, matching the site's brand. No textual placeholder logo.
  box(70,36,72,72,12,'#00121e',5);c.save();c.translate(106,72);c.strokeStyle=CYAN;c.lineWidth=2;for(const r of [12,22,30]){c.beginPath();c.arc(0,0,r,0,2*Math.PI);c.stroke();}c.fillStyle=CYAN;c.beginPath();c.moveTo(0,0);c.arc(0,0,29,-Math.PI/2,-.2);c.closePath();c.fill();c.restore();
  text('MONITOR GLOBAL',166,47,39,WHITE,820,true);
  c.fillStyle=CYAN;c.fillRect(58,176,7,86);text(p.title,98,171,39,WHITE,340,true);lines(e.place||'Local não informado',98,226,320,29,2);
  c.save();c.translate(542,232);c.rotate(.07);box(-130,-48,260,96,19,'rgba(52,8,23,.91)',19);c.font='italic 700 '+(p.metric.length>10?35:72)+'px StoryRajdhani, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=WHITE;c.fillText(p.metric,0,0,236);c.restore();
  stroke(721,182,721,271);
  if(flags){for(const [i,key] of ['country','state'].entries()){const img=flags.images[key];if(img){const x=763+i*133;box(x,195,116,76,7,'#05273a',2);c.save();c.beginPath();c.roundRect(x,195,116,76,7);c.clip();c.drawImage(img,x,195,116,76);c.restore();}}}
  box(45,345,307,265,22);text('CONTEXTO REGIONAL',66,362,19,WHITE,270,true);
  if(regional){c.save();c.beginPath();c.roundRect(58,394,281,199,12);c.clip();c.drawImage(regional,58,394,281,199);const x=58+(e.coords[0]-cf.minLon)/(cf.maxLon-cf.minLon)*281,y=394+(cf.maxLat-e.coords[1])/(cf.maxLat-cf.minLat)*199;c.beginPath();c.arc(x,y,10,0,2*Math.PI);c.fillStyle=WHITE;c.fill();c.beginPath();c.arc(x,y,7,0,2*Math.PI);c.fillStyle=RED;c.fill();c.restore();}
  else lines(hasLocation?'Mapa regional indisponível':e.place||'Região informada pela fonte',66,420,261,24,4,MUTED);
  if(hasLocation){
   const x=(e.coords[0]-f.minLon)/(f.maxLon-f.minLon)*W,y=(f.maxLat-e.coords[1])/(f.maxLat-f.minLat)*1760;
   c.save();c.strokeStyle=RED;for(const [r,a] of [[48,.65],[91,.38],[136,.2]]){c.globalAlpha=a;c.lineWidth=2;c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.stroke();}c.globalAlpha=1;c.shadowColor=RED;c.shadowBlur=22;c.fillStyle=RED;c.beginPath();c.arc(x,y,17,0,2*Math.PI);c.fill();c.shadowBlur=0;c.strokeStyle=WHITE;c.lineWidth=4;c.stroke();c.restore();
   const bx=Math.min(W-430,Math.max(375,x+8)),by=y-127;box(bx,by,382,60,19);c.beginPath();c.moveTo(bx+40,by+60);c.lineTo(x,y-15);c.lineTo(bx+78,by+60);c.fillStyle='#062936';c.fill();c.strokeStyle='#b8efff';c.lineWidth=1.5;c.stroke();text(p.marker,bx+22,by+17,24,WHITE,340,true);
   if(!sat){box(340,1045,505,65);text('Mapa de satélite indisponível',362,1064,24,MUTED,460);}
  }else{box(250,770,650,116);lines('localização pontual não informada',280,800,590,28,2);}
  const summary=String(e.bulletinSummary||e.condition||e.descOnly||e.detail||'').trim();if(summary){box(55,1218,970,115,20,'rgba(3,25,37,.86)',4);lines(summary,80,1240,920,24,2);}
  box(29,1383,1022,363,43,'rgba(3,38,49,.91)',19);
  const when=Number.isFinite(Number(e.time))&&Number(e.time)>0?new Date(Number(e.time)).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',',' ·')+' BRT':'Horário não informado';
  text('▦',80,1425,34);text(when,128,1430,25,WHITE,450,true);stroke(565,1425,565,1470);text(e.sourceSummary||e.source||'Fonte não informada',604,1432,25,WHITE,405,true);stroke(69,1492,1008,1492);
  p.stats.forEach(([label,value],i)=>{const x=85+i*318;if(i)stroke(x-22,1520,x-22,1612);lines(value,x,1523,284,27,2);text(label,x,1595,15,MUTED,285,true);});
  text(p.note,70,1640,15,MUTED,940);
  box(29,1630+65,1022,118,40,'rgba(3,34,46,.96)',15);text('◎',87,1720,45,CYAN);text('monitorglobal.top',166,1732,29,WHITE,380,true);stroke(485,1720,485,1780);
  c.save();c.fillStyle='#08a8d7';c.beginPath();c.arc(558,1753,27,0,Math.PI*2);c.fill();c.fillStyle=WHITE;c.beginPath();c.moveTo(541,1751);c.lineTo(575,1737);c.lineTo(565,1770);c.lineTo(556,1759);c.lineTo(550,1765);c.lineTo(551,1755);c.closePath();c.fill();c.restore();text('Telegram · @monitor_global',606,1736,24,WHITE,410,true);
  // Decorative signature waves below the data, never presented as geophysical observations.
  c.save();c.strokeStyle='#15b8df';c.lineWidth=.8;for(let j=0;j<17;j++){c.globalAlpha=.08+j*.008;c.beginPath();for(let x=0;x<=W;x+=9){const y=1860+Math.sin(x/91+j*.25)*25+Math.sin(x/230-j*.23)*14+j*2;if(x===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}c.restore();
  text(sat?'Imagem de base: Esri, Maxar, Earthstar Geographics':'Fundo ilustrativo · imagem de base indisponível',60,1819,12,MUTED,960);
  return canvas;
 }
 root.SiteEventStory={render,profile,version:'site-concept6-all-v2'};
})(window);
