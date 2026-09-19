(function(){
  const _orig = window.showAlertDetails;
  // showAlertDetails is not on window; use MutationObserver on painel
  function enhance() {
    const src = document.getElementById('pd-source') || document.querySelector('#painel-direito .event-source');
    const box = document.getElementById('pd-cities') || document.querySelector('#painel-direito');
    if (!box) return;
    let row = document.getElementById('inmet-defesa-row');
    const active = document.querySelector('#events .event.active');
    const isInmet = active && /INMET/i.test(active.innerText || '');
    if (!isInmet) { if (row) row.remove(); return; }
    if (!row) {
      row = document.createElement('div');
      row.id = 'inmet-defesa-row';
      row.style.cssText = 'margin-top:8px;font-size:11px;line-height:1.4';
      row.innerHTML = '<a href="tel:199" style="color:#facc15;font-weight:800">📞 Defesa Civil 199</a> · <a href="https://avisos.inmet.gov.br/" target="_blank" rel="noopener" style="color:#38bdf8">Avisos INMET ↗</a>';
      box.appendChild(row);
    }
  }
  // Observa mudanças reais (troca de evento ativo, nova renderização da
  // lista) em vez de checar via polling pra sempre a cada 2s — o próprio
  // comentário acima já apontava isso como o jeito certo de fazer.
  enhance();
  const eventsEl = document.getElementById('events');
  if (eventsEl && window.MutationObserver) {
    new MutationObserver(enhance).observe(eventsEl, {
      subtree: true, childList: true, attributes: true, attributeFilter: ['class']
    });
  } else {
    setInterval(enhance, 2000); // fallback só se #events ainda não existir
  }
})();

