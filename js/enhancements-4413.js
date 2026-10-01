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
    window.WeatherEvidence?.update();
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

