import {SourceWritebackCache} from "./source-writeback-cache.mjs";
// Worker entrypoint: routes, coordination and existing Durable Object classes.
import {fetchText, nowIso, fetchJson, resposta, json, CORS_HEADERS} from "./worker/http.mjs";
import {sharedSourceResponse, pruneSources, sourceObjectHealth, sourcePolicy, handleSourceInObject, sourceGroups} from "./shared-source-cache.mjs";
import {xmlItems, xmlTag} from "./worker/xml.mjs";
import {getOfficialTsunamis} from "./tsunami-official-worker.mjs";
import {TELEGRAM_MIN_MAG, saoPauloYmdOffset, fetchUsgsM6Recent, fetchTelegramBrazilRecent, fetchDailyQuakesBrt, saoPauloParts} from "./worker/telegram-seismic-data.mjs";
import {exposureVersion, shakingVersion, queryImageShaking, validImageShaking, queryImageExposure, validImageExposure, exposureQuality, exposureVersionQuality} from "./seismic-image-data.mjs";
import {prunePersistentHistory, handlePersistentHistory, telegramHistoryStorage, persistentHistoryGet} from "./telegram-history-storage.mjs";
import {expirePopulation, handlePopulationExposure} from "./population-exposure-worker.mjs";
import {pruneVoiceCache, handleSharedVoice} from "./shared-voice-cache.mjs";
import {handleKvUsageObject, withKvUsage, handleKvUsageRead} from "./kv-operation-metrics.mjs";
import {serveTelegramOriginal, archiveTelegramOriginal, originalImageButton, pruneTelegramOriginals} from "./telegram-image-archive.mjs";
import {handleRainbowProductInObject, handleRainbowProducts} from "./rainbow-products-worker.mjs";
import {handleRainbowInObject, handleRainbowNowcast} from "./rainbow-nowcast-worker.mjs";
import {translationStorage} from "./translation-storage.mjs";
import {enrichBrazilEpicenter, BRAZIL_EPICENTER_VERSION} from "./brazil-epicenter-location.mjs";
import {selectImageRefreshes} from "./telegram-image-refresh.mjs";
import {handleRuptureShaking} from "./rupture-shaking-worker.mjs";
import {handleCgeBulletins} from "./cge-bulletins-worker.mjs";
import {handleOfficialWeatherAlerts} from "./official-weather-alerts-worker.mjs";
import {handleWeatherObservations} from "./weather-observations-worker.mjs";
import {clampFdsnParams} from "./worker/fdsn-policy.mjs";
import {DAILY_SUMMARY_DESIGN} from "./daily-summary-renderer.mjs";
import {handleAfadEarthquakes, handleIngvEarthquakes, handleJmaEarthquakes, handleFunvisisEarthquakes, handleSeismicStatus} from "./worker/seismic-providers.mjs";
import {renderAlertImage, renderDailySummaryImage} from "./worker/image-rendering.mjs";
import {createTelegramTransport} from "./worker/telegram-transport.mjs";

// Delivery ports keep orchestration independent of rendering and Telegram transport.
async function renderAlertCardPng(ev) { return renderAlertImage(ev); }
async function renderDailySummaryPng(quakes = null) { return renderDailySummaryImage(quakes||await fetchDailyQuakesBrt()); }
const {telegramSendPhoto, telegramSendMessage, telegramEditAlert, telegramDailyRequest}=createTelegramTransport({renderAlertCardPng,queryImageExposure:(ev, env)=>queryImageExposure(ev, env),telegramCaption,enrichBrazilEpicenter,originalImageButton});

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
    'flood-api.open-meteo.com',
    'feeds.meteoalarm.org',
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
    'www.ovsicori.una.ac.cr',
    'www.snet.gob.sv',
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
    'www.bom.gov.au',
    'servicos.cptec.inpe.br', // CPTEC — condições atuais das capitais (XML)
    'dataserver-coids.inpe.br' // INPE — focos de queimadas (CSV 10min)
];

const SP_COORDS = { lat: -23.55, lon: -46.63 };
const SP_CACHE_TTL = 900;
const GLOBAL_CACHE_TTL = 300;
const V70_CACHE_TTL = 900;
const SP_CACHE_PATH = '/__cache/monitor-global/sp-clima';
const GLOBAL_CACHE_PATH = '/__cache/monitor-global/global-feeds';

let spRefreshPromise = null;
let globalRefreshPromise = null;

const SP_METAR_ICAO = ['SBSP', 'SBGR', 'SBKP', 'SBMT'];


async function sharedProviderText(url,env,options={},timeout=12000){
    if(!env?.EARTHQUAKE_ALERTS)return fetchText(url,options,timeout);
    const request=new Request('https://black-sky-9ba0.terrestre.workers.dev/?url='+encodeURIComponent(url));
    const r=await sharedSourceResponse(request,{...env,SHARED_SOURCE_INTERNAL:false},()=>fetchText(url,options,timeout).then(x=>new Response(x.text,{status:x.status,headers:{'Content-Type':x.contentType}})),ALLOWED_HOSTS);
    return {ok:r.ok,status:r.status,text:await r.text(),retained:['stale','partial'].includes(r.headers.get('X-Monitor-Source-State')),lastOk:Number(r.headers.get('X-Monitor-Source-Last-Ok'))||0};
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
    if(env?.EARTHQUAKE_ALERTS&&!env.SHARED_SOURCE_INTERNAL){const u=new URL(request.url);u.pathname='/sp-clima';u.search='';const r=await sharedSourceResponse(new Request(u),env,()=>handleSpClima(new Request(u),{...env,SHARED_SOURCE_INTERNAL:true}),ALLOWED_HOSTS);if(!r.ok)throw Error('Clima compartilhado indisponível');return r.json();}
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
    if(env?.EARTHQUAKE_ALERTS&&!env.SHARED_SOURCE_INTERNAL){const u=new URL(request.url);u.pathname='/global-feeds';u.search='';const r=await sharedSourceResponse(new Request(u),env,()=>handleGlobalFeeds(new Request(u),{...env,SHARED_SOURCE_INTERNAL:true}),ALLOWED_HOSTS);if(!r.ok)throw Error('Feeds compartilhados indisponíveis');return r.json();}
    if (!globalRefreshPromise) {
        globalRefreshPromise = (async () => {
            try {
                const settled = await Promise.all([getNhc(env), getGdacs(env), getEonet(env), getNws(env), getTsunamiAlerts(env)]);
                const items = settled.flatMap(x => x.items || []).sort((a,b) => (b.time || 0) - (a.time || 0));
                const data = {
                    atualizado_em: nowIso(),
                    fontes: settled.map(x => ({ source: x.source, online: x.ok, lastOk:x.lastOk||null, error: x.error || null, count: x.items?.length || 0 })),
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
    let m = html.match(/(\d+)\s*pontos?\s*de\s*alagamentos?\s*ativos?/i);
    if (m) return parseInt(m[1], 10);
    m = html.match(/pontos?\s*de\s*alagamentos?\s*[:\-]?\s*(\d+)\s*ativos?/i);
    if (m) return parseInt(m[1], 10);
    const blobs = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(x => x[1]);
    for (const blob of blobs) {
        const chave = blob.match(/"(alagamentos?_ativos)"\s*:\s*(\d+)/i);
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
    const cached = env?.SHARED_SOURCE_INTERNAL?null:await cacheGetJson(request, SP_CACHE_PATH);
    if (cached) return resposta(JSON.stringify(cached), 200, 'application/json; charset=utf-8', {
        'Cache-Control': `public, max-age=${SP_CACHE_TTL}, s-maxage=${SP_CACHE_TTL}, stale-while-revalidate=120`
    });
    const dados = await refreshSpClimaCache(request, env);
    return resposta(JSON.stringify(dados), 200, 'application/json; charset=utf-8', {
        'Cache-Control': `public, max-age=${SP_CACHE_TTL}, s-maxage=${SP_CACHE_TTL}, stale-while-revalidate=120`
    });
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
            const r = await sharedProviderText(u, env, { headers: { 'User-Agent': 'MonitorGlobal/6.1' } }, 12000);
            if (r.ok) return { source: 'NHC', ok: !r.retained, lastOk:r.lastOk, items: parseRss(r.text, 'NHC', 'cyclone') };
        } catch {}
    }
    return { source: 'NHC', ok: false, items: [], error: 'feed indisponível' };
}

async function getGdacs(env) {
    const urls = [
        'https://www.gdacs.org/xml/rss.xml',
        'https://www.gdacs.org/rss.aspx'
    ];
    for (const u of urls) {
        try {
            const r = await sharedProviderText(u, env, { headers: { 'User-Agent': 'MonitorGlobal/6.1', 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' } }, 12000);
            if (r.ok) return { source: 'GDACS', ok: !r.retained, lastOk:r.lastOk, items: parseRss(r.text, 'GDACS', 'disaster') };
        } catch {}
    }
    return { source: 'GDACS', ok: false, items: [], error: 'feed indisponível' };
}

async function getEonet(env) {
    try {
        const r=await sharedProviderText('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100',env);if(!r.ok)throw Error('EONET indisponível');const d=JSON.parse(r.text);
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
        return { source: 'EONET', ok: !r.retained, lastOk:r.lastOk, items };
    } catch (e) { return { source: 'EONET', ok: false, items: [], error: e.message }; }
}

async function getTsunamiAlerts(env) { if(!env?.EARTHQUAKE_ALERTS)return getOfficialTsunamis();const request=new Request('https://black-sky-9ba0.terrestre.workers.dev/tsunami-alerts');const r=await sharedSourceResponse(request,{...env,SHARED_SOURCE_INTERNAL:false},async()=>json(await getOfficialTsunamis()),ALLOWED_HOSTS);if(!r.ok)return {source:'Tsunami',ok:false,items:[],error:'Boletins indisponíveis'};const data=await r.json();return {...data,ok:data.ok&&!['stale','partial'].includes(r.headers.get('X-Monitor-Source-State'))}; }

async function getNws(env) {
    try {
        const r=await sharedProviderText('https://api.weather.gov/alerts/active',env);if(!r.ok)throw Error('NWS indisponível');const d=JSON.parse(r.text);
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
        return { source: 'NWS', ok: !r.retained, lastOk:r.lastOk, items };
    } catch (e) { return { source: 'NWS', ok: false, items: [], error: e.message }; }
}

async function getGlobalFeeds(request, env) {
    const cached = env?.SHARED_SOURCE_INTERNAL?null:await cacheGetJson(request, GLOBAL_CACHE_PATH);
    if (cached) return cached;
    return refreshGlobalFeedsCache(request, env);
}

async function handleGlobalFeeds(request,env){const feeds=await getGlobalFeeds(request,env);return json({...feeds,risco:calculateGlobalRisk(feeds)});}

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

async function getOfficialTsunamiCorrelation(lat, lon, time, mag) {
    const alerts = await getTsunamiAlerts();
    const now = Date.now();
    const quake={id:'correlation-query',type:'earthquake',coords:[lon,lat],time,mag};
    const relevant = Number.isFinite(time)?globalThis.TsunamiLink.forQuake(quake,alerts.items||[],[quake],now).filter(x=>x.alert.hazardNature==='warning'&&!x.alert.cancelled).map(x=>x.alert):[];
    return { online: alerts.ok, alerts: relevant.slice(0, 12) };
}

async function handleCorrelation(reqUrl, env) {
    const mag = Number(reqUrl.searchParams.get('mag'));
    const depth = Number(reqUrl.searchParams.get('depth'));
    const lat = Number(reqUrl.searchParams.get('lat'));
    const lon = Number(reqUrl.searchParams.get('lon'));
    const place = reqUrl.searchParams.get('place') || '';
    const time = reqUrl.searchParams.has('time')?Number(reqUrl.searchParams.get('time')):NaN;
    if (![mag, depth, lat, lon].every(Number.isFinite)) return json({ error: 'Parâmetros obrigatórios: mag, depth, lat, lon' }, 400);

    const [regions, places, official] = await Promise.all([
        queryUsGeoRegions(lat, lon),
        queryNearbyPlaces(lat, lon),
        getOfficialTsunamiCorrelation(lat, lon, time, mag)
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
    // A NHC não publica a trajetória prevista como um KMZ separado — ela vem
    // BUNDLED dentro do próprio KMZ do cone (trackCone.kmzFile): polígono da
    // incerteza + linha da trajetória + pontos de previsão, tudo junto. Um
    // campo "forecastTrack" separado nunca existiu de verdade nesse JSON;
    // ficava sempre nulo (bug corrigido aqui).
    const storms=(d.activeStorms||[]).map(s=>({id:s.id,name:s.name,classification:s.classification,intensity:Number(s.intensity),pressure:Number(s.pressure),lat:Number(s.latitudeNumeric),lon:Number(s.longitudeNumeric),movementDir:Number(s.movementDir),movementSpeed:Number(s.movementSpeed),updated:s.lastUpdate,cone:s.trackCone?.kmzFile||null,advisory:s.publicAdvisory?.url||null,graphics:s.forecastGraphics?.url||null}));
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
        usgsUrl:p?.noticeUrl || extra.usgsUrl || '', time:volcanoTs(last) || 0,
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
            base.hasVona=true; base.elevated=true; base.usgsVona=n; base._vonaTs=t;
            // An older aviation notice stays accessible without replacing today's status.
            if(base.time&&t<base.time)continue;
            base.noticeId=n?.noticeId || base.noticeId;
            base.usgsUrl=n?.noticeUrl || base.usgsUrl || '';
            base.lastActivity=sent || base.lastActivity; base.noticeSent=sent; base.time=t || base.time;
            base.vonaRemarks=n?.remarks||n?.noticeRemarks||base.vonaRemarks;
            base.ashHeight=n?.ashHeight||n?.ashCloudHeight||base.ashHeight;
            base.ashStatus=n?.ashStatus||n?.activityStatus||base.ashStatus;
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
        const ashHeight=get(/(?:OBS|EST) VA CLD:\s*([^\r\n]+)/i);
        const vonaRemarks=get(/RMK:\s*([\s\S]*?)(?=\n\s*(?:NXT ADVISORY|VA ADVISORY)|$)/i).replace(/\s+/g,' ');
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
            source:`VAAC ${source}`, area, advisory:adv, noticeId:adv, ashHeight, vonaRemarks, time:time || 0,
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
            source: 'Smithsonian GVP', country, startDate, noticeId:`gvp-${vnum||name}-${startDate}-${reportType}`, time:0,
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
const TELEGRAM_ALERT_CACHE_PATH = '/__cache/monitor-global/telegram-m6-sent';
const TELEGRAM_ALERT_TTL = 86400 * 3;

// Escapa os caracteres especiais do Markdown "legado" do Telegram
// (_ * ` [) em qualquer texto vindo de fonte externa (ex.: nome de
// local da USGS/EMSC), pra nunca mais quebrar o parser lá do Telegram
// com "can't parse entities" por causa de um caractere fora do nosso
// controle — foi exatamente isso que aconteceu com o @monitor_global.
function escapeMdLegacy(str) {
    return String(str ?? '').replace(/([_*`[])/g, '\\$1');
}

function telegramCaption(ev, record) {
    const mag = Number(ev.mag).toFixed(1).replace('.', ',');
    const place = escapeMdLegacy(globalThis.EventPortuguese.place(ev.place || 'Local desconhecido'));
    const depth = Number.isFinite(ev.depth) ? `${Math.round(Math.max(0,ev.depth))} km` : '—';
    const when = ev.timeIso
        ? new Date(ev.timeIso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' BRT'
        : '—';
    const src = escapeMdLegacy(ev.source || 'USGS');
    const status = ev.reviewed ? 'revisado' : 'automático';
    return (
        `${ev.brazil ? "🇧🇷 Sismo no Brasil" : "🌍 Alerta sísmico"}\n*M${mag}* — ${place}\n` +
        `📐 Profundidade: ${depth}\n` +
        `🕒 ${when}\n` +
        `📡 Fonte: ${src} · ${status}\n` +
        `Magnitude sujeita a revisão.\n` +
        (record?.revisions?.length ? `\nInicial: *M${Number(record.initialMag).toFixed(1).replace('.', ',')}* · Atual: *M${mag}*\n` +
            `Atualizado às ${new Date(record.updatedAt).toLocaleTimeString("pt-BR", {timeZone: "America/Sao_Paulo"})} BRT\n` +
            record.revisions.slice(-3).map(r => `${r.sameSource ? "Revisão da fonte" : "Nova estimativa"}: M${Number(r.mag).toFixed(1).replace('.', ',')} (${escapeMdLegacy(r.source)})`).join("\n") + "\n" : "") +
        `\n📢 Canal: @monitor\\_global\n` +
        `🌐 https://monitorglobal.top`
    );
}

// Procura, entre os alertas M6+ já enviados recentemente, um que esteja
// de outra rede, com até 30 segundos de diferença na origem e epicentro próximo do
// evento novo — sinal forte de que é a MESMA ocorrência sob outro ID de
// rede, e não um sismo novo de verdade.
function findNearDuplicateAlert(ev, sentRecords) {
    const evTime = ev.timeIso ? new Date(ev.timeIso).getTime() : null;
    for (const r of sentRecords) {
        if (!r || r.id === ev.id || !Number.isFinite(r.lat) || !Number.isFinite(r.lon)) continue;
        const rTime = r.timeIso ? new Date(r.timeIso).getTime() : null;
        if (r.baseline || r.delivery === 'uncertain' || r.delivery === 'sending' || !Number.isFinite(evTime) || !Number.isFinite(rTime)) continue;
        const small = ev.brazil || r.brazil;
        if ((ev.source || ev.provider) === (r.source || r.provider)) continue;
        if (Math.abs(evTime - rTime) > 30000) continue;
        if (Math.abs(ev.mag - r.mag) > (small ? 0.6 : 1)) continue;
        if (haversineKm(ev.lat, ev.lon, r.lat, r.lon) <= (small ? 20 : 50)) return r;
    }
    return null;
}

// Mensagem curta (sem card/imagem) pra quando o evento novo é uma provável
// duplicata de rede de um alerta já mandado — deixa claro que é uma
// ATUALIZAÇÃO de magnitude do mesmo tremor, não um sismo novo.
function telegramUpdateMessage(ev, dup) {
    const place = escapeMdLegacy(globalThis.EventPortuguese.place(ev.place || dup.place || 'Local desconhecido'));
    const newMag = Number(ev.mag).toFixed(1).replace('.', ',');
    const oldMag = Number(dup.mag).toFixed(1).replace('.', ',');
    const newSrc = escapeMdLegacy(ev.source || 'USGS');
    const oldSrc = escapeMdLegacy(dup.source || 'USGS');
    const arrow = ev.mag > dup.mag ? '⬆️' : ev.mag < dup.mag ? '⬇️' : '➡️';
    return (
        `🔄 *${ev.source === dup.source ? "Revisão da fonte" : "Nova estimativa de outra rede"}* ${arrow}\n` +
        `${place}\n\n` +
        `Antes: *M${oldMag}* (rede ${oldSrc})\n` +
        `Agora: *M${newMag}* (rede ${newSrc})\n\n` +
        `O cartão do alerta foi atualizado.\n` +
        `📢 Canal: @monitor\\_global`
    );
}

// Edição é idempotente: uma falha pode ser tentada novamente sem duplicar o alerta.
function telegramEventVersion(ev) {
    return JSON.stringify([ev.mag, ev.depth, ev.lat, ev.lon, ev.timeIso, ev.source, !!ev.reviewed, ev.place]);
}
function telegramImportantChange(before, after) {
    return Math.abs(after.mag - before.mag) >= 0.3 - 1e-8 ||
        [6, 7].some(limit => (before.mag >= limit) !== (after.mag >= limit)) ||
        // M6+ já é raro o bastante pra qualquer revisão de magnitude valer um
        // aviso novo, mesmo pequena (ex.: 6.1 -> 6.2) -- não só silenciar no card.
        (after.mag >= TELEGRAM_MIN_MAG && after.mag !== before.mag);
}
async function telegramReviseAlert(request, env, ev, observed, root, records) {
    const before = {...(root.currentEvent || root)};
    const revision = {mag: ev.mag, source: ev.source, sameSource: ev.source === before.source, at: nowIso()};
    const next = {...root, initialMag: root.initialMag ?? root.mag, updatedAt: nowIso(),
        revisions: [...(root.revisions || []), revision].slice(-12)};
    if (root.messageId) await telegramEditAlert(env, ev, next);
    next.cardImageVersion = 'cartographic-v11-full-hd';
    next.imageExposureVersion = exposureVersion(ev.imageExposure);
    next.imageExposureCheckedAt = Date.now();
    next.imageShakingVersion = shakingVersion(ev.shaking);
    next.imageShakingCheckedAt = Date.now();
    // Mensagens antigas não guardavam o ID: não é seguro apagar ou editar um ID adivinhado.
    const noticeBaseline = root.noticeBaseline || before;
    const important = telegramImportantChange(noticeBaseline, ev);
    Object.assign(root, next, {currentEvent: ev});
    observed.observedVersion = telegramEventVersion(ev);
    if (important || root.pendingNotice) root.pendingNotice = {
        before: root.pendingNotice?.before || noticeBaseline, after: ev,
        at: root.pendingNotice?.at || Date.now()
    };
    await saveSentAlerts(request, records, env);
    await telegramHistoryWrite(env, 'telegram-history-m6:' + new Date().toISOString() + ':' + crypto.randomUUID(), {
        kind: ev.brazil ? 'br-update' : 'm6-update', at: Date.now(), status: 'sent', mag: ev.mag, place: ev.place,
        previousMag: before.mag, messageId: root.messageId, sameSource: revision.sameSource,
        events: [{at: Date.now(), stage: root.messageId ? 'edited' : 'legacy-update'}]
    });

}

// Agrupa mudanças por pelo menos 30s. O próximo cron publica somente a estimativa final.
async function telegramFlushRevisionNotices(request, env, records) {
    for (const root of records) {
        const notice = root.pendingNotice;
        if (!notice || Date.now() - notice.at < 30000) continue;
        delete root.pendingNotice;
        const important = telegramImportantChange(notice.before, notice.after);
        if (important) root.noticeBaseline = notice.after;
        // Reserva antes do envio: timeout não provoca um aviso repetido na próxima consulta.
        await saveSentAlerts(request, records, env);
        if (!important) continue;
        try {
            await telegramSendMessage({...env, TELEGRAM_CHAT_ID: root.chatId ?? env.TELEGRAM_CHAT_ID}, root.messageId ? telegramUpdateMessage(notice.after, notice.before) :
                telegramUpdateMessage(notice.after, notice.before).replace('O cartão do alerta foi atualizado.', 'Atualização de alerta anterior.'), root.messageId);
        } catch (error) { console.error('Telegram aviso de revisão:', error.message); }
    }
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

// Guarda o registro completo (id + mag/lat/lon/hora/local/fonte) de cada
// alerta já mandado, não só o ID — o findNearDuplicateAlert precisa de
// lat/lon/hora pra comparar com eventos novos. Formato antigo (só
// {ids:[...]}) ainda é lido pra não perder o histórico anti-spam na troca;
// esses registros legados não têm geo, então só servem pro dedup exato por
// ID (comportamento de antes), não pra detecção de quase-duplicata.
async function loadSentAlerts(request, env) {
    if (env && env.TTS_USAGE) {
        try {
            const raw = await env.TTS_USAGE.get(TELEGRAM_SENT_KV_KEY);
            if (!raw) return [];
            const d = JSON.parse(raw);
            if (Array.isArray(d.items)) return d.items;
            if (Array.isArray(d.ids)) return d.ids.map(id => ({ id: String(id) }));
            return [];
        } catch (e) {
            console.warn('telegram KV read:', e?.message || e);
        }
    }
    try {
        const hit = await caches.default.match(cacheKey(request, TELEGRAM_ALERT_CACHE_PATH));
        if (!hit) return [];
        const d = await hit.json();
        if (Array.isArray(d.items)) return d.items;
        if (Array.isArray(d.ids)) return d.ids.map(id => ({ id: String(id) }));
        return [];
    } catch {
        return [];
    }
}

async function saveSentAlerts(request, records, env) {
    const items = records.slice(-5000); // inclui a linha de base brasileira e os pequenos tremores
    if (env && env.TTS_USAGE) {
        try {
            await env.TTS_USAGE.put(
                TELEGRAM_SENT_KV_KEY,
                JSON.stringify({ items, updatedAt: nowIso() }, (key,value)=>key==='shaking'?undefined:value),
                { expirationTtl: TELEGRAM_ALERT_TTL }
            );
            return;
        } catch (e) {
            console.warn('telegram KV write:', e?.message || e);
        }
    }
    try {
        const response = new Response(JSON.stringify({ items, updatedAt: nowIso() }, (key,value)=>key==='shaking'?undefined:value), {
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

// Um único Durable Object serializa cron e chamadas manuais; o histórico de envio
// é consistente imediatamente, sem a janela de replicação do KV.
export class EarthquakeAlertDelivery {
    constructor(state, env) { this.state = state; this.env = env; this.queue = Promise.resolve(); this.sourceCache=new SourceWritebackCache(state.storage); }
    async alarm(){await pruneSources(this.state.storage);await prunePersistentHistory(this.state.storage);await expirePopulation(this.state.storage);await pruneVoiceCache(this.state.storage);}
    fetch(request) {
        const operation = this.queue.then(async () => {
            if(new URL(request.url).pathname.startsWith('/__kv-usage/'))return handleKvUsageObject(request,this.state.storage);
            return withKvUsage(this.env,async measuredEnv=>{
            if(new URL(request.url).pathname==='/__source-health')return Response.json({...await sourceObjectHealth(this.sourceCache),checkpointIntervalSeconds:900,persistenceDegraded:!!this.sourceCache.lastFailure});
            if(sourcePolicy(request,ALLOWED_HOSTS)){const response=await handleSourceInObject(request,measuredEnv,this.sourceCache,()=>handleWorkerRequest(request,{...measuredEnv,SHARED_SOURCE_INTERNAL:true}),ALLOWED_HOSTS);await this.sourceCache.flush();return response;}
            if(new URL(request.url).pathname.startsWith('/__telegram-history/'))return handlePersistentHistory(request,this.state.storage);
            if(new URL(request.url).pathname==='/population-exposure')return handlePopulationExposure(request,{...measuredEnv,EARTHQUAKE_ALERTS:undefined,POPULATION_COORDINATOR:undefined},this.state.storage);
            if(new URL(request.url).pathname==='/tts')return handleTts(new URL(request.url),measuredEnv,this.state.storage);
            if(new URL(request.url).pathname.startsWith('/telegram-image/'))return serveTelegramOriginal(request,this.state.storage);
            if(/^\/(?:rain-weather|rainbow-snapshot|rainbow-tile)(?:\/|$)/.test(new URL(request.url).pathname))return handleRainbowProductInObject(request,measuredEnv,this.state.storage);
            if(new URL(request.url).pathname==='/rain-nowcast')return handleRainbowInObject(request,measuredEnv,this.state.storage);
            if(new URL(request.url).pathname==='/translate-pt'){
                const kv=measuredEnv.TTS_USAGE,storage=this.state.storage;
                const env={...measuredEnv,EARTHQUAKE_ALERTS:undefined,TTS_USAGE:translationStorage(storage,kv)};
                return handlePortugueseTranslation(request,env);
            }
            const storage = this.state.storage;
            const kv = telegramHistoryStorage(storage,measuredEnv.TTS_USAGE);
            const env = {...measuredEnv, POPULATION_COORDINATOR:measuredEnv.EARTHQUAKE_ALERTS, ARCHIVE_TELEGRAM_IMAGE:(png,key)=>archiveTelegramOriginal(storage,png,key), IMAGE_WAIT_UNTIL: promise => this.state.waitUntil?.(promise), EARTHQUAKE_ALERTS: undefined, TTS_USAGE: {
                get: async (key, ...args) => {
                    if (key === TELEGRAM_SENT_KV_KEY || key.startsWith('telegram-brazil-baseline:')) {
                        let value;
                        if (key === TELEGRAM_SENT_KV_KEY) {
                            const chunks = await storage.get(key + ':chunks');
                            if (Number.isInteger(chunks)) {
                                const parts = await Promise.all(Array.from({length: chunks}, (_, i) => storage.get(key + ':part:' + i)));
                                if (parts.some(part => typeof part !== 'string')) throw new Error('Histórico Telegram incompleto');
                                return parts.join('');
                            }
                        }
                        value = await storage.get(key);
                        return value === undefined ? kv?.get(key, ...args) : value;
                    }
                    return kv?.get(key, ...args);
                },
                put: async (key, value, opts) => {
                    if (key === TELEGRAM_SENT_KV_KEY) {
                        // Valor cabe folgado no limite de 2 MiB por linha do armazenamento
                        // SQLite do Durable Object (classe migrada em new_sqlite_classes) —
                        // 400 mil caracteres ainda deixa margem mesmo com UTF-8 de quatro
                        // bytes. Esse fatiamento era herdado do limite de 128 KiB por valor
                        // do backend clássico de key-value, de antes da migração; mantido
                        // como rede de segurança, mas com blocos bem maiores, porque
                        // saveSentAlerts regrava o histórico inteiro a cada chamada (e é
                        // chamado várias vezes por execução do cron, a cada ~15min) — com
                        // blocos de 24 mil caracteres isso multiplicava uma única gravação
                        // lógica em dezenas de linhas gravadas no Durable Object por vez.
                        const parts = Array.from({length: Math.ceil(value.length / 400000)}, (_, i) => value.slice(i * 400000, (i + 1) * 400000));
                        const write = async target => {
                            for (let i = 0; i < parts.length; i++) await target.put(key + ':part:' + i, parts[i]);
                            await target.put(key + ':chunks', parts.length);
                        };
                        if (storage.transaction) await storage.transaction(write); else await write(storage);
                    } else if (key.startsWith('telegram-brazil-baseline:')) await storage.put(key, value);
                    else await kv?.put(key, value, opts);
                }
            }};
            return Response.json(await runTelegramM6Alerts(request, env));
            },this.state);
        });
        this.queue = operation.catch(() => {});
        return operation;
    }
}


const TG_HISTORY_TTL=31*86400;
async function telegramHistoryWrite(env,key,record){
    if(!env.TTS_USAGE)return false;
    try {
        const metadata={kind:record.kind,at:record.at,status:record.status,mag:record.mag||0,place:String(record.place||'').slice(0,180)};
        await env.TTS_USAGE.put(key,JSON.stringify(record),{expirationTtl:TG_HISTORY_TTL,metadata});
        return true;
    } catch { console.error('Telegram: falha ao gravar histórico'); return false; }
}
async function handleTelegramHistory(request,env){
    const u=new URL(request.url);
    if(!env.DAILY_SUMMARY||!env.TTS_USAGE)return json({ok:false,error:'Armazenamento do histórico indisponível'},503);
    if(u.pathname==='/telegram-history-preview'){
        const day=u.searchParams.get('day')||'';
        if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return json({error:'Data inválida'},400);
        const current=await env.DAILY_SUMMARY.get(env.DAILY_SUMMARY.idFromName(day)).fetch('https://summary.internal/preview?day='+day);
        if(current.status!==404)return new Response(current.body,{status:current.status,headers:{...CORS_HEADERS,'Content-Type':'image/png'}});
        const png=await env.TTS_USAGE.get('telegram-history-preview:'+day,'arrayBuffer');
        if(!png)return json({error:'Prévia não disponível para esta data'},404);
        return new Response(png,{headers:{...CORS_HEADERS,'Content-Type':'image/png'}});
    }
    if(u.pathname==='/telegram-history-detail'){
        const key=u.searchParams.get('key')||'';
        if(!/^telegram-history-m6:[0-9TZ:.\-]+:[a-f0-9-]+$/.test(key))return json({error:'Registro inválido'},400);
        if(env.EARTHQUAKE_ALERTS){const current=await env.EARTHQUAKE_ALERTS.get(env.EARTHQUAKE_ALERTS.idFromName('earthquake-alerts')).fetch('https://alerts.internal/__telegram-history/get?key='+encodeURIComponent(key));if(current.status!==404)return new Response(current.body,{status:current.status,headers:{...CORS_HEADERS,'Content-Type':'application/json'}});}
        const raw=await env.TTS_USAGE.get(key);
        return raw?json({ok:true,record:JSON.parse(raw)}):json({error:'Registro não encontrado'},404);
    }
    const daily=await Promise.all(Array.from({length:30},async(_,i)=>{
        const day=saoPauloYmdOffset(-1-i);
        try {
            const response=await env.DAILY_SUMMARY.get(env.DAILY_SUMMARY.idFromName(day)).fetch('https://summary.internal/history');
            if(!response.ok)return {kind:'daily',day,status:'unavailable',events:[]};
            const data=await response.json();
            return data.record?{kind:'daily',day,...data.record}:null;
        } catch {return {kind:'daily',day,status:'unavailable',events:[]};}
    }));
    // Metadados permitem listar alertas sem uma leitura KV por mensagem.
    const m6=[];let cursor,hasMore=false;
    if(env.EARTHQUAKE_ALERTS){for(let page=0;page<5;page++){const r=await env.EARTHQUAKE_ALERTS.get(env.EARTHQUAKE_ALERTS.idFromName('earthquake-alerts')).fetch('https://alerts.internal/__telegram-history/list'+(cursor?'?cursor='+encodeURIComponent(cursor):''));if(!r.ok)throw Error('Histórico persistente indisponível');const list=await r.json();list.keys.forEach(k=>m6.push({key:k.name,...k.metadata}));hasMore=!list.list_complete;if(!hasMore)break;cursor=list.cursor;}}
    const currentHasMore=hasMore;cursor=undefined;
    let legacyUnavailable=false;try {for(let page=0;page<5;page++){
        const list=await env.TTS_USAGE.list({prefix:'telegram-history-m6:',limit:1000,...(cursor?{cursor}:{})});
        list.keys.forEach(k=>{if(k.metadata)m6.push({key:k.name,...k.metadata});});
        hasMore=!list.list_complete;
        if(!hasMore)break;cursor=list.cursor;
    }
    }catch{legacyUnavailable=true;hasMore=true;}
    const cutoff=Date.now()-30*86400000;
    let old;try{old=await env.TTS_USAGE.get(TELEGRAM_DAILY_KV_KEY);}catch{legacyUnavailable=true;}
    if(old){
        const confirmed=JSON.parse(old);
        if(confirmed.day && Date.parse(confirmed.sentAt)>=cutoff && !daily.some(x=>x?.day===confirmed.day))
            daily.push({kind:'daily',day:confirmed.day,status:'sent',at:Date.parse(confirmed.sentAt),legacy:true,events:[]});
    }
    return json({ok:true,daily:daily.filter(Boolean),alerts:[...new Map(m6.filter(x=>x.at>=cutoff).reverse().map(x=>[x.key,x])).values()].sort((a,b)=>b.at-a.at),hasMore:hasMore||currentHasMore,legacyUnavailable,retentionDays:30});
}

async function runTelegramM6Alerts(request, env) {
    if (env.EARTHQUAKE_ALERTS) {
        const stub = env.EARTHQUAKE_ALERTS.get(env.EARTHQUAKE_ALERTS.idFromName('earthquake-alerts'));
        return (await stub.fetch(request)).json();
    }
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        return {
            ok: false,
            skipped: true,
            reason: 'Secrets TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID não configurados',
            sent: []
        };
    }

    const sentRecords = await loadSentAlerts(request, env);
    const [globalResult, brazil] = await Promise.all([
        fetchUsgsM6Recent().then(events => ({events})).catch(() => ({events: [], failed: true})),
        fetchTelegramBrazilRecent(env)
    ]);
    const events = [...globalResult.events];
    // O filtro M6 deixa de retornar revisões M5.9: consultar os IDs já anunciados por 72h.
    const tracked = sentRecords.filter(r => (r.provider === 'USGS' || !r.provider && r.url?.includes('earthquake.usgs.gov')) && !r.baseline &&
        Date.parse(r.timeIso) >= Date.now() - 72 * 3600000 && !events.some(ev => ev.id === r.id));
    for (let i = 0; i < tracked.length; i += 5) {
        const results = await Promise.allSettled(tracked.slice(i, i + 5).map(r => fetchUsgsM6Recent(r.id)));
        for (const result of results) if (result.status === 'fulfilled') events.push(...result.value);
    }
    const sentIds = new Set(sentRecords.map(r => r.id));
    for (const source of brazil.sources) {
        if (!source.ready) {
            for (const ev of source.events) {
                if (ev.mag >= TELEGRAM_MIN_MAG || sentIds.has(ev.id)) continue;
                sentRecords.push({...ev, baseline: true}); sentIds.add(ev.id);
            }
            await saveSentAlerts(request, sentRecords, env);
            await env.TTS_USAGE.put(source.key, nowIso());
        }
        events.push(...source.events.filter(ev => source.ready || ev.mag >= TELEGRAM_MIN_MAG));
    }
    const sent = [];
    const updates = [];
    const skipped = [];

    for (const ev of events) {
        await enrichBrazilEpicenter(ev);
        if (sentIds.has(ev.id)) {
            const observed = sentRecords.find(r => r.id === ev.id);
            const root = observed.aliasOf ? sentRecords.find(r => r.id === observed.aliasOf) : observed;
            if (!observed.baseline && Number.isFinite(observed.mag) && observed.delivery !== 'uncertain' && observed.delivery !== 'sending' && root &&
                (observed.observedVersion || telegramEventVersion(observed)) !== telegramEventVersion(ev)) {
                try {
                    const previousMag = (root.currentEvent || root).mag;
                    await telegramReviseAlert(request, env, ev, observed, root, sentRecords);
                    updates.push({id: ev.id, mag: ev.mag, previousMag});
                } catch (error) { console.error('Telegram edição pendente:', ev.id, error.message); }
            } else skipped.push(ev.id);
            continue;
        }
        // Estimativa de outra rede para a mesma origem: editar o cartão original.
        // Horário de origem, epicentro e redes diferentes evitam juntar réplicas.
        const dup = findNearDuplicateAlert(ev, sentRecords);
        if (dup) {
            const root = (dup.aliasOf ? sentRecords.find(r => r.id === dup.aliasOf) : dup) || dup;
            const alias = {...ev, aliasOf: root.id};
            sentRecords.push(alias);
            try {
                const before = {...(root.currentEvent || root)};
                if (telegramEventVersion(ev) !== telegramEventVersion(before))
                    await telegramReviseAlert(request, env, ev, alias, root, sentRecords);
                else await saveSentAlerts(request, sentRecords, env);
                sentIds.add(ev.id);
                updates.push({id: ev.id, mag: ev.mag, comparedTo: root.id, previousMag: before.mag});
            } catch (error) { sentRecords.splice(sentRecords.indexOf(alias), 1); console.error('Telegram edição pendente:', ev.id, error.message); }
            continue;
        }
        const historyKey='telegram-history-m6:'+new Date().toISOString()+':'+crypto.randomUUID();
        const history={kind:ev.brazil?(dup?'br-update':'br'):(dup?'m6-update':'m6'),at:Date.now(),status:'sending',mag:ev.mag,place:ev.place,events:[{at:Date.now(),stage:'sending'}]};
        await telegramHistoryWrite(env,historyKey,history);
        // Reserva persistente antes do envio: um timeout ambíguo não reenvia a mesma ocorrência.
        const reservation = {...ev, delivery: 'sending'};
        sentRecords.push(reservation); sentIds.add(ev.id);
        await saveSentAlerts(request, sentRecords, env);
        try {
            const caption = telegramCaption(ev);
            try {
                const response = await telegramSendPhoto(env, ev, caption);
                reservation.messageId = response.result?.message_id;
                reservation.chatId = response.result?.chat?.id ?? env.TELEGRAM_CHAT_ID;
                reservation.messageType = "photo";
            } catch (photoErr) {
                // Fallback: só texto, se o mapa estático falhar
                if (!photoErr.telegramRejected && !photoErr.cardFailed) throw photoErr;
                console.warn('sendPhoto rejeitado, fallback texto');
                const response = await telegramSendMessage(
                    env,
                    caption + `\n\n🗺 ${ev.lat.toFixed(2).replace('.', ',')}, ${ev.lon.toFixed(2).replace('.', ',')}\n${escapeMdLegacy(ev.url)}`
                );
                reservation.messageId = response.result?.message_id;
                reservation.chatId = response.result?.chat?.id ?? env.TELEGRAM_CHAT_ID;
                reservation.messageType = "text";
            }
            reservation.cardImageVersion = 'cartographic-v11-full-hd';
            reservation.imageExposureVersion = exposureVersion(ev.imageExposure);
            reservation.imageExposureCheckedAt = Date.now();
            reservation.currentEvent = ev;
            reservation.originalImageKey = ev.originalImageKey;
            reservation.imageShakingVersion = shakingVersion(ev.shaking);
            reservation.imageShakingCheckedAt = Date.now();
            reservation.initialMag = ev.mag;
            reservation.noticeBaseline = ev;
            reservation.observedVersion = telegramEventVersion(ev);
            sent.push({ id: ev.id, mag: ev.mag, place: ev.place });
            history.status='sent';history.sentAt=Date.now();
            history.events.push({at:history.sentAt,stage:'sent'});
            await telegramHistoryWrite(env,historyKey,history);
            sentIds.add(ev.id);
            reservation.delivery = 'sent';
            await saveSentAlerts(request, sentRecords, env);
        } catch (e) {
            history.status = e.telegramRejected ? 'failed' : 'uncertain';
            reservation.delivery = history.status;
            if (e.telegramRejected) { sentIds.delete(ev.id); sentRecords.splice(sentRecords.indexOf(reservation), 1); }
            await saveSentAlerts(request, sentRecords, env);
            history.events.push({at:Date.now(),stage:history.status});
            await telegramHistoryWrite(env,historyKey,history);
            console.error('Telegram alerta falhou:', ev.id, e.message);
        }
    }

    // One-minute checks for M5.5+ in the first hour; five minutes thereafter.
    // A single save after the loop (not one per root) avoids rewriting the
    // whole history up to 3x per cron tick for what's usually just a
    // checked-at timestamp refresh -- losing an unsaved root mid-loop to a
    // crash only costs a redundant re-check next tick, never a duplicate or
    // missed Telegram edit (telegramEditAlert is itself version-guarded).
    const dueForRefresh = selectImageRefreshes(sentRecords);
    for (const root of dueForRefresh) {
        root.imageExposureCheckedAt = Date.now();
        const ev = {...(root.currentEvent || root)};
        const shaking=await queryImageShaking(ev);root.imageShakingCheckedAt=Date.now();
        const previousShakingVersion=root.imageShakingVersion||'unavailable';
        // Do not replace a published grid with a radial model during a provider outage.
        if(!validImageShaking(shaking)&&previousShakingVersion!=='unavailable')continue;
        if(validImageShaking(shaking))ev.shaking=shaking;
        const nextShakingVersion=shakingVersion(ev.shaking);
        let data = await queryImageExposure(ev, env);
        // A slow refresh must not replace previously available population with a pending label.
        const keepKnownPopulation = String(root.imageExposureVersion || '').startsWith('[') && (!validImageExposure(data)||exposureQuality(data)<Math.max(exposureQuality(ev.imageExposure),exposureVersionQuality(root.imageExposureVersion)));
        if (keepKnownPopulation) {
            if(validImageExposure(ev.imageExposure))data=ev.imageExposure;
            else continue;
        }
        if (validImageExposure(data) && exposureVersion(data)!==root.imageExposureVersion || nextShakingVersion!==previousShakingVersion || root.cardImageVersion !== 'cartographic-v11-full-hd') {
            ev.imageExposure = data;
            try { await telegramEditAlert(env, ev, root); root.currentEvent = ev; root.imageShakingVersion = nextShakingVersion; root.place = ev.place; root.cardImageVersion = 'cartographic-v11-full-hd'; root.imageExposureVersion = exposureVersion(data); }
            catch (error) { console.error('Exposicao Telegram: edicao pendente', root.id); }
        } else root.imageExposureVersion = exposureVersion(data);
    }
    if (dueForRefresh.length) await saveSentAlerts(request, sentRecords, env);
    await telegramFlushRevisionNotices(request, env, sentRecords);
    if (sent.length || updates.length) await saveSentAlerts(request, sentRecords, env);

    return {
        ok: true,
        checked: events.length,
        sent,
        updates,
        alreadySent: skipped.length,
        minMag: TELEGRAM_MIN_MAG,
        brazil: {allMagnitudes: true, initializedSources: brazil.sources.map(s => s.provider), failedSources: brazil.failedSources},
        globalSourceFailed: !!globalResult.failed,
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

const TELEGRAM_DAILY_CACHE_PATH='/__cache/monitor-global/telegram-daily-summary';
// Mesmo motivo do KV em loadSentAlerts/saveSentAlerts acima: caches.default
// é por data-center, e o Cron Trigger pode cair num data-center diferente a
// cada tick dentro da janela 00:00-00:20 BRT — arriscando reenviar o resumo
// do dia. KV (env.TTS_USAGE) é global; caches.default fica só de fallback.
const TELEGRAM_DAILY_KV_KEY = 'telegram-daily-summary-sent';
// Leitura apenas para preservar envios confirmados pela versão anterior.
// Falha de leitura não é tratada como autorização para reenviar.
async function dailySummarySent(request,day,env){
    if(!env.TTS_USAGE) throw new Error('KV de histórico indisponível');
    const raw=await env.TTS_USAGE.get(TELEGRAM_DAILY_KV_KEY);
    return raw ? JSON.parse(raw).day===day : false;
}
async function markDailySummarySent(request,day,env){
    await env.TTS_USAGE.put(TELEGRAM_DAILY_KV_KEY,
        JSON.stringify({day,sentAt:nowIso()}),{expirationTtl:172800});
}
function dailyBrazilFingerprint(quakes){
    return JSON.stringify((quakes.brazilEvents||[]).map(e=>[e.id,e.time,e.mag,e.lat,e.lon,e.depth,e.place]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
}
function dailySummaryCaption(quakes){
    const top=quakes.events.slice().sort((a,b)=>b.mag-a.mag).slice(0,5),br=quakes.brazilEvents||[];
    return `📊 Resumo do dia — ${quakes.day.split('-').reverse().join('/')}`+
        `\n🌍 ${quakes.events.length} sismos registrados`+
        `\n🏆 Maior: ${top[0]?`M${top[0].mag.toFixed(1).replace('.', ',')} — ${globalThis.EventPortuguese.place(top[0].place)}`:'sem registro'}`+
        (br.length?`\n🇧🇷 Brasil: ${br.length} sismo${br.length===1?'':'s'} · maior M${br[0].mag.toFixed(1).replace('.', ',')}`:
        quakes.brazilFailedSources?.length?'\n🇧🇷 Brasil: consulta incompleta; atualização pendente':'\n🇧🇷 Brasil: nenhum sismo registrado nas fontes consultadas')+
        '\n🌐 monitorglobal.top';
}
// Reconcilia publicações brasileiras atrasadas com o mesmo boletim, sem reenviá-lo.
async function refreshDailyBrazilSummary(request,env,storage){
    const day=new URL(request.url).searchParams.get('day');
    if(![1,2,3].map(n=>saoPauloYmdOffset(-n)).includes(day))return Response.json({ok:false,error:'Data fora do período de revisão'},{status:400});
    const token=crypto.randomUUID(),now=Date.now();
    const claimed=await storage.transaction(async tx=>{
        const history=await tx.get('history'),delivery=await tx.get('delivery'),refresh=await tx.get('brazil-refresh');
        if(delivery?.status!=='sent'||!history?.messageId||history.format!=='photo'||!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID)return false;
        if(refresh?.until>now)return false;
        await tx.put('brazil-refresh',{token,until:now+120000});return true;
    });
    if(!claimed)return Response.json({ok:true,skipped:true});
    try{
        const quakes=await fetchDailyQuakesBrt(day),fingerprint=dailyBrazilFingerprint(quakes),history=await storage.get('history');
        // Não substituir dados conhecidos por um catálogo parcial ou vazio.
        if(quakes.brazilFailedSources.length)throw new Error('Consulta brasileira incompleta');
        if(!quakes.brazilEvents.length||history.brazilFingerprint===fingerprint){
            await storage.put('brazil-refresh',{token,until:Date.now()+1800000});
            return Response.json({ok:true,skipped:true,day});
        }
        const pack=await renderDailySummaryPng(quakes),form=new FormData();
        form.append('chat_id',String(env.TELEGRAM_CHAT_ID));form.append('message_id',String(history.messageId));
        form.append('media',JSON.stringify({type:'photo',media:'attach://summary',caption:dailySummaryCaption(quakes).slice(0,1024)}));
        form.append('summary',new Blob([pack.png],{type:'image/png'}),'monitor-global-resumo-atualizado.png');
        let originalImageKey=history.originalImageKey;
        try{originalImageKey=await archiveTelegramOriginal(storage,pack.png,originalImageKey,{summary:true});await storage.setAlarm?.(Date.now()+72*3600000+1000);form.append('reply_markup',JSON.stringify(originalImageButton(originalImageKey,day)));}catch{console.warn('Original revisado do resumo indisponível');}
        try{await telegramDailyRequest(env,'editMessageMedia',form);}catch(error){if(!/message is not modified/i.test(error.message))throw error;}
        await storage.transaction(async tx=>{
            const h=await tx.get('history');h.brazilFingerprint=fingerprint;if(originalImageKey)h.originalImageKey=originalImageKey;h.brazilRevisedAt=Date.now();h.total=quakes.events.length;
            h.events=(h.events||[]).slice(-199);h.events.push({at:Date.now(),stage:'brazil-revised'});
            await tx.put('history',h);await tx.put('brazil-refresh',{token,until:Date.now()+1800000});
        });
        try{await env.TTS_USAGE?.put('telegram-history-preview:'+day,pack.png,{expirationTtl:TG_HISTORY_TTL});}catch{}
        return Response.json({ok:true,day,brazil:quakes.brazilEvents.length,messageId:history.messageId});
    }catch(error){
        await storage.put('brazil-refresh',{token,until:Date.now()+300000});
        console.warn('Revisão do resumo brasileiro pendente:',day);
        return Response.json({ok:false,error:'Revisão brasileira pendente'},{status:502});
    }
}
async function refreshRecentDailyBrazilSummaries(env){
    if(!env.DAILY_SUMMARY)return;
    for(const offset of [1,2,3]){
        const day=saoPauloYmdOffset(-offset),id=env.DAILY_SUMMARY.idFromName(day);
        await env.DAILY_SUMMARY.get(id).fetch('https://summary.internal/refresh-brazil?day='+day);
    }
}
async function deliverTelegramDailySummary(request,env,delivery){
    if(!env.TELEGRAM_BOT_TOKEN||!env.TELEGRAM_CHAT_ID) {
        console.error('Telegram resumo diário: secrets ausentes');
        return {ok:false,skipped:true,reason:'Secrets Telegram ausentes'};
    }
    const day=saoPauloYmdOffset(-1);
    if(await dailySummarySent(request,day,env)) return {ok:true,skipped:true,reason:'resumo já enviado',day};
    await delivery.note('query');
    const quakes=await fetchDailyQuakesBrt();
    await delivery.note('data',{day:quakes.day,total:quakes.events.length,brazilFingerprint:dailyBrazilFingerprint(quakes)});
    const top=quakes.events.slice().sort((a,b)=>b.mag-a.mag).slice(0,5);
    const caption=dailySummaryCaption(quakes);
    let pack;
    try {
        await delivery.note('render');
        pack=await renderDailySummaryPng(quakes);
    } catch(e) {
        // Só usar texto se a renderização falhar ANTES de enviar ao Telegram.
        await delivery.note('text-fallback');
        console.error('Telegram resumo diário: renderização falhou; usando texto');
    }
    if(pack) {
        const form=new FormData();
        form.append('chat_id',String(env.TELEGRAM_CHAT_ID));
        form.append('caption',caption.slice(0,1024));
        form.append('photo',new Blob([pack.png],{type:'image/png'}),'monitor-global-resumo.png');
        if(env.ARCHIVE_TELEGRAM_SUMMARY_IMAGE)try{const key=await env.ARCHIVE_TELEGRAM_SUMMARY_IMAGE(pack.png);form.append('reply_markup',JSON.stringify(originalImageButton(key,day)));await delivery.note('original-ready',{originalImageKey:key});}catch{console.warn('Original do resumo indisponível');}
        let hasPreview=false;
        try {
            await env.TTS_USAGE.put('telegram-history-preview:'+day,pack.png,{expirationTtl:TG_HISTORY_TTL});
            hasPreview=true;
        } catch { console.error('Telegram: prévia não armazenada'); }
        await delivery.note('prepared',{format:'photo',hasPreview});
        await delivery.beforeSend();
        const response=await telegramDailyRequest(env,'sendPhoto',form);
        await delivery.confirm({messageId:response.result?.message_id});
    } else {
        const text=caption+'\n\nTop 5:\n'+(top.map((e,i)=>
            `${i+1}. M${e.mag.toFixed(1).replace('.', ',')} — ${globalThis.EventPortuguese.place(e.place)}`).join('\n')||'Sem registro');
        const form=new FormData();
        form.append('chat_id',String(env.TELEGRAM_CHAT_ID));
        form.append('text',text.slice(0,4096));
        await delivery.note('prepared',{format:'text',hasPreview:false});
        await delivery.beforeSend();
        const response=await telegramDailyRequest(env,'sendMessage',form);
        await delivery.confirm({messageId:response.result?.message_id});
    }
    try { await markDailySummarySent(request,day,env); }
    catch { console.error('Resumo confirmado; falha ao atualizar marcador persistente'); }
    console.log('Telegram resumo diário: enviado', {day,total:quakes.events.length,format:pack?'photo':'text'});
    return {ok:true,day,total:quakes.events.length};
}



async function runTelegramDailySummary(request,env){
    const p=saoPauloParts();
    if(Number(p.hour)!==0 || Number(p.minute)>30)
        return {ok:true,skipped:true,reason:'fora da janela 00:00–00:30 BRT'};
    if(!env.DAILY_SUMMARY) throw new Error('Controle central do resumo indisponível');
    const day=saoPauloYmdOffset(-1);
    const id=env.DAILY_SUMMARY.idFromName(day);
    const response=await env.DAILY_SUMMARY.get(id).fetch('https://summary.internal/');
    const result=await response.json();
    if(!response.ok) throw new Error(result.error||'Resumo pendente');
    return result;
}

// Um objeto persistente por data; reservas atômicas sobrevivem a deploys.
// "sending" não expira: um timeout pode acontecer depois da entrega.
export class DailySummaryDelivery {
    constructor(ctx,env) { this.ctx=ctx; this.env=env; }
    async alarm(){await prunePersistentHistory(this.ctx.storage);await pruneTelegramOriginals(this.ctx.storage);}
    async fetch(request){return withKvUsage(this.env,env=>this.handleRequest(request,env),this.ctx);}
    async handleRequest(request,env) {
        env={...env,TTS_USAGE:telegramHistoryStorage(this.ctx.storage,env.TTS_USAGE,{summary:true})};
        if(new URL(request.url).pathname==='/preview'){const day=new URL(request.url).searchParams.get('day')||'';if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return Response.json({error:'day'},{status:400});const png=await persistentHistoryGet(this.ctx.storage,'telegram-history-preview:'+day,'arrayBuffer');return png===undefined?new Response(null,{status:404}):new Response(png,{headers:{'Content-Type':'image/png'}});}
        if(new URL(request.url||request).pathname.startsWith('/telegram-summary-image/'))return serveTelegramOriginal(request,this.ctx.storage);
        if(new URL(request.url||request).pathname==='/refresh-brazil')return refreshDailyBrazilSummary(request,env,this.ctx.storage);
        if(new URL(request.url||request).pathname==='/history'){
            const history=await this.ctx.storage.get('history');
            const state=await this.ctx.storage.get('delivery');
            if(!history&&!state)return Response.json({record:null});
            const status=state?.status==='sending'?(history?.status==='uncertain'||Date.now()-(state.at||0)>45000?'uncertain':'sending'):state?.status==='sent'?'sent':history?.status||'pending';
            return Response.json({record:{...history,status,at:history?.at||state?.at||0,events:history?.events||[],legacy:!history}});
        }
        const p=saoPauloParts();
        if(Number(p.hour)!==0 || Number(p.minute)>30)
            return Response.json({ok:true,skipped:true,reason:'fora da janela'});
        const token=crypto.randomUUID(), now=Date.now(), storage=this.ctx.storage;
        const claimed=await storage.transaction(async tx=>{
            const state=await tx.get('delivery');
            if(state && (state.status!=='preparing'||state.until>now)) return false;
            await tx.put('delivery',{status:'preparing',token,until:now+120000});
            const history=await tx.get('history')||{events:[],attempts:0};
            history.events=(history.events||[]).slice(-199);
            history.events.push({at:now,stage:'preparing'});
            history.at=now;history.status='preparing';history.attempts++;
            await tx.put('history',history);
            return true;
        });
        if(!claimed) return Response.json({ok:true,skipped:true,reason:'envio reservado ou confirmado'});
        const note=async(stage,details={})=>storage.transaction(async tx=>{
            if((await tx.get('delivery'))?.token!==token)throw new Error('Reserva substituída');
            const history=await tx.get('history')||{events:[]};
            history.events=(history.events||[]).slice(-199);
            history.events.push({at:Date.now(),stage});
            Object.assign(history,details,{at:Date.now(),status:stage});
            await tx.put('history',history);
        });
        const change=async status=>storage.transaction(async tx=>{
            const state=await tx.get('delivery');
            if(state?.token!==token) throw new Error('Reserva substituída');
            if(status==='sending' && state.status!=='preparing') throw new Error('Envio já iniciado');
            await tx.put('delivery',{status,token,at:Date.now()});
        });
        try {
            const result=await deliverTelegramDailySummary(request,{...env,ARCHIVE_TELEGRAM_SUMMARY_IMAGE:async(png,key)=>{const saved=await archiveTelegramOriginal(storage,png,key,{summary:true});await storage.setAlarm?.(Date.now()+72*3600000+1000);return saved;}},{
                note,
                beforeSend:async()=>{await change('sending');await note('sending');},
                confirm:async details=>{await change('sent');await note('sent',details);}
            });
            if(result.skipped && result.reason==='resumo já enviado') {
                await change('sent');await note('legacy-confirmed',{legacy:true});
            }
            else if(!result.ok) {
                await storage.transaction(async tx=>{
                    if((await tx.get('delivery'))?.token===token) {
                        await tx.delete('delivery');
                        const history=await tx.get('history')||{events:[]};
                        history.status='failed';history.events.push({at:Date.now(),stage:'missing-secrets'});
                        await tx.put('history',history);
                    }
                });
            }
            return Response.json(result);
        } catch(error) {
            await storage.transaction(async tx=>{
                const state=await tx.get('delivery');
                if(state?.token===token) {
                    const safeToRetry=state.status==='preparing'||error.definitelyRejected;
                    if(safeToRetry)await tx.delete('delivery');
                    const history=await tx.get('history')||{events:[]};
                    const stage=state.status==='sent'?'sent':safeToRetry?'failed':'uncertain';
                    history.status=stage;history.at=Date.now();
                    history.events=(history.events||[]).slice(-199);
                    history.events.push({at:Date.now(),stage});
                    await tx.put('history',history);
                }
            });
            console.error('Resumo diário: tentativa falhou; controle persistente preservado');
            return Response.json({ok:false,error:'Falha ao preparar ou enviar resumo'}, {status:502});
        }
    }
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

async function pollySynthesize(texto, accessKeyId, secretAccessKey, {signal}={}) {
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
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'X-Amz-Date': amzDate, 'Authorization': authorization },
        body
    });
}

async function handleTts(reqUrl,env,storage){
 if(reqUrl.searchParams.get('debug')==='1')return json({ok:true,vozConfigurada:POLLY_VOICE});
 const text=String(reqUrl.searchParams.get('text')||'').trim();
 if(!text||text.length>400)return json({ok:false,error:!text?'texto vazio':'texto longo demais (máx. 400 caracteres)'},400);
 if(storage)return handleSharedVoice(reqUrl,env,storage,pollySynthesize,{voice:POLLY_VOICE});
 if(!env.EARTHQUAKE_ALERTS)return json({ok:false,error:'Voz compartilhada indisponível; usando a voz do navegador.'},503);
 try{return await env.EARTHQUAKE_ALERTS.get(env.EARTHQUAKE_ALERTS.idFromName('global-shared-voice-v1')).fetch(new Request(reqUrl));}catch{return json({ok:false,error:'Voz temporariamente indisponível; usando a voz do navegador.'},503);}
}

async function handlePortugueseTranslation(request,env){
 if(request.method!=='POST')return json({error:'Use POST para traduzir o boletim.'},405);
 if(Number(request.headers.get('Content-Length'))>40000)return json({error:'Texto acima do limite de tradução.'},413);
 let body;try{const raw=await request.text();if(raw.length>24000)return json({error:'Texto acima do limite de tradução.'},413);body=JSON.parse(raw);}catch{return json({error:'Pedido de tradução inválido.'},400);}
 const texts=body?.texts;
 if(!Array.isArray(texts)||!texts.length||texts.length>6||texts.some(t=>typeof t!=='string'||!t.trim()||t.length>12000)||texts.reduce((n,t)=>n+t.length,0)>20000)return json({error:'Envie até seis textos, com no máximo 20 mil caracteres no total.'},400);
 if(!env.AI||!env.TTS_USAGE)return json({error:'Tradução temporariamente indisponível.'},503);
 const translations=[];
 for(const text of texts){
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  const key='pt-translation-v2:'+digest;
  const cached=await env.TTS_USAGE.get(key);if(cached){translations.push(cached);continue;}
  const quota='pt-translation-chars:'+new Date().toISOString().slice(0,10),used=Number(await env.TTS_USAGE.get(quota))||0;
  if(used+text.length>50000){translations.push(null);continue;}
  await env.TTS_USAGE.put(quota,String(used+text.length),{expirationTtl:172800});
  try{
   const lang=/\b(?:profundidad|magnitud|lluvias|peligro|terremoto|sequia|hacia|fuerte)\b/i.test(text)?'es':/\b(?:nord|ouest|seisme|pluie|avec|sans|alerte)\b/i.test(text)?'fr':'en';
   const protectedText=text.replace(/(?:\b[A-Za-z]\.){2,}|\b(?:Dr|Mr|Mrs|Ms|St|Mt|No)\./g,part=>part.replace(/\./g,'\uFFF0'));
   const chunks=[];
   for(const sentence of protectedText.split(/(?<=[.!?])\s+(?=[\p{Lu}\d])|\n\s*\n/u)){
    let rest=sentence.replace(/\uFFF0/g,'.').trim();while(rest.length>700){let cut=rest.lastIndexOf(' ',700);if(cut<100)cut=700;chunks.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart();}if(rest)chunks.push(rest);
   }
   const output=[];
   for(const chunk of chunks){const result=await env.AI.run('@cf/meta/m2m100-1.2b',{text:chunk,source_lang:lang,target_lang:'pt'});output.push(String(result?.translated_text||'').trim());}
   const translated=output.join(' ').trim();
   // Reject altered numeric facts. Translation never drives hazard classification.
   const nums=v=>(v.match(/\d+(?:[.,]\d+)*/g)||[]).map(n=>n.replace(/,/g,'.')).sort().join('|');
   if(!translated||nums(text)!==nums(translated)){translations.push(null);continue;}
   await env.TTS_USAGE.put(key,translated,{expirationTtl:2592000});translations.push(translated);
  }catch(e){console.warn('[tradução em português]',e.message);translations.push(null);}
 }
 return json({translations,language:'pt-BR'});
}

async function handleWorkerRequest(request,env){
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
        const reqUrl = new URL(request.url);
        if(reqUrl.pathname.startsWith('/telegram-summary-image/')){
            const match=reqUrl.pathname.match(/^\/telegram-summary-image\/(\d{4}-\d{2}-\d{2})\/([a-f0-9-]{36})$/);
            if(!match||!env.DAILY_SUMMARY)return new Response('Imagem não encontrada',{status:404});
            return env.DAILY_SUMMARY.get(env.DAILY_SUMMARY.idFromName(match[1])).fetch(request);
        }
        if(reqUrl.pathname.startsWith('/telegram-image/')){
            if(!env.EARTHQUAKE_ALERTS)return new Response('Original indisponível',{status:503});
            return env.EARTHQUAKE_ALERTS.get(env.EARTHQUAKE_ALERTS.idFromName('earthquake-alerts')).fetch(request);
        }
        if(/^\/(?:rain-weather|rainbow-snapshot|rainbow-tile)(?:\/|$)/.test(reqUrl.pathname))return handleRainbowProducts(request,env);
        if(reqUrl.pathname==='/rain-nowcast')return handleRainbowNowcast(request,env);
        if(reqUrl.pathname==='/translate-pt'){
            if(env.EARTHQUAKE_ALERTS){const id=env.EARTHQUAKE_ALERTS.idFromName('portuguese-translations-v1');return env.EARTHQUAKE_ALERTS.get(id).fetch(request);}
            return handlePortugueseTranslation(request,env);
        }
        if (reqUrl.pathname === '/tsunami-alerts') return json(await getOfficialTsunamis());
        if (reqUrl.pathname === '/rupture-shaking') return handleRuptureShaking(request);
        if (reqUrl.pathname === '/population-exposure') return handlePopulationExposure(request, env);

        const ROTAS_TELEGRAM_PROTEGIDAS = new Set([
            '/telegram-test', '/telegram-daily-summary', '/telegram-m6-check', '/telegram-card-preview',
            '/telegram-history', '/telegram-history-preview', '/telegram-history-detail'
        ]);
        if (ROTAS_TELEGRAM_PROTEGIDAS.has(reqUrl.pathname) && !tokenAdminValido(request, reqUrl, env)) {
            return json({ ok: false, error: 'Não autorizado. Passe ?token=SEU_ADMIN_TOKEN.' }, 401);
        }

        if(reqUrl.pathname.startsWith('/telegram-history')){
            if(request.method!=='GET')return json({error:'Método não permitido'},405);
            if(!env.ADMIN_TOKEN || request.headers.get('X-Admin-Token')!==env.ADMIN_TOKEN)
                return json({error:'Acesso administrativo não autorizado'},401);
            try {return await handleTelegramHistory(request,env);}
            catch {return json({ok:false,error:'Não foi possível consultar o histórico'},502);}
        }
        // Retired: stale clients receive no data and never touch KV.
        if (reqUrl.pathname === '/polls-average') return json({ok:false,retired:true,error:'Pesquisas removidas; consulte a apuração oficial do TSE.'},410);
        if(reqUrl.pathname==='/source-health'){
            if(request.method!=='GET')return json({error:'Método não permitido'},405);
            if(!env.ADMIN_TOKEN||request.headers.get('X-Admin-Token')!==env.ADMIN_TOKEN)return json({error:'Não autorizado'},401);
            if(!env.EARTHQUAKE_ALERTS)return json({error:'Coleta compartilhada não configurada'},503);
            const page=Number(reqUrl.searchParams.get('page')||0);if(!Number.isInteger(page)||page<0||page>4)return json({error:'Página inválida'},400);
            const groups=sourceGroups(ALLOWED_HOSTS),selected=groups.slice(page*20,(page+1)*20);
            const sources=await Promise.all(selected.map(async group=>{try{const r=await env.EARTHQUAKE_ALERTS.get(env.EARTHQUAKE_ALERTS.idFromName('shared-source-v1:'+group)).fetch('https://internal/__source-health');return {group,...await r.json()};}catch{return {group,state:'unavailable'};}}));
            const usage=await handleKvUsageRead(new Request(reqUrl.origin+'/kv-usage',{headers:{Authorization:'Bearer '+env.KV_METRICS_READ_TOKEN}}),env);
            return json({ok:true,version:'shared-sources-v1',sources,page,pages:Math.ceil(groups.length/20),usage:usage.ok?await usage.json():{available:false},note:'Horários da coleta compartilhada; não são horários dos eventos. Métricas KV observadas não equivalem ao total faturado.'});
        }
        if(reqUrl.pathname==='/kv-usage')return handleKvUsageRead(request,env);
        if (reqUrl.pathname === '/health') {
            return json({
                ok: true,
                service: 'Monitor Global Worker',
                version: '7.6.0',
                dailySummaryDesign: DAILY_SUMMARY_DESIGN,
                dailyBrazilRevision: "same-message-72h-v1",
                brazilEpicenterLocation: BRAZIL_EPICENTER_VERSION,
                earthquakePaint: "official-shakemap-v1",
                telegramImageQuality: "full-hd-1080x1920-original-png",
                telegramPopulationReserve: "geonames-localities-v1",
                telegramImageRefresh: "m55-first-hour-1min",
                rainbowProducts:{configured:Boolean(env.RAINBOW_API_KEY),protectedBudget:Boolean(env.EARTHQUAKE_ALERTS),weatherMonthlyLimit:4500,tilesMonthlyLimit:27000},
                rainbowNowcast: {configured:Boolean(env.RAINBOW_API_KEY),protectedBudget:Boolean(env.EARTHQUAKE_ALERTS),monthlyLimit:4500},
                time: nowIso(),
                cacheApi: true,
                kv: Boolean(env.TTS_USAGE),
                kvOptimization: 'shared-population-voice-v1',
                workerModules: 'maintenance-modules-v1',
                telegramStorage: 'durable-history-v1',
                sharedSources: {version:'shared-sources-v1',enabled:Boolean(env.EARTHQUAKE_ALERTS)},
                kvUsageMetrics: Boolean(env.KV_METRICS_READ_TOKEN),
                durableRequestBudget: "durable-request-budget-v1",
                sourceEdgeBudget: "shared-source-edge-v2",
                electionPolls: 'removed-no-kv-v1',
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
        if (reqUrl.pathname === '/cge-bulletins') return await handleCgeBulletins();
        if (reqUrl.pathname === '/official-weather-alerts') return await handleOfficialWeatherAlerts(reqUrl,fetch,env.SHARED_SOURCE_INTERNAL?null:globalThis.caches?.default);
        if (reqUrl.pathname === '/metar-observed') return await handleWeatherObservations(reqUrl);
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
            const htmlCatalogue = ['www.osc.org.bo','www.ssn.unam.mx','www.cgesp.org','www.ovsicori.una.ac.cr','www.snet.gob.sv'].includes(targetUrl.hostname) && /^<!doctype\s+html/i.test(trimmed);
            const fdsnText = /^\/fdsnws\/event\/\d+\/query\/?$/.test(targetUrl.pathname) && targetUrl.searchParams.get('format')==='text' && /^#EventID\|Time\|Latitude\|Longitude\|Depth\/km/.test(trimmed);
            const fdsnVersion = targetUrl.hostname==='geofon.gfz-potsdam.de' && /\/fdsnws\/event\/1\/version$/.test(targetUrl.pathname) && /^\d+\.\d+(?:\.\d+)?$/.test(trimmed);

            if (upstream.ok && !looksJson && !looksXml && !htmlCatalogue && !fdsnText && !fdsnVersion) {
                return json({
                    error: 'Resposta upstream não-JSON',
                    host: targetUrl.hostname,
                    status: upstream.status,
                    preview: trimmed.slice(0, 120)
                }, 502);
            }

            // Se a fonte devolveu 4xx/5xx com corpo não-JSON (ex.: ISC manda
            // "Error 400:" em texto puro), normaliza pra JSON de erro limpo.
            if (!upstream.ok && !looksJson && !looksXml && !htmlCatalogue && !fdsnText && !fdsnVersion) {
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
}

export default {
    async fetch(request,env,ctx){return withKvUsage(env,tracked=>sharedSourceResponse(request,tracked,()=>handleWorkerRequest(request,tracked),ALLOWED_HOSTS),ctx);},

    async scheduled(event, env, ctx) {
        const baseUrl = 'https://black-sky-9ba0.terrestre.workers.dev/';
        const cacheRequest = new Request(baseUrl, { method: 'GET' });
        ctx.waitUntil(withKvUsage(env,async env => {
            // Prioridade ao resumo; consultas de outros feeds não atrasam sua tentativa.
            try { await runTelegramDailySummary(cacheRequest, env); } catch (e) { console.error('Cron Telegram resumo diário: envio pendente; nova tentativa no próximo cron'); }
            try { await refreshSpClimaCache(cacheRequest, env); } catch (e) { console.error('Cron SP:', e); }
            try { await refreshGlobalFeedsCache(cacheRequest, env); } catch (e) { console.error('Cron global:', e); }
            try { await runTelegramM6Alerts(cacheRequest, env); } catch (e) { console.error('Cron Telegram M6:', e); }
            try { await refreshRecentDailyBrazilSummaries(env); } catch (e) { console.warn('Cron revisão brasileira: pendente'); }
        }));
    }
};