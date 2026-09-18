// =========================================================
// MONITOR GLOBAL — Cloudflare Worker
// Versão 7.6.0 — Telegram diário + vulcanismo global + FUNVISIS + clamp FDSN
// =========================================================

const ALLOWED_HOSTS = [
    'sws.cemaden.gov.br',
    'www.gdacs.org',
    'query1.finance.yahoo.com',
    'stooq.com',
    'wttr.in',
    'api.open-meteo.com',
    'air-quality-api.open-meteo.com',
    'api.weatherapi.com',
    'earthquake.usgs.gov',
    'volcanoes.usgs.gov',
    'www.jma.go.jp',
    'www.data.jma.go.jp',
    'geofon.gfz-potsdam.de',
    'webservices.ingv.it',
    'www.isc.ac.uk',
    'www.seismicportal.eu',
    'www.osc.org.bo',
    'ide.igp.gob.pe',
    'data.bmkg.go.id',
    'api.geonet.org.nz',
    'moho.iag.usp.br',
    'api.orhanaydogdu.com.tr',
    'deprem-api.vercel.app',
    'sismosve.rafnixg.dev', // FUNVISIS (espelho comunitário dos boletins oficiais)
    'www.nhc.noaa.gov',
    'www.tsunami.gov',
    'overpass-api.de',
    'nominatim.openstreetmap.org',
    'api.weather.gov',
    'apiprevmet3.inmet.gov.br',
    'eonet.gsfc.nasa.gov',
    'api.rainviewer.com',
    'api-redemet.decea.mil.br',
    'api-redemet.decea.gov.br',
    'www.cgesp.org',
    'api.allorigins.win',
    'www.bom.gov.au'
];

// Piso real de magnitude e limite máximo por host FDSN. O frontend pede
// minmagnitude=0.1&limit=1000 para todas as agências, mas cada servidor
// tem um teto diferente de cobertura e de linhas. Ajustar aqui evita que
// GEOFON/ISC/INGV devolvam HTTP 400 ("Error 400: ...") para o cliente.
const FDSN_CLAMPS = {
    'geofon.gfz-potsdam.de': { minmagFloor: 3.5, maxLimit: 500 },
    'www.isc.ac.uk':         { minmagFloor: 4.0, maxLimit: 500 },
    'webservices.ingv.it':   { minmagFloor: 1.5, maxLimit: 500 },
    'earthquake.usgs.gov':   { minmagFloor: 0.1, maxLimit: 1000 },
    'www.seismicportal.eu':  { minmagFloor: 0.1, maxLimit: 1000 }
};

function clampFdsnValue(hostname, minmag, limit) {
    const clamp = FDSN_CLAMPS[hostname];
    if (!clamp) return { minmag, limit };
    return {
        minmag: (Number.isFinite(minmag) && minmag < clamp.minmagFloor) ? clamp.minmagFloor : minmag,
        limit:  (Number.isFinite(limit)  && limit  > clamp.maxLimit)    ? clamp.maxLimit    : limit
    };
}

function clampFdsnParams(url) {
    const clamp = FDSN_CLAMPS[url.hostname];
    if (!clamp) return url;
    if (url.pathname.indexOf('/fdsnws/event') < 0) return url;
    const minmag = parseFloat(url.searchParams.get('minmagnitude'));
    const limit  = parseInt(url.searchParams.get('limit'), 10);
    const out = clampFdsnValue(url.hostname, minmag, limit);
    if (Number.isFinite(out.minmag) && out.minmag !== minmag) url.searchParams.set('minmagnitude', String(out.minmag));
    if (Number.isFinite(out.limit)  && out.limit  !== limit)  url.searchParams.set('limit', String(out.limit));
    return url;
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Vary': 'Origin'
};

const SP_COORDS = { lat: -23.55, lon: -46.63 };
const SP_CACHE_TTL = 900;
const GLOBAL_CACHE_TTL = 300;
const V70_CACHE_TTL = 900;
const SP_CACHE_PATH = '/__cache/monitor-global/sp-clima';
const GLOBAL_CACHE_PATH = '/__cache/monitor-global/global-feeds';

let spRefreshPromise = null;
let globalRefreshPromise = null;

const SP_METAR_ICAO = ['SBSP', 'SBGR', 'SBKP', 'SBMT'];


function resposta(body, status = 200, contentType = 'application/json', extra = {}) {
    return new Response(body, {
        status,
        headers: { ...CORS_HEADERS, 'Content-Type': contentType, ...extra }
    });
}

function json(data, status = 200) {
    return resposta(JSON.stringify(data), status, 'application/json');
}

function nowIso() { return new Date().toISOString(); }


async function fetchText(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const r = await fetch(url, { ...options, signal: controller.signal });
        const text = await r.text();
        return { ok: r.ok, status: r.status, text, contentType: r.headers.get('Content-Type') || '' };
    } finally {
        clearTimeout(timer);
    }
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
    const r = await fetchText(url, options, timeoutMs);
    if (!r.ok) throw new Error(`${new URL(url).hostname} ${r.status}`);
    try { return JSON.parse(r.text); }
    catch { throw new Error(`Resposta não-JSON de ${new URL(url).hostname}`); }
}


function cacheKey(request, pathname) {
    const u = new URL(request.url);
    u.pathname = pathname;
    u.search = '';
    return new Request(u.toString(), { method: 'GET' });
}

async function cacheGetJson(request, pathname) {
    try {
        const hit = await caches.default.match(cacheKey(request, pathname));
        if (!hit) return null;
        return await hit.json();
    } catch (e) {
        console.warn('Cache API read:', e?.message || e);
        return null;
    }
}

async function cachePutJson(request, pathname, value, ttl) {
    try {
        const response = new Response(JSON.stringify(value), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${Math.min(ttl, 120)}`,
                'Vary': 'Origin'
            }
        });
        await caches.default.put(cacheKey(request, pathname), response);
    } catch (e) {
        console.warn('Cache API write:', e?.message || e);
    }
}

async function refreshSpClimaCache(request, env) {
    if (!spRefreshPromise) {
        spRefreshPromise = (async () => {
            try {
                const dados = await buscarDadosSP(env);
                await cachePutJson(request, SP_CACHE_PATH, dados, SP_CACHE_TTL);
                return dados;
            } finally {
                spRefreshPromise = null;
            }
        })();
    }
    return spRefreshPromise;
}

async function refreshGlobalFeedsCache(request, env) {
    if (!globalRefreshPromise) {
        globalRefreshPromise = (async () => {
            try {
                const settled = await Promise.all([getNhc(env), getGdacs(), getEonet(), getNws(), getTsunamiAlerts()]);
                const items = settled.flatMap(x => x.items || []).sort((a,b) => (b.time || 0) - (a.time || 0));
                const data = {
                    atualizado_em: nowIso(),
                    fontes: settled.map(x => ({ source: x.source, online: x.ok, error: x.error || null, count: x.items?.length || 0 })),
                    eventos: items.slice(0, 350)
                };
                await cachePutJson(request, GLOBAL_CACHE_PATH, data, GLOBAL_CACHE_TTL);
                return data;
            } finally {
                globalRefreshPromise = null;
            }
        })();
    }
    return globalRefreshPromise;
}


// =========================================================
// SÃO PAULO — Open-Meteo + REDEMET + CGE
// =========================================================

async function buscarOpenMeteoSP() {
    const params = new URLSearchParams({
        latitude: SP_COORDS.lat,
        longitude: SP_COORDS.lon,
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,uv_index,precipitation_probability,wind_speed_10m,wind_gusts_10m,precipitation',
        hourly: 'temperature_2m,precipitation_probability,uv_index,wind_speed_10m,wind_gusts_10m,precipitation',
        forecast_days: '2',
        timezone: 'America/Sao_Paulo'
    });
    const d = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`, {}, 10000);
    const agoraLocalISO = (d.current?.time || '').slice(0, 13);
    let idx = (d.hourly?.time || []).findIndex(t => t.startsWith(agoraLocalISO));
    if (idx < 0) idx = 0;
    const base = idx;
    return {
        atual: {
            temperatura: d.current?.temperature_2m ?? null,
            sensacao: d.current?.apparent_temperature ?? null,
            umidade: d.current?.relative_humidity_2m ?? null,
            uv: d.current?.uv_index ?? null,
            chuva_prob_agora: d.current?.precipitation_probability ?? null,
            chuva_mm: d.current?.precipitation ?? null,
            vento_kmh: d.current?.wind_speed_10m ?? null,
            rajada_kmh: d.current?.wind_gusts_10m ?? null
        },
        previsao_horaria: (d.hourly?.time || []).slice(base, base + 24).map((t, i) => ({
            hora: t.slice(11, 16),
            temp: d.hourly.temperature_2m?.[base + i] ?? null,
            chuva_prob: d.hourly.precipitation_probability?.[base + i] ?? null,
            chuva_mm: d.hourly.precipitation?.[base + i] ?? null,
            uv: d.hourly.uv_index?.[base + i] ?? null,
            vento_kmh: d.hourly.wind_speed_10m?.[base + i] ?? null,
            rajada_kmh: d.hourly.wind_gusts_10m?.[base + i] ?? null
        }))
    };
}

async function buscarMetarSP(env) {
    if (!env.REDEMET_API_KEY) throw new Error('REDEMET_API_KEY não configurada');
    const inicio = new Date(Date.now() - 3600000);
    const agora = new Date();
    const fmt = d => d.toISOString().slice(0, 16).replace('T', '').replace(/[-:]/g, '');
    const alvo = 'https://api-redemet.decea.mil.br/mensagens/metar/' + SP_METAR_ICAO.join(',') +
        '?api_key=' + encodeURIComponent(env.REDEMET_API_KEY) + '&data_ini=' + fmt(inicio) + '&data_fim=' + fmt(agora);
    const d = await fetchJson(alvo, {}, 12000);
    const out = {};
    for (const icao of SP_METAR_ICAO) {
        const item = (d.data?.data || []).find(m => m.icao === icao || m.localidade === icao);
        out[icao] = item ? {
            visibilidade_km: item.visibilidade ?? null,
            condicao: item.condicao_tempo ?? item.mensagem ?? null,
            vento_kt: item.vento_velocidade ?? null,
            raw: item.mensagem ?? null
        } : null;
    }
    return out;
}

function extrairAlagamentosDoHtml(html) {
    let m = html.match(/(\d+)\s*pontos?\s*de\s*alagamentos?\s*(ativos?)?/i);
    if (m) return parseInt(m[1], 10);
    m = html.match(/pontos?\s*de\s*alagamentos?\s*[:\-]?\s*(\d+)\s*ativos?/i);
    if (m) return parseInt(m[1], 10);
    const blobs = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(x => x[1]);
    for (const blob of blobs) {
        const chave = blob.match(/"(alagamentos?_ativos|pontosAlagamento|totalAlagamentos)"\s*:\s*(\d+)/i);
        if (chave) return parseInt(chave[2], 10);
    }
    return null;
}

async function buscarCgeSP() {
    for (const url of ['https://www.cgesp.org/v3/alagamentos.jsp', 'https://www.cgesp.org/v3/']) {
        try {
            const r = await fetchText(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,application/xhtml+xml' } }, 9000);
            if (!r.ok) continue;
            const ativos = extrairAlagamentosDoHtml(r.text);
            if (ativos == null) continue;
            return { status: ativos > 3 ? 'crise' : ativos > 0 ? 'atencao' : 'normal', alagamentos_ativos: ativos, fonte: url };
        } catch {}
    }
    return { status: 'indisponivel', alagamentos_ativos: null };
}

async function buscarDadosSP(env) {
    const [openMeteo, metar, cge] = await Promise.allSettled([buscarOpenMeteoSP(), buscarMetarSP(env), buscarCgeSP()]);
    return {
        cidade: 'São Paulo',
        coordenadas: SP_COORDS,
        atualizado_em: nowIso(),
        atual: openMeteo.status === 'fulfilled' ? openMeteo.value.atual : null,
        previsao_horaria: openMeteo.status === 'fulfilled' ? openMeteo.value.previsao_horaria : [],
        aeroportos_metar: metar.status === 'fulfilled' ? metar.value : {},
        cge: cge.status === 'fulfilled' ? cge.value : { status: 'indisponivel', alagamentos_ativos: null },
        fontes: {
            open_meteo: openMeteo.status === 'fulfilled',
            redemet: metar.status === 'fulfilled',
            cge: cge.status === 'fulfilled'
        }
    };
}

async function handleSpClima(request, env) {
    const cached = await cacheGetJson(request, SP_CACHE_PATH);
    if (cached) return resposta(JSON.stringify(cached), 200, 'application/json; charset=utf-8', {
        'Cache-Control': `public, max-age=${SP_CACHE_TTL}, s-maxage=${SP_CACHE_TTL}, stale-while-revalidate=120`
    });
    const dados = await refreshSpClimaCache(request, env);
    return resposta(JSON.stringify(dados), 200, 'application/json; charset=utf-8', {
        'Cache-Control': `public, max-age=${SP_CACHE_TTL}, s-maxage=${SP_CACHE_TTL}, stale-while-revalidate=120`
    });
}


// =========================================================
// FEEDS GLOBAIS — triagem, não substituem alertas oficiais
// =========================================================

function xmlItems(xml, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    return [...xml.matchAll(re)].map(m => m[1]);
}
function xmlTag(block, tag) {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : null;
}
function parseRss(xml, source, type = 'alert') {
    const blocks = xmlItems(xml, 'item');
    return blocks.slice(0, 100).map((b, i) => ({
        id: `${source}-${i}-${xmlTag(b, 'guid') || xmlTag(b, 'pubDate') || ''}`.slice(0, 180),
        source,
        type,
        title: xmlTag(b, 'title') || 'Evento',
        description: xmlTag(b, 'description') || '',
        link: xmlTag(b, 'link') || null,
        time: Date.parse(xmlTag(b, 'pubDate') || '') || Date.now()
    }));
}

async function getNhc(env) {
    const urls = [
        'https://www.nhc.noaa.gov/gis/forecast/archive/atl/latest/track_latest.xml',
        'https://www.nhc.noaa.gov/index-at.xml'
    ];
    for (const u of urls) {
        try {
            const r = await fetchText(u, { headers: { 'User-Agent': 'MonitorGlobal/6.1' } }, 12000);
            if (r.ok) return { source: 'NHC', ok: true, items: parseRss(r.text, 'NHC', 'cyclone') };
        } catch {}
    }
    return { source: 'NHC', ok: false, items: [], error: 'feed indisponível' };
}

async function getGdacs() {
    const urls = [
        'https://www.gdacs.org/xml/rss.xml',
        'https://www.gdacs.org/rss.aspx'
    ];
    for (const u of urls) {
        try {
            const r = await fetchText(u, { headers: { 'User-Agent': 'MonitorGlobal/6.1', 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' } }, 12000);
            if (r.ok) return { source: 'GDACS', ok: true, items: parseRss(r.text, 'GDACS', 'disaster') };
        } catch {}
    }
    return { source: 'GDACS', ok: false, items: [], error: 'feed indisponível' };
}

async function getEonet() {
    try {
        const d = await fetchJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100', {}, 12000);
        const items = (d.events || []).map(e => ({
            id: `EONET-${e.id}`,
            source: 'EONET',
            type: 'natural-event',
            title: e.title || 'Evento natural',
            description: (e.categories || []).map(c => c.title).join(', '),
            link: e.link || null,
            time: Date.parse(e.geometry?.[e.geometry.length - 1]?.date || e.closed || '') || Date.now(),
            categories: (e.categories || []).map(c => c.title),
            geometry: e.geometry?.[e.geometry.length - 1]?.coordinates || null
        }));
        return { source: 'EONET', ok: true, items };
    } catch (e) { return { source: 'EONET', ok: false, items: [], error: e.message }; }
}

async function getTsunamiAlerts() {
    const urls = [
        'https://www.tsunami.gov/events/xml/PHEBAtom.xml',
        'https://www.tsunami.gov/events/xml/PAAQAtom.xml'
    ];
    const out = [];
    for (const u of urls) {
        try {
            const r = await fetchText(u, { headers: { 'User-Agent': 'MonitorGlobal/6.1', 'Accept': 'application/atom+xml,application/xml,text/xml,*/*' } }, 12000);
            if (!r.ok) continue;
            const blocks = xmlItems(r.text, 'entry');
            for (const b of blocks.slice(0, 50)) {
                const title = xmlTag(b, 'title') || 'Aviso de tsunami';
                const summary = xmlTag(b, 'summary') || xmlTag(b, 'content') || '';
                const updated = xmlTag(b, 'updated') || xmlTag(b, 'published') || '';
                const id = xmlTag(b, 'id') || `${u}-${updated}-${title}`;
                const linkMatch = b.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
                out.push({
                    id: `TS-${id}`.slice(0, 200),
                    source: u.includes('PHEB') ? 'PTWC' : 'NTWC',
                    type: 'tsunami',
                    title: title.replace(/\s+/g, ' ').trim(),
                    description: summary.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
                    link: linkMatch ? linkMatch[1] : 'https://www.tsunami.gov/',
                    time: Date.parse(updated) || Date.now()
                });
            }
        } catch {}
    }
    return { source: 'TSUNAMI-GOV', ok: out.length > 0, items: out, error: out.length ? null : 'feeds indisponíveis' };
}

async function getNws() {
    try {
        const d = await fetchJson('https://api.weather.gov/alerts/active', { headers: { 'User-Agent': 'MonitorGlobal/6.1 contact@example.invalid', 'Accept': 'application/geo+json' } }, 12000);
        const items = (d.features || []).slice(0, 200).map(f => ({
            id: `NWS-${f.id || Math.random()}`,
            source: 'NWS',
            type: 'weather-alert',
            title: f.properties?.event || 'Alerta meteorológico',
            description: f.properties?.headline || f.properties?.description || '',
            link: f.properties?.web || f.properties?.id || null,
            time: Date.parse(f.properties?.effective || f.properties?.sent || '') || Date.now(),
            severity: f.properties?.severity || null,
            area: f.properties?.areaDesc || null
        }));
        return { source: 'NWS', ok: true, items };
    } catch (e) { return { source: 'NWS', ok: false, items: [], error: e.message }; }
}

async function getGlobalFeeds(request, env) {
    const cached = await cacheGetJson(request, GLOBAL_CACHE_PATH);
    if (cached) return cached;
    return refreshGlobalFeedsCache(request, env);
}

function calculateGlobalRisk(feeds) {
    const items = feeds?.eventos || [];
    let score = 0;
    const reasons = [];
    for (const e of items) {
        const title = `${e.title || ''} ${e.description || ''}`.toLowerCase();
        if (/tsunami/.test(title)) { score = Math.max(score, 95); reasons.push('tsunami'); }
        else if (/hurricane|typhoon|cyclone|furac/.test(title)) { score = Math.max(score, 70); reasons.push('ciclone'); }
        else if (/major|extreme|warning|severe|tornado/.test(title)) { score = Math.max(score, 55); reasons.push('alerta severo'); }
        else if (/wildfire|fire/.test(title)) score = Math.max(score, 35);
    }
    const level = score >= 85 ? 'CRÍTICO' : score >= 65 ? 'ALTO' : score >= 40 ? 'ATENÇÃO' : 'NORMAL';
    return { level, score, reasons: [...new Set(reasons)].slice(0,5) };
}

function normText(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseAtomEntries(xml) {
    return xmlItems(xml, 'entry').map(b => ({
        title: xmlTag(b, 'title') || '',
        description: (xmlTag(b, 'summary') || xmlTag(b, 'content') || '').replace(/<[^>]+>/g, ' '),
        time: Date.parse(xmlTag(b, 'updated') || xmlTag(b, 'published') || '') || Date.now()
    }));
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, rad = Math.PI / 180;
    const dLat = (lat2-lat1)*rad, dLon = (lon2-lon1)*rad;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(a));
}

async function queryUsGeoRegions(lat, lon) {
    const u = `https://earthquake.usgs.gov/ws/geoserve/regions.json?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&type=offshore,tectonic`;
    try { return await fetchJson(u, {}, 9000); } catch { return null; }
}

async function queryNearbyPlaces(lat, lon) {
    const u = `https://earthquake.usgs.gov/ws/geoserve/places.json?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&maxradiuskm=300&limit=8&type=geonames&minpopulation=10000`;
    try { return await fetchJson(u, {}, 9000); } catch { return null; }
}

async function getOfficialTsunamiCorrelation(lat, lon) {
    const alerts = await getTsunamiAlerts();
    const now = Date.now();
    const fresh = (alerts.items || []).filter(x => now - (x.time || now) < 24*3600000);
    const candidates = fresh.map(x => {
        const t = normText(`${x.title} ${x.description}`);
        let regionMatch = false;
        if (Math.abs(lat) > 0 && (t.includes('pacific') || t.includes('hawaii') || t.includes('alaska') || t.includes('caribbean') || t.includes('japan') || t.includes('indonesia') || t.includes('chile') || t.includes('peru'))) regionMatch = true;
        return { ...x, regionMatch };
    });
    const relevant = candidates.filter(x => x.regionMatch || /warning|advisory|watch|tsunami/.test(normText(`${x.title} ${x.description}`)));
    return { online: alerts.ok, alerts: relevant.slice(0, 12) };
}

async function handleCorrelation(reqUrl, env) {
    const mag = Number(reqUrl.searchParams.get('mag'));
    const depth = Number(reqUrl.searchParams.get('depth'));
    const lat = Number(reqUrl.searchParams.get('lat'));
    const lon = Number(reqUrl.searchParams.get('lon'));
    const place = reqUrl.searchParams.get('place') || '';
    if (![mag, depth, lat, lon].every(Number.isFinite)) return json({ error: 'Parâmetros obrigatórios: mag, depth, lat, lon' }, 400);

    const [regions, places, official] = await Promise.all([
        queryUsGeoRegions(lat, lon),
        queryNearbyPlaces(lat, lon),
        getOfficialTsunamiCorrelation(lat, lon)
    ]);

    const offshoreText = JSON.stringify(regions || {}).toLowerCase();
    const placeText = normText(place);
    const offshore = /offshore|ocean|sea|oceano|mar|off the coast|coast|costa/.test(placeText) || /offshore/.test(offshoreText);
    const shallow = depth <= 30;
    const intermediateShallow = depth <= 70;
    const officialCount = official.alerts.length;
    const nearby = places?.geonames || places?.geonames?.features || places?.event || [];
    const nearest = Array.isArray(nearby) ? nearby.map(x => x.properties || x).filter(x => Number.isFinite(Number(x.distance))).sort((a,b)=>Number(a.distance)-Number(b.distance))[0] : null;

    let score = 0;
    const factors = [];
    if (mag >= 7.0) { score += 45; factors.push('M≥7.0'); }
    else if (mag >= 6.5) { score += 35; factors.push('M≥6.5'); }
    else if (mag >= 6.0) { score += 25; factors.push('M≥6.0'); }
    else if (mag >= 5.5) { score += 15; factors.push('M≥5.5'); }
    if (offshore) { score += 25; factors.push('ambiente oceânico/costeiro'); }
    if (shallow) { score += 20; factors.push('foco muito raso'); }
    else if (intermediateShallow) { score += 10; factors.push('foco raso'); }
    if (officialCount > 0) { score += 45; factors.push('aviso oficial de tsunami encontrado'); }

    let level = 'BAIXO';
    if (officialCount > 0) level = 'ALERTA OFICIAL';
    else if (score >= 75) level = 'ALTO';
    else if (score >= 50) level = 'MODERADO';
    else if (score >= 30) level = 'ATENÇÃO';

    const action = officialCount > 0
        ? 'Há produto oficial de tsunami relacionado; consultar imediatamente a autoridade competente.'
        : level === 'ALTO'
        ? 'Possibilidade automática elevada. Não é confirmação de tsunami; aguardar produto oficial.'
        : level === 'MODERADO'
        ? 'Condições parcialmente compatíveis. Monitoramento reforçado; não equivale a alerta.'
        : 'Critérios automáticos não indicam risco elevado de tsunami.';

    return json({
        ok: true,
        engine: 'correlacao-inteligente-1.0',
        evento: { mag, depth, lat, lon, place },
        tsunami: {
            level, score: Math.min(100, score),
            offshore, shallow, intermediateShallow,
            officialAlerts: official.alerts,
            officialOnline: official.online,
            nearestPlaceKm: nearest ? Number(nearest.distance) : null,
            nearestPlace: nearest?.name || null,
            factors, action,
            disclaimer: 'Análise automática de triagem. Não substitui alertas oficiais nem avaliação sismológica/oceanográfica.'
        },
        consultado_em: nowIso()
    });
}


// =========================================================
// MONITOR GLOBAL 7.0 — extremos térmicos, anomalia, ciclones e impacto
// =========================================================

const V70_POINTS = [
    ['Phoenix',33.45,-112.07],['Las Vegas',36.17,-115.14],['Miami',25.76,-80.19],['Mexico City',19.43,-99.13],
    ['Brasília',-15.79,-47.88],['São Paulo',-23.55,-46.63],['Manaus',-3.10,-60.02],['Buenos Aires',-34.60,-58.38],
    ['Santiago',-33.45,-70.67],['Lima',-12.05,-77.04],['Bogotá',4.71,-74.07],['Quito',-0.18,-78.47],
    ['Reykjavik',64.15,-21.94],['London',51.51,-0.13],['Madrid',40.42,-3.70],['Cairo',30.04,31.24],
    ['Lagos',6.52,3.38],['Nairobi',-1.29,36.82],['Cape Town',-33.93,18.42],['Moscow',55.76,37.62],
    ['Dubai',25.20,55.27],['New Delhi',28.61,77.21],['Mumbai',19.08,72.88],['Bangkok',13.76,100.50],
    ['Singapore',1.35,103.82],['Tokyo',35.68,139.65],['Seoul',37.57,126.98],['Beijing',39.90,116.41],
    ['Sydney',-33.87,151.21],['Melbourne',-37.81,144.96],['Perth',-31.95,115.86],['Jakarta',-6.21,106.85],
    ['Auckland',-36.85,174.76],['Honolulu',21.31,-157.86],['Anchorage',61.22,-149.90],['Fairbanks',64.84,-147.72],
    ['Ulaanbaatar',47.92,106.92],['Helsinki',60.17,24.94],['Oslo',59.91,10.75],['Nuuk',64.18,-51.72]
];

const V70_ANOMALY_POINTS = [
    ['North America',40.0,-100.0],['South America',-15.0,-60.0],['Europe',50.0,10.0],['North Africa',25.0,10.0],
    ['East Africa',0.0,35.0],['Middle East',25.0,50.0],['South Asia',22.0,78.0],['East Asia',35.0,115.0],
    ['Southeast Asia',5.0,105.0],['Australia',-25.0,135.0],['Pacific',15.0,-150.0],['Arctic',70.0,20.0]
];

function v70Avg(a){const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null;}

async function getV70Extremes(env){
    const lat=V70_POINTS.map(x=>x[1]).join(','), lon=V70_POINTS.map(x=>x[2]).join(',');
    const u=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=UTC`;
    const d=await fetchJson(u,{},15000); const arr=Array.isArray(d)?d:[d];
    const rows=arr.map((x,i)=>({city:V70_POINTS[i][0],lat:V70_POINTS[i][1],lon:V70_POINTS[i][2],max:x.daily?.temperature_2m_max?.[0]??null,min:x.daily?.temperature_2m_min?.[0]??null})).filter(x=>x.max!=null||x.min!=null);
    return {updatedAt:nowIso(), disclaimer:'Extremos entre pontos de referência monitorados; não representam uma busca exaustiva de todas as estações do planeta.',hottest:[...rows].sort((a,b)=>(b.max??-999)-(a.max??-999)).slice(0,8),coldest:[...rows].sort((a,b)=>(a.min??999)-(b.min??999)).slice(0,8)};
}

function doy(d){const y=d.getUTCFullYear();return Math.floor((Date.UTC(y,d.getUTCMonth(),d.getUTCDate())-Date.UTC(y,0,0))/86400000);}

async function getV70Anomaly(env){
    const today=new Date(), endYear=today.getUTCFullYear()-1;
    const start=`1991-01-01`, end=`${endYear}-12-31`;
    const lat=V70_ANOMALY_POINTS.map(x=>x[1]).join(','), lon=V70_ANOMALY_POINTS.map(x=>x[2]).join(',');
    const hist=`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=temperature_2m_mean&timezone=UTC`;
    const cur=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=UTC`;
    const [h,c]=await Promise.all([fetchJson(hist,{},25000),fetchJson(cur,{},15000)]); const ha=Array.isArray(h)?h:[h], ca=Array.isArray(c)?c:[c];
    const target=doy(today), rows=[];
    ha.forEach((x,i)=>{const vals=[], ts=x.daily?.time||[], vs=x.daily?.temperature_2m_mean||[]; for(let j=0;j<ts.length;j++){const dt=new Date(ts[j]+'T00:00:00Z'), dd=doy(dt), diff=Math.min(Math.abs(dd-target),365-Math.abs(dd-target)); if(diff<=7 && Number.isFinite(vs[j])) vals.push(vs[j]);} const normal=v70Avg(vals), current=ca[i]?.current?.temperature_2m; if(Number.isFinite(normal)&&Number.isFinite(current)) rows.push({name:V70_ANOMALY_POINTS[i][0],lat:V70_ANOMALY_POINTS[i][1],lon:V70_ANOMALY_POINTS[i][2],current,normal,anomaly:current-normal});});
    return {updatedAt:nowIso(),period:'1991–'+endYear,window:'média histórica de ±7 dias ao redor da data atual',rows,disclaimer:'Anomalia baseada em reanálise histórica do Open-Meteo/ERA5 e condições atuais de modelo; é indicativa, não uma medição de estação.'};
}

async function getV70Cyclones(){
    const d=await fetchJson('https://www.nhc.noaa.gov/CurrentStorms.json',{headers:{'User-Agent':'MonitorGlobal/7.0'}},15000);
    const storms=(d.activeStorms||[]).map(s=>({id:s.id,name:s.name,classification:s.classification,intensity:Number(s.intensity),pressure:Number(s.pressure),lat:Number(s.latitudeNumeric),lon:Number(s.longitudeNumeric),movementDir:Number(s.movementDir),movementSpeed:Number(s.movementSpeed),updated:s.lastUpdate,track:s.forecastTrack?.kmzFile||null,cone:s.trackCone?.kmzFile||null,advisory:s.publicAdvisory?.url||null,graphics:s.forecastGraphics?.url||null}));
    return {updatedAt:nowIso(),source:'NHC',storms,sourceNote:'Dados oficiais do National Hurricane Center; trajetória e cone são os produtos GIS do NHC.'};
}

async function getV70Impact(lat,lon){
    const placesU=`https://earthquake.usgs.gov/ws/geoserve/places.json?latitude=${lat}&longitude=${lon}&maxradiuskm=100&minpopulation=1000&type=event`;
    const places=await fetchJson(placesU,{},12000); const arr=places?.event?.features||[];
    const sorted=arr.map(f=>({name:f.properties?.name||f.properties?.country_name||'Localidade',country:f.properties?.country_name||'',population:Number(f.properties?.population)||0,distance:Number(f.properties?.distance)||null,lat:f.geometry?.coordinates?.[1],lon:f.geometry?.coordinates?.[0]})).sort((a,b)=>(a.distance??999)-(b.distance??999));
    let hospitals=[];
    try{
        const q=`[out:json][timeout:12];(nwr[amenity=hospital](around:50000,${lat},${lon}););out center tags;`;
        const r=await fetchText('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(q),{'headers':{'User-Agent':'MonitorGlobal/7.0'}},15000);
        if(r.ok){const od=JSON.parse(r.text); hospitals=(od.elements||[]).slice(0,20).map(e=>({name:e.tags?.name||'Hospital',lat:e.lat??e.center?.lat,lon:e.lon??e.center?.lon,type:e.tags?.emergency||''})).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));}
    }catch{}
    return {updatedAt:nowIso(),places:sorted.slice(0,12),populationEstimate:sorted.reduce((s,x)=>s+(x.population||0),0),hospitals,disclaimer:'População é a soma das localidades retornadas pelo USGS/GeoNames e não equivale a uma estimativa censitária de população exposta. Hospitais vêm do OpenStreetMap/Overpass e podem estar incompletos.'};
}

async function handleV70Extremes(){return json(await getV70Extremes());}
async function handleV70Anomaly(){return json(await getV70Anomaly());}
async function handleV70Cyclones(){return json(await getV70Cyclones());}
async function handleV70Impact(reqUrl){const lat=Number(reqUrl.searchParams.get('lat')),lon=Number(reqUrl.searchParams.get('lon')); if(!Number.isFinite(lat)||!Number.isFinite(lon)) return json({error:'lat/lon inválidos'},400); return json(await getV70Impact(lat,lon));}


// =========================================================
// VULCANISMO — USGS VHP + VONA + GDACS (versão consolidada)
// =========================================================

function arrOf(x, keys = []) {
    if (Array.isArray(x)) return x;
    if (!x || typeof x !== 'object') return [];
    for (const k of keys) if (Array.isArray(x[k])) return x[k];
    return [];
}
function normVolcanoName(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function volcanoColor(v) {
    const s = String(v || '').toUpperCase().trim();
    return /^(GREEN|YELLOW|ORANGE|RED)$/.test(s) ? s : '';
}
function volcanoAlert(v) {
    const s = String(v || '').toUpperCase().trim();
    return /^(NORMAL|UNASSIGNED|ADVISORY|WATCH|WARNING)$/.test(s) ? s : '';
}
function volcanoElevated(color, alert) {
    return /^(YELLOW|ORANGE|RED)$/.test(color) || /^(ADVISORY|WATCH|WARNING)$/.test(alert);
}
function volcanoObs(v) {
    const m={avo:'Alaska Volcano Observatory',calvo:'Cascades Volcano Observatory',cvo:'Cascades Volcano Observatory',hvo:'Hawaiian Volcano Observatory',nmi:'Northern Mariana Islands Volcano Observatory',yvo:'Yellowstone Volcano Observatory'};
    const s=String(v||'').trim(); return m[s.toLowerCase()] || s || 'USGS Volcano Hazards Program';
}
function volcanoTs(v) {
    if (v == null || v === '') return 0;
    const n=Number(v); if (Number.isFinite(n)) return n < 1e12 ? n*1000 : n;
    const t=Date.parse(String(v)); return Number.isFinite(t) ? t : 0;
}
function volcanoReport(p, extra={}) {
    const lat=Number(p?.lat ?? p?.latitude), lon=Number(p?.long ?? p?.lng ?? p?.longitude);
    const name=String(p?.vName ?? p?.volcanoName ?? p?.name ?? '').trim();
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const color=volcanoColor(p?.colorCode ?? p?.aviationColor ?? extra.aviationColor);
    const alert=volcanoAlert(p?.alertLevel ?? extra.alertLevel);
    const last=p?.alertDate ?? p?.colorDate ?? extra.lastActivity ?? extra.sentUtc ?? null;
    return {
        name, vnum:String(p?.vnum ?? p?.volcanoNumber ?? extra.vnum ?? ''), coords:[lon,lat],
        aviationColor:color, alertLevel:alert, elevated:Boolean(extra.elevated || volcanoElevated(color,alert) || extra.hasVona),
        observatory:volcanoObs(p?.obs ?? p?.observatory ?? extra.observatory),
        volcanoUrl:p?.vUrl ?? p?.volcanoUrl ?? extra.volcanoUrl ?? '',
        detail:p?.noticeSynopsis ?? p?.status ?? p?.description ?? extra.detail ?? 'Status do USGS Volcano Hazards Program',
        lastActivity:last || '', noticeId:p?.noticeId ?? extra.noticeId ?? '',
        usgsUrl:extra.usgsUrl || '', time:volcanoTs(last) || Date.now(),
        hasVona:Boolean(extra.hasVona), usgsVona:extra.usgsVona || null,
        ashStatus:extra.ashStatus || '', ashHeight:extra.ashHeight || '', ashSource:extra.ashSource || '',
        vonaRemarks:extra.vonaRemarks || '', vonaMovement:extra.vonaMovement || '', vonaDuration:extra.vonaDuration || '',
        eruptionStatus:extra.eruptionStatus || (volcanoElevated(color,alert) ? 'Atividade elevada / monitorada' : 'Estado de fundo / não elevado')
    };
}

async function getUsgsVolcanoProfessional() {
    const settled = await Promise.allSettled([
        fetchJson('https://volcanoes.usgs.gov/vsc/api/volcanoApi/vhpstatus', {}, 15000),
        fetchJson('https://volcanoes.usgs.gov/vsc/api/volcanoApi/elevated', {}, 15000),
        fetchJson('https://volcanoes.usgs.gov/vsc/api/hansApi/vonas/30', {}, 15000)
    ]);
    const [statusResult, elevatedResult, vonaResult] = settled;
    const statusRaw = statusResult.status === 'fulfilled' ? statusResult.value : null;
    const elevatedRaw0 = elevatedResult.status === 'fulfilled' ? elevatedResult.value : null;
    const vonaRaw = vonaResult.status === 'fulfilled' ? vonaResult.value : null;
    const falhas = settled.filter(s => s.status === 'rejected').map(s => s.reason?.message || String(s.reason));

    if (statusResult.status === 'rejected' && elevatedResult.status === 'rejected' && vonaResult.status === 'rejected') {
        throw new Error('USGS VHP/VONA indisponível: ' + falhas.join(' | '));
    }

    const status=arrOf(statusRaw,['volcanoes','data']);
    const elevated=arrOf(elevatedRaw0,['volcanoes','data','elevated']);
    const vonas=arrOf(vonaRaw,['vonas','data']);
    const byV=new Map(), byN=new Map();

    for (const p of status) {
        const r=volcanoReport(p);
        if (!r) continue;
        byV.set(r.vnum || 'n:'+normVolcanoName(r.name), r);
        byN.set(normVolcanoName(r.name), r);
    }
    for (const p of elevated) {
        const r=volcanoReport(p,{elevated:true});
        if (!r) continue;
        const base=(r.vnum && byV.get(r.vnum)) || byN.get(normVolcanoName(r.name));
        if (base) Object.assign(base,r,{elevated:true});
        else { byV.set(r.vnum || 'n:'+normVolcanoName(r.name),r); byN.set(normVolcanoName(r.name),r); }
    }
    for (const n of vonas) {
        const name=String(n?.vName ?? n?.volcanoName ?? n?.volcano_name ?? n?.name ?? '').trim();
        const vnum=String(n?.vnum ?? n?.volcanoNumber ?? n?.volcano_number ?? '').trim();
        const base=(vnum && byV.get(vnum)) || byN.get(normVolcanoName(name));
        if (!base) continue;
        const sent=n?.sentUtc ?? n?.sent ?? n?.issued ?? n?.date ?? '';
        const t=volcanoTs(sent);
        if (!base._vonaTs || t >= base._vonaTs) {
            base.hasVona=true; base.elevated=true; base.usgsVona=n; base.noticeId=n?.noticeId || base.noticeId;
            base.usgsUrl=n?.noticeUrl || n?.noticeUrl || '';
            base.lastActivity=sent || base.lastActivity; base.time=t || base.time;
            base.detail=n?.noticeSynopsis || n?.summary || n?.description || base.detail;
            base.aviationColor=volcanoColor(n?.colorCode) || base.aviationColor;
            base.alertLevel=volcanoAlert(n?.alertLevel) || base.alertLevel;
            base._vonaTs=t;
        }
    }

    const all=[...new Set([...byV.values()])].map(r=>{ delete r._vonaTs; return r; });
    const elevatedFinal=all.filter(r=>r.elevated || r.hasVona);

    return {ok:true,source:'USGS Volcano Hazards Program',updatedAt:nowIso(),all,elevated:elevatedFinal,parcial:falhas.length>0,falhas:falhas.length?falhas:undefined};
}


function parseVolcanoAdvisoryText(text, source) {
    const out = [];
    const blocks = String(text || '').split(/(?=VA ADVISORY\b)/i);
    for (const block of blocks) {
        if (!/VA ADVISORY/i.test(block)) continue;
        const get = re => { const m = block.match(re); return m ? m[1].trim() : ''; };
        const rawName = get(/VOLCANO:\s*([^\r\n]+)/i);
        const name = rawName.replace(/\s+\d{6,}$/, '').trim();
        const vnum = (rawName.match(/\b(\d{6})\b/) || [,''])[1];
        const psn = get(/PSN:\s*([^\r\n]+)/i);
        const area = get(/AREA:\s*([^\r\n]+)/i);
        const adv = get(/ADVISORY NR:\s*([^\r\n]+)/i);
        const dtg = get(/DTG:\s*([0-9]{8}\/[0-9]{4}Z)/i);
        const eruption = get(/ERUPTION DETAILS:\s*([^\r\n]+)/i);
        let lat = NaN, lon = NaN;
        const pm = psn.match(/([NS])(\d{2})(\d{2})\s+([EW])(\d{3})(\d{2})/i);
        if (pm) {
            lat = (Number(pm[2]) + Number(pm[3]) / 60) * (pm[1].toUpperCase() === 'S' ? -1 : 1);
            lon = (Number(pm[5]) + Number(pm[6]) / 60) * (pm[4].toUpperCase() === 'W' ? -1 : 1);
        }
        let time = 0;
        const dm = dtg.match(/^(\d{4})(\d{2})(\d{2})\/(\d{2})(\d{2})Z$/);
        if (dm) time = Date.UTC(+dm[1], +dm[2]-1, +dm[3], +dm[4], +dm[5]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            const key = normVolcanoName(name);
            const known = {
                'sakurajima aira caldera':[31.593,130.657],
                'sakurajima':[31.593,130.657],
                'mayon':[13.257,123.685],
                'kanlaon':[10.412,123.132],
                'asosan':[32.884,131.104],
                'suwanosejima':[29.638,129.714],
                'kirishima':[31.934,130.862]
            }[key];
            if (known) { lat=known[0]; lon=known[1]; }
        }
        if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        out.push({
            id: `vaac-${source}-${adv || name}-${time || Date.now()}`.replace(/\s+/g,'-'),
            type: 'volcano', name, vnum, coords:[lon,lat],
            source:`VAAC ${source}`, area, advisory:adv, time:time || Date.now(),
            detail:eruption || 'Aviso de cinzas vulcânicas',
            ashStatus:eruption || 'Aviso de cinzas vulcânicas',
            aviationColor:'', alertLevel:'WARNING', elevated:true
        });
    }
    return out;
}

async function getGlobalVolcanoAdvisories() {
    const settled = await Promise.allSettled([
        fetchText('https://www.bom.gov.au/products/Volc_ash_latest.shtml',
            {headers:{'User-Agent':'MonitorGlobal/7.6','Accept':'text/html,*/*'}}, 15000),
        fetchText('https://www.data.jma.go.jp/vaac/data/vaac_list.html',
            {headers:{'User-Agent':'MonitorGlobal/7.6','Accept':'text/html,*/*'}}, 15000)
    ]);
    const items = [];
    const errors = [];

    if (settled[0].status === 'fulfilled' && settled[0].value.ok) {
        const txt = settled[0].value.text.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ');
        items.push(...parseVolcanoAdvisoryText(txt,'DARWIN'));
    } else errors.push('Darwin VAAC indisponível');

    if (settled[1].status === 'fulfilled' && settled[1].value.ok) {
        const html = settled[1].value.text;
        const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>m[1]);
        for (const row of rows) {
            const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
                .map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
            if (cells.length < 3) continue;
            const date = cells[0].match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
            const name = cells[1].trim();
            const area = cells[2].trim();
            if (!date || !name || !area) continue;
            const time = Date.UTC(+date[1],+date[2]-1,+date[3],+date[4],+date[5],+(date[6]||0));
            // Tokyo VAAC é especialmente importante para Japão e Pacífico ocidental.
            if (!/japan|philippines|kuril|russia|taiwan/i.test(area)) continue;
            items.push({
                id:`vaac-TOKYO-${name}-${time}`.replace(/\s+/g,'-'),
                type:'volcano', name, vnum:'', coords:[NaN,NaN],
                source:'VAAC TOKYO', area, advisory:cells[3]||'', time,
                detail:'Volcanic Ash Advisory (Tokyo VAAC)',
                ashStatus:'Aviso de cinzas vulcânicas', aviationColor:'',
                alertLevel:'WARNING', elevated:true
            });
        }
    } else errors.push('Tokyo VAAC indisponível');

    return {ok:items.length>0,source:'VAAC global',updatedAt:nowIso(),items,errors};
}

async function handleGlobalVolcanoAdvisories() {
    try { return json(await getGlobalVolcanoAdvisories()); }
    catch(e) { return json({ok:false,source:'VAAC global',error:e.message,updatedAt:nowIso(),items:[]},502); }
}

async function handleUsgsVolcano() {
    try { return json(await getUsgsVolcanoProfessional()); }
    catch(e) { return json({ok:false,source:'USGS Volcano Hazards Program',error:e.message,updatedAt:nowIso(),all:[],elevated:[]},502); }
}

async function handleGdacsVolcano() {
    try {
        const u='https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=VO&fromdate='+encodeURIComponent(new Date(Date.now()-30*864e5).toISOString().slice(0,10))+'&todate='+encodeURIComponent(new Date().toISOString().slice(0,10));
        const d=await fetchJson(u,{'headers':{'User-Agent':'MonitorGlobal/7.1','Accept':'application/geo+json,application/json,*/*'}},15000);
        return json({ok:true,source:'GDACS',updatedAt:nowIso(),features:d?.features || (Array.isArray(d)?d:[])});
    } catch(e) { return json({ok:false,source:'GDACS',error:e.message,updatedAt:nowIso(),features:[]},502); }
}

function parseGdacsFloodRss(xml) {
    const items = xmlItems(xml, 'item');
    return items.map(b => {
        const geoBlock = (b.match(/<geo:Point>([\s\S]*?)<\/geo:Point>/i) || [])[1] || '';
        const lat = parseFloat(xmlTag(geoBlock, 'geo:lat'));
        const lon = parseFloat(xmlTag(geoBlock, 'geo:long'));
        const iscurrentRaw = (xmlTag(b, 'gdacs:iscurrent') || '').toLowerCase();
        return {
            title: xmlTag(b, 'title') || '',
            description: xmlTag(b, 'description') || '',
            link: xmlTag(b, 'link') || null,
            country: xmlTag(b, 'gdacs:country') || '',
            iso3: xmlTag(b, 'gdacs:iso3') || '',
            alertlevel: xmlTag(b, 'gdacs:alertlevel') || '',
            iscurrent: iscurrentRaw === 'true',
            eventid: xmlTag(b, 'gdacs:eventid') || '',
            fromdate: xmlTag(b, 'gdacs:fromdate') || '',
            todate: xmlTag(b, 'gdacs:todate') || '',
            datemodified: xmlTag(b, 'gdacs:datemodified') || '',
            lat, lon
        };
    }).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lon));
}

async function handleGdacsFloods() {
    try {
        const r = await fetchText('https://www.gdacs.org/xml/rss_fl_7d.xml', { headers: { 'User-Agent': 'MonitorGlobal/7.2', 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' } }, 15000);
        if (!r.ok) throw new Error('GDACS floods HTTP ' + r.status);
        const items = parseGdacsFloodRss(r.text);
        return json({ ok: true, source: 'GDACS', updatedAt: nowIso(), items });
    } catch (e) { return json({ ok: false, source: 'GDACS', error: e.message, updatedAt: nowIso(), items: [] }, 502); }
}


// =========================================================
// SISMOS — rotas dedicadas AFAD / INGV / JMA (com clamp FDSN)
// =========================================================

async function handleAfadEarthquakes(reqUrl) {
    const limit=Math.min(200,Math.max(1,Number(reqUrl.searchParams.get('limit')||100)));
    const u='https://api.orhanaydogdu.com.tr/deprem/afad/live';
    try {
        const d=await fetchJson(u,{},12000);
        const raw=Array.isArray(d)?d:(d?.data||d?.result||[]);
        const arr=Array.isArray(raw)?raw:[];
        const out=arr.slice(0,limit).map((x,i)=>({
            id:String(x?.eventID||x?.eventId||x?.id||`AFAD-${i}-${x?.date_time||x?.datetime||''}`),
            place:x?.location||x?.title||x?.region||'Turquia', mag:Number(x?.magnitude||x?.mag||x?.ML||x?.m),
            lat:Number(x?.latitude??x?.lat),lon:Number(x?.longitude??x?.lon),depth:Number(x?.depth??x?.depth_km??x?.depthKm),
            time:x?.date_time||x?.datetime||x?.date||x?.time||null
        })).filter(x=>[x.mag,x.lat,x.lon].every(Number.isFinite));
        return json({ok:true,source:'AFAD',updatedAt:nowIso(),events:out});
    } catch(e){ return json({ok:false,source:'AFAD',error:e.message,updatedAt:nowIso(),events:[]},502); }
}

async function handleIngvEarthquakes(reqUrl) {
    const now=new Date(), start=new Date(now.getTime()-36*3600000);
    // Aplica o mesmo clamp do proxy genérico: INGV não aceita minmagnitude=0.1
    // nem limit=1000 (a API deles devolve 400). Aqui o piso é 1.5 / 500 linhas.
    const rawMinmag = Number(reqUrl.searchParams.get('minmagnitude') || 0.1);
    const clamped = clampFdsnValue('webservices.ingv.it', rawMinmag, 1000);
    const q=new URLSearchParams({
        format:'geojson',
        starttime:start.toISOString(),
        endtime:now.toISOString(),
        minmagnitude:String(clamped.minmag),
        limit:String(clamped.limit),
        orderby:'time'
    });
    try {
        const d=await fetchJson('https://webservices.ingv.it/fdsnws/event/1/query?'+q.toString(),{},18000);
        return json({ok:true,source:'INGV',updatedAt:nowIso(),features:d?.features||[]});
    } catch(e){ return json({ok:false,source:'INGV',error:e.message,updatedAt:nowIso(),features:[]},502); }
}

async function handleJmaEarthquakes() {
    const u='https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml';
    try {
        const r=await fetchText(u,{'headers':{'User-Agent':'MonitorGlobal/7.1','Accept':'application/atom+xml,application/xml,text/xml,*/*'}},12000);
        if(!r.ok) throw new Error('JMA '+r.status);
        const entries=xmlItems(r.text,'entry');
        const out=[];
        for(const b of entries.slice(0,80)) {
            const title=xmlTag(b,'title')||''; const updated=xmlTag(b,'updated')||xmlTag(b,'published')||'';
            const link=(b.match(/<link[^>]+href=["']([^"']+)["']/i)||[])[1]||'';
            const txt=(xmlTag(b,'summary')||xmlTag(b,'content')||'').replace(/<[^>]+>/g,' ');
            const magM=txt.match(/(?:M|Magnitude)\s*[=:]?\s*([0-9]+(?:\.[0-9]+)?)/i);
            const latM=txt.match(/(?:Latitude|Lat\.)\s*[=:]?\s*([+-]?\d+(?:\.\d+)?)/i);
            const lonM=txt.match(/(?:Longitude|Lon\.)\s*[=:]?\s*([+-]?\d+(?:\.\d+)?)/i);
            const depM=txt.match(/(?:Depth|Depth\s*km)\s*[=:]?\s*([0-9]+(?:\.\d+)?)/i);
            if(!magM||!latM||!lonM) continue;
            out.push({id:'JMA-'+String(title+'-'+updated).replace(/[^a-z0-9]+/gi,'-').slice(0,160),name:'',region:title,mag:Number(magM[1]),lat:Number(latM[1]),lon:Number(lonM[1]),depth:depM?Number(depM[1]):null,at:updated,detailUrl:link||'https://www.data.jma.go.jp/multi/quake/'});
        }
        return json(out);
    } catch(e){ return json({ok:false,source:'JMA',error:e.message,events:[]},502); }
}

/* FUNVISIS (Venezuela) — espelho comunitário sismosve.rafnixg.dev
   A agência oficial não expõe FDSN/GeoJSON público estável.
   Normalizamos para um formato simples que o frontend já entende. */
async function handleFunvisisEarthquakes(reqUrl) {
    const limit = Math.min(100, Math.max(1, Number(reqUrl.searchParams.get('limit') || 50)));
    const urls = [
        'https://sismosve.rafnixg.dev/api/sismos',
        'https://sismosve.rafnixg.dev/api/sismos/recent?limit=' + limit
    ];
    let features = [];
    let lastErr = null;
    for (const u of urls) {
        try {
            const d = await fetchJson(u, {}, 14000);
            if (Array.isArray(d.features)) features = d.features;
            else if (Array.isArray(d.sismos)) features = d.sismos;
            else if (Array.isArray(d)) features = d;
            if (features.length) break;
        } catch (e) {
            lastErr = e;
        }
    }
    if (!features.length) {
        return json({
            ok: false,
            source: 'FUNVISIS',
            error: lastErr?.message || 'sem dados',
            updatedAt: nowIso(),
            events: []
        }, 502);
    }

    const events = [];
    for (const f of features.slice(0, limit)) {
        try {
            const p = f.properties || f;
            const g = f.geometry || {};
            const coords = g.coordinates || [Number(p.long || p.lon || p.longitude), Number(p.lat || p.latitude)];
            const lon = Number(coords[0]);
            const lat = Number(coords[1]);
            const mag = Number(String(p.value || p.mag || p.magnitude || '').replace(',', '.'));
            const depthStr = String(p.depth || p.profundidad || '10');
            const depth = Number(depthStr.replace(/[^\d.]/g, '')) || 10;
            const dateStr = String(p.date || p.fecha || '').trim();
            const timeStr = String(p.time || p.hora || '00:00').trim();
            let timeIso = null;
            const dm = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            const tm = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (dm && tm) {
                const day = parseInt(dm[1], 10);
                const mon = parseInt(dm[2], 10) - 1;
                const year = parseInt(dm[3], 10);
                const hh = parseInt(tm[1], 10);
                const mm = parseInt(tm[2], 10);
                const ss = tm[3] ? parseInt(tm[3], 10) : 0;
                // Venezuela = UTC-4
                timeIso = new Date(Date.UTC(year, mon, day, hh + 4, mm, ss)).toISOString();
            }
            if (![mag, lat, lon].every(Number.isFinite)) continue;
            const place = String(p.addressFormatted || p.place || p.epicentro || 'Venezuela').replace(/\s+/g, ' ').trim();
            events.push({
                id: `FUNVISIS-${timeIso || dateStr}-${lat.toFixed(3)}-${lon.toFixed(3)}`,
                place: place.includes('Venezuela') ? place : `${place}, Venezuela`,
                mag,
                lat,
                lon,
                depth: Math.max(0, depth),
                time: timeIso,
                source: 'FUNVISIS'
            });
        } catch (_) {}
    }

    return json({
        ok: true,
        source: 'FUNVISIS',
        updatedAt: nowIso(),
        events,
        note: 'Espelho comunitário dos boletins oficiais FUNVISIS (sismosve.rafnixg.dev)'
    });
}

async function handleSeismicStatus() {
    const checks = [
        ['USGS', 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&limit=1&orderby=time'],
        ['AFAD', 'https://api.orhanaydogdu.com.tr/deprem/afad/live'],
        ['INGV', 'https://webservices.ingv.it/fdsnws/event/1/query?format=geojson&limit=1&orderby=time'],
        ['JMA', 'https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml'],
        ['GEOFON', 'https://geofon.gfz-potsdam.de/fdsnws/event/1/query?format=geojson&limit=1&orderby=time'],
        ['ISC', 'https://www.isc.ac.uk/fdsnws/event/1/query?format=geojson&limit=1&orderby=time'],
        ['FUNVISIS', 'https://sismosve.rafnixg.dev/api/sismos/recent?limit=5'],
        ['EMSC', 'https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=1&orderby=time']
    ];
    const out = await Promise.all(checks.map(async ([source, url]) => {
        const t = Date.now();
        try {
            const r = await fetchText(url, {}, 9000);
            return { source, online: r.ok, http: r.status, ms: Date.now() - t, error: r.ok ? null : r.text.slice(0, 160) };
        } catch (e) {
            return { source, online: false, http: 0, ms: Date.now() - t, error: e.message };
        }
    }));
    return json({ ok: true, updatedAt: nowIso(), sources: out });
}


// =========================================================
// ROTAS EXPLÍCITAS ÚTEIS PARA O CLIENTE
// =========================================================

async function handleWeatherApi(reqUrl, env) {
    const q = reqUrl.searchParams.get('q');
    if (!q) return json({ error: 'Faltou o parâmetro ?q=' }, 400);
    if (!env.WEATHERAPI_KEY) return json({ error: 'WEATHERAPI_KEY não configurada no Worker' }, 500);
    const alvo = 'https://api.weatherapi.com/v1/current.json?key=' + encodeURIComponent(env.WEATHERAPI_KEY) + '&q=' + encodeURIComponent(q) + '&aqi=no';
    try {
        const r = await fetchText(alvo, {}, 10000);
        return resposta(r.text, r.status, r.contentType || 'application/json');
    } catch (e) { return json({ error: 'Falha ao consultar WeatherAPI', detail: e.message }, 502); }
}

async function handleRedemet(reqUrl, env) {
    const localidades = reqUrl.searchParams.get('localidades');
    if (!localidades) return json({ error: 'Faltou o parâmetro ?localidades=' }, 400);
    if (!env.REDEMET_API_KEY) return json({ error: 'REDEMET_API_KEY não configurada no Worker' }, 500);
    const safe = localidades.split(',').map(s => s.trim().toUpperCase().replace(/[^A-Z0-9]/g,'')).filter(Boolean).join(',');
    if (!safe) return json({ error: 'Nenhuma localidade válida' }, 400);
    const alvo = 'https://api-redemet.decea.mil.br/mensagens/metar/' + safe + '?api_key=' + encodeURIComponent(env.REDEMET_API_KEY) +
        (reqUrl.searchParams.get('data_ini') ? '&data_ini=' + encodeURIComponent(reqUrl.searchParams.get('data_ini')) : '') +
        (reqUrl.searchParams.get('data_fim') ? '&data_fim=' + encodeURIComponent(reqUrl.searchParams.get('data_fim')) : '');
    try { const r = await fetchText(alvo, {}, 12000); return resposta(r.text, r.status, r.contentType || 'application/json'); }
    catch (e) { return json({ error: 'Falha ao consultar REDEMET', detail: e.message }, 502); }
}


// =========================================================
// TELEGRAM — alertas M6+ com CARD (magnitude + textos na imagem)
// Secrets no Cloudflare: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// =========================================================

const TELEGRAM_MIN_MAG = 6.0;
const TELEGRAM_ALERT_CACHE_PATH = '/__cache/monitor-global/telegram-m6-sent';
const TELEGRAM_ALERT_TTL = 86400 * 3; // 3 dias de memória anti-spam

// ---------- Card PNG (gerado no Worker, sem dependência externa) ----------
// =========================================================
// FONTE REAL (JetBrains Mono Bold) — atlas de glifos em PNG
// embutido como base64, decodificado 1x e cacheado. O alpha de
// cada glifo funciona como máscara: dá pra colorir com qualquer cor.
// =========================================================
const FONT_CHARS_TEXT = " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;-+/?%()\u00b7\u00b0~'\u00c1\u00c0\u00c2\u00c3\u00c9\u00ca\u00cd\u00d3\u00d4\u00d5\u00da\u00dc\u00c7\u00e1\u00e0\u00e2\u00e3\u00e9\u00ea\u00ed\u00f3\u00f4\u00f5\u00fa\u00fc\u00e7";
const FONT_CHARS_HERO = "M0123456789.";

const FONT_MICRO_CELL_W = 11, FONT_MICRO_CELL_H = 21;
const FONT_SMALL_CELL_W = 17, FONT_SMALL_CELL_H = 30;
const FONT_HERO_CELL_W = 68, FONT_HERO_CELL_H = 108;

const FONT_ATLAS_MICRO_B64 =
    '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';

const FONT_ATLAS_SMALL_B64 =
    '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' +
    'Dwq82kVERLQD1JvY48Du8Z2LiIhYYoGuZHEr++8m0F1ORETEmxPWqL2/93cgcK5nFBnXbR1DkMrD4XS63a29sj+iGeIEXcRgAV096vD1busTEbE0w/YdHELPehwoXcZ6uixxixPRlfIOB3dbn4EA8DbgD+gOvCoTdPNRF5ejBljFiIiIiEwAO6C7epznndyjXyIiIpoD3X1/AskOydIjuSIiIiJ6EnSeTRF0dktERMSbE8BO5GMOga4Ruo2CPDxMXHnVNXjPoW+A+OMEXYSIdLjcXAC8tdv6REQszQD29b7v+3ZZF9cOPESgq9CI7sBO1AWdRYcuuojf8oiIiK4D9czizlCc0W19IiKWdth37vH4zkVERCzRQA8cfcV+zF6m5HDRiIiINy9yJuhe' +
    'Af4MbNlt/UKR0n8h8CRwRpyc6y7iBF3EYAA9j9Dhqm7rExGxtAM4y75vL9LgHLwW9FgBmGt1OaZbekRERERELH1AzzRc4PUxpwIHdVuviIilFeiZ9f47NwU4MCttXJEVERERERERERERERERERERERERERERsRQCWE5ENrY/54nIk8aYN7qoUkTEUg1geRHZyP6M71xERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERExJsQ/wcgJWxVXe2qrgAAAABJRU5ErkJggg==';

const FONT_ATLAS_HERO_B64 =
    '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';

function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

function buildCharMap(chars) {
    const map = {};
    for (let i = 0; i < chars.length; i++) map[chars[i]] = i;
    return map;
}
const FONT_CHARMAP_TEXT = buildCharMap(FONT_CHARS_TEXT);
const FONT_CHARMAP_HERO = buildCharMap(FONT_CHARS_HERO);

let _fontAtlasCache = null;
/** Decodifica (1x por instância do Worker) e cacheia os 3 atlas de fonte. */
async function getFontAtlases() {
    if (_fontAtlasCache) return _fontAtlasCache;
    const [micro, small, hero] = await Promise.all([
        decodePng(base64ToBytes(FONT_ATLAS_MICRO_B64)),
        decodePng(base64ToBytes(FONT_ATLAS_SMALL_B64)),
        decodePng(base64ToBytes(FONT_ATLAS_HERO_B64))
    ]);
    _fontAtlasCache = {
        micro: { img: micro, cellW: FONT_MICRO_CELL_W, cellH: FONT_MICRO_CELL_H, map: FONT_CHARMAP_TEXT },
        small: { img: small, cellW: FONT_SMALL_CELL_W, cellH: FONT_SMALL_CELL_H, map: FONT_CHARMAP_TEXT },
        hero: { img: hero, cellW: FONT_HERO_CELL_W, cellH: FONT_HERO_CELL_H, map: FONT_CHARMAP_HERO }
    };
    return _fontAtlasCache;
}

/** Cola um glifo do atlas usando o alpha dele como máscara de cor (permite qualquer cor com 1 atlas branco só). */
function blitGlyph(rgba, w, h, atlasImg, sx, sy, sw, sh, dx, dy, r, g, b) {
    dx = Math.round(dx); dy = Math.round(dy);
    const y0 = Math.max(0, -dy), y1 = Math.min(sh, h - dy);
    const x0 = Math.max(0, -dx), x1 = Math.min(sw, w - dx);
    for (let yy = y0; yy < y1; yy++) {
        const srcRow = (sy + yy) * atlasImg.width;
        const dstRow = (dy + yy) * w;
        for (let xx = x0; xx < x1; xx++) {
            const si = (srcRow + sx + xx) * 4;
            const a = atlasImg.rgba[si + 3];
            if (a === 0) continue;
            const di = (dstRow + dx + xx) * 4;
            if (a >= 255) {
                rgba[di] = r; rgba[di + 1] = g; rgba[di + 2] = b; rgba[di + 3] = 255;
            } else {
                const ia = 255 - a;
                rgba[di] = ((r * a) + (rgba[di] * ia)) / 255;
                rgba[di + 1] = ((g * a) + (rgba[di + 1] * ia)) / 255;
                rgba[di + 2] = ((b * a) + (rgba[di + 2] * ia)) / 255;
                rgba[di + 3] = 255;
            }
        }
    }
}

/** Desenha texto usando um atlas (fonte real JetBrains Mono). Retorna a largura total desenhada. */
function drawTextFont(rgba, w, h, font, text, x, y, r, g, b) {
    let cx = x;
    for (const ch of text) {
        const idx = (ch in font.map) ? font.map[ch] : font.map['?'];
        if (idx !== undefined) {
            blitGlyph(rgba, w, h, font.img, idx * font.cellW, 0, font.cellW, font.cellH, cx, y, r, g, b);
        }
        cx += font.cellW;
    }
    return cx;
}

function textFontWidth(font, text) {
    return [...text].length * font.cellW;
}

/** Normaliza caracteres que não existem no atlas embutido, evitando '?' na imagem. */
function sanitizeFontText(text) {
    let s = String(text ?? '')
        .replace(/[–—−]/g, '-')
        .replace(/[“”«»]/g, '"')
        .replace(/[‘’‚‛]/g, "'")
        .replace(/…/g, '...')
        .replace(/#/g, 'N.')
        .replace(/@/g, 'at')
        .replace(/&/g, 'e')
        .replace(/=/g, '-')
        .replace(/_/g, '-')
        .replace(/\|/g, '/')
        .replace(/[<>\[\]{}]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    // Última barreira: qualquer glifo fora do atlas vira espaço, nunca '?'.
    // Isso cobre caracteres ocasionais enviados pelas agências, como símbolos
    // tipográficos, ordinal masculino, emojis e outros Unicode não suportados.
    return [...s].map(ch => (ch in FONT_CHARMAP_TEXT) ? ch : ' ').join('')
        .replace(/\s{2,}/g, ' ').trim();
}

/** Quebra uma string em até maxLines linhas de no máximo maxChars, respeitando espaços. Trunca com "…" se sobrar. */
function wrapText(text, maxChars, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const candidate = cur ? cur + ' ' + w : w;
        if (candidate.length <= maxChars) {
            cur = candidate;
        } else {
            if (cur) lines.push(cur);
            cur = w;
            if (lines.length >= maxLines) break;
        }
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    // se ainda sobrou conteúdo além do que coube, marca reticências na última linha
    // (usa "..." em vez de "…" pois o atlas de fonte não tem esse glifo)
    const consumed = lines.join(' ').length;
    if (consumed < String(text || '').replace(/\s+/g, ' ').trim().length && lines.length) {
        let last = lines[lines.length - 1];
        if (last.length > maxChars - 3) last = last.slice(0, Math.max(0, maxChars - 3));
        lines[lines.length - 1] = last + '...';
    } else if (lines.length > maxLines) {
        lines.length = maxLines;
    }
    // garante que cada linha caiba mesmo se uma palavra sozinha for maior que maxChars
    return lines.slice(0, maxLines).map(l => l.length > maxChars ? l.slice(0, Math.max(0, maxChars - 3)) + '...' : l);
}

function crc32Png(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
        c ^= buf[i];
        for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
}

function pngChunk(type, data) {
    const len = data.length;
    const out = new Uint8Array(8 + len + 4);
    const v = new DataView(out.buffer);
    v.setUint32(0, len);
    out[4] = type.charCodeAt(0);
    out[5] = type.charCodeAt(1);
    out[6] = type.charCodeAt(2);
    out[7] = type.charCodeAt(3);
    out.set(data, 8);
    const crcBuf = out.subarray(4, 8 + len);
    v.setUint32(8 + len, crc32Png(crcBuf));
    return out;
}

async function rgbaToPng(rgba, w, h) {
    // filtro None por linha
    const raw = new Uint8Array((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
        const row = y * (w * 4 + 1);
        raw[row] = 0;
        raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), row + 1);
    }
    let compressed;
    if (typeof CompressionStream !== 'undefined') {
        const cs = new CompressionStream('deflate');
        const stream = new Blob([raw]).stream().pipeThrough(cs);
        compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
        // fallback improvável no Worker moderno
        throw new Error('CompressionStream indisponível');
    }
    const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = new Uint8Array(13);
    const dv = new DataView(ihdr.buffer);
    dv.setUint32(0, w);
    dv.setUint32(4, h);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    const parts = [sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', new Uint8Array(0))];
    let total = 0;
    for (const p of parts) total += p.length;
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}

function fillRect(rgba, w, x, y, rw, rh, r, g, b, a = 255) {
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(w, x0 + (rw | 0)), y1 = Math.min(rgba.length / (w * 4), y0 + (rh | 0));
    for (let yy = y0; yy < y1; yy++) {
        let i = (yy * w + x0) * 4;
        for (let xx = x0; xx < x1; xx++) {
            if (a >= 255) {
                rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
            } else if (a > 0) {
                const ia = 255 - a;
                rgba[i] = (r * a + rgba[i] * ia) / 255;
                rgba[i + 1] = (g * a + rgba[i + 1] * ia) / 255;
                rgba[i + 2] = (b * a + rgba[i + 2] * ia) / 255;
                rgba[i + 3] = 255;
            }
            i += 4;
        }
    }
}

function fillCircle(rgba, w, h, cx, cy, rad, r, g, b, a = 255) {
    const r2 = rad * rad;
    const y0 = Math.max(0, (cy - rad) | 0), y1 = Math.min(h, (cy + rad + 1) | 0);
    const x0 = Math.max(0, (cx - rad) | 0), x1 = Math.min(w, (cx + rad + 1) | 0);
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r2) {
                const i = (y * w + x) * 4;
                if (a >= 255) {
                    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
                } else if (a > 0) {
                    const ia = 255 - a;
                    rgba[i] = (r * a + rgba[i] * ia) / 255;
                    rgba[i + 1] = (g * a + rgba[i + 1] * ia) / 255;
                    rgba[i + 2] = (b * a + rgba[i + 2] * ia) / 255;
                    rgba[i + 3] = 255;
                }
            }
        }
    }
}

// =========================================================
// ELEMENTOS "ESTILO STORY" (portados do gerador do site,
// função buildStoryCanvas/drawGauge/etc do index.html) —
// versão em pixels puros pro Worker, sem <canvas> do navegador.
// =========================================================

/** Arco tipo velocímetro (mesma lógica de drawGauge do site): trilho cinza
 * + porção colorida proporcional a `frac`. closeFull=true = anel 360°
 * fechado (usado em eventos sem magnitude numérica). */
function drawArc(rgba, w, h, cx, cy, r, thickness, startDeg, sweepDeg, cr, cg, cb, a = 255) {
    const rOuter = r + thickness / 2, rInner = r - thickness / 2;
    const y0 = Math.max(0, Math.floor(cy - rOuter - 1)), y1 = Math.min(h, Math.ceil(cy + rOuter + 1));
    const x0 = Math.max(0, Math.floor(cx - rOuter - 1)), x1 = Math.min(w, Math.ceil(cx + rOuter + 1));
    const start = ((startDeg % 360) + 360) % 360;
    const sweep = Math.max(0, Math.min(360, sweepDeg));
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const dx = x - cx, dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < rInner || dist > rOuter) continue;
            // ângulo em graus, sentido horário, 0° = direita (como no Canvas 2D)
            let ang = Math.atan2(dy, dx) * 180 / Math.PI;
            ang = ((ang % 360) + 360) % 360;
            let rel = ang - start;
            rel = ((rel % 360) + 360) % 360;
            if (rel <= sweep) {
                const i = (y * w + x) * 4;
                if (a >= 255) {
                    rgba[i] = cr; rgba[i + 1] = cg; rgba[i + 2] = cb; rgba[i + 3] = 255;
                } else if (a > 0) {
                    const ia = 255 - a;
                    rgba[i] = (cr * a + rgba[i] * ia) / 255;
                    rgba[i + 1] = (cg * a + rgba[i + 1] * ia) / 255;
                    rgba[i + 2] = (cb * a + rgba[i + 2] * ia) / 255;
                    rgba[i + 3] = 255;
                }
            }
        }
    }
    // "tampas" arredondadas nas pontas do arco colorido (se não for anel fechado)
    if (sweep < 360 && sweep > 0) {
        const capR = thickness / 2;
        const rad1 = start * Math.PI / 180;
        const rad2 = (start + sweep) * Math.PI / 180;
        fillCircle(rgba, w, h, cx + r * Math.cos(rad1), cy + r * Math.sin(rad1), capR, cr, cg, cb, a);
        fillCircle(rgba, w, h, cx + r * Math.cos(rad2), cy + r * Math.sin(rad2), capR, cr, cg, cb, a);
    }
}

/** Preenche um triângulo (usado pras pontas de seta dos ícones do mecanismo focal). */
function fillTriangle(rgba, w, h, x0, y0, x1, y1, x2, y2, cr, cg, cb, a = 255) {
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
    const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (denom === 0) return;
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const a1 = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / denom;
            const a2 = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / denom;
            const a3 = 1 - a1 - a2;
            if (a1 >= -0.001 && a2 >= -0.001 && a3 >= -0.001) {
                const i = (y * w + x) * 4;
                if (a >= 255) {
                    rgba[i] = cr; rgba[i + 1] = cg; rgba[i + 2] = cb; rgba[i + 3] = 255;
                } else if (a > 0) {
                    const ia = 255 - a;
                    rgba[i] = (cr * a + rgba[i] * ia) / 255;
                    rgba[i + 1] = (cg * a + rgba[i + 1] * ia) / 255;
                    rgba[i + 2] = (cb * a + rgba[i + 2] * ia) / 255;
                    rgba[i + 3] = 255;
                }
            }
        }
    }
}

/** Ícones vetoriais simples pro mecanismo focal (sem depender de emoji, que a
 * fonte monoespaçada não tem em cores): seta pra cima/baixo, dupla seta
 * lateral, ou "?" pro caso não determinado. */
function drawMechanismIcon(rgba, w, h, cx, cy, size, kind, cr, cg, cb) {
    const shaftT = Math.round(size * 0.16);
    if (kind === 'up' || kind === 'down') {
        const half = size / 2;
        fillRect(rgba, w, cx - shaftT / 2, cy - half, shaftT, size, cr, cg, cb);
        const headW = size * 0.5, headH = size * 0.34;
        if (kind === 'up') {
            fillTriangle(rgba, w, h, cx, cy - half - headH * 0.4, cx - headW / 2, cy - half + headH * 0.5, cx + headW / 2, cy - half + headH * 0.5, cr, cg, cb);
        } else {
            fillTriangle(rgba, w, h, cx, cy + half + headH * 0.4, cx - headW / 2, cy + half - headH * 0.5, cx + headW / 2, cy + half - headH * 0.5, cr, cg, cb);
        }
    } else if (kind === 'leftright') {
        const half = size / 2;
        fillRect(rgba, w, cx - half, cy - shaftT / 2, size, shaftT, cr, cg, cb);
        const headW = size * 0.34, headH = size * 0.5;
        fillTriangle(rgba, w, h, cx - half - headW * 0.4, cy, cx - half + headW * 0.5, cy - headH / 2, cx - half + headW * 0.5, cy + headH / 2, cr, cg, cb);
        fillTriangle(rgba, w, h, cx + half + headW * 0.4, cy, cx + half - headW * 0.5, cy - headH / 2, cx + half - headW * 0.5, cy + headH / 2, cr, cg, cb);
    } else {
        // "indeterminado": círculo vazado com "?" — desenhado com o próprio atlas de fonte
        fillCircle(rgba, w, h, cx, cy, size * 0.42, cr, cg, cb, 40);
    }
}

/** Desenha texto com halo (contorno escuro fino atrás), igual à técnica
 * haloFillText do site — garante contraste mesmo em cima do mapa de satélite. */
function drawTextFontHalo(rgba, w, h, font, text, x, y, r, g, b, hr = 3, hg = 9, hb = 20) {
    const offs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [ox, oy] of offs) drawTextFont(rgba, w, h, font, text, x + ox, y + oy, hr, hg, hb);
    return drawTextFont(rgba, w, h, font, text, x, y, r, g, b);
}

function drawTextFontCenteredHalo(rgba, w, h, font, text, cx, y, r, g, b, hr = 3, hg = 9, hb = 20) {
    const tw = textFontWidth(font, text);
    return drawTextFontHalo(rgba, w, h, font, text, Math.round(cx - tw / 2), y, r, g, b, hr, hg, hb);
}

/** Escurece o canvas com um degradê vertical (lista de paradas [fração_y, alpha 0-1]),
 * igual ao gradiente do rodapé/cabeçalho do Story — deixa o mapa visível em
 * cima e o texto legível embaixo. */
function applyVerticalDarkGradient(rgba, w, h, stops, yStart = 0, yEnd = h) {
    const rangeH = Math.max(1, yEnd - yStart);
    for (let y = Math.max(0, yStart); y < Math.min(h, yEnd); y++) {
        const f = (y - yStart) / rangeH;
        let alpha = stops[0][1];
        for (let i = 0; i < stops.length - 1; i++) {
            const [f0, a0] = stops[i], [f1, a1] = stops[i + 1];
            if (f >= f0 && f <= f1) {
                const t = (f1 === f0) ? 0 : (f - f0) / (f1 - f0);
                alpha = a0 + (a1 - a0) * t;
                break;
            }
            if (f > f1) alpha = a1;
        }
        if (alpha <= 0) continue;
        const row = y * w * 4;
        for (let x = 0; x < w; x++) {
            const i = row + x * 4;
            rgba[i] = rgba[i] * (1 - alpha);
            rgba[i + 1] = rgba[i + 1] * (1 - alpha);
            rgba[i + 2] = rgba[i + 2] * (1 - alpha);
        }
    }
}

// ---- funções de cálculo puras, portadas 1:1 do index.html (site) ----
function getHexColorFromMag(m) {
    if (m >= 6) return [239, 68, 68];   // #ef4444
    if (m >= 5) return [251, 146, 60];  // #fb923c
    if (m >= 4) return [250, 204, 21];  // #facc15
    return [74, 222, 128];              // #4ade80
}
function classificarProfundidadeCard(km) {
    if (km < 70) return { label: 'Raso', cor: [248, 113, 113] };
    if (km < 300) return { label: 'Intermediário', cor: [251, 191, 36] };
    return { label: 'Profundo', cor: [74, 222, 128] };
}
function estimarMercalliCard(m, d) {
    const b = m - Math.max(0, d) / 50;
    if (b < 2) return { nivel: 'I - II', cor: [74, 222, 128] };
    if (b < 4) return { nivel: 'III - IV', cor: [250, 204, 21] };
    if (b < 5.5) return { nivel: 'V - VI', cor: [251, 146, 60] };
    if (b < 7) return { nivel: 'VII - VIII', cor: [239, 68, 68] };
    return { nivel: 'IX+', cor: [153, 27, 27] };
}
function calcularEnergiaCard(m) {
    const j = Math.pow(10, 1.5 * m + 4.8);
    const t = j / 4.184e9;
    const f = t < 1 ? (t * 1000).toFixed(1) + ' kg' :
        t < 1000 ? t.toFixed(1) + ' ton' :
            t < 1e6 ? (t / 1000).toFixed(1) + ' kt' :
                (t / 1e6).toFixed(1) + ' Mt';
    return f;
}
function calcularMecanismoFocalCard(depth, lat, lng, place) {
    const n = String(place || '').toLowerCase();
    if (n.includes('califórnia') || n.includes('california') || n.includes('san andreas') || n.includes('turquia') || n.includes('caribe')) {
        return { tipo: 'Lateral (Transcorrência)', desc: 'As placas deslizaram horizontalmente.', kind: 'leftright' };
    }
    if (depth > 70) return { tipo: 'Inversa (Para Cima)', desc: 'Ação compressiva extrema.', kind: 'up' };
    if (n.includes('islândia') || n.includes('iceland') || n.includes('ocean')) {
        return { tipo: 'Normal (Para Baixo)', desc: 'Força de extensão.', kind: 'down' };
    }
    return { tipo: 'Não determinado (estimativa)', desc: 'Sem dados suficientes.', kind: 'unknown' };
}
function formatCoordCard(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'L' : 'O';
    return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
}
function approxLocalTimeCard(timeIso, lon) {
    if (!Number.isFinite(lon) || !timeIso) return '';
    const offsetH = Math.round(lon / 15);
    const d = new Date(new Date(timeIso).getTime() + offsetH * 3600000);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const sinal = offsetH >= 0 ? '+' : '';
    return `${hh}:${mm} local aprox. (UTC${sinal}${offsetH})`;
}
function niceScaleValueCard(x) {
    if (!Number.isFinite(x) || x <= 0) return 10;
    const exp = Math.floor(Math.log10(x));
    const base = x / Math.pow(10, exp);
    const nice = base >= 5 ? 5 : (base >= 2 ? 2 : 1);
    return nice * Math.pow(10, exp);
}
/** Barra de escala tipo "≈ 200 km" (mesma fórmula de projeção Web Mercator do site). */
function drawScaleBarCard(rgba, w, h, font, x, y, lat, zoom) {
    const metrosPorPx = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
    if (!Number.isFinite(metrosPorPx) || metrosPorPx <= 0) return;
    const maxBarPx = 140;
    const kmAlvo = (maxBarPx * metrosPorPx) / 1000;
    const km = niceScaleValueCard(kmAlvo);
    const barPx = Math.round((km * 1000) / metrosPorPx);
    fillRect(rgba, w, x, y - 8, 2, 8, 226, 232, 240);
    fillRect(rgba, w, x, y, barPx, 2, 226, 232, 240);
    fillRect(rgba, w, x + barPx - 2, y - 8, 2, 8, 226, 232, 240);
    drawTextFontHalo(rgba, w, h, font, `~${km >= 1 ? km : km.toFixed(1)} km`, x, y - 8 - font.cellH - 2, 226, 232, 240);
}


// =========================================================
// DECODIFICADOR PNG MÍNIMO (pra colar o mapa estático no card)
// Suporta: 8 bits/canal, não-interlaçado, colorType 0/2/3/4/6
// =========================================================
async function inflateZlib(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream indisponível');
    const ds = new DecompressionStream('deflate'); // 'deflate' = zlib (RFC1950), igual ao IDAT do PNG
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

function pngPaeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

async function decodePng(bytes) {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) throw new Error('PNG inválido (assinatura)');

    let pos = 8, width = 0, height = 0, bitDepth = 8, colorType = 6, interlace = 0;
    let palette = null, trns = null;
    const idatChunks = [];

    while (pos < bytes.length) {
        const dv = new DataView(bytes.buffer, bytes.byteOffset + pos, 8);
        const len = dv.getUint32(0);
        const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
        const data = bytes.subarray(pos + 8, pos + 8 + len);
        pos += 8 + len + 4; // pula dados + CRC

        if (type === 'IHDR') {
            const hdv = new DataView(data.buffer, data.byteOffset, data.byteLength);
            width = hdv.getUint32(0);
            height = hdv.getUint32(4);
            bitDepth = data[8];
            colorType = data[9];
            interlace = data[12];
        } else if (type === 'PLTE') {
            palette = data.slice();
        } else if (type === 'tRNS') {
            trns = data.slice();
        } else if (type === 'IDAT') {
            idatChunks.push(data.slice());
        } else if (type === 'IEND') {
            break;
        }
    }

    if (bitDepth !== 8) throw new Error('PNG bitDepth não suportado: ' + bitDepth);
    if (interlace !== 0) throw new Error('PNG interlaçado não suportado');

    let total = 0;
    for (const c of idatChunks) total += c.length;
    const idat = new Uint8Array(total);
    { let o = 0; for (const c of idatChunks) { idat.set(c, o); o += c.length; } }

    const raw = await inflateZlib(idat);

    const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
    const bpp = channelsByType[colorType];
    if (!bpp) throw new Error('PNG colorType não suportado: ' + colorType);
    const stride = width * bpp;

    const unfiltered = new Uint8Array(height * stride);
    let rp = 0;
    for (let y = 0; y < height; y++) {
        const filter = raw[rp]; rp += 1;
        const rowStart = y * stride;
        const prevRowStart = (y - 1) * stride;
        for (let x = 0; x < stride; x++) {
            const rawByte = raw[rp + x];
            const a = x >= bpp ? unfiltered[rowStart + x - bpp] : 0;
            const b = y > 0 ? unfiltered[prevRowStart + x] : 0;
            const c = (y > 0 && x >= bpp) ? unfiltered[prevRowStart + x - bpp] : 0;
            let val;
            switch (filter) {
                case 0: val = rawByte; break;
                case 1: val = rawByte + a; break;
                case 2: val = rawByte + b; break;
                case 3: val = rawByte + ((a + b) >> 1); break;
                case 4: val = rawByte + pngPaeth(a, b, c); break;
                default: throw new Error('PNG filtro desconhecido: ' + filter);
            }
            unfiltered[rowStart + x] = val & 0xff;
        }
        rp += stride;
    }

    const rgba = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const si = y * stride + x * bpp;
            const di = (y * width + x) * 4;
            let r = 0, g = 0, b = 0, a = 255;
            if (colorType === 2) { r = unfiltered[si]; g = unfiltered[si + 1]; b = unfiltered[si + 2]; }
            else if (colorType === 6) { r = unfiltered[si]; g = unfiltered[si + 1]; b = unfiltered[si + 2]; a = unfiltered[si + 3]; }
            else if (colorType === 0) { r = g = b = unfiltered[si]; }
            else if (colorType === 4) { r = g = b = unfiltered[si]; a = unfiltered[si + 1]; }
            else if (colorType === 3) {
                const idx = unfiltered[si];
                r = palette ? palette[idx * 3] : 0;
                g = palette ? palette[idx * 3 + 1] : 0;
                b = palette ? palette[idx * 3 + 2] : 0;
                a = (trns && idx < trns.length) ? trns[idx] : 255;
            }
            rgba[di] = r; rgba[di + 1] = g; rgba[di + 2] = b; rgba[di + 3] = a;
        }
    }
    return { width, height, rgba };
}

/** Cola `img` (de decodePng) dentro do retângulo dx,dy,dw,dh, cobrindo tudo (crop central, tipo CSS background-size:cover). */
function drawImageCover(rgba, w, h, img, dx, dy, dw, dh) {
    const sw = img.width, sh = img.height;
    const scale = Math.max(dw / sw, dh / sh);
    const cw = sw * scale, ch = sh * scale;
    const ox = dx - (cw - dw) / 2;
    const oy = dy - (ch - dh) / 2;
    const x0 = Math.max(0, dx | 0), y0 = Math.max(0, dy | 0);
    const x1 = Math.min(w, (dx + dw) | 0), y1 = Math.min(h, (dy + dh) | 0);
    for (let y = y0; y < y1; y++) {
        const sy = Math.min(sh - 1, Math.max(0, Math.floor((y - oy) / scale)));
        for (let x = x0; x < x1; x++) {
            const sx = Math.min(sw - 1, Math.max(0, Math.floor((x - ox) / scale)));
            const si = (sy * sw + sx) * 4;
            const di = (y * w + x) * 4;
            const a = img.rgba[si + 3];
            if (a >= 255) {
                rgba[di] = img.rgba[si]; rgba[di + 1] = img.rgba[si + 1]; rgba[di + 2] = img.rgba[si + 2]; rgba[di + 3] = 255;
            } else if (a > 0) {
                const ia = 255 - a;
                rgba[di] = ((img.rgba[si] * a) + (rgba[di] * ia)) / 255;
                rgba[di + 1] = ((img.rgba[si + 1] * a) + (rgba[di + 1] * ia)) / 255;
                rgba[di + 2] = ((img.rgba[si + 2] * a) + (rgba[di + 2] * ia)) / 255;
                rgba[di + 3] = 255;
            }
        }
    }
}

async function fetchBinaryWithTimeout(url, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const r = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'MonitorGlobal/7.3 (+https://monitorglobal.top)' }
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.length < 100) throw new Error('resposta vazia/curta demais');
        return buf;
    } finally {
        clearTimeout(timer);
    }
}

/** Tenta cada URL de staticMapUrls em ordem até uma decodificar com sucesso. Retorna null se todas falharem. */
async function fetchEpicenterMap(lat, lon, zoom = 6, imgW = 800, imgH = 440) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
    const urls = staticMapUrls(lat, lon, zoom, imgW, imgH);
    for (const url of urls) {
        try {
            const bytes = await fetchBinaryWithTimeout(url, 6000);
            const img = await decodePng(bytes);
            if (img.width > 10 && img.height > 10) return img;
        } catch (e) {
            console.warn('mapa estático falhou:', url, e.message);
        }
    }
    return null;
}

async function renderAlertCardPng(ev) {
    const W = 800, H = 1440;
    const rgba = new Uint8Array(W * H * 4);
    const fonts = await getFontAtlases();
    const mag = Number(ev.mag);
    const magColor = getHexColorFromMag(mag);
    const zoom = 7; // zoom 7 = barra de escala ~100 km (zoom 6 dava ~200 km)

    // --- mapa do epicentro: ocupa o cartão INTEIRO (0 a H) como plano de
    // fundo, igual à referência (o card da Indonésia) — sem faixa preta
    // nenhuma. mapBoxH só serve de referência de layout (onde o marcador/
    // gauge/textos ficam), não corta mais a imagem em lugar nenhum.
    const mapBoxH = 440;
    fillRect(rgba, W, 0, 0, W, H, 8, 14, 26); // fallback sólido só se o mapa falhar
    let mapImg = null;
    if (Number.isFinite(Number(ev.lat)) && Number.isFinite(Number(ev.lon))) {
        try { mapImg = await fetchEpicenterMap(ev.lat, ev.lon, zoom, W, H); }
        catch (e) { console.warn('fetchEpicenterMap falhou:', e.message); }
    }
    if (mapImg) {
        drawImageCover(rgba, W, H, mapImg, 0, 0, W, H);
        // tinta azul-escura uniforme por cima do mapa INTEIRO — o mapa
        // continua visível (apagado) do topo ao rodapé, sem virar preto
        // sólido em nenhum trecho, igual à referência.
        fillRect(rgba, W, 0, 0, W, H, 8, 14, 26, 112);
    }

    // --- marcador do epicentro + escala, sempre no centro exato da caixa ---
    const markerCx = W / 2, markerCy = Math.round(mapBoxH / 2);
    fillCircle(rgba, W, H, markerCx, markerCy, 50, magColor[0], magColor[1], magColor[2], 55);
    fillCircle(rgba, W, H, markerCx, markerCy, 34, magColor[0], magColor[1], magColor[2], 110);
    fillCircle(rgba, W, H, markerCx, markerCy, 7, 255, 255, 255, 255);
    fillCircle(rgba, W, H, markerCx, markerCy, 4, magColor[0], magColor[1], magColor[2], 255);
    if (mapImg && Number.isFinite(ev.lat)) {
        drawScaleBarCard(rgba, W, H, fonts.micro, 40, markerCy + 150, ev.lat, zoom);
    }

    // --- cabeçalho (texto com halo, sempre legível em cima do mapa) ---
    drawTextFontHalo(rgba, W, H, fonts.small, 'MONITOR GLOBAL', 32, 40, 56, 189, 248);
    const aoVivoW = textFontWidth(fonts.small, 'AO VIVO');
    drawTextFontHalo(rgba, W, H, fonts.small, 'AO VIVO', W - 32 - aoVivoW, 40, 248, 113, 113);

    // --- velocímetro de magnitude + número, centralizados ---
    const gaugeR = 100, gaugeThick = 22, gaugeOuterR = gaugeR + gaugeThick / 2;
    const magStr = `M${mag.toFixed(1)}`;
    const magStrW = textFontWidth(fonts.hero, magStr);
    const gaugeGap = 40;
    const groupW = gaugeOuterR * 2 + gaugeGap + magStrW;
    const gaugeCx = Math.round(W / 2 - groupW / 2 + gaugeOuterR);
    const gaugeCy = mapBoxH + 40 + gaugeOuterR;
    const frac = Math.max(0.04, Math.min(1, (mag - 2) / 7));
    drawArc(rgba, W, H, gaugeCx, gaugeCy, gaugeR, gaugeThick, 135, 270, 100, 116, 139, 100); // trilho
    drawArc(rgba, W, H, gaugeCx, gaugeCy, gaugeR, gaugeThick, 135, 270 * frac, magColor[0], magColor[1], magColor[2], 255);
    drawTextFontHalo(rgba, W, H, fonts.hero, magStr,
        gaugeCx + gaugeR + gaugeGap, gaugeCy - Math.round(fonts.hero.cellH / 2),
        magColor[0], magColor[1], magColor[2]);

    let yCursor = gaugeCy + gaugeOuterR + 60;

    // --- local do evento (centralizado, até 2 linhas) ---
    const place = String(ev.place || 'Local desconhecido');
    const availCharsPlace = Math.floor((W - 140) / fonts.small.cellW);
    const placeLines = wrapText(place, availCharsPlace, 2);
    const placeLineH = fonts.small.cellH + 6;
    placeLines.forEach((line, i) => {
        drawTextFontCenteredHalo(rgba, W, H, fonts.small, line, W / 2, yCursor + i * placeLineH, 241, 245, 249);
    });
    yCursor += placeLines.length * placeLineH + 26;

    // --- data/hora, hora local aprox. + coordenadas, fonte ---
    const when = ev.timeIso
        ? new Date(ev.timeIso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' BRT'
        : '--';
    drawTextFontCenteredHalo(rgba, W, H, fonts.micro, when, W / 2, yCursor, 226, 232, 240);
    yCursor += fonts.micro.cellH + 8;

    const localInfo = [approxLocalTimeCard(ev.timeIso, ev.lon), formatCoordCard(ev.lat, ev.lon)]
        .filter(Boolean).join(' - ');
    if (localInfo) {
        drawTextFontCenteredHalo(rgba, W, H, fonts.micro, localInfo, W / 2, yCursor, 148, 163, 184);
        yCursor += fonts.micro.cellH + 8;
    }

    const src = `Fonte: ${ev.source || 'USGS'} - ${ev.reviewed ? 'revisado' : 'automatico'}`;
    drawTextFontCenteredHalo(rgba, W, H, fonts.micro, src, W / 2, yCursor, 148, 163, 184);
    yCursor += fonts.micro.cellH + 56;

    // --- 3 cards de estatística: profundidade, intensidade (MMI), energia ---
    const depthVal = Number.isFinite(ev.depth) ? ev.depth : null;
    const prof = depthVal !== null ? classificarProfundidadeCard(depthVal) : { label: '--', cor: [148, 163, 184] };
    const mmi = estimarMercalliCard(mag, depthVal || 0);
    const energiaStr = calcularEnergiaCard(mag);

    const cardGap = 24, cardMargin = 60;
    const cardW = Math.round((W - cardMargin * 2 - cardGap * 2) / 3);
    const cardTop = yCursor, cardH = 190;
    const stats = [
        { label: 'PROFUNDIDADE', value: depthVal !== null ? `${depthVal} km` : '--', sub: prof.label, cor: prof.cor },
        { label: 'INTENSIDADE (MMI)', value: mmi.nivel, sub: 'estimada', cor: mmi.cor },
        { label: 'ENERGIA', value: energiaStr, sub: 'TNT equiv.', cor: [226, 232, 240] }
    ];
    stats.forEach((s, i) => {
        const cx0 = cardMargin + i * (cardW + cardGap);
        const cxMid = cx0 + cardW / 2;
        if (i > 0) fillRect(rgba, W, cx0 - cardGap / 2, cardTop, 1, cardH, 100, 116, 139, 70);
        drawTextFontCenteredHalo(rgba, W, H, fonts.micro, s.label, cxMid, cardTop + 4, 148, 163, 184);
        drawTextFontCenteredHalo(rgba, W, H, fonts.small, s.value, cxMid, cardTop + 44, s.cor[0], s.cor[1], s.cor[2]);
        drawTextFontCenteredHalo(rgba, W, H, fonts.micro, s.sub, cxMid, cardTop + 88, s.cor[0], s.cor[1], s.cor[2]);
    });
    yCursor = cardTop + cardH + 20;

    // --- mecanismo focal ---
    fillRect(rgba, W, cardMargin, yCursor, W - cardMargin * 2, 1, 100, 116, 139, 60);
    yCursor += 40;
    const mec = calcularMecanismoFocalCard(depthVal || 0, ev.lat, ev.lon, place);
    const iconCx = cardMargin + 34, iconCy = yCursor + 20;
    fillCircle(rgba, W, H, iconCx, iconCy, 34, 30, 41, 59, 255);
    drawMechanismIcon(rgba, W, H, iconCx, iconCy, 30, mec.kind, 226, 232, 240);
    if (mec.kind === 'unknown') {
        drawTextFontHalo(rgba, W, H, fonts.small, '?', iconCx - Math.round(fonts.small.cellW / 2), iconCy - Math.round(fonts.small.cellH / 2), 226, 232, 240);
    }
    drawTextFontHalo(rgba, W, H, fonts.small, mec.tipo, iconCx + 54, iconCy - fonts.small.cellH + 4, 226, 232, 240);
    drawTextFontHalo(rgba, W, H, fonts.micro, mec.desc, iconCx + 54, iconCy + 10, 148, 163, 184);
    yCursor = iconCy + 34 + 40;

    // --- rodapé marca: translúcido, o mapa continua aparecendo por baixo
    // (texto com halo garante leitura mesmo sem fundo sólido) ---
    fillRect(rgba, W, 0, H - 64, W, 64, 10, 16, 28, 130);
    drawTextFontHalo(rgba, W, H, fonts.small, 'monitorglobal.top', cardMargin, Math.round(H - 64 + (64 - fonts.small.cellH) / 2), 56, 189, 248);
    const subtitle = 'Telegram: Monitor Global';
    const subtitleW = textFontWidth(fonts.micro, subtitle);
    drawTextFontHalo(rgba, W, H, fonts.micro, subtitle, W - cardMargin - subtitleW, Math.round(H - 64 + (64 - fonts.micro.cellH) / 2), 100, 116, 139);

    return rgbaToPng(rgba, W, H);
}


function staticMapUrls(lat, lon, zoom = 5, imgW = 800, imgH = 440) {
    const la = Number(lat);
    const lo = Number(lon);
    const z = Math.max(3, Math.min(10, zoom | 0));
    // bbox a partir do zoom (graus). O span horizontal só depende do zoom
    // (é ele quem define o grau/pixel usado também na barra de escala);
    // o span vertical é derivado da proporção imgH/imgW pra manter o
    // mesmo grau/pixel nos dois eixos — assim o Esri não precisa
    // esticar/cortar nada pra caber, seja numa caixa 800x440 ou, como
    // agora, numa imagem 800x1440 (mapa cobrindo o cartão inteiro).
    const span = 180 / Math.pow(2, z);
    const minLon = lo - span;
    const maxLon = lo + span;
    const vSpan = span * (imgH / imgW);
    const minLat = la - vSpan;
    const maxLat = la + vSpan;
    const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
    const yandexLl = `${lo.toFixed(5)},${la.toFixed(5)}`;
    return [
        // 1) Esri World Imagery — satélite de verdade, sem chave, tamanho exato
        // (evita upscaling/serrilhado e mantém o epicentro no centro exato)
        `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${encodeURIComponent(bbox)}&bboxSR=4326&imageSR=4326&size=${imgW},${imgH}&format=png&f=image`,
        // 2) Yandex satélite (fallback — hoje exige API key fora da Rússia
        // pra uso comercial, então pode falhar; o drawImageCover recorta/
        // estica pro tamanho do cartão mesmo se vier numa proporção diferente)
        `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${yandexLl}&z=${z}&l=sat&size=650,450`,
        // 3) Yandex esquemático — último recurso, só pra não cair no fallback decorativo
        `https://static-maps.yandex.ru/1.x/?lang=en_US&ll=${yandexLl}&z=${z}&l=map&size=650,450`
    ];
}

// Escapa os caracteres especiais do Markdown "legado" do Telegram
// (_ * ` [) em qualquer texto vindo de fonte externa (ex.: nome de
// local da USGS/EMSC), pra nunca mais quebrar o parser lá do Telegram
// com "can't parse entities" por causa de um caractere fora do nosso
// controle — foi exatamente isso que aconteceu com o @monitor_global.
function escapeMdLegacy(str) {
    return String(str ?? '').replace(/([_*`[])/g, '\\$1');
}

function telegramCaption(ev) {
    const mag = Number(ev.mag).toFixed(1);
    const place = escapeMdLegacy(ev.place || 'Local desconhecido');
    const depth = Number.isFinite(ev.depth) ? `${ev.depth} km` : '—';
    const when = ev.timeIso
        ? new Date(ev.timeIso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' BRT'
        : '—';
    const src = escapeMdLegacy(ev.source || 'USGS');
    const status = ev.reviewed ? 'revisado' : 'automático';
    return (
        `🌍 *M${mag}* — ${place}\n` +
        `📐 Profundidade: ${depth}\n` +
        `🕒 ${when}\n` +
        `📡 Fonte: ${src} · ${status}\n` +
        `\n📢 Canal: @monitor\\_global\n` +
        `🌐 https://monitorglobal.top`
    );
}

/** Gera o card PNG (magnitude + textos + marca) e envia no Telegram. */
async function telegramSendPhoto(env, ev, caption) {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados');

    const png = await renderAlertCardPng(ev);

    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', caption.slice(0, 1024));
    form.append('parse_mode', 'Markdown');
    form.append('photo', new Blob([png], { type: 'image/png' }), 'monitor-global-alerta.png');

    const api = `https://api.telegram.org/bot${token}/sendPhoto`;
    const r = await fetch(api, { method: 'POST', body: form });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) {
        throw new Error(data.description || `Telegram HTTP ${r.status}`);
    }
    return data;
}

async function telegramSendMessage(env, text) {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) throw new Error('TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados');

    const api = `https://api.telegram.org/bot${token}/sendMessage`;
    const r = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text.slice(0, 4000),
            parse_mode: 'Markdown',
            disable_web_page_preview: false
        })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) {
        throw new Error(data.description || `Telegram HTTP ${r.status}`);
    }
    return data;
}

async function loadSentAlertIds(request) {
    try {
        const hit = await caches.default.match(cacheKey(request, TELEGRAM_ALERT_CACHE_PATH));
        if (!hit) return new Set();
        const d = await hit.json();
        return new Set(Array.isArray(d.ids) ? d.ids : []);
    } catch {
        return new Set();
    }
}

async function saveSentAlertIds(request, idSet) {
    const ids = [...idSet].slice(-200); // mantém os 200 mais recentes
    try {
        const response = new Response(JSON.stringify({ ids, updatedAt: nowIso() }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${TELEGRAM_ALERT_TTL}`
            }
        });
        await caches.default.put(cacheKey(request, TELEGRAM_ALERT_CACHE_PATH), response);
    } catch (e) {
        console.warn('telegram cache write:', e?.message || e);
    }
}

async function fetchUsgsM6Recent() {
    const start = new Date(Date.now() - 6 * 3600000).toISOString(); // últimas 6h
    const url =
        'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
        `&starttime=${encodeURIComponent(start)}` +
        `&minmagnitude=${TELEGRAM_MIN_MAG}` +
        '&orderby=time&limit=30';
    const d = await fetchJson(url, {}, 15000);
    const out = [];
    for (const f of d.features || []) {
        const p = f.properties || {};
        const c = f.geometry?.coordinates || [];
        const mag = Number(p.mag);
        const lon = Number(c[0]);
        const lat = Number(c[1]);
        const depth = Number(c[2]);
        if (![mag, lat, lon].every(Number.isFinite) || mag < TELEGRAM_MIN_MAG) continue;
        const id = String(f.id || p.code || `${mag}-${lat}-${lon}-${p.time}`);
        out.push({
            id,
            mag,
            place: p.place || 'Região não informada',
            lat,
            lon,
            depth: Number.isFinite(depth) ? Math.round(depth) : null,
            timeIso: p.time ? new Date(p.time).toISOString() : null,
            source: (p.net || 'USGS').toUpperCase(),
            reviewed: String(p.status || '').toLowerCase() === 'reviewed',
            url: p.url || 'https://monitorglobal.top'
        });
    }
    return out;
}

async function runTelegramM6Alerts(request, env) {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        return {
            ok: false,
            skipped: true,
            reason: 'Secrets TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID não configurados',
            sent: []
        };
    }

    const events = await fetchUsgsM6Recent();
    const sentIds = await loadSentAlertIds(request);
    const sent = [];
    const skipped = [];

    for (const ev of events) {
        if (sentIds.has(ev.id)) {
            skipped.push(ev.id);
            continue;
        }
        try {
            const caption = telegramCaption(ev);
            try {
                await telegramSendPhoto(env, ev, caption);
            } catch (photoErr) {
                // Fallback: só texto, se o mapa estático falhar
                console.warn('sendPhoto falhou, fallback texto:', photoErr.message);
                await telegramSendMessage(
                    env,
                    caption + `\n\n🗺 ${ev.lat.toFixed(2)}, ${ev.lon.toFixed(2)}\n${escapeMdLegacy(ev.url)}`
                );
            }
            sentIds.add(ev.id);
            sent.push({ id: ev.id, mag: ev.mag, place: ev.place });
        } catch (e) {
            console.error('Telegram alerta falhou:', ev.id, e.message);
        }
    }

    if (sent.length) await saveSentAlertIds(request, sentIds);

    return {
        ok: true,
        checked: events.length,
        sent,
        alreadySent: skipped.length,
        minMag: TELEGRAM_MIN_MAG,
        updatedAt: nowIso()
    };
}

async function handleTelegramTest(env) {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        return json({
            ok: false,
            error: 'Configure os secrets TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID no Cloudflare Worker'
        }, 400);
    }
    // Evento fictício só para validar entrega do card
    const demo = {
        mag: 6.2,
        place: 'Teste - Offshore Valparaiso, Chile',
        lat: -33.1,
        lon: -71.8,
        depth: 28,
        timeIso: new Date().toISOString(),
        source: 'TESTE',
        reviewed: true
    };
    const caption =
        telegramCaption(demo) +
        '\n\n_Mensagem de teste do Monitor Global_';
    try {
        await telegramSendPhoto(env, demo, caption);
        return json({ ok: true, mode: 'card', message: 'Card de teste enviado no Telegram' });
    } catch (e) {
        try {
            await telegramSendMessage(env, caption + '\n\n(fallback texto: ' + e.message + ')');
            return json({ ok: true, mode: 'text-fallback', warning: e.message });
        } catch (e2) {
            return json({ ok: false, error: e2.message }, 502);
        }
    }
}

async function handleTelegramM6Check(request, env) {
    try {
        const result = await runTelegramM6Alerts(request, env);
        return json(result, result.skipped && !result.ok ? 400 : 200);
    } catch (e) {
        return json({ ok: false, error: e.message, updatedAt: nowIso() }, 502);
    }
}


// =========================================================
// HANDLER PRINCIPAL
// =========================================================


function saoPauloParts(date=new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA',{
        timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',hour12:false
    }).formatToParts(date);
    const o={}; for(const p of parts)o[p.type]=p.value; return o;
}
function saoPauloYmdOffset(days=0) {
    const p=saoPauloParts();
    const d=new Date(Date.UTC(+p.year,+p.month-1,+p.day+days));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
async function fetchDailyQuakesBrt() {
    const day=saoPauloYmdOffset(-1), today=saoPauloYmdOffset(0);
    const start=`${day}T03:00:00.000Z`, end=`${today}T03:00:00.000Z`;
    const u='https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
      `&starttime=${encodeURIComponent(start)}&endtime=${encodeURIComponent(end)}` +
      '&minmagnitude=0.1&orderby=magnitude&limit=1000';
    const d=await fetchJson(u,{},20000);
    const events=(d.features||[]).map(f=>{
        const p=f.properties||{}, c=f.geometry?.coordinates||[];
        return {mag:Number(p.mag),place:p.place||'Região não informada',time:Number(p.time),depth:Number(c[2]),source:(p.net||'USGS').toUpperCase()};
    }).filter(e=>Number.isFinite(e.mag)&&Number.isFinite(e.time));
    return {day,events};
}
async function renderDailySummaryPng() {
    const {day,events}=await fetchDailyQuakesBrt();
    const W=800,H=1440,rgba=new Uint8Array(W*H*4),fonts=await getFontAtlases();
    fillRect(rgba,W,0,0,W,H,4,10,22);
    fillRect(rgba,W,0,0,W,170,2,8,22,245);
    drawTextFontHalo(rgba,W,H,fonts.small,'MONITOR GLOBAL',34,30,56,189,248);
    drawTextFontHalo(rgba,W,H,fonts.micro,'RESUMO DO DIA',34,70,148,163,184);
    drawTextFontHalo(rgba,W,H,fonts.micro,sanitizeFontText(`${day.split('-').reverse().join('/')} · 00:00-23:59 BRT`),34,103,148,163,184);
    drawTextFontCenteredHalo(rgba,W,H,fonts.small,'TOP 5 SISMOS',W/2,205,248,250,252);
    drawTextFontCenteredHalo(rgba,W,H,fonts.micro,`Total registrado: ${events.length}`,W/2,242,148,163,184);

    const top=events.slice().sort((a,b)=>b.mag-a.mag).slice(0,5);
    let y=292;
    top.forEach((e,i)=>{
        const c=getHexColorFromMag(e.mag);
        fillRect(rgba,W,38,y-15,724,150,10,16,30,245);
        fillRect(rgba,W,38,y-15,5,150,c[0],c[1],c[2],255);
        // Magnitude separada do texto para nunca haver sobreposição.
        // O atlas HERO é 68 px por caractere; 'M4.8' ocuparia 272 px.
        // Usamos M pequeno + valor HERO, deixando uma coluna livre para o local.
        drawTextFontHalo(rgba,W,H,fonts.small,'M',50,y+30,c[0],c[1],c[2]);
        drawTextFontHalo(rgba,W,H,fonts.hero,e.mag.toFixed(1),76,y,c[0],c[1],c[2]);
        const safePlace=sanitizeFontText(e.place);
        const lines=wrapText(safePlace,27,3);
        lines.forEach((line,j)=>drawTextFontHalo(rgba,W,H,fonts.small,sanitizeFontText(line),300,y+2+j*(fonts.small.cellH+3),226,232,240));
        const when=new Date(e.time).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
        drawTextFontHalo(rgba,W,H,fonts.micro,sanitizeFontText(when),300,y+103,148,163,184);
        drawTextFontHalo(rgba,W,H,fonts.micro,sanitizeFontText(`Prof. ${Number.isFinite(e.depth)?Math.round(e.depth)+' km':'--'} · ${e.source}`),300,y+126,148,163,184);
        drawTextFontHalo(rgba,W,H,fonts.micro,`${i+1}.`,728,y+8,100,116,139);
        y+=170;
    });
    if(!top.length) drawTextFontCenteredHalo(rgba,W,H,fonts.small,'Nenhum sismo registrado',W/2,330,148,163,184);
    y=Math.min(y+18,1250);
    fillRect(rgba,W,40,y,720,1,100,116,139,60); y+=34;
    drawTextFontCenteredHalo(rgba,W,H,fonts.micro,
        sanitizeFontText(`M6+: ${events.filter(e=>e.mag>=6).length} · M5+: ${events.filter(e=>e.mag>=5).length} · M4+: ${events.filter(e=>e.mag>=4).length}`),
        W/2,y,226,232,240);
    y+=34;
    drawTextFontCenteredHalo(rgba,W,H,fonts.micro,sanitizeFontText(`Demais registros: ${events.filter(e=>e.mag<4).length}`),W/2,y,148,163,184);
    fillRect(rgba,W,0,H-70,W,70,10,16,28,230);
    drawTextFontHalo(rgba,W,H,fonts.small,'monitorglobal.top',34,H-44,56,189,248);
    drawTextFontHalo(rgba,W,H,fonts.micro,sanitizeFontText('Telegram · at monitor_global'),W-310,H-40,148,163,184);
    return {day,png:await rgbaToPng(rgba,W,H),top,total:events.length};
}
const TELEGRAM_DAILY_CACHE_PATH='/__cache/monitor-global/telegram-daily-summary';
async function dailySummarySent(request,day){
    try{
        const hit=await caches.default.match(cacheKey(request,TELEGRAM_DAILY_CACHE_PATH));
        if(!hit)return false;
        const d=await hit.json(); return d.day===day;
    }catch{return false;}
}
async function markDailySummarySent(request,day){
    try{
        await caches.default.put(cacheKey(request,TELEGRAM_DAILY_CACHE_PATH),
            new Response(JSON.stringify({day,sentAt:nowIso()}),{
                headers:{'Content-Type':'application/json','Cache-Control':'public,max-age=172800'}
            }));
    }catch(e){console.warn('daily summary cache:',e?.message||e);}
}
async function runTelegramDailySummary(request,env){
    if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID)
        return {ok:false,skipped:true,reason:'Secrets Telegram ausentes'};
    const force = new URL(request.url).searchParams.get('force') === '1';
    const p=saoPauloParts(), hour=Number(p.hour), minute=Number(p.minute);
    // Janela automática de segurança. ?force=1 permite teste manual pelo navegador.
    if(!force && (hour!==0 || minute>20)) return {ok:true,skipped:true,reason:'fora da janela 00:00–00:20 BRT'};
    const day=saoPauloYmdOffset(-1);
    if(await dailySummarySent(request,day)) return {ok:true,skipped:true,reason:'resumo já enviado',day};
    const pack=await renderDailySummaryPng();
    const form=new FormData();
    form.append('chat_id',String(env.TELEGRAM_CHAT_ID));
    form.append('caption',
        `📊 *Resumo do dia — ${day.split('-').reverse().join('/')}*\\n` +
        `🌍 ${pack.total} sismos registrados\\n` +
        `🏆 Maior: ${pack.top[0]?`M${pack.top[0].mag.toFixed(1)} — ${escapeMdLegacy(pack.top[0].place)}`:'sem registro'}\\n` +
        `🌐 monitorglobal.top`);
    form.append('parse_mode','Markdown');
    form.append('photo',new Blob([pack.png],{type:'image/png'}),'monitor-global-resumo.png');
    const api=`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const r=await fetch(api,{method:'POST',body:form});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok) throw new Error(data.description||`Telegram HTTP ${r.status}`);
    await markDailySummarySent(request,day);
    return {ok:true,day,total:pack.total};
}


export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
        const reqUrl = new URL(request.url);

        if (reqUrl.pathname === '/health') {
            return json({
                ok: true,
                service: 'Monitor Global Worker',
                version: '7.6.0',
                time: nowIso(),
                cacheApi: true,
                kv: false,
                funvisis: true,
                telegramM6: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID)
            });
        }
        if (reqUrl.pathname === '/sp-clima') {
            try { return await handleSpClima(request, env); }
            catch (e) { return json({ error: 'Falha ao montar dados de SP', detail: e.message }, 502); }
        }
        if (reqUrl.pathname === '/correlate') {
            try { return await handleCorrelation(reqUrl, env); }
            catch (e) { return json({ error: 'Falha na correlação inteligente', detail: e.message }, 502); }
        }
        if (reqUrl.pathname === '/v70-extremes') { try { return await handleV70Extremes(env); } catch (e) { return json({ error: 'Falha nos extremos térmicos', detail: e.message }, 502); } }
        if (reqUrl.pathname === '/v70-anomaly') { try { return await handleV70Anomaly(env); } catch (e) { return json({ error: 'Falha na anomalia térmica', detail: e.message }, 502); } }
        if (reqUrl.pathname === '/v70-cyclones') { try { return await handleV70Cyclones(env); } catch (e) { return json({ error: 'Falha nos ciclones NHC', detail: e.message }, 502); } }
        if (reqUrl.pathname === '/v70-impact') { try { return await handleV70Impact(reqUrl, env); } catch (e) { return json({ error: 'Falha no impacto local', detail: e.message }, 502); } }
        if (reqUrl.pathname === '/usgs-volcano') { return await handleUsgsVolcano(); }
        if (reqUrl.pathname === '/gdacs-volcano') { return await handleGdacsVolcano(); }
        if (reqUrl.pathname === '/global-volcano') { return await handleGlobalVolcanoAdvisories(); }
        if (reqUrl.pathname === '/gdacs-floods') { return await handleGdacsFloods(); }
        if (reqUrl.pathname === '/afad-earthquakes') { return await handleAfadEarthquakes(reqUrl); }
        if (reqUrl.pathname === '/ingv-earthquakes') { return await handleIngvEarthquakes(reqUrl); }
        if (reqUrl.pathname === '/jma-earthquakes') { return await handleJmaEarthquakes(); }
        if (reqUrl.pathname === '/funvisis-earthquakes') { return await handleFunvisisEarthquakes(reqUrl); }
        if (reqUrl.pathname === '/seismic-status') { return await handleSeismicStatus(); }
        if (reqUrl.pathname === '/telegram-test') { return await handleTelegramTest(env); }
        if (reqUrl.pathname === '/telegram-daily-summary') { try { return json(await runTelegramDailySummary(request, env)); } catch(e) { return json({ok:false,error:e.message},502); } }
        if (reqUrl.pathname === '/telegram-m6-check') { return await handleTelegramM6Check(request, env); }
        if (reqUrl.pathname === '/telegram-card-preview') {
            try {
                const demo = {
                    mag: Number(reqUrl.searchParams.get('mag') || 6.2),
                    place: reqUrl.searchParams.get('place') || 'Offshore Valparaiso, Chile',
                    lat: Number(reqUrl.searchParams.get('lat') || -33.1),
                    lon: Number(reqUrl.searchParams.get('lon') || -71.8),
                    depth: Number(reqUrl.searchParams.get('depth') || 28),
                    timeIso: new Date().toISOString(),
                    source: reqUrl.searchParams.get('source') || 'USGS',
                    reviewed: true
                };
                const png = await renderAlertCardPng(demo);
                return new Response(png, {
                    status: 200,
                    headers: {
                        'Content-Type': 'image/png',
                        'Cache-Control': 'no-store',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            } catch (e) {
                return json({ ok: false, error: e.message }, 502);
            }
        }
        if (reqUrl.pathname === '/global-feeds') {
            try { return await handleGlobalFeeds(request, env); }
            catch (e) { return json({ error: 'Falha nos feeds globais', detail: e.message }, 502); }
        }
        if (reqUrl.pathname === '/weatherapi') return await handleWeatherApi(reqUrl, env);
        if (reqUrl.pathname === '/redemet-metar') return await handleRedemet(reqUrl, env);

        const target = reqUrl.searchParams.get('url');
        if (!target) return json({ error: 'Faltou o parâmetro ?url=' }, 400);

        let targetUrl;
        try { targetUrl = new URL(target); } catch { return json({ error: 'URL inválida' }, 400); }

        if (targetUrl.protocol !== 'https:') return json({ error: 'Somente HTTPS é permitido' }, 403);
        if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) return json({ error: 'Domínio não permitido', host: targetUrl.hostname }, 403);

        // Normaliza parâmetros FDSN por host ANTES de qualquer fetch. O frontend
        // pede minmagnitude=0.1&limit=1000 para todas as agências, mas GEOFON,
        // ISC e INGV rejeitam essa combinação com HTTP 400. Aqui a gente
        // reescreve para o piso/limite real de cada servidor.
        targetUrl = clampFdsnParams(targetUrl);

        const headers = {
            'Accept': 'application/json, application/geo+json, text/plain, application/xml, text/xml, */*',
            'User-Agent': 'Mozilla/5.0 (compatible; MonitorGlobal/6.1)',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };

        if (targetUrl.hostname === 'sws.cemaden.gov.br') {
            headers.Referer = 'https://mapainterativo.cemaden.gov.br/';
            headers.Origin  = 'https://mapainterativo.cemaden.gov.br';
        }

        try {
            const upstream = await fetchText(targetUrl.toString(), { method: 'GET', headers }, 15000);

            // Se a fonte devolveu 2xx mas o corpo não é JSON nem XML, é resposta
            // inválida disfarçada de sucesso (ex.: página de bloqueio, texto puro).
            // Devolve 502 com preview pro cliente em vez de repassar como 200.
            const trimmed = (upstream.text || '').trim();
            const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[');
            const looksXml  = /^\s*<\?xml|^\s*<(rss|feed|entry|html)/i.test(trimmed);

            if (upstream.ok && !looksJson && !looksXml) {
                return json({
                    error: 'Resposta upstream não-JSON',
                    host: targetUrl.hostname,
                    status: upstream.status,
                    preview: trimmed.slice(0, 120)
                }, 502);
            }

            // Se a fonte devolveu 4xx/5xx com corpo não-JSON (ex.: ISC manda
            // "Error 400:" em texto puro), normaliza pra JSON de erro limpo.
            if (!upstream.ok && !looksJson && !looksXml) {
                return json({
                    error: 'Upstream rejeitou',
                    host: targetUrl.hostname,
                    status: upstream.status,
                    preview: trimmed.slice(0, 120)
                }, upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502);
            }

            return resposta(upstream.text, upstream.status, upstream.contentType || 'application/json');
        } catch (e) {
            return json({ error: 'Falha ao consultar fonte externa', host: targetUrl.hostname, detail: e.message, timestamp: nowIso() }, 502);
        }
    },


    async scheduled(event, env, ctx) {
        const baseUrl = 'https://black-sky-9ba0.terrestre.workers.dev/';
        const cacheRequest = new Request(baseUrl, { method: 'GET' });
        ctx.waitUntil((async () => {
            try { await refreshSpClimaCache(cacheRequest, env); } catch (e) { console.error('Cron SP:', e); }
            try { await refreshGlobalFeedsCache(cacheRequest, env); } catch (e) { console.error('Cron global:', e); }
            try { await runTelegramM6Alerts(cacheRequest, env); } catch (e) { console.error('Cron Telegram M6:', e); }
            try { await runTelegramDailySummary(cacheRequest, env); } catch (e) { console.error('Cron Telegram resumo diário:', e); }
        })());
    }
};