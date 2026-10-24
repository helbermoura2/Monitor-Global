// Public seismic adapters: upstream payloads to the existing client contracts.
import {fetchJson, json, nowIso, fetchText} from "./http.mjs";
import {clampFdsnValue} from "./fdsn-policy.mjs";
import {xmlItems, xmlTag} from "./xml.mjs";



// =========================================================
// SISMOS — rotas dedicadas AFAD / INGV / JMA (com clamp FDSN)
// =========================================================

function afadOfficialUrl(limit=100){
    // AFAD's filter and unzoned event dates use Turkey time (UTC+03:00).
    const localNow=Date.now()+3*3600000;
    const date=ms=>new Date(ms).toISOString().slice(0,19);
    const q=new URLSearchParams({start:date(localNow-36*3600000),end:date(localNow),limit:String(limit),orderby:'timedesc'});
    return 'https://deprem.afad.gov.tr/apiv2/event/filter?'+q;
}
async function handleAfadEarthquakes(reqUrl) {
    const requested=Number(reqUrl.searchParams.get('limit')||100);
    const limit=Number.isFinite(requested)?Math.min(200,Math.max(1,Math.floor(requested))):100;
    try {
        let d,official=true;
        try{d=await fetchJson(afadOfficialUrl(limit),{redirect:'follow',headers:{Accept:'application/json'}},12000);if(!Array.isArray(d))throw Error('Catálogo oficial AFAD inválido');}
        catch{official=false;d=await fetchJson('https://api.orhanaydogdu.com.tr/deprem/afad/live',{},12000);}
        const raw=Array.isArray(d)?d:(d?.data||d?.result||[]);
        const arr=Array.isArray(raw)?raw:[];
        const out=arr.slice(0,limit).map((x,i)=>({
            id:String(x?.eventID||x?.eventId||x?.id||`AFAD-${i}-${x?.date_time||x?.datetime||''}`),
            place:x?.location||x?.title||x?.region||'Turquia', mag:Number(x?.magnitude||x?.mag||x?.ML||x?.m),
            lat:Number(x?.latitude??x?.lat),lon:Number(x?.longitude??x?.lon),depth:Number(x?.depth??x?.depth_km??x?.depthKm),
            time:official&&typeof x?.date==='string'&&!/(?:Z|[+-]\d\d:\d\d)$/.test(x.date)?x.date+'+03:00':x?.date_time||x?.datetime||x?.date||x?.time||null
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
        ['AFAD', afadOfficialUrl(1)],
        ['INGV', 'https://webservices.ingv.it/fdsnws/event/1/query?format=geojson&limit=1&orderby=time'],
        ['JMA', 'https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml'],
        ['GEOFON', 'https://geofon.gfz-potsdam.de/fdsnws/event/1/query?format=text&limit=1&orderby=time'],
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
export { handleAfadEarthquakes, handleIngvEarthquakes, handleJmaEarthquakes, handleFunvisisEarthquakes, handleSeismicStatus };
