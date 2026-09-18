(function(){'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const workerBase=()=>{try{return typeof WORKER_PROXY==='function'?WORKER_PROXY('').split('?')[0].replace(/\/$/,''):''}catch(e){return ''}};
  async function getJson(path,timeout){const base=workerBase();if(!base)throw new Error('Worker não encontrado');const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout||30000);try{const r=await fetch(base+path,{cache:'no-store',signal:c.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
  let ext=null,anom=null,cyc=null,openKey=null;
  function setStatus(id,state){const e=$(id);if(!e)return;e.className='v70h-status '+(state||'');e.textContent=state==='off'?'●':'●'}
  function renderExt(){const h=ext?.hottest||[],c=ext?.coldest||[];const hh=h[0],cc=c[0];$('v70h-ext-main').textContent=hh&&cc?`🔥 ${hh.city} ${Number(hh.current??hh.max).toFixed(1)}° · ❄️ ${cc.city} ${Number(cc.current??cc.min).toFixed(1)}°`:'dados indisponíveis';setStatus('v70h-ext-status',h.length&&c.length?'':'warn')}
  function renderAnom(){const rows=(anom?.rows||[]).slice().sort((a,b)=>Math.abs(b.anomaly)-Math.abs(a.anomaly));const x=rows[0];$('v70h-anom-main').textContent=x?`${x.name} ${x.anomaly>=0?'+':''}${Number(x.anomaly).toFixed(1)}°`:'dados indisponíveis';setStatus('v70h-anom-status',rows.length?'':'warn')}
  function classify(c){return c.classification==='HU'?'FURACÃO':c.classification==='TS'?'TEMPESTADE TROPICAL':c.classification==='TD'?'DEPRESSÃO TROPICAL':c.classification||'SISTEMA TROPICAL'}
  function renderCyc(){const s=cyc?.storms||[];const x=s[0];$('v70h-cyc-main').textContent=x?`${x.name} · ${Number(x.intensity)||0} km/h · ${classify(x)}`:'nenhum ativo no NHC';setStatus('v70h-cyc-status',s.length?'':'warn')}
  function renderDetail(key){const box=$('v70-header-detail'),title=$('v70hd-title'),body=$('v70hd-body');if(!box||!body)return;if(openKey===key){box.hidden=true;openKey=null;return}openKey=key;box.hidden=false;
    if(key==='ext'){title.textContent='🌡️ EXTREMOS TÉRMICOS';const h=ext?.hottest||[],c=ext?.coldest||[];body.innerHTML=(h.length?'<div class="v70hd-note">Maiores temperaturas entre os pontos globais de referência monitorados.</div>'+h.slice(0,5).map(x=>`<div class="v70hd-row"><span>🔥 ${esc(x.city)}</span><b class="v70hd-hot">${Number(x.current??x.max).toFixed(1)} °C</b></div>`).join(''):'')+(c.length?'<div class="v70hd-note">Menores temperaturas entre os mesmos pontos.</div>'+c.slice(0,5).map(x=>`<div class="v70hd-row"><span>❄️ ${esc(x.city)}</span><b class="v70hd-cold">${Number(x.current??x.min).toFixed(1)} °C</b></div>`).join(''):'')+`<div class="v70hd-note">Atualizado ${ext?.updatedAt?new Date(ext.updatedAt).toLocaleTimeString('pt-BR'):'—'} · Open-Meteo. ${esc(ext?.disclaimer||'')}</div>`}
    if(key==='anom'){title.textContent='🗺️ ANOMALIA TÉRMICA';const rows=(anom?.rows||[]).slice().sort((a,b)=>Math.abs(b.anomaly)-Math.abs(a.anomaly));body.innerHTML=rows.slice(0,10).map(x=>`<div class="v70hd-row"><span>${esc(x.name)} · atual ${Number(x.current).toFixed(1)}° / normal ${Number(x.normal).toFixed(1)}°</span><b class="${x.anomaly>=0?'v70hd-pos':'v70hd-neg'}">${x.anomaly>=0?'+':''}${Number(x.anomaly).toFixed(1)}°</b></div>`).join('')+`<div class="v70hd-note">Período ${esc(anom?.period||'—')} · ${esc(anom?.window||'')}.</div><div class="v70hd-note">${esc(anom?.disclaimer||'')}</div>`}
    if(key==='cyc'){title.textContent='🌀 CICLONES ATIVOS';const storms=cyc?.storms||[];body.innerHTML=storms.length?storms.map(x=>`<div class="v70hd-storm"><strong>🌀 ${esc(x.name)} · ${esc(classify(x))}</strong><div class="v70hd-grid"><div class="v70hd-chip"><b>${Number(x.intensity)||0}</b>km/h</div><div class="v70hd-chip"><b>${Number(x.pressure)||0}</b>hPa</div><div class="v70hd-chip"><b>${Number(x.movementSpeed)||0}</b>km/h</div></div><div style="margin-top:5px;font-size:7px">Movimento: ${esc(['N','NE','E','SE','S','SW','W','NW'][Math.round((x.movementDir||0)/45)%8])}${x.graphics?` · <a class="v70hd-link" href="${esc(x.graphics)}" target="_blank" rel="noopener">produto oficial ↗</a>`:''}</div></div>`).join(''):'<div class="v70hd-note">Nenhum ciclone ativo retornado pelo NHC. Isso não exclui sistemas em outras bacias não cobertas pelo NHC.</div>'}
  }
  async function loadAll(){
    setStatus('v70h-ext-status','warn');setStatus('v70h-anom-status','warn');setStatus('v70h-cyc-status','warn');
    const results=await Promise.allSettled([getJson('/v70-extremes',22000),getJson('/v70-anomaly',50000),getJson('/v70-cyclones',22000)]);
    if(results[0].status==='fulfilled'){ext=results[0].value;renderExt()}else{$('v70h-ext-main').textContent='indisponível';setStatus('v70h-ext-status','off')}
    if(results[1].status==='fulfilled'){anom=results[1].value;renderAnom()}else{$('v70h-anom-main').textContent='indisponível';setStatus('v70h-anom-status','off')}
    if(results[2].status==='fulfilled'){cyc=results[2].value;renderCyc()}else{$('v70h-cyc-main').textContent='indisponível';setStatus('v70h-cyc-status','off')}
  }
  function installHeader(){
    if(!$('v70-header-row'))return;
    $('v70h-ext')?.addEventListener('click',()=>renderDetail('ext'));$('v70h-anom')?.addEventListener('click',()=>renderDetail('anom'));$('v70h-cyc')?.addEventListener('click',()=>renderDetail('cyc'));$('v70hd-close')?.addEventListener('click',()=>{if($('v70-header-detail'))$('v70-header-detail').hidden=true;openKey=null});
    loadAll();setInterval(loadAll,900000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installHeader,{once:true});else setTimeout(installHeader,80);

  /* Radar persistente para cada sismo novo — não interfere no radar do evento selecionado. */
  const radars=new Map();
  function corMag(m){m=Number(m)||0;return m>=6?'#ef4444':m>=5?'#fb923c':m>=4?'#facc15':m>=3?'#22d3ee':'#4ade80'}
  function removeRadar(id){const r=radars.get(id);if(!r)return;try{map?.off('move',r.upd);map?.off('zoom',r.upd);map?.off('resize',r.upd)}catch(e){};r.el?.remove();radars.delete(id)}
  function addRadar(ev){if(!window.map||!ev?.coords||radars.has(ev.id))return;const host=document.getElementById('mapContainer');if(!host)return;const wrap=document.createElement('div');wrap.className='new-quake-radar-wrap';const core=document.createElement('div');core.className='new-quake-radar-core';const r1=document.createElement('div');r1.className='new-quake-radar-ring';const r2=document.createElement('div');r2.className='new-quake-radar-ring r2';const color=corMag(ev.mag);core.style.color=color;core.style.background=color;r1.style.color=color;r2.style.color=color;wrap.append(core,r1,r2);host.appendChild(wrap);const upd=()=>{try{const p=map.project(ev.coords);wrap.style.left=p.x+'px';wrap.style.top=p.y+'px'}catch(e){}};upd();map.on('move',upd);map.on('zoom',upd);map.on('resize',upd);const timer=setTimeout(()=>removeRadar(ev.id),180000);radars.set(ev.id,{el:wrap,upd,timer});}
  window.mostrarNovosSismosNoMapa=function(list){if(!Array.isArray(list))return;list.slice().sort((a,b)=>(b.mag||0)-(a.mag||0)).slice(0,8).forEach(addRadar)};
})();

