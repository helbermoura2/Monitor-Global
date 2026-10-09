/* Efeito de entrada por tipo de evento no card principal (#painel-direito).
   Cada tipo tem sua própria animação em css/painel-fx.css (pd-fx-<tipo>),
   disparada só quando o usuário troca de evento de verdade — nunca em
   silentRefresh (revisão de magnitude etc.), senão o card "tremeria" de novo
   sozinho a cada atualização periódica dos dados.
   Os impulsos de entrada (tremor, giro e letras ao vento) têm duração
   limitada. As cenas do CinematicCard restauram o cartão em 16 segundos;
   os prazos abaixo também atendem ao fallback. */
const FX_DURATION = { earthquake: 16000, fire: 15200, volcano: 15200, flood: 10200, storm: 10200, tornado: 10200, hurricane: 12200, wind: 7200, tsunami: 8000 };
// Decorative discharge channels: thin, irregular, branching paths; no emoji or filled zigzag.
const LIGHTNING_NS='http://www.w3.org/2000/svg';
function lightningPath(points){return points.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');}
function naturalLightning(svg, options = {}){
    const heavy=!!options.heavy,points=[];let x=heavy?27+Math.random()*46:42+Math.random()*14,y=0;
    while(y<400){points.push([x,y]);x=Math.max(heavy?7:14,Math.min(heavy?93:86,x+(Math.random()-.5)*(heavy?13:22)));y=Math.min(400,y+9+Math.random()*12);}
    points.push([x,400]);
    const main=lightningPath(points),branches=[],filaments=[];
    for(const fraction of [.22,.44,.67,.81]){
        const root=points[Math.floor(points.length*fraction)],branch=[root];let [bx,by]=root;const direction=Math.random()<.5?-1:1;
        for(let n=0;n<4+Math.floor(Math.random()*3);n++){bx=Math.max(2,Math.min(98,bx+direction*(3+Math.random()*7)));by+=7+Math.random()*11;branch.push([bx,Math.min(399,by)]);}
        branches.push(lightningPath(branch));
        if(heavy)for(const fraction of [.35,.7]){
            const root=branch[Math.floor((branch.length-1)*fraction)],twig=[root];let [tx,ty]=root;
            for(let n=0;n<4;n++){tx=Math.max(1,Math.min(99,tx+direction*(1+Math.random()*3)));ty=Math.min(400,ty+5+Math.random()*8);twig.push([tx,ty]);}
            filaments.push(lightningPath(twig));
        }
    }
    svg.replaceChildren();
    svg.dataset.channel=heavy?'heavy':'natural';
    const paths=[...(heavy?[['pd-bolt-corona',main]]:[]),['pd-bolt-halo',main],['pd-bolt-core',main],...branches.map(d=>['pd-bolt-branch',d]),...filaments.map(d=>['pd-bolt-filament',d])];
    for(const [cls,d] of paths){
        const path=document.createElementNS(LIGHTNING_NS,'path');path.setAttribute('class',cls);path.setAttribute('d',d);svg.append(path);
    }
}
function prepareStormLightning(item){
    const enabled=item.type==='storm'&&item.hazardNature!=='bulletin'&&/thunder|trovoad|lightning|\braios?\b|tempestade|orage|gewitter/i.test([item.warningEvent,item.detail,item.place].filter(Boolean).join(' '));
    document.getElementById('painel-direito')?.setAttribute('data-lightning',enabled?'on':'off');
    if(item.type!=='storm'||item.hazardNature==='bulletin')return;
    const icon=document.createElementNS(LIGHTNING_NS,'svg');icon.setAttribute('viewBox','0 0 64 64');icon.setAttribute('class','pd-weather-symbol');icon.setAttribute('role','img');icon.setAttribute('aria-label',enabled?'Ilustração de tempestade com relâmpagos':'Ilustração de chuva');
    const cloud=document.createElementNS(LIGHTNING_NS,'path');cloud.setAttribute('d','M15 31 C5 31 6 17 16 17 C17 5 34 3 40 15 C53 10 62 22 55 30 C52 34 47 34 43 34');cloud.setAttribute('class','pd-cloud-outline');icon.append(cloud);
    if(enabled){const channel=document.createElementNS(LIGHTNING_NS,'svg');channel.setAttribute('x','16');channel.setAttribute('y','28');channel.setAttribute('width','29');channel.setAttribute('height','33');channel.setAttribute('viewBox','0 0 100 400');channel.setAttribute('preserveAspectRatio','none');naturalLightning(channel);icon.append(channel);}
    else{const rain=document.createElementNS(LIGHTNING_NS,'path');rain.setAttribute('d','M21 39 L18 47 M34 41 L31 49 M46 38 L43 46');rain.setAttribute('class','pd-cloud-outline');icon.append(rain);}
    document.getElementById('pd-mag')?.replaceChildren(icon);
}

// End the previous event before replacing its text, gauge and flag.
function resetCardEventFx(item) {
    const el = document.getElementById('painel-direito');
    window.SeismicCinema?.stop();
    window.CinematicCard?.stop();
    if (typeof stopLightningFlash === 'function') stopLightningFlash();
    if (!el) return;
    clearTimeout(el._fxTimeout); el._fxTimeout = null;
    stopIconSpin(); restoreWindLetters(); stopRainEffect();
    el.className.split(' ').forEach(c => { if (c.indexOf('pd-fx-') === 0) el.classList.remove(c); });
    if (item?.type !== 'storm') el.dataset.lightning = 'off';
}
function triggerCardFx(type, color, item) {
    const el = document.getElementById('painel-direito');
    if (!el || !type) return;
    resetCardEventFx(item || {type});
    el.style.setProperty('--pd-fx-color', color || '#38bdf8');
    if(['storm','tornado','hurricane'].includes(type))el.querySelectorAll('.pd-fx-bolt').forEach(naturalLightning);
    // Força reflow pra reiniciar a animação mesmo selecionando o mesmo tipo
    // de evento em seguida (senão a classe já presente não retrigger nada).
    void el.offsetWidth;
    const cls = 'pd-fx-' + type;
    const atmospheric = type!=='earthquake' && window.CinematicCard?.start(item || {type}, Infinity);
    if(type==='earthquake')window.CinematicCard?.start(item || {type}, FX_DURATION[type] || 7200);
    el.classList.add(cls);
    if(!atmospheric)el._fxTimeout = setTimeout(() => { el.classList.remove(cls); }, FX_DURATION[type] || 7200);
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;

    if (type === 'hurricane') {
        if(!atmospheric)spinIcon(12000, 1800);
        if(!atmospheric)triggerWindLetters(FX_DURATION.hurricane);
        if(!window.CinematicCard?.isActive())triggerRainEffect(FX_DURATION.hurricane);
    } else if (type === 'tornado') spinIcon(7000, 2160);
    else if (type === 'wind' && !atmospheric) triggerWindLetters(FX_DURATION.wind);
}

// Camada compartilhada pelas cópias das rajadas e pela chuva de fallback.
// Estes efeitos continuam usando-a mesmo com o sismo em seismic-cinema.js.
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

function pickRandom(arr, n) {
    const copy = arr.slice(), out = [];
    while (copy.length && out.length < n) {
        out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
    }
    return out;
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
let __windTextTargets = [];
const CYCLONE_TEXT_SELECTOR = '#pd-local, #pd-source, #pd-scale-label, .pd-time, .stat-card-label, .stat-card-value, #pd-fault-type, #pd-fault-section-label';
function restoreWindLetters() {
    try { clearTimeout(__windLettersTimeout); } catch (e) {}
    stopLetterGusts();
    try { __windLettersObserver && __windLettersObserver.disconnect(); } catch (e) {}
    __windLettersObserver = null;
    for (const el of __windTextTargets) {
        // Unwrap only our nodes, keeping colored categories and feed formatting.
        el.querySelectorAll('.pd-fx-windletter').forEach(span => span.replaceWith(document.createTextNode(span.textContent)));
        el.querySelectorAll('.pd-fx-windword').forEach(word => word.replaceWith(...word.childNodes));
        el.removeAttribute('data-cyclone-text');
        el.normalize();
    }
    __windTextTargets = [];
    if (__windLettersEl) {
        const spans = __windLettersEl.querySelectorAll('.pd-fx-windletter');
        if (spans.length) {
            // Atualizações podem deixar texto novo fora dos spans antigos.
            // Preserve todo o conteúdo atual, não apenas as letras embrulhadas.
            __windLettersEl.textContent = __windLettersEl.textContent.replace(/\u00a0/g, ' ');
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
        // Direção da rajada sorteada por letra (pedido do usuário: "voar em
        // várias direções, não só uma") — antes toda letra ia pro mesmo
        // canto (cima-esquerda, fixo no CSS); agora cada uma sorteia seu
        // próprio ângulo/distância (css/painel-fx.css, pdLetterGust usa
        // --wl-dx/--wl-dy/--wl-rot), então a rajada varre o texto em
        // ziguezague, não numa fileira só inclinando igual.
        const ang = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 16;
        span.style.setProperty('--wl-dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
        span.style.setProperty('--wl-dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
        span.style.setProperty('--wl-rot', Math.round((Math.random() * 2 - 1) * 34) + 'deg');
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
function wrapCycloneText(el) {
    el.setAttribute('data-cyclone-text', '');
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.textContent.trim() && !node.parentElement.closest('.pd-fx-windword, .pd-fx-windletter')) nodes.push(node);
    }
    const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('pt', {granularity:'grapheme'}) : null;
    for (const node of nodes) {
        const fragment = document.createDocumentFragment();
        for (const token of node.textContent.split(/(\s+)/).flatMap(part => part.length > 24 ? part.match(/[^/\-\u2010]+[/\-\u2010]?|[/\-\u2010]/gu) || [part] : [part])) {
            if (!token.trim()) { fragment.append(document.createTextNode(token)); continue; }
            // Keep real spaces and normal line breaks between words, with intact emoji.
            const word = document.createElement('span');word.className = 'pd-fx-windword';
            const letters = segmenter ? Array.from(segmenter.segment(token), part => part.segment) : Array.from(token);
            for (const char of letters) {
                const letter = document.createElement('span');letter.className = 'pd-fx-windletter';letter.textContent = char;word.append(letter);
            }
            fragment.append(word);
        }
        node.replaceWith(fragment);
    }
}
function triggerWindLetters(durationMs, options = {}) {
    restoreWindLetters();
    if (options.allText) {
        const card = document.getElementById('painel-direito');if (!card) return;
        const wrap = () => {
            __windLettersObserver?.disconnect();
            card.querySelectorAll(CYCLONE_TEXT_SELECTOR).forEach(el => {
                if (!__windTextTargets.includes(el)) __windTextTargets.push(el);
                wrapCycloneText(el);
            });
            __windLettersObserver?.observe(card, {childList:true, subtree:true, characterData:true});
        };
        __windLettersObserver = new MutationObserver(wrap);
        wrap();
        if (Number.isFinite(durationMs)) __windLettersTimeout = setTimeout(restoreWindLetters, durationMs);
        return;
    }
    const el = document.getElementById('pd-local');
    if (!el || !el.textContent) return;
    __windLettersEl = el;
    wrapWindLetters(el);
    if(Number.isFinite(durationMs))__windLettersTimeout = setTimeout(restoreWindLetters, durationMs);
    // The cinematic wind scene supplies one shared pressure field and its own clock.
    if (!options.controlled) startLetterGusts(el, durationMs);

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

// ═══════════ FURACÃO — chuva via camada fixa, fora do card ═══════════
// Gotas de verdade (posição/tamanho/velocidade sorteados por gota, nunca um
// padrão repetido) numa camada position:fixed direto no <body>
// (ensureFallLayer/#mg-fall-layer, a mesma usada pelas rajadas). Ver comentário grande em
// css/painel-fx.css (mgRainFall) pro raciocínio completo de por que a
// chuva antiga (dentro do card) não renderizava em alguns navegadores
// mobile e essa camada fixa resolve.
let __rainInterval = null;
let __rainWrapper = null;
function stopRainEffect() {
    try { clearInterval(__rainInterval); } catch (e) {}
    __rainInterval = null;
    if (__rainWrapper) { try { __rainWrapper.remove(); } catch (e) {} }
    __rainWrapper = null;
}
function spawnRainDrop(wrapper, w, h) {
    const drop = document.createElement('span');
    drop.className = 'mg-rain-drop';
    const len = 14 + Math.random() * 16;
    const left = -40 + Math.random() * (w + 80);
    const dur = (0.45 + Math.random() * 0.35).toFixed(2);
    const delay = (Math.random() * 0.6).toFixed(2);
    drop.style.left = left + 'px';
    drop.style.height = len + 'px';
    drop.style.setProperty('--rain-dur', dur + 's');
    drop.style.setProperty('--rain-delay', delay + 's');
    drop.style.setProperty('--rain-dist', (h + 80) + 'px');
    wrapper.appendChild(drop);
    setTimeout(() => { try { drop.remove(); } catch (e) {} }, (Number(dur) + Number(delay)) * 1000 + 80);
}
function triggerRainEffect(durationMs) {
    const painel = document.getElementById('painel-direito');
    if (!painel) return;
    stopRainEffect();
    const rect = painel.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const layer = ensureFallLayer();
    const wrapper = document.createElement('div');
    wrapper.className = 'mg-rain-wrap';
    wrapper.style.left = rect.left + 'px';
    wrapper.style.top = rect.top + 'px';
    wrapper.style.width = rect.width + 'px';
    wrapper.style.height = rect.height + 'px';
    layer.appendChild(wrapper);
    __rainWrapper = wrapper;

    const spawnBatch = () => { for (let i = 0; i < 4; i++) spawnRainDrop(wrapper, rect.width, rect.height); };
    spawnBatch();
    __rainInterval = setInterval(spawnBatch, 80);
    setTimeout(stopRainEffect, durationMs);
}
window.triggerRainEffect = triggerRainEffect;

// Rajada: pega algumas letras ao acaso e solta uma CÓPIA de cada uma
// voando (translateX/Y + rotação + fade, css/painel-fx.css
// pdLetterBlowAway) — a letra REAL nunca some, só pisca/estremece um
// instante (.pd-fx-windletter-hit) enquanto a cópia voa, então o nome do
// evento nunca fica ilegível por muito tempo, só "treme" a cada rajada.
// Reaproveita ensureFallLayer/pickRandom: nunca mexe no elemento real,
// só clona.
let __letterGustInterval = null;
let __letterGustTimeout = null;
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
        clone.setAttribute('aria-hidden','true');clone.style.pointerEvents='none';
        clone.textContent = span.textContent;
        clone.style.font = cs.font;
        clone.style.color = cs.color;
        clone.style.left = rect.left + 'px';
        clone.style.top = rect.top + 'px';
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        // Direção sorteada em 360° (pedido do usuário: "várias direções, não
        // só uma") — antes dx era sempre positivo (só voava pra direita).
        const ang = -.18 + (Math.random()-.5)*.5;
        const dist = 90 + Math.random() * 120;
        const dx = Math.round(Math.cos(ang) * dist);
        const dy = Math.round(Math.sin(ang) * dist);
        const rot = Math.round((Math.random() * 2 - 1) * 420);
        clone.style.setProperty('--blow-dx', dx + 'px');
        clone.style.setProperty('--blow-dy', dy + 'px');
        clone.style.setProperty('--blow-rot', rot + 'deg');
        layer.appendChild(clone);
        setTimeout(() => { try { clone.remove(); } catch (e) {} }, 1300);
    });
}
// Detritos do card voando na rajada — pedido do usuário: "coisas voando
// (além do nome)". Mesma técnica do spawnLetterGust (clona, nunca mexe no
// elemento real, some sozinho), só que aqui a peça é um elemento inteiro do
// card (bandeira, categoria/magnitude, um cartão de estatística...), não uma
// letra avulsa — dá a sensação de o vento arrancando pedaço do painel, não só
// do nome do lugar.
const WIND_DEBRIS_SELECTORS = ['#pd-flag', '#pd-mag', '.stat-card', '#pd-chips .chip'];
function spawnCardDebris() {
    const candidatos = [];
    WIND_DEBRIS_SELECTORS.forEach(sel => document.getElementById('painel-direito')?.querySelectorAll(sel).forEach(el => candidatos.push(el)));
    const el = pickRandom(candidatos, 1)[0];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const layer = ensureFallLayer();
    const cs = getComputedStyle(el);
    const clone = el.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
    clone.setAttribute('aria-hidden','true');clone.style.pointerEvents='none';
    clone.className = 'pd-fx-letter-blown';
    clone.style.font = cs.font;
    clone.style.color = cs.color;
    clone.style.margin = '0';
    clone.style.left = rect.left + 'px';
    clone.style.top = rect.top + 'px';
    clone.style.width = rect.width + 'px';
    clone.style.height = rect.height + 'px';
    // Mesma direção em 360° das letras (spawnLetterGust) — consistência
    // visual: tudo que voa na rajada segue a mesma física de "vento em
    // várias direções", não só uma.
    const ang = -.18+(Math.random()-.5)*.5;
    const dist = 120 + Math.random() * 150;
    const dx = Math.round(Math.cos(ang) * dist);
    const dy = Math.round(Math.sin(ang) * dist);
    const rot = Math.round((Math.random() * 2 - 1) * 420);
    clone.style.setProperty('--blow-dx', dx + 'px');
    clone.style.setProperty('--blow-dy', dy + 'px');
    clone.style.setProperty('--blow-rot', rot + 'deg');
    layer.appendChild(clone);
    setTimeout(() => { try { clone.remove(); } catch (e) {} }, 1300);
}
function startLetterGusts(el, durationMs) {
    stopLetterGusts();
    __letterGustInterval = setInterval(() => { const p=document.getElementById('painel-direito');if(document.hidden||p?.classList.contains('pd-flip-girado')||!p?.clientWidth||window.matchMedia('(max-width:900px)').matches&&!document.body.classList.contains('mobile-details-mid')&&!document.body.classList.contains('mobile-details-open'))return;spawnLetterGust(el); spawnCardDebris(); }, 2300);
    if(Number.isFinite(durationMs))__letterGustTimeout=setTimeout(stopLetterGusts,durationMs);
}
function stopLetterGusts() {
    clearTimeout(__letterGustTimeout);__letterGustTimeout=null;
    document.querySelectorAll(".pd-fx-letter-blown").forEach(n=>n.remove());
    try { clearInterval(__letterGustInterval); } catch (e) {}
    __letterGustInterval = null;
}

function triggerCardFxMag(mag) {
    const el = document.getElementById('painel-direito');
    if (!el) return;
    const p = window.SeismicCinema?.profile({mag,depth:10}, 'manual');
    el.style.setProperty('--pd-fx-amp', (p?.amplitude || .5) + 'px');
}

// Whole-screen seismic effects are owned by seismic-cinema.js. The engine
// distinguishes real arrivals, manual replay and the quiet automatic cycle.
function triggerSiteChaos(mag, context = {}) {
    return window.SeismicCinema?.play(context.item || {mag,depth:10},context.mode || 'manual');
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
