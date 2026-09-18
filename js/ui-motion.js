/* ui-motion.js — aciona as transições de css/ui-motion.css quando o
   conteúdo de um valor realmente muda, sem tocar nas funções que já
   atualizam esses elementos (js/brent.js, js/clima-local.js,
   js/painel-e-lista.js). Só observa e reage — puramente visual,
   não mexe em layout nem em tamanho de nada. */
(function () {
  function restartAnimation(el, className) {
    if (!el) return;
    el.classList.remove(className);
    void el.offsetWidth; // força reflow pra poder reiniciar a animação
    el.classList.add(className);
  }

  function watchValueChange(id) {
    var el = document.getElementById(id);
    if (!el) return;
    var last = el.textContent;
    var obs = new MutationObserver(function () {
      if (el.textContent === last) return;
      last = el.textContent;
      restartAnimation(el, 'mg-value-pulse');
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
  }

  ['kpi-temp', 'kpi-brent', 'latest-event-ticker-text', 'latest-event-ticker-kicker']
    .forEach(watchValueChange);

  var ticker = document.getElementById('latest-event-ticker');
  if (ticker) {
    var lastSev = ticker.dataset.sev;
    var obs = new MutationObserver(function () {
      if (ticker.dataset.sev === lastSev) return;
      lastSev = ticker.dataset.sev;
      if (lastSev && lastSev !== 'none') restartAnimation(ticker, 'mg-ticker-ping');
    });
    obs.observe(ticker, { attributes: true, attributeFilter: ['data-sev'] });
  }
})();
