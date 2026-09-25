// === tsunami-enchente.js — Alertas de tsunami (GDACS), enchentes (GDACS) e CGE-SP (linhas originais 8144-8291 do core-app.js) ===

async function fetchTsunamiAlertsGDACS() {
    try {
        const feats = await fetchGdacsEvents('TS');
        const ids = new Set();
        let primeiroNovo = null;

        feats.forEach(f => {
            const p = f.properties || {}, g = f.geometry || {};
            if (g.type !== 'Point' || !Array.isArray(g.coordinates)) return;
            const [lng, lat] = g.coordinates;
            if (isNaN(lat) || isNaN(lng)) return;
            const cur = p.iscurrent === undefined || p.iscurrent === 'true' || p.iscurrent === true;
            if (!cur) return;

            const id = `gdacs-ts-${p.eventid || lat + '-' + lng}`;
            ids.add(id);
            const nome = p.name || p.country || 'Área não especificada';
            const infoT = traduzirEIdentificar(nome);
            const prev = globalAlerts.find(a => a.id === id);

            const obj = {
                id, type: 'tsunami', place: nome,
                bandeira: infoT.bandeira || getFlagByCoords(lat, lng),
                pais: infoT.pais,
                time: prev ? prev.time : Date.now(),
                coords: [lng, lat], source: 'GDACS',
                gdacsAlertLevel: p.alertlevel || null,
                detail: `Alerta ${p.alertlevel || ''}`,
                link: (p.url && p.url.report) ? p.url.report : (p.url || '#')
            };
            const isNew = upsertAlert(obj, { fonte: 'tsunamiGdacs' });

            if (isNew) {
                primeiroNovo = primeiroNovo || obj;
                playAlertTone('tsunami');
                showToast(`🌊 TSUNAMI: ${nome}`, 'error');
                notificarNavegador(`🌊 TSUNAMI — ${nome}`, 'Alerta GDACS');
            }
        });

        window.__gdacsTsIds = ids;
        marcarBooted('tsunamiGdacs');
        applyFilters();
        if (primeiroNovo) showAlertDetails(primeiroNovo, true);
    } catch (e) { console.error('GDACS TS:', e); }
}

/* ═══════════ FRENTE DE ONDA DE TSUNAMI — anel único, revelação acelerada ═══════════
   Tsunami em mar aberto viaja a ~sqrt(9,81 × profundidade) — numa bacia oceânica
   típica (~4000m) isso dá uns 198 m/s, ~720 km/h. Cruzar os 2.000km do raio
   "países potencialmente afetados" (mesmo teto de getPaisesAfetadosTsunami)
   levaria HORAS de verdade — em tempo real o anel mal se moveria nos poucos
   minutos que o card fica na tela. Por isso a animação usa escala de tempo
   comprimida: sempre reinicia do zero ao abrir/revisitar o alerta (mesma ideia
   do "replay" do sismo, não usa item.time como origem) e alcança o teto em
   TSUNAMI_SWEEP_MS — é uma REVELAÇÃO da zona de alcance estimada, não um
   rastreador de onda em tempo real. A velocidade real (TSUNAMI_KMH) é usada
   à parte pra estimar tempo de viagem até cada país no painel. */
const TSUNAMI_KMH = 720;
const TSUNAMI_ALCANCE_MAX_KM = 2000;
const TSUNAMI_SWEEP_MS = 90000;
let tsunamiWaveEl = null, tsunamiWaveUpd = null, tsunamiWaveInterval = null, tsunamiWaveTimer = null, tsunamiWaveFadeTimer = null;

function stopTsunamiWave() {
    try { clearInterval(tsunamiWaveInterval); } catch (e) {}
    try { clearTimeout(tsunamiWaveTimer); } catch (e) {}
    try { clearTimeout(tsunamiWaveFadeTimer); } catch (e) {}
    tsunamiWaveInterval = tsunamiWaveTimer = tsunamiWaveFadeTimer = null;
    if (tsunamiWaveEl) {
        try { map && map.off('move', tsunamiWaveUpd); map && map.off('zoom', tsunamiWaveUpd); } catch (e) {}
        tsunamiWaveEl.remove();
        tsunamiWaveEl = null;
        tsunamiWaveUpd = null;
    }
}

function startTsunamiWave(lng, lat, cor) {
    if (!map) return;
    stopTsunamiWave();
    try { if (typeof stopCascadeRipple === 'function') stopCascadeRipple(); } catch (e) {}
    try { if (typeof stopContinuousRadar === 'function') stopContinuousRadar(); } catch (e) {}
    try { if (typeof stopFeltZone === 'function') stopFeltZone(); } catch (e) {}
    try { if (typeof stopWaveFront === 'function') stopWaveFront(); } catch (e) {}
    try { if (typeof stopHurricaneOfficialRoute === 'function') stopHurricaneOfficialRoute(); } catch (e) {}
    const host = document.getElementById('mapContainer');
    if (!host) return;

    const wrap = document.createElement('div');
    wrap.className = 'tsunami-wave-wrap';
    const ring = document.createElement('div');
    ring.className = 'tsunami-wave-ring';
    if (cor) ring.style.borderColor = cor;
    wrap.append(ring);
    host.appendChild(wrap);
    tsunamiWaveEl = wrap;

    const coords = [lng, lat];
    const startAt = Date.now();
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const place = () => {
        if (!map || !tsunamiWaveEl) return;
        const elapsedMs = Date.now() - startAt;
        const km = Math.min(TSUNAMI_ALCANCE_MAX_KM, (elapsedMs / TSUNAMI_SWEEP_MS) * TSUNAMI_ALCANCE_MAX_KM);
        const z = map.getZoom();
        const mpp = metrosPorPixel(lat, z);
        const px = Math.max(20, (km * 1000) / mpp * 2);
        const pt = map.project(coords);
        ring.style.width = ring.style.height = px + 'px';
        ring.style.left = pt.x + 'px';
        ring.style.top = pt.y + 'px';
    };
    tsunamiWaveUpd = place;
    place();
    map.on('move', place);
    map.on('zoom', place);

    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('grow')));
    tsunamiWaveInterval = setInterval(place, reduceMotion ? 1500 : 300);

    // Fica visível mais um pouco depois de chegar no teto (pra dar tempo de ver
    // o anel "parado" no alcance máximo) antes de sumir sozinho.
    tsunamiWaveTimer = setTimeout(() => {
        wrap.classList.add('fading');
        tsunamiWaveFadeTimer = setTimeout(stopTsunamiWave, 950);
    }, TSUNAMI_SWEEP_MS + 15000);
}

/* ═══════════════ ENCHENTES — GDACS (FL) ═══════════════ */
async function fetchGdacsFloods() {
    try {
        const base = workerBaseUrl();
        const r = await fetch(base + '/gdacs-floods?t=' + Date.now(), { cache: 'no-store', mode: 'cors' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        if (d && d.ok === false) throw new Error(d.error || 'gdacs-floods indisponível');
        const items = Array.isArray(d?.items) ? d.items : [];
        const ids = new Set();
        let primeiroNovo = null;

        items.forEach(p => {
            if (!p.iscurrent) return;
            if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return;

            const id = `gdacs-fl-${p.eventid || p.lat + '-' + p.lon}`;
            ids.add(id);
            const nome = p.country || (p.title || '').replace(/^.*flood alert in\s*/i, '') || 'Área não especificada';
            const infoT = traduzirEIdentificar(nome);
            const prev = globalAlerts.find(a => a.id === id);

            const obj = {
                id, type: 'flood', place: nome,
                bandeira: infoT.bandeira || getFlagByCoords(p.lat, p.lon),
                pais: infoT.pais,
                time: prev ? prev.time : Date.now(),
                coords: [p.lon, p.lat], source: 'GDACS',
                gdacsAlertLevel: p.alertlevel || null,
                detail: [p.alertlevel ? `Alerta ${p.alertlevel}` : null, p.description || null].filter(Boolean).join(' · '),
                link: p.link || '#'
            };
            const isNew = upsertAlert(obj, { fonte: 'floodGdacs' });

            if (isNew) {
                primeiroNovo = primeiroNovo || obj;
                playAlertTone('flood');
                showToast(`💧 Enchente: ${nome}`, 'warning');
                notificarNavegador(`💧 Enchente — ${nome}`, 'Alerta GDACS');
            }
        });

        globalAlerts = globalAlerts.filter(a => a.type !== 'flood' || a.source !== 'GDACS' || ids.has(a.id));
        marcarBooted('floodGdacs');
        applyFilters();
        if (primeiroNovo) showAlertDetails(primeiroNovo, true);
    } catch (e) { console.error('GDACS FL:', e); }
}

/* ═══════════════ ENCHENTES — CGE São Paulo (alagamentos) ═══════════════
   O Worker já raspa isso pro /sp-clima há tempos, mas nada no front consumia
   esse campo — ficava só girando em vão no servidor. Agora vira um card de
   enchente de verdade quando há pontos ativos, igual qualquer outro alerta. */
const SP_COORDS_FRONT = { lat: -23.55, lng: -46.63 };
async function fetchCgeSP() {
    const id = 'cge-sp-alagamentos';
    try {
        const base = workerBaseUrl();
        const r = await fetch(base + '/sp-clima', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        const cge = d && d.cge;
        if (!cge || cge.status === 'indisponivel') {
             try { if (typeof setSource === 'function') setSource('CGE', 'warn', null, 'portal acessível; dados CGE não retornaram neste ciclo'); } catch (_) {}
             return;
         }
        const ativos = Number(cge.alagamentos_ativos) || 0;
        globalAlerts = globalAlerts.filter(a => a.id !== id);
        if (cge.status !== 'normal' && ativos > 0) {
            const sevTxt = cge.status === 'crise' ? 'Crise' : 'Atenção';
            const obj = {
                id, type: 'flood', place: `Alagamentos ativos — São Paulo (CGE)`,
                bandeira: '🇧🇷', pais: 'Brasil',
                time: Date.now(), coords: [SP_COORDS_FRONT.lng, SP_COORDS_FRONT.lat],
                source: 'CGE', sev: cge.status === 'crise' ? 4 : 2,
                detail: `${sevTxt} · ${ativos} ponto(s) de alagamento ativo(s) · Centro de Gerenciamento de Emergências`,
                link: cge.fonte || 'https://www.cgesp.org/v3/alagamentos.jsp'
            };
            const isNew = upsertAlert(obj, { fonte: 'cgeSp', skipRemove: true });
            if (isNew) {
                playAlertTone('flood');
                showToast(`💧 CGE: ${ativos} ponto(s) de alagamento ativo(s) em São Paulo`, 'warning');
                notificarNavegador('💧 Alagamentos em São Paulo', `${ativos} ponto(s) ativo(s) — CGE`);
            }
        }
        try { if (typeof setSource === 'function') setSource('CGE', 'ok', ativos); } catch (_) {}
        applyFilters();
    } catch (e) {
        console.warn('CGE São Paulo:', e && e.message);
        try { if (typeof setSource === 'function') setSource('CGE', 'off', null, e && e.message); } catch (_) {}
    }
}

/* ═══════════════ VULCANISMO PROFISSIONAL — GDACS + USGS VHP/VONA ═══════════════
   USGS VHP:
   - VHP status: status de todos os vulcões monitorados (para enriquecimento)
   - Elevated: só vulcões em alerta (YELLOW/ORANGE/RED ou ADVISORY/WATCH/WARNING)
   - HANS/VONA: avisos aeronáuticos recentes, código de cor, nível de alerta,
     observatório, atividade, cinzas e início da atividade quando informado
   A camada continua usando GDACS para cobertura global de eventos vulcânicos.
   O cruzamento é feito por VNUM, nome e proximidade (~80 km).
   Vulcões USGS elevados/VONA aparecem no mapa/lista mesmo sem registro GDACS.
═══════════════════════════════════════════════════════════════════════════════ */
