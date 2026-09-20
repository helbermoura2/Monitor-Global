/* Efeito de entrada por tipo de evento no card principal (#painel-direito).
   Cada tipo tem sua própria animação em css/painel-fx.css (pd-fx-<tipo>),
   disparada só quando o usuário troca de evento de verdade — nunca em
   silentRefresh (revisão de magnitude etc.), senão o card "tremeria" de novo
   sozinho a cada atualização periódica dos dados. */
function triggerCardFx(type, color) {
    const el = document.getElementById('painel-direito');
    if (!el || !type) return;
    try { clearTimeout(el._fxTimeout); } catch (e) {}
    stopIconSpin();
    el.className.split(' ').forEach(c => { if (c.indexOf('pd-fx-') === 0) el.classList.remove(c); });
    el.style.setProperty('--pd-fx-color', color || '#38bdf8');
    // Força reflow pra reiniciar a animação mesmo selecionando o mesmo tipo
    // de evento em seguida (senão a classe já presente não retrigger nada).
    void el.offsetWidth;
    const cls = 'pd-fx-' + type;
    el.classList.add(cls);
    el._fxTimeout = setTimeout(() => { el.classList.remove(cls); }, 7200);

    if (type === 'hurricane') spinIcon(7000, 1080);
    else if (type === 'tornado') spinIcon(7000, 2160);
}

function triggerCardFxMag(mag) {
    const el = document.getElementById('painel-direito');
    if (!el) return;
    const amp = Math.max(2, Math.min(14, (Number(mag) || 3) * 2));
    el.style.setProperty('--pd-fx-amp', amp + 'px');
}

/* Gira o ícone central (#pd-mag) quadro a quadro via inline style com
   prioridade "important" — é a única forma de vencer o
   "transform: translateX(-50%) !important" que centraliza o ícone
   (css/mobile-late-patches.css); uma animação CSS normal nunca ganharia
   desse empate. Ao terminar, remove o override e o ícone volta sozinho
   pro transform !important original (centralizado, sem rotação). */
let __pdSpinRAF = null;
function stopIconSpin() {
    if (__pdSpinRAF) { cancelAnimationFrame(__pdSpinRAF); __pdSpinRAF = null; }
    const mag = document.getElementById('pd-mag');
    if (mag) mag.style.removeProperty('transform');
}
function spinIcon(durationMs, totalDeg) {
    const mag = document.getElementById('pd-mag');
    if (!mag) return;
    stopIconSpin();
    const start = performance.now();
    // acelera e desacelera (ease-in-out) em vez de girar em velocidade linear
    const ease = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    function tick(now) {
        const t = Math.min(1, (now - start) / durationMs);
        const deg = ease(t) * totalDeg;
        mag.style.setProperty('transform', `translateX(-50%) rotate(${deg}deg)`, 'important');
        if (t < 1) {
            __pdSpinRAF = requestAnimationFrame(tick);
        } else {
            __pdSpinRAF = null;
            mag.style.removeProperty('transform');
        }
    }
    __pdSpinRAF = requestAnimationFrame(tick);
}

window.triggerCardFx = triggerCardFx;
window.triggerCardFxMag = triggerCardFxMag;
