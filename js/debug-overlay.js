(function () {
  try {
    if (!/[?&]debug=1/.test(location.search)) return;
    const box = document.createElement('div');
    box.id = 'debug-overlay';
    box.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:50vh;overflow:auto;background:rgba(0,0,0,.94);color:#4ade80;font:11px/1.5 monospace;padding:10px;z-index:999999;border-top:2px solid #4ade80;white-space:pre-wrap';
    document.body.appendChild(box);
    function render() {
      const st = (window.PRO && window.PRO.sourceState) || {};
      const linhas = Object.keys(st).map(k => `${st[k].status === 'ok' ? '🟢' : st[k].status === 'warn' ? '🟡' : '🔴'} ${k}: ${st[k].status} (${st[k].ms || 0}ms)${st[k].error ? ' — ' + st[k].error : ''}`);
      const inmetCount = (typeof globalAlerts !== 'undefined' && globalAlerts) ? globalAlerts.filter(x => String(x.id).startsWith('inmet-')).length : '?';
      const inmetVisiveis = (typeof globalAlerts !== 'undefined' && globalAlerts && typeof alertVisivelNaLista === 'function')
        ? globalAlerts.filter(x => String(x.id).startsWith('inmet-') && alertVisivelNaLista(x)).length : '?';
      const inmetPosGeo = (typeof globalAlerts !== 'undefined' && globalAlerts && typeof passesGeoFilter === 'function')
        ? globalAlerts.filter(x => String(x.id).startsWith('inmet-') && alertVisivelNaLista(x) && passesGeoFilter(x)).length : '?';
      const totalMerged = (typeof buildUnifiedFeed === 'function') ? buildUnifiedFeed().length : '?';
      const totalNaLista = (typeof lastMerged !== 'undefined' && lastMerged) ? lastMerged.length : '?';
      const volcanoNoGlobalAlerts = (typeof globalAlerts !== 'undefined' && globalAlerts) ? globalAlerts.filter(a => a.type === 'volcano').length : '?';
      const volcanoPosGeo = (typeof globalAlerts !== 'undefined' && globalAlerts && typeof passesGeoFilter === 'function')
        ? globalAlerts.filter(a => a.type === 'volcano' && passesGeoFilter(a)).length : '?';
      const fmtHora = (ts) => ts ? new Date(ts).toLocaleTimeString('pt-BR') + ' (há ' + Math.round((Date.now() - ts) / 1000) + 's)' : 'nunca';
      box.textContent =
        `🐛 DEBUG — Monitor Global ${typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?'}\n` +
        `viewport: ${window.innerWidth}x${window.innerHeight} | dpr: ${window.devicePixelRatio}\n` +
        `is-touch: ${document.documentElement.classList.contains('is-touch')}\n` +
        `origin: ${location.origin || '(null — arquivo local)'}\n` +
        `─── FILTROS ATIVOS (podem persistir entre sessões) ───\n` +
        `sidebarFilter (tipo): ${typeof sidebarFilter !== 'undefined' ? sidebarFilter : '?'}\n` +
        `geoFilter (geografia, salvo no navegador): ${typeof geoFilter !== 'undefined' ? geoFilter : '?'}\n` +
        `soImportantes (M4.5+, só sismo): ${typeof soImportantes !== 'undefined' ? soImportantes : '?'}\n` +
        `minhaPosicao (geolocalização): ${(typeof minhaPosicao !== 'undefined' && minhaPosicao) ? `${minhaPosicao.lat},${minhaPosicao.lng}` : 'INDISPONÍVEL — filtros por raio (100/500km/Me afeta) escondem tudo sem isso'}\n` +
        `─── PIPELINE DO INMET (do bruto até a tela) ───\n` +
        `1. alertas carregados no globalAlerts: ${inmetCount}\n` +
        `2. depois de alertVisivelNaLista (janela de tempo): ${inmetVisiveis}\n` +
        `3. depois de passesGeoFilter (geografia): ${inmetPosGeo}\n` +
        `─── TOTAIS DA LISTA ───\n` +
        `total após buildUnifiedFeed: ${totalMerged} | total renderizado na tela: ${totalNaLista}\n` +
        `─── PIPELINE DO VULCÃO (USGS + GDACS) ───\n` +
        `última tentativa: ${fmtHora(window.__lastVolcanoAttempt)}\n` +
        `último sucesso completo: ${fmtHora(window.__lastVolcanoSuccess)}\n` +
        `último erro (geral): ${window.__lastVolcanoError || '(nenhum)'}\n` +
        `último erro (só USGS): ${window.__lastVolcanoUsgsError || '(nenhum)'}\n` +
        `último erro (só GDACS): ${window.__lastVolcanoGdacsError || '(nenhum)'}\n` +
        `GDACS VO — eventos ativos recebidos: ${window.__gdacsVoCount ?? '?'}\n` +
        `USGS — vulcões monitorados no total: ${(window.__usgsVolcanoReports || []).length}\n` +
        `USGS — elevados/VONA: ${(window.__usgsVolcanoElevated || []).length}\n` +
        `vulcões no globalAlerts (antes de filtros): ${volcanoNoGlobalAlerts}\n` +
        `vulcões após passesGeoFilter: ${volcanoPosGeo}\n` +
        `─── PIPELINE DO SISMO (por que a lista para de atualizar) ───\n` +
        `última tentativa de buscar sismos: ${window.__lastSismoAttempt ? new Date(window.__lastSismoAttempt).toLocaleTimeString('pt-BR') + ' (há ' + Math.round((Date.now()-window.__lastSismoAttempt)/1000) + 's)' : 'nunca'}\n` +
        `último sucesso completo: ${window.__lastSismoSuccess ? new Date(window.__lastSismoSuccess).toLocaleTimeString('pt-BR') + ' (há ' + Math.round((Date.now()-window.__lastSismoSuccess)/1000) + 's)' : 'nunca'}\n` +
        `último erro capturado: ${window.__lastSismoError || '(nenhum)'}\n` +
        `─── FONTES ───\n` + (linhas.join('\n') || '(nenhuma fonte reportou ainda)');
    }
    render();
    setInterval(render, 3000);
    window.addEventListener('resize', render);
  } catch (e) {}
})();

