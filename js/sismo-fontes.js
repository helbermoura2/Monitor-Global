// === sismo-fontes.js — Todos os fetchers de sismo: EMSC, USGS, GEOFON, FUNVISIS, JMA, BMKG, GeoNet, IGP, AFAD, USP (linhas originais 5127-6037 do core-app.js) ===

function fetchEMSCData() {
    // Antes: uma única tentativa, sem timeout — qualquer soluço passageiro de rede
    // (lento, bloqueado por extensão, 429) já marcava "EMSC OFF-LINE" no ciclo
    // inteiro, sem chance de tentar de novo, diferente das outras fontes (que usam
    // fetchWithCorsFallback, com timeout + 2 rodadas). Isso deixava o EMSC piscando
    // offline com muito mais frequência que as demais fontes sísmicas.
    //
    // BUG CORRIGIDO: a query usava limit=30 sem starttime nem minmagnitude — ou seja,
    // "os 30 sismos mais recentes do planeta inteiro", de qualquer magnitude. Em dias
    // de atividade global alta, esses 30 slots giram rápido e um M3+ de 30-40min atrás
    // (Venezuela, Grécia etc.) simplesmente já tinha saído da lista antes do próximo
    // ciclo de fetch. Agora usamos a mesma janela de 36h e minmagnitude=2.5 das outras
    // fontes FDSN, com limit alto o suficiente pra não cortar nada nesse intervalo.
    function umaTentativa(timeoutMs) {
        return new Promise(res => {
            const s = document.createElement('script');
            const cb = 'emscCb_' + Math.round(Math.random() * 1e6);
            let acabou = false;
            const limpar = () => {
                if (acabou) return;
                acabou = true;
                clearTimeout(timer);
                delete window[cb];
                if (s.parentNode) s.parentNode.removeChild(s);
            };
            const timer = setTimeout(() => { limpar(); res(null); }, timeoutMs);
            window[cb] = d => { limpar(); res(d.features || []); };
            s.onerror = () => { limpar(); res(null); };
            const start = new Date(Date.now() - 36 * 3600000).toISOString();
            const end = new Date(Date.now() + 5 * 60000).toISOString();
            // EMSC/seismicportal usa os atalhos "start"/"end"/"minmag" (não o
            // starttime/endtime/minmagnitude padrão FDSN) — confirmado na doc oficial.
            // BUG CORRIGIDO: minmag vinha fixo em 2.5 aqui também, ignorando o slider.
            // Agora acompanha minMagnitude (piso real de 0.1, conforme pedido) e o
            // limite subiu pra caber o volume maior de eventos pequenos.
            const minMagEmsc = Math.max(0.1, typeof minMagnitude === 'number' ? minMagnitude : 0.1);
            s.src = `https://www.seismicportal.eu/fdsnws/event/1/query?format=jsonp&callback=${cb}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&minmag=${minMagEmsc}&limit=1000&orderby=time`;
            document.body.appendChild(s);
        });
    }
    return (async () => {
        let r = await umaTentativa(8000);
        if (r === null) {
            await new Promise(res => setTimeout(res, 1500));
            r = await umaTentativa(8000);
        }
        // BUG CORRIGIDO: antes, falha nas 2 tentativas virava `[]` (lista vazia),
        // igual a "consultei e não achei nada". Isso fazia o painel de Fontes marcar
        // EMSC como OK mesmo quando ela não trouxe nenhum dado no ciclo. Agora uma
        // falha real lança erro, pra aparecer como OFF de verdade no diagnóstico.
        if (r === null) throw new Error('EMSC: sem resposta após 2 tentativas');
        return r;
    })();
}

/* ═══════════════ SISMOS — REDE MULTIAGÊNCIA ═══════════════
   USGS + EMSC + GEOFON/GFZ + JMA + IGP
   IRIS é mantido apenas como legado/diagnóstico: o serviço FDSN de eventos
   do IRIS foi aposentado em 01/06/2026; o ISC é a alternativa recomendada.
   ═══════════════════════════════════════════════════════════════════════ */
const SISMO_SOURCES = {
    USGS:  { rank: 50, label: 'USGS', color: '#60a5fa' },
    'USGS-RT': { rank: 48, label: 'USGS-RT', color: '#60a5fa' },
    IGP:   { rank: 60, label: 'IGP', color: '#4ade80' },
    JMA:   { rank: 60, label: 'JMA', color: '#fbbf24' },
    'OSC-BOL': { rank: 60, label: 'OSC Bolívia', color: '#f97316' },
    BMKG:  { rank: 60, label: 'BMKG', color: '#22d3ee' },
    GEONET:{ rank: 60, label: 'GeoNet NZ', color: '#a3e635' },
    USP:   { rank: 60, label: 'USP-Sismologia', color: '#facc15' },
    FUNVISIS: { rank: 60, label: 'FUNVISIS', color: '#f472b6' },
    AFAD:  { rank: 55, label: 'AFAD', color: '#fb923c' },
    EMSC:  { rank: 45, label: 'EMSC', color: '#38bdf8' },
    GEOFON:{ rank: 45, label: 'GEOFON', color: '#c084fc' },
    ISC:   { rank: 40, label: 'ISC', color: '#94a3b8' },
    IRIS:  { rank: 5,  label: 'IRIS', color: '#64748b' }
};

const SISMO_SOURCE_LABELS = Object.keys(SISMO_SOURCES);

function sismoSourceRank(src) {
    return SISMO_SOURCES[String(src || '').toUpperCase()]?.rank || 1;
}

function normalizarSismoGeoJSON(features, source, mapper) {
    const out = [];
    (features || []).forEach(f => {
        try {
            const p = f?.properties || {};
            const c = f?.geometry?.coordinates || [];
            const lon = Number(c[0]), lat = Number(c[1]);
            const depth = Number(c[2]);
            const mag = Number(mapper?.mag?.(f, p));
            const time = Number(mapper?.time?.(f, p));
            if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(mag) || !Number.isFinite(time)) return;
            if (mag < Math.max(0, minMagnitude - 0.5)) return;
            const placeRaw = mapper?.place ? mapper.place(f, p) : (p.place || p.flynn_region || '');
            const info = traduzirEIdentificar(placeRaw || '');
            // Status oficial (USGS e alguns FDSN): automatic | reviewed | deleted...
            // Aceitamos preliminares (automatic) e depois atualizamos quando virar reviewed.
            const statusRaw = String(
                (mapper?.status ? mapper.status(f, p) : null) ||
                p.status || p.evalMode || p.evaluation_mode || p.review_status || ''
            ).toLowerCase();
            const isPreliminary = /automatic|auto|prelim|preliminary|unreviewed|not.?reviewed/.test(statusRaw)
                || (statusRaw === '' && source === 'USGS-RT'); // feeds rápidos costumam ser automáticos
            const quality = isPreliminary ? 'C' : 'B';
            out.push({
                id: `${source}-${f.id || p.eventid || p.publicid || `${time}-${lat.toFixed(3)}-${lon.toFixed(3)}`}`,
                place: info.nome || placeRaw || 'Evento sísmico',
                bandeira: info.bandeira || getFlagByCoords(lat, lon),
                pais: info.pais,
                mag,
                time,
                coords: [lon, lat],
                depth: Number.isFinite(depth) ? Math.max(0, depth) : 10,
                source,
                quality,
                isPreliminary: !!isPreliminary,
                reviewStatus: statusRaw || (isPreliminary ? 'automatic' : 'unknown'),
                // Mantém identificadores/produtos nativos para enriquecimento posterior
                // (ex.: MMI/ShakeMap do USGS) sem alterar o feed principal.
                sourceEventId: String(f?.id || p.eventid || p.publicid || ''),
                sourceMmi: Number.isFinite(Number(p.mmi)) ? Number(p.mmi) : null,
                sourceFelt: Number.isFinite(Number(p.felt)) ? Number(p.felt) : null,
                detailUrl: mapper?.detailUrl ? mapper.detailUrl(f, p) : null
            });
        } catch (e) {}
    });
    return out;
}

async function fetchFdsnGeoJSON(url, source) {
    const r = await fetchWithCorsFallback(url, 18000);
    const d = await r.json();
    if (!d || !Array.isArray(d.features)) throw new Error(`${source}: GeoJSON inválido`);
    return normalizarSismoGeoJSON(d.features, source, {
        mag: (f,p) => p.mag,
        time: (f,p) => p.time ?? p.timeUTC ?? p.origin_time ? new Date(p.time ?? p.timeUTC ?? p.origin_time).getTime() : NaN,
        place: (f,p) => p.place || p.region || p.flynn_region || p.description || '',
        detailUrl: (f,p) => p.detail || null,
        status: (f,p) => p.status || p.evalMode || ''
    });
}

/* Feeds rápidos do USGS (GeoJSON Summary) — chegam antes do catálogo FDSN completo.
   Incluem soluções automáticas/preliminares. Usamos como caminho de baixa latência
   e depois o FDSN/revisão promove o mesmo evento (sem duplicar). */
async function fetchUsgsRealtimeFeeds() {
    const urls = [
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson',
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson'
    ];
    const settled = await Promise.allSettled(urls.map(u => fetchFdsnGeoJSON(u, 'USGS-RT')));
    const out = [];
    settled.forEach(r => {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) out.push(...r.value);
    });
    // Marca tudo que veio do RT como candidato a preliminar se status não veio
    out.forEach(ev => {
        if (ev && ev.reviewStatus === 'unknown') {
            ev.isPreliminary = true;
            ev.reviewStatus = 'automatic';
            if (ev.quality === 'B') ev.quality = 'C';
        }
        // Normaliza source para rank/merge: trata USGS-RT como USGS na prioridade visual
        if (ev) ev.sourceAlias = 'USGS';
    });
    return out;
}

async function fetchGeofonData() {
    const startTime = new Date(Date.now() - 36 * 3600000).toISOString();
    const endTime = new Date(Date.now() + 5 * 60000).toISOString();
    const minMagQuery = Math.max(0.1, typeof minMagnitude === 'number' ? minMagnitude : 0.1);
    const base =
        `format=geojson` +
        `&starttime=${encodeURIComponent(startTime)}` +
        `&endtime=${encodeURIComponent(endTime)}` +
        `&minmagnitude=${minMagQuery}` +
        `&limit=1000` +
        `&orderby=time`;
    return fetchFdsnGeoJSON(`https://geofon.gfz-potsdam.de/fdsnws/event/1/query?${base}`, 'GEOFON');
}

/* FUNVISIS (Venezuela) — a agência oficial não expõe FDSN/GeoJSON público estável.
   Usamos o espelho comunitário sismosve.rafnixg.dev, que agrega os boletins oficiais
   FUNVISIS (atualização ~5 min). Eventos locais M2–M3.5 da Venezuela que o USGS/EMSC
   demoram (ou não publicam) passam a entrar aqui e depois podem ser promovidos quando
   uma fonte global revisar o mesmo epicentro. */
async function fetchFunvisisData() {
    const minMag = Math.max(0.1, typeof minMagnitude === 'number' ? minMagnitude : 0.1);
    const urls = [
        'https://sismosve.rafnixg.dev/api/sismos',
        'https://sismosve.rafnixg.dev/api/sismos/recent?limit=50'
    ];
    let features = [];
    let lastErr = null;
    for (const url of urls) {
        try {
            const r = await fetchWithCorsFallback(url, 14000);
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const d = await r.json();
            if (Array.isArray(d.features)) features = d.features;
            else if (Array.isArray(d.sismos)) features = d.sismos;
            else if (Array.isArray(d)) features = d;
            if (features.length) break;
        } catch (e) {
            lastErr = e;
        }
    }
    if (!features.length && lastErr) throw lastErr || new Error('FUNVISIS: sem dados');

    const out = [];
    const cutoff = Date.now() - 36 * 3600000;
    features.forEach((f, i) => {
        try {
            const p = f.properties || f;
            const g = f.geometry || {};
            const coords = g.coordinates || [Number(p.long || p.lon || p.longitude), Number(p.lat || p.latitude)];
            const lon = Number(coords[0]);
            const lat = Number(coords[1]);
            const mag = Number(String(p.value || p.mag || p.magnitude || '').replace(',', '.'));
            const depthStr = String(p.depth || p.profundidad || '10');
            const depth = Number(depthStr.replace(/[^\d.]/g, '')) || 10;
            // Data FUNVISIS: DD-MM-YYYY + HH:MM em horário local Venezuela (UTC-4)
            const dateStr = String(p.date || p.fecha || '').trim();
            const timeStr = String(p.time || p.hora || '00:00').trim();
            let time = NaN;
            const dm = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            const tm = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
            if (dm && tm) {
                const day = parseInt(dm[1], 10);
                const mon = parseInt(dm[2], 10) - 1;
                const year = parseInt(dm[3], 10);
                const hh = parseInt(tm[1], 10);
                const mm = parseInt(tm[2], 10);
                const ss = tm[3] ? parseInt(tm[3], 10) : 0;
                // Venezuela = UTC-4 o ano todo
                time = Date.UTC(year, mon, day, hh + 4, mm, ss);
            }
            if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(mag) || !Number.isFinite(time)) return;
            if (mag < minMag) return;
            if (time < cutoff) return;
            const place = String(p.addressFormatted || p.place || p.epicentro || 'Venezuela').replace(/\s+/g, ' ').trim();
            out.push({
                id: `FUNVISIS-${time}-${lat.toFixed(3)}-${lon.toFixed(3)}`,
                place: place.includes('Venezuela') ? place : `${place}, Venezuela`,
                bandeira: '🇻🇪',
                pais: 'Venezuela',
                mag,
                time,
                coords: [lon, lat],
                depth: Math.max(0, depth),
                source: 'FUNVISIS',
                quality: 'A',
                isPreliminary: false,
                reviewStatus: 'reviewed',
                detailUrl: 'http://www.funvisis.gob.ve/'
            });
        } catch (e) {}
    });
    return out;
}

async function fetchJMAData() {
    const r = await fetchWithCorsFallback('https://www.jma.go.jp/bosai/quake/data/list.json', 15000);
    const data = await r.json();
    const out = [];
    (Array.isArray(data) ? data : []).forEach((x, i) => {
        const mag = Number(x.mag);
        const lat = Number(x.lat), lon = Number(x.lon);
        const depth = Number(String(x.depth ?? '').replace(/[^0-9.\-]/g,''));
        const time = Date.parse(x.at || x.time || x.datetime || '');
        if (!Number.isFinite(mag) || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(time)) return;
        if (mag < Math.max(0, minMagnitude - 0.5)) return;
        const place = x.en_anm || x.anm || x.region || x.name || 'Japão';
        out.push({
            id: `JMA-${x.json || x.id || `${time}-${lat.toFixed(3)}-${lon.toFixed(3)}`}`,
            place,
            bandeira: '🇯🇵', pais: 'Japão', mag, time,
            coords:[lon,lat], depth:Number.isFinite(depth)?Math.max(0,depth):10,
            source:'JMA', quality:'A',
            jmaIntensity:x.maxi || x.maxIntensity || null,
            detailUrl: 'https://www.data.jma.go.jp/multi/quake/'
        });
    });
    return out;
}

/* Observatorio San Calixto (Bolívia) não expõe API/GeoJSON pública — a rede USGS/EMSC/GEOFON
   cobre mal a sismicidade interna boliviana (muitos eventos M3–M4 locais nunca aparecem lá).
   O OSC publica uma tabela HTML com os sismos da última semana na home do site, então lemos
   essa tabela diretamente (via proxy CORS) e convertemos as linhas em eventos sísmicos. */
async function fetchOSCBoliviaData() {
    const url = 'https://www.osc.org.bo/index.php/es';
    const r = await fetchWithCorsFallback(url, 20000);
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const reData = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const reHora = /^(\d{2}):(\d{2}):(\d{2})$/;
    const out = [];
    doc.querySelectorAll('table tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td')).map(td => (td.textContent || '').trim());
        if (cells.length < 7) return;
        const [dataStr, horaStr, latStr, lonStr, profStr, magStr, regiaoStr] = cells;
        const dm = reData.exec(dataStr);
        const hm = reHora.exec(horaStr);
        if (!dm || !hm) return;
        const lat = parseFloat(latStr), lon = parseFloat(lonStr);
        const depth = parseFloat(profStr), mag = parseFloat(magStr);
        if (![lat, lon, depth, mag].every(Number.isFinite)) return;
        // Hora local da Bolívia é UTC-4 o ano todo (sem horário de verão).
        // Formato da fonte é DD/MM/AAAA — dm[1]=dia, dm[2]=mês, dm[3]=ano.
        // (bug corrigido: antes montava AAAA-DIA-MÊS em vez de AAAA-MÊS-DIA,
        // o que gerava datas no futuro para dias <= 12 e travava o evento em "Agora mesmo".)
        const time = Date.parse(`${dm[3]}-${dm[2]}-${dm[1]}T${horaStr}-04:00`);
        if (!Number.isFinite(time)) return;
        if (mag < Math.max(0, minMagnitude - 0.5)) return;
        const regiao = (regiaoStr || '').trim();
        const place = /bol[ií]via/i.test(regiao) ? regiao : (regiao ? `${regiao}, Bolívia` : 'Bolívia');
        out.push({
            id: `OSCBOL-${dataStr}-${horaStr}-${lat.toFixed(3)}-${lon.toFixed(3)}`,
            place,
            bandeira: '🇧🇴',
            pais: 'Bolívia',
            mag, time,
            coords: [lon, lat],
            depth: Math.max(0, depth),
            source: 'OSC-BOL',
            quality: 'A',
            detailUrl: 'https://www.osc.org.bo/index.php/es/27-sismicidad/51-boletin-sismico'
        });
    });
    return out;
}

/* Indonésia (BMKG) — um dos trechos mais ativos do Cinturão de Fogo (arco de Sunda/Java/
   Sumatra). Feed público sem autenticação, mas só traz os 15 sismos mais recentes de M≥5.0
   (a BMKG também tem "gempadirasakan" com sismos menores sentidos, se quiser ampliar depois). */
async function fetchBMKGData() {
    const url = 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json';
    const r = await fetchWithCorsFallback(url, 15000);
    const d = await r.json();
    const lista = d?.Infogempa?.gempa;
    const out = [];
    (Array.isArray(lista) ? lista : []).forEach(x => {
        try {
            const mag = Number(x.Magnitude);
            const depth = Number(String(x.Kedalaman || '').replace(/[^0-9.\-]/g, ''));
            const [latStr, lonStr] = String(x.Coordinates || '').split(',');
            const lat = Number(latStr), lon = Number(lonStr);
            const time = Date.parse(x.DateTime || '');
            if (![mag, lat, lon, time].every(Number.isFinite)) return;
            if (mag < Math.max(0, minMagnitude - 0.5)) return;
            const wilayah = x.Wilayah || 'Indonésia';
            out.push({
                id: `BMKG-${x.DateTime}-${lat.toFixed(3)}-${lon.toFixed(3)}`,
                place: /indon[eé]sia/i.test(wilayah) ? wilayah : `${wilayah}, Indonésia`,
                bandeira: '🇮🇩', pais: 'Indonésia',
                mag, time, coords: [lon, lat],
                depth: Number.isFinite(depth) ? Math.max(0, depth) : 10,
                source: 'BMKG', quality: 'A',
                detailUrl: 'https://www.bmkg.go.id/gempabumi/gempabumi-terkini.bmkg'
            });
        } catch (e) {}
    });
    return out;
}

/* Nova Zelândia (GeoNet) — outro trecho de altíssima atividade do Cinturão de Fogo
   (fronteira das placas Pacífica/Australiana + arco de Kermadec/Tonga). API GeoJSON pública,
   sem autenticação; MMI=-1 inclui até sismos pequenos demais pra calcular intensidade. */
async function fetchGeoNetData() {
    const url = 'https://api.geonet.org.nz/quake?MMI=-1';
    const r = await fetchWithCorsFallback(url, 15000);
    const d = await r.json();
    if (!d || !Array.isArray(d.features)) throw new Error('GeoNet: GeoJSON inválido');
    const out = [];
    d.features.forEach(f => {
        try {
            const p = f?.properties || {};
            const c = f?.geometry?.coordinates || [];
            const lon = Number(c[0]), lat = Number(c[1]);
            const depth = Number(p.depth ?? c[2]);
            const mag = Number(p.magnitude);
            const time = Date.parse(p.time || '');
            if (![lat, lon, mag, time].every(Number.isFinite)) return;
            if (mag < Math.max(0, minMagnitude - 0.5)) return;
            const localidade = p.locality || 'Nova Zelândia';
            out.push({
                id: `GEONET-${p.publicID || f.id || `${time}-${lat.toFixed(3)}-${lon.toFixed(3)}`}`,
                place: /nova zel|new zealand/i.test(localidade) ? localidade : `${localidade}, Nova Zelândia`,
                bandeira: '🇳🇿', pais: 'Nova Zelândia',
                mag, time, coords: [lon, lat],
                depth: Number.isFinite(depth) ? Math.max(0, depth) : 10,
                source: 'GEONET', quality: 'A',
                detailUrl: `https://www.geonet.org.nz/earthquake/${p.publicID || f.id || ''}`
            });
        } catch (e) {}
    });
    return out;
}

async function fetchIGPData() {
    // Antes usava "UltimoSismo" — uma camada do ArcGIS do IGP feita só pra mostrar
    // o sismo MAIS RECENTE isolado (pra um widget no site deles), não uma lista
    // contínua. Por isso sismos do Peru sumiam entre uma consulta e outra: se dois
    // eventos ocorressem no mesmo ciclo de 45s, ou se a "última" entrada mudasse
    // rápido demais, o anterior nunca era visto pelo app. O endpoint certo pra
    // monitoramento é "SismosReportados" (lista real, até 2000 registros).
    // Atenção: essa camada usa nomes de campo DIFERENTES da antiga (lat/lon/prof/ref
    // em vez de latitud/longitud/profundidad/referencia).
    const url = 'https://ide.igp.gob.pe/arcgis/rest/services/monitoreocensis/SismosReportados/MapServer/0/query' +
        '?where=1%3D1&outFields=fecha,hora,lat,lon,prof,ref,magnitud,departamento' +
        '&returnGeometry=true&outSR=4326&f=geojson&resultRecordCount=100&orderByFields=objectid%20DESC';
    const r = await fetchWithCorsFallback(url, 18000);
    const d = await r.json();
    if (!d || !Array.isArray(d.features)) throw new Error('IGP: GeoJSON inválido');
    return normalizarSismoGeoJSON(d.features, 'IGP', {
        mag: (f,p) => Number(p.magnitud),
        time: (f,p) => {
            // "fecha" é campo Date do ArcGIS (meia-noite UTC do dia do evento) e "hora"
            // é só o horário local (HH:MM:SS). Junta os dois pelos componentes NUMÉRICOS
            // de "fecha" (getUTCFullYear/Month/Date) em vez de parsear texto — evita o
            // mesmo tipo de bug de dia/mês trocado já corrigido no OSC-Bolívia.
            if (!p.fecha) return NaN;
            const dia = new Date(p.fecha);
            const hm = String(p.hora || '').match(/^(\d{1,2}):(\d{2}):(\d{2})/);
            if (!hm) return NaN;
            // Peru é UTC-5 o ano todo (sem horário de verão) — soma 5h pra converter a
            // hora local pra UTC; Date.UTC já rola o dia sozinho se passar de 24h.
            return Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate(),
                Number(hm[1]) + 5, Number(hm[2]), Number(hm[3]));
        },
        place: (f,p) => p.ref || (p.departamento ? `Peru, ${p.departamento}` : 'Peru'),
        detailUrl: () => 'https://ultimosismo.igp.gob.pe/'
    });
}

function mergeEarthquakeReports(reports) {
    const groups = [];
    const ordered = [...reports].sort((a,b) => b.time - a.time || sismoSourceRank(b.source) - sismoSourceRank(a.source));
    for (const ev of ordered) {
        let hit = -1;
        let bestScore = Infinity;
        for (let i=0;i<groups.length;i++) {
            const g = groups[i];
            const d = haversine(ev.coords[1], ev.coords[0], g.coords[1], g.coords[0]);
            const dt = Math.abs(ev.time - g.time);
            if (d > SISMO_DEDUPE_RAIO_KM || dt > SISMO_DEDUPE_TOL_MS) continue;
            const magDiff = Math.abs((ev.mag ?? 0) - (g.mag ?? 0));
            // A janela foi ampliada, mas não queremos fundir dois eventos muito diferentes
            // apenas porque ocorreram perto no tempo/espaço. Diferença extrema exige proximidade.
            if (magDiff > 1.2 && d > 25) continue;
            const score = d / SISMO_DEDUPE_RAIO_KM + dt / SISMO_DEDUPE_TOL_MS + Math.min(magDiff,1.2)/1.2*0.35;
            if (score < bestScore) { bestScore = score; hit = i; }
        }
        if (hit < 0) {
            groups.push({
                ...ev,
                reports:[ev],
                sources:[ev.source],
                magnitudes:[{source:ev.source, mag:ev.mag}],
                magnitudeMin:ev.mag, magnitudeMax:ev.mag,
                magnitudeSpread:0
            });
            continue;
        }
        const g=groups[hit];
        g.reports.push(ev);
        if(!g.sources.includes(ev.source)) g.sources.push(ev.source);
        g.magnitudes.push({source:ev.source,mag:ev.mag});
        g.magnitudeMin=Math.min(g.magnitudeMin,ev.mag);
        g.magnitudeMax=Math.max(g.magnitudeMax,ev.mag);
        g.magnitudeSpread=g.magnitudeMax-g.magnitudeMin;
        // Preferência: 1) revisado > preliminar  2) rank da fonte  3) magnitude maior
        const evReviewed = !ev.isPreliminary;
        const gReviewed = !g.isPreliminary;
        const melhorFonte =
            (evReviewed && !gReviewed) ||
            (evReviewed === gReviewed && (
                sismoSourceRank(ev.source) > sismoSourceRank(g.source) ||
                (sismoSourceRank(ev.source) === sismoSourceRank(g.source) && ev.mag > g.mag)
            ));
        if (melhorFonte) {
            const oldId = g.id;
            const keepPrelim = g.isPreliminary && !ev.isPreliminary; // transição prelim→revisado
            Object.assign(g, ev, { id: oldId });
            if (keepPrelim) g.wasPreliminary = true;
        }
        // Se qualquer report ainda for preliminar e nenhum revisado chegou, mantém flag
        if (ev.isPreliminary && g.isPreliminary !== false) {
            // só marca preliminar se ainda não temos revisão
        }
        if (!ev.isPreliminary) g.isPreliminary = false;
        g.time=Math.min(g.time,ev.time);
        // Mantém a posição mais recente/precisa do relatório de maior prioridade.
        g.divergentMagnitude = g.magnitudeSpread >= SISMO_MAG_DIVERGENCIA_TOL;
        g.strongMagnitudeDivergence = g.magnitudeSpread >= SISMO_MAG_DIVERGENCIA_FORTE;
    }
    groups.forEach(g=>{
        // Normaliza nomes de fonte (USGS-RT conta como USGS na UI)
        const srcNorm = (s) => (s === 'USGS-RT' ? 'USGS' : s);
        g.sources = [...new Set(g.sources.map(srcNorm))].sort((a,b)=>sismoSourceRank(b)-sismoSourceRank(a));
        g.magnitudeSpread = +(g.magnitudeMax-g.magnitudeMin).toFixed(1);
        g.divergentMagnitude = g.magnitudeSpread >= SISMO_MAG_DIVERGENCIA_TOL;
        g.strongMagnitudeDivergence = g.magnitudeSpread >= SISMO_MAG_DIVERGENCIA_FORTE;
        g.sourceCount = g.sources.length;
        g.sourceSummary = g.sources.join(' · ');
        // Qualidade final: regional = A; 2+ fontes = A; revisado global = B; preliminar = C
        if (g.source === 'IGP' || g.source === 'JMA' || g.source === 'OSC-BOL' || g.source === 'BMKG' || g.source === 'GEONET' || g.source === 'USP' || g.source === 'AFAD' || g.source === 'FUNVISIS') {
            g.quality = 'A';
            g.isPreliminary = false;
        } else if (g.sourceCount >= 2) {
            g.quality = 'A';
            g.isPreliminary = false;
        } else if (g.isPreliminary) {
            g.quality = 'C';
        } else if (!g.quality) {
            g.quality = 'B';
        }
    });
    return groups.sort((a,b)=>b.time-a.time);
}


/* ═══════════════ AFAD (Turquia) — sismos locais incl. baixos ═══════════════ */
async function fetchAfadQuakes() {
    const minMag = (typeof minMagnitude === 'number' ? minMagnitude : 0);
    let list = [];
    // 1) API comunitária estável (HTTPS + CORS)
    // BUG PROVÁVEL CORRIGIDO: essa fonte usava fetch() cru, sem o
    // fetchWithCorsFallback (proxy Cloudflare) que todas as outras fontes usam.
    // Se o CORS dela falhar por qualquer instabilidade momentânea (comum em APIs
    // comunitárias pequenas), a fonte inteira morria silenciosamente naquele
    // ciclo, sem nenhuma tentativa de contorno — diferente de USGS/EMSC/etc.
    try {
        const r = await fetchWithCorsFallback('https://api.orhanaydogdu.com.tr/deprem/afad/live?limit=100', 12000);
        if (r.ok) {
            const d = await r.json();
            const arr = d.result || d.data || [];
            arr.forEach(el => {
                const mag = Number(el.mag ?? el.magnitude ?? el.size?.ml ?? el.size?.mw ?? 0);
                const lat = Number(el.lat ?? el.latitude);
                const lng = Number(el.lng ?? el.longitude ?? el.lon);
                const depth = Number(el.depth ?? el.depth_km ?? 10);
                const t = el.date_time || el.date || el.occurred_at;
                const time = t ? new Date(String(t).replace(' ', 'T') + (String(t).includes('Z') || String(t).includes('+') ? '' : '+03:00')).getTime() : Date.now();
                const place = el.title || el.location || el.region || el.city || 'Turquia';
                if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(mag)) return;
                if (mag < minMag) return;
                list.push({
                    id: 'afad-' + (el.earthquake_id || el.id || (time + '-' + lat + '-' + lng)),
                    type: 'earthquake',
                    place: String(place),
                    mag,
                    time: Number.isFinite(time) ? time : Date.now(),
                    coords: [lng, lat],
                    depth: Number.isFinite(depth) ? depth : 10,
                    source: 'AFAD',
                    quality: mag < 3 ? 'C' : 'B',
                    bandeira: '🇹🇷',
                    pais: 'Turquia'
                });
            });
        }
    } catch (e) {
        console.warn('AFAD mirror:', e && e.message);
    }
    // 2) Fallback vercel
    if (!list.length) {
        try {
            const r = await fetchWithCorsFallback('https://deprem-api.vercel.app/?type=afad&size=1.5', 12000);
            if (r.ok) {
                const d = await r.json();
                const arr = d.earthquakes || d.result || [];
                arr.forEach(el => {
                    const mag = Number(el.size?.mw || el.size?.ml || el.mag || el.magnitude || 0);
                    const lat = Number(el.latitude ?? el.lat);
                    const lng = Number(el.longitude ?? el.lng);
                    const depth = Number(el.depth ?? 10);
                    const time = el.timestamp ? (el.timestamp < 1e12 ? el.timestamp * 1000 : el.timestamp) : Date.parse(el.date);
                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                    if (mag < minMag) return;
                    list.push({
                        id: 'afad-' + (el.id || time + '-' + lat),
                        type: 'earthquake',
                        place: el.location || el.place || 'Turquia',
                        mag,
                        time: Number.isFinite(time) ? time : Date.now(),
                        coords: [lng, lat],
                        depth,
                        source: 'AFAD',
                        quality: mag < 3 ? 'C' : 'B',
                        bandeira: '🇹🇷',
                        pais: 'Turquia'
                    });
                });
            }
        } catch (e) {
            console.warn('AFAD vercel:', e && e.message);
        }
    }

    if (!list.length) {
        try { if (typeof setSource === 'function') setSource('AFAD', 'off', 0, 'sem dados'); } catch (e) {}
        return;
    }

    // Mescla em globalEvents (dedupe por tempo+coords)
    const cut = Date.now() - 36 * 3600000;
    list = list.filter(e => e.time >= cut);
    let novos = 0;
    list.forEach(ev => {
        const canonical = `EQ-${Math.round(ev.time / 1000)}-${ev.coords[1].toFixed(3)}-${ev.coords[0].toFixed(3)}`;
        const exists = globalEvents.some(g => {
            if (!g.coords) return false;
            return Math.abs(g.time - ev.time) < 120000 &&
                Math.abs(g.coords[1] - ev.coords[1]) < 0.15 &&
                Math.abs(g.coords[0] - ev.coords[0]) < 0.15;
        });
        if (exists) {
            // marca fonte AFAD se já existe de outra rede
            const hit = globalEvents.find(g =>
                Math.abs(g.time - ev.time) < 120000 &&
                Math.abs(g.coords[1] - ev.coords[1]) < 0.15 &&
                Math.abs(g.coords[0] - ev.coords[0]) < 0.15
            );
            if (hit && hit.source !== 'AFAD') hit.quality = hit.quality === 'A' ? 'A' : 'B';
            return;
        }
        const isNew = !knownEventIds.has(canonical) && !isFirstLoad;
        knownEventIds.add(canonical);
        ev.id = canonical;
        globalEvents.push(ev);
        if (isNew) {
            novos++;
            try {
                if (ev.mag >= Math.max(SOM_SISMO_MIN, minMagnitude) && typeof playEarthquakeSound === 'function') {
                    // só toca se passar do limiar de som (não enche de M1.8)
                }
            } catch (e) {}
        }
    });
    globalEvents.sort((a, b) => b.time - a.time);
    try { if (typeof setSource === 'function') setSource('AFAD', 'ok', 0); } catch (e) {}
    try { if (typeof applyFilters === 'function') applyFilters(); } catch (e) {}
    try { if (typeof updateKPIs === 'function') updateKPIs(); } catch (e) {}
    if (novos > 0) {
        console.log('[AFAD] novos sismos:', novos);
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   REFORÇO PLANETÁRIO — cobertura de todo o globo, sem pontos cegos
   ═══════════════════════════════════════════════════════════════════════════
   O USGS e o EMSC aplicam um teto de 1000 eventos nas consultas GLOBAIS
   (fetchGlobalFeeds/fetchEMSCData), compartilhado pelo planeta inteiro. Em
   dias de atividade sísmica alta numa região, sismos de outra região podem
   ficar de fora desse teto antes de chegar aqui — foi assim que sumiram um
   M3.3 da Venezuela e dois sismos M4.6/M5.0 perto do Japão (Volcano
   Islands/Bonin Islands) que apareceram num app concorrente e não no nosso.

   Em vez de ficar caçando região por região toda vez que um sismo escapar,
   a cobertura agora é o planeta inteiro: 5 fatias de longitude que, juntas,
   fecham o círculo completo (-180° a 180°), cada uma com sua PRÓPRIA cota de
   1000 eventos — não competem entre si nem com o resto do mundo. Latitude
   vai de -85° a 80° em todas (cobre da Terra do Fogo/Drake Passage ao
   Ártico canadense/Svalbard; só os extremos polares ficam de fora, onde a
   sismicidade registrada é irrelevante). Nenhuma fatia cruza o antimeridiano
   (180°/-180°) sozinha, porque a maioria das APIs FDSN não "dá a volta" bem
   com minlongitude > maxlongitude.

     PACIFICO-NORTE-ALASCA   -180° a -122°  (Aleutas, Alasca, Kamchatka leste,
                                              lado leste de Tonga/Kermadec)
     AMERICAS                -122° a  -28°  (todo o Círculo de Fogo americano:
                                              México, América Central, Caribe,
                                              Andes, Cone Sul)
     ATLANTICO-EUROPA-AFRICA  -28° a   55°  (Açores/Islândia, Europa, todo o
                                              Mediterrâneo, toda a África,
                                              Madagascar)
     ORIENTE-MEDIO-ASIA-CENTRAL 55° a   95°  (Turquia/Cáucaso, Irã, Afeganistão,
                                              Paquistão, Himalaia, Índia, Ásia
                                              Central — cinturão Alpide, a
                                              segunda faixa sísmica mais ativa
                                              do planeta depois do Círculo de
                                              Fogo)
     ASIA-ORIENTAL-OCEANIA    90° a  180°  (Japão, Filipinas, Indonésia,
                                              Papua-Nova Guiné, Vanuatu, Fiji,
                                              Tonga, Nova Zelândia)

   Sobreposições pequenas nas bordas (ex.: 90°-95°) são de propósito — não
   custam nada, porque a deduplicação (mesma janela de 2min/0,15° usada no
   resto do app) já cuida de não duplicar o mesmo evento visto por duas
   fatias. Pra ampliar cobertura no futuro (ex.: separar África do
   Mediterrâneo, ou dar tratamento dedicado a alguma sub-região muito ativa),
   basta adicionar uma entrada nova em PLANET_REINFORCEMENT_TILES — os dois
   fetchers abaixo (USGS e EMSC) já iteram a lista automaticamente. */
const PLANET_REINFORCEMENT_TILES = [
    { name: 'PACIFICO-NORTE-ALASCA',      minlatitude: -85, maxlatitude: 80, minlongitude: -180, maxlongitude: -122 },
    { name: 'AMERICAS',                   minlatitude: -85, maxlatitude: 80, minlongitude: -122, maxlongitude: -28  },
    { name: 'ATLANTICO-EUROPA-AFRICA',    minlatitude: -85, maxlatitude: 80, minlongitude: -28,  maxlongitude: 55   },
    { name: 'ORIENTE-MEDIO-ASIA-CENTRAL', minlatitude: -85, maxlatitude: 80, minlongitude: 55,   maxlongitude: 95   },
    { name: 'ASIA-ORIENTAL-OCEANIA',      minlatitude: -85, maxlatitude: 80, minlongitude: 90,   maxlongitude: 180  }
];

function planetReinforcementDedupEAdiciona(lista, origemLabel) {
    let novos = 0;
    (lista || []).forEach(ev => {
        if (!ev || !ev.coords) return;
        const exists = globalEvents.some(g => g.coords &&
            Math.abs(g.time - ev.time) < 120000 &&
            Math.abs(g.coords[1] - ev.coords[1]) < 0.15 &&
            Math.abs(g.coords[0] - ev.coords[0]) < 0.15);
        if (exists) return;
        const canonical = `EQ-${Math.round(ev.time / 1000)}-${ev.coords[1].toFixed(3)}-${ev.coords[0].toFixed(3)}`;
        const isNew = !knownEventIds.has(canonical) && !isFirstLoad;
        knownEventIds.add(canonical);
        ev.id = canonical;
        globalEvents.push(ev);
        if (isNew) novos++;
    });
    if (novos > 0) {
        globalEvents.sort((a, b) => b.time - a.time);
        console.log(`[REFORCO-${origemLabel}] sismos que estavam fora do teto global:`, novos);
    }
    return novos;
}

/* Reforço via USGS — uma consulta FDSN por fatia, todas em paralelo. Uma fatia falhando
   (timeout pontual) não derruba as outras: cada erro vira lista vazia e é só logado. */
async function fetchPlanetReinforcementQuakes() {
    window.__lastPlanetAttempt = Date.now();
    try {
        const minMagQuery = Math.max(0.1, typeof minMagnitude === 'number' ? minMagnitude : 0.1);
        const startTime = new Date(Date.now() - 36 * 3600000).toISOString();
        const endTime = new Date(Date.now() + 5 * 60000).toISOString();

        const listas = await Promise.all(PLANET_REINFORCEMENT_TILES.map(box => {
            const base =
                `format=geojson` +
                `&starttime=${encodeURIComponent(startTime)}` +
                `&endtime=${encodeURIComponent(endTime)}` +
                `&minmagnitude=${minMagQuery}` +
                `&minlatitude=${box.minlatitude}&maxlatitude=${box.maxlatitude}` +
                `&minlongitude=${box.minlongitude}&maxlongitude=${box.maxlongitude}` +
                `&limit=1000&orderby=time`;
            return fetchFdsnGeoJSON(`https://earthquake.usgs.gov/fdsnws/event/1/query?${base}`, 'USGS')
                .catch(e => { console.warn(`REFORCO-USGS[${box.name}]:`, e && e.message); return []; });
        }));

        const list = listas.flat();
        const novos = planetReinforcementDedupEAdiciona(list, 'USGS');
        try { if (typeof setSource === 'function') setSource('USGS-REFORCO-GLOBAL', 'ok', novos); } catch (_) {}
        window.__lastPlanetSuccess = Date.now();
        window.__lastPlanetError = null;
        try { if (typeof applyFilters === 'function') applyFilters(); } catch (_) {}
        try { if (typeof updateKPIs === 'function') updateKPIs(); } catch (_) {}
    } catch (e) {
        window.__lastPlanetError = e && e.message;
        console.warn('Reforço planetário (USGS):', e && e.message);
        try { if (typeof setSource === 'function') setSource('USGS-REFORCO-GLOBAL', 'off', 0, e && e.message); } catch (_) {}
    }
}

/* Mesmo reforço, via EMSC/seismicportal — cobertura melhor pra sismos menores fora da
   América, já que o feed global do EMSC também compete pelo mesmo teto de 1000 vagas com
   o tráfego pesado de Europa/Mediterrâneo. JSONP (seismicportal.eu não manda header CORS
   pra fetch direto), uma chamada por fatia. Só marca a fonte como OFF se TODAS as fatias
   falharem — uma fatia com timeout pontual não pode apagar a cobertura das outras quatro. */
async function fetchEmscPlanetReinforcementQuakes() {
    function umaTentativa(box, timeoutMs) {
        return new Promise(res => {
            const s = document.createElement('script');
            const cb = 'emscPlanetCb_' + Math.round(Math.random() * 1e6);
            let acabou = false;
            const limpar = () => {
                if (acabou) return;
                acabou = true;
                clearTimeout(timer);
                delete window[cb];
                if (s.parentNode) s.parentNode.removeChild(s);
            };
            const timer = setTimeout(() => { limpar(); res(null); }, timeoutMs);
            window[cb] = d => { limpar(); res(d.features || []); };
            s.onerror = () => { limpar(); res(null); };
            const start = new Date(Date.now() - 36 * 3600000).toISOString();
            const end = new Date(Date.now() + 5 * 60000).toISOString();
            const minMagEmsc = Math.max(0.1, typeof minMagnitude === 'number' ? minMagnitude : 0.1);
            s.src = `https://www.seismicportal.eu/fdsnws/event/1/query?format=jsonp&callback=${cb}` +
                `&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}` +
                `&minmag=${minMagEmsc}&minlatitude=${box.minlatitude}&maxlatitude=${box.maxlatitude}` +
                `&minlongitude=${box.minlongitude}&maxlongitude=${box.maxlongitude}` +
                `&limit=1000&orderby=time`;
            document.body.appendChild(s);
        });
    }
    async function buscarCaixa(box) {
        let r = await umaTentativa(box, 8000);
        if (r === null) {
            await new Promise(res => setTimeout(res, 1500));
            r = await umaTentativa(box, 8000);
        }
        if (r === null) throw new Error(`EMSC-REFORCO[${box.name}]: sem resposta após 2 tentativas`);
        return r;
    }

    window.__lastPlanetEmscAttempt = Date.now();
    try {
        const settled = await Promise.allSettled(PLANET_REINFORCEMENT_TILES.map(buscarCaixa));
        const falhas = [];
        const features = [];
        settled.forEach((res, i) => {
            if (res.status === 'fulfilled') features.push(...(res.value || []));
            else falhas.push(`${PLANET_REINFORCEMENT_TILES[i].name}: ${res.reason && res.reason.message}`);
        });
        if (falhas.length === PLANET_REINFORCEMENT_TILES.length) {
            throw new Error(falhas.join(' | '));
        }
        const reports = normalizarSismoGeoJSON(features, 'EMSC', {
            mag: (f, p) => p.mag,
            time: (f, p) => Date.parse(p.time || p.origin_time || ''),
            place: (f, p) => p.flynn_region || p.place || '',
            detailUrl: () => null
        });
        const novos = planetReinforcementDedupEAdiciona(reports, 'EMSC');
        try { if (typeof setSource === 'function') setSource('EMSC-REFORCO-GLOBAL', 'ok', novos); } catch (_) {}
        window.__lastPlanetEmscSuccess = Date.now();
        window.__lastPlanetEmscError = null;
        try { if (typeof applyFilters === 'function') applyFilters(); } catch (_) {}
        try { if (typeof updateKPIs === 'function') updateKPIs(); } catch (_) {}
        if (falhas.length) console.warn('[REFORCO-EMSC] uma ou mais fatias falharam (as outras cobriram):', falhas.join(' | '));
    } catch (e) {
        window.__lastPlanetEmscError = e && e.message;
        console.warn('Reforço planetário (EMSC):', e && e.message);
        try { if (typeof setSource === 'function') setSource('EMSC-REFORCO-GLOBAL', 'off', 0, e && e.message); } catch (_) {}
    }
}


// Converte "2026-08-31T11:53:24.710391" (6 dígitos de fração, fora do padrão
// ISO de milissegundos) pra algo que Date.parse aceita sem risco de NaN.
function parseUspTime(s) {
  const m = String(s || '').trim().match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d+))?/);
  if (!m) return NaN;
  const ms = (m[2] || '000').slice(0, 3).padEnd(3, '0');
  return Date.parse(`${m[1]}.${ms}Z`);
}

/* Centro de Sismologia da USP (moho.iag.usp.br) — parte da Rede Sismográfica
   Brasileira (RSBR). Confirmado manualmente que o endpoint FDSN abaixo
   responde com o formato texto padrão (pipe-delimitado):
   #EventID|Time|Latitude|Longitude|Depth/km|Author|Catalog|Contributor|
   ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType
   Filtramos só pela caixa geográfica do Brasil — sem piso de magnitude
   artificial no código (mesmo padrão do AFAD/Turquia): pega tudo que a rede
   sismográfica brasileira conseguir detectar/catalogar, por menor que seja.
   Na prática o Brasil ainda vai mostrar menos eventos pequenos que a Turquia
   mostra pra AFAD — não por limitação do código, mas porque a RSBR tem bem
   menos estações (~82 no país todo) que a rede turca, então o "piso real de
   detecção" já é mais alto na maior parte do território. */
async function fetchUspSismos() {
  // 72h: sismos BR pequenos são raros e a USP publica com atraso de análise;
  // com 36h eles saíam da busca antes de o usuário conseguir ver na lista.
  const startTime = new Date(Date.now() - 72 * 3600000).toISOString();
  const endTime = new Date(Date.now() + 5 * 60000).toISOString();
  const url = `https://moho.iag.usp.br/fdsnws/event/1/query?format=text` +
    `&starttime=${encodeURIComponent(startTime)}` +
    `&endtime=${encodeURIComponent(endTime)}` +
    `&minlatitude=-34&maxlatitude=6&minlongitude=-74&maxlongitude=-28` +
    `&limit=200&orderby=time`;
  const r = await fetchWithCorsFallback(url, 18000);
  const txt = await r.text();
  const linhas = txt.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  // Zero linhas pode simplesmente significar "sem sismos no Brasil nas
  // últimas 36h", o que é plausível e real — não é uma falha da fonte.
  const out = [];
  linhas.forEach(linha => {
    try {
      const c = linha.split('|');
      if (c.length < 14) return;
      const eventId = c[0], timeStr = c[1], latStr = c[2], lonStr = c[3], depthStr = c[4];
      const magStr = c[10], placeRaw = c[12], eventType = c[13];
      if (eventType && eventType.trim().toLowerCase() !== 'earthquake') return;
      const lat = Number(latStr), lon = Number(lonStr);
      const depth = Number(depthStr);
      const mag = Number(magStr);
      const time = parseUspTime(timeStr);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(mag) || !Number.isFinite(time)) return;
      if (mag < (typeof minMagnitude === 'number' ? minMagnitude : 0)) return;
      const info = traduzirEIdentificar(placeRaw || '');
      out.push({
        id: `USP-${eventId.trim()}`,
        place: info.nome || placeRaw || 'Evento sísmico',
        bandeira: info.bandeira || getFlagByCoords(lat, lon) || '🇧🇷',
        pais: info.pais || 'Brasil',
        mag, time,
        coords: [lon, lat],
        depth: Number.isFinite(depth) ? Math.max(0, depth) : 10,
        source: 'USP',
        // Eventos bem pequenos têm mais incerteza de localização/magnitude
        // numa rede esparsa — mesmo critério já usado pro AFAD.
        quality: mag < 2.5 ? 'C' : 'A',
        detailUrl: `https://moho.iag.usp.br/eq/event/${eventId.trim()}`
      });
    } catch (e) {}
  });
  return out;
}

