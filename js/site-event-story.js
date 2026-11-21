/* Static site sharing: one cartographic composition, factual fields per event. */
(function(root){
 'use strict';
 const W=1080,H=1920,GOLD='#c69e65',WHITE='#f5e8cf',MUTED='#dbc6a5',RED='#ff364f';
 const number=(n,suffix='',digits=1)=>typeof n==='number'&&Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:digits})+suffix:'Não informado';
 const located=e=>Array.isArray(e.coords)&&e.coords.length>=2&&e.coords.slice(0,2).every(Number.isFinite)&&Math.abs(e.coords[0])<=180&&Math.abs(e.coords[1])<=85;
 function profile(e){
  const quake=e.type==='earthquake'||(!e.type&&e.mag!=null),weather=['capital-weather','temperature','weather','heat','cold'].includes(e.type);
  const bulletin=e.hazardNature==='bulletin'&&e.source==='CGE';
  const labels={fire:'INCÊNDIO',storm:'TEMPESTADE',hurricane:'CICLONE',tornado:'TORNADO',tsunami:'TSUNAMI',civil:'INFORMATIVO',wind:'VENTO',flood:'ENCHENTE',volcano:'VULCÃO'};
  // A CGE weather bulletin is not necessarily a storm warning.
  const title=quake?'SISMO':weather?'TEMPERATURA':bulletin?'BOLETIM CGE':e.type==='storm'?'TEMPESTADE':(root.RecordPresentation?.label(e)||e.displayLabel||e.cycloneLabel||labels[e.type]||e.type||'EVENTO').toUpperCase();
  const metric=quake?(Number.isFinite(e.mag)?'M'+number(e.mag):'M—'):weather?number(e.temperature,' °C'):bulletin?'INFORMATIVO':e.type==='storm'?'TEMPESTADE':e.severityLabel||e.alertLevel||(e.type==='hurricane'?e.classification:null)||labels[e.type]||'EVENTO';
  let stats;
  if(quake){const knownDepth=typeof e.depth==='number'&&Number.isFinite(e.depth);let mmi='Indisponível',official=e.shaking?.status==='available',k=null;try{if(official&&located(e)&&root.RuptureShakingModel?.valid(e.shaking.grid)){const value=RuptureShakingModel.sample(e.shaking.grid,e.coords[0],e.coords[1]);if(Number.isFinite(value))k=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][Math.max(0,Math.min(11,Math.round(value)-1))];}else if(!official&&knownDepth&&typeof e.mag==='number'&&Number.isFinite(e.mag)&&root.QuakeImagePaint)k=QuakeImagePaint.estimatedMmi({mag:e.mag,depth:e.depth});if(k)mmi=k+' · '+({I:'Não perceptível',II:'Muito fraca',III:'Fraca',IV:'Leve',V:'Moderada',VI:'Forte',VII:'Muito forte',VIII:'Severa',IX:'Violenta',X:'Extrema',XI:'Extrema',XII:'Extrema'}[k]||'Estimativa');}catch{}const status=e.imageTsunami?.state;const relevant=e.imageTsunami&&!e.imageTsunami.stale&&(['warning','watch','advisory'].includes(status)||(e.imageTsunami.regionalGroups||[]).some(g=>!g.stale&&['warning','watch','advisory'].includes(g.state)));const third=relevant?['TSUNAMI',status==='warning'?'Aviso por região':'Atenção por região']:located(e)?['COORDENADAS',Math.abs(e.coords[1]).toFixed(2).replace('.',',')+'° '+(e.coords[1]<0?'S':'N')+' · '+Math.abs(e.coords[0]).toFixed(2).replace('.',',')+'° '+(e.coords[0]<0?'O':'L')]:['REVISÃO',typeof e.reviewed==='boolean'?(e.reviewed?'Revisado':'Automático'):'Não informada'];stats=[['PROFUNDIDADE',number(e.depth,' km')],[official?'INTENSIDADE · MMI':'INTENSIDADE EST.',mmi],third];}
  else if(weather)stats=[['SENSAÇÃO',number(e.feels,' °C')],['UMIDADE',number(e.humidity,'%')],['VENTO',number(e.wind,' km/h')]];
  else if(bulletin)stats=[['SITUAÇÃO','Informativo'],['REGIÃO','São Paulo · SP'],['TIPO','Boletim meteorológico']];
  else if(e.type==='hurricane')stats=[['CLASSIFICAÇÃO',e.cycloneLabel||e.classification||'Não informada'],['VENTO MÁXIMO',number(e.windKmh,' km/h')],['PRESSÃO',number(e.pressureMb,' hPa')]];
  else stats=[['SITUAÇÃO',e.severityLabel||e.statusLabel||'Conforme a fonte'],['REGIÃO',e.region||e.uf||e.country||'Ver localização'],['TIPO',e.hazardNature==='forecast'?'Previsão':e.hazardNature==='observed'?'Observado':e.hazardNature==='warning'?'Aviso oficial':'Registro da fonte']];
  return {quake,weather,bulletin,title,metric,stats,marker:quake?null:weather?'LOCAL DA PREVISÃO':bulletin?'REFERÊNCIA MUNICIPAL':'REFERÊNCIA DO EVENTO',note:quake?(stats[1][0]==='INTENSIDADE EST.'?'Intensidade estimada. ':'')+'Anéis de localização; não indicam raio de dano.':weather?'Condições conforme a fonte indicada; sujeitas a atualização.':bulletin?'Boletim municipal informativo; não confirma tempestade nem área de risco.':'A referência no mapa não delimita a área de risco. Consulte a fonte oficial.'};
 }
 function frame(e,p){let span=1;if(p.quake&&root.QuakeSiteCard)try{const f=QuakeSiteCard.frame({mag:e.mag,depth:e.depth,lon:e.coords[0],lat:e.coords[1]});span=Math.max(1.4,(f.maxLon-f.minLon)/2);}catch{}else if(!p.weather)span=3;
  const [lon,lat]=e.coords;return {minLon:lon-span,maxLon:lon+span,minLat:Math.max(-85,lat-2*span*548/W),maxLat:Math.min(85,lat+2*span*425/W)};
 }
 function load(url,timeout=6500){return new Promise(resolve=>{const img=new Image();img.crossOrigin='anonymous';const timer=setTimeout(()=>{img.onload=img.onerror=null;img.src='';resolve(null);},timeout);img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);resolve(null);};img.src=url;});}
 function mapUrl(service,f,width,jpeg=false){
  // ArcGIS expands an extent to match the image aspect ratio. Match it here
  // so the overlay and the geographic marker use the same extent as imagery.
  const height=Math.max(1,Math.round(width*(f.maxLat-f.minLat)/(f.maxLon-f.minLon)));
  return 'https://server.arcgisonline.com/ArcGIS/rest/services/'+service+'/MapServer/export?'+new URLSearchParams({bbox:[f.minLon,f.minLat,f.maxLon,f.maxLat].join(','),bboxSR:'4326',imageSR:'4326',size:width+','+height,format:jpeg?'jpg':'png32',transparent:jpeg?'false':'true',f:'image'});}
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
 async function satellite(f){const key=JSON.stringify(f);if(maps.has(key))return maps.get(key);const image=await load(mapUrl('World_Imagery',f,1080,true),6500)||await tileMap(f);if(image){maps.set(key,image);while(maps.size>2)maps.delete(maps.keys().next().value);}return image;}

 let brazilBorders;
 function loadBrazilBorders(){
  if(!brazilBorders)brazilBorders=fetch('assets/geography/br-states.json')
   .then(response=>{if(!response.ok)throw Error('Divisas indisponíveis');return response.json();})
   .then(data=>(data.features??[]).map(feature=>({...feature,bounds:borderBounds(feature.geometry)})))
   .catch(()=>{brazilBorders=null;return [];});
  return brazilBorders;
 }
 const ibgeCodes={RO:11,AC:12,AM:13,RR:14,PA:15,AP:16,TO:17,MA:21,PI:22,CE:23,RN:24,PB:25,PE:26,AL:27,SE:28,BA:29,MG:31,ES:32,RJ:33,SP:35,PR:41,SC:42,RS:43,MS:50,MT:51,GO:52,DF:53};
 const municipalityCache=new Map();
 function polygonsOf(geometry){
  if(geometry?.type==='MultiPolygon')return geometry.coordinates;
  return geometry?.type==='Polygon'?[geometry.coordinates]:[];
 }
 function borderBounds(geometry){
  const bounds=[Infinity,Infinity,-Infinity,-Infinity];
  for(const polygon of polygonsOf(geometry))for(const [lon,lat] of polygon[0]){
   bounds[0]=Math.min(bounds[0],lon);bounds[1]=Math.min(bounds[1],lat);
   bounds[2]=Math.max(bounds[2],lon);bounds[3]=Math.max(bounds[3],lat);
  }
  return bounds;
 }
 function intersects([west,south,east,north],frame){
  return west<=frame.maxLon&&east>=frame.minLon&&south<=frame.maxLat&&north>=frame.minLat;
 }
 function loadMunicipalities(code){
  if(municipalityCache.has(code))return municipalityCache.get(code);
  const params=new URLSearchParams({formato:'application/vnd.geo+json',qualidade:'minima',intrarregiao:'municipio'});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),4200);
  const task=fetch('https://servicodados.ibge.gov.br/api/v3/malhas/estados/'+code+'?'+params,{signal:controller.signal})
   .then(response=>{if(!response.ok)throw Error('Malha municipal indisponível');return response.json();})
   .then(data=>(data.features??[]).map(feature=>({...feature,bounds:borderBounds(feature.geometry)})))
   .catch(()=>{municipalityCache.delete(code);return [];})
   .finally(()=>clearTimeout(timer));
  municipalityCache.set(code,task);
  if(municipalityCache.size>10)municipalityCache.delete(municipalityCache.keys().next().value);
  return task;
 }
 async function mapBorders(frame,point){
  const states=(await loadBrazilBorders()).filter(feature=>intersects(feature.bounds,frame));
  const [lon,lat]=point;
  const distance=([west,south,east,north])=>Math.hypot(Math.max(west-lon,0,lon-east),Math.max(south-lat,0,lat-north));
  const nearby=states.filter(feature=>ibgeCodes[feature.properties.uf])
   .sort((a,b)=>distance(a.bounds)-distance(b.bounds)).slice(0,6);
  const municipalities=(await Promise.all(nearby.map(feature=>loadMunicipalities(ibgeCodes[feature.properties.uf]))))
   .flat().filter(feature=>intersects(feature.bounds,frame));
  return {states,municipalities};
 }
 function paintBorders(ctx,features,frame,x,y,w,h,municipal=false){
  const longitudeWidth=frame.maxLon-frame.minLon,latitudeHeight=frame.maxLat-frame.minLat;
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.beginPath();
  for(const {geometry} of features){
   for(const polygon of polygonsOf(geometry))for(const ring of polygon){
    for(let i=0;i<ring.length;i++){
     const [lon,lat]=ring[i];
     const px=x+(lon-frame.minLon)/longitudeWidth*w,py=y+(frame.maxLat-lat)/latitudeHeight*h;
     if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.closePath();
   }
  }
  ctx.strokeStyle='rgba(44,31,16,.68)';ctx.lineWidth=municipal?2.5:4;ctx.stroke();
  ctx.strokeStyle=municipal?'rgba(234,218,173,.76)':'rgba(245,226,180,.9)';ctx.lineWidth=municipal?1.35:2.05;ctx.stroke();ctx.restore();
 }
 function shadeMap(ctx,x,y,w,h,epicenterY){
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  ctx.translate(x+w*.52,epicenterY+h*.03);ctx.scale(w*.60,h*.72);
  const focus=ctx.createRadialGradient(0,0,0,0,0,1);
  focus.addColorStop(0,'rgba(40,30,9,.04)');focus.addColorStop(.47,'rgba(33,28,14,.12)');
  focus.addColorStop(.73,'rgba(6,23,29,.48)');focus.addColorStop(1,'rgba(2,19,29,.87)');
  ctx.fillStyle=focus;ctx.fillRect(-2,-2,4,4);ctx.restore();

  const corners=ctx.createLinearGradient(x+w*.2,y,x+w*.65,y+h);
  corners.addColorStop(0,'rgba(4,25,29,.29)');corners.addColorStop(.38,'rgba(4,25,29,0)');
  corners.addColorStop(.68,'rgba(3,23,32,.08)');corners.addColorStop(1,'rgba(2,18,29,.57)');
  ctx.fillStyle=corners;ctx.fillRect(x,y,w,h);
 }
 const mapArea={x:8,y:394,width:W-16,height:976};
 let fonts;
 async function render(e,{allowMissingMap=false,skipNetworkMaps=false,videoMap=null}={}){
  const p=profile(e),hasLocation=located(e),canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const c=canvas.getContext('2d');
  if(!fonts)fonts=(async()=>{if(!root.FontFace)return;try{const loaded=await Promise.all([new FontFace('StoryInter','url(assets/summary-fonts/Inter.ttf)',{weight:'100 900'}).load(),new FontFace('StorySerif','url(assets/summary-fonts/CormorantGaramond.ttf)',{weight:'300 700'}).load()]);loaded.forEach(f=>document.fonts.add(f));}catch{}})();
  const fetchMaps=hasLocation&&!skipNetworkMaps;
  const f=videoMap?.frame||(hasLocation?frame(e,p):null),cf=fetchMaps?{minLon:e.coords[0]-3.3,maxLon:e.coords[0]+3.3,minLat:Math.max(-85,e.coords[1]-2.34),maxLat:Math.min(85,e.coords[1]+2.34)}:null;
  const engravingPromise=load('img/argos-share-engraving.webp',2500);
  const brandAssetPromise=load('img/argos-orbis-vigilante-static.svg?v=2',2500);
  const flagsTask=root.QuakeSiteFlags?QuakeSiteFlags.resolve(e).then(async meta=>({meta,images:await QuakeSiteFlags.images(meta)})).catch(()=>null):null;
  const brazil=hasLocation&&e.coords[0]>=-74&&e.coords[0]<=-34&&e.coords[1]>=-34&&e.coords[1]<=6;
  const [sat,labels,regional,flags,borders,engraving]=await Promise.all([videoMap?.base||(fetchMaps?satellite(f):null),videoMap?videoMap.labels:fetchMaps?load(mapUrl('Reference/World_Boundaries_and_Places',f,1080),4500):null,fetchMaps?load(mapUrl('World_Topo_Map',cf,420),4500):null,flagsTask,fetchMaps&&brazil?Promise.race([mapBorders(f,e.coords),new Promise(resolve=>setTimeout(()=>resolve(null),5600))]):null,engravingPromise,Promise.race([fonts,new Promise(resolve=>setTimeout(resolve,3000))])]);
  if(hasLocation&&!sat&&!allowMissingMap){const error=Error('O mapa de satélite não carregou. Tente gerar a imagem novamente.');error.code='STORY_MAP_UNAVAILABLE';throw error;}
  const font=(size,bold=false)=>`${bold?'700':'500'} ${size}px StoryInter, sans-serif`;
  function text(value,x,y,size=25,color=WHITE,maxWidth=1000,bold=false,typeface=font){c.font=typeface(size,bold);let t=String(value??'Não informado');while(t.length>2&&c.measureText(t).width>maxWidth)t=t.slice(0,-2)+'…';c.fillStyle=color;c.textAlign='left';c.textBaseline='top';c.fillText(t,x,y);}
  function lines(value,x,y,width,size=24,maxLines=2,color=WHITE,bold=false,typeface=font){c.font=typeface(size,bold);const words=String(value||'').split(/\s+/),out=[];let line='';for(const word of words){if(c.measureText((line+' '+word).trim()).width>width&&line){out.push(line);line=word;}else line=(line+' '+word).trim();}if(line)out.push(line);out.slice(0,maxLines).forEach((s,i)=>text(i===maxLines-1&&out.length>maxLines?out.slice(i).join(' '):s,x,y+i*(size+8),size,color,width,bold,typeface));}
  function rounded(x,y,w,h,r){
   if(typeof c.roundRect==='function'){c.roundRect(x,y,w,h,r);return;}
   const radius=Math.min(r,w/2,h/2);
   c.moveTo(x+radius,y);
   c.arcTo(x+w,y,x+w,y+h,radius);c.arcTo(x+w,y+h,x,y+h,radius);
   c.arcTo(x,y+h,x,y,radius);c.arcTo(x,y,x+w,y,radius);
   c.closePath();
  }
  function box(x,y,w,h,r=12,fill='#0b2329',edge=GOLD){
   c.beginPath();rounded(x,y,w,h,r);c.fillStyle=fill;c.fill();
   c.strokeStyle=edge;c.lineWidth=2;c.stroke();
  }
  function serif(value,x,y,size,width,color=WHITE,align='left'){
   c.save();c.font='700 '+size+'px StorySerif, Georgia, serif';c.textAlign=align;c.textBaseline='middle';
   c.fillStyle=color;c.fillText(value,x,y,width);c.restore();
  }
  function metal(y,h){
   const g=c.createLinearGradient(0,y,0,y+h);
   for(const [stop,color] of [[0,'#73502d'],[.19,'#dfbd88'],[.4,'#a27a4b'],[.62,'#634226'],[.82,'#c39863'],[1,'#39271b']])g.addColorStop(stop,color);
   return g;
  }
  function band(x,y,w){
   c.fillStyle=metal(y,15);c.fillRect(x,y,w,15);
   c.save();c.beginPath();c.rect(x,y+3,w,9);c.clip();
   c.strokeStyle='#382519';c.lineWidth=1.4;c.beginPath();
   for(let i=x;i<x+w;i+=13){
    c.moveTo(i,y+11);c.lineTo(i,y+4);c.lineTo(i+10,y+4);c.lineTo(i+10,y+10);
    c.lineTo(i+4,y+10);c.lineTo(i+4,y+7);c.lineTo(i+7,y+7);
   }
   c.stroke();c.restore();
  }
  function circle(x,y,r,edge,fill){
   c.beginPath();c.arc(x,y,r,0,2*Math.PI);
   if(fill){c.fillStyle=fill;c.fill();}
   if(edge){c.strokeStyle=edge;c.lineWidth=2;c.stroke();}
  }
  function flourish(x,y,sx,sy){
   c.save();c.translate(x,y);c.scale(sx,sy);
   c.beginPath();c.moveTo(0,65);c.bezierCurveTo(29,58,10,23,39,20);
   c.bezierCurveTo(68,17,78,12,85,0);c.bezierCurveTo(63,15,49,-6,29,4);
   c.bezierCurveTo(5,12,13,39,0,65);c.closePath();
   c.fillStyle=metal(0,65);c.fill();c.strokeStyle=GOLD;c.lineWidth=2;c.stroke();
   c.beginPath();c.moveTo(10,44);c.bezierCurveTo(17,6,47,27,66,10);c.strokeStyle='#5b3b25';c.stroke();c.restore();
  }
  function compass(x,y){
   circle(x,y,98,'#553a20','rgba(8,27,32,.87)');
   for(const r of [50,84,93])circle(x,y,r,'#dfb879');
   for(let i=0;i<8;i++){
    const a=i*Math.PI/4,dx=Math.sin(a),dy=-Math.cos(a),length=i===0?107:i%2===0?80:49;
    for(const side of [-1,1]){
     c.beginPath();c.moveTo(x+dx*length,y+dy*length);c.lineTo(x+side*dy*12,y-side*dx*12);c.lineTo(x,y);c.closePath();
     c.fillStyle=side===1?'#efcc8d':'#8a6339';c.fill();c.strokeStyle='#d7ab69';c.lineWidth=1;c.stroke();
    }
   }
   circle(x,y,9,GOLD,'#62422b');serif('N',x,y-112,24,28,GOLD,'center');
  }
  function icon(kind,x,y){c.save();c.translate(x,y);c.strokeStyle=WHITE;c.lineWidth=2.5;c.lineCap='round';c.lineJoin='round';c.beginPath();
   if(kind==='calendar'){rounded(0,4,32,29,4);c.moveTo(0,13);c.lineTo(32,13);c.moveTo(8,0);c.lineTo(8,8);c.moveTo(24,0);c.lineTo(24,8);}
   else if(kind==='globe'){c.arc(17,17,17,0,2*Math.PI);c.moveTo(17,0);c.bezierCurveTo(1,6,1,28,17,34);c.bezierCurveTo(33,28,33,6,17,0);c.moveTo(0,17);c.lineTo(34,17);c.moveTo(4,7);c.quadraticCurveTo(17,13,30,7);c.moveTo(4,27);c.quadraticCurveTo(17,21,30,27);}
   else if(kind==='pin'){c.arc(17,12,10,Math.PI,2*Math.PI);c.lineTo(17,34);c.closePath();c.moveTo(21,12);c.arc(17,12,4,0,2*Math.PI);}
   else if(kind==='layers'){for(let j=0;j<3;j++){const a=5+j*9;c.moveTo(0,a);c.lineTo(17,a-7);c.lineTo(34,a);c.lineTo(17,a+7);c.closePath();}}
   else if(kind==='depth'){c.moveTo(17,0);c.lineTo(17,25);c.moveTo(7,16);c.lineTo(17,26);c.lineTo(27,16);c.moveTo(3,32);c.quadraticCurveTo(17,40,31,32);}
   else if(kind==='pulse'){c.moveTo(0,18);c.lineTo(9,18);c.lineTo(13,5);c.lineTo(18,32);c.lineTo(23,11);c.lineTo(27,18);c.lineTo(35,18);}
   else if(kind==='drop'){c.moveTo(17,0);c.bezierCurveTo(-11,30,2,36,17,36);c.bezierCurveTo(32,36,45,30,17,0);}
   else if(kind==='thermometer'){rounded(12,0,10,24,5);c.moveTo(12,22);c.bezierCurveTo(-1,39,35,43,22,22);c.moveTo(17,8);c.lineTo(17,27);}
   else for(let j=0;j<3;j++){c.moveTo(0,7+j*11);c.bezierCurveTo(8,-3+j*11,17,17+j*11,34,7+j*11);}
   c.stroke();c.restore();}
  function stroke(x1,y1,x2,y2){c.strokeStyle='rgba(195,157,96,.68)';c.lineWidth=1;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
  const {x:mapX,y:top,width:mapWidth,height:mapHeight}=mapArea,bottom=top+mapHeight;
  const base=c.createLinearGradient(0,0,W,H);
  base.addColorStop(0,'#142d2a');base.addColorStop(.55,'#091c22');base.addColorStop(1,'#051820');
  c.fillStyle=base;c.fillRect(0,0,W,H);
  if(sat){
   c.drawImage(sat,mapX,top,mapWidth,mapHeight);
   if(labels)c.drawImage(labels,mapX,top,mapWidth,mapHeight);
   if(borders?.municipalities.length)paintBorders(c,borders.municipalities,f,mapX,top,mapWidth,mapHeight,true);
   if(borders?.states.length)paintBorders(c,borders.states,f,mapX,top,mapWidth,mapHeight);
   shadeMap(c,mapX,top,mapWidth,mapHeight,top+(f.maxLat-e.coords[1])/(f.maxLat-f.minLat)*mapHeight);
  }
  let mapLayer;
  if(videoMap){
   mapLayer=document.createElement('canvas');
   mapLayer.width=mapWidth;mapLayer.height=mapHeight;
   mapLayer.getContext('2d').drawImage(canvas,mapX,top,mapWidth,mapHeight,0,0,mapWidth,mapHeight);
   c.clearRect(mapX,top,mapWidth,mapHeight);
  }
  // The artwork contains only static decoration. Draw the cartography
  // beneath its transparent windows and keep all event data above it.
  const mini=engraving?{x:58,y:482,w:324,h:215}:{x:49,y:480,w:334,h:222};
  if(engraving){
   c.fillStyle='#ead7ae';c.fillRect(mini.x,mini.y,mini.w,mini.h);
   if(regional){
    c.drawImage(regional,mini.x,mini.y,mini.w,mini.h);
    c.fillStyle='rgba(199,153,83,.23)';c.fillRect(mini.x,mini.y,mini.w,mini.h);
   }
   // Leave the engraved border in place and draw the compass inset over the map.
   c.save();c.beginPath();c.rect(0,0,W,H);c.rect(11,1130,204,229);
   c.clip('evenodd');c.drawImage(engraving,0,0,W,H);c.restore();
  }else{
   band(8,7,W-16);band(8,130,W-16);band(8,top-15,W-16);band(8,bottom-7,W-16);
   for(const [x,mirror] of [[22,1],[W-22,-1]]){
    flourish(x,23,mirror,1);flourish(x,128,mirror,-1);
   }
   for(const x of [106,974]){
    circle(x,77,73,GOLD,metal(7,140));circle(x,77,64,'#33241b','#10282d');
    circle(x,77,59,GOLD);circle(x,77,54,'#806243');
   }
   circle(106,77,40,GOLD,'#172f33');
   c.save();c.beginPath();c.arc(106,77,39,0,2*Math.PI);c.clip();
   c.fillStyle='#b89661';
   const continents=[
    [[78,49],[93,43],[104,46],[104,57],[97,61],[91,69],[99,77],[91,80],[84,72],[78,66],[70,63]],
    [[100,77],[109,79],[122,88],[116,97],[110,98],[106,110],[101,114],[101,99],[96,90]],
    [[119,55],[126,48],[139,48],[145,55],[144,68],[136,68],[132,63],[126,70],[118,66]],
    [[122,73],[135,72],[143,82],[137,92],[130,100],[124,93],[125,84],[118,80]]
   ];
   for(const points of continents){
    c.beginPath();
    points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
    c.closePath();c.fill();
   }
   c.restore();
   c.strokeStyle=GOLD;c.lineWidth=2;c.beginPath();c.ellipse(106,77,20,40,0,0,Math.PI*2);
   c.moveTo(66,77);c.lineTo(146,77);c.stroke();
   c.beginPath();c.ellipse(106,77,48,14,-.56,0,Math.PI*2);c.stroke();
   const brandAsset=await brandAssetPromise;
   if(brandAsset)c.drawImage(brandAsset,913,39,122,76);
   else root.ArgosBrand?.canvas(c,974,77,42);
   c.save();c.shadowColor='#000';c.shadowOffsetY=4;c.shadowBlur=6;
   serif('ARGOS ORBIS',540,82,86,690,'#e6c897','center');c.restore();
   flourish(540,146,-1,-.55);flourish(540,146,1,-.55);
  }

  c.fillStyle=metal(176,170);c.fillRect(53,176,7,169);
  serif(p.title,95,236,75,580,'#e6c897');
  const badge=c.createLinearGradient(701,170,1025,266);
  badge.addColorStop(0,'#936b35');badge.addColorStop(.5,'#e6c783');badge.addColorStop(1,'#9e7540');
  box(701,172,324,96,16,badge,'#725031');
  c.strokeStyle='#edd09a';c.lineWidth=2;c.beginPath();rounded(706,177,314,86,13);c.stroke();
  c.save();c.font='700 '+(p.quake||p.weather?70:42)+'px Georgia, serif';
  c.textAlign='center';c.textBaseline='middle';c.fillStyle='#21170f';
  c.fillText(p.metric,863,222,289);c.restore();

  const rawPlace=e.place||'Local não informado';
  const peru=String(flags?.meta.countryCode||e.countryCode||'').toUpperCase()==='PE'||e.source==='IGP';
  const place=(peru&&e.place?root.EventPortuguese?.peruPlace(rawPlace):root.EventPortuguese?.place(rawPlace))||rawPlace;
  const images=['country','state'].map(key=>flags?.images?.[key]).filter(Boolean);
  const flagWidth=90,flagHeight=60,flagGap=12;
  const flagsWidth=images.length*flagWidth+Math.max(0,images.length-1)*flagGap;
  const flagX=863-flagsWidth/2;
  const placeWidth=images.length?flagX-119:930;
  const comma=place.lastIndexOf(', ');
  const locality=comma<0?place:place.slice(0,comma+1);
  const country=comma<0?'':place.slice(comma+2);
  const locationFont=(size,bold=false)=>`${bold?'700':'600'} ${size}px StorySerif, Georgia, serif`;
  const countrySize=size=>Math.round(size*.83);
  function placeWidths(size){
   c.font=locationFont(size,true);
   const localityWidth=c.measureText(locality+(country?' ':'')).width;
   c.font=locationFont(countrySize(size));
   return [localityWidth,localityWidth+c.measureText(country).width];
  }
  const placeY=282;
  let placeSize=54;
  let [localityWidth,placeLength]=placeWidths(placeSize);
  while(placeSize>32&&placeLength>placeWidth)[localityWidth,placeLength]=placeWidths(--placeSize);
  const gold=c.createLinearGradient(0,placeY,0,placeY+placeSize);
  gold.addColorStop(0,'#f7e3b6');
  gold.addColorStop(.37,'#e3bf7d');
  gold.addColorStop(.46,'#f8df9c');
  gold.addColorStop(1,'#b68750');
  c.save();c.shadowColor='rgba(8,12,11,.9)';c.shadowBlur=3;c.shadowOffsetY=2;
  if(placeLength<=placeWidth){
   text(locality,95,placeY,placeSize,gold,placeWidth,true,locationFont);
   if(country)text(country,95+localityWidth,placeY+placeSize-countrySize(placeSize),countrySize(placeSize),'#ddbf8d',placeWidth-localityWidth,false,locationFont);
  }else lines(place,95,placeY,placeWidth,placeSize,2,'#e3bf7d',true,locationFont);
  c.restore();
  images.forEach((img,i)=>{
   const x=flagX+i*(flagWidth+flagGap);
   box(x,294,flagWidth,flagHeight,7,'#f5e8cf','#674b2f');
   c.save();c.beginPath();rounded(x,294,flagWidth,flagHeight,7);c.clip();
   c.drawImage(img,x,294,flagWidth,flagHeight);c.restore();
  });

  const regionY=418;
  if(!engraving){
   const parchment=c.createLinearGradient(35,420,302,718);
   parchment.addColorStop(0,'#c39b69');parchment.addColorStop(.35,'#f6e3bd');parchment.addColorStop(1,'#cda676');
   c.save();c.shadowColor='#000';c.shadowBlur=15;c.shadowOffsetY=5;
   box(31,regionY,370,310,5,parchment,'#805936');c.restore();
   text('CONTEXTO REGIONAL',61,regionY+13,25,'#2c2115',308,true);
   band(43,mini.y-14,346);band(43,mini.y+mini.h,346);
   if(regional){
    c.drawImage(regional,mini.x,mini.y,mini.w,mini.h);
    c.fillStyle='rgba(199,153,83,.27)';c.fillRect(mini.x,mini.y,mini.w,mini.h);
   }
  }
  if(regional){
   const x=mini.x+(e.coords[0]-cf.minLon)/(cf.maxLon-cf.minLon)*mini.w;
   const y=mini.y+(cf.maxLat-e.coords[1])/(cf.maxLat-cf.minLat)*mini.h;
   circle(x,y,9,'#fff2d5',RED);
   if(flags?.meta.stateCode)text(flags.meta.stateCode,x+12,y-25,22,'#302419',50,true);
  }else lines(hasLocation?'Mapa regional indisponível':'Região informada pela fonte',58,regionY+92,315,26,3,'#42311c');

  if(hasLocation){
   const x=W/2,y=top+(f.maxLat-e.coords[1])/(f.maxLat-f.minLat)*mapHeight;
   if(p.quake)[29,51,73].forEach((r,i)=>circle(x,y,r,`rgba(213,127,74,${.65-i*.19})`));
   circle(x,y,14,'#fff2df',RED);
   if(p.marker){
    box(550,y-87,334,55,17,'#0a242b','#79969a');
    c.strokeStyle='#79969a';c.beginPath();c.moveTo(x+9,y-14);c.lineTo(578,y-32);c.stroke();
    text(p.marker,568,y-71,23,WHITE,302,true);
   }
  }else{
   box(248,766,584,77);text('localização pontual não informada',282,792,29);
  }
  if(hasLocation&&!sat)text('Imagem de satélite indisponível',434,1050,24,MUTED);
  const compassX=152,compassY=1222;
  if(engraving){
   // Reuse the engraved compass. Reflect the top of its round bezel to fill
   // the part covered by the footer in the original artwork.
   const sourceMidY=1282, sourceX=11, sourceY=1130, width=204, height=225;
   const insetX=compassX-108, insetY=compassY-sourceMidY;
   function drawEngravedSlice(x,y,w,h){
    const sx=engraving.naturalWidth/W, sy=engraving.naturalHeight/H;
    c.drawImage(engraving,x*sx,y*sy,w*sx,h*sy,x,y,w,h);
   }
   c.save();c.translate(insetX,insetY);
   drawEngravedSlice(sourceX,sourceY,width,height);
   c.beginPath();c.arc(108,sourceMidY,101,0,Math.PI*2);c.clip();
   c.translate(0,2*sourceMidY);c.scale(1,-1);
   const seam=2*sourceMidY-sourceY-height;
   drawEngravedSlice(sourceX,1180,width,seam-1180);
   for(let i=0;i<6;i++){
    c.globalAlpha=(6-i)/7;
    drawEngravedSlice(sourceX,seam+i,width,1);
   }
   c.restore();
  }else compass(compassX,compassY);
  c.save();c.shadowColor='#071216';c.shadowBlur=5;c.shadowOffsetY=2;
  serif('S',compassX,compassY+118,29,28,'#e6bc80','center');
  serif('L',compassX+120,compassY,29,28,'#e6bc80','center');
  serif('O',compassX-120,compassY,29,28,'#e6bc80','center');
  c.restore();
  const summary=String(e.bulletinSummary||e.condition||e.descOnly||e.detail||'').trim();
  if(summary&&!p.quake){
   box(350,1249,674,91);lines(summary,370,1263,635,25,2);
  }
  if(!engraving){
   const panelTop=1370,panelBottom=1796;
   box(24,panelTop,1032,panelBottom-panelTop,12,'#0b2025');
   band(29,panelTop,1022);band(29,panelBottom-15,1022);
   for(const [x,y,sx,sy] of [[25,panelTop,1,1],[1055,panelTop,-1,1],[25,panelBottom,1,-1],[1055,panelBottom,-1,-1]])flourish(x,y,sx,sy);
  }
  const when=Number.isFinite(Number(e.time))&&Number(e.time)>0?new Date(Number(e.time)).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',',' ·')+' BRT':'Horário não informado';
  icon('calendar',80,1425);text(when,128,1430,28,WHITE,450,true);stroke(565,1425,565,1470);icon('layers',592,1425);lines(e.sourceSummary||e.source||'Fonte não informada',642,1412,365,25,2,WHITE,true);stroke(69,1492,1008,1492);
  p.stats.forEach(([label,value],i)=>{const x=85+i*318;if(i)stroke(x-22,1520,x-22,1616);icon(p.weather?['thermometer','drop','waves'][i]:['depth','pulse',p.stats[2][0]==='COORDENADAS'?'pin':'waves'][i],x-5,1528);if(label==='COORDENADAS'){value.split(' · ').forEach((part,row)=>text(part,x+43,1520+row*37,29,WHITE,241));}else lines(value,x+43,1520,241,29,2);text(label,x+43,1600,18,MUTED,240,true);});
  text(p.note,70,1636,18,MUTED,940);
  stroke(69,1674,1008,1674);icon('globe',85,1712);text('argosorbis.com.br',166,1711,29,WHITE,380,true);stroke(485,1699,485,1762);
  c.save();c.strokeStyle=WHITE;c.lineWidth=2.5;c.beginPath();c.arc(558,1732,25,0,Math.PI*2);c.stroke();c.fillStyle=WHITE;c.beginPath();c.moveTo(541,1730);c.lineTo(575,1716);c.lineTo(565,1749);c.lineTo(556,1738);c.lineTo(550,1744);c.lineTo(551,1734);c.closePath();c.fill();c.restore();text('Telegram · @argosorbis',606,1715,24,WHITE,410,true);
  // Decorative signature waves below the data, never presented as geophysical observations.
  if(!engraving){
   c.save();c.strokeStyle='#ad9565';c.lineWidth=.8;for(let j=0;j<17;j++){c.globalAlpha=.08+j*.008;c.beginPath();for(let x=0;x<=W;x+=9){const y=1860+Math.sin(x/91+j*.25)*25+Math.sin(x/230-j*.23)*14+j*2;if(x===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}c.restore();
   c.strokeStyle=GOLD;c.lineWidth=3;c.strokeRect(7,7,W-14,H-14);
  c.strokeStyle='#6e4d31';c.lineWidth=2;c.strokeRect(12,12,W-24,H-24);
  }
  const attribution=videoMap?'Imagem de base: '+videoMap.credit:sat?'Imagem de base: Esri, Maxar, Earthstar Geographics':'Imagem de base indisponível';
  text(attribution+(sat&&borders?.municipalities.length?' · Limites municipais: IBGE':''),60,1802,14,MUTED,960);
  return videoMap?{overlay:canvas,mapLayer}:canvas;
 }
 async function replayMap(frame){
  const [relief,labels]=await Promise.all([
   load(mapUrl('World_Physical_Map',frame,720,true),4500),
   load(mapUrl('Reference/World_Boundaries_and_Places',frame,720),4500)
  ]);
  if(relief)return {base:relief,labels,credit:'Esri · relevo'};
  const [topographic,imagery]=await Promise.all([
   load(mapUrl('World_Topo_Map',frame,720),4500),satellite(frame)
  ]);
  if(topographic)return {base:topographic,labels:null,credit:'Esri · mapa topográfico'};
  if(imagery)return {base:imagery,labels,credit:'Esri, Maxar, Earthstar Geographics'};
  throw Error('O mapa do vídeo não carregou. Tente novamente.');
 }
 root.SiteEventStory={render,profile,replayMap,mapArea,version:'argos-cartographic-v12'};
})(window);

