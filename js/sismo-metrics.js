// === sismo-metrics.js — Mercalli, energia, profundidade, gauge visual e raio de percepção de sismos (linhas originais 2643-2936 do core-app.js) ===

function getHistoricoRegional(lat, lng, raio = 500, dias = 30) {
    const cut = Date.now() - dias * 864e5;
    const ev = globalEvents
        .filter(e => haversine(lat, lng, e.coords[1], e.coords[0]) <= raio && e.time >= cut)
        .sort((a, b) => b.time - a.time);
    return {
        total: ev.length,
        maior: ev.length ? ev.reduce((m, e) => e.mag > m.mag ? e : m, ev[0]) : null,
        eventos: ev.slice(0, 5)
    };
}
function estimarMercalli(m, d) {
    const b = m - Math.max(0, d) / 50;
    if (b < 2) return { nivel: "I - II", desc: "Não sentido.", cor: "#4ade80" };
    if (b < 4) return { nivel: "III - IV", desc: "Vibração leve.", cor: "#facc15" };
    if (b < 5.5) return { nivel: "V - VI", desc: "Sentido por todos.", cor: "#fb923c" };
    if (b < 7) return { nivel: "VII - VIII", desc: "Danos consideráveis.", cor: "#ef4444" };
    return { nivel: "IX+", desc: "Destruição total.", cor: "#991b1b" };
}
function calcularEnergia(m) {
    const j = Math.pow(10, 1.5 * m + 4.8);
    const t = j / 4.184e9;
    const f = t < 1 ? (t * 1000).toFixed(1) + " kg" :
              t < 1000 ? t.toFixed(1) + " ton" :
              t < 1e6 ? (t / 1000).toFixed(1) + " kt" :
              (t / 1e6).toFixed(1) + " Mt";
    // Comparações de escala humana pra dar noção real do tamanho, só a partir de
    // M5 (abaixo disso a comparação não ajuda, fica um número solto sem contexto).
    let comparativo = '';
    if (m >= 5 && m < 5.5) comparativo = '≈ maior explosão química não-nuclear já registrada (Halifax, 1917)';
    else if (m >= 5.5 && m < 6.5) comparativo = '≈ centenas de vezes o poder de uma bomba convencional (MOAB)';
    else if (m >= 6.5 && m < 7.5) comparativo = '≈ bomba atômica de Hiroshima (1945)';
    else if (m >= 7.5 && m < 8.5) comparativo = '≈ dezenas de bombas de Hiroshima somadas';
    else if (m >= 8.5) comparativo = '≈ maior bomba nuclear já testada (Tsar Bomba)';
    return { joules: j.toExponential(2), tnt: f + " de TNT", comparativo };
}

function classificarProfundidade(km) {
    if (km < 70) return { label: 'Raso', cor: '#f87171' };
    if (km < 300) return { label: 'Intermediário', cor: '#fbbf24' };
    return { label: 'Profundo', cor: '#4ade80' };
}

// Anima o número do medidor (ex.: M0.7 -> M5.4) contando suavemente em vez
// de trocar de uma vez — acompanha o arco, que já desliza via transition
// CSS (css/ui-motion.css). Cancela qualquer contagem em andamento se o
// usuário trocar de evento rápido, pra não sobrepor duas animações.
function animateMagNumber(el, target) {
    if (!el) return;
    if (el._mgAnimId) { cancelAnimationFrame(el._mgAnimId); el._mgAnimId = null; }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.textContent = 'M' + target.toFixed(1);
        return;
    }
    const prev = parseFloat(String(el.textContent || '').replace('M', '').replace(',', '.'));
    const from = Number.isFinite(prev) ? prev : target;
    const duration = 550;
    const t0 = performance.now();
    function tick(now) {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = 'M' + (from + (target - from) * eased).toFixed(1);
        el._mgAnimId = p < 1 ? requestAnimationFrame(tick) : null;
    }
    el._mgAnimId = requestAnimationFrame(tick);
}

const GAUGE_LEN = 157;

// Ponteiro na ponta do arco: em vez de reimplementar a curva de animação do
// CSS (transition em stroke-dashoffset, css/ui-motion.css), lê o valor ao
// vivo via getComputedStyle a cada quadro enquanto a transição roda — o
// próprio navegador já está interpolando, só precisamos seguir. A posição
// x/y vem de arc.getPointAtLength(), então não depende de trigonometria
// manual nem de o arco mudar de forma no futuro.
function animateGaugeDot(arc, color) {
    const dot = document.getElementById('pd-gauge-dot');
    if (!dot || !arc.getTotalLength) return;
    if (color) dot.setAttribute('fill', color);
    const total = arc.getTotalLength();
    function place() {
        const off = parseFloat(getComputedStyle(arc).strokeDashoffset) || 0;
        const len = Math.max(0, Math.min(total, total - off));
        const pt = arc.getPointAtLength(len);
        dot.setAttribute('cx', pt.x);
        dot.setAttribute('cy', pt.y);
    }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        place();
        return;
    }
    if (arc._mgDotAnimId) cancelAnimationFrame(arc._mgDotAnimId);
    const start = performance.now();
    function tick(now) {
        place();
        arc._mgDotAnimId = (now - start < 700) ? requestAnimationFrame(tick) : null;
    }
    arc._mgDotAnimId = requestAnimationFrame(tick);
}

function setGauge(mag, isQuake, icon, color, frac) {
    const arc = document.getElementById('pd-gauge-arc');
    const magEl = document.getElementById('pd-mag');
    const glow = document.getElementById('pd-gauge-glow');
    if (!arc || !magEl) return;
    if (!isQuake) {
        const f = (frac != null ? frac : 1);
        const c = color || '#38bdf8';
        arc.style.strokeDashoffset = GAUGE_LEN * (1 - f);
        arc.style.stroke = c;
        if (magEl._mgAnimId) { cancelAnimationFrame(magEl._mgAnimId); magEl._mgAnimId = null; }
        magEl.textContent = icon || '--';
        magEl.style.color = c;
        if (glow) { glow.style.background = c; glow.style.opacity = '0.35'; }
        animateGaugeDot(arc, c);
        return;
    }
    const f = Math.max(0.04, Math.min(1, (mag - 2) / 7));
    const c = getHexColor(mag);
    arc.style.strokeDashoffset = GAUGE_LEN * (1 - f);
    arc.style.stroke = c;
    arc.style.color = c;
    animateMagNumber(magEl, mag);
    magEl.style.color = c;
    if (glow) {
        glow.style.background = c;
        glow.style.opacity = mag >= 6 ? '0.55' : mag >= 4.5 ? '0.4' : '0.28';
    }
    animateGaugeDot(arc, c);
}

/* ═══════════ RAIO ESTIMADO — versão refinada ═══════════ */
// Raio "sentido" (~MMI III) calibrado numa relação log-magnitude mais próxima da observada
// em dados reais (USGS "Did You Feel It?"). A atenuação por profundidade NÃO é monotônica
// pura: até ~300km (crosta e manto superior) o raio encolhe normalmente com a profundidade,
// mas sismos de foco profundo (>300km — comuns na zona de subducção Peru/Bolívia/Brasil,
// no Japão, na Indonésia etc.) propagam energia de forma muito mais eficiente pelo manto,
// com menos espalhamento/absorção — por isso continuam sendo sentidos a distâncias enormes
// mesmo com o hipocentro muito fundo (ex: sismos de ~600km na fronteira Peru-Brasil já foram
// sentidos a 600-700km de distância). Por isso a "profundidade efetiva" usada no cálculo
// desacelera bastante depois dos 300km, em vez de continuar crescendo linearmente.
function fatorProfundidade(depth) {
    const hEff = Math.min(depth, 300) + Math.max(0, depth - 300) * 0.15;
    return 1 / (1 + Math.pow(hEff / 35, 0.9));
}
function raioEstimado(mag, depth = 10) {
    const base = Math.pow(10, 0.55 * mag - 0.4);
    const h = Math.max(5, depth || 10);
    return Math.min(1800, base * fatorProfundidade(h));
}
function raioCritico(mag, depth = 10) {
    const r = raioEstimado(mag, depth);
    return Math.max(8, r * 0.35);
}
// Raio "detectável" (~MMI I-II) — limiar bem mais baixo, tipo o que redes de estações
// sísmicas (ex: GlobalQuake) conseguem captar/estimar como "possivelmente sentido" por
// pessoas sensíveis ou instrumentos, mesmo sem confirmação de relato humano em massa.
// Não é um segundo modelo físico independente — é um multiplicador sobre o raio "sentido"
// que cresce com a magnitude (eventos maiores têm cauda de percepção proporcionalmente
// mais larga), com teto de 3200km. O teto foi ampliado (era 2500km) pra dar margem a
// casos reais de relatos distantes em bacias sedimentares profundas (ex: Amazônia), que
// amplificam ondas de baixa frequência bem além do que qualquer modelo simples de
// atenuação prevê.
function raioDetectavel(mag, depth = 10) {
    const base = raioEstimado(mag, depth);
    const mult = 1.9 + 0.18 * Math.max(0, mag - 5);
    return Math.min(3200, base * mult);
}
function metrosPorPixel(lat, z) {
    return 156543.03 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
}

/* ═══════════ ZONA DE ALCANCE — sismo NOVO ("Onda Dupla") ═══════════
   Substitui o antigo updateFeltRadiusLayer (desenhava os 3 raios pra TODO sismo
   M≥7 sempre visível, sem animação, poluindo o mapa) e o startContinuousRadar
   de sismos (mapa.js) — agora só aparece quando o sismo é NOVO de verdade
   (triggerVisualAlert em showEventDetails), com os raios reais em km de sempre
   (raioCritico/raioEstimado) crescendo a partir do epicentro, e some sozinho
   depois de um tempo proporcional à magnitude — quanto maior o sismo, mais
   tempo o alcance fica visível, mas nunca fica pra sempre. Seleção manual ou
   ciclo revisitando um evento antigo não chama nada disso (só o .quake-dot/
   .quake-label padrão, que já existem e não mudam). */
let feltZoneEl = null, feltZoneUpd = null, feltZoneTimer = null, feltZoneFadeTimer = null;

function feltZoneDurationMs(mag) {
    if (mag >= 7) return 150000;
    if (mag >= 6) return 90000;
    if (mag >= 5) return 50000;
    return 45000; // mesmo tempo do ciclo automático de evento novo
}

function stopFeltZone() {
    try { clearTimeout(feltZoneTimer); } catch (e) {}
    try { clearTimeout(feltZoneFadeTimer); } catch (e) {}
    feltZoneTimer = feltZoneFadeTimer = null;
    if (feltZoneEl) {
        try { map && map.off('move', feltZoneUpd); map && map.off('zoom', feltZoneUpd); } catch (e) {}
        feltZoneEl.remove();
        feltZoneEl = null;
        feltZoneUpd = null;
    }
}

function startFeltZone(lng, lat, mag, depth) {
    if (!map) return;
    stopFeltZone();
    try { if (typeof stopCascadeRipple === 'function') stopCascadeRipple(); } catch (e) {}
    try { if (typeof stopContinuousRadar === 'function') stopContinuousRadar(); } catch (e) {}
    try { if (typeof stopHurricaneOfficialRoute === 'function') stopHurricaneOfficialRoute(); } catch (e) {}
    try { if (typeof stopTsunamiWave === 'function') stopTsunamiWave(); } catch (e) {}
    const host = document.getElementById('mapContainer');
    if (!host) return;

    const wrap = document.createElement('div');
    wrap.className = 'felt-zone-wrap';
    const detect = document.createElement('div');
    detect.className = 'felt-zone-detect';
    const blue = document.createElement('div');
    blue.className = 'felt-zone-blue';
    const red = document.createElement('div');
    red.className = 'felt-zone-red';
    const sweep = document.createElement('div');
    sweep.className = 'felt-zone-sweep';
    wrap.append(detect, blue, red, sweep);
    host.appendChild(wrap);
    feltZoneEl = wrap;

    const coords = [lng, lat];
    const place = () => {
        if (!map) return;
        const z = map.getZoom();
        const mpp = metrosPorPixel(lat, z);
        const pxDetect = Math.max(30, (raioDetectavel(mag, depth) * 1000) / mpp * 2);
        const pxBlue = Math.max(24, (raioEstimado(mag, depth) * 1000) / mpp * 2);
        const pxRed = Math.max(10, (raioCritico(mag, depth) * 1000) / mpp * 2);
        const pt = map.project(coords);
        detect.style.width = detect.style.height = pxDetect + 'px';
        blue.style.width = blue.style.height = pxBlue + 'px';
        red.style.width = red.style.height = pxRed + 'px';
        sweep.style.width = sweep.style.height = pxRed + 'px';
        [detect, blue, red, sweep].forEach(el => { el.style.left = pt.x + 'px'; el.style.top = pt.y + 'px'; });
    };
    feltZoneUpd = place;
    place();
    map.on('move', place);
    map.on('zoom', place);

    // Dispara o crescimento só no frame seguinte — se a classe "grow" entrar
    // junto com a criação do elemento, o navegador nunca chega a pintar o
    // scale(0) inicial e a transição não anima (já nasce no estado final).
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('grow')));

    feltZoneTimer = setTimeout(() => {
        wrap.classList.add('fading');
        feltZoneFadeTimer = setTimeout(stopFeltZone, 950);
    }, feltZoneDurationMs(mag));
}

/* ═══════════ FRENTE DE ONDA SÍSMICA (P/S) — animação em tempo real ═══════════
   Elemento visual SEPARADO da zona sentida acima: aqui o raio não é uma
   estimativa fixa de "até onde seria sentido" — é a distância que a onda
   sísmica já percorreu FISICAMENTE desde o horário de origem, do jeito que
   apps tipo GlobalQuake mostram (por isso os círculos de lá aparecem bem
   maiores que a zona sentida: são métricas diferentes — "até onde a onda já
   chegou" vs. "até onde alguém sentiria"). Usa velocidade média de onda P
   (~7.5 km/s) e onda S (~4.3 km/s) na crosta: é uma aproximação por
   velocidade constante, não uma curva de tempo de trânsito real (tipo
   IASP91, que varia com profundidade/distância), mas dá uma frente de onda
   realista o bastante pro efeito visual. Cresce de verdade com o relógio
   (Date.now() - horário de origem do sismo), não com uma animação CSS de
   duração fixa — por isso os anéis já nascem do tamanho certo mesmo se o
   evento levou alguns segundos pra chegar até aqui. */
const WAVE_P_KMS = 7.5;
const WAVE_S_KMS = 4.3;
const WAVE_MAX_KM = 20000; // distância antípoda aproximada — teto físico, evita <div> gigante se item.time vier defasado
let waveFrontEl = null, waveFrontUpd = null, waveFrontInterval = null, waveFrontTimer = null, waveFrontFadeTimer = null;
// Câmera "persegue" a frente de onda P conforme ela cresce (efeito tipo
// GlobalQuake) — guarda a referência do handler de interação pra poder
// remover no stopWaveFront, senão cada sismo novo empilha mais um listener.
let waveCamAbortHandler = null;

function stopWaveFront() {
    try { clearInterval(waveFrontInterval); } catch (e) {}
    try { clearTimeout(waveFrontTimer); } catch (e) {}
    try { clearTimeout(waveFrontFadeTimer); } catch (e) {}
    waveFrontInterval = waveFrontTimer = waveFrontFadeTimer = null;
    if (waveCamAbortHandler) {
        try {
            map && map.off('dragstart', waveCamAbortHandler);
            map && map.off('wheel', waveCamAbortHandler);
            map && map.off('touchstart', waveCamAbortHandler);
        } catch (e) {}
        waveCamAbortHandler = null;
    }
    if (waveFrontEl) {
        try { map && map.off('move', waveFrontUpd); map && map.off('zoom', waveFrontUpd); } catch (e) {}
        waveFrontEl.remove();
        waveFrontEl = null;
        waveFrontUpd = null;
    }
}

// opts.chaseCam: câmera acompanha o alcance da onda P puxando o zoom pra trás
// aos poucos (em vez de abrir tudo de uma vez), até o teto de raioDetectavel —
// só pro sismo ao vivo e pro clique manual (o autociclo mantém o comportamento
// de sempre, decidido pelo chamador via opts).
// opts.camDelayMs: espera o voo cinematográfico inicial (flyTo/softFlyToCoords)
// terminar antes de começar a puxar a câmera — sem isso as duas animações
// brigam pela câmera ao mesmo tempo.
function startWaveFront(lng, lat, mag, depth, originTime, opts) {
    if (!map || !Number.isFinite(originTime)) return;
    stopWaveFront();
    const host = document.getElementById('mapContainer');
    if (!host) return;

    const wrap = document.createElement('div');
    wrap.className = 'wave-front-wrap';
    const pRing = document.createElement('div');
    pRing.className = 'wave-front-p';
    const sRing = document.createElement('div');
    sRing.className = 'wave-front-s';
    wrap.append(pRing, sRing);
    host.appendChild(wrap);
    waveFrontEl = wrap;

    const coords = [lng, lat];
    // Mesmo teto de tempo em tela da zona sentida (proporcional à magnitude),
    // só pra não deixar um anel "crescendo pra sempre" depois que o usuário
    // já saiu da tela do evento.
    const durationMs = feltZoneDurationMs(mag);
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const chaseCam = !!(opts && opts.chaseCam) && !reduceMotion &&
        typeof calcZoomParaAlcance === 'function' && typeof centroCompensado === 'function';
    const camStartAt = Date.now() + Math.max(0, (opts && opts.camDelayMs) || 0);
    // Duração fixa da "abertura" da câmera, escalada por magnitude — INDEPENDENTE
    // de quantos segundos a onda P já percorreu fisicamente. Sem isso, um sismo
    // que levou alguns minutos pra aparecer no feed (comum: revisão de catálogo,
    // atraso de rede regional) já nasce com a onda maior que o teto de
    // raioDetectavel, e a câmera pulava pro zoom final numa tacada só em vez de
    // abrir aos poucos — ficava "estática". Agora sempre interpola do zoom
    // inicial (pós-voo) até o zoom alvo ao longo de camSweepMs; se o alvo ainda
    // estiver crescendo (sismo genuinamente novo, onda ainda expandindo), depois
    // da abertura ela passa a seguir o crescimento real 1:1.
    const camSweepMs = mag >= 7 ? 35000 : mag >= 6 ? 25000 : mag >= 5 ? 18000 : 12000;
    // Definidos preguiçosamente (null até o delay passar) — se pegasse
    // map.getZoom() já aqui, capturaria o zoom de ANTES do voo cinematográfico
    // inicial terminar (ainda no meio do flyTo de 4.5s).
    let camZoomInicial = null;
    let camZoomAtual = null;
    let camAtingiuTeto = false;
    let camAbortada = false;

    if (chaseCam) {
        // Só aborta em interação de VERDADE do usuário (originalEvent presente) —
        // chamadas programáticas nossas (easeTo) não disparam com originalEvent.
        waveCamAbortHandler = (e) => { if (e && e.originalEvent) camAbortada = true; };
        map.on('dragstart', waveCamAbortHandler);
        map.on('wheel', waveCamAbortHandler);
        map.on('touchstart', waveCamAbortHandler);
    }

    const place = () => {
        if (!map || !waveFrontEl) return;
        const elapsedS = Math.max(0, (Date.now() - originTime) / 1000);
        const z = map.getZoom();
        const mpp = metrosPorPixel(lat, z);
        const kmP = Math.min(WAVE_MAX_KM, elapsedS * WAVE_P_KMS);
        const kmS = Math.min(WAVE_MAX_KM, elapsedS * WAVE_S_KMS);
        const pxP = (kmP * 1000) / mpp * 2;
        const pxS = (kmS * 1000) / mpp * 2;
        const pt = map.project(coords);
        pRing.style.width = pRing.style.height = pxP + 'px';
        sRing.style.width = sRing.style.height = pxS + 'px';
        [pRing, sRing].forEach(el => { el.style.left = pt.x + 'px'; el.style.top = pt.y + 'px'; });

        if (chaseCam && !camAbortada && !camAtingiuTeto && Date.now() >= camStartAt) {
            // Primeira vez que o delay passou: pega o zoom JÁ pós-voo inicial,
            // vira o ponto de partida da interpolação.
            if (camZoomInicial == null) { camZoomInicial = map.getZoom(); camZoomAtual = camZoomInicial; }
            // A câmera precisa acompanhar o mesmo raio que o anel AZUL (onda P)
            // está desenhando na tela AGORA — kmP, sem teto de raioDetectavel.
            // Usar raioDetectavel aqui era o bug: é a métrica da zona SENTIDA
            // (bem menor), então a câmera parava de abrir muito antes do anel
            // real (que não tem esse teto, só o físico de WAVE_MAX_KM) — por
            // isso precisava de zoom out manual pra ver o anel inteiro.
            const kmAlvoCam = kmP;
            // Teto mínimo de abertura: mesmo um sismo pequeno, cujo alcance real
            // caiba dentro do enquadramento "regional" de sempre, precisa abrir
            // até ALI pelo menos — senão a câmera nunca se move (fica parecendo
            // estática) só porque o alvo calculado já cabia no zoom inicial.
            const zoomMin = (opts && opts.zoomFinalMinimo) || 6.6;
            const zoomFinal = Math.min(Math.max(1.5, calcZoomParaAlcance(lat, kmAlvoCam)), zoomMin);
            const progresso = Math.min(1, (Date.now() - camStartAt) / camSweepMs);
            const zoomAlvoAgora = camZoomInicial + (zoomFinal - camZoomInicial) * progresso;
            // Só puxa a câmera pra trás — nunca zoom in de volta (a onda só cresce).
            if (zoomAlvoAgora < camZoomAtual - 0.01) {
                camZoomAtual = zoomAlvoAgora;
                try {
                    map.easeTo({
                        center: centroCompensado(lng, lat, camZoomAtual),
                        zoom: camZoomAtual,
                        duration: 320,
                        easing: t => t
                    });
                } catch (e) {}
            }
            // Só "termina" quando o anel de verdade parar de crescer (chegou no
            // teto físico WAVE_MAX_KM — na prática, quase nunca dentro do tempo
            // de exibição do efeito). Enquanto o anel crescer, a câmera continua
            // acompanhando, mesmo depois que a abertura inicial (progresso=1) já
            // tiver terminado — é exatamente o "sempre segue o raio azul" pedido.
            if (progresso >= 1 && kmP >= WAVE_MAX_KM) camAtingiuTeto = true;
        }
    };
    waveFrontUpd = place;
    place();
    map.on('move', place);
    map.on('zoom', place);

    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('grow')));
    // Atualização periódica pra crescer com o tempo real — sem exagerar o
    // ritmo com prefers-reduced-motion, mas continua fisicamente correto.
    waveFrontInterval = setInterval(place, reduceMotion ? 1500 : 300);

    waveFrontTimer = setTimeout(() => {
        wrap.classList.add('fading');
        waveFrontFadeTimer = setTimeout(stopWaveFront, 950);
    }, durationMs);
}

/* ═══════════ RÓTULOS "M + profundidade" (M≥5) ═══════════ */
const quakeLabelStore = new Map();

function updateQuakeLabels() {
    if (!map) return;
    const cut = Date.now() - 864e5;
    const z = map.getZoom();
    const want = new Set();

    if (layerVisibility.earthquakes && z >= 3) {
        globalEvents.forEach(ev => {
            if (ev.time < cut || ev.mag < 5 || ev.mag < minMagnitude) return;
            want.add(ev.id);
            if (!quakeLabelStore.has(ev.id)) {
                const el = document.createElement('div');
                el.className = 'quake-label';
                el.textContent = `M${ev.mag.toFixed(1)} • ${Math.max(0, ev.depth).toFixed(0)} km`;
                quakeLabelStore.set(ev.id, new GL.Marker({
                    element: el,
                    anchor: 'left',
                    offset: [10, 0]
                }).setLngLat(ev.coords).addTo(map));
            }
        });
    }

    quakeLabelStore.forEach((m, id) => {
        if (!want.has(id)) {
            m.remove();
            quakeLabelStore.delete(id);
        }
    });
}

// Hook automático — só precisa rodar até o mapa existir; antes ficava
// checando pra sempre mesmo depois de já ter achado o mapa.
const _hookExtraId = setInterval(() => {
    if (map && !map.__hookExtra) {
        map.__hookExtra = true;
        map.on('zoomend', () => { updateQuakeLabels(); });
        updateQuakeLabels();
        clearInterval(_hookExtraId);
    }
}, 1000);

/* ============================ FEED UNIFICADO + LISTA ============================ */
const TYPE_META = {
    earthquake: { icon: '🌍', label: 'Sismo', color: '#3b82f6' },
    fire:       { icon: '🔥', label: 'Incêndio', color: '#f97316' },
    storm:      { icon: '⚡', label: 'Tempestade', color: '#facc15' },
    hurricane:  { icon: '🌀', label: 'Ciclone', color: '#a855f7' },
    tornado:    { icon: '🌪️', label: 'Tornado', color: '#f43f5e' },
    tsunami:    { icon: '🌊', label: 'Tsunami', color: '#38bdf8' },
    civil:      { icon: '🚨', label: 'Alerta Civil', color: '#e11d48' },
    wind:       { icon: '💨', label: 'Rajada de Vento', color: '#5eead4' },
    flood:      { icon: '💧', label: 'Enchente', color: '#0ea5e9' },
    volcano:    { icon: '🌋', label: 'Vulcanismo', color: '#dc2626' }
};

const QS_TITULOS = { A: 'Confirmado por 2 fontes', B: 'Fonte única confiável', C: 'Magnitude baixa / menos precisa' };

/* Bounding box aproximado do Brasil (WGS-84) */
