/* Static site sharing: one Concept 6 composition, factual fields per event. */
(function(root){
 'use strict';
 const W=1080,H=1920,CYAN='#37def5',WHITE='#f4faff',MUTED='#b9d4df',RED='#ff364f';
 const number=(n,suffix='',digits=1)=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:digits})+suffix:'Não informado';
 const located=e=>Array.isArray(e.coords)&&e.coords.length>=2&&e.coords.slice(0,2).every(Number.isFinite)&&Math.abs(e.coords[0])<=180&&Math.abs(e.coords[1])<=85;
 function profile(e){
  const quake=e.type==='earthquake'||(!e.type&&e.mag!=null),weather=['capital-weather','temperature','weather','heat','cold'].includes(e.type);
  const bulletin=e.hazardNature==='bulletin'&&e.source==='CGE';
  const labels={fire:'INCÊNDIO',storm:'TEMPESTADE',hurricane:'CICLONE',tornado:'TORNADO',tsunami:'TSUNAMI',civil:'INFORMATIVO',wind:'VENTO',flood:'ENCHENTE',volcano:'VULCÃO'};
  // A CGE weather bulletin is not necessarily a storm warning.
  const title=quake?'SISMO':weather?'TEMPERATURA':bulletin?'BOLETIM CGE':e.type==='storm'?'TEMPESTADE':(root.RecordPresentation?.label(e)||e.displayLabel||e.cycloneLabel||labels[e.type]||e.type||'EVENTO').toUpperCase();
  const metric=quake?'M'+number(e.mag):weather?number(e.temperature,' °C'):bulletin?'INFORMATIVO':e.type==='storm'?'TEMPESTADE':e.severityLabel||e.alertLevel||(e.type==='hurricane'?e.classification:null)||labels[e.type]||'EVENTO';
  let stats;
  if(quake){const knownDepth=typeof e.depth==='number'&&Number.isFinite(e.depth);let mmi='Indisponível',official=e.shaking?.status==='available',k=null;try{if(official&&located(e)&&root.RuptureShakingModel?.valid(e.shaking.grid)){const value=RuptureShakingModel.sample(e.shaking.grid,e.coords[0],e.coords[1]);if(Number.isFinite(value))k=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][Math.max(0,Math.min(11,Math.round(value)-1))];}else if(!official&&knownDepth&&typeof e.mag==='number'&&Number.isFinite(e.mag)&&root.QuakeImagePaint)k=QuakeImagePaint.estimatedMmi({mag:e.mag,depth:e.depth});if(k)mmi=k+' · '+({I:'Não perceptível',II:'Muito fraca',III:'Fraca',IV:'Leve',V:'Moderada',VI:'Forte',VII:'Muito forte',VIII:'Severa',IX:'Violenta',X:'Extrema',XI:'Extrema',XII:'Extrema'}[k]||'Estimativa');}catch{}const status=e.imageTsunami?.state;const relevant=e.imageTsunami&&!e.imageTsunami.stale&&(['warning','watch','advisory'].includes(status)||(e.imageTsunami.regionalGroups||[]).some(g=>!g.stale&&['warning','watch','advisory'].includes(g.state)));const third=relevant?['TSUNAMI',status==='warning'?'Aviso por região':'Atenção por região']:located(e)?['COORDENADAS',Math.abs(e.coords[1]).toFixed(2).replace('.',',')+'° '+(e.coords[1]<0?'S':'N')+' · '+Math.abs(e.coords[0]).toFixed(2).replace('.',',')+'° '+(e.coords[0]<0?'O':'L')]:['REVISÃO',typeof e.reviewed==='boolean'?(e.reviewed?'Revisado':'Automático'):'Não informada'];stats=[['PROFUNDIDADE',number(e.depth,' km')],[official?'INTENSIDADE · MMI':'INTENSIDADE EST.',mmi],third];}
  else if(weather)stats=[['SENSAÇÃO',number(e.feels,' °C')],['UMIDADE',number(e.humidity,'%')],['VENTO',number(e.wind,' km/h')]];
  else if(bulletin)stats=[['SITUAÇÃO','Informativo'],['REGIÃO','São Paulo · SP'],['TIPO','Boletim meteorológico']];
  else if(e.type==='hurricane')stats=[['CLASSIFICAÇÃO',e.cycloneLabel||e.classification||'Não informada'],['VENTO MÁXIMO',number(e.windKmh,' km/h')],['PRESSÃO',number(e.pressureMb,' hPa')]];
  else stats=[['SITUAÇÃO',e.severityLabel||e.statusLabel||'Conforme a fonte'],['REGIÃO',e.region||e.uf||e.country||'Ver localização'],['TIPO',e.hazardNature==='forecast'?'Previsão':e.hazardNature==='observed'?'Observado':e.hazardNature==='warning'?'Aviso oficial':'Registro da fonte']];
  return {quake,weather,bulletin,title,metric,stats,marker:quake?'EPICENTRO · '+metric:weather?'LOCAL DA PREVISÃO':bulletin?'REFERÊNCIA MUNICIPAL':'REFERÊNCIA DO EVENTO',note:quake?'Intensidade estimada. Anéis de localização; não indicam raio de dano.':weather?'Condições conforme a fonte indicada; sujeitas a atualização.':bulletin?'Boletim municipal informativo; não confirma tempestade nem área de risco.':'A referência no mapa não delimita a área de risco. Consulte a fonte oficial.'};
 }
 function frame(e,p){let span=1;if(p.quake&&root.QuakeSiteCard)try{const f=QuakeSiteCard.frame({mag:e.mag,depth:e.depth,lon:e.coords[0],lat:e.coords[1]});span=(f.maxLon-f.minLon)/2;}catch{}else if(!p.weather)span=3;
  const [lon,lat]=e.coords;return {minLon:lon-span,maxLon:lon+span,minLat:Math.max(-85,lat-2*span*940/W),maxLat:Math.min(85,lat+2*span*820/W)};
 }
 function load(url,timeout=6500){return new Promise(resolve=>{const img=new Image();img.crossOrigin='anonymous';const timer=setTimeout(()=>{img.onload=img.onerror=null;img.src='';resolve(null);},timeout);img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);resolve(null);};img.src=url;});}
 function mapUrl(service,f,width,height,jpeg=false){return 'https://server.arcgisonline.com/ArcGIS/rest/services/'+service+'/MapServer/export?'+new URLSearchParams({bbox:[f.minLon,f.minLat,f.maxLon,f.maxLat].join(','),bboxSR:'4326',imageSR:'4326',size:width+','+height,format:jpeg?'jpg':'png32',transparent:jpeg?'false':'true',f:'image'});}
 const maps=new Map();
 async function tileMap(f){
  // Source tiles are Mercator. Resample rows into the exact geographic export frame.
  const mx=(lon,z)=>(lon+180)/360*(256*2**z),my=(lat,z)=>{const a=Math.max(-85.0511,Math.min(85.0511,lat))*Math.PI/180;return (1-Math.log(Math.tan(a)+1/Math.cos(a))/Math.PI)/2*(256*2**z);};
  let plan;
  for(let z=12;z>=1;z--){const l=Math.floor(mx(f.minLon,z)/256),r=Math.floor((mx(f.maxLon,z)-.001)/256),t=Math.floor(my(f.maxLat,z)/256),b=Math.floor((my(f.minLat,z)-.001)/256);if((r-l+1)*(b-t+1)<=12){plan={z,l,r,t,b};break;}}
  if(!plan)return null;const {z,l,r,t,b}=plan,tiles=[];
  for(let y=t;y<=b;y++)for(let x=l;x<=r;x++)tiles.push({x,y});
  await Promise.all(tiles.map(async tile=>{const x=((tile.x%2**z)+2**z)%2**z;tile.image=await load('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/'+z+'/'+tile.y+'/'+x,5000);}));
  if(tiles.some(tile=>!tile.image))return null;
  const mosaic=document.createElement('canvas');mosaic.width=(r-l+1)*256;mosaic.height=(b-t+1)*256;const mc=mosaic.getContext('2d');tiles.forEach(tile=>mc.drawImage(tile.image,(tile.x-l)*256,(tile.y-t)*256,256,256));
  const out=document.createElement('canvas');out.width=810;out.height=1320;const c=out.getContext('2d'),sx=mx(f.minLon,z)-l*256,sw=mx(f.maxLon,z)-mx(f.minLon,z);
  for(let y=0;y<out.height;y++){const n=f.maxLat-(f.maxLat-f.minLat)*y/out.height,s=f.maxLat-(f.maxLat-f.minLat)*(y+1)/out.height,sy=my(n,z)-t*256,sh=Math.max(.01,my(s,z)-my(n,z));c.drawImage(mosaic,sx,sy,sw,sh,0,y,out.width,1);}
  mosaic.width=mosaic.height=1;return out;
 }
 async function satellite(f){const key=JSON.stringify(f);if(maps.has(key))return maps.get(key);const image=await load(mapUrl('World_Imagery',f,810,1320,true),6500)||await tileMap(f);if(image){maps.set(key,image);while(maps.size>2)maps.delete(maps.keys().next().value);}return image;}
 let planetTexture;
 function planet(){if(!planetTexture)planetTexture=load(mapUrl('World_Imagery',{minLon:-180,minLat:-85,maxLon:180,maxLat:85},720,340,true),4500).then(image=>{if(!image)planetTexture=null;return image;});return planetTexture;}
 let stateShapes;
 function regionShapes(){if(!stateShapes)stateShapes=fetch('assets/geography/br-states.json').then(r=>r.ok?r.json():null).then(d=>d?.features||[]).catch(()=>[]);return stateShapes;}
 let fonts;
 async function render(e){
  const p=profile(e),hasLocation=located(e),canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');
  if(!fonts)fonts=(async()=>{if(!root.FontFace)return;try{const loaded=await Promise.all([new FontFace('StoryInter','url(assets/summary-fonts/Inter.ttf)',{weight:'100 900'}).load(),new FontFace('StoryRajdhani','url(assets/summary-fonts/Rajdhani-Bold.ttf)',{weight:'700'}).load()]);loaded.forEach(f=>document.fonts.add(f));}catch{}})();
  const f=hasLocation?frame(e,p):null,cf=hasLocation?{minLon:e.coords[0]-3.3,maxLon:e.coords[0]+3.3,minLat:Math.max(-85,e.coords[1]-2.34),maxLat:Math.min(85,e.coords[1]+2.34)}:null;
  const flagsTask=root.QuakeSiteFlags?QuakeSiteFlags.resolve(e).then(async meta=>({meta,images:await QuakeSiteFlags.images(meta)})).catch(()=>null):null;
  const [sat,labels,regional,flags,earth,states]=await Promise.all([hasLocation?satellite(f):null,hasLocation?load(mapUrl('Reference/World_Boundaries_and_Places',f,810,1320),4500):null,hasLocation?load(mapUrl('World_Topo_Map',cf,420,298),4500):null,flagsTask,planet(),regionShapes(),Promise.race([fonts,new Promise(resolve=>setTimeout(resolve,3000))])]);
  if(hasLocation&&!sat){const error=Error('O mapa de satélite não carregou. Tente gerar a imagem novamente.');error.code='STORY_MAP_UNAVAILABLE';throw error;}
  const font=(size,bold=false)=>`${bold?'700':'500'} ${size}px StoryInter, sans-serif`;
  function text(value,x,y,size=25,color=WHITE,maxWidth=1000,bold=false){c.font=font(size,bold);let t=String(value??'Não informado');while(t.length>2&&c.measureText(t).width>maxWidth)t=t.slice(0,-2)+'…';c.fillStyle=color;c.textAlign='left';c.textBaseline='top';c.fillText(t,x,y);}
  function lines(value,x,y,width,size=24,maxLines=2,color=WHITE,bold=false){c.font=font(size,bold);const words=String(value||'').split(/\s+/),out=[];let line='';for(const word of words){if(c.measureText((line+' '+word).trim()).width>width&&line){out.push(line);line=word;}else line=(line+' '+word).trim();}if(line)out.push(line);out.slice(0,maxLines).forEach((s,i)=>text(i===maxLines-1&&out.length>maxLines?out.slice(i).join(' '):s,x,y+i*(size+8),size,color,width,bold));}
  function box(x,y,w,h,r=22,fill='rgba(3,30,43,.88)',glow=12,edge='#80deec'){c.save();c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();c.strokeStyle=edge;c.lineWidth=1.5;c.shadowColor=edge;c.shadowBlur=glow;c.stroke();c.restore();}
  // Same magnitude bands as getHexColor in the site's earthquake indicators.
  function metricAccent(event,profile){
   if(!profile.quake)return profile.weather?CYAN:'#ff8f50';
   const m=Number(event.mag);
   if(!Number.isFinite(m))return CYAN;
   if(typeof root.getHexColor==='function')return root.getHexColor(m);
   return m>=6?'#ef4444':m>=5?'#fb923c':m>=4?'#facc15':'#4ade80';
  }
  // Local satellite snapshot + blur + translucent tint, without a large header card.
  function metricGlass(x,y,w,h,accent){
   const pad=24,snapshot=document.createElement('canvas');
   snapshot.width=w+pad*2;snapshot.height=h+pad*2;
   snapshot.getContext('2d').drawImage(canvas,x-pad,y-pad,snapshot.width,snapshot.height,0,0,snapshot.width,snapshot.height);
   const rgba=alpha=>{
    const r=parseInt(accent.slice(1,3),16),g=parseInt(accent.slice(3,5),16),b=parseInt(accent.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+alpha+')';
   };
   c.save();c.beginPath();c.roundRect(x,y,w,h,19);c.clip();
   c.filter='blur(14px)';c.drawImage(snapshot,x-pad,y-pad);c.filter='none';
   c.fillStyle='rgba(3,30,42,.75)';c.fillRect(x,y,w,h);
   const tint=c.createLinearGradient(x,y,x,y+h);
   tint.addColorStop(0,rgba(.46));tint.addColorStop(.35,rgba(.20));tint.addColorStop(1,rgba(.09));
   c.fillStyle=tint;c.fillRect(x,y,w,h);
   const shine=c.createLinearGradient(x,y,x,y+h);
   shine.addColorStop(0,'rgba(244,255,255,.27)');shine.addColorStop(.28,'rgba(226,249,255,.07)');shine.addColorStop(1,'rgba(0,20,31,.07)');
   c.fillStyle=shine;c.fillRect(x,y,w,h);c.restore();
   c.save();c.beginPath();c.roundRect(x,y,w,h,19);
   c.lineWidth=2;c.strokeStyle=accent;c.shadowColor=rgba(.63);c.shadowBlur=13;c.stroke();c.restore();
   snapshot.width=snapshot.height=1;
  }
  function icon(kind,x,y){c.save();c.translate(x,y);c.strokeStyle=WHITE;c.lineWidth=2.5;c.lineCap='round';c.lineJoin='round';c.beginPath();
   if(kind==='calendar'){c.roundRect(0,4,32,29,4);c.moveTo(0,13);c.lineTo(32,13);c.moveTo(8,0);c.lineTo(8,8);c.moveTo(24,0);c.lineTo(24,8);}
   else if(kind==='globe'){c.arc(17,17,17,0,2*Math.PI);c.moveTo(17,0);c.bezierCurveTo(1,6,1,28,17,34);c.bezierCurveTo(33,28,33,6,17,0);c.moveTo(0,17);c.lineTo(34,17);c.moveTo(4,7);c.quadraticCurveTo(17,13,30,7);c.moveTo(4,27);c.quadraticCurveTo(17,21,30,27);}
   else if(kind==='pin'){c.arc(17,12,10,Math.PI,2*Math.PI);c.lineTo(17,34);c.closePath();c.moveTo(21,12);c.arc(17,12,4,0,2*Math.PI);}
   else if(kind==='layers'){for(let j=0;j<3;j++){const a=5+j*9;c.moveTo(0,a);c.lineTo(17,a-7);c.lineTo(34,a);c.lineTo(17,a+7);c.closePath();}}
   else if(kind==='depth'){c.moveTo(17,0);c.lineTo(17,25);c.moveTo(7,16);c.lineTo(17,26);c.lineTo(27,16);c.moveTo(3,32);c.quadraticCurveTo(17,40,31,32);}
   else if(kind==='pulse'){c.moveTo(0,18);c.lineTo(9,18);c.lineTo(13,5);c.lineTo(18,32);c.lineTo(23,11);c.lineTo(27,18);c.lineTo(35,18);}
   else if(kind==='drop'){c.moveTo(17,0);c.bezierCurveTo(-11,30,2,36,17,36);c.bezierCurveTo(32,36,45,30,17,0);}
   else if(kind==='thermometer'){c.roundRect(12,0,10,24,5);c.moveTo(12,22);c.bezierCurveTo(-1,39,35,43,22,22);c.moveTo(17,8);c.lineTo(17,27);}
   else for(let j=0;j<3;j++){c.moveTo(0,7+j*11);c.bezierCurveTo(8,-3+j*11,17,17+j*11,34,7+j*11);}
   c.stroke();c.restore();}
  function stroke(x1,y1,x2,y2){c.strokeStyle='rgba(178,225,231,.55)';c.lineWidth=1;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
  c.fillStyle='#02141e';c.fillRect(0,0,W,H);
  // A decorative horizon clips the real regional map; map coordinates are never warped.
  c.save();c.beginPath();c.ellipse(540,1410,1500,1320,0,0,Math.PI*2);c.clip();
  if(sat)c.drawImage(sat,0,0,W,1760);if(labels&&sat)c.drawImage(labels,0,0,W,1760);
  const shade=c.createLinearGradient(0,100,0,1810);shade.addColorStop(0,'rgba(0,20,30,.68)');shade.addColorStop(.28,'rgba(0,18,24,.05)');shade.addColorStop(.72,'rgba(0,20,26,.05)');shade.addColorStop(1,'rgba(0,19,28,.94)');c.fillStyle=shade;c.fillRect(0,0,W,H);c.restore();
  c.save();c.beginPath();c.rect(0,70,W,300);c.clip();
  const atmosphere=c.createRadialGradient(690,820,690,690,820,820);atmosphere.addColorStop(0,'rgba(0,20,36,0)');atmosphere.addColorStop(.8,'rgba(0,126,192,.16)');atmosphere.addColorStop(1,'rgba(0,160,230,0)');c.fillStyle=atmosphere;c.fillRect(0,70,W,300);
  if(earth){try{const texture=document.createElement('canvas');texture.width=720;texture.height=340;const tc=texture.getContext('2d');tc.drawImage(earth,0,0,720,340);const rgb=tc.getImageData(0,0,720,340).data,sphere=document.createElement('canvas');sphere.width=540;sphere.height=150;const sc=sphere.getContext('2d'),pixels=sc.createImageData(540,150),lat0=-15*Math.PI/180,lon0=-50*Math.PI/180;
   for(let y=0;y<150;y++)for(let x=0;x<540;x++){const nx=(x*2-690)/940,ny=(820-(70+y*2))/740,z2=1-nx*nx-ny*ny;if(z2<=0)continue;const z=Math.sqrt(z2),lat=Math.asin(ny*Math.cos(lat0)+z*Math.sin(lat0)),lon=lon0+Math.atan2(nx,z*Math.cos(lat0)-ny*Math.sin(lat0)),tx=Math.floor(((lon*180/Math.PI+180)%360+360)%360/360*720),ty=Math.max(0,Math.min(339,Math.floor((85-lat*180/Math.PI)/170*340))),src=(ty*720+tx)*4,k=(y*540+x)*4,light=.25+.75*Math.max(0,nx*.15+ny*.3+z*.8),fade=.55*Math.pow(1-y/150,2);pixels.data[k]=rgb[src]*light;pixels.data[k+1]=rgb[src+1]*light;pixels.data[k+2]=rgb[src+2]*light;pixels.data[k+3]=255*fade;}
   sc.putImageData(pixels,0,0);c.drawImage(sphere,0,70,W,300);texture.width=texture.height=sphere.width=sphere.height=1;
  }catch{}}
  c.beginPath();c.ellipse(690,820,940,740,0,Math.PI*1.15,Math.PI*1.9);c.strokeStyle='rgba(100,219,255,.42)';c.lineWidth=1;c.shadowColor='#00a7d6';c.shadowBlur=16;c.stroke();c.restore();
  // Radar mark, matching the site's brand. No textual placeholder logo.
  box(70,36,72,72,12,'#00121e',5);c.save();c.translate(106,72);c.strokeStyle=CYAN;c.lineWidth=2;for(const r of [12,22,30]){c.beginPath();c.arc(0,0,r,0,2*Math.PI);c.stroke();}c.fillStyle=CYAN;c.beginPath();c.moveTo(0,0);c.arc(0,0,29,-Math.PI/2,-.2);c.closePath();c.fill();c.restore();
  text('MONITOR GLOBAL',166,47,39,WHITE,820,true);
  // Top row: category on the left, main reading on the right.
  // Second row: locality and its flag(s), immediately after the locality text.
  const place=root.EventPortuguese?.place(e.place||'Local não informado')||e.place||'Local não informado';
  const flagImages=flags?['country','state'].map(key=>flags.images?.[key]).filter(Boolean):[];
  const flagWidth=90,flagHeight=60,flagGap=12;
  const flagsWidth=flagImages.length?flagImages.length*flagWidth+(flagImages.length-1)*flagGap:0;
  const placeWidth=884-(flagsWidth?flagsWidth+24:0);
  function wrapPlace(size){
   c.font=font(size,true);const rows=[];let row='';
   for(const word of String(place).split(/\s+/)){
    const candidate=(row+' '+word).trim();
    if(row&&c.measureText(candidate).width>placeWidth){rows.push(row);row=word;}
    else row=candidate;
   }
   if(row)rows.push(row);return rows;
  }
  let placeSize=38,placeRows=wrapPlace(placeSize);
  while(placeSize>28&&placeRows.length>3)placeRows=wrapPlace(--placeSize);
  const rowsVisible=placeRows.slice(0,3);
  const finalRowY=292+(rowsVisible.length-1)*(placeSize+7);
  c.font=font(placeSize,true);
  const lastRowWidth=c.measureText(rowsVisible[rowsVisible.length-1]||'').width;
  const flagX=Math.min(1032-flagsWidth,98+lastRowWidth+18);
  const flagY=finalRowY+Math.max(0,(placeSize-flagHeight)/2)+3;
  const headerBottom=Math.max(395,292+rowsVisible.length*(placeSize+7)+22,flagImages.length?flagY+flagHeight+20:0);
  // Keep the map visible: a fading shadow replaces the enclosing black rounded card.
  c.save();const titleVeil=c.createLinearGradient(0,130,0,headerBottom+70);
  titleVeil.addColorStop(0,'rgba(0,17,27,.60)');titleVeil.addColorStop(.58,'rgba(0,17,27,.30)');titleVeil.addColorStop(1,'rgba(0,17,27,0)');
  c.fillStyle=titleVeil;c.fillRect(0,130,W,headerBottom-60);c.restore();
  c.fillStyle=CYAN;c.fillRect(58,176,7,82);
  c.save();c.shadowColor='rgba(0,6,12,.92)';c.shadowBlur=14;
  let titleSize=26;
  while(titleSize>16){c.font=font(titleSize,true);if(c.measureText(p.title).width<=470)break;titleSize--;}
  text(p.title,98,173+(26-titleSize)/2,titleSize,WHITE,470,true);
  rowsVisible.forEach((line,i)=>text(line,98,292+i*(placeSize+7),placeSize,WHITE,placeWidth,true));
  c.restore();
  // Green (<M4), yellow (M4+), orange (M5+), red (M6+); frosted like the facts panel.
  const accent=metricAccent(e,p);
  metricGlass(701,172,320,94,accent);
  c.save();c.translate(861,219);
  let metricFont=72;c.font='italic 700 '+metricFont+'px StoryRajdhani, sans-serif';
  while(metricFont>30&&c.measureText(String(p.metric)).width>290)c.font='italic 700 '+(--metricFont)+'px StoryRajdhani, sans-serif';
  c.textAlign='center';c.textBaseline='middle';c.fillStyle=WHITE;
  c.shadowColor='rgba(0,0,0,.70)';c.shadowBlur=9;c.fillText(p.metric,0,0,290);c.restore();
  flagImages.forEach((img,i)=>{
   const x=flagX+i*(flagWidth+flagGap);
   box(x,flagY,flagWidth,flagHeight,8,'rgba(0,25,38,.83)',2,'rgba(122,219,232,.6)');
   c.save();c.beginPath();c.roundRect(x,flagY,flagWidth,flagHeight,8);c.clip();c.drawImage(img,x,flagY,flagWidth,flagHeight);c.restore();
  });
  const regionY=Math.max(415,headerBottom+18);
  box(45,regionY,350,300,22);text('CONTEXTO REGIONAL',66,regionY+17,22,WHITE,308,true);
  if(regional){c.save();c.beginPath();c.roundRect(58,regionY+52,324,230,12);c.clip();c.drawImage(regional,58,regionY+52,324,230);const x=58+(e.coords[0]-cf.minLon)/(cf.maxLon-cf.minLon)*324,y=regionY+52+(cf.maxLat-e.coords[1])/(cf.maxLat-cf.minLat)*230;c.beginPath();c.arc(x,y,10,0,2*Math.PI);c.fillStyle=WHITE;c.fill();c.beginPath();c.arc(x,y,7,0,2*Math.PI);c.fillStyle=RED;c.fill();c.restore();if(flags?.meta.countryCode==='BR')for(const state of states){const bounds=[Infinity,Infinity,-Infinity,-Infinity];const walk=a=>{if(Array.isArray(a[0]))return a.forEach(walk);if(!Number.isFinite(a[0])||!Number.isFinite(a[1]))return;bounds[0]=Math.min(bounds[0],a[0]);bounds[1]=Math.min(bounds[1],a[1]);bounds[2]=Math.max(bounds[2],a[0]);bounds[3]=Math.max(bounds[3],a[1]);};walk(state.geometry.coordinates);const lon=(bounds[0]+bounds[2])/2,lat=(bounds[1]+bounds[3])/2;if(lon>cf.minLon+.25&&lon<cf.maxLon-.25&&lat>cf.minLat+.25&&lat<cf.maxLat-.25){const x=58+(lon-cf.minLon)/(cf.maxLon-cf.minLon)*324,y=regionY+52+(cf.maxLat-lat)/(cf.maxLat-cf.minLat)*230;c.font=font(22,true);c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=4;c.textBaseline='top';c.strokeText(state.properties.uf,x,y);text(state.properties.uf,x,y,22,'#173647',45,true);}}}
  else lines(hasLocation?'Mapa regional indisponível':e.place||'Região informada pela fonte',66,regionY+75,308,26,4,MUTED);
  if(hasLocation){
   const x=(e.coords[0]-f.minLon)/(f.maxLon-f.minLon)*W,y=(f.maxLat-e.coords[1])/(f.maxLat-f.minLat)*1760;
   const pinColor=p.quake?RED:CYAN;
   c.save();c.strokeStyle=pinColor;for(const [r,a] of [[40,.65],[80,.38],[122,.2]]){c.globalAlpha=a;c.lineWidth=2;c.beginPath();c.arc(x,y,r,0,2*Math.PI);c.stroke();}c.globalAlpha=1;c.shadowColor=pinColor;c.shadowBlur=22;c.fillStyle=pinColor;c.beginPath();c.arc(x,y,13,0,2*Math.PI);c.fill();c.shadowBlur=0;c.strokeStyle=WHITE;c.lineWidth=4;c.stroke();c.restore();
   const bx=Math.min(W-370,Math.max(375,x+8)),by=Math.max(regionY+315,Math.min(1090,y-112));box(bx,by,330,54,17);c.beginPath();c.moveTo(bx+32,by+54);c.lineTo(x,y-15);c.lineTo(bx+56,by+54);c.fillStyle='#062936';c.fill();c.strokeStyle='#b8efff';c.lineWidth=1.5;c.stroke();text(p.marker,bx+18,by+16,22,WHITE,295,true);
  }else{box(250,770,650,116);lines('localização pontual não informada',280,800,590,28,2);}
  const summary=String(e.bulletinSummary||e.condition||e.descOnly||e.detail||'').trim();
  // A separate summary strip keeps the technical panel consistent for all event types.
  const panelTop=1364,panelHeight=1792-panelTop;
  box(29,panelTop,1022,panelHeight,43,'rgba(3,38,49,.86)',19);c.save();c.beginPath();c.roundRect(29,panelTop,1022,panelHeight,43);c.clip();const glass=c.createRadialGradient(49,1383,1,140,1440,800);glass.addColorStop(0,'rgba(220,255,255,.28)');glass.addColorStop(.25,'rgba(105,230,250,.08)');glass.addColorStop(1,'rgba(0,28,38,0)');c.fillStyle=glass;c.fillRect(29,panelTop,1022,panelHeight);c.restore();
  if(summary){
   // Keep short conditions compact; long bulletins get at most three readable rows.
   c.font=font(27);
   let wrapped=1,current='';
   for(const word of summary.split(/\s+/)){
    const candidate=(current+' '+word).trim();
    if(current&&c.measureText(candidate).width>925){wrapped++;current=word;}else current=candidate;
   }
   const visibleRows=Math.min(3,wrapped),summaryH=visibleRows===1?100:visibleRows===2?126:160;
   const summaryX=46,summaryY=panelTop-summaryH-27,summaryW=988;
   // Actual blurred geographic backdrop, topped by the same translucent glass as the facts panel.
   // Capture a bounded region once: there is no blur on the live map, only this exported image.
   const blurPad=24,snapshot=document.createElement('canvas');
   snapshot.width=summaryW+blurPad*2;snapshot.height=summaryH+blurPad*2;
   snapshot.getContext('2d').drawImage(canvas,summaryX-blurPad,summaryY-blurPad,snapshot.width,snapshot.height,0,0,snapshot.width,snapshot.height);
   c.save();c.beginPath();c.roundRect(summaryX,summaryY,summaryW,summaryH,24);c.clip();
   c.filter='blur(13px)';c.drawImage(snapshot,summaryX-blurPad,summaryY-blurPad);c.filter='none';
   c.fillStyle='rgba(3,38,49,.66)';c.fillRect(summaryX,summaryY,summaryW,summaryH);
   const sheen=c.createLinearGradient(summaryX,summaryY,summaryX,summaryY+summaryH);
   sheen.addColorStop(0,'rgba(220,255,255,.21)');sheen.addColorStop(.25,'rgba(125,232,251,.09)');sheen.addColorStop(1,'rgba(0,28,40,.06)');
   c.fillStyle=sheen;c.fillRect(summaryX,summaryY,summaryW,summaryH);c.restore();
   c.save();c.beginPath();c.roundRect(summaryX,summaryY,summaryW,summaryH,24);
   c.strokeStyle='rgba(133,228,242,.85)';c.lineWidth=1.6;c.shadowColor='rgba(58,204,236,.35)';c.shadowBlur=11;c.stroke();c.restore();
   text(p.weather?'CONDIÇÕES DO TEMPO':p.bulletin?'BOLETIM METEOROLÓGICO':'SOBRE O EVENTO',70,summaryY+13,21,CYAN,930,true);
   lines(summary,70,summaryY+46,932,27,visibleRows,WHITE,false);
   snapshot.width=snapshot.height=1;
  }
  const when=Number.isFinite(Number(e.time))&&Number(e.time)>0?new Date(Number(e.time)).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',',' ·')+' BRT':'Horário não informado';
  icon('calendar',80,1425);text(when,128,1430,28,WHITE,450,true);stroke(565,1425,565,1470);icon('layers',592,1425);lines(e.sourceSummary||e.source||'Fonte não informada',642,1412,365,25,2,WHITE,true);stroke(69,1492,1008,1492);
  p.stats.forEach(([label,value],i)=>{const x=85+i*318;if(i)stroke(x-22,1520,x-22,1616);icon(p.weather?['thermometer','drop','waves'][i]:['depth','pulse',p.stats[2][0]==='COORDENADAS'?'pin':'waves'][i],x-5,1528);if(label==='COORDENADAS'){value.split(' · ').forEach((part,row)=>text(part,x+43,1520+row*37,29,WHITE,241));}else lines(value,x+43,1520,241,29,2);text(label,x+43,1600,18,MUTED,240,true);});
  text(p.note,70,1636,18,MUTED,940);
  box(29,1674,1022,118,40,'rgba(3,34,46,.93)',15);icon('globe',85,1712);text('monitorglobal.top',166,1711,29,WHITE,380,true);stroke(485,1699,485,1762);
  c.save();c.fillStyle='#08a8d7';c.beginPath();c.arc(558,1732,27,0,Math.PI*2);c.fill();c.fillStyle=WHITE;c.beginPath();c.moveTo(541,1730);c.lineTo(575,1716);c.lineTo(565,1749);c.lineTo(556,1738);c.lineTo(550,1744);c.lineTo(551,1734);c.closePath();c.fill();c.restore();text('Telegram · @monitor_global',606,1715,24,WHITE,410,true);
  // Decorative signature waves below the data, never presented as geophysical observations.
  c.save();c.strokeStyle='#15b8df';c.lineWidth=.8;for(let j=0;j<17;j++){c.globalAlpha=.08+j*.008;c.beginPath();for(let x=0;x<=W;x+=9){const y=1860+Math.sin(x/91+j*.25)*25+Math.sin(x/230-j*.23)*14+j*2;if(x===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}c.restore();
  text(sat?'Imagem de base: Esri, Maxar, Earthstar Geographics':'Fundo ilustrativo · imagem de base indisponível',60,1802,14,MUTED,960);
  return canvas;
 }
 root.SiteEventStory={render,profile,version:'site-concept6-all-v8'};
})(window);

