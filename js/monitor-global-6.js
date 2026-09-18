(function(){
  'use strict';
  const MG = { timer:null, feeds:null, markers:[], open:false, busy:false };
  const $ = id => document.getElementById(id);
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function workerBase(){
    try { return (typeof WORKER_PROXY==='function' ? WORKER_PROXY('').split('?')[0] : ''); } catch(e){ return ''; }
  }
  function ensureHud(){
    if($('mg-global-hud')) return;
    const host=document.getElementById('mapWrap') || document.getElementById('map')?.parentElement;
    if(!host) return;
    host.insertAdjacentHTML('beforeend',`<div id="mg-global-hud" aria-label="Status global">
      <div class="mg-card" id="mg-global-card">
        <div class="mg-head"><span class="mg-title">🌎 Monitor Global · Agora</span><span class="mg-status"><i class="mg-status-dot"></i><b id="mg-status-label">NORMAL</b></span></div>
        <div class="mg-grid">
          <div class="mg-metric"><b id="mg-quakes">0</b><small>Sismos</small></div>
          <div class="mg-metric"><b id="mg-severe">0</b><small>Alertas</small></div>
          <div class="mg-metric"><b id="mg-cyclones">0</b><small>Ciclones</small></div>
          <div class="mg-metric"><b id="mg-natural">0</b><small>Eventos</small></div>
        </div>
        <div id="mg-global-panel"></div>
        <div class="mg-foot"><span id="mg-updated">Aguardando dados…</span><span class="mg-actions"><button class="mg-btn" id="mg-refresh" type="button">↻</button><button class="mg-btn" id="mg-details" type="button">DETALHES</button></span></div>
      </div>
    </div>`);
    $('mg-refresh').onclick=()=>loadFeeds(true);
    $('mg-details').onclick=()=>togglePanel();
  }
  function togglePanel(){MG.open=!MG.open; $('mg-global-card')?.classList.toggle('mg-open',MG.open); renderFeeds();}
  function riskClass(level){return level==='CRÍTICO'?'mg-critical':level==='ALTO'?'mg-high':level==='ATENÇÃO'?'mg-attention':'mg-normal';}
  function localQuakes(){
    try{return Array.isArray(window.lastMerged)?window.lastMerged.filter(e=>e && (e.type==='earthquake'||e.mag!=null)):[];}catch(e){return[];}
  }
  function calcLocal(){
    const q=localQuakes();
    const six=q.filter(e=>Number(e.mag)>=6).length;
    const five=q.filter(e=>Number(e.mag)>=5).length;
    return {count:q.length,six,five};
  }
  function applyStatus(feedRisk){
    const local=calcLocal();
    let level=feedRisk?.level||'NORMAL';
    if(local.six>0) level='CRÍTICO';
    else if(local.five>0 && level==='NORMAL') level='ALTO';
    const card=$('mg-global-card'); if(!card)return;
    card.classList.remove('mg-normal','mg-attention','mg-high','mg-critical'); card.classList.add(riskClass(level));
    $('mg-status-label').textContent=level;
    $('mg-quakes').textContent=local.count;
  }
  function renderFeeds(){
    const panel=$('mg-global-panel'); if(!panel)return;
    const items=(MG.feeds?.eventos||[]).slice(0,12);
    if(!items.length){panel.innerHTML='<div class="mg-feed-row"><div class="mg-feed-title">Nenhum alerta global recebido.</div><div class="mg-feed-meta">As fontes são consultadas pelo Worker.</div></div>';return;}
    panel.innerHTML=items.map(e=>`<div class="mg-feed-row"><div class="mg-feed-title">${esc(e.title||'Evento')}</div><div class="mg-feed-meta">${esc(e.source||'Fonte')} · ${e.time?new Date(e.time).toLocaleString('pt-BR',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):'agora'}</div><div class="mg-feed-desc">${esc(e.description||'')}</div></div>`).join('');
  }
  function renderCounts(){
    const items=MG.feeds?.eventos||[];
    let severe=0,cyclones=0,natural=items.length;
    items.forEach(e=>{const t=((e.title||'')+' '+(e.description||'')).toLowerCase();if(/warning|severe|extreme|tornado|tsunami|alerta/.test(t))severe++;if(/hurricane|typhoon|cyclone|furac/.test(t))cyclones++;});
    $('mg-severe').textContent=severe; $('mg-cyclones').textContent=cyclones; $('mg-natural').textContent=natural;
    const r=MG.feeds?.risco||{}; applyStatus(r);
    $('mg-updated').textContent='Atualizado '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  function clearMarkers(){MG.markers.forEach(m=>{try{m.remove();}catch(e){}});MG.markers=[];}
  function mapNaturalEvents(){
    clearMarkers();
    if(!MG.feeds?.eventos || typeof map==='undefined' || !window.maplibregl) return;
    MG.feeds.eventos.slice(0,80).forEach(e=>{
      const c=e.geometry; if(!Array.isArray(c)||c.length<2) return;
      const lon=Number(c[0]),lat=Number(c[1]); if(!Number.isFinite(lon)||!Number.isFinite(lat))return;
      const text=((e.title||'')+' '+(e.description||'')).toLowerCase();
      const el=document.createElement('div');el.className='mg-map-marker '+(/fire/.test(text)?'fire':/storm|cyclone/.test(text)?'storm':/flood|water|tsunami/.test(text)?'water':'');
      el.title=e.title||'Evento';
      el.onclick=()=>{if(typeof showFloat==='function')showFloat(e.source||'Evento global',`<p style="font-size:12px;color:#e2e8f0"><b>${esc(e.title||'Evento')}</b><br><span style="color:#94a3b8">${esc(e.description||'')}</span></p>`);};
      try{MG.markers.push(new maplibregl.Marker({element:el}).setLngLat([lon,lat]).addTo(map));}catch(err){}
    });
  }
  async function loadFeeds(force){
    if(MG.busy)return; const base=workerBase(); if(!base)return;
    MG.busy=true;
    try{
      const r=await fetch(base+'/global-feeds'+(force?'?t='+Date.now():''),{cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      MG.feeds=await r.json();
      renderCounts();renderFeeds();mapNaturalEvents();
    }catch(e){
      const label=$('mg-updated');if(label)label.textContent='Feeds globais indisponíveis';
      if(typeof dbgLog==='function')dbgLog('global-feeds:',e);
    }finally{MG.busy=false;}
  }
  function refreshFromLocal(){
    ensureHud(); if(!$('mg-global-card'))return;
    const local=calcLocal(); $('mg-quakes').textContent=local.count;
    if(MG.feeds)applyStatus(MG.feeds.risco||{});
  }
  function install(){
    ensureHud();
    if(!$('mg-global-card'))return;
    loadFeeds(false); refreshFromLocal();
    MG.timer=setInterval(()=>{loadFeeds(false);refreshFromLocal();},120000);
    setInterval(refreshFromLocal,15000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else setTimeout(install,50);
  window.MonitorGlobal6={reload:()=>loadFeeds(true),toggle:togglePanel};
})();

