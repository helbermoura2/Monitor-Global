/* Historical observed radar. Provider paths are opaque identifiers, not timestamps. */
(function(root){'use strict';
const ORIGIN='https://tilecache.rainviewer.com',FRAME_MS=6500,CACHE_MS=10*60000,RETRY_MS=30000;
function parseMetadata(data,now=Date.now()){
 if(!data||data.host!==ORIGIN||!Array.isArray(data.radar?.past)||data.radar.past.length>40)return [];
 const unique=new Map();for(const f of data.radar.past){if(f&&Number.isSafeInteger(f.time)&&f.time>0&&f.time*1000<=now+60000&&now-f.time*1000<3*3600000&&typeof f.path==='string'&&/^\/v2\/radar\/[A-Za-z0-9_-]{1,64}$/.test(f.path))unique.set(f.time,{time:f.time,path:f.path});}
 return [...unique.values()].sort((a,b)=>a.time-b.time).slice(-6);
}
function tileUrl(frame){return ORIGIN+frame.path+'/256/{z}/{x}/{y}/2/1_1.png';}
function create(map,host,onChange=()=>{}){
 let enabled=false,closed=false,active=true,frames=[],index=0,playTimer=0,lastSuccess=0,lastAttempt=0,nextAttempt=0,request=null,sourceTime=0,ticket=0,wanted=-1,waiting=false,messageText='';
 const source='br-historical-radar',layer='br-historical-radar-layer';
 const panel=document.createElement('section');panel.className='radar-control';panel.hidden=true;panel.setAttribute('aria-label','Radar meteorológico observado');
 const heading=document.createElement('strong');heading.textContent='RADAR · CHUVA OBSERVADA';
 const actions=document.createElement('div');actions.className='radar-actions';
 const play=document.createElement('button');play.type='button';play.textContent='▶ Animar';play.disabled=true;play.dataset.radar='play';
 const latest=document.createElement('button');latest.type='button';latest.textContent='Atualizar radar';latest.dataset.radar='refresh';
 const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='0';slider.value='0';slider.disabled=true;slider.setAttribute('aria-label','Horário do radar');
 const status=document.createElement('small');status.setAttribute('role','status');status.dataset.radar='status';
 const credit=document.createElement('small'),link=document.createElement('a');link.href='https://www.rainviewer.com/';link.textContent='RainViewer';link.target='_blank';link.rel='noopener';
 credit.append('Radar observado · ',link,' · cobertura variável, sem previsão futura');
 const caution=document.createElement('small');caution.textContent='Áreas sem ecos podem estar sem cobertura. Isso não confirma ausência de chuva.';
 actions.append(play,latest);panel.append(heading,actions,slider,status,credit,caution);host.appendChild(panel);
 function notify(){onChange({enabled,sourceTime,loading:!!request,frames:frames.length,message:messageText});}
 function message(text){messageText=text;status.textContent=text;notify();}
 function stop(){clearTimeout(playTimer);playTimer=0;play.textContent='▶ Animar';}
 function clear(){if(map.getLayer(layer))map.removeLayer(layer);if(map.getSource(source))map.removeSource(source);sourceTime=0;}
 function fresh(){return frames.length&&Date.now()-frames.at(-1).time*1000<3*3600000;}
 function show(n,manual=true){
  if(manual)stop();if(!enabled||!active||closed||!frames[n])return;
  wanted=n;if(!map.isStyleLoaded()&&!map.getSource(source)){waiting=true;return;}
  waiting=false;index=n;slider.value=String(n);const frame=frames[n],tiles=[tileUrl(frame)],current=map.getSource(source);
  if(current&&typeof current.setTiles==='function')current.setTiles(tiles);
  else {clear();map.addSource(source,{type:'raster',tiles,tileSize:256,minzoom:0,maxzoom:7,attribution:'Radar: RainViewer'});map.addLayer({id:layer,type:'raster',source,paint:{'raster-opacity':0.75,'raster-fade-duration':0}});}
  sourceTime=frame.time*1000;
  message('Quadro de radar: '+new Date(sourceTime).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' BRT · '+(index+1)+'/'+frames.length);
 }
 function styleReady(){if(waiting&&enabled&&active&&!closed&&map.isStyleLoaded())show(wanted,false);}
 function tileError(event){if(enabled&&active&&event.sourceId===source){stop();message('Não foi possível carregar a imagem do radar. Toque em Atualizar radar para tentar novamente.');}}
 map.on('idle',styleReady);map.on('error',tileError);
 async function update(force=false){
  if(!active||closed||!enabled||request)return;
  const now=Date.now();if(!force&&fresh()&&now-lastSuccess<CACHE_MS){show(index);return;}if(!force&&now<nextAttempt){message(fresh()?'Mantendo os quadros disponíveis. Nova consulta em instantes.':'Falha na consulta anterior. Toque em Atualizar radar para tentar novamente.');return;}
  // Manual retries remain usable after failure/abort, but rapid taps cannot flood the provider.
  if(force&&now-lastAttempt<5000){message('Aguarde alguns segundos antes de consultar novamente.');return;}
  lastAttempt=now;const c=new AbortController(),id=++ticket;request=c;latest.disabled=true;notify();const timer=setTimeout(()=>c.abort(),10000);message('Consultando radar histórico…');
  try{
   const r=await fetch('https://api.rainviewer.com/public/weather-maps.json',{signal:c.signal,credentials:'omit',redirect:'error'});
   if(!r.ok||Number(r.headers.get('content-length')||0)>30000)throw Error('metadata unavailable');const raw=await r.text();if(raw.length>30000)throw Error('metadata oversized');const good=parseMetadata(JSON.parse(raw),Date.now());if(!good.length)throw Error('no recent frames');
   if(id!==ticket||closed||!active||!enabled)return;
   frames=good;lastSuccess=Date.now();nextAttempt=0;slider.max=String(good.length-1);slider.disabled=good.length<2;play.disabled=good.length<2;show(good.length-1);
  }catch(e){if(id===ticket&&!closed&&active&&enabled){nextAttempt=Date.now()+RETRY_MS;if(!fresh()){frames=[];slider.disabled=true;play.disabled=true;clear();}message(fresh()?'Falha na atualização. Mantendo o horário dos quadros disponíveis.':'Radar indisponível no momento. Toque em Atualizar radar para tentar novamente.');}}
  finally{clearTimeout(timer);if(request===c){request=null;latest.disabled=false;notify();}}
 }
 function cancel(){ticket++;lastAttempt=0;const old=request;request=null;latest.disabled=false;old?.abort();}
 function tick(){if(!enabled||!active||closed||frames.length<2||!fresh()){stop();return;}index=(index+1)%frames.length;show(index,false);play.textContent='Ⅱ Pausar';playTimer=setTimeout(tick,FRAME_MS);}
 function toggle(next){if(closed)return;enabled=!!next;panel.hidden=!enabled;stop();if(!enabled){cancel();clear();notify();return;}if(fresh())show(index);else update();notify();}
 play.addEventListener('click',()=>{if(playTimer){stop();return;}if(frames.length>1)tick();});slider.addEventListener('input',()=>show(Number(slider.value)));latest.addEventListener('click',()=>update(true));
 return {toggle,get enabled(){return enabled;},get state(){return {enabled,sourceTime,frames:frames.length,loading:!!request,message:messageText};},setActive(v){active=!!v;if(!active){stop();cancel();waiting=false;clear();}else if(enabled){if(fresh())show(index);else update();}},destroy(){if(closed)return;closed=true;enabled=false;stop();cancel();waiting=false;map.off('idle',styleReady);map.off('error',tileError);clear();panel.remove();}};
}
root.PhoneBrazilRadar={create,parseMetadata,tileUrl};
})(window);
