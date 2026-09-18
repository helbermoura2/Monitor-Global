(function () {
  // —— Open-Meteo cache 8 min ——
  window.__omCache = window.__omCache || {};
  const OM_TTL = 8 * 60 * 1000;
  window.fetchOpenMeteoCached = async function (url, timeoutMs) {
    try {
      const hit = window.__omCache[url];
      if (hit && (Date.now() - hit.t) < OM_TTL && hit.data) return hit.data;
    } catch (e) {}
    const r = (typeof fetchWithCorsFallback === 'function')
      ? await fetchWithCorsFallback(url, timeoutMs || 12000)
      : await fetch(url);
    if (!r || !r.ok) throw new Error('Open-Meteo HTTP ' + (r && r.status));
    const data = await r.json();
    try { window.__omCache[url] = { t: Date.now(), data: data }; } catch (e) {}
    return data;
  };

  // Patch common Open-Meteo JSON fetches used at boot (best-effort)
  // fetchSPWeather / forecast already use fetchWithCorsFallback — wrap via monkey on URL pattern
  const _origCors = window.fetchWithCorsFallback;
  if (typeof _origCors === 'function' && !_origCors._omWrapped) {
    window.fetchWithCorsFallback = async function (url, timeoutMs) {
      if (typeof url === 'string' && url.indexOf('api.open-meteo.com') >= 0) {
        try {
          const hit = window.__omCache[url];
          if (hit && (Date.now() - hit.t) < OM_TTL && hit.resp) {
            return hit.resp.clone ? hit.resp.clone() : hit.resp;
          }
        } catch (e) {}
        const resp = await _origCors(url, timeoutMs);
        try {
          // cache json body by re-fetching from clone
          const clone = resp.clone();
          clone.json().then(function (data) {
            window.__omCache[url] = { t: Date.now(), data: data, resp: resp };
          }).catch(function () {});
        } catch (e) {}
        return resp;
      }
      return _origCors(url, timeoutMs);
    };
    window.fetchWithCorsFallback._omWrapped = true;
  }

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
        return 'M' + Number(e.mag).toFixed(1) + ' ' + (e.place || '') + (e.sourceSummary ? ' (' + e.sourceSummary + ')' : '');
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
  setInterval(function () {
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
    try { if (typeof updateFreshnessBar === 'function') updateFreshnessBar(); } catch (e) {}
  }, 20000);

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
  setInterval(function () {
    try {
      if (typeof dedupeFireAlerts === 'function') {
        const before = (globalAlerts || []).length;
        dedupeFireAlerts();
        if ((globalAlerts || []).length !== before && typeof applyFilters === 'function') applyFilters();
      }
    } catch (e) {}
  }, 45000);

  // Offline banner text
  try {
    const b = document.getElementById('offline-banner');
    if (b) b.textContent = 'Sem conexão — shell em cache. Alertas ao vivo indisponíveis até voltar a rede.';
  } catch (e) {}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installUi);
  else installUi();
})();

