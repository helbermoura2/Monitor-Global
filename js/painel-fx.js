/* Efeito de entrada por tipo de evento no card principal (#painel-direito).
   Cada tipo tem sua própria animação em css/painel-fx.css (pd-fx-<tipo>),
   disparada só quando o usuário troca de evento de verdade — nunca em
   silentRefresh (revisão de magnitude etc.), senão o card "tremeria" de novo
   sozinho a cada atualização periódica dos dados.
   Duração da "janela" do efeito por tipo — o padrão é 7s, mas fogo/vulcão
   (brasas) e enchente (maré subindo) pediram mais tempo pra dar pra notar
   direito o efeito. */
const FX_DURATION = { fire: 15200, volcano: 15200, flood: 10200, storm: 10200, tornado: 10200 };
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
    el._fxTimeout = setTimeout(() => { el.classList.remove(cls); }, FX_DURATION[type] || 7200);

    if (type === 'hurricane') spinIcon(7000, 1080);
    else if (type === 'tornado') spinIcon(7000, 2160);
}

function triggerCardFxMag(mag) {
    const el = document.getElementById('painel-direito');
    if (!el) return;
    // Piso de 6px (era 2px): sismos pequenos (M1, M2...) — bem comuns no
    // ciclo automático — ficavam com um tremor quase imperceptível.
    const amp = Math.max(6, Math.min(14, (Number(mag) || 3) * 2));
    el.style.setProperty('--pd-fx-amp', amp + 'px');
}

// ═══════════ CAOS DE SISMO GRANDE — ícones/letras caindo ═══════════
// NUNCA mexe no elemento de verdade: só cria uma CÓPIA visual
// (pointer-events:none) por cima, na posição exata, que cai e some
// sozinha. O elemento real nunca sai do lugar nem perde o clique — só
// #btn-som-header (silenciar o alarme) fica de fora da lista de
// propósito, por ser o controle mais importante bem na hora do abalo.
const FALL_POOL_SMALL = ['.mg-logo-icon', '#kpi-wx-icon', '#kpi-brent-label', '.av-radar'];
const FALL_POOL_BIG = [
    '.mg-logo-icon', '#kpi-wx-icon', '#kpi-brent-label', '#btn-radar-header',
    '.av-radar', '#kpi-relogio', '#sp-city-name', '#kpi-temp', '#kpi-wind', '.chip'
];

function ensureFallLayer() {
    let layer = document.getElementById('mg-fall-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'mg-fall-layer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(layer);
    }
    return layer;
}

// Solta uma peça (cópia de elemento OU span de 1 caractere) na posição
// de `rect`, com queda/rotação levemente aleatórias pra não parecer tudo
// igualzinho, e se autodestrói depois de cair.
function spawnFallPiece(layer, rect, delaySec, pieceEl) {
    pieceEl.classList.add('mg-fall-piece');
    pieceEl.style.left = rect.left + 'px';
    pieceEl.style.top = rect.top + 'px';
    pieceEl.style.width = rect.width + 'px';
    pieceEl.style.height = rect.height + 'px';
    const dx = Math.round((Math.random() * 2 - 1) * 70);
    const rot = Math.round((Math.random() * 2 - 1) * 420);
    const dur = (1.6 + Math.random() * 1.2).toFixed(2);
    pieceEl.style.setProperty('--fall-dx', dx + 'px');
    pieceEl.style.setProperty('--fall-rot', rot + 'deg');
    pieceEl.style.setProperty('--fall-dur', dur + 's');
    pieceEl.style.setProperty('--fall-delay', delaySec.toFixed(2) + 's');
    layer.appendChild(pieceEl);
    setTimeout(() => { try { pieceEl.remove(); } catch (e) {} }, (delaySec + Number(dur) + 0.3) * 1000);
}

function dropElementClone(layer, el, delaySec) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const clone = el.cloneNode(true);
    clone.removeAttribute('id');
    clone.style.margin = '0';
    spawnFallPiece(layer, rect, delaySec, clone);
}

// Mede a posição de cada caractere de um texto usando o próprio motor de
// layout do navegador — um clone RASO (sem filhos) do elemento real,
// invisível e fora da árvore visível, nunca o elemento que a pessoa vê.
// Bem mais confiável que tentar recalcular fonte/kerning na mão.
function measureCharRects(el) {
    if (!el || !el.textContent) return [];
    const rect = el.getBoundingClientRect();
    const probe = el.cloneNode(false);
    const chars = [...el.textContent];
    const spans = chars.map(ch => {
        const s = document.createElement('span');
        s.textContent = ch;
        probe.appendChild(s);
        return s;
    });
    probe.style.position = 'fixed';
    probe.style.left = rect.left + 'px';
    probe.style.top = rect.top + 'px';
    probe.style.margin = '0';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    document.body.appendChild(probe);
    const out = spans.map(s => ({ char: s.textContent, rect: s.getBoundingClientRect(), cs: getComputedStyle(s) }));
    document.body.removeChild(probe);
    return out;
}

function dropTextChars(layer, el, baseDelaySec, spreadSec) {
    measureCharRects(el).forEach(c => {
        if (!c.char.trim()) return;
        const span = document.createElement('span');
        span.textContent = c.char;
        span.style.font = c.cs.font;
        span.style.color = c.cs.color;
        span.style.letterSpacing = c.cs.letterSpacing;
        spawnFallPiece(layer, c.rect, baseDelaySec + Math.random() * spreadSec, span);
    });
}

function pickRandom(arr, n) {
    const copy = arr.slice(), out = [];
    while (copy.length && out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    return out;
}

function triggerFallingIcons(mag, durationMs) {
    const m = Number(mag) || 0;
    if (m < 6) return;
    const layer = ensureFallLayer();
    if (m < 7) {
        // M6-6.9: só 2-3 peças, caindo quase juntas — um susto pequeno.
        const targets = pickRandom(FALL_POOL_SMALL.map(sel => document.querySelector(sel)).filter(Boolean), 2 + Math.round(Math.random()));
        targets.forEach((el, i) => dropElementClone(layer, el, i * 0.4));
        return;
    }
    // M7+: "caos completo" — quase tudo da lista grande, espalhado pela
    // janela toda (nunca tudo de uma vez, senão perde a sensação de ir
    // desmoronando aos poucos).
    const spreadSec = Math.max(4, durationMs / 1000 - 3);
    const bigTargets = [];
    FALL_POOL_BIG.forEach(sel => document.querySelectorAll(sel).forEach(el => bigTargets.push(el)));
    const chosen = pickRandom(bigTargets, Math.min(bigTargets.length, 22));
    chosen.forEach((el, i) => dropElementClone(layer, el, (i / Math.max(1, chosen.length)) * spreadSec));

    // Bônus M7+: nome do site e o preço do Brent caem letra por letra.
    const wordEl = document.querySelector('.mg-logo-word');
    const brentEl = document.getElementById('kpi-brent');
    if (wordEl) dropTextChars(layer, wordEl, 1, spreadSec * 0.7);
    if (brentEl) dropTextChars(layer, brentEl, 3, spreadSec * 0.5);
}
window.triggerFallingIcons = triggerFallingIcons;

// M6+ treme o site INTEIRO (não só o card) por 10s — pedido do usuário
// pra dar a sensação de "caos" num sismo grande de verdade. M7+ soma um
// escurecer piscando por cima (reaproveita #vignette-cinematic, que já
// existe pra um efeito mais discreto — aqui com uma classe própria bem
// mais forte) e os ícones/letras caindo acima, e a janela sobe de 10
// pra 15s (mais espaço pra tudo cair aos poucos, sem amontoar). Roda no
// MESMO ponto onde o card já treme/muda de cor (showEventDetails, js/
// painel-e-lista.js) — sismo novo de verdade, clique manual no evento e
// revisita do ciclo automático disparam igual, sem distinção.
let __siteChaosTimeout = null;
function triggerSiteChaos(mag) {
    const m = Number(mag) || 0;
    if (m < 6) return;
    const durationMs = m >= 7 ? 15000 : 10000;
    const app = document.getElementById('app');
    const veil = document.getElementById('vignette-cinematic');
    try { clearTimeout(__siteChaosTimeout); } catch (e) {}
    if (app) {
        app.classList.remove('mg-site-shake');
        void app.offsetWidth;
        app.style.setProperty('--mg-shake-amp', (m >= 7 ? '16px' : '10px'));
        app.style.setProperty('--mg-chaos-dur', (durationMs / 1000) + 's');
        app.classList.add('mg-site-shake');
    }
    if (veil) veil.classList.remove('mg-chaos-dark');
    if (m >= 7 && veil) {
        veil.style.setProperty('--mg-chaos-dur', (durationMs / 1000) + 's');
        void veil.offsetWidth;
        veil.classList.add('mg-chaos-dark');
    }
    try { triggerFallingIcons(m, durationMs); } catch (e) {}
    __siteChaosTimeout = setTimeout(() => {
        if (app) app.classList.remove('mg-site-shake');
        if (veil) veil.classList.remove('mg-chaos-dark');
    }, durationMs);
}
window.triggerSiteChaos = triggerSiteChaos;

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
