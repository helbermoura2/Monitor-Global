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

  // Caixa de registros: entrada em cascata dos cards só quando a caixa
  // realmente ACABOU de abrir (fechada -> aberta), nunca em re-renders
  // normais da lista (que acontecem o tempo todo com dados novos).
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    var wasEventsOpen = document.body.classList.contains('mobile-events-open');
    var modalObs = new MutationObserver(function () {
      var isOpen = document.body.classList.contains('mobile-events-open');
      if (isOpen && !wasEventsOpen) {
        var cards = document.querySelectorAll('#events .event');
        var max = Math.min(cards.length, 24);
        for (var i = 0; i < max; i++) {
          var el = cards[i];
          el.classList.remove('mg-card-in');
          void el.offsetWidth;
          el.style.setProperty('--mg-stagger', (i * 26) + 'ms');
          el.classList.add('mg-card-in');
        }
      }
      wasEventsOpen = isOpen;
    });
    modalObs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
})();
