
(function stripMobileClassesOnDesktop() {
  function clean() {
    try {
      if (window.innerWidth > 900) {
        document.body.classList.remove('mobile-details-mid', 'mobile-details-open', 'mobile-events-open');
      }
    } catch (e) {}
  }
  clean();
  window.addEventListener('resize', clean);
  window.addEventListener('orientationchange', clean);
})();

/* FAB mobile — toque confiável no S25 / Nothing */
(function () {
  function $(id) { return document.getElementById(id); }
  function wire(id, fn) {
    var el = $(id);
    if (!el) return;
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      fn();
    }, true);
    el.addEventListener('touchend', function (e) {
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      fn();
    }, { passive: false });
  }
  // wire('fab-menu', ...) foi removido daqui: o handler que realmente vale
  // pro ☰ é o de mobile-fab-menu-final-handler-2026-08-24, mais abaixo no
  // arquivo — ele roda depois e substitui o nó do botão (cloneNode), então
  // qualquer listener preso aqui nunca sobrevivia até o usuário tocar.
  wire('fab-audio', function () {
    if (typeof window.toggleSomAtivo === 'function') {
      window.toggleSomAtivo({ speak: true });
      return;
    }
    var b = $('btn-som-header') || $('btn-som');
    if (b) b.click();
  });
  wire('fab-events', function () {
    if (typeof window.toggleMobileEventsModal === 'function') {
      window.toggleMobileEventsModal(true);
      return;
    }
    // fallback: abre sidebar
    document.body.classList.add('mobile-events-open');
    var sb = $('sidebar-left');
    if (sb) {
      sb.style.display = 'flex';
      sb.style.position = 'fixed';
      sb.style.zIndex = '500020';
      sb.style.inset = '0';
      sb.style.width = '100%';
      sb.style.maxWidth = '100%';
      sb.style.background = '#020816';
    }
  });
})();

