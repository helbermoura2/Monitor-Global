(function(){
  // Garante que o ticker nunca herde um "top" inline deixado por
  // scripts antigos (v7.0–v7.2), que é a causa do texto sobreposto.
  function limparTopDoTicker(){
    var t = document.getElementById('latest-event-ticker');
    if(t && window.matchMedia('(max-width:900px)').matches){
      t.style.removeProperty('top');
      t.style.removeProperty('position');
    }
  }
  document.addEventListener('DOMContentLoaded', limparTopDoTicker);
  window.addEventListener('resize', limparTopDoTicker);
  setTimeout(limparTopDoTicker, 300);
  setTimeout(limparTopDoTicker, 1500);
})();

