/* 4.4.18 — proteção contra estados móveis presos/medidas antigas do Chrome Android */
(function () {
  function resetMobilePanels() {
    if (window.innerWidth > 1100) return;
    var main = document.getElementById('header-main-menu-panel');
    if (main) {
      main.classList.remove('open');
      main.style.removeProperty('display');
      main.style.removeProperty('flex-direction');
      main.setAttribute('aria-hidden', 'true');
    }
    var float = document.getElementById('menu-float-panel');
    if (float) {
      float.classList.remove('open');
      float.style.removeProperty('display');
    }
  }

  function syncMapSize() {
    try {
      if (typeof map !== 'undefined' && map && typeof map.resize === 'function') {
        requestAnimationFrame(function () { try { map.resize(); } catch (_) {} });
      }
    } catch (_) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    resetMobilePanels();
    setTimeout(syncMapSize, 120);
    setTimeout(syncMapSize, 600);
  });

  window.addEventListener('resize', function () {
    resetMobilePanels();
    setTimeout(syncMapSize, 80);
  }, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      setTimeout(syncMapSize, 80);
    }, { passive: true });
  }

  /* Evita o duplo disparo touchend + click do FAB de menu. */
  var fab = document.getElementById('fab-menu');
  if (fab) {
    var lastTouch = 0;
    fab.addEventListener('touchend', function () {
      lastTouch = Date.now();
    }, { passive: true });
    fab.addEventListener('click', function (e) {
      if (Date.now() - lastTouch < 450) {
        e.stopImmediatePropagation();
      }
    }, true);
  }
})();

