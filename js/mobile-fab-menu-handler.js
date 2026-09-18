/* ☰ MOBILE — handler definitivo para Android/Chrome.
   Usa pointerup + click com trava para impedir duplo disparo.
   CORREÇÃO: a versão anterior tentava abrir #header-main-menu-panel, um id
   que nunca existiu no HTML — por isso o botão "ficava flutuando sem função
   clara" (era literalmente um clique morto). Agora reaproveita o
   #menu-float-panel, que já existe e já é usado pelo menu "Ferramentas". */
(function () {
  function floatPanel() {
    var el = document.getElementById('menu-float-panel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'menu-float-panel';
      document.body.appendChild(el);
    }
    return el;
  }

  function closeMenu() {
    var el = document.getElementById('menu-float-panel');
    if (el) { el.classList.remove('open'); el.style.display = 'none'; }
    var btn = document.getElementById('fab-menu');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function acao(fn) {
    return function () {
      closeMenu();
      try { fn(); } catch (e) { console.error('[menu ☰]', e); }
    };
  }

  function toggleMenu(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    var now = Date.now();
    if (toggleMenu.lastRun && now - toggleMenu.lastRun < 450) return false;
    toggleMenu.lastRun = now;

    var el = floatPanel();
    var willOpen = !el.classList.contains('open');
    if (!willOpen) { closeMenu(); return false; }

    el.innerHTML =
      '<button type="button" class="close-x" id="menu-float-close">✕</button>' +
      '<h3>Menu</h3>' +
      '<button type="button" id="mf-main-events">📋 Abrir registros</button>' +
      '<button type="button" id="mf-main-audio">🔊 Áudio / voz</button>' +
      '<button type="button" id="mf-main-resumo-dia">🏆 Resumo do dia</button>' +
      '<button type="button" id="mf-main-tools">🛠️ Ferramentas (fontes, legenda, alertas)</button>' +
      '<button type="button" id="mf-main-reload">🔄 Recarregar dados</button>';
    el.classList.add('open');
    el.style.display = 'block';

    document.getElementById('menu-float-close').onclick = closeMenu;
    document.getElementById('mf-main-events').onclick = acao(function () { toggleMobileEventsModal(true); });
    document.getElementById('mf-main-audio').onclick = acao(function () { window.menuAcao && window.menuAcao('audio'); });
    document.getElementById('mf-main-resumo-dia').onclick = acao(function () {
      if (typeof window.shareResumoDiarioStory === 'function') window.shareResumoDiarioStory();
    });
    document.getElementById('mf-main-tools').onclick = acao(function () { window.menuAcao && window.menuAcao('tools'); });
    document.getElementById('mf-main-reload').onclick = acao(function () { window.menuAcao && window.menuAcao('reload'); });

    var btn = document.getElementById('fab-menu');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    return false;
  }

  window.__openMobileMenu = toggleMenu;

  function install() {
    var old = document.getElementById('fab-menu');
    if (!old) return;
    var btn = old.cloneNode(true);
    btn.removeAttribute('onclick');
    btn.removeAttribute('onpointerup');
    btn.removeAttribute('ontouchend');
    btn.setAttribute('aria-label', 'Abrir menu de controles');
    btn.setAttribute('aria-expanded', 'false');
    btn.style.pointerEvents = 'auto';
    btn.style.touchAction = 'manipulation';

    /* O próprio elemento recebe os eventos: isso evita depender de listeners
       globais que estavam interferindo no toque do Android. */
    btn.onpointerup = function (e) { return window.__openMobileMenu(e); };
    btn.onclick = function (e) { return window.__openMobileMenu(e); };
    btn.ontouchend = function (e) { return window.__openMobileMenu(e); };

    old.replaceWith(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();

