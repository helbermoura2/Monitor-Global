/* v7.7 — O script "monitor-global-71-clean-layout-js" reaplica display:flex
   direto no style inline de #v70-header-row sempre que a tela muda
   (resize/orientação/timers). Estilo inline sempre vence regra de CSS
   externa, então só dava pra resolver com JS: um observer que corrige na
   hora, sempre que aquele script tentar reexibir essa seção, mas só na
   vertical (celular deitado e desktop ficam intactos).
   ATUALIZAÇÃO (pedido do Helber): #ux-controlbar (seletor de magnitude +
   ícones de filtro) saiu da lista de "esconder" — ele quer essa barra
   visível no retrato mobile. Só o #v70-header-row continua escondido. */
(function(){
  function deveEsconder(){
    return window.matchMedia('(max-width:900px) and (orientation:portrait)').matches;
  }
  function aplicar(id){
    var el = document.getElementById(id);
    if(!el) return;
    if(deveEsconder()){
      if(el.style.display !== 'none') el.style.setProperty('display','none','important');
    } else if(el.style.display === 'none'){
      el.style.removeProperty('display');
    }
  }
  function apply(){ aplicar('v70-header-row'); }
  function observar(id){
    var el = document.getElementById(id);
    if(!el || !('MutationObserver' in window)) return;
    new MutationObserver(apply).observe(el, {attributes:true, attributeFilter:['style']});
  }
  function iniciar(){
    apply();
    observar('v70-header-row');
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', iniciar, {once:true});
  } else { iniciar(); }
  window.addEventListener('resize', function(){ clearTimeout(window.__mg77rt); window.__mg77rt=setTimeout(apply,50); });
  window.addEventListener('orientationchange', function(){ setTimeout(apply,50); });
  var mq = window.matchMedia('(max-width:900px) and (orientation:portrait)');
  if(mq.addEventListener) mq.addEventListener('change', apply); else if(mq.addListener) mq.addListener(apply);
  setTimeout(apply, 1400);
  setTimeout(apply, 3200);
})();

