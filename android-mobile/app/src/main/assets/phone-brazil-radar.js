/* Optional historical radar tiles. No synthetic future frames, no background traffic.
   Personal / educational use subject to RainViewer attribution and availability. */
(function(root){'use strict';
function create(map,host) {
 let enabled=false,closed=false,active=true,frames=[],index=0,playTimer=0,lastFetch=0,request=null,sourceTime=0;
 const source='br-historical-radar',layer='br-historical-radar-layer';
 const panel=document.createElement('section');panel.className='radar-control';panel.hidden=true;
 panel.setAttribute('aria-label','Radar meteorológico observado');
 const actions=document.createElement('div');actions.className='radar-actions';
 const play=document.createElement('button');play.type='button';play.textContent='▶ Animar';play.disabled=true;
 const latest=document.createElement('button');latest.type='button';latest.textContent='Atualizar radar';
 const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='0';slider.value='0';slider.disabled=true;slider.setAttribute('aria-label','Horário do radar');
 const status=document.createElement('small');status.setAttribute('role','status');
 const credit=document.createElement('small');const link=document.createElement('a');link.href='https://www.rainviewer.com/';link.textContent='RainViewer';link.target='_blank';link.rel='noopener';
 credit.append('Radar observado · ',link,' · cobertura variável, sem previsão futura');
 actions.append(play,latest);panel.append(actions,slider,status,credit);host.appendChild(panel);
 function message(text){status.textContent=text;}
 function stop(){clearTimeout(playTimer);playTimer=0;play.textContent='▶ Animar';}
 function clear(){if(map.getLayer(layer))map.removeLayer(layer);if(map.getSource(source))map.removeSource(source);}
 function show(n){
  if(!enabled||!active||closed||!frames[n]||!map.isStyleLoaded())return;
  stop();index=n;slider.value=String(n);const frame=frames[n];
  clear();map.addSource(source,{type:'raster',tiles:['https://tilecache.rainviewer.com'+frame.path+'/256/{z}/{x}/{y}/2/1_1.png'],tileSize:256,minzoom:0,maxzoom:6,attribution:'Radar: RainViewer'});
  map.addLayer({id:layer,type:'raster',source,paint:{'raster-opacity':0.75,'raster-fade-duration':0}});
  sourceTime=frame.time*1000;
  message('Radar observado: '+new Date(sourceTime).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' BRT · sem cobertura garantida');
 }
 async function update(force=false){
  if(!active||closed||!enabled||request)return;
  const now=Date.now();if(now-lastFetch<10*60000){message('Radar consultado recentemente. Use os quadros disponíveis.');return;}
  lastFetch=now;const c=new AbortController();request=c;const timer=setTimeout(()=>c.abort(),10000);
  message('Consultando radar histórico…');
  try{
   const r=await fetch('https://api.rainviewer.com/public/weather-maps.json',{signal:c.signal,credentials:'omit',redirect:'error'});
   if(!r.ok||Number(r.headers.get('content-length')||0)>30000)throw Error('indisponível');
   const raw=await r.text();if(raw.length>30000)throw Error('dados grandes');
   const data=JSON.parse(raw);if(data.host!=='https://tilecache.rainviewer.com'||!Array.isArray(data.radar?.past))throw Error('metadata inválida');
   const good=data.radar.past.filter(f=>Number.isSafeInteger(f.time)&&f.time*1000<=now+60000&&now-f.time*1000<3*3600000&&/^\/v2\/radar\/[0-9]{9,12}$/.test(f.path)).sort((a,b)=>a.time-b.time).slice(-6);
   if(!good.length)throw Error('sem imagens recentes');
   frames=good;slider.max=String(good.length-1);slider.disabled=good.length<2;play.disabled=good.length<2;
   if(active&&enabled)show(good.length-1);
  }catch(e){if(active&&enabled)message('Radar temporariamente indisponível ou sem quadros recentes.');}
  finally{clearTimeout(timer);if(request===c)request=null;}
 }
 function tick(){if(!enabled||!active||closed||frames.length<2)return;index=(index+1)%frames.length;show(index);play.textContent='Ⅱ Pausar';playTimer=setTimeout(tick,6500);}
 function toggle(next){if(closed)return;enabled=next;panel.hidden=!next;stop();if(!next){request?.abort();clear();return;}if(frames.length){show(index);}else update();}
 play.addEventListener('click',()=>{if(playTimer){stop();return;}if(frames.length>1){tick();}});
 slider.addEventListener('input',()=>show(Number(slider.value)));
 latest.addEventListener('click',()=>update(true));
 const api={toggle, get enabled(){return enabled;},setActive(v){active=v;if(!v){stop();request?.abort();}else if(enabled){if(frames.length)show(index);else update();}},destroy(){if(closed)return;closed=true;enabled=false;stop();request?.abort();clear();panel.remove();}};
 return api;
}
root.PhoneBrazilRadar={create};
})(window);
