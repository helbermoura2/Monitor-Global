(function(){
  // Garante que o ticker nunca herde um "top" inline deixado por
  // scripts antigos (v7.0–v7.2), que é a causa do texto sobreposto.
  // v28.4 — parou de mexer em "position": js/mobile-portrait-clean-toggle.js
  // e js/header-v72.js (que já cobrem toda a faixa ≤900px) dependem de
  // manter position:static no ticker pra ele ficar no fluxo normal, logo
  // abaixo do cabeçalho; remover isso aqui, num timer independente dos
  // dois scripts, fazia o ticker cair de volta pra position:absolute do
  // CSS antigo (que sobrepõe o cabeçalho) por 1-2s até o próximo
  // setTimeout de um dos dois scripts corrigir de novo.
  function limparTopDoTicker(){
    var t = document.getElementById('latest-event-ticker');
    if(t && window.matchMedia('(max-width:900px)').matches){
      t.style.removeProperty('top');
    }
  }
  document.addEventListener('DOMContentLoaded', limparTopDoTicker);
  window.addEventListener('resize', limparTopDoTicker);
  setTimeout(limparTopDoTicker, 300);
  setTimeout(limparTopDoTicker, 1500);
})();

