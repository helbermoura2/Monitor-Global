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

/* Radar do ciclo automático: estimativas de zona crítica (vermelho) e
   alcance sentido (azul), independentes das frentes físicas do GlobalQuake. */
let feltZoneEl = null, feltZoneUpd = null, feltZoneContext = null;
function refreshFeltZone(item){
    if(!feltZoneContext||feltZoneContext.id!==item.id)return;
    Object.assign(feltZoneContext,{lng:item.coords[0],lat:item.coords[1],mag:item.mag,depth:item.depth});
    feltZoneUpd?.();
}

// Quanto tempo um sismo NOVO/ao vivo (ou revisitado por clique manual) fica
// "no ar" (frente de onda P/S + câmera acompanhando + ciclo automático
// pausado) antes de poder trocar sozinho pro próximo evento — faixas FIXAS
// por magnitude, pedido direto do usuário (a versão anterior derivava esse
// tempo da física real da onda, o que dava valores pouco intuitivos: um
// sismo raso de magnitude alta terminava de "crescer" rápido e saía da tela
// cedo demais, enquanto um fundo demorava bem mais — o usuário queria algo
// previsível, só pela magnitude). Só vale pra evento NOVO ao vivo e pro
// replay manual — o ciclo automático (revisitando um evento já conhecido)
// usa HOLD_AUTO_MS, fixo em 1 minuto pra qualquer magnitude (ver
// painel-e-lista.js). Ver também orquestrador-feeds.js: um sismo novo só
// interrompe esse tempo se for de magnitude MAIOR que o que já está em tela.
function waveHoldMs(mag) {
    const m = Number(mag) || 0;
    if (m < 5) return 90000;   // até M4.9: 1min30
    if (m < 6) return 120000;  // M5.0-5.9: 2min
    if (m < 7) return 210000;  // M6.0-6.9: 3min30
    if (m < 8) return 300000;  // M7.0-7.9: 5min
    return 420000;             // M8+: 7min
}

// Nunca some sozinha por conta de um timer interno — só quando outro evento
// é selecionado de verdade (startFeltZone chama isto no início, pra trocar).
// Enquanto o usuário está vendo um evento (ao vivo, manual ou revisitado no
// automático), a zona crítica precisa continuar lá até o fim: pode dar zoom
// in pra olhar de perto minutos depois, e ela tem que estar exatamente onde
// era pra estar. Sempre desliga com um fade suave (2.6s), nunca some na
// hora — mantém os listeners de move/zoom durante o fade pra o anel
// continuar acompanhando o epicentro geograficamente certo até sumir de
// vez, em vez de congelar na posição de tela do instante da troca.
// Idempotente de propósito (if (!feltZoneEl) return ANTES de mexer no
// timer): showEventDetails chama isto direto ao trocar de evento (limpeza
// imediata) E o startFeltZone do evento novo chama de novo, mais tarde,
// como sempre fez — sem essa guarda, a SEGUNDA chamada (com feltZoneEl já
// null da primeira) ainda cancelava o timer de remoção já agendado pela
// primeira sem reagendar outro, deixando o anel anterior preso no DOM pra
// sempre (só com fade visual via CSS, nunca de fato removido).
function stopFeltZone() {
    if (!feltZoneEl) return;
    const elAntigo = feltZoneEl, updAntigo = feltZoneUpd;
    elAntigo.classList.add('fading');
    setTimeout(() => {
        try { map && map.off('move', updAntigo); map && map.off('zoom', updAntigo); } catch (e) {}
        try { elAntigo.remove(); } catch (e) {}
    }, 2600);
    feltZoneEl = null;
    feltZoneUpd = null;
    feltZoneContext=null;
    window.__mgFeltZoneState=null;
}

function startFeltZone(lng, lat, mag, depth, id) {
    if (!map) return;
    stopFeltZone();
    if(typeof stopWaveFront==='function')stopWaveFront();
    try { if (typeof stopCascadeRipple === 'function') stopCascadeRipple(); } catch (e) {}
    try { if (typeof stopContinuousRadar === 'function') stopContinuousRadar(); } catch (e) {}
    try { if (typeof stopHurricaneOfficialRoute === 'function') stopHurricaneOfficialRoute(); } catch (e) {}
    try { if (typeof stopTsunamiWave === 'function') stopTsunamiWave(); } catch (e) {}
    const host = document.getElementById('mapContainer');
    if (!host) return;

    const wrap = document.createElement('div');
    wrap.className = 'felt-zone-wrap';
    const blue = document.createElement('div');
    blue.className = 'felt-zone-blue';
    const red = document.createElement('div');
    red.className = 'felt-zone-red';
    const sweep = document.createElement('div');
    sweep.className = 'felt-zone-sweep';
    const label=document.createElement('div');
    label.className='wave-front-status felt-zone-status';
    label.textContent='Radar · Estimativa: vermelho crítico · azul sentido';
    wrap.append(blue, red, sweep, label);
    host.appendChild(wrap);
    feltZoneEl = wrap;

    const context=feltZoneContext={id,lng,lat,mag,depth};
    const place = () => {
        if (!map) return;
        const {lng,lat,mag,depth}=context;
        const coords=[lng,lat];
        if(feltZoneContext===context)window.__mgFeltZoneState={...context,criticalKm:raioCritico(mag,depth),feltKm:raioEstimado(mag,depth)};
        const headerBottom=Math.max(...['top-strip','ux-controlbar','latest-event-ticker'].map(id=>document.getElementById(id)?.getBoundingClientRect().bottom||0));
        label.style.top=Math.max(12,headerBottom-host.getBoundingClientRect().top+10)+'px';
        label.style.left=(host.clientWidth/2)+'px';
        label.style.maxWidth=Math.max(0,host.clientWidth-24)+'px';
        const z = map.getZoom();
        const mpp = metrosPorPixel(lat, z);
        const pxBlue = Math.max(24, (raioEstimado(mag, depth) * 1000) / mpp * 2);
        const pxRed = Math.max(10, (raioCritico(mag, depth) * 1000) / mpp * 2);
        const pt = map.project(coords);
        blue.style.width = blue.style.height = pxBlue + 'px';
        red.style.width = red.style.height = pxRed + 'px';
        sweep.style.width = sweep.style.height = pxRed + 'px';
        [blue, red, sweep].forEach(el => { el.style.left = pt.x + 'px'; el.style.top = pt.y + 'px'; });
    };
    feltZoneUpd = place;
    place();
    map.on('move', place);
    map.on('zoom', place);

    // Dispara o crescimento só no frame seguinte — se a classe "grow" entrar
    // junto com a criação do elemento, o navegador nunca chega a pintar o
    // scale(0) inicial e a transição não anima (já nasce no estado final).
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('grow')));

    // Sem timer de auto-expiração aqui de propósito (ver comentário em
    // stopFeltZone): o anel fica na tela até outro startFeltZone() ser
    // chamado pra um evento diferente.
}

/* Frentes P/S e ondas de núcleo: mesmos Float32 e algoritmo TauP iasp91
   do GlobalQuake. O tempo é real, sem aceleração ou limite por magnitude.
   Ao vivo usa a origem publicada; o replay manual reinicia o relógio.
   A zona estimada de percepção continua sendo uma métrica independente. */
// GlobalQuake FeatureEarthquake.waveDisplayTimeMinutes / EarthquakeAnalysis.
// This is a visibility limit, not a change to the physical travel tables.
function waveDisplaySeconds(mag,depth){
    const correction=Math.log10(Math.max(0,Number(depth)||0)+160)-Math.log10(160);
    return 60*(2+.01*Math.pow((Number(mag)||0)+correction,4));
}
function waveDisplayAlpha(elapsed,limit){return Math.max(0,Math.min(1,2-2*elapsed/limit));}
const WAVE_PHASES = ['p','s','pkp','pkikp'];
const WAVE_LAYER_IDS = WAVE_PHASES.flatMap(phase=>['line','glow'].map(kind=>`wave-front-${phase}-${kind}`));

// Ponto de destino a partir de um centro, dado um azimute (graus, 0=norte,
// sentido horário) e uma distância (km) — fórmula esférica padrão de
// navegação. Usado pra desenhar o anel da frente de onda como um círculo
// GEODÉSICO de verdade em vez de aproximar por pixels de tela: um círculo
// "de tela" (raio convertido só pela escala do zoom atual) fica visivelmente
// torto pra raios grandes (M7/M8 passam de milhares de km) numa projeção
// Mercator/globo — cada ponto aqui é calculado na esfera real, então fica
// certo em qualquer raio e em qualquer projeção.
function destinoGeodesico(lat, lng, distanciaKm, azimuteGraus, earthRadius = 6371) {
    const R = earthRadius; // km; as frentes usam o mesmo raio do GlobalQuake
    const delta = Math.max(0, distanciaKm) / R;
    const theta = azimuteGraus * Math.PI / 180;
    const phi1 = lat * Math.PI / 180;
    const lambda1 = lng * Math.PI / 180;
    const senPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
    const phi2 = Math.asin(Math.max(-1, Math.min(1, senPhi2)));
    const y = Math.sin(theta) * Math.sin(delta) * Math.cos(phi1);
    const x = Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2);
    const lambda2 = lambda1 + Math.atan2(y, x);
    const lngNorm = ((lambda2 * 180 / Math.PI + 540) % 360) - 180;
    return [lngNorm, phi2 * 180 / Math.PI];
}
// Anel geodésico fechado (pontos ao redor do centro, todos à mesma
// distância real) pronto pra virar coordinates de um LineString GeoJSON.
//
// destinoGeodesico devolve cada ponto com a longitude normalizada pra
// (-180,180] INDEPENDENTEMENTE — ótimo pra um ponto isolado (ex.:
// zoomParaCaberRaio, que só usa 4 pontos cardeais direto num map.project),
// mas catastrófico aqui: um anel de raio grande o suficiente pra cruzar o
// antimeridiano (comum já a partir de ~2000km perto de longitudes como
// 166-169°E, tipo Fiji/Nova Caledônia) tem um ponto normalizado saltando de
// ~179.9° pra ~-179.9° de um vértice pro próximo — MapLibre desenha isso como
// uma reta ligando os dois extremos do mapa (visto no bug relatado: linhas
// horizontais atravessando a tela inteira depois de sismos M5+, exatamente
// onde o anel cruzava 180°). Corrige "desembrulhando" a sequência: se o
// salto de longitude entre pontos consecutivos for maior que 180°, soma/
// subtrai 360° pra manter a longitude contínua (pode passar de ±180 — o
// motor do mapa lida bem com isso, é só a normalização por ponto isolado que
// não podia se aplicar a uma sequência).
function anelGeodesico(lng, lat, raioKm, pontos = 128, earthRadius = 6371) {
    const coords = [];
    let ajuste = 0;
    let lngAnterior = null;
    for (let i = 0; i <= pontos; i++) {
        const [lngBruto, latPonto] = destinoGeodesico(lat, lng, raioKm, (360 * i) / pontos, earthRadius);
        if (lngAnterior !== null) {
            const salto = lngBruto + ajuste - lngAnterior;
            if (salto > 180) ajuste -= 360;
            else if (salto < -180) ajuste += 360;
        }
        const lngContinuo = lngBruto + ajuste;
        coords.push([lngContinuo, latPonto]);
        lngAnterior = lngContinuo;
    }
    return coords;
}

// Calcula o zoom necessário pra um raio geodésico caber dentro de `margem`
// da metade da menor dimensão da tela — medindo EMPIRICAMENTE quantos
// pixels esse raio ocupa no zoom ATUAL (via map.project nos 4 pontos
// cardeais) e ajustando por log2 a partir daí, em vez de uma fórmula
// hard-coded pra Mercator "achatado". O mapa roda em projeção globo
// (map.setProjection({type:'globe'}) em mapa.js) — nela, zoom não mapeia
// pra metros-por-pixel do mesmo jeito que na Mercator plana, então uma
// fórmula fixa (a antiga calcZoomParaAlcance) SUBESTIMA o tamanho real na
// tela (chegava a ~metade do raio verdadeiro): a câmera achava que já tinha
// aberto o suficiente quando na real ainda faltava muito, e o anel vazava
// da tela. Medir de verdade, no motor de projeção que já está rodando,
// funciona certo em Mercator, globo, ou qualquer outra projeção futura.
function zoomParaCaberRaio(lng, lat, raioKm, margem = 0.8) {
    if (!map) return 6;
    try {
        const cont = map.getContainer();
        const dim = Math.min(cont.clientWidth, cont.clientHeight);
        if (!dim || !raioKm) return map.getZoom();
        const alvoPx = (dim / 2) * margem;
        const centro = map.project([lng, lat]);
        const raioPxAtual = Math.max(...[0, 90, 180, 270].map(az => {
            const [lngD, latD] = destinoGeodesico(lat, lng, raioKm, az);
            // Desembrulha a longitude do ponto cardeal em relação ao
            // epicentro — mesma correção do antimeridiano usada em
            // anelGeodesico. Sem isso, um epicentro perto de 180° (ex.:
            // Nova Zelândia, Fiji) tinha um ponto cardeal "voltando" pro
            // lado oposto do mapa (179.5°E + 200km leste virava -178°E em
            // vez de 181.5°E), medindo uma distância em pixel absurda —
            // via real: um M4.7 na Nova Zelândia abrindo a câmera pra
            // mostrar o Pacífico inteiro, achando que precisava caber uma
            // distância que não existia de verdade.
            let lngAjustado = lngD;
            if (lngAjustado - lng > 180) lngAjustado -= 360;
            else if (lngAjustado - lng < -180) lngAjustado += 360;
            const p = map.project([lngAjustado, latD]);
            return Math.hypot(p.x - centro.x, p.y - centro.y);
        }));
        if (!raioPxAtual) return map.getZoom();
        return map.getZoom() - Math.log2(raioPxAtual / alvoPx);
    } catch (e) { return map.getZoom(); }
}

let waveFrontAtivo = false, waveFrontInterval = null;
// Câmera "persegue" a frente de onda P conforme ela cresce (efeito tipo
// GlobalQuake) — guarda a referência do handler de interação pra poder
// remover no stopWaveFront, senão cada sismo novo empilha mais um listener.
let waveCamAbortHandler = null;
let waveFrontPlaceHandler = null;
let waveCamRAF = null;
let waveFrontGeneration = 0;
let waveFrontStatus = null;
let waveFrontContext = null;
let waveFinalTimer = null;
function restoreWaveProtection(context){
    if(!context?.previousProtection||window.__mgRevisionProtectedId!==context.id||window.__mgRevisionProtectedUntil!==context.protectedUntil)return;
    Object.assign(window,context.previousProtection);
}

function refreshWaveFront(item){
    if(!waveFrontContext||waveFrontContext.id!==item.id)return;
    if(Array.isArray(item.coords)){waveFrontContext.lng=item.coords[0];waveFrontContext.lat=item.coords[1];}
    if(item.depth!=null&&Number.isFinite(Number(item.depth)))waveFrontContext.depth=Number(item.depth);
    if(Number.isFinite(item.mag))waveFrontContext.mag=item.mag;
    if(waveFrontContext.mode==='live'&&Number.isFinite(item.time))waveFrontContext.originTime=item.time;
}

function stopWaveFront() {
    waveFrontGeneration++;clearTimeout(waveFinalTimer);waveFinalTimer=null;restoreWaveProtection(waveFrontContext);waveFrontContext=null;waveFrontStatus?.remove();waveFrontStatus=null;window.__mgWaveFrontState=null;
    try { clearInterval(waveFrontInterval); } catch (e) {}
    waveFrontInterval = null;
    if (waveCamRAF) {
        try { cancelAnimationFrame(waveCamRAF); } catch (e) {}
        waveCamRAF = null;
    }
    if (waveCamAbortHandler) {
        try {
            map && map.off('dragstart', waveCamAbortHandler);
            map && map.off('wheel', waveCamAbortHandler);
            map && map.off('touchstart', waveCamAbortHandler);
        } catch (e) {}
        waveCamAbortHandler = null;
    }
    if (waveFrontPlaceHandler) {
        try { map && map.off('move', waveFrontPlaceHandler); map && map.off('zoom', waveFrontPlaceHandler); } catch (e) {}
        waveFrontPlaceHandler = null;
    }
    if (waveFrontAtivo) {
        try {
            WAVE_LAYER_IDS.forEach(id => {
                if (map.getLayer(id)) map.setPaintProperty(id, 'line-opacity', 0);
            });
        } catch (e) {}
        waveFrontAtivo = false;
    }
}

// opts.chaseCam: câmera acompanha o alcance real da onda P puxando o zoom pra
// trás aos poucos (em vez de abrir tudo de uma vez) — usado nos três casos
// (ao vivo, clique manual, ciclo automático), decidido pelo chamador via
// opts; o que muda entre eles é só o originTime passado (ver comentário
// acima da função).
// opts.camDelayMs: espera o voo cinematográfico inicial (flyTo/softFlyToCoords)
// terminar antes de começar a puxar a câmera — sem isso as duas animações
// brigam pela câmera ao mesmo tempo.
function startWaveFront(lng, lat, mag, depth, originTime, opts) {
    if (!map) return;
    stopWaveFront();
    // Published origin for live scenes; an explicit replay starts at zero.
    // The same GlobalQuake table is inverted using the elapsed seconds.
    if (!map.getSource('wave-front-p') || !map.getSource('wave-front-s')) return;
    waveFrontAtivo = true;
    // Sem timer de auto-expiração: o anel fica na tela (mesmo já parado no
    // teto) até outro startWaveFront() ser chamado pra um evento diferente —
    // quem decide QUANDO trocar de evento é scheduleNextAutoCycle
    // (painel-e-lista.js, usando o mesmo waveHoldMs), não este timer.
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const chaseCam = !!(opts && opts.chaseCam) && !reduceMotion && typeof centroCompensado === 'function';
    const camDelayMs = Math.max(0, (opts && opts.camDelayMs) || 0);
    const camStartAt = Date.now() + camDelayMs;
    // A câmera só começa a se mover depois de camDelayMs (esperando o voo
    // cinematográfico inicial terminar), mas o ANEL já reflete o alcance real
    // desde originTime (sem esse atraso — pode inclusive já nascer grande,
    // se originTime for um sismo antigo revisitado).
    // Definidos preguiçosamente (null até o delay passar) — se pegasse
    // map.getZoom() já aqui, capturaria o zoom de ANTES do voo cinematográfico
    // inicial terminar (ainda no meio do flyTo de 4.5s).
    let camAtingiuTeto = false;
    let camAbortada = false;

    if (chaseCam) {
        // Só aborta em interação de VERDADE do usuário (originalEvent presente) —
        // chamadas programáticas nossas (jumpTo) não disparam com originalEvent.
        waveCamAbortHandler = (e) => { if (e && e.originalEvent){camAbortada=true;context.protectUntilEnd=false;clearTimeout(waveFinalTimer);waveFinalTimer=null;restoreWaveProtection(context);if(typeof scheduleNextAutoCycle==='function')scheduleNextAutoCycle(Math.max(1000,(window.__mgRevisionProtectedUntil||0)-Date.now()));} };
        map.on('dragstart', waveCamAbortHandler);
        map.on('wheel', waveCamAbortHandler);
        map.on('touchstart', waveCamAbortHandler);
    }

    const generation=waveFrontGeneration,model=window.GlobalQuakeTravel;
    const mode=opts?.mode==='replay'?'replay':'live';
    const context=waveFrontContext={id:opts?.id,lng,lat,mag,depth:depth!=null&&Number.isFinite(Number(depth))?Number(depth):10,originTime,mode,protectUntilEnd:!!opts?.protectUntilEnd,stage:'opening',lastFrame:null,finalFrame:null};
    waveFrontStatus=document.createElement('div');waveFrontStatus.className='wave-front-status';waveFrontStatus.setAttribute('aria-live','polite');
    (document.getElementById('mapWrap')||document.body).append(waveFrontStatus);
    function protect(until){
        if(!context.protectUntilEnd||context.id==null||window.__mgRevisionProtectedId!==context.id)return;
        if(!context.previousProtection)context.previousProtection={__mgRevisionProtectedUntil:window.__mgRevisionProtectedUntil,__mgHoldEndsAt:window.__mgHoldEndsAt,__mgLiveQuakeUntil:window.__mgLiveQuakeUntil};
        context.protectedUntil=until;window.__mgRevisionProtectedUntil=until;window.__mgHoldEndsAt=until;
        if(window.__mgLiveQuakeId===context.id)window.__mgLiveQuakeUntil=until;
    }
    function finishOpening(){
        if(context.stage==='holding'||!context.finalFrame)return;
        context.stage='holding';context.finalUntil=Date.now()+5000;protect(context.finalUntil);place();
        if(context.protectUntilEnd&&typeof scheduleNextAutoCycle==='function')scheduleNextAutoCycle(5020);
        waveFinalTimer=setTimeout(()=>{if(generation!==waveFrontGeneration)return;context.stage='complete';context.previousProtection=null;stopWaveFront();},5000);
    }
    const radiusAt=(phase,elapsed)=>(phase==='pkp'||phase==='pkikp')?null:model?.radius(phase,context.depth,elapsed)??null;
    // A câmera acompanha a frente azul até o próprio limite da onda P.
    // A zona de percepção permanece independente desse enquadramento.
    const place = () => {
        if (!map || !waveFrontAtivo) return;
        const elapsedS = Math.max(0, Date.now() - context.originTime) / 1000;
        const liveRadii=Object.fromEntries(WAVE_PHASES.map(phase=>[phase,radiusAt(phase,elapsedS)]));
        const physicalEnd=model?.endTime?.('p',context.depth);
        const displayLimit=waveDisplaySeconds(context.mag,context.depth);
        const end=physicalEnd==null?null:Math.min(physicalEnd,displayLimit);
        if(end!=null&&elapsedS<end&&context.protectUntilEnd&&context.stage==='opening')protect(Math.max(context.previousProtection?.__mgRevisionProtectedUntil||0,context.originTime+end*1000+20000));
        if(liveRadii.p!==null&&end!=null&&elapsedS<end&&!context.finalFrame)context.lastFrame={elapsedS,radii:liveRadii};
        if(end!=null&&elapsedS>=end&&context.lastFrame&&!context.finalFrame){const finalTime=Math.max(0,end-.001),finalRadii=Object.fromEntries(WAVE_PHASES.map(phase=>[phase,radiusAt(phase,finalTime)]));context.finalFrame=finalRadii.p===null?context.lastFrame:{elapsedS:finalTime,radii:finalRadii};context.stage='settling';}
        const expired=end!=null&&elapsedS>=end&&!context.finalFrame;
        const radii=context.finalFrame?.radii||(expired?Object.fromEntries(WAVE_PHASES.map(p=>[p,null])):liveRadii);
        const alpha=context.finalFrame?1:waveDisplayAlpha(elapsedS,displayLimit);
        const status=model?.status()||'error';
        window.__mgWaveFrontState={model:'iasp91',status,mode,originTime:context.originTime,depth:context.depth,id:context.id,elapsedS:context.finalFrame?.elapsedS??elapsedS,displayLimit,end,alpha,radii,stage:context.stage,finalUntil:context.finalUntil||null};
        if(waveFrontStatus){
            const text=status==='ready'?`Ondas sísmicas · ${context.finalFrame?'Quadro final · ':''}${mode==='replay'?'Replay':'Tempo real'}`:status==='error'?'Ondas sísmicas · Modelo indisponível':'Ondas sísmicas · Carregando modelo';
            if(waveFrontStatus.textContent!==text)waveFrontStatus.textContent=text;
            const parent=waveFrontStatus.parentElement,headerBottom=Math.max(...['top-strip','ux-controlbar'].map(id=>document.getElementById(id)?.getBoundingClientRect().bottom||0));
            const top=Math.max(12,headerBottom-(parent?.getBoundingClientRect().top||0)+10)+'px';
            if(waveFrontStatus.style.top!==top)waveFrontStatus.style.top=top;
        }
        try {
            WAVE_LAYER_IDS.forEach(id=>{if(map.getLayer(id))map.setPaintProperty(id,'line-opacity',alpha*(id.endsWith('-glow')?.5:1));});
            for(const phase of WAVE_PHASES){const km=radii[phase];map.getSource(`wave-front-${phase}`)?.setData({type:'Feature',geometry:{type:'LineString',coordinates:km===null?[]:anelGeodesico(context.lng,context.lat,km,256,model.EARTH_RADIUS)}});}
        } catch (e) {}
        if(context.finalFrame&&(!chaseCam||camAbortada)&&context.stage==='settling')finishOpening();
    };
    place();
    model?.load().then(()=>{if(waveFrontAtivo&&generation===waveFrontGeneration)place();}).catch(()=>{if(waveFrontAtivo&&generation===waveFrontGeneration)place();});

    // ═══ Chase-cam: suavização exponencial contínua (quadro a quadro), NÃO
    // mais uma cadeia de easeTo() curtos reiniciados a cada correção. ═══
    // Versão antiga: a cada tick (evento 'move'/'zoom', disparado em TODO
    // frame durante a própria easeTo do chase-cam) recalculava o alvo e, se
    // mudou o suficiente, INTERROMPIA a easeTo em andamento com uma nova
    // (throttle de 260ms só reduzia a frequência, não eliminava o problema).
    // Cada easeTo tinha easing ease-in-out (velocidade zero nas pontas), mas
    // ao ser cortada no meio por uma nova antes de terminar sua desaceleração,
    // a velocidade real da câmera saltava de forma abrupta entre pernas —
    // exatamente o "degrau"/"chacoalhão" medido em teste e visto em vídeo.
    // Fix real (pedido do usuário: câmera "cinema", nunca brusca ou rápida
    // demais): abandonar a ideia de "animação com início e fim" pra corrigir
    // o zoom. Em vez disso, a cada quadro (requestAnimationFrame) o zoom
    // atual persegue o alvo bruto com um filtro exponencial de constante de
    // tempo fixa (como uma câmera de cinema com "damping": nunca para nem
    // arranca de repente, a velocidade muda de forma contínua o tempo todo)
    // e aplica via jumpTo (sem a própria easeTo, que teria seu próprio
    // início/fim pra brigar com o próximo quadro). Sem reinícios, sem
    // "pernas" — uma curva de velocidade contínua do início ao fim.
    if (chaseCam) {
        let camZoomAtual = null;
        let camUltimoFrameEm = 0;
        let lastTargetRadius = null;
        // Constante de tempo do amortecimento: quanto maior, mais lenta/
        // "pesada" a câmera reage ao alvo — 650ms dá uma sensação de
        // câmera de cinema (nunca "gruda" instantaneamente no alvo, mas
        // também não fica visivelmente atrasada atrás do crescimento real
        // do anel, que já tem seu próprio lookahead embutido abaixo).
        const TAU_CAM_MS = 650;
        const camLoop = () => {
            if (!map || !waveFrontAtivo || camAbortada) { waveCamRAF = null; return; }
            if (Date.now() < camStartAt) { waveCamRAF = requestAnimationFrame(camLoop); return; }

            const elapsedS = Math.max(0, Date.now() - context.originTime) / 1000;
            const limit=Math.min(model?.endTime?.('p',context.depth)??Infinity,waveDisplaySeconds(context.mag,context.depth));
            if(elapsedS>=limit&&!context.finalFrame)place();
            if(elapsedS>=limit&&!context.finalFrame){waveCamRAF=null;return;}
            const kmP=radiusAt('p',elapsedS);
            // Mira um pouco ADIANTE (camLookaheadMs) no raio que o anel terá
            // daqui a pouco, não no raio atual — senão a câmera sempre fica
            // um passo atrás do crescimento real (ver histórico de bugs
            // acima). 1800ms dá margem suficiente pro amortecimento de
            // TAU_CAM_MS não deixar o anel escapar da tela.
            const camLookaheadMs = 1800;
            const predicted=radiusAt('p',Math.min(limit-.001,elapsedS+camLookaheadMs/1000));
            const kmAlvoCam=context.finalFrame?.radii.p??predicted??kmP??lastTargetRadius;
            if(kmAlvoCam===null){waveCamRAF=model?.status()==='error'?null:requestAnimationFrame(camLoop);return;}
            lastTargetRadius=kmAlvoCam;
            // Enquadra o raio efetivamente desenhado, sem abertura regional forçada.
            const zoomAlvoBruto = Math.max(1.5,Math.min(15,
                zoomParaCaberRaio(context.lng,context.lat,kmAlvoCam)));

            if (camZoomAtual === null) camZoomAtual = map.getZoom();
            const agoraMs = performance.now();
            // dt entre quadros — limitado a 200ms pra não dar um "salto"
            // gigante se a aba ficou em background (rAF pausa) e voltou.
            const dt = camUltimoFrameEm ? Math.min(200, agoraMs - camUltimoFrameEm) : 16;
            camUltimoFrameEm = agoraMs;
            const fatorSuavizacao = 1 - Math.exp(-dt / TAU_CAM_MS);
            const proximoZoom = camZoomAtual + (zoomAlvoBruto - camZoomAtual) * fatorSuavizacao;
            // Só abre (zoom out) — nunca fecha de volta (a onda só cresce).
            camZoomAtual = Math.min(camZoomAtual, proximoZoom);
            try {
                map.jumpTo({ center: centroCompensado(context.lng, context.lat, camZoomAtual), zoom: camZoomAtual });
            } catch (e) {}

            // Termina quando não há nova chegada P e a câmera convergiu (dentro de
            // uma folga pequena) — antes disso continua ajustando quadro a
            // quadro, mesmo que o ajuste esteja ficando imperceptivelmente
            // pequeno (filtro exponencial nunca chega EXATAMENTE no alvo).
            if(context.finalFrame)camAtingiuTeto=true;
            if (camAtingiuTeto && camZoomAtual <= zoomAlvoBruto + 0.003) {
                waveCamRAF = null;finishOpening();
                return;
            }
            waveCamRAF = requestAnimationFrame(camLoop);
        };
        waveCamRAF = requestAnimationFrame(camLoop);
    }
    // A geometria em si (lng/lat real) o Mapbox reprojeta sozinho em
    // qualquer pan/zoom — mas o chase-cam (dentro de place()) ainda precisa
    // rodar em cada frame de câmera, não só no tick de 300ms: só no
    // setInterval, a correção perdia ritmo justamente durante a própria
    // easeTo do chase-cam (que dispara 'move'/'zoom' em cada frame dela),
    // deixando a câmera acumular atraso atrás do crescimento real do anel
    // (raio em tela chegando a passar de 650px, medido). Recalcular o anel
    // geodésico a mais vezes por causa disso é barato, sai bem mais barato
    // que a câmera vazando atrás do anel.
    waveFrontPlaceHandler = place;
    map.on('move', place);
    map.on('zoom', place);
    requestAnimationFrame(() => requestAnimationFrame(() => {
        if(!waveFrontAtivo||generation!==waveFrontGeneration)return;
        try {
            WAVE_LAYER_IDS.forEach(id => {
                if (map.getLayer(id)) map.setPaintProperty(id, 'line-opacity', (window.__mgWaveFrontState?.alpha||0)*(id.endsWith('-glow') ? 0.5 : 1));
            });
        } catch (e) {}
    }));
    // Atualização periódica pra crescer com o tempo real — sem exagerar o
    // ritmo com prefers-reduced-motion, mas continua fisicamente correto.
    // Sem timer de auto-expiração ao final (ver comentário lá em cima): o
    // anel acompanha as chegadas válidas até outro startWaveFront() ser
    // chamado — o interval só para de rodar quando isso acontecer (via
    // stopWaveFront no início da próxima chamada).
    waveFrontInterval = setInterval(place, reduceMotion ? 1500 : 300);
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
