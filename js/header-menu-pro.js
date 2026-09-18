/* Menu ☰ — PRO 4.4.5: fecha de verdade + painéis flutuantes visíveis */
(function () {
  function $(id) { return document.getElementById(id); }

  function closeMain() {
    var p = $('header-main-menu-panel');
    var t = $('header-main-menu-toggle');
    if (p) {
      p.classList.remove('open');
      // limpa estilos inline que travavam o menu aberto
      p.style.removeProperty('display');
      p.style.removeProperty('flex-direction');
    }
    if (t) t.setAttribute('aria-expanded', 'false');
  }

  function floatPanel() {
    var el = $('menu-float-panel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'menu-float-panel';
      document.body.appendChild(el);
    }
    return el;
  }

  function showFloat(title, html) {
    var el = floatPanel();
    el.innerHTML = '<button type="button" class="close-x" id="menu-float-close">✕</button><h3>' + title + '</h3>' + html;
    el.classList.add('open');
    el.style.display = 'block';
    $('menu-float-close').onclick = function () {
      el.classList.remove('open');
      el.style.display = 'none';
    };
    return el;
  }

  function openAudio() {
    showFloat('Controles de áudio',
      '<button type="button" id="mf-som">🔊 Ligar / Desligar som</button>' +
      '<button type="button" id="mf-test">🔔 Testar som</button>' +
      '<p style="font-size:11px;color:#94a3b8;margin-top:10px;line-height:1.4">O som alerta sismos e eventos novos. No DeX, permita áudio no Chrome se pedir.</p>'
    );
    $('mf-som').onclick = function () {
      if (typeof window.toggleSomAtivo === 'function') {
        var on = window.toggleSomAtivo({ speak: true });
        this.textContent = on ? '🔊 Som ligado (tocar p/ desligar)' : '🔇 Som desligado (tocar p/ ligar)';
        return;
      }
      try {
        var on2 = localStorage.getItem('somAtivo') !== '0';
        on2 = !on2;
        localStorage.setItem('somAtivo', on2 ? '1' : '0');
        alert(on2 ? 'Som ligado' : 'Som desligado');
      } catch (e) { alert('Não foi possível alternar o som'); }
    };
    $('mf-test').onclick = function () {
      var b = $('btn-teste');
      if (b) { b.click(); return; }
      try {
        if (window.speechSynthesis) {
          var u = new SpeechSynthesisUtterance('Teste de áudio do Monitor Global');
          u.lang = 'pt-BR';
          speechSynthesis.speak(u);
        } else {
          alert('Teste de som indisponível neste dispositivo');
        }
      } catch (e) { alert('Falha no teste de som'); }
    };
  }

  function openSummary() {
    var n = 0;
    try {
      n = (window.globalEvents && window.globalEvents.length) || document.querySelectorAll('.event').length || 0;
    } catch (e) {}
    var brent = ($('kpibox-brent') || {}).textContent || ($('brent-value') || {}).textContent || '--';
    var sp = '';
    try {
      var card = $('sp-live-card') || document.querySelector('#top-probar');
      sp = card ? card.innerText.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    } catch (e) {}
    if (typeof window.__uxShow === 'function') {
      try { window.__uxShow('summary'); } catch (e) {}
    }
    showFloat('Resumo operacional',
      '<p style="font-size:13px;line-height:1.55;color:#e2e8f0">' +
      '<b>Eventos na lista:</b> ' + n + '<br>' +
      '<b>Brent:</b> ' + (brent || '--') + '<br>' +
      (sp ? ('<b>Clima SP:</b> ' + sp + '<br>') : '') +
      '<span style="color:#94a3b8">Toque um evento à esquerda para detalhar no painel direito.</span></p>'
    );
  }

  function openTimeline() {
    if (typeof window.__uxShow === 'function') {
      try { window.__uxShow('timeline'); } catch (e) {}
    }
    var rows = [];
    try {
      document.querySelectorAll('.event').forEach(function (el, i) {
        if (i > 11) return;
        var t = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80);
        if (t) rows.push('<div style="padding:6px 0;border-bottom:1px solid #1e293b;font-size:12px;color:#cbd5e1">' + t + '</div>');
      });
    } catch (e) {}
    showFloat('Linha do tempo',
      (rows.length ? rows.join('') : '<p style="color:#94a3b8">Nenhum evento carregado ainda.</p>')
    );
  }

  function openSources() {
    if (typeof window.__uxShow === 'function') {
      try { window.__uxShow('sources'); } catch (e) {}
    }
    // Também tenta o botão nativo
    var b = $('ux-btn-sources');
    if (b) try { b.click(); } catch (e) {}
    showFloat('Eventos e fontes',
      '<p style="font-size:13px;line-height:1.5;color:#e2e8f0">Fontes: USGS · EMSC · GDACS · Open-Meteo · EONET · RainViewer</p>' +
      '<button type="button" id="mf-src-native">📡 Abrir status por fonte</button>' +
      '<p style="font-size:11px;color:#94a3b8;margin-top:8px">A lista de eventos fica na coluna da esquerda.</p>'
    );
    $('mf-src-native').onclick = function () {
      var x = $('ux-btn-sources');
      if (x) x.click();
      else if (typeof window.__uxShow === 'function') window.__uxShow('sources');
    };
  }

  function openTools() {
    if (typeof window.__uxShow === 'function') {
      try { window.__uxShow('sources'); } catch (e) {}
    }
    var b = $('ux-btn-sources') || $('ux-btn-legend') || $('ux-btn-settings');
    if (b) try { b.click(); } catch (e) {}
    showFloat('Mais ferramentas',
      '<button type="button" id="mf-leg">ⓘ Legenda do mapa</button>' +
      '<button type="button" id="mf-set">🔔 Alertas</button>' +
      '<button type="button" id="mf-src">📡 Status das fontes</button>' +
      '<button type="button" id="mf-tv">📺 Modo TV</button>'
    );
    $('mf-leg').onclick = function () {
      if (typeof window.__uxShow === 'function') window.__uxShow('legend');
      else $('ux-btn-legend')?.click();
    };
    $('mf-set').onclick = function () {
      if (typeof window.__uxShow === 'function') window.__uxShow('settings');
      else $('ux-btn-settings')?.click();
    };
    $('mf-src').onclick = function () {
      if (typeof window.__uxShow === 'function') window.__uxShow('sources');
      else $('ux-btn-sources')?.click();
    };
    $('mf-tv').onclick = function () {
      if (typeof window.toggleTvMode === 'function') window.toggleTvMode();
      else {
        try { localStorage.setItem('monitor_mode', 'tv'); } catch (e) {}
        location.href = location.pathname + location.search.replace(/[?&]mode=[^&]*/g, '') + (location.search ? '&' : '?') + 'mode=tv';
      }
    };
  }

  function clickOp(idDesktop, idMobile) {
    var el = $(idDesktop) || $(idMobile);
    if (el) el.click();
    else alert('Controle não disponível nesta tela: ' + idDesktop);
  }

  window.menuAcao = function (acao) {
    try {
      if (acao === 'audio') openAudio();
      else if (acao === 'events') openSources();
      else if (acao === 'summary') openSummary();
      else if (acao === 'timeline') openTimeline();
      else if (acao === 'radar') clickOp('btn-radar-pro', 'mobile-btn-radar');
      /* acao crisis removida */
      else if (acao === 'replay') clickOp('btn-replay-pro', 'mobile-btn-replay');
      else if (acao === 'follow') clickOp('btn-follow-pro', 'mobile-btn-follow');
      else if (acao === 'tools') openTools();
      else if (acao === 'reload') {
        try {
          if (typeof showToast === 'function') showToast('🔄 Atualizando fontes…', 'info');
          if (typeof checkSources === 'function') checkSources();
          if (typeof fetchProSP === 'function') fetchProSP();
          if (typeof fetchUSGS === 'function') fetchUSGS();
          if (typeof fetchEMSC === 'function') fetchEMSC();
          if (typeof fetchCemaden === 'function') fetchCemaden();
          if (typeof fetchSPForecast === 'function') fetchSPForecast();
          if (typeof operationalTick === 'function') operationalTick();
          // força buscas principais se existirem no escopo global
          ['fetchQuakes','fetchGdacs','fetchEonet','fetchAlerts'].forEach(function(fn){
            try { if (typeof window[fn] === 'function') window[fn](); } catch (e) {}
          });
        } catch (e) {
          alert('Recarga parcial: ' + (e && e.message));
        }
      }
      else console.warn('[menuAcao] ação desconhecida', acao);
    } catch (err) {
      console.error('[menuAcao]', acao, err);
      alert('Falha em: ' + acao + '\n' + (err && err.message));
    }
    closeMain();
  };

  // Toggle ☰ — click + touch (S25 landscape / DeX)
  function syncPanelOpen(open) {
    var p = $('header-main-menu-panel');
    var t = $('header-main-menu-toggle');
    if (!p) return;
    if (open) {
      p.classList.add('open');
      p.style.display = 'flex';
      p.style.flexDirection = 'column';
      p.style.top = '56px';
      p.style.left = '12px';
      p.style.zIndex = '400010';
    } else {
      p.classList.remove('open');
      p.style.removeProperty('display');
    }
    if (t) t.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function onToggleMenu(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    var p = $('header-main-menu-panel');
    if (!p) return;
    var willOpen = !p.classList.contains('open');
    // fecha outros submenus
    document.querySelectorAll('.header-submenu.open').forEach(function (m) {
      if (m.id !== 'header-main-menu-panel') m.classList.remove('open');
    });
    syncPanelOpen(willOpen);
  }

  var togBtn = $('header-main-menu-toggle');
  if (togBtn) {
    togBtn.addEventListener('click', onToggleMenu, true);
    togBtn.addEventListener('touchend', function (e) {
      // evita double-fire com click sintético
      if (e.cancelable) e.preventDefault();
      onToggleMenu(e);
    }, { passive: false });
  }

  // Garante botões do painel mesmo se onclick inline falhar
  document.querySelectorAll('#header-main-menu-panel .submenu-action[id^="menu-btn-"]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var id = btn.id || '';
      var map = {
        'menu-btn-audio': 'audio',
        'menu-btn-events': 'events',
        'menu-btn-summary': 'summary',
        'menu-btn-timeline': 'timeline',
        'menu-btn-radar': 'radar',
        /* menu-btn-crisis removido */
        'menu-btn-replay': 'replay',
        'menu-btn-follow': 'follow',
        'menu-btn-reload': 'reload',
        'menu-btn-tools': 'tools'
      };
      var acao = map[id];
      if (acao && window.menuAcao) window.menuAcao(acao);
    }, true);
  });

  // Fecha menu ao tocar fora (sem atrapalhar o float)
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.closest && (t.closest('#header-main-menu-panel') || t.closest('#header-main-menu-toggle') || t.closest('#menu-float-panel') || t.closest('#btn-som-header'))) return;
    var p = $('header-main-menu-panel');
    if (p && p.classList.contains('open')) syncPanelOpen(false);
  });
})();

