(function () {
  /* Measure header/ticker space on every desktop viewport, including TV
     browsers and changes between compact desktop and mobile layouts. */
  var MIN_W = 901, appliedTop = null;

  function sync() {
    var w = window.innerWidth;
    if (w < MIN_W) {
      ['sidebar-left','painel-direito'].forEach(function(id){var el=document.getElementById(id);if(el&&appliedTop&&el.style.top===appliedTop)el.style.removeProperty('top');});
      appliedTop=null;return;
    }
    var strip = document.getElementById('top-strip');
    var sidebar = document.getElementById('sidebar-left');
    var painel = document.getElementById('painel-direito');
    if (!strip || (!sidebar && !painel)) return;
    var bottom = strip.getBoundingClientRect().bottom;
    var ticker = document.getElementById('latest-event-ticker');
    if (ticker && getComputedStyle(ticker).display !== 'none') {
      var tb = ticker.getBoundingClientRect().bottom;
      if (tb > bottom) bottom = tb;
    }
    if (bottom <= 0) return;
    var top = Math.round(bottom + 13) + 'px';appliedTop=top;
    if (sidebar) sidebar.style.setProperty('top', top, 'important');
    if (painel) painel.style.setProperty('top', top, 'important');
  }

  function init() {
    sync();
    var strip = document.getElementById('top-strip');
    var ticker = document.getElementById('latest-event-ticker');
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(sync);
      if (strip) ro.observe(strip);
      if (ticker) ro.observe(ticker);
    }
    window.addEventListener('resize', function () {
      clearTimeout(window.__mgPanelsTopRt);
      window.__mgPanelsTopRt = setTimeout(sync, 200);
    });
    window.addEventListener('orientationchange', function () { setTimeout(sync, 250); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  setTimeout(sync, 1200);
  setTimeout(sync, 3000);
})();
