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

const raioStore = new Map();
let raioWrap = null, raioUpd = null;

function updateFeltRadiusLayer() {
    if (!map) return;

    if (!raioWrap) {
        raioWrap = document.createElement('div');
        raioWrap.style.cssText = 'position:absolute;left:0;top:0;z-index:6;pointer-events:none;overflow:visible;';
        document.getElementById('mapContainer').appendChild(raioWrap);

        let _raioRaf = 0;
        const raioUpdCore = () => {
            if (!raioWrap || !map) return;
            const z = map.getZoom();
            const bounds = map.getBounds();
            const magMinAnel = z < 4 ? RAIO_MAG_MIN_ZOOM_BAIXO : RAIO_MAG_MIN;

            raioStore.forEach((rec, id) => {
                const ev = globalEvents.find(e => e.id === id);
                if (!ev || !layerVisibility.earthquakes || ev.mag < magMinAnel) {
                    rec.wrap.style.display = 'none';
                    return;
                }
                if (!bounds.contains(ev.coords)) {
                    rec.wrap.style.display = 'none';
                    return;
                }

                const rMax = raioEstimado(ev.mag, ev.depth);
                const rCrit = raioCritico(ev.mag, ev.depth);
                const rDet = raioDetectavel(ev.mag, ev.depth);
                const pxOut = (rMax * 1000) / metrosPorPixel(ev.coords[1], z);
                if (pxOut < 6) {
                    rec.wrap.style.display = 'none';
                    return;
                }
                const pxIn = (rCrit * 1000) / metrosPorPixel(ev.coords[1], z);
                const pxDet = (rDet * 1000) / metrosPorPixel(ev.coords[1], z);
                const pt = map.project(ev.coords);

                rec.wrap.style.display = 'block';
                rec.out.style.width = rec.out.style.height = (pxOut * 2) + 'px';
                rec.out.style.left = (pt.x - pxOut) + 'px';
                rec.out.style.top = (pt.y - pxOut) + 'px';
                rec.inn.style.width = rec.inn.style.height = (pxIn * 2) + 'px';
                rec.inn.style.left = (pt.x - pxIn) + 'px';
                rec.inn.style.top = (pt.y - pxIn) + 'px';
                rec.det.style.width = rec.det.style.height = (pxDet * 2) + 'px';
                rec.det.style.left = (pt.x - pxDet) + 'px';
                rec.det.style.top = (pt.y - pxDet) + 'px';
                rec.det.setAttribute('width', pxDet * 2);
                rec.det.setAttribute('height', pxDet * 2);
                rec.detCircle.setAttribute('cx', pxDet);
                rec.detCircle.setAttribute('cy', pxDet);
                rec.detCircle.setAttribute('r', Math.max(0, pxDet - 2));
            });
        };
        raioUpd = () => {
            if (_raioRaf) return;
            _raioRaf = requestAnimationFrame(() => {
                _raioRaf = 0;
                raioUpdCore();
            });
        };
        map.on('move', raioUpd);
        map.on('zoom', raioUpd);
    }

    const cut = Date.now() - 864e5;
    const want = new Set();

    globalEvents.forEach(ev => {
        if (ev.time < cut || ev.mag < RAIO_MAG_MIN) return;
        want.add(ev.id);

        if (!raioStore.has(ev.id)) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';

            const out = document.createElement('div');
            out.style.cssText = 'position:absolute;border:2px solid #3b82f6;border-radius:50%;opacity:.75;background:rgba(59,130,246,.05);pointer-events:none;';

            const inn = document.createElement('div');
            inn.style.cssText = 'position:absolute;border:2px solid #ef4444;border-radius:50%;opacity:.85;background:rgba(239,68,68,.08);pointer-events:none;';

            const det = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            det.style.cssText = 'position:absolute;pointer-events:none;overflow:visible;';
            const detCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            detCircle.setAttribute('fill', 'none');
            detCircle.setAttribute('stroke', '#c084fc');
            detCircle.setAttribute('stroke-width', '3');
            detCircle.setAttribute('stroke-dasharray', '14 10');
            detCircle.setAttribute('opacity', '0.85');
            det.appendChild(detCircle);

            wrap.appendChild(det);
            wrap.appendChild(out);
            wrap.appendChild(inn);

            const rMax = Math.round(raioEstimado(ev.mag, ev.depth));
            const rCrit = Math.round(raioCritico(ev.mag, ev.depth));
            const rDet = Math.round(raioDetectavel(ev.mag, ev.depth));
            wrap.title = `🔴 zona crítica (~${rCrit} km) • 🔵 alcance sentido (~${rMax} km) • 🟣 detectável (~${rDet} km) — estimativa`;

            raioWrap.appendChild(wrap);
            raioStore.set(ev.id, { wrap, out, inn, det, detCircle });
        }
    });

    raioStore.forEach((rec, id) => {
        if (!want.has(id)) {
            rec.wrap.remove();
            raioStore.delete(id);
        }
    });

    if (raioUpd) raioUpd();
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

// Hook automático
setInterval(() => {
    if (map && !map.__hookExtra) {
        map.__hookExtra = true;
        map.on('zoomend', () => { updateQuakeLabels(); });
        updateQuakeLabels();
        updateFeltRadiusLayer();
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
