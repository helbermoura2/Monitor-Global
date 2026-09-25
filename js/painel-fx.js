/* Efeito de entrada por tipo de evento no card principal (#painel-direito).
   Cada tipo tem sua própria animação em css/painel-fx.css (pd-fx-<tipo>),
   disparada só quando o usuário troca de evento de verdade — nunca em
   silentRefresh (revisão de magnitude etc.), senão o card "tremeria" de novo
   sozinho a cada atualização periódica dos dados.
   Duração da "janela" do efeito por tipo — o padrão é 7s, mas fogo/vulcão
   (brasas) e enchente (maré subindo) pediram mais tempo pra dar pra notar
   direito o efeito. */
const FX_DURATION = { fire: 15200, volcano: 15200, flood: 10200, storm: 10200, tornado: 10200, hurricane: 12200, wind: 7200 };
function triggerCardFx(type, color) {
    const el = document.getElementById('painel-direito');
    if (!el || !type) return;
    try { clearTimeout(el._fxTimeout); } catch (e) {}
    stopIconSpin();
    restoreWindLetters();
    el.className.split(' ').forEach(c => { if (c.indexOf('pd-fx-') === 0) el.classList.remove(c); });
    el.style.setProperty('--pd-fx-color', color || '#38bdf8');
    // Força reflow pra reiniciar a animação mesmo selecionando o mesmo tipo
    // de evento em seguida (senão a classe já presente não retrigger nada).
    void el.offsetWidth;
    const cls = 'pd-fx-' + type;
    el.classList.add(cls);
    el._fxTimeout = setTimeout(() => { el.classList.remove(cls); }, FX_DURATION[type] || 7200);

    if (type === 'hurricane') {
        spinIcon(12000, 1800);
        triggerWindLetters(FX_DURATION.hurricane);
    } else if (type === 'tornado') spinIcon(7000, 2160);
    else if (type === 'wind') triggerWindLetters(FX_DURATION.wind);
}

// ═══════════ FURACÃO / VENTO — vento arrancando as letras do local do evento ═══════════
// Embrulha cada CARACTERE do texto REAL de #pd-local num <span> pra poder
// tremer/voar sozinho via CSS (.pd-fx-windletter, css/painel-fx.css) —
// nunca troca/esconde o texto, só envolve o mesmo conteúdo. Ao restaurar,
// reconstrói o texto a partir dos PRÓPRIOS spans (não de uma cópia
// guardada de antes) — importante porque js/painel-e-lista.js pode setar
// #pd-local.textContent com um valor NOVO antes de chamar triggerCardFx
// de novo (ex.: outro furacão em seguida, ainda dentro da janela
// anterior); se restaurássemos pra uma string velha guardada, esse texto
// novo seria apagado e trocado de volta pelo do furacão anterior.
//
// BUG encontrado (usuário reportou "as letras só voam se eu clicar
// manualmente, não na primeira vez"): js/painel-e-lista.js seta
// #pd-local.textContent de novo toda vez que o card é atualizado —
// inclusive num silentRefresh (revisão de dados do furacão/vento em
// segundo plano, sem o usuário clicar em nada), que roda facilmente nos
// primeiros segundos depois de abrir um evento. Isso apagava os <span>
// recém-criados, e como silentRefresh nunca chama triggerCardFx de novo,
// nada reconstruía o embrulho — o efeito ficava "morto" até o próximo
// clique manual (que passa pelo caminho normal, não-silencioso).
// Corrigido com um MutationObserver (ver triggerWindLetters): sempre que
// o texto voltar a ficar puro (sem os spans) enquanto o efeito ainda
// devia estar ativo, reembrulha sozinho, não importa quantas vezes algo
// de fora resetar o texto.
let __windLettersEl = null;
let __windLettersTimeout = null;
let __windLettersObserver = null;
function restoreWindLetters() {
    try { clearTimeout(__windLettersTimeout); } catch (e) {}
    stopLetterGusts();
    try { __windLettersObserver && __windLettersObserver.disconnect(); } catch (e) {}
    __windLettersObserver = null;
    if (__windLettersEl) {
        const spans = __windLettersEl.querySelectorAll('.pd-fx-windletter');
        if (spans.length) {
            __windLettersEl.textContent = [...spans]
                .map(s => s.textContent === ' ' ? ' ' : s.textContent)
                .join('');
        }
    }
    __windLettersEl = null;
    __windLettersTimeout = null;
}
function wrapWindLetters(el) {
    const frag = document.createDocumentFragment();
    [...el.textContent].forEach((ch, i) => {
        const span = document.createElement('span');
        span.className = 'pd-fx-windletter';
        span.style.setProperty('--wl-i', i);
        // Espaço normal SOZINHO dentro de um inline-block é tratado como
        // espaço "de borda" e colapsado pra zero (o texto colava:
        // "FuracãoKatrina") — troca por espaço não-quebrável, que não
        // sofre esse colapso e mede a largura certinha.
        span.textContent = ch === ' ' ? ' ' : ch;
        frag.appendChild(span);
    });
    el.textContent = '';
    el.appendChild(frag);
}
function triggerWindLetters(durationMs) {
    const el = document.getElementById('pd-local');
    if (!el || !el.textContent) return;
    __windLettersEl = el;
    wrapWindLetters(el);
    __windLettersTimeout = setTimeout(restoreWindLetters, durationMs);
    startLetterGusts(el, durationMs);

    // Auto-cura: se algo de fora (silentRefresh do card, por exemplo)
    // resetar #pd-local pra texto puro enquanto o efeito ainda devia
    // estar rodando, reembrulha sozinho na hora — ver comentário grande
    // acima sobre o bug "só voa se clicar manualmente".
    try { __windLettersObserver && __windLettersObserver.disconnect(); } catch (e) {}
    __windLettersObserver = new MutationObserver(() => {
        if (el.textContent && !el.querySelector('.pd-fx-windletter')) wrapWindLetters(el);
    });
    __windLettersObserver.observe(el, { childList: true });
}

// Rajada: pega algumas letras ao acaso e solta uma CÓPIA de cada uma
// voando (translateX/Y + rotação + fade, css/painel-fx.css
// pdLetterBlowAway) — a letra REAL nunca some, só pisca/estremece um
// instante (.pd-fx-windletter-hit) enquanto a cópia voa, então o nome do
// evento nunca fica ilegível por muito tempo, só "treme" a cada rajada.
// Reaproveita ensureFallLayer/pickRandom, definidas mais abaixo neste
// arquivo pro caos de sismo M7+ — mesma técnica: nunca mexe no elemento
// real, só clona.
let __letterGustInterval = null;
function spawnLetterGust(el) {
    if (!el) return;
    const spans = el.querySelectorAll('.pd-fx-windletter');
    if (!spans.length) return;
    const layer = ensureFallLayer();
    const chosen = pickRandom([...spans], 2 + Math.floor(Math.random() * 3));
    chosen.forEach((span) => {
        const rect = span.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        span.classList.remove('pd-fx-windletter-hit');
        void span.offsetWidth;
        span.classList.add('pd-fx-windletter-hit');

        const cs = getComputedStyle(span);
        const clone = document.createElement('span');
        clone.className = 'pd-fx-letter-blown';
        clone.textContent = span.textContent;
        clone.style.font = cs.font;
        clone.style.color = cs.color;
        clone.style.left = rect.left + 'px';
        clone.style.top = rect.top + 'px';
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        const dx = Math.round(120 + Math.random() * 90);
        const dy = Math.round(-30 + Math.random() * 50);
        const rot = Math.round(220 + Math.random() * 220);
        clone.style.setProperty('--blow-dx', dx + 'px');
        clone.style.setProperty('--blow-dy', dy + 'px');
        clone.style.setProperty('--blow-rot', rot + 'deg');
        layer.appendChild(clone);
        setTimeout(() => { try { clone.remove(); } catch (e) {} }, 1300);
    });
}
function startLetterGusts(el, durationMs) {
    stopLetterGusts();
    __letterGustInterval = setInterval(() => spawnLetterGust(el), 1500);
    setTimeout(stopLetterGusts, durationMs);
}
function stopLetterGusts() {
    try { clearInterval(__letterGustInterval); } catch (e) {}
    __letterGustInterval = null;
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
