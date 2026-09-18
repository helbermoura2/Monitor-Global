(function(){
  'use strict';
  const cache=new Map(), inflight=new Map();
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function workerBase(){
    try{
      if(typeof WORKER_PROXY==='function'){
        const x=WORKER_PROXY('');
        return x.split('?')[0].replace(/\/$/,'');
      }
    }catch(e){}
    return '';
  }
  function ensureBox(){
    let b=document.getElementById('mg-correlation-box');
    if(b)return b;
    const impact=document.getElementById('pd-impact');
    if(!impact)return null;
    b=document.createElement('div');b.id='mg-correlation-box';
    impact.insertAdjacentElement('afterend',b);
    return b;
  }
  function renderLoading(item){
    const b=ensureBox();if(!b)return;
    b.className='';
    b.innerHTML='<div class="mg-corr-head"><span class="mg-corr-title">🧠 CORRELAÇÃO INTELIGENTE</span><span class="mg-corr-badge">ANALISANDO…</span></div><div class="mg-corr-score">Cruzando magnitude + profundidade + posição oceânica/costeira + produtos oficiais.</div>';
  }
  function render(item,data){
    const b=ensureBox();if(!b)return;
    const t=data?.tsunami||{};
    const level=t.level||'SEM DADO';
    const cls=level==='ALERTA OFICIAL'?'mg-risk-official':level==='ALTO'?'mg-risk-critical':level==='MODERADO'?'mg-risk-high':'';
    b.className=cls;
    const badge=level==='ALERTA OFICIAL'?'🌊 ALERTA OFICIAL':level==='ALTO'?'🌊 RISCO ALTO':level==='MODERADO'?'🟠 MODERADO':level==='ATENÇÃO'?'🟡 ATENÇÃO':'🟢 BAIXO';
    const factors=[];
    if(t.offshore)factors.push('🌊 Oceano/costa');
    if(t.shallow)factors.push('⬇️ Foco ≤30 km'); else if(t.intermediateShallow)factors.push('⬇️ Foco ≤70 km');
    if(Number(item.mag)>=7)factors.push('💥 M≥7'); else if(Number(item.mag)>=6.5)factors.push('💥 M≥6.5'); else if(Number(item.mag)>=6)factors.push('💥 M≥6');
    if(t.officialAlerts?.length)factors.push('📡 Produto oficial');
    const official=t.officialAlerts?.length?`<div class="mg-corr-official">📡 ${t.officialAlerts.length} produto(s) oficial(is) de tsunami encontrado(s). <a href="https://www.tsunami.gov/" target="_blank" rel="noopener" style="color:#67e8f9">Consultar tsunami.gov ↗</a></div>`:'';
    const near=t.nearestPlaceKm!=null?` · localidade de referência mais próxima: ~${Math.round(t.nearestPlaceKm)} km`:'';
    b.innerHTML=`<div class="mg-corr-head"><span class="mg-corr-title">🧠 CORRELAÇÃO INTELIGENTE</span><span class="mg-corr-badge">${badge}</span></div><div class="mg-corr-score">Índice automático: <b>${Math.round(t.score||0)}/100</b>${t.offshore?' · ambiente oceânico/costeiro':''}${near}</div><div class="mg-corr-grid">${(factors.length?factors:['Nenhum fator de tsunami dominante']).map(x=>`<div class="mg-corr-factor">${esc(x)}</div>`).join('')}</div><div class="mg-corr-action">${esc(t.action||'Sem interpretação disponível.')}</div>${official}<div class="mg-corr-note">⚠️ Triagem automática. Não confirma tsunami e não substitui alerta de autoridade competente. A ausência de alerta oficial não significa risco zero.</div>`;
  }
  async function correlate(item, silent=false){
    if(!item||item.type!=='earthquake'||!item.coords||Number(item.mag)<5.5)return null;
    const [lon,lat]=item.coords, depth=Number(item.depth)||0, mag=Number(item.mag)||0;
    const key=`${item.id}|${mag.toFixed(1)}|${depth.toFixed(0)}|${lat.toFixed(2)}|${lon.toFixed(2)}`;
    if(cache.has(key)){render(item,cache.get(key));return cache.get(key)}
    if(inflight.has(key))return inflight.get(key);
    if(!silent)renderLoading(item);
    const base=workerBase();if(!base)return null;
    const p=(async()=>{
      try{
        const u=base+'/correlate?mag='+encodeURIComponent(mag)+'&depth='+encodeURIComponent(depth)+'&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&place='+encodeURIComponent(item.place||'');
        const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
        const d=await r.json();cache.set(key,d);render(item,d);item.tsunamiCorrelation=d.tsunami;item.correlationLevel=d.tsunami?.level||null;try{if(typeof renderSidebarList==='function'&&Array.isArray(window.lastMerged))renderSidebarList(window.lastMerged);}catch(e){}return d;
      }catch(e){
        const b=ensureBox();if(b&&!silent)b.innerHTML='<div class="mg-corr-head"><span class="mg-corr-title">🧠 CORRELAÇÃO INTELIGENTE</span><span class="mg-corr-badge">INDISPONÍVEL</span></div><div class="mg-corr-note">Não foi possível consultar a análise agora. O evento continua sendo monitorado pelas fontes sísmicas.</div>';
        return null;
      }finally{inflight.delete(key)}
    })();
    inflight.set(key,p);return p;
  }
  function getQuakes(){try{return (Array.isArray(window.lastMerged)?window.lastMerged:[]).filter(e=>e&&e.type==='earthquake'&&Number(e.mag)>=5.5&&Array.isArray(e.coords));}catch(e){return[]}}
  async function sweep(){
    const arr=getQuakes().sort((a,b)=>(Number(b.mag)||0)-(Number(a.mag)||0)||(Number(b.time)||0)-(Number(a.time)||0)).slice(0,8);
    for(const e of arr){await correlate(e,true);}
    const sel=typeof eventoSelecionadoId!=='undefined'?eventoSelecionadoId:null;
    const current=arr.find(e=>e.id===sel);
    if(current)render(current, current.tsunamiCorrelation||cache.get([...cache.keys()].find(k=>k.startsWith(current.id+'|'))));
  }
  const oldShow=window.showEventDetails;
  if(typeof oldShow==='function'){
    window.showEventDetails=function(index,triggerVisualAlert){
      const r=oldShow.apply(this,arguments);
      try{const item=(window.globalEvents||[])[index];if(item?.type==='earthquake')setTimeout(()=>correlate(item,false),50);}catch(e){}
      return r;
    };
  }
  window.monitorGlobalCorrelate=correlate;
  window.monitorGlobalCorrelationSweep=sweep;
  function boot(){setTimeout(sweep,3500);setInterval(sweep,90000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();

