/* Procedural illustrations: clouds, fire and water across the entire card.
   These scenes never claim to be footage of the event or change its measurements. */
(function(){
 'use strict';
 const modes={storm:0,hurricane:1,tornado:2,fire:3,volcano:4,flood:5,wind:7};
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
 uniform float uTime,uMode,uStrength,uLightning,uFootage,uLava,uOrganized,uDirection,uGust,uTravel,uFlash,uTextureReady,uWaterTop;
 uniform sampler2D uCycloneTexture;
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

 // Twist a Cartesian field rather than repeating angular stripes. The cloud
 // bands stay continuous across the whole vortex, with no atan seam or rings.
 mat2 cycloneRotation(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
 vec2 cycloneFlow(vec2 p,float time){
  float r=length(p);
  // Inverse texture sampling gives counterclockwise motion in the north and
  // clockwise motion in the south; outer cloud decks move more slowly.
  return cycloneRotation(uDirection*time*(.018+.018/(1.+r*r*2.)))*p;
 }
 float cycloneEye(vec2 p,float time){
  vec2 flow=cycloneFlow(p,time);
  return length(p)+(noise(flow*9.1+vec2(4.7,2.1))-.5)*.024
   +(noise(flow*21.+vec2(2.3,8.1))-.5)*.009;
 }
 vec2 cycloneHeight(vec2 p,float time){
  float r=length(p),mature=smoothstep(.60,.90,uOrganized);
  vec2 flow=cycloneFlow(p,time);
  vec2 warp=vec2(noise(flow*3.6+vec2(1.8,7.1)),noise(flow*3.6+vec2(8.3,2.4)))-.5;
  vec2 spiral=cycloneRotation(-uDirection*log(r+.22)*mix(.65,2.6,uOrganized))*flow;
  // Long, broken bands curve into the dense central canopy. Anisotropic noise
  // creates uneven arms and dry slots instead of a symmetric spiral stencil.
  float band=noise(spiral*vec2(2.1,4.9)+warp*1.55+vec2(2.7,5.3));
  float broad=noise(flow*3.1+warp*.65+vec2(3.2,9.5));
  // Distinct scales share the same flow, so small billows travel with the
  // large convective towers rather than flickering independently.
  vec2 billow=flow+warp*.13;
  float towers=noise(billow*8.2+vec2(5.7,1.2));
  float lobes=noise(billow*18.5+vec2(1.3,8.7));
  float folds=noise(billow*42.+vec2(7.9,3.6));
  float cells=.58*towers+.32*lobes+.10*folds;
  float core=(1.-smoothstep(.34,.83,r+(broad-.5)*.20))*mix(.53,.95,uOrganized);
  float arms=smoothstep(.22,.66,band+(towers-.5)*.24+(lobes-.5)*.22+(folds-.5)*.10)*(.63+.37*broad);
  float mass=core+(1.-core)*arms*(.72+.28*uOrganized);
  float scud=smoothstep(.38,.75,towers*.65+lobes*.35)*.28;
  mass=max(mass,scud);
  float disturbed=cycloneEye(p,time);
  float opening=mix(1.,smoothstep(.133,.215,disturbed),mature);
  float wall=exp(-pow((disturbed-.231)/.071,2.))*mature;
  // Coverage and relief are separate: a band is a field of billowing clouds,
  // rather than a raised smooth ribbon with a polished edge.
  float depth=(.20+cells*.46)*(.92+.08*mass)+wall*(.13+.13*lobes);
  // A tropical storm has a turbulent, cloudy center, never a mature eye.
  float immature=(1.-mature)*(1.-smoothstep(.10,.47,r))*(.10+.12*towers);
  float outer=1.-smoothstep(1.30,2.05,r);
  return vec2(clamp((depth+immature)*opening*outer,0.,1.),
   clamp((mass+immature)*opening*outer,0.,1.));
 }
 vec4 cyclone(vec2 uv,float aspect){
  // Scale by width: a round eye stays round on compact and expanded cards.
  vec2 center=vec2(.52+.008*sin(uTime*.035),.62+.008*cos(uTime*.027));
  vec2 p=(uv-center)*vec2(aspect,1.)/max(aspect*.66,.18);
  float r=length(p);vec2 field=cycloneHeight(p,uTime);float height=field.x;
  float hx=cycloneHeight(p+vec2(.011,0.),uTime).x;
  float hy=cycloneHeight(p+vec2(0.,.011),uTime).x;
  vec3 normal=normalize(vec3((height-hx)*15.,(height-hy)*15.,.76));
  vec3 sun=normalize(vec3(-.55,.68,.92));
  float diffuse=max(dot(normal,sun),0.);
  // One wider sample gives soft shadows between towers and inside the eye.
  float upwind=cycloneHeight(p+vec2(-.045,.056),uTime).x;
  float shadow=1.-smoothstep(.025,.23,upwind-height)*.31;
  float valleys=clamp(.79+height*.45-(hx+hy)*.18,.67,1.);
  vec3 albedo=mix(vec3(.48,.50,.51),vec3(.95,.96,.95),smoothstep(.035,.62,height));
  vec3 clouds=albedo*(.57+.43*diffuse)*shadow*valleys;
  clouds+=vec3(.13,.14,.14)*pow(diffuse,6.)*height;
  vec2 flow=cycloneFlow(p,uTime);
  float grain=noise(flow*86.+vec2(5.2,8.1));
  clouds*=.96+.075*grain;
  float veil=smoothstep(.025,.53,field.y);
  // Muted water is visible only in the eye and the gaps between rainbands.
  vec3 ocean=vec3(.016,.028,.031)+vec3(.021,.026,.025)*noise(p*23.+uTime*.009);
  vec3 color=mix(ocean,clouds,veil);
  float mature=smoothstep(.60,.90,uOrganized);
  float disturbed=cycloneEye(p,uTime);
  float eye=(1.-smoothstep(.117,.199,disturbed))*mature;
  float shadowSide=smoothstep(-.13,.12,dot(p,normalize(vec2(-.55,.68))));
  float eyeMist=noise(flow*18.+vec2(2.1,5.3));
  vec3 interior=mix(vec3(.015,.025,.029),vec3(.13,.16,.17),
   (1.-shadowSide)*.64+eyeMist*.20);
  // Low scud and a directional wall shadow keep the hollow eye dimensional.
  interior+=vec3(.095,.103,.105)*smoothstep(.53,.74,eyeMist)*(1.-shadowSide)*.55;
  interior+=vec3(.047,.051,.051)*smoothstep(.075,.18,disturbed)*(1.-shadowSide);
  color=mix(color,interior,eye*.92);
  float haze=.024+.018*noise(flow*2.7+vec2(8.1,4.2));
  color=mix(color,vec3(.43,.47,.48),haze);
  color+=vec3(.020,.022,.023)*uGust*height;
  float alpha=.69+.20*smoothstep(.05,.60,height);
  if(uTextureReady>.5&&mature>.5){
   // NASA ISS007-E-14741: real cloud microstructure and the deep, shaded eye.
   // A slow, coherent advection preserves the photograph's convective detail.
   vec2 drift=cycloneRotation(uDirection*uTime*.018)*p;
   drift.x*=uDirection;
   drift+=vec2(noise(drift*3.1+vec2(uTime*.013,4.2))-.5,
    noise(drift*3.1+vec2(7.1,-uTime*.011))-.5)*.011;
   vec2 photoUV=vec2(.66,.42)+drift*vec2(.31,.46);
   // The source's identification strip is outside this safe sampling window.
   float softBoundary=photoUV.y+(noise(drift*5.1+vec2(1.8,7.1))-.5)*.060;
   float edges=smoothstep(.015,.105,photoUV.x)*(1.-smoothstep(.905,.985,photoUV.x))
    *smoothstep(.055,.275,softBoundary)*(1.-smoothstep(.835,.985,softBoundary));
   vec3 photograph=texture2D(uCycloneTexture,clamp(photoUV,vec2(.015,.055),vec2(.985))).rgb;
   float luminance=dot(photograph,vec3(.2126,.7152,.0722));
   photograph=mix(vec3(luminance),photograph,.45)*(.95+.035*uGust);
   float photographic=edges*.73;
   color=mix(color,photograph,photographic);
   alpha=mix(alpha,.89,photographic);
  }
  return vec4(color,alpha);
 }

 // Eight depth samples integrate extinction and directional illumination.
 // Cells share one advected 3D field: lobes occlude one another instead of
 // looking like a relief embossed onto a flat card.
 float weatherNoise(vec3 p){
  float z=floor(p.z),f=fract(p.z);f=f*f*(3.-2.*f);
  return mix(noise(p.xy+z*vec2(37.2,19.1)),noise(p.xy+(z+1.)*vec2(37.2,19.1)),f);
 }
 float weatherDensity(vec3 p){
  float broad=weatherNoise(p),detail=weatherNoise(p*2.73+vec3(7.1,2.8,1.4));
  return smoothstep(.30,.73,broad*.76+detail*.24);
 }
 vec4 convectiveVolume(vec2 uv,float aspect,bool tropical){
  vec2 p=vec2((uv.x-.5)*aspect*5.3-uTravel*.34,uv.y*3.4+uTime*.019);
  if(tropical){
   vec2 c=(uv-vec2(.52,.62))*vec2(aspect,1.)/max(aspect*.66,.18);
   c=cycloneFlow(c,uTime*1.8);
   c=cycloneRotation(-uDirection*log(length(c)+.25)*1.35)*c;
   p=c*3.4+vec2(4.8,2.1);
  }
  vec3 result=vec3(0.);float transmission=1.;
  vec3 sun=normalize(vec3(-.54,.67,.62));
  for(int i=0;i<8;i++){
   float depth=float(i)*.24;
   vec3 q=vec3(p*(1.+depth*.065)+vec2(depth*.15,-depth*.13),depth+uTime*.012);
   float density=weatherDensity(q);
   float lit=weatherDensity(q+sun*.29);
   float shadow=exp(-max(lit-density,0.)*5.2);
   float edgeLight=clamp(.32+(density-lit)*2.5,.08,.95);
   vec3 albedo=mix(vec3(.055,.068,.079),vec3(.40,.412,.422),edgeLight);
   vec3 color=albedo*(.42+.58*shadow)+vec3(.019,.021,.023)*depth;
   float opacity=1.-exp(-density*.65);
   result+=transmission*color*opacity;transmission*=1.-opacity;
  }
  vec3 distant=vec3(.075,.092,.106);
  result+=distant*transmission;
  float folds=weatherNoise(vec3(p*7.4,uTime*.024));
  float grain=weatherNoise(vec3(p*23.1,1.8+uTime*.024));
  result=max((result-vec3(.043))*1.32+vec3(.028),vec3(.014));
  result*=.82+.30*folds+.06*grain;
  // Ragged precipitation shafts scatter the low sky light at different depths.
  vec2 rainP=vec2(uv.x*aspect*37.+uv.y*6.2-uTravel*.95,uv.y*.72-uTime*.24);
  float rain=noise(rainP)*.75+noise(rainP*vec2(2.3,1.7))*.25;
  float haze=smoothstep(.34,.75,rain)*(.08+.22*(1.-uv.y));
  result=mix(result,vec3(.21,.235,.25),haze);
  // Return strokes light the cloud volume from inside, following the same clock.
  vec2 delta=(uv-vec2(.33,.80))*vec2(aspect,1.);
  float scatter=.32+.68*(1.-transmission);
  result+=vec3(.69,.72,.75)*uFlash*uLightning*exp(-dot(delta,delta)*3.2)*scatter;
  return vec4(result,.83+.09*(1.-transmission));
 }

 void main(){
  vec2 uv=vUV;float aspect=uResolution.x/uResolution.y;
  // A continuous scene across the viewport, including the area behind the data.
  // Local dark surfaces in CSS preserve readability rather than masking the scene.
  float coverage=.91+.09*smoothstep(0.,.15,min(uv.x,1.-uv.x));
  vec2 local=uv;
  vec4 scene=vec4(.012,.028,.043,.26);
  if(uMode<.5){
   scene=convectiveVolume(uv,aspect,false);
  }else if(uMode<1.5){
   scene=uOrganized<.6?convectiveVolume(uv,aspect,true):cyclone(uv,aspect);
  }else if(uMode<2.5){
   // The real funnel and ground circulation already exist in the film.
   // A photographic reserve is used only before presentation or on failure.
   if(uFootage>.5){scene=vec4(.06,.063,.052,.045);}
   else if(uTextureReady>.5){
    vec2 st=uv;float photoAspect=.5625;
    if(aspect>photoAspect)st.y=(st.y-.5)*photoAspect/aspect+.5;
    else st.x=(st.x-.5)*aspect/photoAspect+.5;
    st.x=clamp(st.x+.0025*sin(uTime*.7+uv.y*3.)*uGust,.003,.997);
    st.y=clamp(st.y+.0015*cos(uTime*.8)*uGust,.003,.997);
    scene=vec4(texture2D(uCycloneTexture,st).rgb*(.94-.025*uGust),.91);
   }else{
    vec2 mass=vec2(uv.x*3.-uTime*.035,uv.y*4.+uTime*.02);
    float cloudMass=fbm(mass),ground=1.-smoothstep(.12,.28,uv.y);
    vec3 sky=mix(vec3(.14,.16,.15),vec3(.40,.42,.39),cloudMass);
    scene=vec4(mix(sky,vec3(.19,.17,.125),ground),.85);
   }
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
   // Flood uses a single film; tsunami owns its independent hydraulic surface.
   scene=uFootage>.5?vec4(0.):river(local);
  }else{
   // A photographic canopy, with the frame preserved through native loop seeks.
   // The moving dust field is in front of the data; no old speed-stripe backdrop.
   if(uFootage>.5){scene=vec4(.06,.075,.055,.045);}
   else if(uTextureReady>.5){
    vec2 st=uv;float photoAspect=.5625;
    if(aspect>photoAspect)st.y=(st.y-.5)*photoAspect/aspect+.5;
    else st.x=(st.x-.5)*aspect/photoAspect+.5;
    float bend=uv.y*uv.y*uGust;
    st.x=clamp(st.x+.008*bend*sin(uTime*.8)+.003*bend*noise(vec2(uv.y*8.,uTime*.4)),.003,.997);
    st.y=clamp(st.y+.002*bend*sin(uTime*1.4),.003,.997);
    vec3 canopy=texture2D(uCycloneTexture,st).rgb;
    scene=vec4(canopy*(.91-.035*uGust),.9);
   }else{
    vec2 flow=vec2(uv.x*3.-uTravel*.18,uv.y*4.+uTime*.025);
    float mass=fbm(flow),grain=noise(flow*29.);
    scene=vec4(mix(vec3(.05,.085,.055),vec3(.23,.29,.22),mass)+grain*.015,.82);
   }
  }
  float vignette=1.-smoothstep(.32,.60,abs(uv.x-.5));
  scene.rgb*=.85+.15*vignette;
  float opacity=clamp(scene.a*coverage,0.,.90);
  gl_FragColor=vec4(scene.rgb,opacity);
 }
 `;
 function create(cfg,mobile,quality){
  const detail=quality||{resolution:1,count:n=>n,track:a=>a,fps:n=>n};
  if(!(cfg.type in modes)||cfg.type==='volcano'&&!cfg.hot&&!cfg.ash&&!cfg.lava)return null;
  const canvas=document.createElement('canvas');canvas.className='pd-cinema-film';
  const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
  if(!gl)return null;
  let program,buffer,texture,textureImage,textureReady=false,shaders=[],dead=false;
  function destroy(){if(dead)return;dead=true;if(textureImage){textureImage.onload=null;textureImage.onerror=null;textureImage.removeAttribute('src');textureImage=null;}if(texture)gl.deleteTexture(texture);if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);for(const s of shaders)gl.deleteShader(s);gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();}
  try{
   function compile(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);shaders.push(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
   program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
   const uniforms={};for(const key of ['Resolution','Activity','Time','Mode','Strength','Lightning','Footage','Lava','Organized','Direction','Gust','Travel','Flash','TextureReady','WaterTop'])uniforms[key]=gl.getUniformLocation(program,'u'+key);
   texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
   gl.uniform1i(gl.getUniformLocation(program,'uCycloneTexture'),0);
   if(['wind','tornado'].includes(cfg.type)||cfg.type==='hurricane'&&!['depression','tropical-storm'].includes(cfg.cycloneStage)){
    textureImage=new Image();const image=textureImage;
    image.onload=()=>{if(dead||gl.isContextLost()||textureImage!==image)return;try{gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);textureReady=gl.getError()===gl.NO_ERROR;if(textureReady)canvas.dataset.texture=cfg.type==='wind'?'gale-canopy':cfg.type==='tornado'?'tornado-vortex':'nasa';}catch(error){textureReady=false;}image.onload=null;image.onerror=null;textureImage=null;};
    image.onerror=()=>{image.onload=null;image.onerror=null;if(textureImage===image)textureImage=null;};
    image.src=cfg.type==='wind'?'media/card-fx/gale-canopy.jpg':cfg.type==='tornado'?'media/card-fx/tornado-vortex.jpg':'media/card-fx/cyclone-eye.jpg';
   }
   let last=-Infinity,width=1,height=1;
   function resize(w,h){width=w;height=h;last=-Infinity;const cyclone=cfg.type==='hurricane';const scale=detail.resolution*Math.min(1,(mobile?(cyclone?224:176):(cyclone?320:240))/Math.max(w,1),(mobile?(cyclone?448:360):(cyclone?640:480))/Math.max(h,1));canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));gl.viewport(0,0,canvas.width,canvas.height);}
   function draw(t,current,lightning,footage){if(dead||gl.isContextLost()||t-last<(1/detail.fps(mobile?14:20)))return;last=t;gl.uniform2f(uniforms.Resolution,width,height);gl.uniform2f(uniforms.Activity,current.hot?1:0,current.ash?1:0);gl.uniform1f(uniforms.Time,t);gl.uniform1f(uniforms.Mode,modes[current.type]);gl.uniform1f(uniforms.Strength,current.strength);gl.uniform1f(uniforms.Lightning,lightning?1:0);gl.uniform1f(uniforms.Footage,footage?1:0);gl.uniform1f(uniforms.Lava,current.lava?1:0);gl.uniform1f(uniforms.Direction,current.rotationDirection||1);gl.uniform1f(uniforms.Flash,current.flash||0);gl.uniform1f(uniforms.Gust,current.gust||0);gl.uniform1f(uniforms.Travel,current.windTravel??t*.25);gl.uniform1f(uniforms.TextureReady,textureReady?1:0);gl.uniform1f(uniforms.WaterTop,current.waterTop??.55);gl.uniform1f(uniforms.Organized,current.cycloneStage==='depression'?0:current.cycloneStage==='tropical-storm'?.35:1);gl.drawArrays(gl.TRIANGLES,0,6);}
   return {canvas,resize,draw,destroy};
  }catch(error){destroy();console.warn('[CardCinema] Cena gráfica indisponível; usando camadas 2D.',error.message);return null;}
 }
 function footage(cfg){
  if(!(cfg.type in modes)||['hurricane','storm'].includes(cfg.type)||cfg.type==='volcano'&&!cfg.hot&&!cfg.ash&&!cfg.lava)return null;
  const key=cfg.type==='wind'?'gale-canopy':cfg.type==='fire'?'fire':cfg.type==='flood'?'flood-current':cfg.lava?'lava':cfg.type==='volcano'?'smoke':cfg.type==='tornado'?'tornado-vortex':cfg.type==='hurricane'?'gusts':cfg.type==='storm'?'storm':'clouds';
  const video=document.createElement('video');video.className='pd-cinema-footage';video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='metadata';video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.src='media/card-fx/'+key+'.mp4';if(['wind','tornado'].includes(cfg.type))video.poster='media/card-fx/'+key+'.jpg';
  let failed=false,dead=false,playing=false,wanted=false,presented=false;
  function play(){wanted=true;if(document.hidden)return;if(dead||failed||playing||!video.paused)return;playing=true;video.play().then(()=>{playing=false;if(!wanted||document.hidden)video.pause();}).catch(error=>{playing=false;if(error?.name!=='AbortError')failed=true;});}
  function pause(){wanted=false;video.pause();}
  function resize(w,h){video.style.top='0px';video.style.height=h+'px';}
  function destroy(){dead=true;pause();video.removeAttribute('src');video.load();video.remove();}
  video.addEventListener('error',()=>{failed=true;});video.addEventListener('loadeddata',()=>{presented=true;if(wanted&&!document.hidden)play();});
  // Keep the last photographic frame through a loop seek or brief buffering.
  // The procedural reserve must not flash over an already presented photographic scene.
  return {video,play,pause,resize,destroy,isReady:()=>!dead&&!failed&&(['flood','wind','tornado'].includes(cfg.type)?presented:video.readyState>=2&&!video.paused)};
 }
 window.CardCinemaFilm={create,footage};
})();
