// Catalog normalization and BRT windows used by Telegram alert coordination.
import {fetchGlobalSupplements,consolidateGlobalEvents} from "./global-seismic-data.mjs";
import {telegramIsBrazil} from "./brazil-boundary.mjs";
import {fetchText, fetchJson} from "./http.mjs";
import {enrichBrazilEpicenter} from "../brazil-epicenter-location.mjs";



// =========================================================
// TELEGRAM — M6+ globais e todos os sismos brasileiros com CARD (magnitude + textos na imagem)
// Secrets no Cloudflare: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// =========================================================

const TELEGRAM_MIN_MAG = 6.0;
const TELEGRAM_BRAZIL_SOURCES = [
    ['USP', 'https://moho.iag.usp.br/fdsnws/event/1/query', 'text'],
    ['USGS', 'https://earthquake.usgs.gov/fdsnws/event/1/query', 'geojson'],
    ['EMSC', 'https://www.seismicportal.eu/fdsnws/event/1/query', 'json'],
    ['GEOFON', 'https://geofon.gfz.de/fdsnws/event/1/query', 'text']
];
function telegramBrazilEvents(data, provider, format) {
    const out = [];
    const entries = format === 'text' ? data.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
        const c = line.split('|');
        return {id: c[0], time: c[1], lat: c[2], lon: c[3], depth: c[4], mag: c[10], place: c[12], type: c[13]};
    }) : (data.features || []).map(f => ({id: f.id, time: f.properties?.time, lat: f.geometry?.coordinates?.[1], lon: f.geometry?.coordinates?.[0], depth: f.geometry?.coordinates?.[2], mag: f.properties?.mag, place: f.properties?.place || f.properties?.flynn_region, type: f.properties?.type || ({ke: 'earthquake', se: 'earthquake'}[f.properties?.evtype] || f.properties?.evtype), source: f.properties?.net?.toUpperCase(), reviewed: f.properties?.status === 'reviewed', url: f.properties?.url}));
    for (const e of entries) {
        if ([e.lat, e.lon, e.mag].some(v => v == null || String(v).trim() === '')) continue;
        const lat = Number(e.lat), lon = Number(e.lon), mag = Number(e.mag);
        if (![lat, lon, mag].every(Number.isFinite) || !telegramIsBrazil(lat, lon)) continue;
        if (e.type && e.type.trim().toLowerCase() !== 'earthquake') continue;
        const date = typeof e.time === 'number' ? new Date(e.time) : new Date(/(?:Z|[+-]\d\d:\d\d)$/i.test(e.time || '') ? e.time : (e.time || '') + 'Z');
        if (!e.id || !Number.isFinite(date.getTime())) continue;
        out.push({id: provider === 'USGS' ? String(e.id) : provider + '-' + e.id,
            provider, brazil: true, mag, lat, lon, depth: e.depth != null && e.depth !== '' && Number.isFinite(Number(e.depth)) ? Math.round(Math.abs(Number(e.depth))) : null,
            place: (e.place || 'Local não informado') + (/brazil|brasil/i.test(e.place || '') ? '' : ', Brasil'),
            timeIso: date.toISOString(), source: e.source || provider, reviewed: provider === 'USP' || !!e.reviewed,
            url: e.url || 'https://monitorglobal.top'});
    }
    return out;
}
async function fetchTelegramBrazilRecent(env, window = null) {
    const start = window?.start || new Date(Date.now() - 72 * 3600000).toISOString();
    const end = window?.end || new Date(Date.now() + 5 * 60000).toISOString();
    const results = await Promise.allSettled(TELEGRAM_BRAZIL_SOURCES.map(async ([provider, endpoint, format]) => {
        const url = new URL(endpoint);
        for (const [key, value] of Object.entries({format, starttime: start, endtime: end, minlatitude: -34, maxlatitude: 6, minlongitude: -74, maxlongitude: -28, orderby: 'time', limit: 1000})) url.searchParams.set(key, value);
        const events = [];
        for (let page = 0; page < 10; page++) {
            if (page) url.searchParams.set('offset', String(page * 1000 + 1));
            const response = await fetchText(url.href, {}, 15000);
            if (!response.ok) throw new Error(provider + ' HTTP ' + response.status);
            const data = format === 'text' ? response.text : response.status === 204 ? {features: []} : JSON.parse(response.text);
            if (format !== 'text' && !Array.isArray(data.features)) throw new Error(provider + ' catálogo inválido');
            const count = format === 'text' ? data.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#')).length : data.features.length;
            events.push(...telegramBrazilEvents(data, provider, format));
            if (count < 1000) break;
            if (page === 9) throw new Error(provider + ' catálogo incompleto');
        }
        // Primeira consulta de cada fonte: cria uma linha de base, sem anunciar o catálogo antigo.
        // Depois disso, IDs novos entram mesmo quando a publicação tem atraso de muitas horas.
        if(window?.summary)return {provider,events};
        const key = 'telegram-brazil-baseline:' + provider;
        if (!env.TTS_USAGE) throw new Error('Histórico persistente indisponível');
        const ready = await env.TTS_USAGE.get(key);
        return {provider, events, key, ready: !!ready};
    }));
    return {sources: results.filter(r => r.status === 'fulfilled').map(r => r.value),
        failedSources: results.flatMap((r, i) => r.status === 'rejected' ? [TELEGRAM_BRAZIL_SOURCES[i][0]] : [])};
}

async function fetchUsgsM6Recent(eventId) {
    const start = new Date(Date.now() - 6 * 3600000).toISOString(); // últimas 6h
    const url =
        'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
        `&starttime=${encodeURIComponent(start)}` +
        `&minmagnitude=${TELEGRAM_MIN_MAG}` +
        '&orderby=time&limit=30';
    const d = await fetchJson(eventId ? "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&eventid=" + encodeURIComponent(eventId) : url, {}, 15000);
    const out = [];
    for (const f of (eventId ? [d] : d.features || [])) {
        const p = f.properties || {};
        const c = f.geometry?.coordinates || [];
        if (p.mag == null || p.type && p.type !== 'earthquake') continue;
        const mag = Number(p.mag);
        const lon = Number(c[0]);
        const lat = Number(c[1]);
        const depth = Number(c[2]);
        if (![mag, lat, lon].every(Number.isFinite) || (!eventId && mag < TELEGRAM_MIN_MAG)) continue;
        const id = String(f.id || p.code || `${mag}-${lat}-${lon}-${p.time}`);
        out.push({
            id,
            provider: 'USGS',
            brazil: telegramIsBrazil(lat, lon),
            mag,
            place: p.place || 'Região não informada',
            lat,
            lon,
            depth: Number.isFinite(depth) ? Math.round(depth) : null,
            timeIso: p.time ? new Date(p.time).toISOString() : null,
            source: (p.net || 'USGS').toUpperCase(),
            reviewed: String(p.status || '').toLowerCase() === 'reviewed',
            sourceUpdatedAt: p.updated!=null&&Number.isFinite(Number(p.updated))?Number(p.updated):null,
            magnitudeType: String(p.magType||'').toLowerCase(),
            sourceAliases: String(p.ids||'').split(',').map(id=>id.trim()).filter(Boolean),
            url: p.url || 'https://monitorglobal.top'
        });
    }
    return out;
}


// =========================================================
// HANDLER PRINCIPAL
// =========================================================


function saoPauloParts(date=new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA',{
        timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',
        hour:'2-digit',minute:'2-digit',hourCycle:'h23'
    }).formatToParts(date);
    const o={}; for(const p of parts)o[p.type]=p.value; return o;
}
function saoPauloYmdOffset(days=0) {
    const p=saoPauloParts();
    const d=new Date(Date.UTC(+p.year,+p.month-1,+p.day+days));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
async function fetchDailyQuakesBrt(day=saoPauloYmdOffset(-1)) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T12:00:00Z')))throw new Error('Data do boletim inválida');
    const today=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);
    const start=`${day}T03:00:00.000Z`, end=`${today}T03:00:00.000Z`;
    const u='https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson' +
      `&starttime=${encodeURIComponent(start)}&endtime=${encodeURIComponent(end)}` +
      '&minmagnitude=0.1&orderby=magnitude&limit=1000';
    const d=await fetchJson(u,{},20000);
    const events=(d.features||[]).map(f=>{
        const p=f.properties||{}, c=f.geometry?.coordinates||[];
        return {id:f.id,provider:'USGS',reviewed:p.status==='reviewed',sourceUpdatedAt:p.updated||null,mag:Number(p.mag),place:p.place||'Região não informada',time:Number(p.time),
            lat:Number.isFinite(c[1])&&Math.abs(c[1])<=90?c[1]:null,lon:Number.isFinite(c[0])&&Math.abs(c[0])<=180?c[0]:null,
            depth:Number.isFinite(c[2])?c[2]:null,source:(p.net||'USGS').toUpperCase()};
    }).filter(e=>Number.isFinite(e.mag)&&Number.isFinite(e.time)&&e.time>=Date.parse(start)&&e.time<Date.parse(end));
    const brazilFeed=await fetchTelegramBrazilRecent(null,{start,end,summary:true});
    const startMs=Date.parse(start),endMs=Date.parse(end);
    for(const event of events){event.sources=['USGS'];event.brazil=Number.isFinite(event.lat)&&Number.isFinite(event.lon)&&telegramIsBrazil(event.lat,event.lon);}
    for(const source of brazilFeed.sources)for(const candidate of source.events){
        const time=Date.parse(candidate.timeIso);if(time<startMs||time>=endMs)continue;
        const matches=events.filter(e=>e.id===candidate.id||e.brazil&&Math.abs(e.time-time)<=30000&&Math.abs(e.mag-candidate.mag)<=1&&Math.hypot((e.lon-candidate.lon)*Math.cos(candidate.lat*Math.PI/180),e.lat-candidate.lat)*111.32<=50);
        if(matches.length===1){const existing=matches[0];existing.sources=[...new Set([...(existing.sources||[existing.source]),source.provider])];continue;}
        events.push({...candidate,time,source:source.provider,sources:[source.provider]});
    }
    const extraGlobal=await fetchGlobalSupplements({start,end,scope:'daily:'+day,summary:true}).catch(()=>({sources:[],failedSources:['EMSC','GEOFON']}));
    const global=consolidateGlobalEvents([...events.filter(e=>!e.brazil).map(e=>({...e,timeIso:new Date(e.time).toISOString()})),...extraGlobal.sources.flatMap(s=>s.ok?s.events.filter(e=>Date.parse(e.timeIso)>=startMs&&Date.parse(e.timeIso)<endMs):[])]).map(e=>({...e,time:Date.parse(e.timeIso),sources:[...new Set(e.agencyEstimates.map(r=>r.provider))]}));
    const local=events.filter(e=>e.brazil);events.splice(0,events.length,...global,...local);
    const brazilEvents=events.filter(e=>e.brazil).sort((a,b)=>b.mag-a.mag||a.time-b.time);
    for(const event of brazilEvents)await enrichBrazilEpicenter(event);
    return {day,events,brazilEvents,brazilFailedSources:brazilFeed.failedSources,globalFailedSources:extraGlobal.failedSources};
}
export { telegramBrazilEvents, TELEGRAM_MIN_MAG, saoPauloYmdOffset, fetchUsgsM6Recent, fetchTelegramBrazilRecent, fetchDailyQuakesBrt, saoPauloParts };
