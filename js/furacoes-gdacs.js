// === furacoes-gdacs.js — Furacões/ciclones via GDACS (linhas originais 7902-8143 do core-app.js) ===

function gdacsDateStr(d) { return d.toISOString().slice(0, 10); }

async function fetchGdacsEvents(t) {
    const h = new Date();
    const de = new Date(h.getTime() - 30 * 864e5);
    // Vulcões usam rota dedicada do Worker: elimina dependência do proxy genérico
    // e permite diagnosticar o retorno oficial do GDACS separadamente.
    if (String(t).toUpperCase() === 'VO') {
        const base = workerBaseUrl();
        const urls = [base + '/gdacs-volcano?t=' + Date.now(), base + '/gdacs-volcano'];
        for (const u of urls) {
            try {
                const r = await fetch(u, { cache:'no-store', mode:'cors' });
                if (!r.ok) continue;
                const d = await r.json();
                if (d && d.ok !== false && Array.isArray(d.features)) return d.features;
            } catch (e) { console.warn('[GDACS VO Worker]', e?.message || e); }
        }
        throw new Error('GDACS VO Worker indisponível');
    }
    // Sem filtro de alertlevel: o parâmetro green;orange;red às vezes omite eventos
    // válidos (ex.: alertlevel "Orange" com capitalização diferente). Filtramos depois.
    const r = await fetchWithCorsFallback(
        `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=${t}&fromdate=${gdacsDateStr(de)}&todate=${gdacsDateStr(h)}`
    );
    const d = await r.json();
    return d.features || (Array.isArray(d) ? d : []);
}


function limparCiclonesEonetDuplicados() {
    globalAlerts = globalAlerts.filter(a => {
        if (a.type !== 'hurricane' && !(typeof looksLikeCyclone === 'function' && looksLikeCyclone(a))) return true;
        if (!/EONET|NASA/i.test(a.source || '')) return true;
        return !globalAlerts.some(b => {
            if (b === a) return false;
            if (b.type !== 'hurricane' && !(typeof looksLikeCyclone === 'function' && looksLikeCyclone(b))) return false;
            if (!/NHC|GDACS/i.test(b.source || '')) return false;
            if (nomesDeEventoCasam(a.place || a.cycloneName, b.place || b.cycloneName)) return true;
            if (a.coords && b.coords && haversine(a.coords[1], a.coords[0], b.coords[1], b.coords[0]) < 900) return true;
            return false;
        });
    });
}

async function fetchRealHurricanes() {
    /* GDACS (global) + NHC CurrentStorms (Atlântico / EP / CP). */
    const tracks = [], cones = [], trackPoints = [], ids = new Set();
    let novo = null;
    function markFetch(src) { try { lastFetchTimes[src] = Date.now(); } catch (e) {} }

    function upsertHurricane(obj) {
        const [lng, lat] = obj.coords || [];
        const dup = globalAlerts.find(a => {
            if (a.type !== 'hurricane' || !a.coords) return false;
            if (a.id === obj.id) return true;
            const dist = haversine(a.coords[1], a.coords[0], lat, lng);
            if (dist < 400) return true;
            return dist < 1200 && nomesDeEventoCasam(a.place, obj.place);
        });
        if (dup) {
            const rank = s => (/NHC/i.test(s) ? 4 : /GDACS/i.test(s) ? 3 : /EONET|NASA/i.test(s) ? 1 : 2);
            const preferNew = rank(obj.source) > rank(dup.source);
            if (preferNew || obj.source === dup.source || rank(obj.source) === rank(dup.source)) {
                if (preferNew || obj.source === dup.source) {
                    dup.coords = obj.coords;
                    if (obj.windKmh != null) dup.windKmh = obj.windKmh;
                    if (obj.pressureMb != null) dup.pressureMb = obj.pressureMb;
                    if (obj.movementInfo) dup.movementInfo = obj.movementInfo;
                    if (obj.detail) dup.detail = obj.detail;
                    if (obj.link && obj.link !== '#') dup.link = obj.link;
                    if (obj.nhcId) dup.nhcId = obj.nhcId;
                    if (obj.classification) dup.classification = obj.classification;
                    if (obj.basin) dup.basin = obj.basin;
                    if (preferNew) {
                        dup.source = obj.source;
                        dup.place = obj.place || dup.place;
                        dup.cycloneLabel = obj.cycloneLabel || dup.cycloneLabel;
                        dup.id = obj.id; // consolida no id da fonte melhor
                    }
                }
            }
            ids.add(dup.id);
            return { obj: dup, isNew: false };
        }
        globalAlerts.push(obj);
        ids.add(obj.id);
        return { obj, isNew: true };
    }

    function pushTrackHistory(id, lng, lat, bearingHint, windKmh) {
        const hist = cycloneHistory.get(id) || [];
        const last = hist[hist.length - 1];
        if (!last || haversine(last.lat, last.lng, lat, lng) > 2) hist.push({ lng, lat, t: Date.now(), windKmh: windKmh != null ? windKmh : null });
        if (hist.length > 24) hist.shift();
        cycloneHistory.set(id, hist);
        let movementInfo = null;
        if (bearingHint != null && !isNaN(bearingHint)) {
            movementInfo = { bearing: bearingHint, compass: compassLabel(bearingHint) };
        } else if (hist.length >= 2) {
            const a = hist[hist.length - 2], b2 = hist[hist.length - 1];
            const brg = bearingBetween(a, b2);
            movementInfo = { bearing: brg, compass: compassLabel(brg) };
        }
        if (hist.length >= 2) {
            // Um segmento por trecho (não uma linha só) — cada um colorido pela
            // categoria (vento) do ponto de CHEGADA daquele trecho, pra mostrar a
            // intensificação/enfraquecimento ao longo da trilha, não só "passou
            // por aqui" numa cor só. Os pontos viram marcadores coloridos à parte.
            for (let i = 1; i < hist.length; i++) {
                const de = hist[i - 1], para = hist[i];
                tracks.push({
                    type: 'Feature',
                    properties: { id, cor: classificarCiclone(para.windKmh).cor },
                    geometry: { type: 'LineString', coordinates: [[de.lng, de.lat], [para.lng, para.lat]] }
                });
            }
            hist.forEach(h2 => {
                trackPoints.push({
                    type: 'Feature',
                    properties: { id, cor: classificarCiclone(h2.windKmh).cor },
                    geometry: { type: 'Point', coordinates: [h2.lng, h2.lat] }
                });
            });
            const brg = movementInfo ? movementInfo.bearing : bearingBetween(hist[hist.length - 2], hist[hist.length - 1]);
            cones.push(cycloneConePolygon(lng, lat, brg));
        }
        return movementInfo;
    }

    try {
        const feats = await fetchGdacsEvents('TC');
        markFetch('GDACS-TC');
        feats.forEach(f => {
            const p = f.properties || {}, g = f.geometry || {};
            if (g.type !== 'Point' || !Array.isArray(g.coordinates)) return;
            const [lng, lat] = g.coordinates;
            if (isNaN(lat) || isNaN(lng)) return;
            const cur = p.iscurrent === undefined || p.iscurrent === 'true' || p.iscurrent === true;
            if (!cur) return;
            const id = `gdacs-tc-${p.eventid || p.eventname || lat + '-' + lng}`;
            const cyc = getCycloneMeta(lng, lat);
            let nome = p.eventname || p.name || 'Sistema sem nome';
            nome = String(nome).replace(/-\d{2}$/, '').trim() || nome;
            const sev = (p.severitydata && p.severitydata.severitytext) || p.alertlevel || '--';
            const svd = p.severitydata || {};
            const windKmh = (typeof svd.severity === 'number')
                ? Math.round(/mph/i.test(svd.severityunit || '') ? svd.severity * 1.60934 : svd.severity)
                : extractWindKmh(sev);
            const movementInfo = pushTrackHistory(id, lng, lat, null, windKmh);
            const gdObj = {
                id, type: 'hurricane', place: nome, bandeira: cyc.basinEmoji || '🌀',
                cycloneLabel: cyc.label, basin: cyc.basin, time: Date.now(), coords: [lng, lat], source: 'GDACS',
                gdacsId: p.eventid || null, windKmh,
                detail: `${sev}${movementInfo ? ` • Mov: ${movementInfo.compass}` : ''}`,
                movementInfo, link: (p.url && p.url.report) ? p.url.report : (p.url || '#')
            };
            gdObj.cycloneLabel = rotuloCicloneCurto(gdObj);
            gdObj.detail = detalheCicloneLista(gdObj);
            const { obj, isNew } = upsertHurricane(gdObj);
            if (isNew && fonteBooted('hurricane')) {
                showToast(`🌀 ${cyc.label} ${nome} monitorado`, 'warning');
                novo = obj; playAlertTone('hurricane');
                notificarNavegador(`🌀 ${cyc.label} ${nome}`, sev);
            }
        });
    } catch (e) { console.error('GDACS TC:', e); }

    try {
        const r = await fetchWithCorsFallback('https://www.nhc.noaa.gov/CurrentStorms.json', 15000);
        const d = await r.json();
        markFetch('NHC');
        (Array.isArray(d.activeStorms) ? d.activeStorms : []).forEach(s => {
            const lat = Number(s.latitudeNumeric);
            const lng = Number(s.longitudeNumeric);
            if (isNaN(lat) || isNaN(lng)) return;
            const id = `nhc-${(s.id || s.name || (lat + '-' + lng)).toLowerCase()}`;
            const cyc = getCycloneMeta(lng, lat);
            const nome = (s.name || 'Sistema NHC').replace(/^Tropical\s+/i, '').trim();
            const knots = parseFloat(s.intensity);
            const windKmh = !isNaN(knots) ? Math.round(knots * 1.852) : null;
            const pressureMb = s.pressure ? parseFloat(s.pressure) : null;
            const movDir = s.movementDir != null ? Number(s.movementDir) : null;
            const movSpd = s.movementSpeed != null ? Number(s.movementSpeed) : null;
            const movementInfo = pushTrackHistory(id, lng, lat, movDir, windKmh);
            if (movementInfo && movSpd != null && !isNaN(movSpd)) movementInfo.speedKmh = Math.round(movSpd * 1.852);
            const classif = classificarCiclone(windKmh);
            const clsMap = { TD: 'Depressão Tropical', TS: 'Tempestade Tropical', HU: 'Furacão', STY: 'Super Tufão', STS: 'Tempestade Tropical Severa', TY: 'Tufão' };
            const clsLabel = clsMap[String(s.classification || '').toUpperCase()] || classif.cat;
            const parts = [];
            if (clsLabel) parts.push(clsLabel);
            if (windKmh != null) parts.push(`${windKmh} km/h`);
            if (pressureMb != null && !isNaN(pressureMb)) parts.push(`${pressureMb} hPa`);
            if (movementInfo) {
                const spd = movementInfo.speedKmh != null ? ` ${movementInfo.speedKmh} km/h` : '';
                parts.push(`Mov: ${movementInfo.compass}${spd}`);
            }
            const link = (s.publicAdvisory && s.publicAdvisory.url) || (s.forecastGraphics && s.forecastGraphics.url) || 'https://www.nhc.noaa.gov/';
            const coneUrl = (s.trackCone && (s.trackCone.kmzFile || s.trackCone.zipFile)) || null;
            const nhcObj = {
                id, type: 'hurricane', place: nome, bandeira: cyc.basinEmoji || '🌀',
                cycloneLabel: cyc.label, basin: cyc.basin, time: s.lastUpdate ? new Date(s.lastUpdate).getTime() : Date.now(),
                coords: [lng, lat], source: 'NHC', nhcId: s.id || null,
                classification: s.classification || null, windKmh,
                pressureMb: pressureMb != null && !isNaN(pressureMb) ? pressureMb : null,
                detail: parts.join(' • '), movementInfo, link, coneUrl
            };
            nhcObj.cycloneLabel = rotuloCicloneCurto(nhcObj);
            const { obj, isNew } = upsertHurricane(nhcObj);
            if (isNew && fonteBooted('hurricane')) {
                showToast(`🌀 ${cyc.label} ${nome} (NHC)`, 'warning');
                novo = obj; playAlertTone('hurricane');
                notificarNavegador(`🌀 ${cyc.label} ${nome}`, parts.join(' • '));
            }
        });
        try { if (typeof setSource === 'function') setSource('NHC', 'ok', 0); } catch (e) {}
    } catch (e) {
        console.warn('NHC:', e && e.message);
        try { if (typeof setSource === 'function') setSource('NHC', 'off', 0, e && e.message); } catch (err) {}
    }

    if (map && map.getSource('cyclone-track')) map.getSource('cyclone-track').setData({ type: 'FeatureCollection', features: tracks });
    if (map && map.getSource('cyclone-track-points')) map.getSource('cyclone-track-points').setData({ type: 'FeatureCollection', features: trackPoints });
    if (map && map.getSource('cyclone-cone')) map.getSource('cyclone-cone').setData({ type: 'FeatureCollection', features: cones });
    globalAlerts = globalAlerts.filter(a => a.type !== 'hurricane' || ids.has(a.id));
    [...cycloneHistory.keys()].forEach(id => { if (!ids.has(id)) cycloneHistory.delete(id); });
    [...hurricaneFxSyncCoords.keys()].forEach(id => { if (!ids.has(id)) hurricaneFxSyncCoords.delete(id); });
    salvarCycloneHistory();
    // Remove ciclones EONET que já têm par NHC/GDACS (nome ou proximidade ampliada)
    // — era uma reimplementação inline idêntica a limparCiclonesEonetDuplicados()
    // logo acima neste arquivo; agora só chama a função de verdade.
    limparCiclonesEonetDuplicados();
    marcarBooted('hurricane');
    applyFilters();
    if (novo) showAlertDetails(novo, true);

    // Se o furacão ATUALMENTE selecionado é um dos que essa busca acabou de
    // atualizar e ele se moveu de verdade, reposiciona o anel de destaque e
    // deixa startHurricaneOfficialRoute recarregar o cone/trilha oficial se
    // a NHC publicou um boletim novo (coneUrl mudou — ver comentário lá).
    // Sem isso, os dois ficam presos na posição de quando o card foi aberto
    // enquanto o marcador do furacão no mapa segue avançando normalmente.
    try {
        if (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId != null) {
            const sel = globalAlerts.find(a => a && a.id === eventoSelecionadoId && a.type === 'hurricane');
            if (sel && ids.has(sel.id) && sel.coords) {
                const last = hurricaneFxSyncCoords.get(sel.id);
                const moveu = !last || haversine(last[1], last[0], sel.coords[1], sel.coords[0]) > 5;
                if (moveu && typeof triggerEventoMapaFx === 'function') {
                    triggerEventoMapaFx(sel, '#a855f7');
                    hurricaneFxSyncCoords.set(sel.id, sel.coords.slice());
                }
            }
        }
    } catch (e) {}
    globalAlerts.filter(a => a.type === 'hurricane' && !a.movementInfo && a.gdacsId).slice(0, 4).forEach(async (obj) => {
        const brg = await buscarTrilhaGDACS(obj.gdacsId);
        if (brg != null) {
            obj.movementInfo = { bearing: brg, compass: compassLabel(brg) };
            obj.detail = `${(obj.detail || '').split('•')[0].trim()} • Mov: ${obj.movementInfo.compass}`;
            syncAllMarkers();
            atualizarDirecaoPainel(obj);
        }
    });
}

