// === cidades-proximas.js — Busca e dedupe de cidades próximas a um evento (Photon/Overpass) (linhas originais 2332-2642 do core-app.js) ===

function getCidadesProximas(lat, lng, maxD = 800, maxC = 6) {
    return CIDADES_MUNDO
        .map(c => ({ ...c, distancia: haversine(lat, lng, c.lat, c.lng) }))
        .filter(c => c.distancia <= maxD && c.distancia > 0)
        .sort((a, b) => a.distancia - b.distancia)
        .slice(0, maxC);
}

// ============================================================
// CIDADES PRÓXIMAS — resolvedor UNIVERSAL para todos os tipos de evento
// ============================================================
// Regra importante: o card principal não pode depender da lista fixa de
// grandes centros. O evento pode ser uma enchente, incêndio, ciclone,
// tornado, tempestade, sismo, vulcão, alerta civil etc. — as cidades devem
// ser calculadas SEMPRE a partir das coordenadas do próprio evento.
//
// Estratégia em camadas:
//  1) Photon/OSM: vários lugares próximos, sem chave de API.
//  2) Overpass/OSM: consulta direta por city/town/village/hamlet.
//  3) Worker próprio: usado quando a rede do navegador bloquear CORS.
//  4) CIDADES_MUNDO: reserva final, mas NUNCA apresentada como "tempo real".
//
// Isso também corrige o problema visual visto no card da enchente: quando
// a consulta real falhava, a reserva mostrava apenas grandes centros como
// Nagoya/Tóquio/Osaka, mesmo podendo existir cidades muito menores e mais
// próximas do ponto do evento.
const _cidadesRealCache = new Map();
const _cidadesRealInflight = new Map();
const PHOTON_CITY_URL = 'https://photon.komoot.io/reverse';
const OVERPASS_MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter'
];

function cidadeNormalizada(nome) {
    return String(nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Regras especiais para a capital paulista.
// A busca de cidades é usada em dezenas de tipos de evento; para não deixar
// o geocoder transformar bairros/ocupações em "cidades", mantemos também
// uma trava absoluta para nomes que já apareceram indevidamente no card.
const CIDADES_BLOQUEADAS = new Set([
    'nova helipa',
    'cidade nova heliopolis',
    'nova heliopolis'
]);

const _eventoCidadeAdminCache = new Map();
const _eventoCidadeAdminInflight = new Map();

function cidadeEhBloqueada(nome) {
    return CIDADES_BLOQUEADAS.has(cidadeNormalizada(nome));
}

function dedupeCidades(cidades, maxC = 6, minDistKm = 0) {
    const seen = new Set();
    return (Array.isArray(cidades) ? cidades : [])
        .filter(c => c && c.nome && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)) && Number.isFinite(Number(c.distancia)))
        .filter(c => !cidadeEhBloqueada(c.nome))
        .filter(c => Number(c.distancia) >= Number(minDistKm || 0))
        .sort((a, b) => Number(a.distancia) - Number(b.distancia))
        .filter(c => {
            const key = cidadeNormalizada(c.nome);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, maxC);
}

async function eventoEhNoMunicipioSaoPaulo(lat, lng) {
    const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
    if (_eventoCidadeAdminCache.has(key)) return _eventoCidadeAdminCache.get(key);
    if (_eventoCidadeAdminInflight.has(key)) return _eventoCidadeAdminInflight.get(key);

    const job = (async () => {
        try {
            const u = new URL(PHOTON_CITY_URL);
            u.searchParams.set('lat', lat);
            u.searchParams.set('lon', lng);
            u.searchParams.set('radius', '5');
            u.searchParams.set('limit', '8');
            u.searchParams.set('lang', 'pt');
            const data = await fetchJsonComFallbackCidade(u.toString(), 5000);
            const props = data?.features?.map(f => f?.properties || {}) || [];

            // O que importa aqui é o campo administrativo do próprio ponto,
            // não o nome de bairro retornado como p.name.
            const ehSP = props.some(p => {
                const city = cidadeNormalizada(p.city || p.municipality || p.city_district || '');
                const state = cidadeNormalizada(p.state || '');
                return city === 'sao paulo' && (!state || state === 'sao paulo');
            });

            _eventoCidadeAdminCache.set(key, ehSP);
            return ehSP;
        } catch (e) {
            // Se a identificação administrativa falhar, NÃO aplicamos a regra
            // de 29 km. Isso evita apagar cidades legítimas em outras regiões.
            _eventoCidadeAdminCache.set(key, false);
            return false;
        }
    })();

    _eventoCidadeAdminInflight.set(key, job);
    try { return await job; }
    finally { _eventoCidadeAdminInflight.delete(key); }
}

function extrairNomePhoton(f) {
    const p = f?.properties || {};
    // REGRA ABSOLUTA: só entra no card se o próprio registro OSM disser
    // explicitamente que é place=city ou place=town.
    // Não usamos apenas p.name, porque o Photon pode devolver o nome de um
    // bairro/área residencial mesmo quando a busca é por proximidade.
    const place = String(p.osm_value || p.place || '').toLowerCase().trim();
    const osmKey = String(p.osm_key || '').toLowerCase().trim();
    if (osmKey && osmKey !== 'place') return '';
    if (place !== 'city' && place !== 'town') return '';
    return p.name || p.city || p.town || '';
}

async function fetchJsonComFallbackCidade(url, timeoutMs = 7000) {
    const tentativas = [];
    // Primeiro: direto. Em muitos navegadores/hosts OSM permite CORS e isso
    // evita uma ida desnecessária ao Worker.
    tentativas.push(url);
    // Segundo: Worker próprio. Se o host estiver autorizado no Worker, ele
    // resolve bloqueios de CORS da rede/browser.
    try {
        if (typeof WORKER_PROXY === 'function') tentativas.push(WORKER_PROXY(url));
    } catch (e) {}

    for (const alvo of tentativas) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const r = await fetch(alvo, { signal: controller.signal, headers: { 'Accept': 'application/json' } });
            clearTimeout(timer);
            if (!r.ok) continue;
            const data = await r.json();
            if (data && typeof data === 'object') return data;
        } catch (e) {
            clearTimeout(timer);
        }
    }
    return null;
}

async function getCidadesPhoton(lat, lng, maxC = 8) {
    const u = new URL(PHOTON_CITY_URL);
    u.searchParams.set('lat', lat);
    u.searchParams.set('lon', lng);
    u.searchParams.set('radius', '180');
    u.searchParams.set('limit', String(Math.max(maxC * 4, 20)));
    u.searchParams.set('lang', 'en');
    // IMPORTANTE: o card deve mostrar somente CIDADES.
    // Não aceitar village/hamlet/locality/neighbourhood/district etc.
    ['city', 'town'].forEach(v => u.searchParams.append('osm_tag', `place:${v}`));

    const data = await fetchJsonComFallbackCidade(u.toString(), 7000);
    if (!data || !Array.isArray(data.features)) return null;

    const cidades = data.features.map(f => {
        const coords = f?.geometry?.coordinates;
        const nome = extrairNomePhoton(f);
        if (!Array.isArray(coords) || coords.length < 2 || !nome) return null;
        const elng = Number(coords[0]), elat = Number(coords[1]);
        if (!Number.isFinite(elat) || !Number.isFinite(elng)) return null;
        const p = f.properties || {};
        return {
            nome,
            lat: elat,
            lng: elng,
            pop: Number(p.population) || 0,
            distancia: haversine(lat, lng, elat, elng)
        };
    }).filter(Boolean);

    return dedupeCidades(cidades, maxC);
}

async function getCidadesOverpass(lat, lng, maxC = 8) {
    // SOMENTE city/town. Nunca village, hamlet, locality, neighbourhood,
    // district ou ponto residencial. Isso evita nomes como "Nova Helipa".
    const query = `[out:json][timeout:15];(
        node["place"~"^(city|town)$"](around:180000,${lat},${lng});
        way["place"~"^(city|town)$"](around:180000,${lat},${lng});
        relation["place"~"^(city|town)$"](around:180000,${lat},${lng});
    );out center tags ${Math.max(maxC * 8, 48)};`;

    // Tenta os espelhos em paralelo. O primeiro resultado válido ganha;
    // assim um espelho lento não obriga o usuário a esperar 15 s + 15 s + 15 s.
    const jobs = OVERPASS_MIRRORS.map(base => (async () => {
        const url = base + '?data=' + encodeURIComponent(query);
        const data = await fetchJsonComFallbackCidade(url, 8000);
        if (!data) return null;
        const els = (data.elements || []).filter(e => {
            const tags = e.tags || {};
            const place = String(tags.place || '').toLowerCase();
            const nome = tags['name:pt'] || tags.name;
            const lat0 = typeof e.lat === 'number' ? e.lat : e.center?.lat;
            const lon0 = typeof e.lon === 'number' ? e.lon : e.center?.lon;
            // Defesa dupla: mesmo que o servidor retorne algo fora do filtro,
            // só city/town pode chegar ao card.
            return (place === 'city' || place === 'town') && !!nome && Number.isFinite(lat0) && Number.isFinite(lon0);
        });
        if (!els.length) return null;
        return dedupeCidades(els.map(e => {
            const lat0 = typeof e.lat === 'number' ? e.lat : e.center.lat;
            const lon0 = typeof e.lon === 'number' ? e.lon : e.center.lon;
            return {
                nome: e.tags['name:pt'] || e.tags.name,
                lat: lat0,
                lng: lon0,
                pop: parseInt(e.tags.population, 10) || 0,
                distancia: haversine(lat, lng, lat0, lon0)
            };
        }), maxC);
    })());

    try {
        const result = await Promise.any(jobs.map(p => p.then(v => {
            if (!v || !v.length) throw new Error('sem resultados');
            return v;
        })));
        return result;
    } catch (e) {
        return null;
    }
}

async function getCidadesProximasReal(lat, lng, maxC = 8, minDistKm = 0) {
    const cacheKey = `${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}|${maxC}|${Number(minDistKm || 0)}`;
    if (_cidadesRealCache.has(cacheKey)) return _cidadesRealCache.get(cacheKey);
    if (_cidadesRealInflight.has(cacheKey)) return _cidadesRealInflight.get(cacheKey);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

    const job = (async () => {
        // Na região imediata de São Paulo, usa a lista municipal prioritária.
        // Isso evita que Photon/Overpass devolvam localidades mais distantes
        // por ordem de relevância/resultado, como ocorreu no card.
        if (eventoNaRegiaoImediataSP(lat, lng)) {
            const spPrioritarias = getCidadesSPPrioritarias(lat, lng, maxC, minDistKm);
            if (spPrioritarias.length) {
                _cidadesRealCache.set(cacheKey, spPrioritarias);
                return spPrioritarias;
            }
        }

        // Photon é mais leve para o card e costuma responder rapidamente.
        try {
            const photon = await getCidadesPhoton(lat, lng, maxC);
            const photonFiltrado = dedupeCidades(photon, maxC, minDistKm);
            if (photonFiltrado && photonFiltrado.length) {
                _cidadesRealCache.set(cacheKey, photonFiltrado);
                return photonFiltrado;
            }
        } catch (e) {
            if (typeof dbgLog === 'function') dbgLog('cidades-real: Photon falhou', e?.message || e);
        }

        try {
            const overpass = await getCidadesOverpass(lat, lng, maxC);
            const overpassFiltrado = dedupeCidades(overpass, maxC, minDistKm);
            if (overpassFiltrado && overpassFiltrado.length) {
                _cidadesRealCache.set(cacheKey, overpassFiltrado);
                return overpassFiltrado;
            }
        } catch (e) {
            if (typeof dbgLog === 'function') dbgLog('cidades-real: Overpass falhou', e?.message || e);
        }

        return null;
    })();

    _cidadesRealInflight.set(cacheKey, job);
    try { return await job; }
    finally { _cidadesRealInflight.delete(cacheKey); }
}

async function resolverCidadesProximas(lat, lng, maxC = 8, maxDReserva = 800) {
    // Municípios reais são elegíveis independentemente da distância.
    // Na região imediata de São Paulo existe uma lista municipal prioritária
    // para manter o card consistente; fora dela, a ordenação segue a busca real.
    // A ordenação é sempre pela distância ao ponto do evento; bairros,
    // localidades e ocupações continuam sendo rejeitados pela resolução
    // estrita de place=city/place=town.
    const real = await getCidadesProximasReal(lat, lng, maxC, 0);
    if (real && real.length) return { cidades: real, reserva: false };

    const local = dedupeCidades(
        getCidadesProximas(lat, lng, maxDReserva, maxC),
        maxC,
        0
    );
    return { cidades: local, reserva: true };
}

function renderCidadesHTML(cidades, reserva) {
    const linhas = cidades.length
        ? cidades.map(c => `<div class="city-item"><span class="city-name">🏙️ ${c.nome}</span><span class="city-dist">${Math.round(c.distancia)} km</span>${c.pop ? `<span class="city-pop">${formatarPopulacao(c.pop)}</span>` : ''}</div>`).join('')
        : '<div class="city-item" style="color:#64748b;">Nenhuma localidade encontrada nas proximidades</div>';
    const aviso = reserva
        ? '<div class="city-item" style="color:#facc15;font-size:10px;line-height:1.35;">⚠️ Busca geográfica indisponível — lista de referência exibida.</div>'
        : '<div class="city-item" style="color:#64748b;font-size:9px;line-height:1.3;">📍 Localidades calculadas a partir das coordenadas do evento.</div>';
    return linhas + aviso;
}

