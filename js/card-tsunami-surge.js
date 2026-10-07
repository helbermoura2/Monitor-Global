/* Illustrative hydraulic bore. No video, measured depth or event simulation.
   One continuous water field drives the surface, spray, glass and real glyphs. */
(function(){
 'use strict';
 const TAU=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),rand=(a,b)=>a+Math.random()*(b-a);
 function front(t,x=.5){return .51+.40*Math.sin(t*.53-.95)+.035*Math.sin(x*7.1+t*.37)+.013*Math.sin(x*19.3-t*.62);}
 function flow(t,y,x=.5){const d=y-front(t,x),crest=Math.exp(-d*d*230),behind=1/(1+Math.exp(d*35));return {crest,wet:behind,force:.18+.53*crest+.22*behind,front:front(t,x)};}
 const vertex='attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}';
 const fragment=`
 #ifdef GL_FRAGMENT_PRECISION_HIGH
 precision highp float;
 #else
 precision mediump float;
 #endif
 varying vec2 vUV;uniform vec2 uSize;uniform float uTime,uStrength;
 float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(2.7,8.1);a*=.5;}return v;}
 float bore(float x){return .51+.40*sin(uTime*.53-.95)+.035*sin(x*7.1+uTime*.37)+.013*sin(x*19.3-uTime*.62);}
 vec2 current(vec2 p){
  float depth=.28+p.y*.72;vec2 q=vec2((p.x-.5)*uSize.x/uSize.y,p.y)*vec2(7.,6.);
  q/=depth;q.y-=uTime*1.05;q.x+=uTime*.12;
  vec2 curl=vec2(fbm(q*.65),fbm(q*.65+vec2(8.2,3.7)))-.5;
  return q+curl*(.85+uStrength*.60);
 }
 vec2 surface(vec2 p){
  vec2 q=current(p);float mass=fbm(q),chop=noise(q*3.7),d=p.y-bore(p.x);
  float crest=exp(-d*d*230.);float wake=1.-smoothstep(-.035,.12,d);
  // A steep front, recirculating trailing cells and short capillary chop.
  float height=.10*mass+.018*chop+crest*(.19+.10*mass)+wake*.035;
  return vec2(height,mass);
 }
 void main(){
  vec2 p=vec2(vUV.x,1.-vUV.y);vec2 q=current(p);vec2 field=surface(p);
  float eps=.004;float hx=surface(p+vec2(eps,0.)).x,hy=surface(p+vec2(0.,eps)).x;
  vec3 n=normalize(vec3((field.x-hx)*22.,(field.x-hy)*18.,.24));
  vec3 eye=normalize(vec3(0.,-.48,1.)),light=normalize(vec3(-.55,-.62,1.));
  float fresnel=.055+.72*pow(1.-max(dot(n,eye),0.),4.);
  float spec=pow(max(dot(reflect(-light,n),eye),0.),38.);
  float d=p.y-bore(p.x),crest=exp(-d*d*230.),wake=1.-smoothstep(-.05,.14,d);
  float cells=fbm(q*2.5+vec2(3.1,7.8)),fine=noise(q*19.);
  // Broken cellular foam, never evenly spaced wave stripes or surf curls.
  float foam=smoothstep(.41,.68,cells+crest*.39+wake*.055+fine*.075);
  float veins=1.-smoothstep(.018,.066,abs(cells-.50));
  foam=max(foam,veins*crest*.67)*(.16+crest*.83+wake*.37);
  float shadow=clamp(.67+(field.x-hy)*11.,.34,1.);
  vec3 water=mix(vec3(.033,.063,.060),vec3(.19,.225,.186),field.y);
  water*=shadow*(.65+.35*max(dot(n,light),0.));
  vec3 reflected=mix(vec3(.19,.24,.25),vec3(.50,.54,.53),fbm(q*.32+vec2(2.4,1.7)));
  water=mix(water,reflected,fresnel*.64)+vec3(.52,.58,.57)*spec*.26;
  water=mix(water,vec3(.68,.71,.65)*(.64+fine*.28),clamp(foam,0.,.94));
  // The upstream face casts a soft shadow below the turbulent lip.
  water*=1.-exp(-pow((d-.052)*18.,2.))*.30;
  water+=vec3(.033,.034,.027)*noise(q*43.);
  water=mix(water,vec3(.29,.33,.33),.035+crest*.045);
  gl_FragColor=vec4(water,1.);
 }`;
 // A coherent CPU water field is also used when WebGL is unavailable or lost.
 const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
 function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let a=x-ix,b=y-iy;a=a*a*(3-2*a);b=b*b*(3-2*b);return (hash(ix,iy)*(1-a)+hash(ix+1,iy)*a)*(1-b)+(hash(ix,iy+1)*(1-a)+hash(ix+1,iy+1)*a)*b;}
 function fbm(x,y){return noise(x,y)*.57+noise(x*2.17+8.3,y*2.17+1.2)*.28+noise(x*4.71+2.8,y*4.71+5.1)*.15;}
 function create(cfg,mobile,panel){
  if(cfg.type!=='tsunami')return null;
  const canvas=document.createElement('canvas');canvas.className='pd-weather-material pd-tsunami-contact';canvas.setAttribute('aria-hidden','true');const ctx=canvas.getContext('2d');if(!ctx)return null;
  let background=document.createElement('canvas');background.className='pd-tsunami-surface';background.setAttribute('aria-hidden','true');
  const lensLayer=document.createElement('div');lensLayer.className='pd-weather-lenses pd-tsunami-lenses';lensLayer.setAttribute('aria-hidden','true');
  let gl,program,buffer,shaders=[],uniforms,cpuctx,cpuframe,w=1,h=1,dead=false,last=-Infinity,measureAt=-1,groups=[],ledges=[],state={x:0,vx:0,y:0,vy:0,r:0,vr:0},strength=cfg.strength||.7;
  const dynamics=new WeakMap(),spray=[],debris=Array.from({length:mobile?18:30},()=>({x:rand(-.1,1.1),y:Math.random(),z:rand(.2,1),angle:rand(0,TAU),spin:rand(-1.7,1.7),size:rand(3,11)}));
  const drops=Array.from({length:mobile?5:8},()=>{const el=document.createElement('i');el.className='pd-tsunami-drop';lensLayer.append(el);return {el,x:rand(.02,.98),y:Math.random(),size:rand(1.4,3.2),speed:rand(10,25)};});
  function disposeGL(){if(!gl)return;for(const s of shaders)gl.deleteShader(s);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);shaders=[];program=buffer=null;}
  function useCPU(){
   disposeGL();if(gl){const next=document.createElement('canvas');next.className=background.className;next.setAttribute('aria-hidden','true');background.removeEventListener('webglcontextlost',lost);background.replaceWith(next);background=next;gl=null;}
   cpuctx=background.getContext('2d',{alpha:false});background.dataset.renderer='hydraulic-bore-2d';background.parentElement?.setAttribute('data-renderer',background.dataset.renderer);resize(w,h);
  }
  function lost(e){e.preventDefault();if(!dead)useCPU();}
  try{
   gl=background.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'});if(!gl)throw Error('2D');
   function compile(type,source){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
   program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
   uniforms={size:gl.getUniformLocation(program,'uSize'),time:gl.getUniformLocation(program,'uTime'),strength:gl.getUniformLocation(program,'uStrength')};background.dataset.renderer='hydraulic-bore-webgl';background.addEventListener('webglcontextlost',lost);
  }catch(error){useCPU();}
  function resize(width,height){
   w=width;h=height;const dpr=Math.min(devicePixelRatio||1,mobile?1:1.35);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
   const scale=Math.min(1,(gl?(mobile?192:256):(mobile?90:112))/Math.max(w,1),(gl?(mobile?384:512):240)/Math.max(h,1));background.width=Math.max(1,Math.round(w*scale));background.height=Math.max(1,Math.round(h*scale));if(gl)gl.viewport(0,0,background.width,background.height);else if(cpuctx)cpuframe=cpuctx.createImageData(background.width,background.height);last=-Infinity;measureAt=-1;surface(0,true);
  }
  function surface(t,force=false){
   if(dead||!force&&t-last<(gl?(mobile?1/18:1/24):1/12))return;last=t;
   if(gl){if(gl.isContextLost())return;gl.uniform2f(uniforms.size,w,h);gl.uniform1f(uniforms.time,t);gl.uniform1f(uniforms.strength,strength);gl.drawArrays(gl.TRIANGLES,0,6);background.dataset.time=t.toFixed(3);return;}
   if(!cpuctx||!cpuframe)return;const bw=background.width,bh=background.height,data=cpuframe.data;
   for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){
    const px=x/bw,py=y/bh,depth=.28+py*.72,qx=(px-.5)*w/h*7/depth+t*.12,qy=py*6/depth-t*1.05;
    const curl=fbm(qx*.65,qy*.65)-.5,mass=fbm(qx+curl,qy-curl),cell=fbm(qx*2.5+3.1,qy*2.5+7.8),fine=noise(qx*19,qy*19),d=py-front(t,px),crest=Math.exp(-d*d*230),wake=1/(1+Math.exp(d*35));
    const foam=clamp((cell+crest*.39+wake*.055+fine*.075-.41)/.27,0,1)*(.16+crest*.83+wake*.37);
    const shade=1-Math.exp(-Math.pow((d-.052)*18,2))*.30,white=(.64+fine*.28)*shade,i=(y*bw+x)*4;
    data[i]=((8+mass*46)*shade*(1-foam)+174*white*foam);data[i+1]=((16+mass*48)*shade*(1-foam)+181*white*foam);data[i+2]=((15+mass*39)*shade*(1-foam)+166*white*foam);data[i+3]=255;
   }
   cpuctx.putImageData(cpuframe,0,0);background.dataset.time=t.toFixed(3);
  }
  function spring(p,key,v,target,dt,k=65,damping=12){p[v]+=((target-p[key])*k-p[v]*damping)*dt;p[key]+=p[v]*dt;}
  function measure(t){
   if(t<measureAt)return;measureAt=t+.7;for(const g of groups)for(const l of g.letters)l.el.style.removeProperty('transform');const pr=panel.getBoundingClientRect(),sx=w/Math.max(pr.width,1),sy=h/Math.max(pr.height,1);
   groups=Array.from(panel.querySelectorAll('[data-cyclone-text]'),el=>{const r=el.getBoundingClientRect();el.classList.add('pd-water-submerged');const letters=Array.from(el.querySelectorAll('.pd-fx-windletter'),span=>{const rr=span.getBoundingClientRect();let l=dynamics.get(span);if(!l){l={el:span,x:0,vx:0,y:0,vy:0,r:0,vr:0};dynamics.set(span,l);}l.left=Math.max(0,(rr.left-pr.left)*sx-10);l.right=Math.max(0,w-10-(rr.right-pr.left)*sx);return l;});return {el,title:el.id==='pd-local',y:clamp((r.top-pr.top)*sy/h,0,1),letters};});
   ledges=Array.from(panel.querySelectorAll('.stat-card,.bubble-section,.pd-header-row'),el=>{const r=el.getBoundingClientRect();return {x:(r.left-pr.left)*sx,y:(r.top-pr.top)*sy,width:r.width*sx};});
  }
  function load(t,dt,envelope,current=cfg){
   if(dead)return {pressure:0,travel:0};strength=.65+.35*(current.strength||.7);measure(t);const mid=flow(t,.54),force=mid.force*strength*envelope,impact=mid.crest*strength;
   spring(state,'x','vx',Math.sin(t*3.7)*impact*(mobile?1.5:2.7),dt);spring(state,'y','vy',(1.6+3.8*impact)*envelope,dt);spring(state,'r','vr',Math.sin(t*2.1)*impact*.28,dt);
   panel.style.setProperty('--pd-surge-x',state.x.toFixed(3)+'px');panel.style.setProperty('--pd-surge-y',state.y.toFixed(3)+'px');panel.style.setProperty('--pd-surge-roll',state.r.toFixed(3)+'deg');panel.style.setProperty('--pd-surge-load',force.toFixed(3));
   for(const g of groups)g.letters.forEach((l,i)=>{const f=i/Math.max(1,g.letters.length-1),local=flow(t,g.y,.15+f*.7),ripple=Math.sin(t*4.3-f*7-g.y*9),amp=(g.title?1:0.35)*strength*envelope;
    spring(l,'x','vx',clamp((ripple*(local.wet*2+local.crest*7)+local.crest*(f-.5)*12)*amp,-l.left,l.right),dt);
    spring(l,'y','vy',(local.crest*(g.title?17:10)+local.wet*(2+Math.cos(t*3-f*8)*1.3))*amp,dt,55,11.5);
    spring(l,'r','vr',(ripple*local.crest*10+Math.sin(t*2-f*6)*local.wet*2)*amp,dt,50,11);
    l.el.style.transform='translate3d('+l.x.toFixed(2)+'px,'+l.y.toFixed(2)+'px,0) rotate('+l.r.toFixed(2)+'deg) skewX('+(ripple*local.wet*amp*2).toFixed(2)+'deg)';
   });return {pressure:force,travel:t*1.05};
  }
  function draw(t,dt,envelope){
   if(dead)return;surface(t);ctx.clearRect(0,0,w,h);
   // Foam spray has ballistic flight; thin glints cross the data, not a second sea.
   for(let i=0;i<(mobile?2:3);i++)if(spray.length<(mobile?90:150)){
    const x=rand(-.03,1.03),y=front(t,x)*h;spray.push({x:x*w,y,vx:rand(-65,65),vy:rand(-115,-25),life:0,ttl:rand(.4,.9),z:rand(.2,1)});
   }
   for(let i=spray.length-1;i>=0;i--){const s=spray[i];s.life+=dt;if(s.life>s.ttl){spray.splice(i,1);continue;}s.vy+=dt*220;const old=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;
    for(const r of ledges)if(old<r.y&&s.y>=r.y&&s.x>r.x&&s.x<r.x+r.width&&s.vy>0){s.vy=-s.vy*.26;s.vx*=.7;break;}
    ctx.strokeStyle='rgba(226,233,222,'+((1-s.life/s.ttl)*(.08+s.z*.27)*envelope).toFixed(3)+')';ctx.lineWidth=.35+s.z*.75;ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(s.x-s.vx*.008,s.y-s.vy*.008);ctx.stroke();
   }
   for(const p of debris){const local=flow(t,p.y,p.x),speed=(.035+local.wet*.12+local.crest*.12)*(.3+p.z*.7);p.y+=dt*speed;p.x+=dt*Math.sin(t*.7+p.angle)*speed*.33;p.angle+=dt*p.spin*local.force;if(p.y>1.05||p.x>1.1||p.x<-.1){p.y=-.06;p.x=Math.random();}
    const opacity=envelope*(.12+local.wet*.28)*p.z;ctx.save();ctx.translate(p.x*w,p.y*h);ctx.rotate(p.angle);ctx.globalAlpha=opacity;const size=p.size*(.45+p.y*.65);const grad=ctx.createLinearGradient(0,-size*.25,0,size*.25);grad.addColorStop(0,'#9b937a');grad.addColorStop(.45,'#554e39');grad.addColorStop(1,'#252c24');ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(-size,-size*.15);ctx.lineTo(size*.8,-size*.22);ctx.lineTo(size,size*.15);ctx.lineTo(-size*.65,size*.25);ctx.closePath();ctx.fill();ctx.restore();
   }
   for(const d of drops){d.y+=dt*d.speed/h;d.x+=dt*Math.sin(t+d.size)*.002;if(d.y>1.06){d.y=-.05;d.x=rand(.02,.98);}const local=flow(t,d.y,d.x);d.el.style.transform='translate3d('+(d.x*w).toFixed(1)+'px,'+(d.y*h).toFixed(1)+'px,0)';d.el.style.width=(d.size*2).toFixed(1)+'px';d.el.style.height=(d.size*2+d.speed*.12).toFixed(1)+'px';d.el.style.opacity=(envelope*(.2+local.crest*.7+local.wet*.2)).toFixed(3);}
   ctx.globalAlpha=1;lensLayer.style.opacity=envelope.toFixed(3);
  }
  function destroy(){if(dead)return;dead=true;background.removeEventListener('webglcontextlost',lost);disposeGL();gl?.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();background.remove();lensLayer.remove();for(const g of groups){g.el.classList.remove('pd-water-submerged');for(const l of g.letters)l.el.style.removeProperty('transform');}for(const k of ['--pd-surge-x','--pd-surge-y','--pd-surge-roll','--pd-surge-load'])panel.style.removeProperty(k);spray.length=debris.length=groups.length=ledges.length=0;cpuframe=null;}
  return {canvas,lensLayer,get background(){return background;},resize,load,draw,destroy};
 }
 window.CardTsunamiSurge={create,front,flow};
})();
