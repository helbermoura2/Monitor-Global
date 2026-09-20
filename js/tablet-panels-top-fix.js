(function () {
  /* Mesma raiz do bug corrigido em js/header-v72.js (top:50px fixo do
     ticker, calibrado pra um cabeçalho mais baixo do que o atual): aqui é
     #sidebar-left/#painel-direito, com "top:178px" fixo em
     css/desktop-layout-lock.css (901-1100px) — calibrado pra encostar
     logo abaixo do cabeçalho, mas sem contar com o #latest-event-ticker
     (o balão "AO VIVO"/alerta) quando ele está visível, ~58px mais alto.
     Nessa faixa de largura — a mesma que tablets reais usam e que o
     "Solicitar site para computador" do Chrome força num celular — a
     sidebar e o painel de detalhes ficavam parcialmente escondidos atrás
     do próprio ticker.

     Independente do resto do cabeçalho de propósito: script isolado, sem
     mexer em js/header-v72.js nem em nenhum "ativo()"/reflow existente —
     só mede a borda inferior real do cabeçalho (e do ticker, quando
     visível) e usa isso como "top" da sidebar/painel, com o mesmo respiro
     de 13px que o valor fixo original já usava (178 - 165). */
  var MIN_W = 901, MAX_W = 1100;

  function sync() {
    var w = window.innerWidth;
    if (w <= MIN_W - 1 || w > MAX_W) return;
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
    var top = Math.round(bottom + 13) + 'px';
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
