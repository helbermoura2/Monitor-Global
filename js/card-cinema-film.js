/* Procedural illustrations: volumetric clouds, fire and water in the card's hero.
   These scenes never claim to be footage of the event or change its measurements. */
(function(){
 'use strict';
 const modes={storm:0,hurricane:1,tornado:2,fire:3,volcano:4,flood:5,tsunami:6,wind:7};
 const vertex=`attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
 const fragment=`
 precision mediump float;
 varying vec2 vUV;
 uniform vec2 uResolution;
 uniform vec2 uHero;
 uniform vec2 uActivity;
 uniform float uTime,uMode,uStrength,uLightning,uFootage;
 float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(1.7,9.2);a*=.5;}return v;}
 float cloud(vec2 p){vec2 warp=vec2(fbm(p+uTime*.021),fbm(p+vec2(4.2,1.3)-uTime*.016));return fbm(p+warp*2.3);}
 vec4 over(vec4 a,vec4 b){float alpha=a.a+b.a*(1.-a.a);return vec4((a.rgb*a.a+b.rgb*b.a*(1.-a.a))/max(alpha,.001),alpha);}
 vec4 vapor(vec2 p,float mass,vec3 light){
  float n=cloud(p),density=smoothstep(.27,.73,n)*mass;
  float rim=clamp((n-cloud(p+vec2(.055,.09)))*5.+.36,.12,.95);
  return vec4(mix(vec3(.065,.085,.12),light,rim),density);
 }
 vec4 flame(vec2 p,float amount){
  float distortion=fbm(vec2(p.x*3.1,p.y*2.8-uTime*.68));
  float fuel=fbm(vec2(p.x*4.3+distortion*.8,p.y*4.6-uTime*1.1));
  float height=.32+.72*fbm(vec2(p.x*5.7+distortion*1.5,-uTime*.25));
  float body=smoothstep(height+.025,height-.10,p.y);
  float intensity=clamp((height-p.y)*1.8+(fuel-.42)*.8,0.,1.);
  float shape=smoothstep(-.15,.02,p.y)*(1.-smoothstep(.9,1.2,p.y));
  float core=pow(clamp(intensity*1.2,0.,1.),4.);
  vec3 color=mix(vec3(.68,.07,.009),vec3(1.,.40,.027),smoothstep(.10,.8,intensity));
  color=mix(color,vec3(1.,.91,.61),core*.82);
  return vec4(color,body*shape*amount*smoothstep(.025,.32,intensity));
 }
 vec4 water(vec2 p,bool surge){
  float phase=mod(uTime,12.);
  float advance=surge?(phase<2.?-phase*.013:phase<7.?(phase-2.)*.03:.15*(12.-phase)/5.):0.;
  float line=.60+advance+.018*sin(p.x*7.+uTime*.7)+.009*sin(p.x*17.-uTime);
  float fill=1.-smoothstep(line-.01,line+.013,p.y);
  float depth=clamp(line-p.y,0.,1.);
  vec2 ocean=vec2((p.x-.5)*(1.+depth*2.4),depth*4.5);
  vec2 grad=vec2(0.);float crest=0.;
  for(int i=0;i<5;i++){
   float k=float(i)+1.,angle=k*1.24,frequency=10.+k*9.;vec2 direction=vec2(cos(angle),sin(angle));
   float theta=dot(ocean,direction)*frequency+uTime*(.46+k*.19);
   grad+=direction*cos(theta)*(.16/k);crest+=sin(theta)*(.10/k);
  }
  vec3 normal=normalize(vec3(grad.x,1.,grad.y));
  float spec=pow(max(dot(normal,normalize(vec3(.24,1.,.3))),0.),38.);
  float reflection=fbm(ocean*8.+vec2(uTime*.17,-uTime*.11));
  vec3 color=mix(vec3(.025,.115,.17),vec3(.16,.40,.47),reflection*.65+crest*.8);
  color+=vec3(.67,.87,.90)*spec*.65;
  float foam=exp(-abs(p.y-line)*180.)*(.20+.50*noise(vec2(p.x*100.+uTime*3.,uTime*.8)));
  if(surge)color=mix(color,vec3(.84,.94,.92),foam);
  float caustics=pow(abs(sin(ocean.x*55.+crest*12.)*sin(ocean.y*44.-uTime*.4)),12.);
  color+=vec3(.16,.31,.32)*caustics*.3;
  return vec4(color,fill*(.64+spec*.19)+foam*.22);
 }
 void main(){
  vec2 uv=vUV;float aspect=uResolution.x/uResolution.y;
  float hero=exp(-pow(abs((uv.y-uHero.x)/max(uHero.y*.63,.03)),4.));
  float edge=1.-smoothstep(.025,.17,min(uv.x,1.-uv.x));
  float margin=smoothstep(.015,.12,uv.y)*(1.-smoothstep(.86,.98,uv.y));
  float coverage=max(hero*.94,edge*.46*margin);
  if(coverage<.005){gl_FragColor=vec4(0.);return;}
  vec2 local=vec2(uv.x,(uv.y-uHero.x)/max(uHero.y,.06)+.5);
  vec4 scene=vec4(.012,.028,.043,.26);
  if(uMode<.5){
   vec2 p=vec2(uv.x*3.9,uv.y*4.8)+vec2(uTime*.036,-uTime*.018);
   scene=over(vapor(p,mix(.87,.18,uFootage),vec3(.63,.72,.80)),scene);
   float phase=mod(uTime,10.);float flash=exp(-pow((phase-.61)*23.,2.))+exp(-pow((phase-4.30)*26.,2.))+exp(-pow((phase-8.3)*24.,2.));
   scene.rgb+=vec3(.44,.57,.72)*flash*uLightning;
  }else if(uMode<1.5){
   vec2 center=vec2((uv.x-.5)*aspect,(uv.y-uHero.x));float r=length(center)/max(uHero.y,.05),a=atan(center.y,center.x);
   float bands=cloud(vec2(r*5.8,a*1.15+r*9.-uTime*.68));float eye=smoothstep(.10,.22,r);
   float ring=(1.-smoothstep(.60,.85,r))*eye;
   vec3 color=mix(vec3(.06,.095,.14),vec3(.63,.70,.76),bands*.88);
   scene=over(vec4(color,ring*smoothstep(.23,.67,bands)*.94),vapor(vec2(uv.x*4.-uTime*.25,uv.y*7.),.67,vec3(.40,.54,.66)));
  }else if(uMode<2.5){
   float y=clamp(local.y,0.,1.);float axis=.5+sin(y*4.+uTime*.58)*.045;
   float radius=mix(.024,.19,pow(y,.8));float radial=(local.x-axis)/radius;
   float body=1.-smoothstep(.63,1.18,abs(radial));
   float swirl=cloud(vec2(radial*1.9+sin(y*18.-uTime*4.)*.38,y*6.-uTime*.43));
   float light=.20+.50*sqrt(max(0.,1.-radial*radial));
   vec3 color=mix(vec3(.095,.10,.12),vec3(.55,.59,.62),light+swirl*.22);
   float root=smoothstep(-.05,.12,local.y)*(1.-smoothstep(.87,1.08,local.y));
   scene=over(vec4(color,body*root*(.51+swirl*.39)),vapor(vec2(uv.x*4.-uTime*.1,uv.y*6.),.54,vec3(.39,.46,.51)));
  }else if(uMode<3.5){
   scene=over(vapor(vec2(uv.x*5.+sin(uTime*.2)*.2,uv.y*5.-uTime*.21),.67,vec3(.48,.43,.38)),scene);
   scene=over(flame(vec2(local.x,local.y*.95),.88*hero*(1.-uFootage)),scene);
   float side=1.-smoothstep(.018,.13,min(uv.x,1.-uv.x));
   scene=over(flame(vec2(uv.x*2.7,uv.y*1.6),side*.7),scene);
  }else if(uMode<4.5){
   float mountain=.60-pow(abs(local.x-.5),.74)*.61+noise(vec2(local.x*31.,.3))*.025;
   mountain-=exp(-pow((local.x-.5)*21.,2.))*.058;
   float rock=(1.-smoothstep(mountain-.006,mountain+.007,local.y))*smoothstep(-.15,.04,local.y);
   float texture=fbm(vec2(local.x*18.,local.y*13.));
   float relief=clamp(.38+(texture-fbm(vec2(local.x*18.,local.y*13.)+vec2(.02,.04)))*8.,.06,1.);
   vec3 color=mix(vec3(.045,.060,.070),vec3(.38,.39,.36),relief)*(.6+.5*texture);
   float crater=exp(-pow((local.x-.5)*21.,2.)-pow((local.y-.51)*34.,2.));
   color+=vec3(.96,.26,.025)*crater*uActivity.x*(.8+.16*sin(uTime*3.));
   scene=over(vec4(color,rock*.88),scene);
   if(uActivity.y>.5){
    float plume=exp(-pow((local.x-.5)/(max(local.y,.05)*.27+.03),2.));
    vec4 ash=vapor(vec2(local.x*7.+sin(local.y*8.-uTime)*.2,local.y*7.-uTime*.35),.88,vec3(.56,.55,.52));
    ash.a*=plume*smoothstep(.48,.60,local.y)*(1.-uFootage*.75);scene=over(ash,scene);
   }else{scene=over(vapor(vec2(uv.x*4.-uTime*.025,uv.y*6.),.25,vec3(.39,.48,.52)),scene);}
  }else if(uMode<6.5){
   if(uFootage<.5)scene=over(water(local,uMode>5.5),scene);
   // A distant, textured reflection above the surface preserves the glass.
   scene=over(vapor(vec2(uv.x*3.+uTime*.03,uv.y*5.),.12,vec3(.36,.50,.58)),scene);
  }else{
   scene=over(vapor(vec2(uv.x*2.-uTime*.55,uv.y*18.),.75,vec3(.56,.64,.66)),scene);
  }
  float vignette=1.-smoothstep(.32,.60,abs(uv.x-.5));
  scene.rgb*=.85+.15*vignette;
  float opacity=clamp(scene.a*coverage,0.,.90);
  gl_FragColor=vec4(scene.rgb,opacity);
 }
 `;
 function create(cfg,mobile){
  if(!(cfg.type in modes))return null;
  const canvas=document.createElement('canvas');canvas.className='pd-cinema-film';
  const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  if(!gl)return null;
  let program,buffer,shaders=[],dead=false;
  function destroy(){if(dead)return;dead=true;if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);for(const s of shaders)gl.deleteShader(s);gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();}
  try{
   function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);shaders.push(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
   program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
   const uniforms={};for(const key of ['Resolution','Hero','Activity','Time','Mode','Strength','Lightning','Footage'])uniforms[key]=gl.getUniformLocation(program,'u'+key);
   let last=-Infinity,hero=[.65,.23],width=1,height=1;
   function resize(w,h,center,heroHeight){width=w;height=h;hero=[1-center/h,heroHeight/h];const scale=Math.min(1,(mobile?176:240)/Math.max(w,1),(mobile?360:480)/Math.max(h,1));canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));gl.viewport(0,0,canvas.width,canvas.height);}
   function draw(t,current,lightning,footage){if(dead||gl.isContextLost()||t-last<(mobile?1/14:1/20))return;last=t;gl.uniform2f(uniforms.Resolution,width,height);gl.uniform2fv(uniforms.Hero,hero);gl.uniform2f(uniforms.Activity,current.hot?1:0,current.ash?1:0);gl.uniform1f(uniforms.Time,t);gl.uniform1f(uniforms.Mode,modes[current.type]);gl.uniform1f(uniforms.Strength,current.strength);gl.uniform1f(uniforms.Lightning,lightning?1:0);gl.uniform1f(uniforms.Footage,footage?1:0);gl.drawArrays(gl.TRIANGLES,0,6);}
   return {canvas,resize,draw,destroy};
  }catch(error){destroy();console.warn('[CardCinema] Cena gráfica indisponível; usando camadas 2D.',error.message);return null;}
 }
 function footage(cfg){
  if(!(cfg.type in modes))return null;
  const key=cfg.type==='fire'?'fire':cfg.type==='flood'?'water':cfg.type==='tsunami'?'surge':cfg.type==='volcano'&&(cfg.ash||cfg.hot)?'smoke':cfg.type==='storm'?'storm':'clouds';
  const video=document.createElement('video');video.className='pd-cinema-footage';video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='metadata';video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.src='media/card-fx/'+key+'.mp4';
  let failed=false,dead=false,playing=false,wanted=false;
  function play(){wanted=true;if(document.hidden)return;if(dead||failed||playing||!video.paused)return;playing=true;video.play().then(()=>{playing=false;if(!wanted||document.hidden)video.pause();}).catch(error=>{playing=false;if(error?.name!=='AbortError')failed=true;});}
  function pause(){wanted=false;video.pause();}
  function resize(w,h,center,size){video.style.top=Math.max(0,center-size*.78)+'px';video.style.height=Math.max(110,size*1.56)+'px';}
  function destroy(){dead=true;pause();video.removeAttribute('src');video.load();video.remove();}
  video.addEventListener('error',()=>{failed=true;});video.addEventListener('loadeddata',()=>{if(wanted&&!document.hidden)play();});
  return {video,play,pause,resize,destroy,isReady:()=>!failed&&video.readyState>=2&&!video.paused};
 }
 window.CardCinemaFilm={create,footage};
})();
