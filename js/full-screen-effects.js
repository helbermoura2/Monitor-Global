/* Approved live overlays. Presentation only: no feeds, camera, audio or alerts. */
(function(root){'use strict';
 const allowed=new Set(['lava','rain','quake']),seen=new Map(),episodes=new Map(),priority={rain:1,lava:2,quake:3};
 let serial=0,active=null;
 const reduced=()=>root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const selected=id=>typeof eventoSelecionadoId!=='undefined'&&eventoSelecionadoId===id;
 function stop(kind){if(kind&&active?.kind!==kind)return;serial++;active=null;if(root.SiteEffectDemo?.state?.()?.live)root.SiteEffectDemo.stop();}
 async function play(kind,key,current,options={}){
  if(!allowed.has(kind)||document.hidden||reduced()||seen.has(key)||!current()||root.CardEffectDemo?.isActive())return false;
  if(active&&active.until>Date.now()&&priority[active.kind]>priority[kind])return false;
  if(active?.key===key&&active.until>Date.now())return false;
  stop();const token=++serial;active={kind,key,until:Date.now()+(kind==='quake'?24000:10000)};
  try{await root.OptionalFeatures.siteEffectDemo();if(token!==serial||document.hidden||reduced()||!current()||root.CardEffectDemo?.isActive()){if(token===serial)active=null;return false;}
   const ok=root.SiteEffectDemo.start(kind,{live:true,...options});if(!ok){if(token===serial)active=null;return false;}
   active.until=Date.now()+root.SiteEffectDemo.durationFor(kind);seen.set(key,Date.now());while(seen.size>128)seen.delete(seen.keys().next().value);return true;
  }catch(e){if(token===serial)active=null;console.warn('[efeito de tela inteira]',e.message);return false;}
 }
 function quake(item,mode){if(!item||item.__cinemaDemo||!Number.isFinite(Number(item.mag))||Number(item.mag)<8||mode==='auto')return Promise.resolve(false);return play('quake','quake|'+item.id+'|'+item.time,()=>selected(item.id));}
 function volcano(item,cfg){
  if(!item||item.__cinemaDemo||item.type!=='volcano')return Promise.resolve(false);
  const evidence=root.VolcanoPriority?.evidence(item);
  if(!cfg?.lava&&!evidence?.explosive)return Promise.resolve(false);
  const version=item.noticeId||item.eruptionStart||item._updatedAt||item.time||'episode';
  return play('lava','lava|'+item.id+'|'+version,()=>selected(item.id)&&root.CinematicCard?.isShowing(item.id,'volcano'));
 }
 function rain(summary,candidate){
  if(summary?.provider!=='rainbow'||!summary.loc||typeof weatherLoc==='undefined')return;
  if(Math.abs(summary.loc.lat-weatherLoc.lat)>.002||Math.abs(summary.loc.lng-weatherLoc.lng)>.002||!Number.isFinite(summary.consultedAt)||Date.now()-summary.consultedAt>1200000||summary.consultedAt>Date.now()+60000)return;
  const key=summary.loc.lat.toFixed(3)+','+summary.loc.lng.toFixed(3),now=Date.now();let episode=episodes.get(key);
  if(summary.status==='dry'||summary.status==='soon'){if(episode){episode.drySince=episode.drySince||now;if(now-episode.drySince>=1200000){seen.delete('rain|'+key);episodes.delete(key);}}if(active?.kind==='rain')stop('rain');return;}
  const c=candidate||root.RainArrivalNotice?.candidate(summary);if(!c?.now||summary.status!=='now')return;
  if(!episode||now-episode.lastWet>21600000){seen.delete('rain|'+key);episode={lastWet:now,drySince:0};episodes.set(key,episode);}episode.lastWet=now;episode.drySince=0;
  const current=()=>{const q=root.EventStore?.getSelected?.();return !document.hidden&&Math.abs(summary.loc.lat-weatherLoc.lat)<.002&&Math.abs(summary.loc.lng-weatherLoc.lng)<.002&&Number(q?.mag||0)<5&&q?.type!=='tsunami'&&!(typeof getAutoCycleProtectionRemaining==='function'&&getAutoCycleProtectionRemaining()>0);};
  const weather=root.WeatherDataStatus?.state('current');
  const lightning=(!weather||weather.status==='updated')&&[95,96,99].includes(Number(root.__proWeather?.code))||!!root.__weatherEvidenceState?.measured?.tempestade;
  const rate=Number(summary.rate??summary.series?.find(p=>p.start<=now&&p.end>now)?.rate)||.1;
  return play('rain','rain|'+key,current,{lightning,rate});
 }
 function suspend(){const quake=active?.kind==='quake';stop();if(quake)root.SeismicCinema?.stop();}
 document.addEventListener('DOMContentLoaded',()=>root.EventStore?.subscribe(reason=>{if(reason==='select')suspend();}));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();});document.addEventListener('keydown',e=>{if(e.key==='Escape')suspend();});root.addEventListener('pagehide',suspend);
 root.FullScreenEffects={quake,volcano,rain,stop,state:()=>active&&active.until>Date.now()?{...active}:null};
})(window);
