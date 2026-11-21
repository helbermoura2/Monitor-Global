/* Full-screen cartographic replay shared by the website and Android. */
(function(root){
 'use strict';
 const WIDTH=720,HEIGHT=1280,DURATION=20000,FPS=20;
 const palette=['#a7c5df','#81c6d5','#6cbfbf','#79c4a3','#e7b978','#ee9e57','#f58643','#eb6c30','#ce393d','#a02263','#751947','#481533'];
 const point=q=>Array.isArray(q?.coords)&&q.coords.length>=2&&Number.isFinite(q.coords[0])&&Number.isFinite(q.coords[1])&&Math.abs(q.coords[0])<=180&&Math.abs(q.coords[1])<85;
 const eligible=q=>q?.type==='earthquake'&&point(q)&&Number.isFinite(q.mag)&&(q.mag>=6||root.QuakeSiteFlags?.isBrazil(q)===true);
 function mimeType(){
  if(!root.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)return '';
  return ['video/mp4;codecs=avc1.42001f','video/webm;codecs=vp8','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))||'';
 }
 function canvas(w=WIDTH,h=HEIGHT){
  const element=document.createElement('canvas');element.width=w;element.height=h;return element;
 }
 function officialProduct(item){
  const service=root.RuptureShaking;
  if(item.shaking?.grid||!service)return Promise.resolve(item.shaking||null);
  let timer;
  return Promise.race([
   Promise.resolve().then(()=>service.query(item,{background:true})).catch(()=>null),
   new Promise(resolve=>{timer=setTimeout(()=>resolve(null),6500);})
  ]).finally(()=>clearTimeout(timer));
 }
 function parseFiniteFault(text){
  let columns, strike, dip, dx, dz;
  const patches=[];
  for(const line of text.split(/\r?\n/)){
   if(line.startsWith('%')){
    const orientation=line.match(/(?:STRK|STRIKE)\s*=\s*([\d.]+).*?DIP\s*=\s*([\d.]+)/i);
    const spacing=line.match(/Dx\s*=\s*([\d.]+).*?Dz\s*=\s*([\d.]+)/i);
    if(orientation)[strike,dip]=orientation.slice(1).map(Number);
    if(spacing)[dx,dz]=spacing.slice(1).map(Number);
    const labels=line.slice(1).trim().split(/\s+/);
    if(labels[0]==='LAT'&&labels[1]==='LON'&&labels.includes('TRUP')){
     columns=['LAT','LON','SLIP','TRUP','RISE'].map(name=>labels.indexOf(name));
    }
    continue;
   }
   if(!columns||!line.trim())continue;
   const numbers=line.trim().split(/\s+/).map(Number);
   const [lat,lon,slip,time,rise]=columns.map(i=>numbers[i]);
   if(![lat,lon,slip,time,rise,strike,dip,dx,dz].every(Number.isFinite)||
      Math.abs(lat)>=85||Math.abs(lon)>360||slip<=0||time<0||time>600||rise<0||rise>600||
      strike<0||strike>360||dip<0||dip>90||dx<=0||dx>100||dz<=0||dz>100)continue;
   patches.push({lat,lon,slip,time,rise,strike,dip,dx,dz});
   if(patches.length>10000)return [];
  }
  return patches;
 }
 async function finiteFault(item,product){
  const reports=[item,...(item.reports||[])];
  const usgs=reports.find(report=>/^USGS(?:-RT)?$/i.test(report.source||'')&&report.sourceEventId);
  const id=product?.method?.startsWith('usgs-shakemap-')?product.eventId:usgs?.sourceEventId;
  if(!/^[a-z0-9]{3,36}$/i.test(id||''))return [];
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
  const read=async url=>{
   const address=new URL(url);
   if(address.origin!=='https://earthquake.usgs.gov'||address.username||address.password)throw Error('Fonte inválida');
   const response=await fetch(address,{signal:controller.signal,redirect:'error'});
   if(!response.ok||Number(response.headers.get('content-length'))>1500000)throw Error('Modelo indisponível');
   const text=await response.text();
   if(text.length>1500000)throw Error('Modelo excede o limite');
   return text;
  };
  try{
   const detail=JSON.parse(await read('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid='+id));
   const [lon,lat]=detail.geometry?.coordinates||[];
   const deltaLon=((lon-item.coords[0]+540)%360)-180;
   if(detail.id!==id||!Number.isFinite(detail.properties?.time)||!Number.isFinite(item.time)||
      Math.abs(detail.properties.time-item.time)>180000||
      !(Math.hypot(deltaLon,lat-item.coords[1])<1.5))return [];
   const models=(detail.properties.products?.['finite-fault']||[])
    .filter(model=>model.source==='us'&&model.status!=='DELETE')
    .sort((a,b)=>b.preferredWeight-a.preferredWeight||b.updateTime-a.updateTime);
   const asset=Object.entries(models[0]?.contents||{}).find(([key])=>/\.fsp$/i.test(key));
   return asset?.[1]?.url?parseFiniteFault(await read(asset[1].url)):[];
  }catch{return [];}finally{clearTimeout(timer);}
 }
 function frameFor(item,grid,mapHeight,patches){
  const [lon,lat]=item.coords;
  const latScale=Math.max(.2,Math.cos(lat*Math.PI/180));
  const estimatedKm=root.SeismicImpactModel.extent(item.mag,item.depth,5);
  let span=Math.max(.34,Math.min(5,estimatedKm/(92*latScale)));
  if(grid){
   const center=(grid.x0+grid.x1)/2,shift=360*Math.round((lon-center)/360);
   const dx=(grid.x1-grid.x0)/(grid.nx-1),dy=(grid.y1-grid.y0)/(grid.ny-1);
   const peak=grid.values.reduce((max,value)=>Math.max(max,value??0),0);
   const threshold=Math.max(2.5,peak-2);
   let displayed=.27;
   for(let y=0;y<grid.ny;y++)for(let x=0;x<grid.nx;x++){
    if((grid.values[y*grid.nx+x]??0)<threshold)continue;
    displayed=Math.max(displayed,Math.abs(grid.x0+x*dx+shift-lon),
     Math.abs(grid.y0+y*dy-lat)*WIDTH/(mapHeight*.83*latScale));
   }
   span=Math.min(6,displayed*1.27);
  }
  for(const patch of patches){
   const deltaLon=((patch.lon-lon+540)%360)-180;
   const margin=Math.max(patch.dx,patch.dz)/110;
   span=Math.max(span,(Math.abs(deltaLon)+margin)/latScale,
    (Math.abs(patch.lat-lat)+margin)*WIDTH/(mapHeight*.83*latScale));
  }
  const latSpan=span*latScale*mapHeight/WIDTH;
  return {minLon:lon-span,maxLon:lon+span,minLat:Math.max(-85,lat-latSpan*1.17),maxLat:Math.min(85,lat+latSpan*.83)};
 }
 function projection(f,mapHeight){
  return (lon,lat)=>{
   const middle=(f.minLon+f.maxLon)/2;
   return [(lon+360*Math.round((middle-lon)/360)-f.minLon)/(f.maxLon-f.minLon)*WIDTH,
    (f.maxLat-lat)/(f.maxLat-f.minLat)*mapHeight];
  };
 }
 function intensityFrames(frame,grid,withFault){
  if(!grid)return [];
  const w=144,h=132,steps=24;
  const samples=[];
  let peak=0;
  const middle=(grid.x0+grid.x1)/2;
  const stepX=(grid.x1-grid.x0)/(grid.nx-1),stepY=(grid.y1-grid.y0)/(grid.ny-1);
  for(let y=0;y<h;y++){
   const lat=frame.maxLat-(y+.5)/h*(frame.maxLat-frame.minLat);
   for(let x=0;x<w;x++){
    const lon=frame.minLon+(x+.5)/w*(frame.maxLon-frame.minLon);
    const mmi=root.RuptureShakingModel.sample(grid,lon,lat);
    if(mmi==null||mmi<2.5)continue;
    peak=Math.max(peak,mmi);
    const wrapped=lon+360*Math.round((middle-lon)/360);
    const edge=Math.min((wrapped-grid.x0)/stepX,(grid.x1-wrapped)/stepX,
     (lat-grid.y0)/stepY,(grid.y1-lat)/stepY);
    samples.push({x,y,mmi,opacity:Math.max(0,Math.min(1,edge/2))});
   }
  }
  let edgeMax=0;
  for(let y=0;y<grid.ny;y++)for(let x=0;x<grid.nx;x++){
   if(x===0||y===0||x===grid.nx-1||y===grid.ny-1){
    edgeMax=Math.max(edgeMax,grid.values[y*grid.nx+x]??0);
   }
  }
  // The grid's rectangular extent is a data boundary, not a shaking contour.
  const floor=withFault?2.5:Math.max(2.5,Math.min(edgeMax+.05,peak-.45));
  return Array.from({length:steps+1},(_,step)=>{
   const layer=canvas(w,h),ctx=layer.getContext('2d');
   const threshold=peak-(peak-floor)*step/steps;
   for(const {x,y,mmi,opacity} of samples){
    if(!step||mmi<threshold)continue;
    const index=Math.min(11,Math.round(mmi)-1);
    ctx.fillStyle=palette[index];
    ctx.globalAlpha=Math.min(.72,.44+index*.045)*Math.min(1,(mmi-threshold)/.24)*opacity;
    ctx.fillRect(x,y,1,1);
   }
   return layer;
  });
 }
 function faultCells(patches,project){
  return patches.map(patch=>{
   const {lat,lon,dx,dz,dip,strike}=patch;
   const angle=strike*Math.PI/180,lonScale=111.2*Math.cos(lat*Math.PI/180);
   const halfWidth=dz*Math.cos(dip*Math.PI/180)/2;
   const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([along,across])=>{
    const east=along*dx/2*Math.sin(angle)+across*halfWidth*Math.cos(angle);
    const north=along*dx/2*Math.cos(angle)-across*halfWidth*Math.sin(angle);
    return project(lon+east/lonScale,lat+north/111.2);
   });
   return {...patch,corners};
  }).sort((a,b)=>a.time-b.time);
 }
 function drawFault(ctx,cells,elapsed,peak){
  for(const {corners,slip,time,rise} of cells){
   if(time>elapsed)break;
   const fraction=Math.min(1,(elapsed-time)/Math.max(.1,rise));
   const intensity=Math.min(1,Math.sqrt(slip/peak));
   const active=elapsed-time<Math.max(.6,rise);
   ctx.beginPath();
   corners.forEach(([x,y],index)=>index?ctx.lineTo(x,y):ctx.moveTo(x,y));
   ctx.closePath();
   ctx.fillStyle=active?'#ffe8b1':`hsl(${20-21*intensity} 79% ${66-29*intensity}%)`;
   ctx.globalAlpha=(.25+.65*intensity)*(.3+.7*fraction);
   ctx.fill();
   ctx.globalAlpha=active?.92:.62;
   ctx.strokeStyle=active?'#fff0c7':'#692027';
   ctx.lineWidth=active?1.4:.75;
   ctx.stroke();
  }
  ctx.globalAlpha=1;
 }
 function drawRupture(ctx,features,project,progress){
  if(progress<=0)return;
  ctx.save();ctx.globalAlpha=Math.min(1,progress*4);ctx.strokeStyle='#fff1d0';
  ctx.lineWidth=2;ctx.setLineDash([6,5]);
  for(const feature of features){
   ctx.beginPath();
   feature.geometry.coordinates.forEach(([lon,lat],i)=>{
    const [x,y]=project(lon,lat);
    if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
   });
   ctx.stroke();
  }
  ctx.restore();
 }
 async function prepare(item){
  if(!eligible(item))throw Error('Vídeo disponível para sismos com coordenadas, M6+ ou brasileiros.');
  const product=await officialProduct(item);
  const grid=product?.status==='available'&&root.RuptureShakingModel?.valid(product.grid)?product.grid:null;
  const {x,y,width,height}=root.SiteEventStory.mapArea;
  const scale=WIDTH/1080,mapWidth=width*scale,mapHeight=height*scale,mapTop=y*scale;
  const patches=await finiteFault(item,product);
  const frame=frameFor(item,grid,mapHeight,patches),project=projection(frame,mapHeight);
  const maps=await root.SiteEventStory.replayMap(frame);
  const {overlay,mapLayer}=await root.SiteEventStory.render({...item,shaking:product},{videoMap:{...maps,frame}});
  const cells=faultCells(patches,project),layers=intensityFrames(frame,grid,cells.length>0);
  const maxSlip=Math.max(0,...cells.map(cell=>cell.slip));
  const faultDuration=Math.max(0,...cells.map(cell=>cell.time+cell.rise));
  const rupture=(product?.rupture?.features||[]).filter(f=>f.properties?.projection===true&&
   ['USGS','INGV','ShakeMap-EU'].includes(f.properties.provider)&&f.geometry?.type==='LineString');
  const scene=canvas(),ctx=scene.getContext('2d',{alpha:false});
  function draw(t){
   const reveal=Math.max(0,Math.min(1,(t-1100)/16300));
   ctx.save();ctx.translate(x*scale,mapTop);ctx.scale(mapWidth/WIDTH,1);
   ctx.beginPath();ctx.rect(0,0,WIDTH,mapHeight);ctx.clip();
   ctx.drawImage(mapLayer,0,0,WIDTH,mapHeight);
   if(layers.length){
    const index=cells.length?layers.length-1:Math.round(reveal*(layers.length-1));
    ctx.globalAlpha=cells.length?.42:1;
    ctx.drawImage(layers[index],0,0,WIDTH,mapHeight);
    ctx.globalAlpha=1;
   }
   if(cells.length){
    if(t>=1100)drawFault(ctx,cells,reveal*faultDuration,maxSlip);
   }else{
    drawRupture(ctx,rupture,project,reveal);
   }
   ctx.restore();
   ctx.drawImage(overlay,0,0,WIDTH,HEIGHT);
   const tagX=222,tagY=mapTop+mapHeight-65,tagW=466;
   ctx.fillStyle='#0b202beb';ctx.fillRect(tagX,tagY,tagW,47);
   ctx.fillStyle='#f6e5c8';ctx.font='600 15px system-ui';
   ctx.fillText(cells.length?'Ruptura modelada · USGS':grid?(product.provider||'Mapa oficial de intensidade'):'Localização do sismo',tagX+10,tagY+18,tagW-20);
   ctx.fillStyle='#d8c49e';ctx.font='13px system-ui';
   ctx.fillText(cells.length?`Avanço na falha · ${Math.round(reveal*faultDuration)} s do modelo`:grid?'Faixas mais intensas · sem cronologia':'Mapa oficial de intensidade indisponível',tagX+10,tagY+35,tagW-20);
   ctx.fillStyle='#6f6853';ctx.fillRect(tagX,tagY+45,tagW,2);
   ctx.fillStyle='#f0c97e';ctx.fillRect(tagX,tagY+45,tagW*Math.min(1,t/DURATION),2);
  }
  draw(0);
  return {scene,draw,official:!!grid,rupture:cells.length>0||rupture.length>0,timed:cells.length>0};
 }
 async function record(item,onProgress){
  const mime=mimeType();
  if(!mime)throw Error('Este navegador não oferece exportação de vídeo.');
  const {scene,draw}=await prepare(item);
  const stream=scene.captureStream(FPS),parts=[];
  let recorder,timer,watchdog;
  try{
   recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2300000});
   const done=new Promise((resolve,reject)=>{
    recorder.ondataavailable=e=>{if(e.data?.size)parts.push(e.data);};
    recorder.onerror=e=>reject(e.error||Error('Falha ao gravar vídeo.'));
    recorder.onstop=()=>resolve(new Blob(parts,{type:recorder.mimeType||mime}));
    watchdog=setTimeout(()=>reject(Error('O vídeo demorou demais para ser gravado.')),DURATION+5000);
   });
   recorder.start(500);
   const started=performance.now();
   timer=setInterval(()=>{
    if(recorder.state!=='recording')return;
    const elapsed=Math.min(DURATION,performance.now()-started);
    draw(elapsed);onProgress?.(Math.round(elapsed/DURATION*100));
    if(elapsed>=DURATION)recorder.stop();
   },1000/FPS);
   const blob=await done;
   if(!blob.size)throw Error('O navegador não gravou quadros de vídeo.');
   return {blob,extension:(blob.type||mime).includes('mp4')?'mp4':'webm'};
  }finally{
   clearInterval(timer);clearTimeout(watchdog);
   if(recorder&&recorder.state!=='inactive')recorder.stop();
   stream.getTracks().forEach(track=>track.stop());
  }
 }
 root.QuakeSiteVideo={eligible,prepare,record};
})(window);
