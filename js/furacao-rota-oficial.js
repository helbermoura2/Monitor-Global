/* Rota oficial do NHC pra furacão/ciclone — trajetória prevista + cone de
   incerteza REAIS (produtos GIS oficiais do National Hurricane Center, em
   KMZ), carregados quando o furacão aberto no card tiver cobertura do NHC
   (item.nhcId, setado em js/furacoes-gdacs.js a partir do CurrentStorms.json).

   Sem isso, o app já desenha uma estimativa própria o tempo todo (linha
   tracejada = por onde já passou, cone alargando = projeção simples a partir
   da direção/velocidade recentes — ver cycloneConePolygon em
   js/geo-e-ciclone-utils.js e cyclone-track/cyclone-cone em js/mapa.js). Esta
   rota oficial, quando carrega, fica desenhada por cima como uma camada extra
   — não substitui nem mexe na estimativa própria, que continua servindo pros
   furacões/ciclones fora da área de cobertura do NHC (ex: Pacífico Oeste,
   Índico).

   Curiosamente já existia um parser de KMZ pronto pra isso em
   js/monitor-global-70.js (loadStormProducts/kmlToGeoJSON) — só que preso
   dentro de uma IIFE nunca conectada a lugar nenhum (o painel que chamava
   ela, #mg70-hud, não é criado por ninguém no app), então nunca rodava de
   verdade. Reescrito aqui, exposto em window, e ligado ao card principal via
   triggerEventoMapaFx (js/mapa.js). */
let hurricaneOfficialId = null;

function stopHurricaneOfficialRoute() {
    if (!hurricaneOfficialId) return;
    try {
        ['nhc-official-cone', 'nhc-official-track'].forEach(id => {
            if (map.getLayer(id)) map.removeLayer(id);
            if (map.getSource(id)) map.removeSource(id);
        });
    } catch (e) {}
    hurricaneOfficialId = null;
}

function kmlToGeoJSONRota(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const features = [];
    doc.querySelectorAll('Placemark').forEach(pm => {
        const name = pm.querySelector('name')?.textContent || '';
        pm.querySelectorAll('LineString').forEach(g => {
            const s = g.querySelector('coordinates')?.textContent.trim();
            if (!s) return;
            const pts = s.split(/\s+/).map(v => v.split(',').slice(0, 2).map(Number)).filter(a => a.length === 2 && a.every(Number.isFinite));
            if (pts.length > 1) features.push({ type: 'Feature', properties: { name }, geometry: { type: 'LineString', coordinates: pts } });
        });
        pm.querySelectorAll('Polygon outerBoundaryIs LinearRing').forEach(g => {
            const s = g.querySelector('coordinates')?.textContent.trim();
            if (!s) return;
            const pts = s.split(/\s+/).map(v => v.split(',').slice(0, 2).map(Number)).filter(a => a.length === 2 && a.every(Number.isFinite));
            if (pts.length > 2) features.push({ type: 'Feature', properties: { name }, geometry: { type: 'Polygon', coordinates: [pts] } });
        });
    });
    return { type: 'FeatureCollection', features };
}

async function fetchKmzComoGeoJSON(kmzUrl) {
    if (!window.JSZip || typeof WORKER_PROXY !== 'function') return null;
    const r = await fetch(WORKER_PROXY(kmzUrl), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const ab = await r.arrayBuffer();
    const zip = await JSZip.loadAsync(ab);
    let nome = Object.keys(zip.files).find(n => /\.kml$/i.test(n));
    if (!nome) nome = Object.keys(zip.files)[0];
    if (!nome) return null;
    const xml = await zip.files[nome].async('text');
    return kmlToGeoJSONRota(xml);
}

async function startHurricaneOfficialRoute(item) {
    if (!item || item.type !== 'hurricane' || !map) return;
    if (!item.nhcId) {
        try { if (typeof onHurricaneRouteStatus === 'function') onHurricaneRouteStatus('sem-cobertura', item.id); } catch (e) {}
        return;
    }
    if (hurricaneOfficialId === item.id) return; // já carregado pra este mesmo furacão

    try {
        const base = (typeof WORKER_PROXY === 'function') ? WORKER_PROXY('').split('?')[0].replace(/\/$/, '') : '';
        if (!base) throw new Error('Worker não encontrado');
        const r = await fetch(base + '/v70-cyclones', { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        const c = (d.storms || []).find(s => s.id === item.nhcId);
        if (eventoSelecionadoId !== item.id) return; // usuário já trocou de evento enquanto isso carregava
        if (!c || (!c.track && !c.cone)) {
            try { if (typeof onHurricaneRouteStatus === 'function') onHurricaneRouteStatus('sem-cobertura', item.id); } catch (e) {}
            return;
        }

        let ok = false;
        if (c.track) {
            try {
                const fc = await fetchKmzComoGeoJSON(c.track);
                if (fc && fc.features.length && eventoSelecionadoId === item.id) {
                    if (map.getSource('nhc-official-track')) map.getSource('nhc-official-track').setData(fc);
                    else {
                        map.addSource('nhc-official-track', { type: 'geojson', data: fc });
                        map.addLayer({ id: 'nhc-official-track', type: 'line', source: 'nhc-official-track', paint: { 'line-color': '#e879f9', 'line-width': 3, 'line-opacity': .9 } });
                    }
                    ok = true;
                }
            } catch (e) { console.warn('[furacão rota oficial] track', e); }
        }
        if (c.cone) {
            try {
                const fc = await fetchKmzComoGeoJSON(c.cone);
                if (fc && fc.features.length && eventoSelecionadoId === item.id) {
                    if (map.getSource('nhc-official-cone')) map.getSource('nhc-official-cone').setData(fc);
                    else {
                        map.addSource('nhc-official-cone', { type: 'geojson', data: fc });
                        const before = map.getLayer('nhc-official-track') ? 'nhc-official-track' : undefined;
                        map.addLayer({ id: 'nhc-official-cone', type: 'fill', source: 'nhc-official-cone', paint: { 'fill-color': '#a855f7', 'fill-opacity': .16, 'fill-outline-color': '#c084fc' } }, before);
                    }
                    ok = true;
                }
            } catch (e) { console.warn('[furacão rota oficial] cone', e); }
        }

        if (eventoSelecionadoId !== item.id) { stopHurricaneOfficialRoute(); return; }
        if (ok) {
            hurricaneOfficialId = item.id;
            try { if (typeof onHurricaneRouteStatus === 'function') onHurricaneRouteStatus('oficial', item.id); } catch (e) {}
        } else {
            try { if (typeof onHurricaneRouteStatus === 'function') onHurricaneRouteStatus('sem-cobertura', item.id); } catch (e) {}
        }
    } catch (e) {
        console.warn('[furacão rota oficial]', e);
        try { if (typeof onHurricaneRouteStatus === 'function') onHurricaneRouteStatus('falhou', item.id); } catch (e2) {}
    }
}

window.startHurricaneOfficialRoute = startHurricaneOfficialRoute;
window.stopHurricaneOfficialRoute = stopHurricaneOfficialRoute;
