/* Close-range weather materials. One clock, one card, no changes to event data. */
(function(){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+Math.random()*(b-a),TAU=Math.PI*2;
 function create(cfg,mobile,panel){
  if(!['storm','hurricane','wind','flood'].includes(cfg.type))return null;
  const canvas=document.createElement('canvas');canvas.className='pd-weather-material';canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  let w=1,h=1,dead=false,measureAt=-1,ledges=[],groups=[],bolt=[],boltAt=-10;
  const rain=cfg.type==='storm'||cfg.type==='hurricane',flood=cfg.type==='flood';
  const drops=Array.from({length:rain?(mobile?150:300):0},()=>({x:Math.random(),y:Math.random(),z:rand(.2,1),vx:0,vy:0,seed:rand(0,TAU)}));
  const matter=Array.from({length:cfg.type==='wind'?(mobile?85:155):flood?(mobile?35:65):0},(_,i)=>({x:Math.random(),y:Math.random(),z:rand(.2,1),vx:0,vy:0,phase:rand(0,TAU),leaf:i%5===0}));
  const impacts=[],lenses=[];
  const waterBuffer=document.createElement('canvas'),waterCtx=waterBuffer.getContext('2d');
  const lensLayer=document.createElement('div');lensLayer.className='pd-weather-lenses';
  const optics=document.createElementNS('http://www.w3.org/2000/svg','svg');optics.setAttribute('width','0');optics.setAttribute('height','0');optics.setAttribute('aria-hidden','true');
  optics.innerHTML='<defs><filter id="pd-weather-drop-optics" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".15 .23" numOctaves="1" seed="7" result="surface"/><feDisplacementMap in="SourceGraphic" in2="surface" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="pd-weather-water-optics" x="-4%" y="-12%" width="108%" height="124%"><feTurbulence type="fractalNoise" baseFrequency=".02 .09" numOctaves="1" seed="4" result="current"/><feDisplacementMap in="SourceGraphic" in2="current" scale="2.4" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
  lensLayer.append(optics);
  if(rain)for(let i=0;i<(mobile?6:10);i++){
   const el=document.createElement('i');el.className='pd-weather-lens';lensLayer.append(el);
   lenses.push({el,x:rand(.03,.97),y:Math.random(),radius:rand(2,4),speed:0,phase:rand(0,TAU)});
  }
  // Veins and uneven silhouettes rotate as actual surfaces, not wind symbols.
  const leaf=document.createElement('canvas');leaf.width=48;leaf.height=32;const lc=leaf.getContext('2d');
  const g=lc.createLinearGradient(0,0,48,32);g.addColorStop(0,'#544d22');g.addColorStop(.5,'#ada46c');g.addColorStop(1,'#5c4828');lc.fillStyle=g;
  lc.beginPath();lc.moveTo(3,17);lc.bezierCurveTo(11,4,29,2,44,11);lc.bezierCurveTo(39,22,17,29,3,17);lc.fill();
  lc.strokeStyle='rgba(40,37,17,.6)';lc.lineWidth=.7;lc.beginPath();lc.moveTo(2,18);lc.lineTo(43,11);for(let i=10;i<38;i+=7){lc.moveTo(i,18-i*.15);lc.lineTo(i+3,7);lc.moveTo(i,18-i*.15);lc.lineTo(i+5,24);}lc.stroke();
  function measure(t){
   if(t<measureAt)return;measureAt=t+.7;
   const pr=panel.getBoundingClientRect(),sx=w/Math.max(pr.width,1),sy=h/Math.max(pr.height,1);
   ledges=Array.from(panel.querySelectorAll('.stat-card,.bubble-section,.source-trust-card,.pd-header-row'),el=>{const r=el.getBoundingClientRect();return {x:(r.left-pr.left)*sx,y:(r.top-pr.top)*sy,width:r.width*sx};}).filter(r=>r.y>10&&r.y<h-8);
   if(flood)groups=Array.from(panel.querySelectorAll('[data-cyclone-text]'),el=>{const r=el.getBoundingClientRect();return {el,y:(r.top-pr.top)*sy,letters:Array.from(el.querySelectorAll('.pd-fx-windletter'))};});
  }
  function resize(width,height){w=width;h=height;const dpr=Math.min(devicePixelRatio||1,mobile?1:1.35);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(flood){waterBuffer.width=Math.round(w);waterBuffer.height=Math.round(h);}measureAt=-1;}
  function splash(x,y,force){if(impacts.length<(mobile?45:85))impacts.push({x,y,life:0,force,seed:rand(0,TAU)});}
  function precipitation(t,dt,pressure,flash,envelope){
   // Exposure and drag depend on depth: distant fine sheets, near fast drops.
   for(const d of drops){
    const squall=.55+.45*Math.sin(d.seed+t*1.7+d.y*4),z=d.z;
    const vx=(cfg.type==='hurricane'?280:85)+pressure*(cfg.type==='hurricane'?2300:650)+squall*70;
    d.vx+=(vx*(.25+z*.75)-d.vx)*(1-Math.exp(-dt*6));
    d.vy+=((cfg.type==='hurricane'?280+z*650:480+z*1150)-d.vy)*(1-Math.exp(-dt*9));
    const oldY=d.y*h;d.x+=d.vx*dt/w;d.y+=d.vy*dt/h;let x=d.x*w,y=d.y*h;
    if(z>.58&&impacts.length<70){for(const r of ledges)if(oldY<r.y&&y>=r.y&&x>r.x&&x<r.x+r.width){splash(x,r.y,z);break;}}
    if(d.y>1.12||d.x>1.2){d.y=rand(-.15,-.01);d.x=rand(-.15,1);}
    const exposure=.005+z*.012,a=(.025+z*z*.22)*(1+flash*1.5)*envelope;
    ctx.strokeStyle='rgba(211,227,237,'+a.toFixed(3)+')';ctx.lineWidth=.25+z*.9;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-d.vx*exposure,y-d.vy*exposure);ctx.stroke();
   }
   for(let i=impacts.length-1;i>=0;i--){
    const p=impacts[i];p.life+=dt;if(p.life>.46){impacts.splice(i,1);continue;}
    const fade=(1-p.life/.46)*envelope,spread=p.life*45*p.force;
    ctx.strokeStyle='rgba(227,242,247,'+(fade*.33).toFixed(3)+')';ctx.lineWidth=.65;
    ctx.beginPath();ctx.ellipse(p.x,p.y,spread+1,spread*.18+.4,0,0,TAU);ctx.stroke();
    for(let j=0;j<4;j++){const vx=Math.cos(j*2.1+p.seed)*38*p.force,x=p.x+vx*p.life,y=p.y-60*p.force*p.life+145*p.life*p.life;ctx.fillStyle='rgba(230,243,248,'+(fade*.6).toFixed(3)+')';ctx.beginPath();ctx.ellipse(x,y,.7,1.2,0,0,TAU);ctx.fill();}
   }
   for(const b of lenses){
    b.radius+=dt*(.55+pressure*.3);if(b.radius>3.4)b.speed=clamp(b.speed+dt*(19+b.radius*8),0,145);
    b.y+=b.speed*dt/h;b.x+=pressure*dt*.014;
    if(b.y>1.08||b.x>1.03){b.y=rand(-.08,.02);b.x=rand(.02,.97);b.radius=rand(1.8,2.9);b.speed=0;}
    const radius=clamp(b.radius,2,7),stretch=1+b.speed/110;
    b.el.style.width=(radius*2).toFixed(1)+'px';b.el.style.height=(radius*2*stretch).toFixed(1)+'px';
    b.el.style.transform='translate3d('+(b.x*w).toFixed(1)+'px,'+(b.y*h).toFixed(1)+'px,0) rotate('+(-pressure*12).toFixed(1)+'deg)';
    if(b.speed>10){ctx.strokeStyle='rgba(199,222,233,.09)';ctx.lineWidth=radius*.5;ctx.beginPath();ctx.moveTo(b.x*w,b.y*h);ctx.quadraticCurveTo(b.x*w+Math.sin(b.phase+t)*3,b.y*h-15,b.x*w-pressure*9,b.y*h-48);ctx.stroke();}
   }
   lensLayer.style.opacity=envelope.toFixed(3);
  }
  function lightning(t,flash){
   if(flash<.015)return;
   if(t-boltAt>1){
    boltAt=t;bolt=[];let x=w*rand(.14,.63),y=0;const drift=rand(-.13,.20)*w;
    const channel=[];for(let i=0;i<29;i++){channel.push([x,y]);x+=rand(-w*.025,w*.025)+drift/29;y+=h*rand(.018,.035);}
    bolt.push({points:channel,branch:false});
    for(let i=4;i<25;i+=3){if(Math.random()<.2)continue;let [bx,by]=channel[i];const points=[[bx,by]],sign=Math.random()<.5?-1:1;for(let j=0;j<rand(4,9);j++){bx+=sign*w*rand(.015,.045);by+=h*rand(.012,.04);points.push([bx,by]);}bolt.push({points,branch:true});}
   }
   ctx.save();ctx.globalCompositeOperation='screen';ctx.lineCap='round';ctx.lineJoin='round';
   for(const path of bolt)for(const [width,alpha,color] of [[14,.08,'180,213,241'],[4,.36,'214,234,250'],[1.2,.94,'255,253,247']]){
    ctx.lineWidth=width*(path.branch?.48:1);ctx.strokeStyle='rgba('+color+','+(flash*alpha*(path.branch?.58:1)).toFixed(3)+')';ctx.beginPath();path.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
   }
   ctx.restore();
  }
  function airborne(t,dt,pressure,envelope){
   // Vorticity carries leaves through the same passing gust, with inertial lag.
   for(const p of matter){
    const swirl=Math.sin(p.y*7+t*3.4+p.phase),speed=(140+pressure*1900)*(.25+p.z*.8),response=1-Math.exp(-dt*(p.leaf?3:12));
    p.vx+=(speed-p.vx)*response;p.vy+=((-speed*.14+swirl*pressure*(p.leaf?230:95))-p.vy)*response;
    p.x+=p.vx*dt/w;p.y+=p.vy*dt/h;
    if(p.x>1.15||p.y<-.15||p.y>1.15){p.x=rand(-.3,-.03);p.y=Math.random();}
    ctx.save();ctx.translate(p.x*w,p.y*h);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.globalAlpha=envelope*(.12+p.z*.5);
    if(p.leaf){ctx.rotate(Math.sin(t*6+p.phase)*1.7);ctx.scale(1,.18+.82*Math.abs(Math.sin(t*8+p.phase)));const size=6+p.z*13;ctx.drawImage(leaf,-size/2,-size/3,size,size*.67);}
    else {ctx.strokeStyle=p.z>.7?'#ddd9c4':'#aaa798';ctx.lineWidth=.25+p.z*.65;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-p.vx*.007,swirl*3,-Math.min(38,p.vx*.019),swirl*6);ctx.stroke();}
    ctx.restore();
   }
  }
  function waterline(x,t,top){return top+Math.sin(x*.027-t*1.65)*6+Math.sin(x*.071+t*2.4)*2.5+Math.sin(x*.13-t*3.2)*.8;}
  function inundation(t,dt,top,envelope,video){
   const y=top*h;ctx.save();ctx.beginPath();for(let x=-8;x<=w+8;x+=4){const wy=waterline(x,t,y);x===-8?ctx.moveTo(x,wy):ctx.lineTo(x,wy);}ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.clip();
   // The existing local video decoder supplies texture; horizontal slices refract it.
   if(video?.readyState>=2&&video.videoWidth){
    waterCtx.clearRect(0,0,w,h);
    const vw=video.videoWidth,vh=video.videoHeight;
    // Composite once: overlaps must not create bright horizontal scanlines.
    for(let sy=Math.max(0,Math.floor(y-10));sy<h;sy+=5){const shift=Math.sin(sy*.05-t*2.5)*4+Math.sin(sy*.13+t)*2;waterCtx.drawImage(video,0,sy/h*vh,vw,Math.min(5.8/h*vh,vh-sy/h*vh),shift,sy,w,5.8);}
    ctx.globalAlpha=.34*envelope;ctx.drawImage(waterBuffer,0,0,w,h);
   }
   ctx.globalAlpha=envelope;const absorption=ctx.createLinearGradient(0,y,0,h);absorption.addColorStop(0,'rgba(159,135,84,.10)');absorption.addColorStop(.3,'rgba(91,77,44,.13)');absorption.addColorStop(1,'rgba(34,38,28,.31)');ctx.fillStyle=absorption;ctx.fillRect(0,y-10,w,h);
   // Perspective stretches highlights and foam as they approach the observer.
   for(let j=0;j<23;j++){const depth=((j*.618)%1),yy=y+(h-y)*depth,center=(((j*.381+t*(.03+depth*.02))%1)*1.2-.1)*w;
    ctx.strokeStyle='rgba(225,217,181,'+(.025+(1-depth)*.09).toFixed(3)+')';ctx.lineWidth=.35+depth*.6;
    const span=12+depth*40;ctx.beginPath();ctx.moveTo(center-span,yy);ctx.bezierCurveTo(center-span*.3,yy-2,center+span*.3,yy+2,center+span,yy-1);ctx.stroke();
   }
   ctx.setLineDash([]);
   for(const p of matter){p.x+=dt*(.09+p.z*.17);if(p.x>1.1){p.x=-.1;p.y=Math.random();}const depth=.08+p.y*.92,xx=p.x*w,yy=y+(h-y)*depth+Math.sin(t*2+p.phase)*2;
    ctx.save();ctx.translate(xx,yy);ctx.rotate(Math.sin(t+p.phase)*.3);ctx.globalAlpha=envelope*(.18+depth*.33);
    if(p.leaf){ctx.fillStyle='#35291a';ctx.fillRect(-4*p.z,-1.5,12*p.z,2.6);ctx.strokeStyle='#b5a781';ctx.lineWidth=.5;ctx.strokeRect(-4*p.z,-1.5,12*p.z,2.6);}
    else {ctx.strokeStyle='#e3debb';ctx.lineWidth=.55;ctx.beginPath();ctx.ellipse(0,0,2+p.z*5,.7+p.z,0,0,TAU);ctx.stroke();}ctx.restore();
   }
   ctx.restore();
   // The contact angle at the glass gives a dark lip and an irregular bright rim.
   for(const [offset,color,width] of [[3,'rgba(18,29,25,.65)',4],[0,'rgba(215,222,196,.56)',1.2],[-2,'rgba(240,240,219,.20)',.65]]){
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();for(let x=-8;x<=w+8;x+=4){const yy=waterline(x,t,y)+offset;x===-8?ctx.moveTo(x,yy):ctx.lineTo(x,yy);}ctx.stroke();
   }
   for(const g of groups){
    const submerged=g.y>y+8;g.el.classList.toggle('pd-water-submerged',submerged);
    g.letters.forEach((el,i)=>{const fraction=i/Math.max(1,g.letters.length-1),phase=t*2.1-fraction*5+g.y*.018;if(submerged)el.style.transform='translate3d('+(Math.sin(phase)*2.4).toFixed(2)+'px,'+(Math.cos(phase*.8)*1.3).toFixed(2)+'px,0) skewX('+(Math.sin(phase)*2.8).toFixed(2)+'deg)';else el.style.removeProperty('transform');});
   }
  }
  function draw(t,dt,envelope,current){
   if(dead)return;measure(t);ctx.clearRect(0,0,w,h);
   const pressure=current.pressure||0,flash=current.flash||0;
   if(rain){precipitation(t,dt,pressure,flash,envelope);if(cfg.type==='storm')lightning(t,flash);}
   if(cfg.type==='wind')airborne(t,dt,pressure,envelope);
   if(flood)inundation(t,dt,current.waterTop??.88,envelope,current.video);
  }
  function destroy(){dead=true;canvas.remove();lensLayer.remove();for(const el of panel.querySelectorAll('.pd-water-submerged'))el.classList.remove('pd-water-submerged');for(const g of groups){g.el.classList.remove('pd-water-submerged');g.letters.forEach(el=>el.style.removeProperty('transform'));}leaf.width=leaf.height=waterBuffer.width=waterBuffer.height=1;impacts.length=0;groups=[];ledges=[];}
  return {canvas,lensLayer,resize,draw,destroy};
 }
 window.CardWeatherPhysics={create};
})();
