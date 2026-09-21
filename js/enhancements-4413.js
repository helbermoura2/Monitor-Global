/* ═══ Melhorias 4.4.14: frescor, alagamento, voz hist, versão (modo crise removido) ═══ */
(function () {

  // Garante que modo crise nunca fique preso de sessão anterior
  try {
    localStorage.removeItem('monitor_crisis_snooze');
    if (typeof PRO !== 'undefined') PRO.crisis = false;
    document.body.classList.remove('pro-crisis');
  } catch (e) {}
  function markFetch(name) {
    try { lastFetchTimes[name] = Date.now(); } catch (e) {}
  }
  // Hooks leves nos fetches principais
  const wrapFetch = (name, fnName) => {
    const orig = window[fnName];
    if (typeof orig !== 'function') return;
    window[fnName] = async function () {
      try {
        const r = await orig.apply(this, arguments);
        markFetch(name);
        try { updateFreshnessUI(); } catch (e) {}
        try { avaliarCriseAutomatica(); } catch (e) {}
        try { atualizarRiscoAlagamento(); } catch (e) {}
        return r;
      } catch (e) {
        markFetch(name);
        throw e;
      }
    };
  };
  // aplicar depois do boot (funções no escopo global do HTML monolítico)
  function wireWraps() {
    ['fetchGlobalFeeds', 'fetchRealHurricanes', 'fetchEonetStorms', 'fetchGdacsFloods',
     'fetchSPWeather', 'fetchSPAirQuality', 'fetchFires', 'fetchTsunamiAlerts'].forEach(fn => {
      // funções não estão em window — estão no escopo do script; usamos monkey via eval não é possível
    });
  }

  function pushVozHist(txt) {
    try {
      if (!txt) return;
      vozHistorico.push({ txt: String(txt).slice(0, 240), t: Date.now() });
      if (vozHistorico.length > (VOZ_HIST_MAX || 8)) vozHistorico.shift();
    } catch (e) {}
  }

  // Intercepta síntese de voz
  const _speak = window.speechSynthesis && window.speechSynthesis.speak.bind(window.speechSynthesis);
  if (_speak) {
    window.speechSynthesis.speak = function (utt) {
      try { if (utt && utt.text) pushVozHist(utt.text); } catch (e) {}
      return _speak(utt);
    };
  }

  function updateFreshnessUI() {
    const el = document.getElementById('ts-meta-fresh');
    if (!el) return;

    const sismoOk = Number(window.__lastSismoSuccess || 0);
    const sismoCache = Number(window.__sismoCacheAt || 0);

    if (window.__sismoUsingCache && sismoCache) {
      const age = Math.max(0, Math.round((Date.now() - sismoCache) / 1000));
      const label = age < 60
        ? `${Math.max(1, age)}s`
        : age < 3600
          ? `${Math.round(age / 60)}min`
          : `${Math.round(age / 3600)}h`;

      const why = window.__offlineCacheReason === 'offline' ? 'sem rede' : 'fontes indisponíveis';
      el.textContent = `🟠 cache ${label}`;
      el.title = `Dados locais (${why}). Última gravação há ${label}. Não é consulta ao vivo.`;
      return;
    }

    if (sismoOk) {
      const age = Math.max(0, Math.round((Date.now() - sismoOk) / 1000));
      const label = age < 60
        ? `${age}s`
        : age < 3600
          ? `${Math.round(age / 60)}min`
          : `${Math.round(age / 3600)}h`;

      el.textContent = `🟢 sismos ${label}`;
      el.title = 'Idade da última atualização sísmica confirmada por pelo menos uma fonte.';
      return;
    }

    const times = Object.values(lastFetchTimes || {}).filter(Number.isFinite);
    if (!times.length) {
      el.textContent = 'dados: aguardando';
      return;
    }

    const newest = Math.max(...times);
    const age = Math.max(0, Math.round((Date.now() - newest) / 1000));
    el.textContent = age < 60
      ? `dados: ${age}s`
      : `dados: ${Math.round(age / 60)}min`;
  }

  function atualizarRiscoAlagamento() {
    const w = window.__proWeather || {};
    const rain = Number(w.rain);
    const hum = Number(w.hum);
    let score = 0;
    const reasons = [];
    if (Number.isFinite(rain)) {
      if (rain >= (FLOOD_RAIN_1H_HIGH || 20)) { score += 50; reasons.push(`chuva intensa ${rain.toFixed(1)} mm`); }
      else if (rain >= (FLOOD_RAIN_1H_MOD || 8)) { score += 25; reasons.push(`chuva ${rain.toFixed(1)} mm`); }
      else if (rain >= 2) { score += 8; reasons.push(`chuva leve ${rain.toFixed(1)} mm`); }
    }
    if (Number.isFinite(hum) && hum >= 90 && rain >= 1) { score += 10; reasons.push('umidade alta'); }
    // Alertas de enchente próximos
    const ref = (typeof minhaPosicao !== 'undefined' && minhaPosicao) || (typeof weatherLoc !== 'undefined' ? weatherLoc : null);
    (Array.isArray(globalAlerts) ? globalAlerts : []).forEach(a => {
      if (a.type !== 'flood' || !a.coords || !ref) return;
      const d = haversine(ref.lat, ref.lng, a.coords[1], a.coords[0]);
      if (d < 80) { score += 40; reasons.push('alerta de enchente <80 km'); }
      else if (d < 250) { score += 15; reasons.push('alerta de enchente na região'); }
    });
    // CEMADEN / card se existir
    try {
      const max24 = parseFloat((document.getElementById('cemaden-max24') || {}).textContent);
      if (Number.isFinite(max24) && max24 >= (FLOOD_RAIN_24H_HIGH || 50)) {
        score += 20; reasons.push(`modelo 24h ${max24} mm`);
      }
    } catch (e) {}
    // METAR real (REDEMET) — chuva/tempestade OBSERVADA no aeródromo mais próximo,
    // não é modelo/previsão. O CEMADEN teria os pluviômetros oficiais espalhados
    // pela cidade, mas a API plena dele depende de uma liberação da própria
    // CEMADEN (pedido em andamento, ped@cemaden.gov.br) que ainda não veio — até
    // lá, METAR é o único dado de chuva REAL (não estimado) que o app já tem.
    try {
      const estacoes = (window.REDEMET && Array.isArray(window.REDEMET.stations)) ? window.REDEMET.stations : [];
      if (ref && estacoes.length) {
        let maisProxima = null, menorDist = Infinity;
        estacoes.forEach(st => {
          const d = haversine(ref.lat, ref.lng, st.lat, st.lng);
          if (d < menorDist) { menorDist = d; maisProxima = st; }
        });
        const fresca = maisProxima && (Date.now() - maisProxima.updatedAt) < 75 * 60000;
        if (maisProxima && menorDist < 80 && fresca) {
          if (maisProxima.tempestade) { score += 30; reasons.push(`tempestade observada (METAR ${maisProxima.icao})`); }
          if (maisProxima.chuvaIntensidade === 'forte') { score += 30; reasons.push(`chuva forte observada (METAR ${maisProxima.icao})`); }
          else if (maisProxima.chuvaIntensidade === 'moderada') { score += 15; reasons.push(`chuva observada (METAR ${maisProxima.icao})`); }
          else if (maisProxima.chuvaIntensidade === 'fraca') { score += 5; reasons.push(`chuvisco observado (METAR ${maisProxima.icao})`); }
        }
      }
    } catch (e) {}

    let level = 'baixo', label = 'BAIXO', icon = '💧', cls = 'risk-normal';
    if (score >= 55) { level = 'muito_alto'; label = 'MUITO ALTO'; icon = '🆘'; cls = 'risk-critical'; }
    else if (score >= 35) { level = 'alto'; label = 'ALTO'; icon = '🟠'; cls = 'risk-alert'; }
    else if (score >= 18) { level = 'moderado'; label = 'MODERADO'; icon = '🟡'; cls = 'risk-attention'; }

    floodRiskState = {
      level, score,
      reason: reasons.length ? reasons.slice(0, 2).join(' · ') : 'Sem indicativo de alagamento no ponto monitorado.'
    };
    // Só um chip na linha do clima — não remove temp/vento/chuva/umidade
    const lb = document.getElementById('flood-risk-label');
    const chip = document.getElementById('flood-risk-chip');
    if (lb) lb.textContent = label;
    if (chip) {
      chip.title = 'Alagamento: ' + label + ' — ' + floodRiskState.reason;
      chip.classList.remove('flood-ok', 'flood-mod', 'flood-high', 'flood-crit');
      const map = { baixo: 'flood-ok', moderado: 'flood-mod', alto: 'flood-high', muito_alto: 'flood-crit' };
      chip.classList.add(map[level] || 'flood-ok');
    }
  }

  function avaliarCriseAutomatica() {
    /* Modo crise removido permanentemente — nunca ativa */
    if (typeof PRO !== 'undefined') PRO.crisis = false;
    try { document.body.classList.remove('pro-crisis'); } catch (e) {}
  }

  function checkVersionBanner() {
    try {
      const key = 'monitor_app_version';
      const prev = localStorage.getItem(key);
      const cur = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '4.4.14';
      if (prev && prev !== cur) {
        showToast(`Atualizado para PRO ${cur} (antes ${prev}). Se ainda vir a barra REGISTROS, substitua o arquivo antigo.`, 'info');
      }
      localStorage.setItem(key, cur);
      const b = document.getElementById('ts-meta-build');
      if (b) b.textContent = 'build ' + cur;
      const vLabel = document.getElementById('menu-version-label');
      if (vLabel) vLabel.textContent = `Monitor Global`;
    } catch (e) {}
  }

  // Painel ciclone: link do cone NHC se houver
  const _showAlert = window.showAlertDetails;
  // showAlertDetails is not on window; patch via periodic detail enhance
  function enhanceHurricanePanel() {
    document.querySelectorAll('#painel-direito').forEach(() => {});
  }

  setInterval(() => {
    try { updateFreshnessUI(); } catch (e) {}
    try { atualizarRiscoAlagamento(); } catch (e) {}
    try { avaliarCriseAutomatica(); } catch (e) {}
  }, 20000);

  // Marcar fetch times quando applyFilters roda (proxy de atividade)
  const _af = window.applyFilters;
  // applyFilters also not on window in non-module script — observe DOM events count
  document.addEventListener('DOMContentLoaded', () => {
    checkVersionBanner();
    setTimeout(() => { try { atualizarRiscoAlagamento(); updateFreshnessUI(); } catch (e) {} }, 4000);
  });
  if (document.readyState !== 'loading') {
    checkVersionBanner();
    setTimeout(() => { try { atualizarRiscoAlagamento(); updateFreshnessUI(); } catch (e) {} }, 4000);
  }

  // Expor helpers
  window.atualizarRiscoAlagamento = atualizarRiscoAlagamento;
  window.avaliarCriseAutomatica = avaliarCriseAutomatica;
  window.updateFreshnessUI = updateFreshnessUI;
  window.pushVozHist = pushVozHist;

  // Patch applyFilters se existir no escopo global ao final do parse
  setTimeout(function tryPatchApply() {
    // Injeta pós-processamento observando lista
    const target = document.getElementById('events');
    if (!target) return;
    const obs = new MutationObserver(() => {
      try { updateFreshnessUI(); } catch (e) {}
    });
    obs.observe(target, { childList: true });
  }, 2000);

  // Após cada ciclo de clima SP
  const spHook = setInterval(() => {
    if (window.__proWeather) {
      try { atualizarRiscoAlagamento(); } catch (e) {}
    }
  }, 15000);
})();

