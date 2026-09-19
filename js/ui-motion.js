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

  ['kpi-temp', 'kpi-brent'].forEach(watchValueChange);

  // Faixa "AO VIVO": kicker+texto deslizam juntos (mg-ticker-slide, em
  // css/ui-motion.css) em vez do fade genérico usado nas métricas —
  // ver o .let-mid como uma unidade só, não dois valores separados.
  (function watchTickerSlide() {
    var mid = document.querySelector('#latest-event-ticker .let-mid');
    var textEl = document.getElementById('latest-event-ticker-text');
    if (!mid || !textEl) return;
    var last = textEl.textContent;
    var obs = new MutationObserver(function () {
      if (textEl.textContent === last) return;
      last = textEl.textContent;
      restartAnimation(mid, 'mg-ticker-slide');
    });
    obs.observe(textEl, { childList: true, characterData: true, subtree: true });
  })();

  // Painel direito (desktop): o painel inteiro leva o fade+slide sutil de
  // sempre (mg-panel-swap), e o título do evento (#pd-local — "16 km S of
  // Twentynine Palms, CA") ganha o tratamento completo de "breaking news":
  // o texto antigo sai deslizando pra fora pela esquerda (num "fantasma"
  // por cima) enquanto o novo entra digitado, tipo teletipo, com cursor
  // piscando — sem tocar em showEventDetails/showAlertDetails, só reagindo
  // à mudança de texto que elas já fazem.
  (function watchPanelSwap() {
    var local = document.getElementById('pd-local');
    var panel = document.getElementById('painel-direito');
    if (!local || !panel) return;
    var lastCommitted = local.textContent;
    var typing = false;
    var typingTarget = null;

    function spawnGhost(text) {
      var host = local.offsetParent || panel;
      if (!host) return;
      var cs = getComputedStyle(local);
      var ghost = document.createElement('div');
      ghost.className = 'mg-headline-ghost';
      ghost.textContent = text;
      ghost.style.left = local.offsetLeft + 'px';
      ghost.style.top = local.offsetTop + 'px';
      ghost.style.width = local.offsetWidth + 'px';
      ghost.style.boxSizing = 'border-box';
      ghost.style.font = cs.font;
      ghost.style.color = cs.color;
      ghost.style.lineHeight = cs.lineHeight;
      ghost.style.letterSpacing = cs.letterSpacing;
      ghost.style.whiteSpace = cs.whiteSpace;
      ghost.style.textAlign = cs.textAlign;
      ghost.style.padding = cs.padding;
      ghost.style.border = cs.border;
      ghost.style.borderColor = 'transparent';
      host.appendChild(ghost);
      requestAnimationFrame(function () { ghost.classList.add('mg-headline-ghost-out'); });
      setTimeout(function () { if (ghost.parentNode) ghost.remove(); }, 420);
    }

    function typeIn(toText) {
      typing = true;
      typingTarget = toText;
      if (!local.style.minHeight) local.style.minHeight = local.offsetHeight + 'px';
      local.textContent = '';
      local.classList.add('mg-headline-in');
      var i = 0;
      var step = Math.max(35, Math.min(70, Math.round(1200 / Math.max(toText.length, 1))));
      (function tick() {
        i++;
        local.textContent = toText.slice(0, i);
        if (i < toText.length) {
          local._mgTypeId = setTimeout(tick, step);
        } else {
          local._mgTypeId = null;
          local.classList.remove('mg-headline-in');
          local.style.minHeight = '';
          typing = false;
          typingTarget = null;
          lastCommitted = toText;
        }
      })();
    }

    var obs = new MutationObserver(function () {
      var real = local.textContent;
      // passo do nosso próprio typewriter (real é sempre um prefixo do alvo)?
      if (typing && typingTarget && real.length <= typingTarget.length && typingTarget.slice(0, real.length) === real) {
        return;
      }
      if (!typing && real === lastCommitted) return;

      restartAnimation(panel, 'mg-panel-swap');

      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var desktop = window.matchMedia && window.matchMedia('(min-width:901px)').matches;
      if (reduceMotion || !desktop) {
        if (local._mgTypeId) { clearTimeout(local._mgTypeId); local._mgTypeId = null; }
        typing = false; typingTarget = null;
        lastCommitted = real;
        return;
      }

      // troca real nova, ou uma preempção (evento mudou de novo no meio da digitação)
      if (local._mgTypeId) clearTimeout(local._mgTypeId);
      spawnGhost(lastCommitted);
      typeIn(real);
    });
    obs.observe(local, { childList: true, characterData: true, subtree: true });
  })();

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
