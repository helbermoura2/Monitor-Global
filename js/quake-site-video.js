/* Full-screen cartographic replay shared by the website and Android. */
(function(root){
 'use strict';
 const WIDTH=720,HEIGHT=1280,DURATION=20000,FPS=20;
 const thresholds=[.5,1,2.1,5,11,26,60,140,321.8,740,1702,3000];
 const palette=['#73bfb5','#84cc97','#a8ce65','#c2d84c','#e4dc40','#efce2f','#f6a427','#eb6c30','#ce393d','#a02263','#751947','#481533'];
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
 function frameFor(item,grid,mapHeight){
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
 function field(item,frame,grid){
  const model=root.RuptureShakingModel;
  const [eventLon,eventLat]=item.coords;
  const colored=canvas(96,170),ctx=colored.getContext('2d');
  for(let y=0;y<colored.height;y++){
   const lat=frame.maxLat-(y+.5)/colored.height*(frame.maxLat-frame.minLat);
   for(let x=0;x<colored.width;x++){
    const lon=frame.minLon+(x+.5)/colored.width*(frame.maxLon-frame.minLon);
    const km=111.2*Math.hypot(lat-eventLat,(lon-eventLon)*Math.cos(eventLat*Math.PI/180));
    let index=0;
    if(grid){
     const level=model.sample(grid,lon,lat);
     if(level==null||level<2.5)continue;
     index=Math.max(0,Math.min(11,Math.round(level)-1));
    }else{
     const pga=root.SeismicImpactModel.pga(item.mag,item.depth,km);
     if(pga<2.1)continue;
     while(index<11&&pga>=thresholds[index+1])index++;
    }
    ctx.fillStyle=palette[index];
    ctx.globalAlpha=Math.min(.66,.15+index*.05);
    ctx.fillRect(x,y,1,1);
   }
  }
  return colored;
 }
 function gridCells(grid,frame,project,epicenter,mapHeight){
  if(!grid)return [];
  const dx=(grid.x1-grid.x0)/(grid.nx-1),dy=(grid.y1-grid.y0)/(grid.ny-1);
  const visible=(1+(frame.maxLon-frame.minLon)/dx)*(1+(frame.maxLat-frame.minLat)/dy);
  const stride=Math.max(1,Math.ceil(Math.sqrt(Math.min(grid.values.length,visible)/950)));
  const cells=[];
  for(let y=0;y<grid.ny;y+=stride)for(let x=0;x<grid.nx;x+=stride){
   const mmi=grid.values[y*grid.nx+x];
   if(mmi==null||mmi<5)continue;
   const lon=grid.x0+x*dx,lat=grid.y0+y*dy;
   const [cx,cy]=project(lon,lat);
   const [left,top]=project(lon-dx*stride/2,lat+dy*stride/2);
   const [right,bottom]=project(lon+dx*stride/2,lat-dy*stride/2);
   if(right<0||left>WIDTH||bottom<0||top>mapHeight)continue;
   cells.push({left,top,w:right-left,h:bottom-top,mmi,distance:Math.hypot(cx-epicenter[0],cy-epicenter[1])});
  }
  return cells.sort((a,b)=>a.distance-b.distance);
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
  const frame=frameFor(item,grid,mapHeight),project=projection(frame,mapHeight),epicenter=project(...item.coords);
  const maps=await root.SiteEventStory.replayMap(frame);
  const {overlay,mapLayer}=await root.SiteEventStory.render({...item,shaking:product},{videoMap:{...maps,frame}});
  const colorField=field(item,frame,grid),cells=gridCells(grid,frame,project,epicenter,mapHeight);
  const rupture=(product?.rupture?.features||[]).filter(f=>f.properties?.projection===true&&
   ['USGS','INGV','ShakeMap-EU'].includes(f.properties.provider)&&f.geometry?.type==='LineString');
  const scene=canvas(),ctx=scene.getContext('2d',{alpha:false});
  const radius=Math.max(...[[0,0],[0,mapHeight],[WIDTH,0],[WIDTH,mapHeight]].map(([x,y])=>Math.hypot(x-epicenter[0],y-epicenter[1])));
  const source=grid?(product.provider||'ShakeMap oficial'):'Intensidade estimada';
  function draw(t){
   const reveal=Math.max(0,Math.min(1,(t-1100)/16300));
   ctx.save();ctx.translate(x*scale,mapTop);ctx.scale(mapWidth/WIDTH,1);
   ctx.beginPath();ctx.rect(0,0,WIDTH,mapHeight);ctx.clip();
   ctx.drawImage(mapLayer,0,0,WIDTH,mapHeight);
   ctx.save();ctx.beginPath();
   ctx.arc(...epicenter,Math.max(1,radius*Math.sqrt(reveal)),0,2*Math.PI);ctx.clip();
   ctx.drawImage(colorField,0,0,WIDTH,mapHeight);ctx.restore();
   const count=Math.floor(cells.length*reveal);
   for(let i=0;i<count;i++){
    const {left,top,w,h,mmi}=cells[i];
    ctx.globalAlpha=.7;ctx.fillStyle=palette[Math.min(11,Math.round(mmi)-1)];ctx.fillRect(left,top,w+.3,h+.3);
    if(t<17000&&i>=count-6){
     ctx.globalAlpha=.85;ctx.strokeStyle='#fff5d4';ctx.lineWidth=1.6;ctx.strokeRect(left,top,w,h);
    }
   }
   ctx.globalAlpha=1;
   drawRupture(ctx,rupture,project,reveal);
   ctx.restore();
   ctx.drawImage(overlay,0,0,WIDTH,HEIGHT);
   const tagX=222,tagY=mapTop+mapHeight-65,tagW=466;
   ctx.fillStyle='#0b202beb';ctx.fillRect(tagX,tagY,tagW,47);
   ctx.fillStyle='#f6e5c8';ctx.font='600 15px system-ui';
   ctx.fillText('Replay ilustrativo · '+source,tagX+10,tagY+18,tagW-20);
   ctx.fillStyle='#d8c49e';ctx.font='13px system-ui';
   ctx.fillText(rupture.length?'Projeção de ruptura publicada':'Revelação da intensidade',tagX+10,tagY+35,tagW-20);
   ctx.fillStyle='#6f6853';ctx.fillRect(tagX,tagY+45,tagW,2);
   ctx.fillStyle='#f0c97e';ctx.fillRect(tagX,tagY+45,tagW*Math.min(1,t/DURATION),2);
  }
  draw(0);
  return {scene,draw,official:!!grid,rupture:rupture.length>0};
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
