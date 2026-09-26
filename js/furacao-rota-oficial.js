/* Rota oficial do NHC pra furacão/ciclone — trajetória prevista + cone de
   incerteza REAIS (produtos GIS oficiais do National Hurricane Center, em
   KMZ), carregados quando o furacão aberto no card tiver cobertura do NHC
   (item.nhcId/item.coneUrl, setados em js/furacoes-gdacs.js a partir do
   CurrentStorms.json).

   Sem isso, o app já desenha uma estimativa própria o tempo todo (linha
   tracejada = por onde já passou, cone alargando = projeção simples a partir
   da direção/velocidade recentes — ver cycloneConePolygon em
   js/geo-e-ciclone-utils.js e cyclone-track/cyclone-cone em js/mapa.js). Esta
   rota oficial, quando carrega, fica desenhada por cima como uma camada extra
   — não substitui nem mexe na estimativa própria, que continua servindo pros
   furacões/ciclones fora da área de cobertura do NHC (ex: Pacífico Oeste,
   Índico).

   BUG encontrado e corrigido nesta versão: o código buscava o cone e a
   trilha como dois produtos KMZ SEPARADOS, um deles (`forecastTrack`) num
   campo que não existe de verdade no CurrentStorms.json da NHC — sempre
   voltava nulo, então a trilha prevista nunca aparecia. Na prática a NHC
   publica os dois juntos NO MESMO KMZ do cone (polígono da incerteza + linha
   da trajetória prevista + pontos de previsão, tudo no mesmo arquivo) — então
   agora é só UM fetch, e as geometrias são separadas por TIPO depois de
   parseadas. Também trocado o caminho: em vez de um round-trip extra pro
   Worker (/v70-cyclones, que tinha o bug do campo errado), usa direto
   item.coneUrl — o mesmo dado que o card já usa pro link de download,
   extraído uma vez em js/furacoes-gdacs.js. */
let hurricaneOfficialId = null;
// Guarda também a coneUrl usada — a NHC publica uma KMZ NOVA a cada boletim
// (~a cada 6h), com o cone/trilha reposicionados pra refletir o avanço real
// do furacão. Sem comparar a coneUrl, "já carregado pra este mesmo furacão"
// (mesmo item.id, que não muda durante toda a vida do ciclone) trava pra
// sempre no boletim antigo — o cone/trilha nunca acompanha o furacão se
// movendo, ficando "parado" enquanto o marcador do furacão no mapa segue
// avançando normalmente (foi o que ficou visível como o ícone do furacão
// aparecendo longe do centro do cone/anel).
let hurricaneOfficialConeUrl = null;

function stopHurricaneOfficialRoute() {
    if (!hurricaneOfficialId) return;
    try {
        ['nhc-official-cone-fill', 'nhc-official-cone-outline', 'nhc-official-track', 'nhc-official-points', 'nhc-official-points-label'].forEach(id => {
            if (map.getLayer(id)) map.removeLayer(id);
        });
        ['nhc-official-cone', 'nhc-official-track', 'nhc-official-points'].forEach(id => {
            if (map.getSource(id)) map.removeSource(id);
        });
    } catch (e) {}
    hurricaneOfficialId = null;
    hurricaneOfficialConeUrl = null;
}

// Extrai as 3 formas que o KMZ do cone da NHC costuma trazer juntas: o
// polígono da incerteza, a linha da trajetória prevista e os pontos de
// previsão (rotulados por dia/horário, tipo "11 AM Tue" no gráfico oficial).
function kmlToGeoJSONRota(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const poligonos = [], linhas = [], pontos = [];
    doc.querySelectorAll('Placemark').forEach(pm => {
        const name = pm.querySelector('name')?.textContent?.trim() || '';
        pm.querySelectorAll('LineString').forEach(g => {
            const s = g.querySelector('coordinates')?.textContent.trim();
            if (!s) return;
            const pts = s.split(/\s+/).map(v => v.split(',').slice(0, 2).map(Number)).filter(a => a.length === 2 && a.every(Number.isFinite));
            if (pts.length > 1) linhas.push({ type: 'Feature', properties: { name }, geometry: { type: 'LineString', coordinates: pts } });
        });
        pm.querySelectorAll('Polygon outerBoundaryIs LinearRing').forEach(g => {
            const s = g.querySelector('coordinates')?.textContent.trim();
            if (!s) return;
            const pts = s.split(/\s+/).map(v => v.split(',').slice(0, 2).map(Number)).filter(a => a.length === 2 && a.every(Number.isFinite));
            if (pts.length > 2) poligonos.push({ type: 'Feature', properties: { name }, geometry: { type: 'Polygon', coordinates: [pts] } });
        });
        pm.querySelectorAll('Point coordinates').forEach(g => {
            const s = g.textContent.trim();
            if (!s) return;
            const p = s.split(',').slice(0, 2).map(Number);
            if (p.length === 2 && p.every(Number.isFinite)) pontos.push({ type: 'Feature', properties: { name }, geometry: { type: 'Point', coordinates: p } });
        });
    });
    return { poligonos, linhas, pontos };
}

async function fetchKmzGeoJSON(kmzUrl) {
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
    if (!item.coneUrl) {
        try { if (typeof onHurricaneRouteStatus === 'function') onHurricaneRouteStatus('sem-cobertura', item.id); } catch (e) {}
        return;
    }
    // Só pula o fetch se for o MESMO furacão E o MESMO boletim (coneUrl) já
    // carregado — um boletim novo da NHC (coneUrl muda a cada atualização)
    // precisa recarregar e reposicionar o cone/trilha.
    if (hurricaneOfficialId === item.id && hurricaneOfficialConeUrl === item.coneUrl) return;

    try {
        const parsed = await fetchKmzGeoJSON(item.coneUrl);
        if (eventoSelecionadoId !== item.id) return; // usuário já trocou de evento enquanto isso carregava
        if (!parsed || (!parsed.poligonos.length && !parsed.linhas.length && !parsed.pontos.length)) {
            try { if (typeof onHurricaneRouteStatus === 'function') onHurricaneRouteStatus('sem-cobertura', item.id); } catch (e) {}
            return;
        }

        if (parsed.poligonos.length) {
            const fc = { type: 'FeatureCollection', features: parsed.poligonos };
            if (map.getSource('nhc-official-cone')) map.getSource('nhc-official-cone').setData(fc);
            else {
                map.addSource('nhc-official-cone', { type: 'geojson', data: fc });
                map.addLayer({ id: 'nhc-official-cone-fill', type: 'fill', source: 'nhc-official-cone', paint: { 'fill-color': '#a855f7', 'fill-opacity': .16 } });
                map.addLayer({ id: 'nhc-official-cone-outline', type: 'line', source: 'nhc-official-cone', paint: { 'line-color': '#e879f9', 'line-width': 1.5, 'line-opacity': .8 } });
            }
        }
        if (parsed.linhas.length) {
            const fc = { type: 'FeatureCollection', features: parsed.linhas };
            if (map.getSource('nhc-official-track')) map.getSource('nhc-official-track').setData(fc);
            else {
                map.addSource('nhc-official-track', { type: 'geojson', data: fc });
                map.addLayer({ id: 'nhc-official-track', type: 'line', source: 'nhc-official-track', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#e879f9', 'line-width': 2.5, 'line-dasharray': [2, 1.5], 'line-opacity': .95 } });
            }
        }
        if (parsed.pontos.length) {
            const fc = { type: 'FeatureCollection', features: parsed.pontos };
            if (map.getSource('nhc-official-points')) map.getSource('nhc-official-points').setData(fc);
            else {
                map.addSource('nhc-official-points', { type: 'geojson', data: fc });
                map.addLayer({ id: 'nhc-official-points', type: 'circle', source: 'nhc-official-points', paint: { 'circle-radius': 3.5, 'circle-color': '#e879f9', 'circle-stroke-width': 1, 'circle-stroke-color': '#1a0b2e' } });
                map.addLayer({
                    id: 'nhc-official-points-label', type: 'symbol', source: 'nhc-official-points',
                    layout: {
                        'text-field': ['get', 'name'], 'text-size': 9, 'text-offset': [0, 1], 'text-anchor': 'top',
                        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-allow-overlap': false
                    },
                    paint: { 'text-color': '#e879f9', 'text-halo-color': '#1a0b2e', 'text-halo-width': 1 }
                });
            }
        }

        if (eventoSelecionadoId !== item.id) { stopHurricaneOfficialRoute(); return; }
        hurricaneOfficialId = item.id;
        hurricaneOfficialConeUrl = item.coneUrl;
        try { if (typeof onHurricaneRouteStatus === 'function') onHurricaneRouteStatus('oficial', item.id); } catch (e) {}
    } catch (e) {
        console.warn('[furacão rota oficial]', e);
        try { if (typeof onHurricaneRouteStatus === 'function') onHurricaneRouteStatus('falhou', item.id); } catch (e2) {}
    }
}

window.startHurricaneOfficialRoute = startHurricaneOfficialRoute;
window.stopHurricaneOfficialRoute = stopHurricaneOfficialRoute;
