/* Procedural illustrations: clouds, fire and water across the entire card.
   These scenes never claim to be footage of the event or change its measurements. */
(function(){
 'use strict';
 const modes={storm:0,hurricane:1,tornado:2,fire:3,volcano:4,flood:5,tsunami:6,wind:7};
 const vertex=`attribute vec2 aPosition;varying vec2 vUV;void main(){vUV=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
 const fragment=`
 #ifdef GL_FRAGMENT_PRECISION_HIGH
 precision highp float;
 #else
 precision mediump float;
 #endif
 varying vec2 vUV;
 uniform vec2 uResolution;

 uniform vec2 uActivity;
 uniform float uTime,uMode,uStrength,uLightning,uFootage,uLava;
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
 vec4 lava(vec2 uv){
  vec2 p=vec2(uv.x*4.,uv.y*5.-uTime*.055);
  vec2 warp=vec2(fbm(p*1.5+vec2(0.,uTime*.025)),fbm(p*1.2+vec2(6.,-uTime*.035)));
  float crust=fbm(p+warp*1.6),grain=noise(p*32.);
  float seams=1.-smoothstep(.016,.085,abs(crust-.48));
  float heat=clamp(seams*(.65+.35*fbm(p*2.-uTime*.025)),0.,1.);
  vec3 rock=mix(vec3(.023,.019,.017),vec3(.12,.075,.045),crust*.65+grain*.15);
  vec3 molten=mix(vec3(.85,.085,.006),vec3(1.,.65,.12),pow(heat,2.));
  vec3 color=mix(rock,molten,heat);
  color+=vec3(.17,.035,.004)*seams;
  return vec4(color,.88);
 }
 vec4 river(vec2 uv){
  vec2 p=vec2(uv.x*4.+uTime*.28,uv.y*6.-uTime*.35);
  vec2 curl=vec2(fbm(p+vec2(uTime*.08,0.)),fbm(p+vec2(4.,uTime*.1)));
  float surface=fbm(p+curl*2.5),detail=noise(p*26.+curl*4.);
  float gx=surface-fbm(p+vec2(.04,0.)+curl*2.5),gy=surface-fbm(p+vec2(0.,.04)+curl*2.5);
  vec3 normal=normalize(vec3(gx*13.,gy*13.,1.));
  float spec=pow(max(dot(normal,normalize(vec3(-.3,.5,1.))),0.),28.);
  float foam=smoothstep(.61,.74,surface)*smoothstep(.3,.8,detail);
  vec3 color=mix(vec3(.085,.057,.035),vec3(.42,.32,.19),surface);
  color+=vec3(.52,.48,.39)*spec*.46;
  color=mix(color,vec3(.69,.67,.57),foam*.7);
  return vec4(color,.76);
 }
 void main(){
  vec2 uv=vUV;float aspect=uResolution.x/uResolution.y;
  // A continuous scene across the viewport, including the area behind the data.
  // Local dark surfaces in CSS preserve readability rather than masking the scene.
  float coverage=.91+.09*smoothstep(0.,.15,min(uv.x,1.-uv.x));
  vec2 local=uv;
  vec4 scene=vec4(.012,.028,.043,.26);
  if(uMode<.5){
   vec2 p=vec2(uv.x*3.9,uv.y*4.8)+vec2(uTime*.036,-uTime*.018);
   scene=over(vapor(p,mix(.82,.27,uFootage),vec3(.63,.72,.80)),scene);
   scene.rgb*=.78+.22*cloud(p+vec2(1.7,3.1));
   float phase=mod(uTime,10.);float flash=exp(-pow((phase-.61)*23.,2.))+exp(-pow((phase-4.30)*26.,2.))+exp(-pow((phase-8.3)*24.,2.));
   scene.rgb+=vec3(.44,.57,.72)*flash*uLightning;
  }else if(uMode<1.5){
   vec2 center=vec2((uv.x-.5)*aspect,uv.y-.53);float r=length(center)/max(aspect*.48,.18),a=atan(center.y,center.x);
   float bands=cloud(vec2(r*5.8,a*1.15+r*9.-uTime*(.45+.42*uStrength)));float eye=smoothstep(.10,.22,r);
   float ring=(1.-smoothstep(.60,.85,r))*eye;
   vec3 color=mix(vec3(.06,.095,.14),vec3(.63,.70,.76),bands*.88);
   float shadow=cloud(vec2(r*8.,a*2.+r*13.-uTime*.45));color*=.68+.32*shadow;
   scene=over(vec4(color,ring*smoothstep(.23,.67,bands)*mix(.94,.43,uFootage)),vapor(vec2(uv.x*4.-uTime*.25,uv.y*7.),mix(.67,.24,uFootage),vec3(.40,.54,.66)));
  }else if(uMode<2.5){
   float y=clamp(local.y,0.,1.);float axis=.5+sin(y*4.+uTime*.58)*.045;
   float radius=mix(.024,.19,pow(y,.8));float radial=(local.x-axis)/radius;
   float body=1.-smoothstep(.63,1.18,abs(radial));
   float swirl=cloud(vec2(radial*1.9+sin(y*18.-uTime*4.)*.38,y*6.-uTime*(.35+.28*uStrength)));
   float light=.20+.50*sqrt(max(0.,1.-radial*radial));
   vec3 color=mix(vec3(.095,.10,.12),vec3(.55,.59,.62),light+swirl*.22);
   float root=smoothstep(-.05,.12,local.y)*(1.-smoothstep(.87,1.08,local.y));
   float filament=fbm(vec2(radial*9.-uTime,y*18.+uTime*.6));color*=.67+.33*filament;
   scene=over(vec4(color,body*root*(.51+swirl*.39)*mix(1.,.22,uFootage)),vapor(vec2(uv.x*4.-uTime*.1,uv.y*6.),mix(.54,.13,uFootage),vec3(.39,.46,.51)));
  }else if(uMode<3.5){
   scene=over(vapor(vec2(uv.x*5.+sin(uTime*.2)*.2,uv.y*5.-uTime*.21),mix(.67,.27,uFootage),vec3(.48,.43,.38)),scene);
   scene=over(flame(vec2(local.x,local.y*.95),.88*(1.-uFootage)),scene);
   float side=1.-smoothstep(.018,.13,min(uv.x,1.-uv.x));
   scene=over(flame(vec2(uv.x*2.7,uv.y*1.6),side*mix(.7,.26,uFootage)),scene);
   float bounce=(.035+.045*fbm(vec2(uv.x*5.,uv.y*4.-uTime*.5)))*(1.-smoothstep(.05,.65,uv.y));
   scene.rgb+=vec3(1.,.22,.025)*bounce;
  }else if(uMode<4.5){
   if(uLava>.5){
    scene=uFootage>.5?vec4(.11,.018,.003,.13):lava(local);
    scene=over(vapor(vec2(uv.x*6.,uv.y*7.-uTime*.19),mix(.25,.09,uFootage),vec3(.42,.28,.16)),scene);
   }else if(uFootage>.5&&uActivity.x<.5&&uActivity.y<.5){
    scene=over(vapor(vec2(uv.x*4.-uTime*.025,uv.y*6.),.12,vec3(.39,.48,.52)),scene);
   }else{
   // Oblique crater: a dark bowl, an uneven rim and radial erosion on the flanks.
   // Geometry stays fixed; only the ash column moves with time.
   float dx=local.x-.50;
   float summit=.48;
   float flank=summit-pow(max(abs(dx)-.115,0.),.82)*.92;
   float ridge=fbm(vec2(local.x*23.,local.y*19.));
   float silhouette=flank+(noise(vec2(local.x*67.,2.1))-.5)*.012;
   float rock=1.-smoothstep(silhouette-.004,silhouette+.004,local.y);
   vec2 bowl=vec2(dx/.145,(local.y-summit)/.046);
   float radius=length(bowl);
   float rimRadius=radius+(fbm(vec2(local.x*45.,local.y*50.))-.5)*.10;
   float rim=exp(-pow(abs(rimRadius-1.)*10.,2.));
   float inside=1.-smoothstep(.79,.97,rimRadius);
   float angle=atan(dx,max(summit-local.y,.025));
   float gullies=fbm(vec2(angle*15.,(summit-local.y)*18.));
   float grain=noise(local*vec2(230.,180.));
   float shade=clamp(.52-dx*.65+(ridge-.5)*.32+(gullies-.5)*.42,.12,.85);
   vec3 color=mix(vec3(.055,.047,.043),vec3(.37,.32,.27),shade);
   color*=.83+grain*.23;
   color=mix(color,vec3(.018,.016,.015)+vec3(.075,.055,.04)*smoothstep(-1.,1.,bowl.y),inside);
   color+=vec3(.20,.17,.13)*rim*(.65+.35*bowl.y);
   rock=max(rock,(1.-smoothstep(1.,1.07,rimRadius)));
   scene=over(vec4(color,rock*.97),scene);
   if(uActivity.y>.5){
    float rise=max(local.y-summit,0.);
    float axis=.50+rise*.19+sin(rise*9.-uTime*.32)*rise*.08;
    float width=.018+rise*.32;
    float column=exp(-pow(abs(local.x-axis)/width,2.));
    vec2 flow=vec2((local.x-axis)*13.,rise*10.-uTime*.28);
    vec4 ash=vapor(flow,1.,vec3(.51,.48,.44));
    ash.a*=column*smoothstep(-.008,.025,local.y-summit);
    // Keep the source attached to the crater instead of scattering smoke everywhere.
    ash.a=max(ash.a,column*.25*exp(-rise*5.)*smoothstep(-.008,.015,local.y-summit));
    scene=over(ash,scene);
   }else{scene=over(vapor(vec2(uv.x*4.-uTime*.025,uv.y*6.),.18,vec3(.39,.48,.52)),scene);}
   }
  }else if(uMode<6.5){
   if(uFootage>.5){
    // Grade the photographic surface; do not place a synthetic waterline over it.
    scene=uMode<5.5?vec4(.11,.075,.035,.12):vec4(.035,.09,.125,.13+.04*noise(uv*8.+uTime*.035));
   }else{scene=over(uMode<5.5?river(local):water(local,true),scene);}
   // A distant, textured reflection above the surface preserves the glass.
   scene=over(vapor(vec2(uv.x*3.+uTime*.03,uv.y*5.),.12,vec3(.36,.50,.58)),scene);
  }else{
   vec2 advect=vec2(uv.x*3.-uTime*(.3+.5*uStrength),uv.y*12.+sin(uTime*.7)*.2);
   scene=over(vapor(advect,.65,vec3(.56,.64,.66)),scene);
   scene.rgb*=.72+.28*fbm(advect*2.);
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
   const uniforms={};for(const key of ['Resolution','Activity','Time','Mode','Strength','Lightning','Footage','Lava'])uniforms[key]=gl.getUniformLocation(program,'u'+key);
   let last=-Infinity,width=1,height=1;
   function resize(w,h){width=w;height=h;const scale=Math.min(1,(mobile?176:240)/Math.max(w,1),(mobile?360:480)/Math.max(h,1));canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));gl.viewport(0,0,canvas.width,canvas.height);}
   function draw(t,current,lightning,footage){if(dead||gl.isContextLost()||t-last<(mobile?1/14:1/20))return;last=t;gl.uniform2f(uniforms.Resolution,width,height);gl.uniform2f(uniforms.Activity,current.hot?1:0,current.ash?1:0);gl.uniform1f(uniforms.Time,t);gl.uniform1f(uniforms.Mode,modes[current.type]);gl.uniform1f(uniforms.Strength,current.strength);gl.uniform1f(uniforms.Lightning,lightning?1:0);gl.uniform1f(uniforms.Footage,footage?1:0);gl.uniform1f(uniforms.Lava,current.lava?1:0);gl.drawArrays(gl.TRIANGLES,0,6);}
   return {canvas,resize,draw,destroy};
  }catch(error){destroy();console.warn('[CardCinema] Cena gráfica indisponível; usando camadas 2D.',error.message);return null;}
 }
 function footage(cfg){
  if(!(cfg.type in modes))return null;
  const key=cfg.type==='fire'?'fire':cfg.type==='flood'?'current':cfg.type==='tsunami'?'surge':cfg.lava?'lava':cfg.type==='volcano'?(cfg.ash||cfg.hot?'smoke':'terrain'):cfg.type==='tornado'?'tornado':cfg.type==='hurricane'?'gusts':cfg.type==='storm'?'storm':'clouds';
  const video=document.createElement('video');video.className='pd-cinema-footage';video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='metadata';video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.src='media/card-fx/'+key+'.mp4';
  let failed=false,dead=false,playing=false,wanted=false;
  function play(){wanted=true;if(document.hidden)return;if(dead||failed||playing||!video.paused)return;playing=true;video.play().then(()=>{playing=false;if(!wanted||document.hidden)video.pause();}).catch(error=>{playing=false;if(error?.name!=='AbortError')failed=true;});}
  function pause(){wanted=false;video.pause();}
  function resize(w,h){video.style.top='0px';video.style.height=h+'px';}
  function destroy(){dead=true;pause();video.removeAttribute('src');video.load();video.remove();}
  video.addEventListener('error',()=>{failed=true;});video.addEventListener('loadeddata',()=>{if(wanted&&!document.hidden)play();});
  return {video,play,pause,resize,destroy,isReady:()=>!failed&&video.readyState>=2&&!video.paused};
 }
 window.CardCinemaFilm={create,footage};
})();

