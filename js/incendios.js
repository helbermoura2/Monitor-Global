// === incendios.js — Incêndios: EONET, GDACS, INPE queimadas, FIRMS (linhas originais 8934-9340 do core-app.js) ===

function isSouthAmerica(lat, lng) {
    return lat <= 13 && lat >= -56 && lng >= -82 && lng <= -34;
}

async function fetchEonetFires() {
    let events = null;
    try {
        const rc = await fetchWithCorsFallback(`${EONET}/categories`, 12000);
        const dc = await rc.json();
        const cat = (dc.categories || []).find(c => /wildfire/i.test(c.title || ''));
        if (cat) {
            const r = await fetchWithCorsFallback(`${EONET}/events?category=${cat.id}&status=open&limit=250`, 15000);
            const d = await r.json();
            events = d.events || [];
        }
    } catch (e) { console.warn('EONET categorias falhou, tentando fallback:', e.message); }

    if (!events) {
        const r = await fetchWithCorsFallback(`${EONET}/events?status=open&limit=500`, 20000);
        const d = await r.json();
        events = (d.events || []).filter(ev =>
            (ev.categories || []).some(c => /wildfire/i.test(c.title || ''))
        );
    }

    const prevTimes = new Map(
        globalAlerts
            .filter(a => (a.id || '').startsWith('eonet-') || (a.id || '').startsWith('gdacs-wf-'))
            .map(a => [a.id, a.time])
    );

    globalAlerts = globalAlerts.filter(a =>
        (!(a.id || '').startsWith('eonet-') || (a.id || '').startsWith('eonet-st-')) &&
        !(a.id || '').startsWith('gdacs-wf-')
    );

    let novos = 0;
    events.forEach(ev => {
        const g = ev.geometry && ev.geometry[ev.geometry.length - 1];
        if (!g || !Array.isArray(g.coordinates)) return;
        const [lng, lat] = g.coordinates;
        if (!isSouthAmerica(lat, lng)) return; // fora da América do Sul: ignora
        const id = 'eonet-' + ev.id;
        const src = ev.sources && ev.sources[0];
        const quando = g.date ? new Date(g.date).getTime() : (prevTimes.get(id) || Date.now());
        const infoT = traduzirEIdentificar(ev.title);
        // Se a geometria tem >48h, usa "agora" pra não cair no filtro de 24h da lista
        const tFire = (quando && (Date.now() - quando) < 48 * 3600000) ? quando : Date.now();
        const isNew = upsertAlert({
            id, type: 'fire', place: ev.title,
            bandeira: infoT.bandeira || getFlagByCoords(lat, lng),
            pais: infoT.pais,
            time: tFire, coords: [lng, lat],
            source: 'NASA EONET', detail: '🔥 ATIVO agora',
            link: (src && isUsefulOfficialUrl(src.url) ? src.url : (pickBestSourceUrl(ev.sources) || null))
        }, { fonte: 'eonetFires', skipRemove: true });
        if (isNew) novos++;
    });

    if (novos) {
        playAlertTone('fire');
        showToast(`🔥 ${novos} novo(s) incêndio(s)`, 'warning');
    }
    marcarBooted('eonetFires');
    applyFilters();
}

async function fetchGdacsFires() {
    const feats = await fetchGdacsEvents('WF');
    const ids = new Set();
    let novos = 0;

    feats.forEach(f => {
        const p = f.properties || {}, g = f.geometry || {};
        if (g.type !== 'Point' || !Array.isArray(g.coordinates)) return;
        const [lng, lat] = g.coordinates;
        if (isNaN(lat) || isNaN(lng)) return;
        if (!isSouthAmerica(lat, lng)) return; // fora da América do Sul: ignora

        const id = `gdacs-wf-${p.eventid || lat + '-' + lng}`;
        ids.add(id);
        const nome = p.name || p.country || 'Incêndio florestal';
        const infoT = traduzirEIdentificar(nome);
        const prev = globalAlerts.find(a => a.id === id);

        const isNew = upsertAlert({
            id, type: 'fire', place: nome,
            bandeira: infoT.bandeira || getFlagByCoords(lat, lng),
            pais: infoT.pais,
            time: prev ? prev.time : Date.now(),
            coords: [lng, lat], source: 'GDACS',
            detail: `Alerta ${p.alertlevel || '--'}`,
            link: (p.url && p.url.report) ? p.url.report : (p.url || '#')
        }, { fonte: 'wildfireGdacs' });
        if (isNew) novos++;
    });

    globalAlerts = globalAlerts.filter(a => !(a.id || '').startsWith('gdacs-wf-') || ids.has(a.id));
    // Remove só os incêndios do EONET (id "eonet-XXX"), preservando tempestades/ciclones
    // do EONET que usam o prefixo "eonet-st-" (senão eles somem sempre que esse fallback roda)
    globalAlerts = globalAlerts.filter(a => !(a.id || '').startsWith('eonet-') || (a.id || '').startsWith('eonet-st-'));
    marcarBooted('wildfireGdacs');

    if (novos) {
        playAlertTone('fire');
        showToast(`🔥 ${novos} novo(s) incêndio(s) (GDACS)`, 'warning');
    }
    applyFilters();
}

async function fetchEonetStorms() {
    try {
        const rc = await fetch(`${EONET}/categories`);
        const dc = await rc.json();
        const cat = (dc.categories || []).find(c => /severe storm/i.test(c.title || ''));
        if (!cat) return;

        const r = await fetch(`${EONET}/events?category=${cat.id}&status=open&limit=100`);
        const d = await r.json();
        const ids = new Set();
        let novos = 0;

        (d.events || []).forEach(ev => {
            const g = ev.geometry && ev.geometry[ev.geometry.length - 1];
            if (!g || !Array.isArray(g.coordinates)) return;
            const [lng, lat] = g.coordinates;
            const id = 'eonet-st-' + ev.id;
            ids.add(id);
            const title = ev.title || 'Tempestade';
            const isCyc = /cyclone|typhoon|hurricane|tufão|ciclone/i.test(title);
            const prev = globalAlerts.find(a => a.id === id);
            const isNew = !knownAlertIds.has(id);
            knownAlertIds.add(id);
            globalAlerts = globalAlerts.filter(a => a.id !== id);
            const link = pickBestSourceUrl(ev.sources) || (ev.sources && ev.sources[0] && isUsefulOfficialUrl(ev.sources[0].url) ? ev.sources[0].url : null);

            if (isCyc) {
                // Evita duplicidade: se já existe o mesmo ciclone via GDACS (fonte mais completa,
                // com trilha/cone/vento), não cria uma segunda entrada via EONET. Casa por NOME
                // (mesmo critério de limparCiclonesEonetDuplicados, mais abaixo) além de
                // distância — só checar <900km deixava passar um ciclone rápido/em
                // intensificação forte, cuja posição no EONET (atualiza mais devagar) já
                // tinha se afastado da posição real do GDACS/NHC além desse raio, criando
                // uma segunda entrada/ícone/trilha pro mesmo furacão.
                const jaExisteGdacs = globalAlerts.some(a => {
                    if (a.type !== 'hurricane' || !/GDACS|NHC/i.test(a.source || '')) return false;
                    if (nomesDeEventoCasam(title, a.place || a.cycloneName)) return true;
                    return a.coords && haversine(a.coords[1], a.coords[0], lat, lng) < 900;
                });
                if (!jaExisteGdacs) {
                    const cyc = getCycloneMeta(lng, lat);
                    // EONET já traz o histórico de posições dentro do próprio evento (ev.geometry
                    // tem uma entrada por avanço da tempestade) — antes só usávamos a última pra
                    // marcar a posição e a seta nunca aparecia pra ciclones vindos só do EONET
                    // (sem GDACS equivalente). Calculamos a direção com as duas últimas posições
                    // distintas, sem precisar de chamada extra à API.
                    let movementInfo = null;
                    const pontos = (ev.geometry || [])
                        .filter(p2 => Array.isArray(p2.coordinates))
                        .map(p2 => ({ lng: p2.coordinates[0], lat: p2.coordinates[1] }));
                    for (let i = pontos.length - 1; i > 0; i--) {
                        const a2 = pontos[i - 1], b2 = pontos[i];
                        if (haversine(a2.lat, a2.lng, b2.lat, b2.lng) > 2) {
                            const brg = bearingBetween(a2, b2);
                            movementInfo = { bearing: brg, compass: compassLabel(brg) };
                            break;
                        }
                    }
                    globalAlerts.push({
                        id, type: 'hurricane', place: title,
                        // Ciclone quase sempre está em alto mar, longe de qualquer país —
                        // getFlagByCoords pode devolver vazio se o país costeiro mais
                        // próximo (mesmo a milhares de km) não tiver entrada no
                        // dicionário. GDACS/NHC já usam esse mesmo fallback pro emoji
                        // de bacia (🌀); aqui faltava, deixando o card sem ícone nenhum.
                        bandeira: getFlagByCoords(lat, lng) || cyc.basinEmoji || '🌀',
                        cycloneLabel: cyc.label,
                        time: prev ? prev.time : Date.now(),
                        coords: [lng, lat], source: 'NASA EONET',
                        movementInfo,
                        detail: detalheCicloneLista({ place: title, source: 'NASA EONET', movementInfo, coords: [lng, lat] }), link
                    });
                }
            } else {
                globalAlerts.push({
                    id, type: 'storm', place: title,
                    bandeira: getFlagByCoords(lat, lng),
                    icon: '⛈️',
                    time: prev ? prev.time : Date.now(),
                    coords: [lng, lat], source: 'NASA EONET',
                    detail: 'Tempestade severa (EONET)', link
                });
            }
            if (isNew) novos++;
        });

        globalAlerts = globalAlerts.filter(a => !(a.id || '').startsWith('eonet-st-') || ids.has(a.id));
        try { limparCiclonesEonetDuplicados(); } catch (e) {}
        applyFilters();
    } catch (e) { console.warn('EONET storms:', e.message); }
}

/* ── Queimadas BR: INPE (oficial) + FIRMS NASA (SA) ──
   Prioridade no Brasil: INPE > FIRMS > GDACS genérico.
   GDACS "Forest fires in Brazil" some se houver cobertura INPE/FIRMS. */
function inBrasilFire(lat, lng) {
    return lat <= 6 && lat >= -34 && lng >= -74 && lng <= -32;
}
function clusterFirePoints(points, cellDeg) {
    cellDeg = cellDeg || 0.6;
    const map = new Map();
    points.forEach(p => {
        const key = Math.round(p.lat / cellDeg) + ':' + Math.round(p.lng / cellDeg);
        let g = map.get(key);
        if (!g) {
            g = { lat: 0, lng: 0, n: 0, tMax: 0, sats: new Set() };
            map.set(key, g);
        }
        g.lat += p.lat; g.lng += p.lng; g.n++;
        g.tMax = Math.max(g.tMax, p.time || 0);
        if (p.sat) g.sats.add(p.sat);
    });
    return [...map.values()].map(g => ({
        lat: g.lat / g.n,
        lng: g.lng / g.n,
        n: g.n,
        time: g.tMax || Date.now(),
        sats: [...g.sats]
    }));
}

async function fetchInpeQueimadas() {
    const base = 'https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/10min/';
    let listing = '';
    try {
        const r = await fetchWithCorsFallback(base, 15000);
        listing = await r.text();
    } catch (e) {
        console.warn('INPE listagem:', e && e.message);
        throw e;
    }
    const files = [...listing.matchAll(/focos_10min_(\d{8}_\d{4})\.csv/g)]
        .map(m => m[1])
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort()
        .slice(-8); // ~80 min
    if (!files.length) throw new Error('INPE: sem arquivos 10min');

    const points = [];
    for (const stamp of files) {
        try {
            const r = await fetchWithCorsFallback(base + 'focos_10min_' + stamp + '.csv', 12000);
            const txt = await r.text();
            const lines = txt.split(/\r?\n/).slice(1);
            lines.forEach(line => {
                if (!line.trim()) return;
                const parts = line.split(',');
                if (parts.length < 3) return;
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                const sat = (parts[2] || '').trim();
                const dt = parts[3] ? Date.parse(parts[3].trim().replace(' ', 'T') + 'Z') : Date.now();
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                if (!inBrasilFire(lat, lng)) return; // foco INPE pode vir SA; prioriza BR
                points.push({ lat, lng, sat, time: Number.isFinite(dt) ? dt : Date.now() });
            });
        } catch (e) {
            console.warn('INPE arquivo', stamp, e && e.message);
        }
    }
    if (!points.length) throw new Error('INPE: zero focos BR');

    const clusters = clusterFirePoints(points, 0.7)
        .filter(c => c.n >= 2) // evita ruído de 1 pixel
        .sort((a, b) => b.n - a.n)
        .slice(0, 40);

    globalAlerts = globalAlerts.filter(a => !(a.id || '').startsWith('inpe-fire-'));
    let novos = 0;
    clusters.forEach((c, i) => {
        const id = 'inpe-fire-' + Math.round(c.lat * 100) + '-' + Math.round(c.lng * 100);
        const sat = c.sats.slice(0, 2).join('/') || 'satélite';
        // BUG CORRIGIDO: bandeira/país eram fixados como Brasil pra qualquer foco que
        // passasse no filtro inBrasilFire (um retângulo de lat/lng que também cobre
        // pedaços de Bolívia, Paraguai, Peru etc.). Agora a bandeira/país são resolvidos
        // pelas coordenadas reais do cluster, como já é feito nos outros tipos de evento.
        const paisFoco = getCountryByCoords(c.lat, c.lng);
        if (paisFoco.nome && paisFoco.nome.toLowerCase() !== 'brasil' && paisFoco.nome.toLowerCase() !== 'brazil') {
            dbgLog('INPE: cluster passou no filtro inBrasilFire mas fica em', paisFoco.nome, `[${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}]`);
        }
        const isNew = upsertAlert({
            id, type: 'fire',
            place: 'Queimada — foco INPE (' + c.n + ' detecções)',
            bandeira: paisFoco.flag || '🇧🇷', pais: paisFoco.nome || 'Brasil',
            time: c.time || Date.now(),
            coords: [c.lng, c.lat],
            source: 'INPE Queimadas',
            sources: ['INPE'],
            sourceSummary: 'INPE Queimadas',
            detail: c.n + ' focos · ' + sat + ' · últimas ~2h',
            link: 'https://terrabrasilis.dpi.inpe.br/queimadas/portal/'
        }, { fonte: 'inpeFire', skipRemove: true });
        if (isNew) novos++;
    });
    try { if (typeof setSource === 'function') setSource('INPE', 'ok', 0); } catch (e) {}
    if (novos) {
        playAlertTone('fire');
        showToast('🔥 ' + novos + ' cluster(s) de queimada INPE (BR)', 'warning');
    }
    return clusters.length;
}

async function fetchFirmsSouthAmerica() {
    const url = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_America_24h.csv';
    const r = await fetchWithCorsFallback(url, 20000);
    const txt = await r.text();
    const lines = txt.split(/\r?\n/).slice(1);
    const points = [];
    lines.forEach(line => {
        if (!line.trim()) return;
        const p = line.split(',');
        const lat = parseFloat(p[0]), lng = parseFloat(p[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        if (!inBrasilFire(lat, lng)) return;
        const conf = (p[8] || '').toLowerCase();
        if (conf === 'low') return;
        const date = p[5] || '';
        const time = p[6] || '0000';
        const t = Date.parse(date + 'T' + time.slice(0, 2) + ':' + time.slice(2) + ':00Z');
        points.push({ lat, lng, sat: p[7] || 'VIIRS', time: Number.isFinite(t) ? t : Date.now() });
    });
    const clusters = clusterFirePoints(points, 0.8)
        .filter(c => c.n >= 3)
        .sort((a, b) => b.n - a.n)
        .slice(0, 35);

    globalAlerts = globalAlerts.filter(a => !(a.id || '').startsWith('firms-br-'));
    clusters.forEach(c => {
        // se já tem cluster INPE perto, só anexa fonte
        const nearInpe = globalAlerts.find(a =>
            a.type === 'fire' && (a.id || '').startsWith('inpe-fire-') && a.coords &&
            haversine(a.coords[1], a.coords[0], c.lat, c.lng) < 80
        );
        if (nearInpe) {
            if (!nearInpe.sources) nearInpe.sources = [nearInpe.source];
            if (!nearInpe.sources.includes('FIRMS')) nearInpe.sources.push('FIRMS');
            nearInpe.sourceSummary = nearInpe.sources.join(' · ');
            return;
        }
        const id = 'firms-br-' + Math.round(c.lat * 100) + '-' + Math.round(c.lng * 100);
        knownAlertIds.add(id);
        globalAlerts.push({
            id, type: 'fire',
            place: 'Queimada — FIRMS/VIIRS (' + c.n + ' focos)',
            bandeira: '🇧🇷', pais: 'Brasil',
            time: c.time || Date.now(),
            coords: [c.lng, c.lat],
            source: 'FIRMS NASA',
            sources: ['FIRMS'],
            sourceSummary: 'FIRMS NASA',
            detail: c.n + ' focos VIIRS · 24h · América do Sul (filtro BR)',
            link: 'https://firms.modaps.eosdis.nasa.gov/map/'
        });
    });
    return clusters.length;
}

function limparGdacsFireGenericoBrasil() {
    // Remove GDACS genérico no BR quando há INPE/FIRMS (mais específico)
    const hasBrDetail = globalAlerts.some(a =>
        a.type === 'fire' && (/INPE|FIRMS/i.test(a.source || '') || (a.id || '').startsWith('inpe-fire-') || (a.id || '').startsWith('firms-br-'))
    );
    if (!hasBrDetail) return;
    globalAlerts = globalAlerts.filter(a => {
        if (a.type !== 'fire') return true;
        if (!/GDACS/i.test(a.source || '')) return true;
        if (!a.coords || !inBrasilFire(a.coords[1], a.coords[0])) return true;
        // genérico tipo "Forest fires in Brazil"
        if (/forest fires in brazil|inc[eê]ndio.*brasil/i.test(a.place || '')) return false;
        // se há cluster INPE/FIRMS a <120km, drop GDACS
        const near = globalAlerts.some(b =>
            b !== a && b.type === 'fire' && /INPE|FIRMS/i.test(b.source || '') && b.coords &&
            haversine(a.coords[1], a.coords[0], b.coords[1], b.coords[0]) < 120
        );
        return !near;
    });
}

async function fetchFires() {
    const results = await Promise.allSettled([
        (async () => { try { await fetchInpeQueimadas(); } catch (e) { console.warn('INPE queimadas:', e.message || e); throw e; } })(),
        (async () => { try { await fetchFirmsSouthAmerica(); } catch (e) { console.warn('FIRMS BR:', e.message || e); throw e; } })(),
        (async () => { try { await fetchEonetFires(); } catch (e) { console.warn('EONET fires:', e.message || e); throw e; } })(),
        (async () => { try { await fetchGdacsFires(); } catch (e) { console.warn('GDACS fires:', e.message || e); throw e; } })()
    ]);
    try { limparGdacsFireGenericoBrasil(); } catch (e) {}
    try { if (typeof dedupeFireAlerts === 'function') dedupeFireAlerts(); } catch (e) {}
    const nFire = globalAlerts.filter(a => a.type === 'fire').length;
    if (nFire === 0 && results.every(r => r.status === 'rejected')) {
        console.warn('Incêndios: nenhuma fonte respondeu');
    } else {
        console.log('[fires] ativos na memória:', nFire, results.map(r => r.status));
    }
    try { applyFilters(); } catch (e) {}
}

/* ═══ ALERTAS LOCAIS SP / cidade fixada (tempestade, chuva, temperatura) ═══
   VOCÊ PODE MEXER nos limiares abaixo. */
const SP_ALERT = {
    calorC: 35,          // °C — alerta de calor
    frioC: 8,            // °C — alerta de frio (raro em SP, mas útil)
    chuvaProb1h: 55,     // % — chuva provável na próxima hora
    chuvaMm1h: 2,        // mm — chuva relevante
    codeTempestade: 95,  // Open-Meteo weather_code trovoada
    codeChuvaForte: 80   // chuva forte / pancadas
};
let lastSpAlertSpoken = {};

