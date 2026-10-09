/* One recent official weather bulletin for São Paulo. No SMS, siren, or camera takeover. */
(function(){
 const prefix='cge-bulletin-';let fetching=false;
 function fromBulletin(row,now=Date.now()){
  if(!row||!/^\d+$/.test(row.sourceId)||!Number.isFinite(row.time)||row.time>now+300000||!Number.isFinite(row.displayUntil)||row.displayUntil<=now||typeof row.description!=='string'||typeof row.title!=='string')return null;
  return {id:prefix+row.sourceId,type:'storm',hazardNature:'bulletin',displayLabel:'BOLETIM CGE',icon:'📰',place:'São Paulo, Brasil',pais:'Brasil',uf:'SP',bandeira:'🇧🇷',coords:[-46.6333,-23.5505],time:row.time,displayUntil:row.displayUntil,source:'CGE',detail:row.title,bulletinSummary:String(row.summary||''),warningDescription:row.description,link:'https://www.cgesp.org/v3/noticias.jsp?id='+row.sourceId,locationNote:'Boletim municipal. O marcador representa São Paulo, não a localização exata da chuva. Relatos e previsões mantêm o texto da fonte; não confirmam alagamentos nem reproduzem o SMS da Defesa Civil.'};
 }
 async function refresh(){
  if(fetching)return;fetching=true;
  try{
   const base=typeof workerBaseUrl==='function'?workerBaseUrl():'https://black-sky-9ba0.terrestre.workers.dev';
   const r=await fetch(base+'/cge-bulletins',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
   const d=await r.json();if(d.ok!==true||!Array.isArray(d.items))throw Error('Resposta inválida');
   const rows=d.items.map(x=>fromBulletin(x)).filter(Boolean).sort((a,b)=>b.time-a.time).slice(0,1);
   globalAlerts=globalAlerts.filter(x=>!String(x.id).startsWith(prefix));rows.forEach(x=>upsertAlert(x,{fonte:'cgeBulletin',expiraMs:0}));
   marcarBooted('cgeBulletin');applyFilters();
   try{setSource('CGE boletins','ok');}catch(e){}
  }catch(e){try{setSource('CGE boletins','off',null,e.message);}catch(_){} }
  finally{fetching=false;}
 }
 function expire(){const n=globalAlerts.length;globalAlerts=globalAlerts.filter(x=>!String(x.id).startsWith(prefix)||x.displayUntil>Date.now());if(n!==globalAlerts.length)applyFilters();}
 document.addEventListener('DOMContentLoaded',()=>{PeriodicScheduler.every('cge-bulletins',refresh,12000,180000);PeriodicScheduler.every('cge-expiry',expire,60000,60000,'ui');});
 window.CgeBulletins={refresh,fromBulletin,expire};
})();
