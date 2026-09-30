/* Gesto restrito à alça: o conteúdo continua com rolagem nativa. */
(() => {
  const mobile = window.matchMedia('(max-width:900px)');
  function destination(stage, distance) {
    if (Math.abs(distance) < 36) return stage;
    const steps = Math.abs(distance) >= 150 ? 2 : 1;
    return Math.max(0, Math.min(2, stage + (distance > 0 ? steps : -steps)));
  }
  function install() {
    const panel = document.getElementById('painel-direito');
    if (!panel) return;
    const handle = document.createElement('button');
    handle.id = 'mobile-detail-handle'; handle.type = 'button';
    handle.setAttribute('aria-label','Arrastar ou tocar para expandir o cartão');
    handle.setAttribute('aria-controls','painel-direito');
    handle.innerHTML = '<span aria-hidden="true"></span>';
    panel.prepend(handle);
    let drag = null, ignoreClickUntil = 0;
    const body = document.body;
    const stage = () => body.classList.contains('mobile-details-open') ? 2 : body.classList.contains('mobile-details-mid') ? 1 : 0;
    function apply(next) {
      body.classList.toggle('mobile-details-open', next === 2);
      body.classList.toggle('mobile-details-mid', next === 1);
      panel.scrollTop = 0;
    }
    function sync() {
      handle.setAttribute('aria-expanded', String(stage() > 0));
      handle.setAttribute('aria-label', stage() === 2 ? 'Arrastar para recolher o cartão; toque para mostrar o resumo' : 'Arrastar ou tocar para expandir o cartão');
    }
    function clean() {
      body.classList.remove('mg-sheet-dragging');
      panel.style.removeProperty('--mg-sheet-drag-height');
      const pointerId = drag?.id;
      drag = null;
      if (pointerId != null && handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
    }
    handle.addEventListener('pointerdown', event => {
      if (!mobile.matches || (event.button != null && event.button !== 0) || drag) return;
      event.stopPropagation();
      drag = {id:event.pointerId,y:event.clientY,stage:stage(),height:panel.getBoundingClientRect().height,distance:0};
      handle.setPointerCapture?.(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      drag.distance = drag.y - event.clientY;
      if (Math.abs(drag.distance) < 8) return;
      event.preventDefault(); event.stopPropagation();
      body.classList.add('mg-sheet-dragging');
      const max = Math.min(window.innerHeight * .84, 680);
      panel.style.setProperty('--mg-sheet-drag-height', Math.max(68,Math.min(max,drag.height + drag.distance)) + 'px');
    });
    handle.addEventListener('pointerup', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const next = destination(drag.stage, drag.y - event.clientY);
      const moved = Math.abs(drag.y - event.clientY) >= 8;
      clean();
      if (moved) { ignoreClickUntil = Date.now() + 400; apply(next); }
      event.stopPropagation();
    });
    handle.addEventListener('pointercancel', () => {clean();ignoreClickUntil=Date.now()+400;});
    handle.addEventListener('lostpointercapture', () => {if(drag)clean();});
    handle.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation();
      if (!mobile.matches || Date.now() < ignoreClickUntil) return;
      apply(stage() === 2 ? 1 : stage() + 1);
    });
    handle.addEventListener('keydown', event => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault(); event.stopPropagation();
      apply(Math.max(0,Math.min(2,stage() + (event.key === 'ArrowUp' ? 1 : -1))));
    });
    mobile.addEventListener('change', () => {clean();sync();});
    new MutationObserver(sync).observe(body,{attributes:true,attributeFilter:['class']});
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();
