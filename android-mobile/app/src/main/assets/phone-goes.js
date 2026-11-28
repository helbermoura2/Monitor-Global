/* Mobile-only GOES product selector. No changes to site satellite controls. */
(function(){'use strict';const M=window.BrazilSatelliteModel,instances=new WeakMap(),SOURCE='br-satellite-source',LAYER='br-satellite-layer';
 function create({map,host=map.getContainer(),borderUrl='data/brazil-satellite-border.json',enabled=true,manualControl=false}={}){
  if(instances.has(map))return instances.get(map);const canvas=document.createElement('canvas');canvas.width=canvas.height=M.SIZE;const work=document.createElement('canvas');work.width=work.height=M.SIZE;const ctx=work.getContext('2d',{willReadFrequently:true}),display=canvas.getContext('2d');
  const panel=document.createElement('section');panel.className='brazil-satellite-control';panel.setAttribute('aria-label','Produtos de satélite do Brasil');panel.innerHTML='<details><summary><input type="checkbox" checked aria-label="Exibir satélite no Brasil"><span>Satélite · Brasil</span><span class="br-satellite-expand">⌄</span></summary><div class="br-satellite-options"><label>Produto GOES-19 <select data-action="product" aria-label="Produto GOES-19"></select></label><div class="br-satellite-buttons"><button type="button" data-action="play">▶ Animar</button><button type="button" data-action="latest">Último quadro</button><button type="button" data-action="brasil">Brasil</button></div><label class="br-satellite-range">Histórico <input type="range" data-action="frame" min="0" max="0" value="0" aria-label="Quadro do satélite"></label><label class="br-satellite-range">Opacidade <input type="range" data-action="opacity" min="25" max="100" value="88" aria-label="Opacidade do satélite"></label><img class="br-satellite-legend" src="https://gibs.earthdata.nasa.gov/legends/Clean_Longwave_Infrared_Window_Band_H.png" alt="Escala de temperatura de brilho infravermelha em graus Celsius"><small data-vapor-scale hidden style="display:none">Temperatura de brilho (°C): branco −80 · azul claro −60 · azul −40 · azul escuro −20 · marrom 0 · laranja +20 a +40. Transparência: dado ausente/qualidade reduzida.</small><small data-product-description>Temperatura de brilho · °C. Não mede intensidade da chuva.</small></div></details><p class="br-satellite-status" role="status">Consultando horários da fonte…</p><a href="https://www.earthdata.nasa.gov/data/projects/gibs" target="_blank" rel="noopener">GOES-East · NASA GIBS / NOAA</a>';
  host.appendChild(panel);const checkbox=panel.querySelector('input[type=checkbox]'),status=panel.querySelector('.br-satellite-status'),slider=panel.querySelector('[data-action=frame]'),play=panel.querySelector('[data-action=play]');
  const controlChip=manualControl?document.getElementById('chip-satellite'):null;let controlOpen=false;
  let productKey='ir',productEpoch=0,coverage=0,legendFailed=false,vaporAssets=new Map(),vaporDownloads=0,expireTimer=null;const selector=panel.querySelector('[data-action=product]'),legend=panel.querySelector('.br-satellite-legend'),description=panel.querySelector('[data-product-description]'),scale=panel.querySelector('[data-vapor-scale]'),attribution=panel.querySelector('a');
  for(const [key,p] of Object.entries(M.PRODUCTS)){const option=document.createElement('option');option.value=key;option.textContent=p.label;selector.append(option);}
  let live=enabled,active=true,dead=false,border=null,times=[],selected=0,dataAt=0,expectedSamples=0,playing=false,stepping=false,busy=false,serial=0,controller=null,poll=null,animation=null,restoreTimer=null,lastQuery=0,opacity=.88,cache=new Map(),cacheBytes=0;
  checkbox.checked=enabled;
  const valid=()=>!dead&&live&&active&&!document.hidden;
  function inView(){try{return M.intersects(map.getBounds());}catch{return false;}}
  function updatePanel(){
   // The standalone site controls its own panel; embedded hosts (such as the
   // mobile Brazil map) own visibility and may hide this when radar is active.
   // Do not accidentally clear the host's hidden flag during map move/refresh.
   if(manualControl){panel.hidden=!controlOpen;controlChip?.setAttribute('aria-expanded',String(controlOpen));controlChip?.setAttribute('aria-pressed',String(controlOpen));controlChip?.classList.toggle('active',controlOpen);panel.querySelector('details').open=controlOpen;}
  }
  function toggleControl(){controlOpen=!controlOpen;updatePanel();}
  function closeControl(){controlOpen=false;updatePanel();controlChip?.focus();}
  function controlKey(event){if(controlOpen&&event.key==='Escape'){event.stopPropagation();closeControl();}}
  if(manualControl){panel.id='site-satellite-controls';const close=document.createElement('button');close.type='button';close.className='br-satellite-close';close.textContent='×';close.setAttribute('aria-label','Fechar controles do satélite');close.addEventListener('click',closeControl);panel.prepend(close);controlChip?.addEventListener('click',toggleControl);document.addEventListener('keydown',controlKey);}
  function note(text){status.textContent=text;}
  function stamp(){if(!dataAt)return;const age=Date.now()-dataAt;if(age>M.MAX_AGE){removeLayer();cache.clear();cacheBytes=0;panel.dataset.ready='false';note('A última imagem expirou; aguardando um quadro recente da fonte.');status.dataset.stale='true';return;}note(M.product(productKey).label+' · '+new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(dataAt))+' BRT'+' · há '+Math.max(0,Math.floor(age/60000))+' min'+(age>1800000?' · imagem defasada':'')+(coverage<.98?' · cobertura parcial do Brasil':''));status.dataset.stale=String(age>1800000);}
  function clearTimers(){clearTimeout(poll);clearTimeout(animation);clearTimeout(restoreTimer);clearTimeout(expireTimer);poll=animation=restoreTimer=expireTimer=null;}
  function removeLayer(){try{if(map.getLayer(LAYER))map.removeLayer(LAYER);if(map.getSource(SOURCE))map.removeSource(SOURCE);}catch{}}
  function install(){if(!valid()||!dataAt)return;if(Date.now()-dataAt>M.MAX_AGE){removeLayer();note('A última imagem expirou; consultando a fonte.');return;}try{if(!map.getSource(SOURCE))map.addSource(SOURCE,{type:'canvas',canvas,animate:false,coordinates:M.coordinates,attribution:M.product(productKey).band?'Satélite: INPE / NOAA GOES-19':'Satélite: NASA GIBS / NOAA GOES-East'});if(!map.getLayer(LAYER)){const reference=map.getLayer('esri-boundaries-places')?'esri-boundaries-places':undefined;map.addLayer({id:LAYER,type:'raster',source:SOURCE,paint:{'raster-opacity':opacity,'raster-fade-duration':0}},reference);}const source=map.getSource(SOURCE);source.play();source.pause();map.triggerRepaint();}catch{note('Não foi possível exibir o satélite neste mapa.');}}
  async function read(url,signal){const response=await fetch(url,{signal,credentials:'omit'});if(!response.ok)throw Error('Fonte indisponível');return response;}
  async function bounded(url,signal,max){
   const response=await fetch(url,{signal,credentials:'omit',redirect:'error'});if(!response.ok||!response.body)throw Error('Fonte indisponível');
   const declared=Number(response.headers.get('content-length'));if(declared>max)throw Error('Arquivo excede limite');
   const reader=response.body.getReader(),chunks=[];let length=0;
   try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw Error('Arquivo excede limite');}chunks.push(value);}}finally{reader.releaseLock();}
   const bytes=new Uint8Array(length);let cursor=0;for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.length;}return bytes;
  }
  async function vaporImage(time,signal){
   if(vaporDownloads>=6)throw Error('Limite de seis arquivos por sessão atingido; reabra o mapa.');
   const url=vaporAssets.get(time);if(!url)throw Error('Quadro sem endereço confirmado');
   if(Date.now()-time>M.MAX_AGE)throw Error('Quadro expirado');
   vaporDownloads++;
   note('Baixando canal '+M.product(productKey).band+' (até 32 MB)…');
   const bytes=await bounded(url,signal,M.MAX_VAPOR_BYTES);if(signal.aborted)throw Error('Cancelado');
   const data=await new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('vendor/cappi/inpe-cappi-worker.mjs',document.baseURI),{type:'module'});
    const finish=(error,value)=>{signal.removeEventListener('abort',abort);worker.terminate();if(error)reject(Error(error));else resolve(value);};
    const abort=()=>finish('Cancelado');signal.addEventListener('abort',abort,{once:true});
    worker.onerror=()=>finish('Leitor GOES indisponível');
    worker.onmessage=({data})=>data.error?finish(data.error):finish(null,data);
    worker.postMessage({id:1,kind:'goes-vapor',band:M.product(productKey).band,size:M.VAPOR_SIZE,bytes:bytes.buffer},[bytes.buffer]);
   });
   if(signal.aborted||Date.now()-time>M.MAX_AGE)throw Error('Quadro expirado');
   const img=document.createElement('canvas');img.width=img.height=M.VAPOR_SIZE;img.getContext('2d').putImageData(new ImageData(M.vaporRGBA(data.celsius,data.quality),M.VAPOR_SIZE,M.VAPOR_SIZE),0,0);
   const scaled=document.createElement('canvas');scaled.width=scaled.height=M.SIZE;const c=scaled.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(img,0,0,M.SIZE,M.SIZE);
   return await new Promise((resolve,reject)=>scaled.toBlob(b=>b?resolve(b):reject(Error('Falha de imagem')),'image/png'));
  }
  function expire(){clearTimeout(expireTimer);if(dataAt&&valid())expireTimer=setTimeout(()=>{stamp();},Math.max(1,dataAt+M.MAX_AGE-Date.now()+1));}
  function remember(time,blob){if(cache.has(time))return;cache.set(time,blob);cacheBytes+=blob.size;while(cache.size>6||cacheBytes>12582912){const key=cache.keys().next().value;cacheBytes-=cache.get(key).size;cache.delete(key);}}
  async function show(index){
   if(!valid()||!inView()||busy||!times[index])return false;busy=true;const token=++serial;const operation=new AbortController();controller=operation;const timeout=setTimeout(()=>operation.abort(),M.product(productKey).band?90000:25000);const time=times[index];let bitmap;
   try{if(!border)border=await(await read(borderUrl,operation.signal)).json();let blob=cache.get(time);if(!blob){if(M.product(productKey).band)blob=await vaporImage(time,operation.signal);else{const response=await read(M.imageUrl(time,productKey),operation.signal);blob=await response.blob();}if(blob.size>3000000||blob.type!=='image/png')throw Error('Imagem inválida');if(!valid()||token!==serial)return false;}bitmap=await createImageBitmap(blob);if(bitmap.width!==M.SIZE||bitmap.height!==M.SIZE)throw Error('Dimensões inválidas');if(!valid()||token!==serial)return false;
    if(work.width!==M.SIZE)work.width=work.height=M.SIZE;if(!expectedSamples){ctx.clearRect(0,0,M.SIZE,M.SIZE);ctx.save();M.clip(ctx,border);ctx.fillStyle='#fff';ctx.fillRect(0,0,M.SIZE,M.SIZE);ctx.restore();const mask=ctx.getImageData(0,0,M.SIZE,M.SIZE).data;for(let i=3;i<mask.length;i+=400)if(mask[i])expectedSamples++;}ctx.clearRect(0,0,M.SIZE,M.SIZE);ctx.save();M.clip(ctx,border);ctx.drawImage(bitmap,0,0);ctx.restore();const pixels=ctx.getImageData(0,0,M.SIZE,M.SIZE).data;let visible=0;for(let i=3;i<pixels.length;i+=400)if(pixels[i])visible++;if(visible<Math.max(10,expectedSamples*(productKey==='air'?.05:.98))){const error=Error('Quadro sem cobertura completa do Brasil');error.emptyFrame=true;throw error;}coverage=visible/expectedSamples;remember(time,blob);if(canvas.width!==M.SIZE)canvas.width=canvas.height=M.SIZE;display.clearRect(0,0,M.SIZE,M.SIZE);display.drawImage(work,0,0);dataAt=time;selected=index;slider.value=String(index);install();stamp();expire();panel.dataset.ready='true';return true;
   }catch(error){if(valid()&&token===serial){if(error.emptyFrame){times=times.filter(t=>t!==time);slider.max=String(Math.max(0,times.length-1));selected=Math.max(0,times.indexOf(dataAt));slider.value=String(selected);}playing=false;play.textContent='▶ Animar';if(dataAt){stamp();note(status.textContent+' · atualização indisponível');}else note(M.product(productKey).band?'Vapor indisponível: '+String(error.message||'falha na fonte').slice(0,120):'Imagem indisponível. Consulte novamente em alguns minutos.');}return false;
   }finally{bitmap?.close();clearTimeout(timeout);if(token===serial){busy=false;controller=null;}}
  }
  function schedule(){clearTimeout(poll);if(valid()&&inView()&&!M.product(productKey).band)poll=setTimeout(()=>refresh(),300000);}
  async function refresh(force=false){
   if(!valid()||!inView()||busy)return;if(!force&&M.product(productKey).band)return;if(!force&&dataAt&&Date.now()-lastQuery<300000){schedule();return;}lastQuery=Date.now();busy=true;const epoch=productEpoch;const token=++serial;const operation=new AbortController();controller=operation;const timeout=setTimeout(()=>operation.abort(),15000);
   try{let frames;if(M.product(productKey).band){const bytes=await bounded(M.vaporUrl(),operation.signal,4*1024*1024);const items=M.vaporFrames(JSON.parse(new TextDecoder().decode(bytes)),productKey);vaporAssets=new Map(items);frames=items.map(([time])=>time);if(!frames.length)throw Error('Nenhum quadro recente (até 90 min)');}else{const xml=await(await read(M.domainUrl(Date.now(),productKey),operation.signal)).text();frames=M.frames(xml);}if(!valid()||token!==serial)return;clearTimeout(timeout);times=frames;slider.max=String(times.length-1);for(const [time,blob]of cache)if(!times.includes(time)){cache.delete(time);cacheBytes-=blob.size;}busy=false;const candidates=times.slice().reverse();for(const time of candidates){if(!valid()||epoch!==productEpoch)break;const index=times.indexOf(time);if(index>=0&&await show(index))break;}
   }catch{if(valid()&&token===serial){if(dataAt){stamp();note(status.textContent+' · horários indisponíveis');}else note(M.product(productKey).band?'Vapor indisponível: sem quadro recente do INPE (até 90 min).':'Horários do satélite indisponíveis; nenhuma imagem estimada.');}}
   finally{clearTimeout(timeout);if(token===serial){busy=false;controller=null;}if(epoch===productEpoch)schedule();}
  }
  async function step(){clearTimeout(animation);if(stepping||!playing||!valid()||!inView()||!times.length)return;const next=(selected+1)%times.length;if(next===0&&times.some(t=>!cache.has(t))&&cacheBytes>9000000){playing=false;play.textContent='▶ Animar';note('Reprodução pausada para limitar memória.');return;}stepping=true;try{await show(next);}finally{stepping=false;}if(playing&&valid()&&inView())animation=setTimeout(step,1300);}
  function pause(){clearTimers();serial++;controller?.abort();controller=null;busy=false;}
  function activate(value){live=value;checkbox.checked=value;try{localStorage.setItem('mg-br-satellite',value?'on':'off');}catch{}if(!value){pause();playing=false;play.textContent='▶ Animar';removeLayer();cache.clear();cacheBytes=0;dataAt=0;canvas.width=canvas.height=work.width=work.height=1;panel.dataset.ready='false';note('Camada desativada.');}else refresh(true);}
  const api={setActive(value){active=value;if(!value)pause();else if(live){if(dataAt){stamp();install();expire();}refresh();if(playing)step();}},destroy(){if(dead)return;dead=true;if(manualControl){controlOpen=false;updatePanel();controlChip?.removeEventListener('click',toggleControl);document.removeEventListener('keydown',controlKey);}pause();removeLayer();cache.clear();border=null;canvas.width=canvas.height=work.width=work.height=1;panel.remove();map.off('moveend',move);map.off('style.load',style);map.off('styledata',style);map.off('remove',api.destroy);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',api.destroy);instances.delete(map);},get state(){return {product:productKey,coverage,enabled:live,active,dataAt,frames:times.slice(),cacheBytes,playing};}};
  function move(){updatePanel();if(!inView()){clearTimers();return;}if(valid()){refresh();if(playing&&!animation)step();}}
  function visibility(){if(document.hidden)pause();else if(valid()){if(dataAt){stamp();install();}refresh();if(playing)step();}}
  function style(){if(!valid()||!dataAt||map.getSource(SOURCE)&&map.getLayer(LAYER))return;clearTimeout(restoreTimer);restoreTimer=setTimeout(()=>{restoreTimer=null;if(valid()&&map.isStyleLoaded()&&(!map.getSource(SOURCE)||!map.getLayer(LAYER)))install();},0);}
  selector.addEventListener('change',()=>{
   const next=selector.value;if(next===productKey||!Object.hasOwn(M.PRODUCTS,next))return;
   productEpoch++;pause();playing=false;play.textContent='▶ Animar';removeLayer();cache.clear();cacheBytes=0;times=[];dataAt=0;selected=0;coverage=0;lastQuery=0;slider.value='0';slider.max='0';productKey=next;vaporAssets.clear();panel.dataset.ready='false';const isVapor=!!M.product(next).band;play.disabled=isVapor;slider.disabled=isVapor;scale.hidden=!isVapor;scale.style.display=isVapor?'block':'none';attribution.textContent=isVapor?'INPE / NOAA · GOES-19':'GOES-East · NASA GIBS / NOAA';attribution.href=isVapor?'https://data.inpe.br/':'https://www.earthdata.nasa.gov/data/projects/gibs';
   legend.hidden=next!=='ir'||legendFailed;legend.style.display=legend.hidden?'none':'';description.textContent=M.product(next).description;note('Consultando '+M.product(next).label+'…');if(valid())refresh(true);
  });
  checkbox.addEventListener('click',e=>e.stopPropagation());checkbox.addEventListener('change',()=>activate(checkbox.checked));
  play.addEventListener('click',()=>{playing=!playing;play.textContent=playing?'Ⅱ Pausar':'▶ Animar';if(playing)step();else clearTimeout(animation);});
  panel.querySelector('[data-action=brasil]').addEventListener('click',()=>map.fitBounds([[M.BOUNDS[0],M.BOUNDS[1]],[M.BOUNDS[2],M.BOUNDS[3]]],{padding:24,duration:600,maxZoom:4.5}));
  legend.addEventListener('error',()=>{legendFailed=true;legend.hidden=true;legend.style.display='none';});
  panel.querySelector('[data-action=latest]').addEventListener('click',()=>{playing=false;play.textContent='▶ Animar';clearTimeout(animation);lastQuery=0;refresh(true);});
  slider.addEventListener('input',()=>{playing=false;play.textContent='▶ Animar';clearTimeout(animation);show(Number(slider.value));});
  panel.querySelector('[data-action=opacity]').addEventListener('input',e=>{opacity=Number(e.target.value)/100;if(map.getLayer(LAYER))map.setPaintProperty(LAYER,'raster-opacity',opacity);});
  for(const event of ['pointerdown','touchstart','dblclick'])panel.addEventListener(event,e=>e.stopPropagation(),{passive:true});
  map.on('moveend',move);map.on('style.load',style);map.on('styledata',style);map.on('remove',api.destroy);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',api.destroy);instances.set(map,api);updatePanel();if(enabled)refresh(true);else note('Camada desativada.');return api;
 }
 function attachSite(m){if(!m||typeof m.addSource!=='function'||document.documentElement.dataset.satelliteAuto==='off')return null;let enabled=true;try{enabled=localStorage.getItem('mg-br-satellite')!=='off';}catch{}return create({map:m,enabled,manualControl:true});}
 window.BrazilSatellite={create,attachSite};
 window.addEventListener('load',()=>{if(typeof map!=='undefined'&&map&&window.__mgMapReady)attachSite(map);});
})();
