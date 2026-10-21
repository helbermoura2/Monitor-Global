(function () {
  // Cache text only: a consumed Response cannot be cloned for the next reader.
  const OM_TTL=8*60000,OM_LIMIT=24,OM_BYTES=4*1024*1024,cache=new Map(),pending=new Map();let bytes=0;
  delete window.__omCache;
  function prune(){for(const [key,row]of cache)if(Date.now()-row.at>=OM_TTL){bytes-=row.bytes;cache.delete(key);}}
  function remember(key,row){prune();const previous=cache.get(key);if(previous){bytes-=previous.bytes;cache.delete(key);}if(row.bytes>OM_BYTES)return;cache.set(key,row);bytes+=row.bytes;while(cache.size>OM_LIMIT||bytes>OM_BYTES){const oldest=cache.keys().next().value;bytes-=cache.get(oldest).bytes;cache.delete(oldest);}}
  const originalCors=window.fetchWithCorsFallback;
  const eligible=url=>{try{return new URL(url).hostname==='api.open-meteo.com';}catch{return false;}};
  const response=row=>new Response(row.text,{status:row.status,statusText:row.statusText,headers:row.headers});
  async function cachedCors(url,timeoutMs){
    if(!eligible(url))return originalCors(url,timeoutMs);
    const key=String(url);prune();const hit=cache.get(key);if(hit){cache.delete(key);cache.set(key,hit);return response(hit);}
    let task=pending.get(key);
    if(!task){task=(async()=>{const r=await originalCors(url,timeoutMs),text=await r.text(),row={text,bytes:text.length*2,at:Date.now(),status:r.status,statusText:r.statusText,headers:[...r.headers]};if(r.ok)remember(key,row);return row;})();
      if(pending.size<8){pending.set(key,task);task.then(()=>{if(pending.get(key)===task)pending.delete(key);},()=>{if(pending.get(key)===task)pending.delete(key);});}}
    return response(await task);
  }
  if(typeof originalCors==='function'){cachedCors._omWrapped=true;window.fetchWithCorsFallback=cachedCors;}
  window.fetchOpenMeteoCached=async(url,timeoutMs)=>{const r=await(typeof originalCors==='function'?cachedCors(url,timeoutMs||12000):fetch(url));if(!r.ok)throw Error('Open-Meteo indisponível');return r.json();};
  window.OpenMeteoCache={stats:()=>{prune();return {entries:cache.size,textBytes:bytes,inflight:pending.size,maxEntries:OM_LIMIT,maxTextBytes:OM_BYTES};}};

  // —— Fire dedupe ——
  window.dedupeFireAlerts = function () {
    try {
      const fires = (globalAlerts || []).filter(function (a) { return a && a.type === 'fire'; });
      const others = (globalAlerts || []).filter(function (a) { return !a || a.type !== 'fire'; });
      const groups = [];
      fires.forEach(function (f) {
        const [lng, lat] = f.coords || [0, 0];
        let hit = null;
        for (let i = 0; i < groups.length; i++) {
          const g = groups[i];
          if (!g.coords) continue;
          const d = (typeof haversine === 'function')
            ? haversine(lat, lng, g.coords[1], g.coords[0])
            : 9999;
          if (d < 80) { hit = g; break; }
        }
        if (!hit) {
          const srcs = [f.source].filter(Boolean);
          groups.push(Object.assign({}, f, { sources: srcs, sourceSummary: srcs.join(' · ') }));
        } else {
          if (f.source && hit.sources.indexOf(f.source) < 0) hit.sources.push(f.source);
          hit.sourceSummary = hit.sources.join(' · ');
          if (f.time > hit.time) {
            hit.time = f.time;
            hit.place = f.place || hit.place;
            hit.detail = f.detail || hit.detail;
          }
        }
      });
      globalAlerts = others.concat(groups);
    } catch (e) { console.warn('dedupeFire', e); }
  };

  // —— Share summary ——
  window.copiarResumoMonitor = async function () {
    try {
      const feed = (typeof lastMerged !== 'undefined' && lastMerged) ? lastMerged : [];
      const eqs = feed.filter(function (x) { return x.type === 'earthquake'; });
      const inmet = feed.filter(function (x) { return String(x.id || '').indexOf('inmet-') === 0; });
      const storms = feed.filter(function (x) { return x.type === 'storm' || x.type === 'hurricane' || x.type === 'tsunami'; });
      const fires = feed.filter(function (x) { return x.type === 'fire'; });
      const radar = feed.filter(function (x) { return String(x.source || '').toUpperCase() === 'RADAR'; });
      const topEq = eqs.slice(0, 3).map(function (e) {
        return 'M' + Number(e.mag).toFixed(1).replace('.', ',') + ' ' + (e.place || '') + (e.sourceSummary ? ' (' + e.sourceSummary + ')' : '');
      }).join('; ');
      const lines = [
        'Monitor Global',
        new Date().toLocaleString('pt-BR'),
        'Eventos na lista: ' + feed.length,
        'Sismos: ' + eqs.length + (topEq ? ' — ' + topEq : ''),
        'INMET: ' + inmet.length,
        'Tempestade/ciclone/tsunami: ' + storms.length,
        'Incêndios: ' + fires.length,
        'Radar local: ' + (radar.length ? radar.length + ' alerta(s)' : 'sem alerta de radar na lista'),
        'Rede: ' + (navigator.onLine ? 'online' : 'offline')
      ];
      const txt = lines.join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(txt);
        if (typeof showToast === 'function') showToast('📋 Resumo copiado', 'info');
      } else {
        prompt('Copie o resumo:', txt);
      }
    } catch (e) {
      if (typeof showToast === 'function') showToast('Não foi possível copiar', 'error');
    }
  };

  // —— Snooze ——
  window.__somSnoozeUntil = 0;
  try {
    const s = parseInt(localStorage.getItem('monitor_som_snooze') || '0', 10);
    if (s > Date.now()) window.__somSnoozeUntil = s;
  } catch (e) {}

  function applySomSnoozeState() {
    if (window.__somSnoozeUntil && Date.now() < window.__somSnoozeUntil) {
      if (typeof somAtivo !== 'undefined') {
        window.__somWasBeforeSnooze = somAtivo;
        somAtivo = false;
      }
    }
  }
  applySomSnoozeState();
  PeriodicScheduler.every('sound-snooze',function () {
    if (window.__somSnoozeUntil && Date.now() >= window.__somSnoozeUntil) {
      window.__somSnoozeUntil = 0;
      try { localStorage.removeItem('monitor_som_snooze'); } catch (e) {}
      if (typeof somAtivo !== 'undefined' && window.__somWasBeforeSnooze !== false) {
        somAtivo = true;
        try { localStorage.setItem('somAtivo', '1'); } catch (e) {}
        if (typeof atualizarBotaoSom === 'function') atualizarBotaoSom();
        if (typeof showToast === 'function') showToast('🔊 Som retomado', 'info');
      }
    }
  },20000,20000,'ui');

  window.snoozeSom = function (min) {
    window.__somSnoozeUntil = Date.now() + min * 60000;
    try { localStorage.setItem('monitor_som_snooze', String(window.__somSnoozeUntil)); } catch (e) {}
    if (typeof somAtivo !== 'undefined') {
      window.__somWasBeforeSnooze = true;
      somAtivo = false;
      try { localStorage.setItem('somAtivo', '0'); } catch (e) {}
      if (typeof atualizarBotaoSom === 'function') atualizarBotaoSom();
    }
    if (typeof showToast === 'function') showToast('🔇 Som pausado ' + min + ' min', 'info');
    try { updateFreshnessBar(); } catch (e) {}
  };
  window.snoozeCriseAuto = function (min) { /* removido */ };
  window.clearSnoozes = function () {
    window.__somSnoozeUntil = 0;
      try {
      localStorage.removeItem('monitor_som_snooze');
    } catch (e) {}
    if (typeof somAtivo !== 'undefined') {
      somAtivo = true;
      try { localStorage.setItem('somAtivo', '1'); } catch (e) {}
      if (typeof atualizarBotaoSom === 'function') atualizarBotaoSom();
    }
    if (typeof showToast === 'function') showToast('▶ Snoozes limpos', 'info');
    try { updateFreshnessBar(); } catch (e) {}
  };

  function installUi() {
    const share = document.getElementById('btn-share-summary');
    const snBtn = document.getElementById('btn-snooze-menu');
    const panel = document.getElementById('snooze-panel');
    if (share) share.onclick = function () { window.copiarResumoMonitor(); };
    if (snBtn && panel) {
      snBtn.onclick = function (e) {
        e.stopPropagation();
        panel.classList.toggle('open');
      };
    }
    if (panel) {
      panel.querySelectorAll('[data-snooze-som]').forEach(function (b) {
        b.onclick = function () {
          window.snoozeSom(parseInt(b.getAttribute('data-snooze-som'), 10));
          panel.classList.remove('open');
        };
      });
      const cl = document.getElementById('snooze-clear');
      if (cl) cl.onclick = function () { window.clearSnoozes(); panel.classList.remove('open'); };
      const clo = document.getElementById('snooze-close');
      if (clo) clo.onclick = function () { panel.classList.remove('open'); };
    }
    document.addEventListener('click', function (e) {
      if (panel && panel.classList.contains('open') && !panel.contains(e.target) && e.target.id !== 'btn-snooze-menu') {
        panel.classList.remove('open');
      }
    });
  }

  // Hook fire dedupe after filters periodically
  PeriodicScheduler.every('fire-dedupe',function () {
    try {
      if (typeof dedupeFireAlerts === 'function') {
        const before = (globalAlerts || []).length;
        dedupeFireAlerts();
        if ((globalAlerts || []).length !== before && typeof applyFilters === 'function') applyFilters();
      }
    } catch (e) {}
  },45000,45000,'ui');

  // Offline banner text
  try {
    const b = document.getElementById('offline-banner');
    if (b) b.textContent = 'Sem conexão — shell em cache. Alertas ao vivo indisponíveis até voltar a rede.';
  } catch (e) {}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installUi);
  else installUi();
})();

