/* Opt-in, bounded, local-only diagnostics. No fetch, beacon or server storage. */
(function(){
 'use strict';
 const KEY='mg-performance-diagnostic-v1',LIMIT=288;
 let report=null,active=false,timer=null,raf=null,frameTimer=null,observers=[],dialog=null,lastTick=0,lastVisible=false,lastSample=0,mapRef=null,storageOk=true,opener=null;
 const round=n=>Math.round(n*100)/100;
 // Fixed categories only: never persist URLs, coordinates, paths or query strings.
 function resourceGroup(entry){
  try{const u=new URL(entry.name,location.href),host=u.hostname,path=u.pathname;
   if(host==='server.arcgisonline.com'&&path.includes('/World_Imagery/'))return 'mapImagery';
   if(host==='server.arcgisonline.com'&&path.includes('/World_Boundaries_and_Places/'))return 'mapLabels';
   if(host==='tiles.openfreemap.org')return 'mapVector';
   if(host==='black-sky-9ba0.terrestre.workers.dev'&&path.startsWith('/rainbow-tile/'))return 'radar';
   if(u.origin===location.origin&&path.startsWith('/media/card-fx/'))return 'cardMedia';
   if(['audio','video'].includes(entry.initiatorType))return 'otherMedia';
   if(host==='tilecache.rainviewer.com'||host.endsWith('.rainviewer.com')&&path.includes('/v2/radar/'))return 'radar';
   if(u.origin===location.origin&&/^\/assets\/(?:flags|geography|weather|seismic)\//.test(path))return path.startsWith('/assets/flags/')?'flags':'localData';
   if(['fetch','xmlhttprequest'].includes(entry.initiatorType))return host==='black-sky-9ba0.terrestre.workers.dev'?'workerApi':'otherApi';
   if(u.origin===location.origin)return 'localAssets';
   if(['img','image'].includes(entry.initiatorType))return 'otherImages';
  }catch{}return 'other';
 }
 function resourceEntries(entries){
  const resources=report.resources;resources.byCategory||={};resources.categoryCount||=0;
  for(const e of entries){
   resources.count++;resources.totalMs+=round(e.duration);const key=resourceGroup(e);
   const group=resources.byCategory[key]||={count:0,totalMs:0,httpErrors:0,bodyBytes:0,transferBytes:0,cacheHits:0,timingUnavailable:0};
   resources.categoryCount++;group.count++;group.totalMs+=round(e.duration);
   if(e.responseStatus){resources.httpStatusAvailable=true;if(e.responseStatus>=400){resources.httpErrors++;group.httpErrors++;}}
   // Cross-origin entries often hide sizes. Zero bytes alone do not prove a cache hit.
   if(e.encodedBodySize>0){group.bodyBytes+=e.encodedBodySize;group.transferBytes+=e.transferSize||0;if(e.transferSize===0)group.cacheHits++;}
   else group.timingUnavailable++;
  }
 }
 // Resource errors are not necessarily map failures (for example, a JSONP
 // script or a flag image). Keep only fixed categories, never the failed URL.
 function resourceFailure(target){
  const tag=String(target?.tagName||'').toLowerCase(),value=target?.currentSrc||target?.src||target?.href;
  let category='other';
  try{const u=new URL(value,location.href);
   if(tag==='script')category=u.hostname==='www.seismicportal.eu'?'emscJSONP':u.origin===location.origin?'localScripts':'externalScripts';
   else if(tag==='link')category='styles';
   else category=resourceGroup({name:u.href,initiatorType:tag==='img'?'img':tag});
  }catch{}
  const counts=report.errors.resourceByCategory||={};counts[category]=(counts[category]||0)+1;
 }
 // Error locations are actionable without retaining messages, URLs or event content.
 function safeScript(value){try{const u=new URL(value,location.href);if(u.origin!==location.origin)return null;const script=[...document.scripts].find(n=>n.src&&new URL(n.src).pathname===u.pathname);return script&&/^\/(?:.*\/)?(?:js|vendor)\/[a-z0-9_-]+(?:\.min)?\.js$/i.test(u.pathname)?u.pathname.split('/').pop():null;}catch{return null;}}
 function recordError(kind,event){
  const error=event?.error||event?.reason,name=String(error?.name||''),type=['TypeError','ReferenceError','SyntaxError','RangeError','URIError','EvalError','Error'].includes(name)?name:!error&&event?.message==='Script error.'?'OpaqueScriptError':'UnknownError';
  let file=safeScript(event?.filename),line=Number(event?.lineno)||0,column=Number(event?.colno)||0;
  if(!file&&typeof error?.stack==='string')for(const match of error.stack.slice(0,4000).matchAll(/(https?:\/\/[^\s()]+?):(\d+):(\d+)/g)){const found=safeScript(match[1]);if(found){file=found;line=Number(match[2]);column=Number(match[3]);break;}}
  const rows=report.errorLocations||=[],same=rows.find(r=>r.kind===kind&&r.type===type&&r.file===file&&r.line===line&&r.column===column);
  if(same){same.count++;same.lastAt=new Date().toISOString();}else if(rows.length<32)rows.push({kind,type,file,line,column,count:1,lastAt:new Date().toISOString(),opaque:!error&&!file&&line===0,emscPending:window.EmscJsonpGuard?.stats?.().active||0});else report.errorLocationsOmitted=(report.errorLocationsOmitted||0)+1;
 }
 const workerRoutes=new Set('/tts /weatherapi /redemet-metar /v70-impact /population-exposure /rupture-shaking /rain-weather /rain-nowcast /rainbow-snapshot /sp-clima /global-feeds /global-volcano /usgs-volcano /gdacs-volcano /gdacs-floods /afad-earthquakes /ingv-earthquakes /jma-earthquakes /funvisis-earthquakes /seismic-status /official-weather-alerts /cge-bulletins /metar-observed /tsunami-alerts /v70-cyclones /v70-extremes /v70-anomalies'.split(' '));
 const providers={'api.orhanaydogdu.com.tr':'afad','deprem-api.vercel.app':'afad','www.ovsicori.una.ac.cr':'ovsicori','www.ssn.unam.mx':'ssn','moho.iag.usp.br':'usp','geofon.gfz-potsdam.de':'geofon','photon.komoot.io':'photon','overpass-api.de':'overpass','overpass.kumi.systems':'overpassMirror','overpass.openstreetmap.ru':'overpassMirror','nominatim.openstreetmap.org':'nominatim','www.seismicportal.eu':'emsc','earthquake.usgs.gov':'usgs','api.open-meteo.com':'openMeteo','api.weather.gov':'nws','www.gdacs.org':'gdacs','www.jma.go.jp':'jma','www.nhc.noaa.gov':'nhc','volcanoes.usgs.gov':'usgsVolcano','servicos.cptec.inpe.br':'cptec'};
 function network(input,response,failure){
  if(!active)return;let u;try{u=new URL(typeof input==='string'?input:input.url,location.href);}catch{return;}if(u.hostname!=='black-sky-9ba0.terrestre.workers.dev')return;
  let route=workerRoutes.has(u.pathname)?u.pathname:u.pathname==='/'?'proxy':'other',provider='other';
  if(route==='proxy')try{provider=providers[new URL(u.searchParams.get('url')).hostname]||'other';}catch{}
  const rows=report.workerRequests||=[];let row=rows.find(r=>r.route===route&&r.provider===provider);if(!row){if(rows.length>=31){route=provider='other';row=rows.find(r=>r.route===route&&r.provider===provider);}if(!row){row={route,provider,attempts:0,statuses:{},networkErrors:0,aborts:0,cooldownResponses:0};rows.push(row);}}
  row.attempts++;if(failure){row[failure==='abort'?'aborts':'networkErrors']++;return;}
  const status=Number(response?.status);const key=status>=100&&status<=599?String(Math.floor(status)):'unknown';row.statuses[key]=(row.statuses[key]||0)+1;
  if(response?.headers?.get('X-Monitor-Source-State')==='unavailable')row.cooldownResponses++;
 }
 const sourceNames=new Set('USGS|EMSC|JMA|IGP|GDACS enchentes|GDACS ciclones|GDACS vulcões|GDACS incêndios|NHC|INMET|NWS|OpenMeteo|EONET incêndios|EONET tempestades|RainbowWeather|RainbowTiles|RainViewer|Chuva SP · modelo (Open-Meteo)|CPTEC|CGE|AFAD|REDEMET|USP|USGS-Volcano|VAAC-Global|OVSICORI|MARN-SV|GEOFON|OSC-BOL|BMKG|GEONET|FUNVISIS|INPE|CSN-Chile|SSN-Mexico|ANA'.split('|'));
 function sourceDetails(){
  const snapshot=window.SourceHealth?.snapshot?.()||{},now=Date.now(),previous=report.sourceDetails||{};report.sourceTransitions||=[];const next={};
  for(const name of sourceNames){const raw=snapshot[name];if(!raw)continue;const state=window.SourceHealth?.get?.(name)||raw,status=['ok','warn','off','paused','unknown'].includes(state.status)?state.status:'unknown',cooling=state.openUntil>now;
   next[name]={status,cooling,suppressed:Math.max(0,Number(state.suppressedCount)||0),retryInMs:Math.max(0,(state.openUntil||0)-now),failures:Math.max(0,Number(state.fails)||0),successes:Math.max(0,Number(state.okCount)||0),failedAttempts:Math.max(0,Number(state.failCount)||0),lastSuccessAgeMs:state.lastOk?Math.max(0,now-state.lastOk):null};
   if(previous[name]&&(previous[name].status!==status||previous[name].cooling!==cooling))report.sourceTransitions.push({at:new Date().toISOString(),source:name,status,cooling});
  }
  report.sourceDetails=next;if(report.sourceTransitions.length>128)report.sourceTransitions.splice(0,report.sourceTransitions.length-128);
 }
 function sessionWindow(){const r=report.resources;return {visibleMs:report.visibleMs,hiddenMs:report.hiddenMs,longTaskCount:report.longTasks.count,longTaskMs:report.longTasks.totalMs,maxLongTaskMs:report.longTasks.maxMs,frameCount:report.frames.frames,frameElapsedMs:report.frames.elapsedMs,resources:r.count,httpErrors:r.httpErrors,resourceCounts:Object.fromEntries(Object.entries(r.byCategory||{}).map(([k,v])=>[k,v.count])),workerAttempts:(report.workerRequests||[]).reduce((n,r)=>n+r.attempts,0)};}
 function viewport(){return {width:innerWidth,height:innerHeight,dpr:devicePixelRatio,coarsePointer:matchMedia('(pointer:coarse)').matches};}
 function memoryOwners(){return {aftershockSequence:window.AftershockSequence?.stats?.()||null,warningAreas:window.WeatherWarningCamera?.stats?.()||null,mapRecovery:window.AppRecovery?.state?.()||null,quakeReports:window.SismoReportMemory?.stats?.()||null,audio:window.AudioLifecycle?.stats?.()||null,sourceRendering:window.SourceRenderBudget?.stats?.()||null,seismicGeometry:window.SeismicImpact?.stats?.()||null,shaking:window.RuptureShaking?.stats?.()||null,eventProducts:window.EventProducts?.stats?.()||null,mapTiles:window.MapRenderBudget?.stats?.()||null,openMeteo:window.OpenMeteoCache?.stats?.()||null,browserRequests:window.BrowserRequestBudget?.stats?.()||null,emscJSONP:window.EmscJsonpGuard?.stats?.()||null,resourceTimingEntries:performance.getEntriesByType('resource').length};}
 function owner(node){const n=node?.nodeType===1?node:node?.parentElement;if(!n?.closest)return 'other';if(n.closest('.maplibregl-marker'))return 'markers';if(n.closest('.seismic-scene'))return 'seismic';if(n.closest('#site-effect-demo-canvas,.site-effect-floats'))return 'screenEffect';if(n.closest('#painel-direito'))return 'mainCard';if(n.closest('#sidebar-left'))return 'records';if(n.closest('#mapContainer'))return 'map';return 'other';}
 function breakdown(nodes,target=n=>n){const counts={};for(const n of nodes){const k=owner(target(n));counts[k]=(counts[k]||0)+1;}return counts;}
 function peaks(state){if(!state)return;const p=report.renderingPeaks||={markers:0,canvases:0,animations:0,canvasByOwner:{},animationByOwner:{}};for(const key of ['markers','canvases','animations','runningAnimations'])p[key]=Math.max(p[key]||0,state[key]||0);for(const key of ['canvasByOwner','animationByOwner'])for(const [k,n]of Object.entries(state[key]||{}))p[key][k]=Math.max(p[key][k]||0,n);}
 function renderingState(){
  try{const canvases=[...document.querySelectorAll('canvas')],animations=document.getAnimations?.()||[];const m=typeof map!=='undefined'?map:null,style=m?.getStyle?.();return {mapSources:style?Object.keys(style.sources||{}).length:null,mapLayers:style?.layers?.length??null,mapImages:m?.listImages?.().length??null,mapPixelRatio:m?.getPixelRatio?.()??null,markers:document.querySelectorAll('.maplibregl-marker').length,canvases:canvases.length,canvasByOwner:breakdown(canvases),animations:animations.length,runningAnimations:animations.filter(a=>a.playState==='running'||a.pending).length,animationByOwner:breakdown(animations,a=>a.effect?.target),economy:window.MobileEnergyBudget?.economy?.()??null,budget:window.MobileEnergyBudget?.mobile?.()??null};}catch{return null;}
 }
 function capabilities(){return {longTasks:typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')||false,jsMemory:Number.isFinite(performance.memory?.usedJSHeapSize),resourceTiming:typeof PerformanceObserver!=='undefined'&&PerformanceObserver.supportedEntryTypes?.includes('resource')||false};}
 function navigation(){const n=performance.getEntriesByType('navigation')[0];return n?{domContentLoadedMs:round(n.domContentLoadedEventEnd),loadMs:round(n.loadEventEnd),type:n.type}:null;}
 function create(){return {schema:1,collectorVersion:7,startedAt:new Date().toISOString(),updatedAt:null,active:false,pageVisits:0,visibleMs:0,hiddenMs:0,unobservedGapMs:0,capabilities:capabilities(),device:{userAgent:navigator.userAgent.slice(0,240),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},deviceMemoryGB:navigator.deviceMemory||null,hardwareConcurrency:navigator.hardwareConcurrency||null},navigation:navigation(),longTasks:{count:0,totalMs:0,maxMs:0},frames:{windows:0,frames:0,elapsedMs:0,slowIntervals:0,maxIntervalMs:0},errors:{javascript:0,unhandledRejection:0,resource:0,map:0,webglContextLost:0},resources:{count:0,totalMs:0,httpErrors:0,httpStatusAvailable:false,byCategory:{},categoryCount:0},samples:[],limitations:['Relatório local: sem envio automático, sem coordenadas, textos de erro, URLs ou conteúdo dos eventos.','Falhas guardam somente tipo, arquivo local conhecido e linha; textos e pilhas completas são descartados.', 'Memória refere-se somente ao heap JavaScript quando disponibilizado; não inclui GPU, abas, workers ou consumo total do aparelho.','Fluidez amostrada por 1 segundo a cada minuto com a página visível; não é medição contínua nem prova de FPS do mapa.','Pausas longas do navegador são separadas do tempo observado. Não é possível medir uso com o navegador fechado.','Categorias de recursos são contadores locais; não equivalem a operações Durable/KV. Tamanhos podem ser ocultados por fontes externas. A memória pode ser aproximada e atualizada em degraus pelo navegador.','Tarefas longas e códigos HTTP dependem do suporte do navegador; ausência de registros não comprova ausência de falhas.']};}
 function account(){const now=performance.now();if(lastTick){const delta=Math.max(0,now-lastTick);if(delta>120000)report.unobservedGapMs+=delta;else report[lastVisible?'visibleMs':'hiddenMs']+=delta;}lastTick=now;lastVisible=!document.hidden;}
 function save(){if(!report)return;report.updatedAt=new Date().toISOString();report.active=active;try{localStorage.setItem(KEY,JSON.stringify(report));storageOk=true;}catch{storageOk=false;}}
 function sample(){
  report.features={boundedWeatherCache:!!window.OpenMeteoCache,requestCooldown:!!window.BrowserRequestBudget?.stats,jsonpGuard:!!window.EmscJsonpGuard};
  const heap=performance.memory?.usedJSHeapSize;
  const health=window.SourceHealth?.summary?.();sourceDetails();
  report.samples.push({at:new Date().toISOString(),runtimeVersion:'session-stability-v10',jsHeapMiB:Number.isFinite(heap)?round(heap/1048576):null,jsTotalHeapMiB:Number.isFinite(performance.memory?.totalJSHeapSize)?round(performance.memory.totalJSHeapSize/1048576):null,jsHeapLimitMiB:Number.isFinite(performance.memory?.jsHeapSizeLimit)?round(performance.memory.jsHeapSizeLimit/1048576):null,domElements:document.getElementsByTagName('*').length,canvases:document.getElementsByTagName('canvas').length,rendering:renderingState(),memoryOwners:memoryOwners(),windowTotals:sessionWindow(),viewport:viewport(),sources:health?{ok:health.ok,warn:health.warn,off:health.off,cooling:health.cooling,total:health.total}:null,online:navigator.onLine});
  peaks(report.samples.at(-1).rendering);if(report.samples.length>LIMIT)report.samples.splice(0,report.samples.length-LIMIT);lastSample=performance.now();
 }
 function endFrames(){cancelAnimationFrame(raf);clearTimeout(frameTimer);raf=frameTimer=null;}
 function frames(){
  if(document.hidden||raf!==null)return;const start=performance.now();let previous=null,count=0;
  const step=now=>{if(!active||document.hidden){endFrames();return;}if(previous!==null){const gap=now-previous;report.frames.maxIntervalMs=Math.max(report.frames.maxIntervalMs,round(gap));if(gap>50)report.frames.slowIntervals++;}previous=now;count++;
   if(now-start<1000)raf=requestAnimationFrame(step);else{report.frames.windows++;report.frames.frames+=count;report.frames.elapsedMs+=now-start;endFrames();}};
  raf=requestAnimationFrame(step);frameTimer=setTimeout(endFrames,2000);
 }
 const mapError=()=>{if(active)report.errors.map++;};
 function attachMap(){let m;try{m=typeof map!=='undefined'?map:null;}catch{}if(m&&m!==mapRef){mapRef?.off?.('error',mapError);mapRef=m;m.on?.('error',mapError);}}
 function tick(){if(!active)return;account();attachMap();if(!document.hidden)peaks(renderingState());if(!document.hidden&&performance.now()-lastSample>=300000)sample();frames();save();render();}
 function observe(type,fn){if(!PerformanceObserver.supportedEntryTypes?.includes(type))return;try{const o=new PerformanceObserver(list=>{if(active)fn(list.getEntries());});o.observe({type,buffered:false});observers.push(o);}catch{}}
 function start(resume=false){
  if(active)return;if(!resume||!report)report=create();active=true;report.pageVisits++;report.collectorVersion=7;report.features={boundedWeatherCache:!!window.OpenMeteoCache,requestCooldown:!!window.BrowserRequestBudget?.stats,jsonpGuard:!!window.EmscJsonpGuard};report.requestDetailsStartedAt||=new Date().toISOString();report.errorLocationsStartedAt||=new Date().toISOString();report.renderingPeaksStartedAt||=new Date().toISOString();report.resources.categoryStartedAt||=new Date().toISOString();report.capabilities=capabilities();report.navigation=navigation();lastTick=performance.now();lastVisible=!document.hidden;
  if(typeof PerformanceObserver!=='undefined'){
   observe('longtask',entries=>{if(document.hidden)return;for(const e of entries){const buckets=report.longTasks.buckets||={under100:0,under250:0,under1000:0,over1000:0};buckets[e.duration<100?'under100':e.duration<250?'under250':e.duration<1000?'under1000':'over1000']++;report.longTasks.count++;report.longTasks.totalMs+=round(e.duration);report.longTasks.maxMs=Math.max(report.longTasks.maxMs,round(e.duration));}});
   observe('resource',resourceEntries);
  }
  attachMap();if(!document.hidden)sample();frames();timer=setInterval(tick,60000);save();render();
 }
 function stop(){if(!active)return;account();active=false;clearInterval(timer);timer=null;endFrames();observers.forEach(o=>o.disconnect());observers=[];mapRef?.off?.('error',mapError);mapRef=null;save();render();}
 function snapshot(){if(!report)return null;if(active){account();report.features={boundedWeatherCache:!!window.OpenMeteoCache,requestCooldown:!!window.BrowserRequestBudget?.stats,jsonpGuard:!!window.EmscJsonpGuard};save();}return JSON.parse(JSON.stringify(report));}
 function download(){const data=snapshot();if(!data)return;const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='monitor-global-diagnostico-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function render(){if(!dialog?.open)return;const out=dialog.querySelector('output');if(!report)out.textContent='Ainda não há medições. Toque em Iniciar e use o site normalmente.';
  else{const heap=report.samples.at(-1)?.jsHeapMiB;out.textContent=(active?'Diagnóstico ativo':'Diagnóstico parado')+' · versão '+report.collectorVersion+'\nTempo visível observado: '+Math.floor(report.visibleMs/60000)+' min\nTempo em segundo plano observado: '+Math.floor(report.hiddenMs/60000)+' min\nPausas não observadas: '+Math.floor(report.unobservedGapMs/60000)+' min\nTarefas acima de 50 ms: '+(report.capabilities.longTasks?report.longTasks.count:'não disponível neste navegador')+'\nHeap JavaScript: '+(heap==null?'não disponível neste navegador':heap+' MiB')+'\nErros de código: '+(report.errors.javascript+report.errors.unhandledRejection)+' · mapa: '+report.errors.map+' · recursos: '+report.errors.resource+'\nAmostras guardadas: '+report.samples.length+'/'+LIMIT;}
  dialog.querySelector('[data-diagnostic-toggle]').textContent=active?'Parar diagnóstico':report?'Iniciar nova medição':'Iniciar diagnóstico';dialog.querySelector('[data-diagnostic-export]').disabled=!report;
  dialog.querySelector('[data-diagnostic-storage]').textContent=storageOk?'Guardado neste navegador. Para analisar, exporte o arquivo e envie na conversa.':'O navegador bloqueou a gravação local. Exporte antes de fechar a página.';
 }
 function open(){opener=document.activeElement;if(!dialog){dialog=document.createElement('dialog');dialog.id='mg-performance-dialog';dialog.className='mg-local-dialog';dialog.setAttribute('aria-labelledby','mg-performance-title');dialog.innerHTML='<h2 id="mg-performance-title">Desempenho no aparelho</h2><p>Ative e use o site normalmente durante algumas horas. A coleta fica neste navegador e continua após fechar esta janela.</p><output></output><p class="mg-diagnostic-note">Amostras leves: fluidez por 1 segundo a cada minuto; memória e elementos a cada 5 minutos, com a tela visível. Não mede bateria, memória total ou FPS contínuo do globo. Nenhum teste de alerta é disparado.</p><p class="mg-diagnostic-note" data-diagnostic-storage></p><button type="button" data-diagnostic-toggle></button><button type="button" data-diagnostic-export>Exportar relatório</button><button type="button" data-diagnostic-clear>Apagar relatório</button><button type="button" data-diagnostic-close>Fechar</button>';
   dialog.querySelector('[data-diagnostic-toggle]').onclick=()=>active?stop():start();dialog.querySelector('[data-diagnostic-export]').onclick=download;dialog.querySelector('[data-diagnostic-clear]').onclick=()=>{stop();report=null;try{localStorage.removeItem(KEY);}catch{}render();};dialog.querySelector('[data-diagnostic-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>(opener?.isConnected&&opener.getClientRects().length?opener:document.getElementById('fab-menu'))?.focus({preventScroll:true}));document.body.append(dialog);
  }if(!dialog.open)dialog.showModal();if(active)account();render();}
 document.addEventListener('click',e=>{if(e.target.closest?.('#performance-diagnostics-menu'))open();});
 document.addEventListener('visibilitychange',()=>{if(!active)return;account();endFrames();save();});
 window.addEventListener('pagehide',()=>{if(active){account();endFrames();save();}});
 window.addEventListener('load',()=>setTimeout(()=>{if(active){report.navigation=navigation();save();}},0),{once:true});
 window.addEventListener('pageshow',()=>{if(active){lastTick=performance.now();lastVisible=!document.hidden;}});
 window.addEventListener('error',e=>{if(active){const kind=e.target===window?'javascript':'resource';report.errors[kind]++;if(kind==='javascript')recordError(kind,e);else resourceFailure(e.target);}},true);
 window.addEventListener('unhandledrejection',e=>{if(active){report.errors.unhandledRejection++;recordError('unhandledRejection',e);}});
 document.addEventListener('webglcontextlost',()=>{if(active)report.errors.webglContextLost++;},true);
 // Only our own bounded, versioned report can be resumed. Only sanitized local script locations are retained, never error text or URLs.
 try{const saved=localStorage.getItem(KEY);if(saved&&saved.length<1000000){const r=JSON.parse(saved);if(r.schema===1&&Array.isArray(r.samples)&&r.samples.length<=LIMIT&&r.errors&&r.frames&&r.resources&&r.longTasks&&r.device){report=r;if(r.active)start(true);}}}catch{}
 window.PerformanceDiagnostics={network,open,start:()=>start(),stop,snapshot,download};
})();
