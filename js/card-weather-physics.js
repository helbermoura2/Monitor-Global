/* Close-range weather materials. One clock, one card, no changes to event data. */
(function(){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+Math.random()*(b-a),TAU=Math.PI*2;
 function create(cfg,mobile,panel,quality){
  const detail=quality||{resolution:1,count:n=>n,track:a=>a,fps:n=>n};
  if(cfg.type==='flood')return window.CardFloodRise?.create(cfg,mobile,panel,quality)||null;
  if(cfg.type==='tsunami')return window.CardTsunamiSurge?.create(cfg,mobile,panel,quality)||null;
  if(cfg.type==='tornado')return window.CardTornadoField?.create(cfg,mobile,panel,quality)||null;
  if(cfg.type==='wind')return window.CardGaleField?.create(cfg,mobile,panel,quality)||null;
  if(!['storm','hurricane'].includes(cfg.type))return null;
  const canvas=document.createElement('canvas');canvas.className='pd-weather-material';canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  let w=1,h=1,dead=false,measureAt=-1,ledges=[],groups=[],bolt=[],boltAt=-10;
  const rain=true;
  const drops=Array.from({length:rain?(mobile?150:300):0},()=>({x:Math.random(),y:Math.random(),z:rand(.2,1),vx:0,vy:0,seed:rand(0,TAU)}));
  detail.track(drops);
  const impacts=[],lenses=[];
  const lensLayer=document.createElement('div');lensLayer.className='pd-weather-lenses';
  const optics=document.createElementNS('http://www.w3.org/2000/svg','svg');optics.setAttribute('width','0');optics.setAttribute('height','0');optics.setAttribute('aria-hidden','true');
  optics.innerHTML='<defs><filter id="pd-weather-drop-optics" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".15 .23" numOctaves="1" seed="7" result="surface"/><feDisplacementMap in="SourceGraphic" in2="surface" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="pd-weather-water-optics" x="-4%" y="-12%" width="108%" height="124%"><feTurbulence type="fractalNoise" baseFrequency=".02 .09" numOctaves="1" seed="4" result="current"/><feDisplacementMap in="SourceGraphic" in2="current" scale=".9" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
  lensLayer.append(optics);
  if(rain)for(let i=0;i<(mobile?6:10);i++){
   const el=document.createElement('i');el.className='pd-weather-lens';lensLayer.append(el);
   lenses.push({el,x:rand(.03,.97),y:Math.random(),radius:rand(2,4),speed:0,phase:rand(0,TAU)});
  }
  function measure(t){
   if(t<measureAt)return;measureAt=t+.7;
   const pr=panel.getBoundingClientRect(),sx=w/Math.max(pr.width,1),sy=h/Math.max(pr.height,1);
   ledges=Array.from(panel.querySelectorAll('.stat-card,.bubble-section,.source-trust-card,.pd-header-row'),el=>{const r=el.getBoundingClientRect();return {x:(r.left-pr.left)*sx,y:(r.top-pr.top)*sy,width:r.width*sx};}).filter(r=>r.y>10&&r.y<h-8);
  }
  function resize(width,height){w=width;h=height;const dpr=Math.min(devicePixelRatio||1,mobile?1:1.35)*detail.resolution;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);measureAt=-1;}
  function splash(x,y,force){if(impacts.length<detail.count(mobile?45:85))impacts.push({x,y,life:0,force,seed:rand(0,TAU)});}
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
  function draw(t,dt,envelope,current){
   if(dead)return;measure(t);ctx.clearRect(0,0,w,h);
   const pressure=current.pressure||0,flash=current.flash||0;
   if(rain){precipitation(t,dt,pressure,flash,envelope);if(cfg.type==='storm')lightning(t,flash);}
  }
  function destroy(){dead=true;canvas.remove();lensLayer.remove();for(const el of panel.querySelectorAll('.pd-water-submerged'))el.classList.remove('pd-water-submerged');for(const g of groups){g.el.classList.remove('pd-water-submerged');g.letters.forEach(el=>{el.style.removeProperty('transform');el.style.removeProperty('opacity');});}impacts.length=0;groups=[];ledges=[];}
  return {canvas,lensLayer,resize,draw,destroy};
 }
 window.CardWeatherPhysics={create};
})();
