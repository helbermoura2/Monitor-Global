/* Sampled observations and official warnings. Forecasts never become observed events. */
(function(){
 const airports='KJFK,KBOS,KMIA,KORD,KDFW,KDEN,KLAX,KSEA,PHNL,PANC,CYYZ,CYVR,MMMX,MMUN,SBSP,SBGR,SBGL,SBSV,SBRF,SBBR,SBPA,SBMN,SAEZ,SCEL,SPJC,SKBO,SEQM,EGLL,LFPG,EDDF,LEMD,LPPT,LIRF,EHAM,ESSA,ENGM,LGAV,LTBA,OMDB,VIDP,VABB,VTBS,WSSS,WMKK,WIII,RJTT,RKSI,ZBAA,YSSY,YMML,NZAA,FAOR,FACT,HECA,HKJK';
 const base=()=>typeof workerBaseUrl==='function'?workerBaseUrl():'https://black-sky-9ba0.terrestre.workers.dev';
 function ingest(prefix,rows){
  const ids=new Set(rows.map(x=>x.id));
  globalAlerts=globalAlerts.filter(x=>!String(x.id).startsWith(prefix)||ids.has(x.id));
  rows.forEach(x=>upsertAlert(x,{fonte:prefix,expiraMs:0}));
  marcarBooted(prefix);applyFilters();
 }
 async function observed(){try{
  const r=await fetch(base()+'/metar-observed?ids='+airports);if(!r.ok)throw Error('HTTP '+r.status);
  const d=await r.json();if(!Array.isArray(d.stations))throw Error('Sem estações');
  ingest('metar-',d.stations.flatMap(x=>HazardEvidence.metar(x)));
  try{setSource('NOAA METAR','ok');}catch(e){}
 }catch(e){try{setSource('NOAA METAR','off',null,e.message);}catch(_){} }}
 async function warnings(){try{
  const r=await fetchWithCorsFallback('https://api.weather.gov/alerts/active?status=actual');if(!r.ok)throw Error('HTTP '+r.status);
  const d=await r.json();if(!Array.isArray(d.features))throw Error('Sem avisos');
  ingest('nws-weather-',d.features.map(x=>HazardEvidence.nws(x)).filter(Boolean));
  try{setSource('NWS','ok');}catch(e){}
 }catch(e){try{setSource('NWS','off',null,e.message);}catch(_){} }}
 // Even if a provider fails, an expired warning/observation cannot remain active.
 setInterval(()=>{const now=Date.now(),n=globalAlerts.length;globalAlerts=globalAlerts.filter(x=>!x.expiresAt||x.expiresAt>now);if(n!==globalAlerts.length)applyFilters();},60000);
 document.addEventListener('DOMContentLoaded',()=>{setTimeout(observed,18000);setTimeout(warnings,24000);setInterval(observed,300000);setInterval(warnings,300000);});
 window.HazardFeeds={observed,warnings};
})();
