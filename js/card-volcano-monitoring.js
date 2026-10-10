/* Close crater observation, driven by the existing card clock. No activity is inferred. */
(function(){
 'use strict';
 const TAU=Math.PI*2;
 function noise(x,y){
  const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  return (hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v;
 }
 function fbm(x,y){let n=0,a=.5;for(let i=0;i<4;i++){n+=noise(x,y)*a;const nx=x*1.6+y*1.2;x=nx+4.1;y=y*1.6-x*.6+8.4;a*=.5;}return n;}
 // A shaded, eroded bowl, seen from above. Prepared once, never rebuilt per frame.
 function stone(size){
  const c=document.createElement('canvas');c.width=size;c.height=size*2;
  const ctx=c.getContext('2d'),pixels=ctx.createImageData(c.width,c.height);
  function surface(x,y){
   const dx=(x-.5)*2.2,dy=(y-.46)*2.9,r=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
   const edge=.64+(fbm(Math.cos(angle)*3+7,Math.sin(angle)*3+7)-.45)*.17;
   const wall=Math.exp(-Math.pow((r-edge)/.16,2));
   const basin=1-Math.max(0,Math.min(1,(r-edge+.24)/.22));
   const erosion=fbm(angle*19+20,r*26)-.46;
   return wall*.23-basin*.32+erosion*.065+fbm(x*43,y*75)*.055;
  }
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
   const u=x/c.width,v=y/c.height,h=surface(u,v),nx=(h-surface(u+.003,v))*19,ny=(h-surface(u,v+.003))*19;
   const light=Math.max(.14,Math.min(1,.57+nx*.65-ny*.85)),grain=noise(x*1.8,y*1.8),strata=fbm(u*80,v*120);
   const dark=Math.max(.25,Math.min(1,.75+h*.9)),tone=(32+light*112+grain*14+strata*18)*dark;
   const i=(y*c.width+x)*4;pixels.data[i]=tone*.91;pixels.data[i+1]=tone*.94;pixels.data[i+2]=tone;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);return c;
 }
 function create(cfg,mobile,quality){
  const detail=quality||{resolution:1,count:n=>n,track:a=>a,fps:n=>n};
  if(cfg.type!=='volcano'||cfg.hot||cfg.ash||cfg.lava)return null;
  const canvas=document.createElement('canvas');canvas.className='pd-volcano-monitor';canvas.dataset.texture='procedural';
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return null;
  let image=new Image(),ready=false,dead=false,w=1,h=1,last=0;
  const reserve=stone(mobile?140:200),haze=document.createElement('canvas');haze.width=haze.height=128;
  const hc=haze.getContext('2d');
  for(let i=0;i<12;i++){
   const x=30+noise(i,7)*68,y=30+noise(i,13)*68,r=22+noise(i,17)*25,g=hc.createRadialGradient(x,y,0,x,y,r);
   g.addColorStop(0,'rgba(188,200,206,.13)');g.addColorStop(.6,'rgba(154,173,184,.035)');g.addColorStop(1,'rgba(154,173,184,0)');hc.fillStyle=g;hc.fillRect(0,0,128,128);
  }
  function draw(t){
   if(dead)return;last=t;
   const source=ready?image:reserve;
   // All movement is camera drift; the rocks never wobble or morph.
   const sw=source.naturalWidth||source.width,sh=source.naturalHeight||source.height;
   const scale=Math.max(w/sw,h/sh)*(1.06+.014*Math.sin(t*.09)),dw=sw*scale,dh=sh*scale;
   const x=(w-dw)/2+Math.sin(t*.055)*w*.018,y=(h-dh)/2+Math.sin(t*.043+1)*h*.009;
   ctx.fillStyle='#1a2024';ctx.fillRect(0,0,w,h);ctx.drawImage(source,x,y,dw,dh);
   // Cold shadow grade keeps the actual mineral/rock detail rather than hiding it in blue.
   ctx.fillStyle='rgba(7,14,21,.19)';ctx.fillRect(0,0,w,h);
   const shade=ctx.createLinearGradient(0,0,0,h);shade.addColorStop(0,'rgba(2,8,13,.31)');shade.addColorStop(.3,'rgba(2,8,13,.03)');shade.addColorStop(.62,'rgba(2,8,13,.09)');shade.addColorStop(1,'rgba(2,8,13,.49)');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h);
   // Low, wind-driven atmospheric haze, not an eruptive column.
   ctx.globalAlpha=.42;
   for(let i=0;i<4;i++){const drift=((t*.009+i*.32)%1.6)-.3;ctx.drawImage(haze,drift*w-w*.3,h*(.25+i*.13),w*.9,h*.28);}
   ctx.globalAlpha=1;
   const vignette=ctx.createRadialGradient(w*.5,h*.45,w*.12,w*.5,h*.45,h*.7);vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(2,8,12,.35)');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  }
  image.onload=()=>{if(dead)return;ready=true;canvas.dataset.texture='photograph';image.onload=image.onerror=null;draw(last);};
  image.onerror=()=>{if(dead)return;image.onload=image.onerror=null;};
  image.src='media/card-fx/volcano-crater.jpg';
  function resize(width,height){w=width;h=height;const scale=detail.resolution*Math.min(1,(mobile?320:480)/Math.max(w,1),(mobile?640:960)/Math.max(h,1));canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));ctx.setTransform(scale,0,0,scale,0,0);draw(last);}
  function destroy(){if(dead)return;dead=true;image.onload=image.onerror=null;image.removeAttribute('src');image=null;reserve.width=reserve.height=haze.width=haze.height=1;canvas.remove();}
  return {canvas,resize,draw,destroy};
 }
 window.CardVolcanoMonitoring={create};
})();
