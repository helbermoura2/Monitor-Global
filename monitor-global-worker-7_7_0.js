// =========================================================
// MONITOR GLOBAL — Cloudflare Worker
// Versão 7.7.0 — Telegram diário + vulcanismo global (GDACS/USGS/VAAC/GVP) + FUNVISIS + clamp FDSN
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
    'api.gael.cloud', // CSN Chile
    'www.ssn.unam.mx', // SSN México
    'www.snirh.gov.br', // ANA — nível de rios (Rede Hidrometeorológica Nacional)
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


// Coordenadas de vulcões conhecidos, usadas como fallback quando a fonte (VAAC
// texto ICAO, relatório semanal do GVP) não traz lat/lon diretamente.
const KNOWN_VOLCANO_COORDS = {
    'sakurajima aira caldera':[31.593,130.657], 'sakurajima':[31.593,130.657], 'aira':[31.593,130.657],
    'mayon':[13.257,123.685], 'kanlaon':[10.412,123.132],
    'asosan':[32.884,131.104], 'suwanosejima':[29.638,129.714], 'kirishima':[31.934,130.862],
    'krakatau':[-6.102,105.423], 'anak krakatau':[-6.102,105.423],
    'dukono':[1.693,127.894], 'great sitkin':[52.076,-176.130], 'ibu':[1.488,127.630],
    'karangetang':[2.781,125.407], 'kilauea':[19.421,-155.287],
    'klyuchevskoy':[56.056,160.642], 'krasheninnikov':[54.593,159.813],
    'lewotolok':[-8.274,123.505], 'merapi':[-7.540,110.446], 'purace':[2.320,-76.397],
    'rincon de la vieja':[10.830,-85.324], 'sabancaya':[-15.787,-71.857],
    'semeru':[-8.108,112.922], 'sheveluch':[56.653,161.360], 'sinabung':[3.170,98.392],
    'lewotobi':[-8.542,122.775], 'lewotobi laki-laki':[-8.542,122.775],
    'nevados de chillan':[-36.868,-71.378], 'chillan':[-36.868,-71.378]
};
function lookupKnownVolcanoCoords(name) {
    return KNOWN_VOLCANO_COORDS[normVolcanoName(name)] || null;
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
            const known = lookupKnownVolcanoCoords(name);
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

function parseWeeklyVolcanicReport(html) {
    // Relatório Semanal de Atividade Vulcânica (Smithsonian GVP / USGS): uma
    // tabela HTML com todos os vulcões relatados na semana, de qualquer país —
    // é a fonte que cobre o que fica fora do escopo do USGS (só EUA) e do
    // GDACS (critério de risco próprio, às vezes sem certos vulcões/erupções).
    // Só "New Activity/Unrest" vira alerta novo aqui; "Continuing Activity" é
    // rotina de vulcões já sempre ativos (Kilauea, Merapi etc.) e viraria
    // ruído se replotasse toda semana.
    const out = [];
    const rows = [...String(html || '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
    for (const row of rows) {
        const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]);
        if (cells.length < 5) continue;
        const nameCell = cells[0];
        const name = nameCell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!name || /^volcano$/i.test(name)) continue;
        const vnum = (nameCell.match(/vn=(\d+)/i) || [, ''])[1];
        const country = cells[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const startDate = cells[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const reportType = cells[4].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (!/new activity|unrest/i.test(reportType)) continue;
        const known = lookupKnownVolcanoCoords(name);
        if (!known) continue; // sem coordenada conhecida, não dá pra plotar no mapa
        out.push({
            id: `gvp-weekly-${vnum || name}`.replace(/\s+/g, '-'),
            type: 'volcano', name, vnum, coords: [known[1], known[0]],
            source: 'Smithsonian GVP', country, startDate, time: Date.now(),
            detail: `Nova atividade eruptiva/unrest (${country || 'relatório semanal'})${startDate && startDate !== '—' ? ' desde ' + startDate : ''}`,
            ashStatus: reportType, aviationColor: '', alertLevel: 'WARNING', elevated: true
        });
    }
    return out;
}

async function getGlobalVolcanoAdvisories() {
    const settled = await Promise.allSettled([
        fetchText('https://www.bom.gov.au/products/Volc_ash_latest.shtml',
            {headers:{'User-Agent':'MonitorGlobal/7.6','Accept':'text/html,*/*'}}, 15000),
        fetchText('https://www.data.jma.go.jp/vaac/data/vaac_list.html',
            {headers:{'User-Agent':'MonitorGlobal/7.6','Accept':'text/html,*/*'}}, 15000),
        fetchText('https://volcano.si.edu/reports_weekly.cfm',
            {headers:{'User-Agent':'MonitorGlobal/7.7','Accept':'text/html,*/*'}}, 18000)
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
            const known = lookupKnownVolcanoCoords(name);
            if (!known) continue; // sem coordenada conhecida, não dá pra plotar no mapa
            items.push({
                id:`vaac-TOKYO-${name}-${time}`.replace(/\s+/g,'-'),
                type:'volcano', name, vnum:'', coords:[known[1],known[0]],
                source:'VAAC TOKYO', area, advisory:cells[3]||'', time,
                detail:'Volcanic Ash Advisory (Tokyo VAAC)',
                ashStatus:'Aviso de cinzas vulcânicas', aviationColor:'',
                alertLevel:'WARNING', elevated:true
            });
        }
    } else errors.push('Tokyo VAAC indisponível');

    if (settled[2] && settled[2].status === 'fulfilled' && settled[2].value.ok) {
        items.push(...parseWeeklyVolcanicReport(settled[2].value.text));
    } else errors.push('GVP weekly report indisponível');

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

const FONT_ATLAS_TITLE_B64 =
    "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";
const FONT_TITLE_CELL_H = 36;
const FONT_TITLE_GLYPHS = {"0":[1018,15],"1":[1036,15],"2":[1054,15],"3":[1072,15],"4":[1090,15],"5":[1108,15],"6":[1126,15],"7":[1144,15],"8":[1162,15],"9":[1180,15]," ":[0,8],"A":[11,19],"B":[33,19],"C":[55,19],"D":[77,19],"E":[99,18],"F":[120,16],"G":[139,21],"H":[163,19],"I":[185,8],"J":[196,15],"K":[214,19],"L":[236,16],"M":[255,22],"N":[280,19],"O":[302,21],"P":[326,18],"Q":[347,21],"R":[371,19],"S":[393,18],"T":[414,16],"U":[433,19],"V":[455,18],"W":[476,25],"X":[504,18],"Y":[525,18],"Z":[546,16],"a":[565,15],"b":[583,16],"c":[602,15],"d":[620,16],"e":[639,15],"f":[657,9],"g":[669,16],"h":[688,16],"i":[707,8],"j":[718,8],"k":[729,15],"l":[747,8],"m":[758,24],"n":[785,16],"o":[804,16],"p":[823,16],"q":[842,16],"r":[861,11],"s":[875,15],"t":[893,9],"u":[905,16],"v":[924,15],"w":[942,21],"x":[966,15],"y":[984,15],"z":[1002,13],".":[1198,8],",":[1209,8],":":[1220,9],";":[1232,9],"-":[1244,9],"+":[1256,16],"/":[1275,8],"?":[1286,16],"%":[1305,24],"(":[1332,9],")":[1344,9],"·":[1356,9],"°":[1368,11],"~":[1382,16],"'":[1401,7],"Á":[1411,19],"À":[1433,19],"Â":[1455,19],"Ã":[1477,19],"É":[1499,18],"Ê":[1520,18],"Í":[1541,8],"Ó":[1552,21],"Ô":[1576,21],"Õ":[1600,21],"Ú":[1624,19],"Ü":[1646,19],"Ç":[1668,19],"á":[1690,15],"à":[1708,15],"â":[1726,15],"ã":[1744,15],"é":[1762,15],"ê":[1780,15],"í":[1798,8],"ó":[1809,16],"ô":[1828,16],"õ":[1847,16],"ú":[1866,16],"ü":[1885,16],"ç":[1904,15]};

const FONT_ATLAS_CAPTION_B64 =
    "iVBORw0KGgoAAAANSUhEUgAABPgAAAAWCAYAAABdRiJ7AAAeI0lEQVR4nO1dCZBVxdV+NUVRUlKk+CmwkIqxXFJuBW4FRiVFVNCopRj3RBH8jcbld99DovmN" +
    "+4IaJa5ZNIjGBBfiguIOKJvLiBtB9mFHMoAMMMOcf7r+7zhn7u3t3vfmvTdwviqKed197u3bt2/36a/POV0oKBQKhUKhUCgUCoVCoVAoFAqFQqFQKBQKhUKh" +
    "UCgUCoVCoVAoFAqFQqFQKBQKhUKhUCgUCoVCoVAoFAqFQqFQKBTZQETDiGgUER1b6br4QETXoJ77t9P1r8T1+2eQ+QFkbmyPOgXu3ZWI7sD9u5f7/gqFQqFQ" +
    "KBQKhUKhUCgUCg+I6E76fzwYWf5WItpCRI9nvM/PILeaiNbFkGctdepJRDOJqI6Iriei3fD3oZH3/D4RfUFEK4noyEiZ36A9VhHRPCLqFSi/MxF9RUTLieiI" +
    "iOtfguu/SkTfi6xTt5b2qyWi/xBRMxHdHSMH2XshN4aIfkREDxPRQ7HyuMZ4Imoiopsjy28iopuE7KdZ7qdQKBQKhUKhUCgUCoVCoYgEEd1DRMuI6ISMckOI" +
    "aBER/SWy/N5EtNYQU0S0PRH9E+RZt4DceUT0byI6HSSawWIi6hxxz+/jHhOIaMfIehoS8tuWe5wD+Q+J6HVP+Z2IaD5IrB0irj+YiDbHEmVC7jki+oyI9kBb" +
    "GIL09Ai57UC2GVLxr9SKozPceyQR1RPRSRlkDGn8U/xt2vLqWFmFQqFQKBSKqkCLArMBitMeZb7v2lLeFwqrUYjX47peBTzympnbJiQTeu6s94RSb/DD2Doq" +
    "FAqFonRga6tK1yMJIvofzA8TE+lvIv3CIq49BNZZCw0ZUpIKbyUAobWf+H2oztHxIKIuksyDm++gytaq9IALcS30OKelJvTbr2HRuE/ktfuC4DS4IVD2NFio" +
    "vkVEZxDRyYaYjrzPPbjHbYFyvUBcG/wjUNaQ6R8QUQMRnRIoOwjlamPcsInoJdTBEM9dA2VrsK74BiT/Xi3j3hQi+lXoPpAfCqL6/Vir14qDiHoTUSMaaVFE" +
    "eRuWmh0GIjo+INsPJsEL0VAsd2aG+32DCfhu3wt11FPC+mEFZJ7x3M9MAs+j0zfAtHpSy0d5GRF1iqjnwYn0XyF9dkDuR65ro9yyxDMMj60Hdl4mIP0jIvqv" +
    "2PoH6sRoSu5qEdFjIv/OgPz0RPquvjZDmd1bBstx4j2ZQfbTlnf0e9+OnKUvNGMXz+yaHRZ43lLdkyBv3sVNZuB0yHU3u3PY+fsPdtrM3382k6tDZrbjft/B" +
    "IrOryO6dyBuK9DUWuTeQ9wdL3l3Ie8eSxxPKCJF2tKjDDSJ9gOhjXRPX+SnenyFodhbpuwjS5hjL/W9Enhl/ahJ5nyDv94729aEk8Uy2IoLvVlxvOhGda8ah" +
    "ElwzD8F3O+K9WN1jUE9fvhJ8HRAtyuhReA9R7lQKN4zOAKuNf+N7MHPXQQEZM6YvwTv4U6Ds3rAsWYZ5zijfZ3jKH9iyWH8Brmxm3Hov1iqEiGagTss8ZVY6" +
    "xngraWJ0Q+OqBkskM7dPbanb+Y6yF3nmEKuFD553PNpnPa4/wla20OrqZ8qvwPuaZq4R0z5bA6A7GRfOdx35PeBuaHSAjdBJnmpZG+zpKN+5Rcd9BAtu8w7u" +
    "S+TvgXH/pkC9uqFvGX2mXyKvP/SZJaFFruPa+6IOJubbdVgP7pv1OpY6GXwcKJdp/dlR5AL6HuVcf8bIOddhedchlZAtYm2RS06UycxRCNnx+M69a3KU7QMS" +
    "66sQWSTINHP9EahXan0iyr+BOfcJWGpSctxxyA3HOHJ5oFwnzLO1aFMzj17vKNsZ9VkQmkdA/K4AbxLc1Mda0fBBx6IdxwfKH2zePTgZtsRtkGtAj+xAzJ+P" +
    "RVrumvlhKv42vNCGkEy7AKavJNhhb+BR8fE8icXNAy0K1RykmYnxKIfcsaKzmYFyFj6iLUh7NHC/Wigby0XafM/iSspNtfzbNYeca/E+GB2F2+BzfJBNSJvi" +
    "IWOsA3MJCb6XUXeuXxTBh10X3hmc7hqEXPUP1InEe78ykVcn8kIEn8EFIt1L8LUo84eLdmjCe1oqrjXTRSZY+sXnIm2ta1Fe4ntORb9qRvrDDrm3kf81SL0x" +
    "+NYMPnDIPCvuUYeyq2X/t8jknYRHIG+eJe9L5J1ryXsSeY+ItNtFHSaI9CuQ9r7jeUcj/02RxsTjkw6ZzmJiuFKkX4a0uR6FJTmWTBf1/qVNJiu2IoKP3/Ot" +
    "pbheoUJtowRfxwTiA5ESfMUDCzuCgs+bhatdu/Nig4+td50EH3QU1j2/EWMz2TabsdBkPXcFxmvCfDok8BwjhT7nI/gaUW5U4p+V1AT5Q5irn8AYYOpziKXs" +
    "yZZ5hDfmnrKU74XFNGFu+4v4/QtL+e5iE+0jLHSbsVmd2tztSMCmnnkPuwfKHYnnH+3Ifw35G6GXcT81BHYXS/nzkH8OCDSDE0W+WSh/nNwwtFznesg+58gf" +
    "j/yrvA1hlx0mLXzwXVjXCRmuuQ/qYyVKRblM68+OIifGoVKuP2PkrOuwItchZZetBMGXl6OA7G4YX6Is8gqt4+0dEXPP8S03v4HHCGMFZ8YST/nDTNxI/L09" +
    "niuGlDIGDD+PKHcg3J974PePQbalDJmwwTc00nXczG+/i6xrd7T3AYVWwvQen+5sjIkMUSd+94s9wAbP/JOYsih/bctceyn+PtusU2NlSwow6QaX43+nlVrB" +
    "T0i9i/R7LDJdBMHwoiTl0Mj1mChTTKrtfkb5wYRq8HyWeka0RyY5PNt8yLxiOprI2xlMriEmD89yv1IRfKI8K7NBgg+mxpPw++1IS8msBN9CEAOTRPoRyKvF" +
    "/3d45Fdi4ljOiwUfwQdrRG6D5Hs6XOy8WwPHOvrhACh6BheX455IvxrpqywyXcWEdIBI31Ps7FjJZlF2FORDOyJ5J+EuWJCRXMjAZJowHtiUZSYGPxRpb+Md" +
    "zJb3IqKnUdZqao6J72uUucCQbPh7GU9cDrnDUW41gi/3xN/E8T5iIOpnVdhRZiAI+sUYH98NmP4zoXQoFtb1IEyHemR6YeHHFiSGeDzLU964CkzGvcy4dzF2" +
    "xcjjqroDFq+Lhfm9VZGAEptEt0SZfbEw2gDi4Cyx0HftcMu2eRZtU+uzOi+1i65wf5jkUIa8BB8U5EZYfbyCb2gsrDvGYCFuiIuRnmfia/wgQzuY69+P72Uj" +
    "+srTLmtgcR+D44S1i/n/OI9MX7QNv9dhYrNh78DznAhyIqW/IKbRRFxrPfrvpY7rfZHoe+8m8nsjvSmR7uwLgsy/QqT1xGKiOfm+8U4aeQyEVQ2hLCvVZyHt" +
    "zwnZq5A+U6TdjLS3LHV7BXk3i7ReaNctyXecGPMlxliu3Qd1rmeCSNzvimR55Jt3dKH4VpxB9LHwIfSVzkh7GWn3W8qfivHlYZH2T5R3uiSBrGjATjy5CD4s" +
    "ZijWvRPtvAGkG7fPqdDF+0bI16Bv1Tt0Z7ZuXyXSHrD1G+QxGTVdpP0Jab+OeaasENd/xJHPBKjXkjPiPjfhOlY9XJS7FuVSbluYdwjt3afQqm+tQnrKuAHP" +
    "14i/e6Dc3fh9PcbFoLWc0Imt4yfGOJK6USww7jaBAN8L3/1+EaK+a/I4EdIhM60/O4qcGBfbdf0ZI1fMOqSCsmUl+IrkKIZg82oJyk2URFIHKB+tn+csz7qR" +
    "SzfPo1+2u0xOXS+zTCHHOiwKOM2GsFjqIjqx0zzSNpAgEOgCpNt2Bg9CXqONycUE47J8sQ5c4mNtyCIXQlY50YaNyQGlmPtVkOA7HP7yBNNkr3tcnnZG+WXi" +
    "VKSdkP5H5LES6rPgM8TebVy+0HZwtxF87DJgfU8tC5HfIt960pLnPb2P9JR1Zzve81ykr7XIdBZu2aPzxApob4IP+WypMUqksWumNWgyJhZCn+mGtHXYAf+H" +
    "bCtB3jlPFMNGQRPGPVY2fhbRPmNQ1jzD4/j72ZCckOfd+Bk2IlOUYze1O9A2TVgQuiYkJpQMSfEMdkcJE4Z1bIKLGqENnhC7qzYLyhphMTIHE9JisUPrmrwm" +
    "I38cCEGeK1JxWAzxIpTpyeiL24n8GkHmrccEPRf9wFcHbptZaBseD1d6rKtLRvCJxfOXLmuYCIKP27kWz9AgrvkVFDmGlSAQMp9naAcmZRpBCjIJNsfVf8Wz" +
    "z0PsqLfw+1ub1X2ib/F7nRfRtzj/a8hcl8jfDterx3c3QvTHlGsmFvg8Fpj2uSiRn0fpY9JgokjjeFqTLOX/hbzBhVbSivv3sEJboialBApLucuxsdOAZ7LN" +
    "QSdznxJpFyXrK/J6JCzT+LlHWcqejrx3RRpbwjyRLI98tjzgOSgTsSNi8li9LRJl+4g+Zw34Lki0ZYLgcRF8P0T+UpCB6/B9ucjME1F+PCzH/hdtHxuM/wbI" +
    "uzZCe2HB0ASrjgPw3W+xxUIS+sjzIo1P8/TGWcqLKiT4eG7vH3ndHcR4kZLB823G30wA34k1TwPGGI7b9bJNXzNpeGdNrrWZKNPo2Bwd7LMUEh4N5LFePAJ9" +
    "9JjEnNw5OadhPfmBL/xInvVnR5ETbVkNBF/udUgFZctN8OXiKER/aIb12b24Tr3NUKDayhcy6uc5y4cIvjz6ZbvLlJngi16HRcOYnOIiI/H7Gfy+xCPjwkbX" +
    "qTzC8mZBjjoykiRHV5GX2t331NPglYj72UykU3FUXM8G5VoqwikLr4h6UgUIvkXibyfrb5HLSvCtweBgcC3SF2Gw4EWAj+D7Bn2gjmOGBAi+4bb3JPKPRf6m" +
    "mOeEsnaZMOlO7ayW8J61CddOvmcqhl2hddFWL+SbcI3zQq4ghbaLq/Yk+A5MvitB7DhNoUHmEZTMg/G3UU5/jb9HYuFGGFSd8S9xvfvEM1itgS0yvWG114R/" +
    "a5mkjpA9GjJLfAs53MO8h7tEGseAOtUhw6TKMJH2GdJSYzpM6xl7F1r7julnf7SUH4Ky65kMwu4mwzbh8T3miTQmFcY6noMXWSkXXVEHEub53jok2ubmQuvi" +
    "l13dBwRk8hJ8TNidjzFqpcvFJlHeRfC1eb9YKJJcbIhx3ur2La5xHn73FBa/qXYQixuSsUaFO2ToPrIvsqVLKhh8Cd6rdSEpxqgFgjwyQa7397gVseKXspbN" +
    "qfTtiG9+s7A2ZzLWZvnNrny/xW9j4fV3POvjSOONJRtZ2hNzaT0sIptdLmUgsNhKcq9CW0XY66YnxtzZtsUuyHqDl0Uak4evBa6dieATsewIY6vXJUj0q5W+" +
    "QwUEwTUU/YY8BN+h4rrrsfnBsPX5S5AndS7CewvFK9oTOvcy3yYerMBXiWs3eb6V7+Zsc6IpnocJUGuoi2oG5h7Wv9kjZaxIS83Z0C8aQnoDyu4u9JEUwY0y" +
    "FyJ/hAjlcSq8eqZjE8OQrlfi+37Icg0mShYH6sOLwpT1nfA0cVoLok+5Ygmen+ij69CWj+AZvMSp45qZ158dRY78iFl/5pWzEXy51yEVlC03wZeLo8D9RiUs" +
    "4HnMTBHqVVg+k36eU593Enx59MsyypSF4Mu6DosCFKLVUP52RdpJuIk1Tleh7UDypJgon4K71mabb7j40OfnqCfDR/Ad4JGzEXX3RtzPhpRiJJ5tYSJ9RkJ2" +
    "cuB+yXqylUq5Cb4GoQzVhXaTXe8nQmYNdj8bcb9BSB8dSfCtKbQdmN/GIQnWNoO7F7n6oJhsmmwkWKBfjHNc8+zIe4YIviTM4uFkm4yQ3Qm7rQ+gfdll7nOf" +
    "C2qh7eKq3Qg+lGG3k/2Fe+7cwD3vR7lbhGXM6bDGI1hD/AJ/OxWiQusYyKQihdxzE7IXC7mrI2X4JKxvQ4HmC62Lg09EcGeGK2A7kx17i7TnkGZzg2BL0Cil" +
    "RpSflUhnYso2eZ1Lbkxx3MdH8PH16mLrUGjbNtJtna08rQGLS2jBx4S8090w8Qwhgq9voe2YJt0x2YLp2sA1+ok0ZzsI1/WliXS2mHUtbG19kWNc3mUpX+x7" +
    "dVrciANwCM86GuOTdbOj1AQf8pnQGw4ruCYEy7btwu+Pss+DoCGQZVNgrdkJ7eIMYC8OCqGQkihceG+EXrUBuqHTeh/1aoS+YI1jI8gNG8E3wSYjykUTfJj3" +
    "WWdZFWN9BYKFCZE6G6GGAzw2ckzWCIKvF/rVcQgBUSPmq+mW8mzJvRkx2vYTxG3IBZBjrlm/c5TpAWLbvKcHEdqjDjq/VX8QhBWDN4hS1pyVBtzUp4t/ZyTy" +
    "LyU/+ifKd0J/9h4MgbL74RtZ43L3R7luQs8hWL/ciPvwwvg6lH3LobtyXMDPA3Xi+MWDLXlBgi9w7ROhZ+2IMewleNGsgzVMMMZW4np5158dRY6Rd/2ZV85G" +
    "8OVe+1RQttwEXzEcxTXwDGmitrAe3lRN5bPq5zn1eR/Bl1m/LKNMuQi+TOuwKIiPz4ZmVzBaUSZJuLFCudkSM6m/yOtpueaZnp0j1/2O44Z0mLVb5SLaJZOc" +
    "eLYmhxnyMcgPEXwlddHFLv4u4jcHTx7mKM84CpMam4yG3AgztzPKM0E3EQuKu5E+KAvBh9/sUswLCpuStJ/og7b3xDv11uPExXPyxPsBDrBIuaQLmUPEPW0L" +
    "OY6tVOuQb9O2GDzYMi9lEeADnp8PqPGa/WYg+LqLOvZN5P23rz0LbZ//dpiTG4SOgOdJeiIG52b09RoMovPEosq5+MG12ALqDbFg+qtPRsjyQE4+qyxRvoc4" +
    "IMVqgZcoz+5tdVAoh4rFVojg20ekxZAqqcNOHNfn8gtFWo3PjVJMrHPwDPKfKy5pDMG3KJEecuVMkXWCyGlvgu9DlG3yEbsZCD6O6Xcafk8VZThOWIjgi2oH" +
    "8f4+S6Rzv0rF3E3cRxJ8THL5+uIikebtW67nsZTpDpfYvyUW2y5LphiCr1nEyKsBWeerJ7toG+uPM/C3dWMI5ZeDnOFxcU9xoNAJ+N9qwQ15aZn8ZYCs2wkk" +
    "0EzhNmp1mSy06hZsneazYuGx+j2RxnN7KgZcQjaK4APhwDGQP7Vt9kbe51+WPHZ1Ho1ybCG4Hr/72a/a5hqsF9dZ8jiO4mRLmo882EecAu+Lj8xtLQlW3phK" +
    "EY7I74V5cRQsDDmmo9WlupIQlq4Mqys0ygZddIUun4onaSnLh8dYPXMc1+4LPawBdWfi7gKUec4Wv1GU+yJwDyb4vEH7qwFFrD87ihyjGlx0c699Kiiba21R" +
    "hFwujgLxuwm6/QmY83itbSPUqq18Jv08pz4fQ/BF65dllMms6+WUybQOi4JQXiYkXEk5IHTWwP/SnSYVIwqLHMIkxgGRtxNuCmRb/NjuBxc8PsX0xSz1jGiX" +
    "zHLCQuBlGccIcTGYRCgbwYdYdqaD/Q2/txeLR5effJt6iPgtFDgIIE97kSD4eEe/nhd3OQg+dtVciOd2tRlbVY5PxBDpK+KouNzM8zxnJzG43p3I214cFONa" +
    "aNr6Ph+wscYxaQ4HKTRZErNYlPHBFlaSV5SNIvhQluP93S/SugiLCt8itrc4je4DLDL7uMqLazfg+edKpRcEQrOwQnAGiob7EbvX7oI4onxYhPMI+kTdGV6C" +
    "D/2ADyG6JXRtyDBJObbQOkmsQFrILfKXIs3nFsmm4c28SYIF6VSHeb50o9wBaYNEms/8vJ4XoyAUhrrc0DK46HKg80N8dUi0TTkJvu8IO2Ft+pHHcqwaCT52" +
    "bdgsXFw7idMjRwTuc6ZI4zE25KLL79Xbt1zPk8jvjPANcrPLa0Um2iMVlw06C+MIpA2MqOf38H7rYPFCrh14lOfDH2ay4ifaiMfWExyyA+F2PVfEMLvPdS/I" +
    "8AYHH/7jI6JfR5nQBlAPEf+PlV22KPYGkI4h+DAXTOO6hOLNYkFp5qvXRdotkLfFG0x6YSRxUqL82Xi/08SJhxxnymYNsSO+q+XsEip0n1cj2sYbUkLce7xI" +
    "Y6u2GZbyvbFJeolIe9X3viJiux2Lsb6ip/BGEnzcNt6NwSLqUAPdZAp+s6WutOD70iLH5EOKJE6UY4vUqJMhK4ki1p8dRY5RcYKvUPzap1KyudYWRchl5ihw" +
    "aKHBY+I+rMelrKSrsHwm/TynPh/johutX5ZRJrOul1Mm0zosCEzkjVjgJk9J45PJFjlkGdJFd7xQtD9yyA0Su/FzUPn14npW9yWRL02WeaG7TCruEXLyn2th" +
    "wshC5Mhnmydipcnjwa/Mcr8iCb6TRXypmcI9d6EnkHqqHgjKzMG9QySUrZ0f9MgwwddTuCD+odBWyY0i+JD2pKiLq80GincyV9STreJmZmmfGIidAwJxYXYE" +
    "rxCWJAtc7g2Od1Ijdmqfssj0ETGV6nEi1DjxjPNL5aJbaKsUyz7AQVe/5bhOHvkXULYp5FIrZCaJez4h0m8S6akThkU5eYLuVSKdA9/XRSwWsxB8N6LcFsdY" +
    "9KhFhkmIBdiJe0rUeYxjouAxeAYseGaJfhAKsDsP7tz87lKnJqLvMWE9H25f70RYWU1B/htwqZ+JOrlc+3wEX40YzxagDu9FED2VtODbA/Xmb/46R/mqI/iQ" +
    "zzHZJmPziNt/ludwrO/0AZDVvCHnCg5dIyyx+L1OyuCi68pnK7JatNdQxLMz+I1DhkmjSbZ2FIu7ufhOa8X46rMkZKufzdBdnPFQxWmNJFxEa8TzbrJZb2Fs" +
    "4/AeR4FYXIKx5zDrzdrqfWYc/sRTbrio10NCB7zdUX4sys4WxOASm0Uh3Bn5enya9sfJmEKi/NWiLjMixtQhwm1pKd4j/z7f9cxCPuSiu6fQl2rxLbJ7vsud" +
    "ig+ZeB3WnZugu/lOMmfvCus4Isr1w9jciAOhRonxPdX30Vf4RPhxGNsJY741Jp1of6vrp+ivLuKhag7ZEPOO86R6UZZDezjjNzrqsF6M352ga0yFrr3ecfqz" +
    "PEDDqpeEDtmoJuRdf3YUuUJp1p8lXbcWufaplGyutUURcpk5CrFWnQ3dYpyYfx9Prg2qrXwhn36etXzsIRtZ9MtyyWTW9XLKRK/DgqDW07feseTVCAb8eEu+" +
    "DQ2wYrvLFvRZyO4BMnCeCBA8wRdPzHG/jVAcnYHtHXISIwNyWYmc3UFW8Ml/SxEX7h6X+7HvfiVw0T0FHyIPUHNcweQD9TgBisMWm8VAoI3f9NxLWuC9hrSB" +
    "hfwE347iWa1tVmh9T8+LPkggjO8ttSuykD1NBDplfAOXMd9BC653coQgcFOLNrTFnVhcr8W/WViQORegQj6a4Cu0LqInox03om2fcQ3oCdmTxHOeESoPmZuF" +
    "zPkifbBI/7tHnk+Mm2bJY/LQ6aJWyE7wPUJ+pKx7sVDniWIFAj33hdKxxXHgDxPlg7E7yoerpGLyCJkdsLBZjD61JnDy3UHY6VwPi8kB4rRfq8Uk2uoZLGa4" +
    "3/vGIifBh/wBiTocJKwvXS4zFSX48PsQtPG3to2pKib4uoGkmwsCYgFO+nJa24r7nCT64ieBBXaybx0sLFCLcdG9VPRRwncy1kNanCoIyTcs+QdivNsMxe0c" +
    "EazZ6bYp3O7JFkw/UXYfUfZskc5uzq54NzzWPC3S2M1sQeDkR3a79cV1u5bs2OAo3xXf/gq812meE557O65NjrhJd3rKuzwmBkPnXI76GGLwMtfzJmS9BB/K" +
    "9IeOy/HJpvkswmFh+ijGxgbM2VbLTCHDusTZvnIoexTIw+UctxGx/1xWxEeKxcVq9LedPddnhAg+q0VoBoLvsdCzFgu0zRY+CCdQNhPBBwJvU7KvweqzCe30" +
    "gofA482h1GFuhbaE04cx9akkKOf6s6PIFUqz/swr51yf5F37VFg219qiCLlMHAWs1HksWIr1/gCMJUbPOK2ayxfy6edZy4cIvjz6ZblkMut6OWUyrcMUCkWV" +
    "ARPdQnzozvhJCoXCDVipDhJubUwMbIw5/bBEdegk4mpYScVtGTHEW+R11pTiOgo/EKJgExRS5yatQpEFhhzE95sK25PhGmaBfVtpa9axIDY1rbEQscg2+F35" +
    "a6dQbF2AfrkFHlhW6y6FotQAET4p5hBGhUJRZUjEc5gC18uqdqlQKKoF2DnnHcoHsVPLccNSgfLbqQ57CSvDzb4DDLZVKMHXMQCLBRlTyhoPSaHIA7iaOy0e" +
    "I+S7gnROWZ5sSwBRusFGwGPDax3ynV5NCoUiHsLi3hq3XqEoNWBl+JbLQ0OhUFQ5EMiaTXZX6g6RQhEPItpNHFrCeMl26Ew73f8YcV+rG/G2DiX4OgbECZ0E" +
    "V86yWMAqtg3gFN5TipA3Achv9cWr3FZgYi7iO30hkf4i0q+pXO0Uiq0HiNP7FUI4OE8qVyhKBRwE8gncyi+vdH0UCoVCoVAoFAqFQqFQKBQKhUKhUCgUCoVC" +
    "oVAoFAqFQqFQSPwfnhIqDloZvSMAAAAASUVORK5CYII=";
const FONT_CAPTION_CELL_H = 22;
const FONT_CAPTION_GLYPHS = {"0":[674,9],"1":[686,9],"2":[698,9],"3":[710,9],"4":[722,9],"5":[734,9],"6":[746,9],"7":[758,9],"8":[770,9],"9":[782,9]," ":[0,5],"A":[8,11],"B":[22,11],"C":[36,11],"D":[50,11],"E":[64,11],"F":[78,10],"G":[91,12],"H":[106,11],"I":[120,5],"J":[128,9],"K":[140,11],"L":[154,10],"M":[167,13],"N":[183,11],"O":[197,12],"P":[212,11],"Q":[226,12],"R":[241,11],"S":[255,11],"T":[269,10],"U":[282,11],"V":[296,11],"W":[310,15],"X":[328,11],"Y":[342,11],"Z":[356,10],"a":[369,9],"b":[381,10],"c":[394,9],"d":[406,10],"e":[419,9],"f":[431,5],"g":[439,10],"h":[452,10],"i":[465,5],"j":[473,5],"k":[481,9],"l":[493,5],"m":[501,14],"n":[518,10],"o":[531,10],"p":[544,10],"q":[557,10],"r":[570,6],"s":[579,9],"t":[591,5],"u":[599,10],"v":[612,9],"w":[624,12],"x":[639,9],"y":[651,9],"z":[663,8],".":[794,5],",":[802,5],":":[810,5],";":[818,5],"-":[826,5],"+":[834,9],"/":[846,5],"?":[854,10],"%":[867,14],"(":[884,5],")":[892,5],"·":[900,5],"°":[908,6],"~":[917,9],"'":[929,4],"Á":[936,11],"À":[950,11],"Â":[964,11],"Ã":[978,11],"É":[992,11],"Ê":[1006,11],"Í":[1020,5],"Ó":[1028,12],"Ô":[1043,12],"Õ":[1058,12],"Ú":[1073,11],"Ü":[1087,11],"Ç":[1101,11],"á":[1115,9],"à":[1127,9],"â":[1139,9],"ã":[1151,9],"é":[1163,9],"ê":[1175,9],"í":[1187,5],"ó":[1195,10],"ô":[1208,10],"õ":[1221,10],"ú":[1234,10],"ü":[1247,10],"ç":[1260,9]};

// Fonte monoespaçada "place" (Liberation Mono Bold, maior que `small`) — só
// pra texto de nome de local nos cartões do resumo diário, que estava
// pequeno demais perto do dígito de magnitude (fonte hero, 108px).
const FONT_PLACE_CELL_W = 18, FONT_PLACE_CELL_H = 38;
const FONT_ATLAS_PLACE_B64 =
    "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";

// Atlas de bandeiras (emoji colorido de verdade, renderizado com fonte
// Noto Color Emoji — não é máscara de alpha como as outras fontes, o
// blit usa a cor própria de cada pixel do atlas (ver blitIcon).
const FLAG_CELL_W = 40, FLAG_CELL_H = 28;
const FLAG_MAP = {"AF":0,"AL":1,"AM":2,"AR":3,"AS":4,"AU":5,"AZ":6,"BD":7,"BO":8,"BR":9,"CA":10,"CD":11,"CL":12,"CN":13,"CO":14,"CR":15,"CU":16,"CY":17,"DO":18,"DZ":19,"EC":20,"EG":21,"ES":22,"ET":23,"FJ":24,"FM":25,"GE":26,"GR":27,"GT":28,"GU":29,"HN":30,"HR":31,"HT":32,"ID":33,"IN":34,"IQ":35,"IR":36,"IS":37,"IT":38,"JM":39,"JP":40,"KE":41,"KG":42,"KI":43,"KR":44,"KZ":45,"LK":46,"MA":47,"MG":48,"MH":49,"MM":50,"MN":51,"MP":52,"MX":53,"MZ":54,"NI":55,"NP":56,"NZ":57,"PA":58,"PE":59,"PG":60,"PH":61,"PK":62,"PR":63,"PT":64,"PW":65,"RO":66,"RU":67,"SA":68,"SB":69,"SV":70,"TJ":71,"TL":72,"TM":73,"TO":74,"TR":75,"TT":76,"TW":77,"TZ":78,"US":79,"UZ":80,"VE":81,"VI":82,"VN":83,"VU":84,"WS":85,"YE":86,"ZA":87};
const FLAG_ATLAS_B64 =
    "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" +
    "5chaz3FldIErpUqulBjbd5EjoUp2e31V9Iz92+Xm7XR+6B7jv3z3bcvX33zd+Nnnn9Xef9AWv926dauMNzCkFF19VOjmq0WMrw7deSbE8urRndeAWF4zYnmt" +
    "9ilvHWWf+OaA3qJ9CJHeVkR4NSHEow6B7C3O5DcYAI416Ip5YK9DLUW+vRpvAZZrgL4K0FwElBeB0kpAdQnQ6gHddcBkBuprgYZ7wJOPgNZPAPoUoM8A+oND" +
    "nzv+7GOA7gPWW0DTZcCicrY/4kXx5ZvQY/Sv40vfIdAd5cP0CfCwvf/vB6CVaVxvdvRr/KWDXtS/YQCcqr8xANzA7Arz4PxrLYPyrjTG77lg6be9XN83q0TT" +
    "Z1Oxstf6k6W91p1U9d5wUtt7U5mu9+bTpj7bNPV9dp5r6PPhpeZX9upaX9l7hV7Zd5X67L9GLzPad416771KPXfrqceuy9R963lrtw1nmqIzCy1h7+7b4lT/" +
    "2tP6fkZbfT94gQWBaXr4z9BAkaKEX0qpZ/hkVfqcWG3tCU/d/VIv08cqr/o/VHg3fH3Oq/m7Sq/W7y96058ue9ODOQKqEkro4jP9ByJSsUXWYragKc/d+f6D" +
    "p/0l4R37S4T6Yn+B5riCrzzmJyg9puCrTsh52lIFX6fyY/pLBPVaP34D019S5S9o1dv7SwRk8BPQVQXfrrb+El+6JPOh847+kkJ7f4mnU8+vvf/q7UgzZnZr" +
    "QUrXRkyJtiApQo+xoRqMDVVidGgpRoeoMCpYi9EhOowNMWFsWD3GhTVgfMQTJIW32qe8je8IvIURxjqgt9HBhJGBVgzzb8Jr8jrES7Y4k9+ImbaUO+7dWeaq" +
    "0qiWghxZY9+poRbx8HCdcEiwRjg4SCl4LahUOChQJXgtUCsYHKwTDA42CYeE1guHhDSIEkKfiBJCraKhoSQaGmJXO/QmfL0NeuO/Gki8eH+rb3+/Ju/esjrP" +
    "7iKn1mcH4OL2mD1ePdzCHZjfyI3bX8vtu0vP7rVV494rS8nquanUvedGFavHRi2r5xYdq+c2E6vXjoesXtkNrJf3NLN677OyX95P7N45xO59gNi9GOUQq+d+" +
    "YsXuJVbMbnLrusPqGr2pyTVilcUlNN1J/7mDfZnUwb4w+auRUGL4c/mrkTDa81ejn+avrPa8VcfcVUforT1/9Zo9f2VBP+fyV0x+XOLpYl7di9dys5essUoh" +
    "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" +
    "AElFTkSuQmCC";

// Heurística: extrai um código de país (ISO alpha-2) a partir do texto
// "place" que o USGS manda (ex.: "10km SSE of Bitung, Indonesia",
// "87km SSE of Nuku'alofa, Tonga", "South Sandwich Islands region").
// Não é geocodificação real — é um dicionário de palavras-chave, então
// cobre bem os países mais sísmicos e deixa sem bandeira o que não bate
// com nada (melhor não mostrar do que mostrar errado).

const US_STATES = ["alaska","california","hawaii","nevada","montana","washington","oregon","idaho","wyoming","utah","oklahoma","texas","arkansas","tennessee","missouri","illinois","south carolina","north carolina","kansas","new mexico","arizona","colorado"];

const COUNTRY_KEYWORDS = [
  // território dos EUA (checar antes de "US" genérico)
  ["puerto rico", "PR"],
  ["guam", "GU"],
  ["northern mariana", "MP"],
  ["american samoa", "AS"],
  ["u.s. virgin islands", "VI"],
  ...US_STATES.map(s => [s, "US"]),
  ["united states", "US"],

  // Américas
  ["mexico", "MX"], ["méxico", "MX"],
  ["guatemala", "GT"], ["el salvador", "SV"], ["honduras", "HN"],
  ["nicaragua", "NI"], ["costa rica", "CR"], ["panama", "PA"], ["panamá", "PA"],
  ["colombia", "CO"], ["ecuador", "EC"], ["peru", "PE"], ["perú", "PE"],
  ["chile", "CL"], ["argentina", "AR"], ["bolivia", "BO"], ["venezuela", "VE"],
  ["brazil", "BR"], ["brasil", "BR"], ["cuba", "CU"],
  ["dominican republic", "DO"], ["haiti", "HT"], ["jamaica", "JM"],
  ["trinidad", "TT"], ["canada", "CA"],

  // Pacífico / Ásia
  ["japan", "JP"], ["taiwan", "TW"], ["philippines", "PH"],
  ["indonesia", "ID"], ["papua new guinea", "PG"], ["solomon islands", "SB"],
  ["vanuatu", "VU"], ["fiji", "FJ"], ["tonga", "TO"], ["samoa", "WS"],
  ["new zealand", "NZ"], ["kermadec", "NZ"], ["australia", "AU"],
  ["china", "CN"], ["russia", "RU"], ["south korea", "KR"], ["korea", "KR"],
  ["myanmar", "MM"], ["india", "IN"], ["nepal", "NP"], ["bangladesh", "BD"],
  ["pakistan", "PK"], ["afghanistan", "AF"], ["kyrgyzstan", "KG"],
  ["tajikistan", "TJ"], ["turkmenistan", "TM"], ["uzbekistan", "UZ"],
  ["kazakhstan", "KZ"], ["mongolia", "MN"], ["vietnam", "VN"],
  ["timor", "TL"], ["micronesia", "FM"], ["marshall islands", "MH"],
  ["palau", "PW"], ["kiribati", "KI"], ["sri lanka", "LK"],

  // Oriente Médio / Europa / África
  ["turkey", "TR"], ["türkiye", "TR"], ["greece", "GR"], ["italy", "IT"],
  ["iceland", "IS"], ["portugal", "PT"], ["spain", "ES"], ["morocco", "MA"],
  ["algeria", "DZ"], ["iran", "IR"], ["iraq", "IQ"], ["georgia", "GE"],
  ["armenia", "AM"], ["azerbaijan", "AZ"], ["yemen", "YE"],
  ["saudi arabia", "SA"], ["egypt", "EG"], ["cyprus", "CY"],
  ["albania", "AL"], ["croatia", "HR"], ["romania", "RO"],
  ["ethiopia", "ET"], ["kenya", "KE"], ["tanzania", "TZ"],
  ["mozambique", "MZ"], ["madagascar", "MG"], ["south africa", "ZA"],
  ["congo", "CD"],
];

function guessCountryCode(place) {
  if (!place) return null;
  let s = String(place).toLowerCase();
  // remove prefixo de distância/direção tipo "87km SSE of "
  s = s.replace(/^\s*[\d.]+\s*km\s*(n|s|e|w|ne|nw|se|sw|nne|nnw|ene|ese|sse|ssw|wnw|wsw)?\s*of\s+/i, '');
  let best = null;
  for (const [key, code] of COUNTRY_KEYWORDS) {
    if (s.includes(key)) {
      if (!best || key.length > best[0].length) best = [key, code];
    }
  }
  return best ? best[1] : null;
}

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
/** Decodifica (1x por instância do Worker) e cacheia os atlas de fonte —
 * os 3 originais (JetBrains Mono, monoespaçada, pra números/dados que
 * precisam alinhar em coluna) mais os 2 novos (Liberation Sans Bold,
 * largura proporcional de verdade, pra títulos/texto corrido — gerados
 * com um navegador de verdade renderizando a fonte, não é bitmap
 * inventado à mão). */
async function getFontAtlases() {
    if (_fontAtlasCache) return _fontAtlasCache;
    const [micro, small, hero, titleProp, captionProp, place, flags] = await Promise.all([
        decodePng(base64ToBytes(FONT_ATLAS_MICRO_B64)),
        decodePng(base64ToBytes(FONT_ATLAS_SMALL_B64)),
        decodePng(base64ToBytes(FONT_ATLAS_HERO_B64)),
        decodePng(base64ToBytes(FONT_ATLAS_TITLE_B64)),
        decodePng(base64ToBytes(FONT_ATLAS_CAPTION_B64)),
        decodePng(base64ToBytes(FONT_ATLAS_PLACE_B64)),
        decodePng(base64ToBytes(FLAG_ATLAS_B64))
    ]);
    _fontAtlasCache = {
        micro: { img: micro, cellW: FONT_MICRO_CELL_W, cellH: FONT_MICRO_CELL_H, map: FONT_CHARMAP_TEXT },
        small: { img: small, cellW: FONT_SMALL_CELL_W, cellH: FONT_SMALL_CELL_H, map: FONT_CHARMAP_TEXT },
        hero: { img: hero, cellW: FONT_HERO_CELL_W, cellH: FONT_HERO_CELL_H, map: FONT_CHARMAP_HERO },
        titleProp: { img: titleProp, cellH: FONT_TITLE_CELL_H, glyphs: FONT_TITLE_GLYPHS },
        captionProp: { img: captionProp, cellH: FONT_CAPTION_CELL_H, glyphs: FONT_CAPTION_GLYPHS },
        place: { img: place, cellW: FONT_PLACE_CELL_W, cellH: FONT_PLACE_CELL_H, map: FONT_CHARMAP_TEXT },
        flags: { img: flags, cellW: FLAG_CELL_W, cellH: FLAG_CELL_H, map: FLAG_MAP }
    };
    return _fontAtlasCache;
}

/** Cola um ícone colorido do atlas (bandeiras) usando a cor de verdade de
 * cada pixel do atlas — ao contrário de blitGlyph, que só usa o alpha
 * como máscara e pinta com uma cor só (serve pra fonte, não pra bandeira,
 * que tem várias cores). */
function blitIcon(rgba, w, h, atlasImg, sx, sy, sw, sh, dx, dy) {
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
                rgba[di] = atlasImg.rgba[si]; rgba[di + 1] = atlasImg.rgba[si + 1]; rgba[di + 2] = atlasImg.rgba[si + 2]; rgba[di + 3] = 255;
            } else {
                const ia = 255 - a;
                rgba[di] = ((atlasImg.rgba[si] * a) + (rgba[di] * ia)) / 255;
                rgba[di + 1] = ((atlasImg.rgba[si + 1] * a) + (rgba[di + 1] * ia)) / 255;
                rgba[di + 2] = ((atlasImg.rgba[si + 2] * a) + (rgba[di + 2] * ia)) / 255;
                rgba[di + 3] = 255;
            }
        }
    }
}

/** Desenha a bandeira do país (se o texto do local bater com o dicionário
 * em COUNTRY_KEYWORDS). Retorna false sem desenhar nada se não achar —
 * melhor não mostrar bandeira nenhuma do que mostrar a errada (caso de
 * "South Sandwich Islands region", cordilheiras oceânicas etc). */
function drawFlag(rgba, w, h, flagsFont, code, dx, dy) {
    if (!code || !(code in flagsFont.map)) return false;
    const idx = flagsFont.map[code];
    blitIcon(rgba, w, h, flagsFont.img, idx * flagsFont.cellW, 0, flagsFont.cellW, flagsFont.cellH, dx, dy);
    return true;
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

/** Mesma ideia de drawTextFont, mas pra atlas de largura PROPORCIONAL
 * (font.glyphs = {char: [x, largura]} em vez de font.cellW fixo) — usada
 * pelos atlas Liberation Sans (titleProp/captionProp). "tracking" é o
 * respiro entre um glifo e o próximo, em px. */
function drawTextFontProp(rgba, w, h, font, text, x, y, r, g, b, tracking = 1) {
    let cx = x;
    for (const ch of text) {
        const g_ = font.glyphs[ch] || font.glyphs['?'];
        if (g_) {
            blitGlyph(rgba, w, h, font.img, g_[0], 0, g_[1], font.cellH, cx, y, r, g, b);
            cx += g_[1] + tracking;
        } else {
            cx += 6 + tracking;
        }
    }
    return cx;
}

function textFontWidthProp(font, text, tracking = 1) {
    let total = 0;
    for (const ch of text) {
        const g_ = font.glyphs[ch] || font.glyphs['?'];
        total += (g_ ? g_[1] : 6) + tracking;
    }
    return Math.max(0, total - tracking);
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

/** Igual a fillRect, mas com cantos arredondados (raio em px) — usado nos
 * cartões do resumo diário pra tirar a "cara de planilha" dos retângulos
 * retos. Teste de distância só nos 4 quadrados de canto; o miolo do
 * retângulo é preenchido reto (rápido, sem custo extra no resto da área). */
function fillRoundRect(rgba, w, h, x, y, rw, rh, radius, r, g, b, a = 255) {
    const rad = Math.max(0, Math.min(radius, rw / 2, rh / 2));
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(w, x0 + (rw | 0)), y1 = Math.min(h, y0 + (rh | 0));
    const rr = rad * rad;
    for (let yy = y0; yy < y1; yy++) {
        const inTopBand = yy < y0 + rad, inBottomBand = yy >= y1 - rad;
        let i = (yy * w + x0) * 4;
        for (let xx = x0; xx < x1; xx++) {
            let skip = false;
            if (rad > 0 && (inTopBand || inBottomBand)) {
                const cx = xx < x0 + rad ? x0 + rad : (xx >= x1 - rad ? x1 - rad : null);
                if (cx !== null) {
                    const cy = inTopBand ? y0 + rad : y1 - rad;
                    const dx = xx - cx, dy = yy - cy;
                    if (dx * dx + dy * dy > rr) skip = true;
                }
            }
            if (!skip) {
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
            i += 4;
        }
    }
}

/** Brilho radial suave (glow) — alpha cai por distância ao centro, ao
 * quadrado, pra parecer luz de verdade em vez de um círculo chapado. */
function fillRadialGlow(rgba, w, h, cx, cy, rad, r, g, b, maxAlpha = 0.35) {
    const y0 = Math.max(0, (cy - rad) | 0), y1 = Math.min(h, (cy + rad + 1) | 0);
    const x0 = Math.max(0, (cx - rad) | 0), x1 = Math.min(w, (cx + rad + 1) | 0);
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const dx = x - cx, dy = y - cy;
            const d = Math.sqrt(dx * dx + dy * dy) / rad;
            if (d >= 1) continue;
            const a = maxAlpha * (1 - d * d);
            const i = (y * w + x) * 4;
            rgba[i] = r * a + rgba[i] * (1 - a);
            rgba[i + 1] = g * a + rgba[i + 1] * (1 - a);
            rgba[i + 2] = b * a + rgba[i + 2] * (1 - a);
            rgba[i + 3] = 255;
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

/** Halo + centralização pro atlas proporcional (Liberation Sans) — mesma
 * ideia das duas funções acima, só trocando drawTextFont/textFontWidth
 * pelas versões "Prop". */
function drawTextFontPropHalo(rgba, w, h, font, text, x, y, r, g, b, hr = 3, hg = 9, hb = 20) {
    const offs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [ox, oy] of offs) drawTextFontProp(rgba, w, h, font, text, x + ox, y + oy, hr, hg, hb);
    return drawTextFontProp(rgba, w, h, font, text, x, y, r, g, b);
}

function drawTextFontPropCenteredHalo(rgba, w, h, font, text, cx, y, r, g, b, hr = 3, hg = 9, hb = 20) {
    const tw = textFontWidthProp(font, text);
    return drawTextFontPropHalo(rgba, w, h, font, text, Math.round(cx - tw / 2), y, r, g, b, hr, hg, hb);
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

// Chave dentro do KV "TTS_USAGE" (já existe pra outra coisa — cota de
// Polly — mas KV é só um key-value store; reutilizar com uma chave bem
// distinta não colide com nada). Preferido a caches.default: o Cache API
// do Workers é POR DATA-CENTER, não global. O Cron Trigger deste worker
// pode rodar num data-center diferente a cada disparo, e cada um tem seu
// próprio cache isolado — foi exatamente essa a causa de um mesmo sismo
// M6+ sair duplicado no Telegram com ~2h30 de intervalo: o segundo
// disparo caiu num data-center que nunca tinha visto aquele id, mesmo o
// primeiro já tendo "salvo" o alerta como enviado (só que na cópia local
// de OUTRO data-center). KV é replicado globalmente, então resolve de
// vez — caches.default fica só como fallback se o KV não estiver
// configurado no ambiente (ex.: wrangler dev local sem bind).
const TELEGRAM_SENT_KV_KEY = 'telegram-m6-sent-ids';

async function loadSentAlertIds(request, env) {
    if (env && env.TTS_USAGE) {
        try {
            const raw = await env.TTS_USAGE.get(TELEGRAM_SENT_KV_KEY);
            if (!raw) return new Set();
            const d = JSON.parse(raw);
            return new Set(Array.isArray(d.ids) ? d.ids : []);
        } catch (e) {
            console.warn('telegram KV read:', e?.message || e);
        }
    }
    try {
        const hit = await caches.default.match(cacheKey(request, TELEGRAM_ALERT_CACHE_PATH));
        if (!hit) return new Set();
        const d = await hit.json();
        return new Set(Array.isArray(d.ids) ? d.ids : []);
    } catch {
        return new Set();
    }
}

async function saveSentAlertIds(request, idSet, env) {
    const ids = [...idSet].slice(-200); // mantém os 200 mais recentes
    if (env && env.TTS_USAGE) {
        try {
            await env.TTS_USAGE.put(
                TELEGRAM_SENT_KV_KEY,
                JSON.stringify({ ids, updatedAt: nowIso() }),
                { expirationTtl: TELEGRAM_ALERT_TTL }
            );
            return;
        } catch (e) {
            console.warn('telegram KV write:', e?.message || e);
        }
    }
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
    const sentIds = await loadSentAlertIds(request, env);
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

    if (sent.length) await saveSentAlertIds(request, sentIds, env);

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
/** Layout de cada cartão do Top 5 é todo calculado ANTES de desenhar —
 * a fonte é monoespaçada (largura por caractere é exata, sem precisar
 * medir texto), então dá pra saber a altura real de cada cartão sem
 * chute. Isso elimina de vez o tipo de bug que havia antes (o número de
 * ranking desenhado numa posição fixa à direita, que colidia com a
 * segunda linha do nome do local quando ele quebrava — ex.: "2." em
 * cima de "Tonga"). Aqui o ranking vira um selo à esquerda, ANTES do
 * texto, então não tem como colidir; e o horário/profundidade vai
 * sempre abaixo do bloco de texto já quebrado, na altura calculada. */
// Espaço reservado pra bandeira antes do nome do local — fixo pra todo
// cartão (mesmo quando não acha o país), pra manter o texto sempre
// começando na mesma coluna nos 5 cartões.
const FLAG_GUTTER = FLAG_CELL_W + 12;

/** Pino de localização desenhado à mão (círculo + gota), sem depender de
 * nenhum atlas de ícone — "buraco" no meio usa a cor de fundo do painel. */
function drawPinIcon(rgba, w, h, cx, cy, r, cr, cg, cb, bg) {
    fillCircle(rgba, w, h, cx, cy - r * 0.2, r, cr, cg, cb, 255);
    fillTriangle(rgba, w, h, cx - r * 0.75, cy + r * 0.15, cx + r * 0.75, cy + r * 0.15, cx, cy + r * 1.7, cr, cg, cb, 255);
    fillCircle(rgba, w, h, cx, cy - r * 0.2, Math.max(1, r * 0.4), bg[0], bg[1], bg[2], 255);
}

/** Relógio desenhado à mão (anel + ponteiros), usado só no cabeçalho. */
function drawClockIcon(rgba, w, h, cx, cy, r, cr, cg, cb, bg) {
    fillCircle(rgba, w, h, cx, cy, r, cr, cg, cb, 220);
    fillCircle(rgba, w, h, cx, cy, Math.max(1, r - 2), bg[0], bg[1], bg[2], 255);
    fillRect(rgba, w, cx - 1, cy - r + 3, 2, r - 3, cr, cg, cb, 255);
    fillRect(rgba, w, cx, cy - 1, Math.round(r * 0.6), 2, cr, cg, cb, 255);
}

/** Avião de papel (ícone clássico do Telegram), só com 2 triângulos. */
function drawPaperPlaneIcon(rgba, w, h, x, y, size, cr, cg, cb, bg) {
    fillTriangle(rgba, w, h, x, y - size * 0.5, x, y + size * 0.5, x + size, y, cr, cg, cb, 255);
    fillTriangle(rgba, w, h, x + size * 0.1, y, x + size * 0.45, y + size * 0.18, x + size * 0.22, y + size * 0.5, bg[0], bg[1], bg[2], 255);
}

/** Layout de linha "lado a lado": magnitude à esquerda (centralizada na
 * altura da linha), local+meta à direita começando no topo — em vez do
 * empilhado (magnitude em cima, local embaixo) usado antes. Deixa a linha
 * bem mais baixa/compacta, igual à referência. */
function layoutRow(fonts, item, cardW) {
    const padTop = 18, padBottom = 18, padLeft = 26;
    const magX = padLeft;
    const placeX = 300;
    const countryCode = guessCountryCode(item.place);
    const placeMaxChars = Math.floor((cardW - placeX - FLAG_GUTTER - 26) / fonts.place.cellW);
    const lines = wrapText(sanitizeFontText(item.place), Math.max(10, placeMaxChars), 3);
    const magRowH = fonts.hero.cellH;
    const placeBlockH = lines.length * (fonts.place.cellH + 4);
    const metaH = fonts.micro.cellH * 2 + 6;
    const rightColH = placeBlockH + 8 + metaH;
    const cardH = Math.max(padTop + magRowH + padBottom, padTop + rightColH + padBottom);
    const magY = padTop + Math.round(((cardH - padTop - padBottom) - magRowH) / 2);
    const placeBlockY = padTop;
    const metaY = placeBlockY + placeBlockH + 8;
    return { padTop, padBottom, padLeft, magX, placeX, countryCode, lines, magRowH, magY, placeBlockY, metaY, cardH };
}

async function renderDailySummaryPng() {
    const {day,events}=await fetchDailyQuakesBrt();
    const fonts=await getFontAtlases();
    const W=800, cardX=38, cardW=W-76;
    const top=events.slice().sort((a,b)=>b.mag-a.mag).slice(0,5);
    const topColor = top.length ? getHexColorFromMag(top[0].mag) : [56,189,248];
    const PANEL=[10,16,30];

    const HEADER_H = 178, FOOTER_H = 70;
    const TITLE_Y = HEADER_H + 30, TOTAL_Y = TITLE_Y + 40, PANEL_START_Y = TOTAL_Y + 42;
    const STATS_GAP_TOP = 20, STATS_GAP_MID = 16, STATS_GAP_BOTTOM = 24;
    const STATS_SECTION_H = STATS_GAP_TOP + 1 + 33 + fonts.micro.cellH + STATS_GAP_MID + fonts.micro.cellH + STATS_GAP_BOTTOM;

    const cardLayouts = top.map(e => layoutRow(fonts, e, cardW));
    let contentH = PANEL_START_Y + 20;
    if (!top.length) contentH += 90;
    else cardLayouts.forEach(l => { contentH += l.cardH; });
    contentH += STATS_SECTION_H;
    const H = contentH + FOOTER_H;
    const rgba=new Uint8Array(W*H*4);

    fillRect(rgba,W,0,0,W,H,4,10,22);
    fillRadialGlow(rgba,W,H,W/2,-60,460,56,189,248,0.12);
    for(let i=0;i<160;i++){
        const sx=Math.floor(Math.random()*W), sy=Math.floor(Math.random()*Math.min(H,600));
        fillRect(rgba,W,sx,sy,1,1,255,255,255,40+Math.floor(Math.random()*110));
    }

    fillRect(rgba,W,0,0,W,HEADER_H,2,8,22,200);
    fillRect(rgba,W,0,HEADER_H-3,W,3,topColor[0],topColor[1],topColor[2],160);
    drawTextFontPropHalo(rgba,W,H,fonts.titleProp,'MONITOR GLOBAL',34,26,56,189,248);
    drawTextFontPropHalo(rgba,W,H,fonts.captionProp,'RESUMO DO DIA',34,68,148,163,184);
    drawClockIcon(rgba,W,H,44,106,7,148,163,184,[2,8,22]);
    drawTextFontPropHalo(rgba,W,H,fonts.captionProp,sanitizeFontText(`${day.split('-').reverse().join('/')} · 00:00-23:59 BRT`),58,100,148,163,184);

    drawTextFontPropCenteredHalo(rgba,W,H,fonts.titleProp,'TOP 5 SISMOS',W/2,TITLE_Y,248,250,252);
    drawTextFontPropCenteredHalo(rgba,W,H,fonts.captionProp,`Total registrado: ${events.length}`,W/2,TOTAL_Y,148,163,184);

    let y=PANEL_START_Y;
    if(!top.length){
        drawTextFontPropCenteredHalo(rgba,W,H,fonts.titleProp,'Nenhum sismo registrado',W/2,y+16,148,163,184);
        y+=90;
    } else {
        const panelTop=y;
        const panelH=cardLayouts.reduce((s,l)=>s+l.cardH,0);
        fillRoundRect(rgba,W,H,cardX,panelTop,cardW,panelH,20,PANEL[0],PANEL[1],PANEL[2],238);

        top.forEach((e,i)=>{
            const c=getHexColorFromMag(e.mag);
            const L=cardLayouts[i];
            const cardTop=y;
            fillRect(rgba,W,cardX,cardTop,cardW,L.cardH,c[0],c[1],c[2],16);
            if(i===0) fillRadialGlow(rgba,W,H,cardX+L.magX+30,cardTop+L.magY+L.magRowH/2,180,c[0],c[1],c[2],0.22);
            if(i>0) fillRect(rgba,W,cardX+16,cardTop,cardW-32,1,255,255,255,18);
            // Barra de cor rente à borda esquerda, ocupando a linha inteira
            // (em vez de recuada/arredondada) — igual à referência.
            fillRect(rgba,W,cardX,cardTop,6,L.cardH,c[0],c[1],c[2],255);

            const rankTxt=`${i+1}.`;
            const rankW=textFontWidth(fonts.micro,rankTxt);
            drawTextFontHalo(rgba,W,H,fonts.micro,rankTxt,cardX+cardW-16-rankW,cardTop+14,148,163,184);

            drawTextFontHalo(rgba,W,H,fonts.small,'M',cardX+L.magX,cardTop+L.magY+30,c[0],c[1],c[2]);
            const magStr=e.mag.toFixed(1);
            drawTextFontHalo(rgba,W,H,fonts.hero,magStr,cardX+L.magX+22,cardTop+L.magY,c[0],c[1],c[2]);

            if(L.countryCode){
                const flagY=cardTop+L.cardH-L.padBottom-FLAG_CELL_H;
                drawFlag(rgba,W,H,fonts.flags,L.countryCode,cardX+cardW-16-FLAG_CELL_W,flagY);
            }

            const pinX=cardX+L.placeX+7;
            drawPinIcon(rgba,W,H,pinX,cardTop+L.placeBlockY+Math.round(fonts.place.cellH*0.4),6,148,163,184,PANEL);
            L.lines.forEach((line,j)=>drawTextFontHalo(rgba,W,H,fonts.place,sanitizeFontText(line),cardX+L.placeX+18,cardTop+L.placeBlockY+j*(fonts.place.cellH+4),226,232,240));

            const when=new Date(e.time).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
            drawTextFontHalo(rgba,W,H,fonts.micro,sanitizeFontText(when),cardX+L.placeX+18,cardTop+L.metaY,148,163,184);
            drawTextFontHalo(rgba,W,H,fonts.micro,sanitizeFontText(`Prof. ${Number.isFinite(e.depth)?Math.round(e.depth)+' km':'--'} · ${e.source}`),cardX+L.placeX+18,cardTop+L.metaY+fonts.micro.cellH+4,148,163,184);

            y+=L.cardH;
        });
    }
    y+=STATS_GAP_TOP;
    fillRect(rgba,W,40,y,720,1,100,116,139,60); y+=1+33;
    const m6=events.filter(e=>e.mag>=6).length, m5=events.filter(e=>e.mag>=5).length, m4=events.filter(e=>e.mag>=4).length;
    const statBands=[[m6,getHexColorFromMag(6),'M6+'],[m5,getHexColorFromMag(5),'M5+'],[m4,getHexColorFromMag(4),'M4+']];
    const statTxt=statBands.map(([n,,label])=>`${label}: ${n}`).join('   ·   ');
    const statW=textFontWidth(fonts.micro,statTxt)+statBands.length*16;
    let sx=Math.round(W/2-statW/2);
    const statCy=y+Math.round(fonts.micro.cellH/2);
    statBands.forEach(([n,c,label])=>{
        fillCircle(rgba,W,H,sx+6,statCy,5,c[0],c[1],c[2],255);
        const t=`${label}: ${n}`;
        drawTextFontHalo(rgba,W,H,fonts.micro,sanitizeFontText(t),sx+18,y,226,232,240);
        sx+=18+textFontWidth(fonts.micro,t)+22;
    });
    y+=fonts.micro.cellH+STATS_GAP_MID;
    drawTextFontCenteredHalo(rgba,W,H,fonts.micro,sanitizeFontText(`Demais registros: ${events.filter(e=>e.mag<4).length}`),W/2,y,148,163,184);
    y+=fonts.micro.cellH+STATS_GAP_BOTTOM;
    fillRect(rgba,W,0,H-FOOTER_H,W,FOOTER_H,10,16,28,230);
    drawTextFontPropHalo(rgba,W,H,fonts.titleProp,'monitorglobal.top',34,H-Math.round(FOOTER_H/2+fonts.titleProp.cellH/2)+4,56,189,248);
    const tgTxt=sanitizeFontText('Telegram: monitor_global');
    const tgTxtW=textFontWidthProp(fonts.captionProp,tgTxt);
    const tgIconSize=16;
    const tgX=W-38-tgTxtW;
    drawPaperPlaneIcon(rgba,W,H,tgX-tgIconSize-8,H-Math.round(FOOTER_H/2)-Math.round(tgIconSize/2)+2,tgIconSize,148,163,184,[10,16,28]);
    drawTextFontPropHalo(rgba,W,H,fonts.captionProp,tgTxt,tgX,H-Math.round(FOOTER_H/2+fonts.captionProp.cellH/2)+4,148,163,184);
    return {day,png:await rgbaToPng(rgba,W,H),top,total:events.length};
}
const TELEGRAM_DAILY_CACHE_PATH='/__cache/monitor-global/telegram-daily-summary';
// Mesmo motivo do KV em loadSentAlertIds/saveSentAlertIds acima: caches.default
// é por data-center, e o Cron Trigger pode cair num data-center diferente a
// cada tick dentro da janela 00:00-00:20 BRT — arriscando reenviar o resumo
// do dia. KV (env.TTS_USAGE) é global; caches.default fica só de fallback.
const TELEGRAM_DAILY_KV_KEY = 'telegram-daily-summary-sent';
async function dailySummarySent(request,day,env){
    if(env && env.TTS_USAGE){
        try{
            const raw = await env.TTS_USAGE.get(TELEGRAM_DAILY_KV_KEY);
            if(!raw) return false;
            return JSON.parse(raw).day === day;
        }catch(e){console.warn('daily summary KV read:',e?.message||e);}
    }
    try{
        const hit=await caches.default.match(cacheKey(request,TELEGRAM_DAILY_CACHE_PATH));
        if(!hit)return false;
        const d=await hit.json(); return d.day===day;
    }catch{return false;}
}
async function markDailySummarySent(request,day,env){
    if(env && env.TTS_USAGE){
        try{
            await env.TTS_USAGE.put(TELEGRAM_DAILY_KV_KEY, JSON.stringify({day,sentAt:nowIso()}), {expirationTtl:172800});
            return;
        }catch(e){console.warn('daily summary KV write:',e?.message||e);}
    }
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
    if(await dailySummarySent(request,day,env)) return {ok:true,skipped:true,reason:'resumo já enviado',day};
    const pack=await renderDailySummaryPng();
    const form=new FormData();
    form.append('chat_id',String(env.TELEGRAM_CHAT_ID));
    form.append('caption',
        `📊 *Resumo do dia — ${day.split('-').reverse().join('/')}*\n` +
        `🌍 ${pack.total} sismos registrados\n` +
        `🏆 Maior: ${pack.top[0]?`M${pack.top[0].mag.toFixed(1)} — ${escapeMdLegacy(pack.top[0].place)}`:'sem registro'}\n` +
        `🌐 monitorglobal.top`);
    form.append('parse_mode','Markdown');
    form.append('photo',new Blob([pack.png],{type:'image/png'}),'monitor-global-resumo.png');
    const api=`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`;
    const r=await fetch(api,{method:'POST',body:form});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok) throw new Error(data.description||`Telegram HTTP ${r.status}`);
    await markDailySummarySent(request,day,env);
    return {ok:true,day,total:pack.total};
}


// As rotas /telegram-test, /telegram-daily-summary, /telegram-m6-check e
// /telegram-card-preview disparam ações de verdade (mensagem real no
// Telegram do dono, ou renderização de imagem) e não tinham NENHUMA
// autenticação — qualquer pessoa que soubesse a URL do worker (exposta no
// próprio código do site) conseguia acioná-las. O disparo automático de
// verdade (cron) chama runTelegramM6Alerts/runTelegramDailySummary
// diretamente em scheduled(), sem passar por HTTP — nenhum código do site
// chama essas rotas por HTTP — então protegê-las não quebra nada legítimo.
// Configure o secret ADMIN_TOKEN no Worker (wrangler secret put ADMIN_TOKEN)
// e passe ?token=SEU_TOKEN na URL (ou header X-Admin-Token) pra testar.
function tokenAdminValido(request, reqUrl, env) {
    const esperado = env.ADMIN_TOKEN;
    if (!esperado) return false; // sem o secret configurado, ninguém aciona — seguro por padrão
    const recebido = reqUrl.searchParams.get('token') || request.headers.get('X-Admin-Token');
    return recebido === esperado;
}

// Camila (neural, feminina, pt-BR nativa) via Amazon Polly. A API da AWS não
// aceita uma chave simples feito Google/ElevenLabs — exige uma requisição
// assinada (AWS Signature Version 4), calculada abaixo com Web Crypto puro
// (Workers não tem o SDK da AWS disponível).
const AWS_REGION = 'us-east-1';
const POLLY_VOICE = 'Camila';

async function hmacSha256(key, msg) {
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const data = typeof msg === 'string' ? new TextEncoder().encode(msg) : msg;
    return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, data));
}
async function sha256Hex(msg) {
    const data = typeof msg === 'string' ? new TextEncoder().encode(msg) : msg;
    const hash = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
function bytesToHex(bytes) {
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function pollySynthesize(texto, accessKeyId, secretAccessKey) {
    const service = 'polly';
    const host = `polly.${AWS_REGION}.amazonaws.com`;
    const canonicalUri = '/v1/speech';
    const body = JSON.stringify({
        Text: texto,
        OutputFormat: 'mp3',
        VoiceId: POLLY_VOICE,
        Engine: 'neural',
        LanguageCode: 'pt-BR'
    });

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const payloadHash = await sha256Hex(body);
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-date';
    const canonicalRequest = ['POST', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

    const credentialScope = `${dateStamp}/${AWS_REGION}/${service}/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, await sha256Hex(canonicalRequest)].join('\n');

    const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + secretAccessKey), dateStamp);
    const kRegion = await hmacSha256(kDate, AWS_REGION);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, 'aws4_request');
    const signature = bytesToHex(await hmacSha256(kSigning, stringToSign));

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return fetch(`https://${host}${canonicalUri}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Amz-Date': amzDate, 'Authorization': authorization },
        body
    });
}

// Segurança extra além da cota grátis da própria AWS: um teto MUITO abaixo
// dela (uso real esperado é uns 3 mil caracteres/mês, contra sismos M6+),
// guardado no KV do Cloudflare (grátis) por mês corrente. Se algum dia a
// rota for abusada (alguém martelando a URL direto), ela trava sozinha bem
// antes de chegar perto de gerar qualquer cobrança de verdade na AWS.
const TTS_LIMITE_MENSAL = 300000;
async function verificarEIncrementarCotaTts(env, tamanhoTexto) {
    if (!env.TTS_USAGE) return { ok: true }; // KV ainda não configurado — não bloqueia, só sem essa camada extra
    const agora = new Date();
    const chave = `usage-${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, '0')}`;
    const atual = Number(await env.TTS_USAGE.get(chave)) || 0;
    if (atual + tamanhoTexto > TTS_LIMITE_MENSAL) return { ok: false, usado: atual };
    await env.TTS_USAGE.put(chave, String(atual + tamanhoTexto), { expirationTtl: 40 * 24 * 3600 });
    return { ok: true };
}

// Sem token de admin aqui de propósito: essa rota é chamada pelo navegador
// de qualquer visitante do site (pra tocar o alerta de voz), não só pelo
// dono — não dá pra exigir um secret que teria que ficar exposto no JS do
// cliente. O limite de tamanho do texto, o teto mensal acima e a cota
// grátis da AWS seguram o abuso: se algum deles travar, a API responde
// erro e o site cai de volta pra voz nativa do navegador sozinho
// (falarNaNuvem no audio.js já trata isso), sem custo nem quebra pro
// usuário.
async function handleTts(reqUrl, env) {
    // Diagnóstico temporário: ?debug=1 mostra qual voz está configurada no
    // Worker sem gastar nada da cota do Polly — só abrir o link no navegador,
    // sem precisar de DevTools nem conseguir distinguir vozes no ouvido.
    if (reqUrl.searchParams.get('debug') === '1') {
        return json({ ok: true, vozConfigurada: POLLY_VOICE });
    }
    const texto = String(reqUrl.searchParams.get('text') || '').trim();
    if (!texto) return json({ ok: false, error: 'texto vazio' }, 400);
    if (texto.length > 400) return json({ ok: false, error: 'texto longo demais (máx. 400 caracteres)' }, 400);
    const cota = await verificarEIncrementarCotaTts(env, texto.length);
    if (!cota.ok) return json({ ok: false, error: `Limite de segurança mensal atingido (${cota.usado} caracteres já usados este mês) — voz na nuvem pausada até o mês seguinte.` }, 429);
    const accessKeyId = env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) return json({ ok: false, error: 'AWS Polly não configurado' }, 501);
    try {
        const r = await pollySynthesize(texto, accessKeyId, secretAccessKey);
        if (!r.ok) {
            const detalhe = await r.text().catch(() => '');
            return json({ ok: false, error: `AWS Polly HTTP ${r.status}: ${detalhe.slice(0, 200)}` }, 502);
        }
        return resposta(r.body, 200, 'audio/mpeg');
    } catch (e) {
        return json({ ok: false, error: e?.message || String(e) }, 502);
    }
}

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
        const reqUrl = new URL(request.url);

        const ROTAS_TELEGRAM_PROTEGIDAS = new Set([
            '/telegram-test', '/telegram-daily-summary', '/telegram-m6-check', '/telegram-card-preview'
        ]);
        if (ROTAS_TELEGRAM_PROTEGIDAS.has(reqUrl.pathname) && !tokenAdminValido(request, reqUrl, env)) {
            return json({ ok: false, error: 'Não autorizado. Passe ?token=SEU_ADMIN_TOKEN.' }, 401);
        }

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
        if (reqUrl.pathname === '/tts') { return await handleTts(reqUrl, env); }
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