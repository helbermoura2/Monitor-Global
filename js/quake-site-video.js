/* Exportador de VÍDEO independente da imagem do site e do Telegram.
   Anima a câmera sobre o mapa do próprio evento, sem fabricar frente de onda,
   velocidade sísmica, danos, ruptura ou uma grade ShakeMap ausente. */
(function(root){
 'use strict';
 const seconds=9;
 const quake=item=>!!item&&(item.type==='earthquake'||(!item.type&&item.mag!=null));
 function eligible(item){return quake(item)&&(Number(item.mag)>=6||root.QuakeSiteFlags?.isBrazil(item)===true);}
 function supported(){
  if(!root.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)return false;
  return !!(['video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m)));
 }
 const ease=t=>t*t*(3-2*t);
 async function record(item,onProgress){
  if(!eligible(item))throw Error('Vídeos disponíveis para M6+ ou sismos brasileiros.');
  if(!supported())throw Error('Este navegador não oferece exportação de vídeo. Use Chrome no Android.');
  if(typeof root.createQuakeSiteCanvas!=='function')throw Error('Exportador de imagem indisponível.');
  const original=await root.createQuakeSiteCanvas(item);
  const layout=root.QuakeSiteCard,sourceWidth=original.width,sourceHeight=original.height;
  const w=720,h=1280,scene=document.createElement('canvas');scene.width=w;scene.height=h;
  const ctx=scene.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Canvas de vídeo indisponível.');
  const mime=['video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
  const stream=scene.captureStream(15);
  let recorder,parts=[];
  try{recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3000000});}
  catch(e){stream.getTracks().forEach(t=>t.stop());throw e;}
  const ended=new Promise((resolve,reject)=>{
   recorder.ondataavailable=e=>{if(e.data?.size)parts.push(e.data);};
   recorder.onerror=e=>reject(e.error||Error('Falha ao gravar vídeo.'));
   recorder.onstop=()=>resolve(new Blob(parts,{type:recorder.mimeType||mime}));
  });
  const sy=h/1440,top=layout.MAP_Y*sy,height=layout.MAP_HEIGHT*sy,epicenter=(layout.MAP_Y+layout.ANCHOR_Y)*sy;
  const draw=t=>{
   const progress=Math.min(1,t/(seconds*1000)),zoom=1+.19*ease(progress);
   ctx.fillStyle='#071a26';ctx.fillRect(0,0,w,h);
   ctx.drawImage(original,0,0,sourceWidth,sourceHeight,0,0,w,h);
   ctx.save();ctx.beginPath();ctx.rect(0,top,w,height);ctx.clip();
   ctx.translate(w/2,epicenter);ctx.scale(zoom,zoom);ctx.translate(-w/2,-epicenter);
   ctx.drawImage(original,0,0,sourceWidth,sourceHeight,0,0,w,h);
   ctx.restore();
   // Rótulo de vídeo sempre separado da PNG; movimento é câmera, não propagação.
   ctx.fillStyle='rgba(2,15,27,.86)';ctx.fillRect(12,top+8,w-24,37);
   ctx.fillStyle='#f0f8ff';ctx.font='bold 19px sans-serif';ctx.textBaseline='middle';
   ctx.fillText('REPLAY CARTOGRÁFICO · VÍDEO ILUSTRATIVO',25,top+27);
   ctx.fillStyle='#38d9f7';ctx.fillRect(15,h-16,(w-30)*progress,4);
  };
  draw(0);
  let raf=0,stopped=false;
  recorder.start(250);
  const start=performance.now();
  const tick=now=>{
   if(stopped)return;
   const elapsed=now-start;
   draw(elapsed);onProgress?.(Math.round(Math.min(1,elapsed/(seconds*1000))*100));
   if(elapsed>=seconds*1000){stopped=true;recorder.stop();}
   else raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick);
  try{
   const blob=await ended;
   if(!blob.size)throw Error('O navegador não gravou quadros de vídeo.');
   return {blob,extension:(blob.type||mime).includes('mp4')?'mp4':'webm'};
  }finally{stopped=true;cancelAnimationFrame(raf);if(recorder.state!=='inactive')recorder.stop();stream.getTracks().forEach(t=>t.stop());}
 }
 async function download(item,onProgress){
  const {blob,extension}=await record(item,onProgress);
  const filename='monitor-global-sismo-'+String(item.id||'evento').replace(/[^a-zA-Z0-9_.-]/g,'_')+'.'+extension;
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),15000);
  return {filename,size:blob.size};
 }
 root.QuakeSiteVideo={eligible,supported,record,download};
})(window);
