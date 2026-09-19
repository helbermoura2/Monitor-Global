(function(){
  // Garante que o ticker nunca herde um "top" inline deixado por
  // scripts antigos (v7.0–v7.2), que é a causa do texto sobreposto.
  // v28.4 — parou de mexer em "position": js/header-v72.js (tablet,
  // 701-900px) depende de manter position:static no ticker pra ele
  // ficar no fluxo normal, logo abaixo do cabeçalho; remover isso aqui,
  // num timer independente, fazia o ticker cair de volta pra
  // position:absolute do CSS antigo (que sobrepõe o cabeçalho) por 1-2s
  // até o próximo setTimeout corrigir de novo.
  // Em retrato estreito (body.mg-clean-portrait) essa lógica agora é o
  // OPOSTO: js/mobile-portrait-clean-toggle.js deixou de forçar
  // position:static nesse modo — o ticker é position:absolute de
  // propósito, com "top" sincronizado ativamente por
  // js/clima-local.js (__posicionarTickerAbaixoDoHeader). Limpar "top"
  // aqui nesse modo desfaria esse sincronismo, então pula.
  function limparTopDoTicker(){
    var t = document.getElementById('latest-event-ticker');
    if(document.body.classList.contains('mg-clean-portrait')) return;
    if(t && window.matchMedia('(max-width:900px)').matches){
      t.style.removeProperty('top');
    }
  }
  document.addEventListener('DOMContentLoaded', limparTopDoTicker);
  window.addEventListener('resize', limparTopDoTicker);
  setTimeout(limparTopDoTicker, 300);
  setTimeout(limparTopDoTicker, 1500);
})();

