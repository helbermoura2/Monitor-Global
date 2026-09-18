// === feed-utils.js — Filtros, dedupe e construção do feed unificado de eventos (linhas originais 2937-3316 do core-app.js) ===

// Bbox aproximado do território brasileiro. NÃO é preciso o suficiente sozinho
// perto das fronteiras (Peru/Bolívia/Colômbia entram na faixa oeste). Quem precisa
// de "é Brasil de verdade?" deve combinar com bandeira/país/texto (ver isEventoBrasil
// no story-share e passesInGeoFilter abaixo).
function coordsInBrazil(lat, lng) {
    return lat >= -33.8 && lat <= 5.3 && lng >= -74.0 && lng <= -34.7;
}

// ═══ Modo diagnóstico (?debug=1 na URL) ═══
// Liga logs no console explicando POR QUE um evento foi aceito/rejeitado
// pelos filtros geográficos, e quando um aviso INMET foi reancorado por
// cair fora do bbox esperado da UF. Serve pra investigar casos tipo
// "isso é Brasil ou Bolívia?" sem precisar abrir o código de novo.
const APP_DEBUG = /[?&]debug=1\b/.test(location.search);
function dbgLog() { if (APP_DEBUG) console.log('%c[monitor-debug]', 'color:#22d3ee;font-weight:700', ...arguments); }

// ═══ Vigia de "tela travada" ═══
// Sintoma relatado: depois que os incêndios atualizam (ciclo de 6h), o resto da
// tela para de atualizar — mas o relógio e o contador de sismos continuam vivos,
// ou seja, o JS não trava; algo especificamente na função que redesenha a lista
// (applyFilters/renderSidebarList) começa a lançar erro sempre que roda, e como
// toda chamada dela no arquivo é envolta em `try{...}catch(e){}` silencioso, o
// erro nunca aparecia em lugar nenhum — só o efeito (lista congelada).
// Essas duas peças resolvem isso: 1) qualquer erro que hoje seria engolido em
// silêncio agora vai pro console (sempre, não só com ?debug=1 — é barato e não
// atrapalha ninguém). 2) um vigia detecta "faz tempo que a lista não redesenha
// com sucesso" e força uma tentativa de recuperação sozinho.
window.addEventListener('error', function (e) {
    console.error('[monitor] erro não tratado:', e.message, `@ ${e.filename}:${e.lineno}`);
});
window.addEventListener('unhandledrejection', function (e) {
    console.error('[monitor] promise rejeitada sem catch:', e.reason);
});
window.__ultimoRenderOk = Date.now();
setInterval(function () {
    const paradoHaMs = Date.now() - window.__ultimoRenderOk;
    if (paradoHaMs > 12 * 60 * 1000) {
        console.warn(`[monitor] a lista de eventos não redesenha com sucesso há ${Math.round(paradoHaMs / 60000)} min — tentando recuperar…`);
        try { if (typeof applyFilters === 'function') applyFilters(); } catch (e) { console.error('[monitor] recuperação também falhou:', e); }
    }
}, 5 * 60 * 1000);

function eventDistanceKm(item) {
    if (!item || !item.coords) return null;
    const ref = minhaPosicao || (typeof weatherLoc !== 'undefined' ? weatherLoc : null);
    if (!ref || ref.lat == null || ref.lng == null) return null;
    return haversine(ref.lat, ref.lng, item.coords[1], item.coords[0]);
}

function eventSeverityScore(item) {
    if (!item) return 0;
    const type = item.type;
    let pts = 0;
    if (type === 'tsunami') pts = 100;
    else if (type === 'tornado') pts = 90;
    else if (type === 'hurricane') pts = 75 + Math.min(20, (item.windKmh || 0) / 20);
    else if (type === 'flood') pts = 70;
    else if (type === 'civil') pts = 40 + Math.min(40, (Number(item.sev) || 1) * 12);
    else if (type === 'storm') pts = 45;
    else if (type === 'wind') pts = 35 + Math.min(25, (item.windKmh || 0) / 8);
    else if (type === 'fire') pts = 30;
    else if (type === 'earthquake') pts = Math.max(5, (item.mag || 0) * 12);
    const d = eventDistanceKm(item);
    if (d != null) {
        if (d < 80) pts *= 1.8;
        else if (d < 250) pts *= 1.35;
        else if (d < 600) pts *= 1.1;
        else pts *= 0.55;
    }
    // Eventos muito recentes ganham um pouco
    const ageH = (Date.now() - (item.time || 0)) / 36e5;
    if (ageH < 1) pts *= 1.15;
    else if (ageH < 3) pts *= 1.05;
    return pts;
}

function passesGeoFilter(item) {
    if (geoFilter === 'all' || !geoFilter) return true;
    if (!item.coords) {
        if (geoFilter === 'br' || geoFilter === 'me') {
            const txt = ((item.place || '') + ' ' + (item.pais || '')).toLowerCase();
            return /brasil|brazil|são paulo|sao paulo|rio de janeiro|\bbr\b/.test(txt) || item.bandeira === '🇧🇷';
        }
        return false;
    }
    const [lng, lat] = item.coords;
    if (geoFilter === 'br') {
        const ok = coordsInBrazil(lat, lng);
        if (!ok) dbgLog('filtro BR rejeitou:', item.type, item.place, `[${lat.toFixed(2)}, ${lng.toFixed(2)}]`);
        return ok;
    }
    if (geoFilter === 'me') {
        // Me afeta: Brasil OU raio 500 km OU aviso INMET que te atinge
        if (item.meAtinge) return true;
        if (coordsInBrazil(lat, lng)) return true;
        const d = eventDistanceKm(item);
        return d != null && d <= 500;
    }
    const km = parseFloat(geoFilter);
    if (!Number.isFinite(km)) return true;
    const d = eventDistanceKm(item);
    return d != null && d <= km;
}

function alertVisivelNaLista(a) {
    if (!a) return false;
    const now = Date.now();
    const cut = now - 864e5;

    // Incêndio e ciclone "abertos" na fonte: a data da geometria pode ser antiga
    // (às vezes dias). Mantemos enquanto a fonte continuar devolvendo o evento.
    if (a.type === 'fire' || a.type === 'hurricane' || a.type === 'volcano') return true;

    // Nowcast / Defesa Civil locais: só permanecem enquanto estiverem ativos.
    if (a.type === 'civil' && (String(a.id || '').startsWith('nc-') || String(a.id || '').startsWith('dc-') || String(a.id || '').startsWith('sp-'))) {
        if (Number.isFinite(a.fimTs) && a.fimTs < now) return false;
        return (a.time || 0) <= now;
    }

    // Alertas INMET: o endpoint /avisos/ativos também devolve avisos FUTUROS.
    // Eles continuam em globalAlerts para poderem ser usados por outras funções,
    // mas não podem aparecer em "Últimas 24h" antes de começarem.
    // Se o aviso já começou, mostramos enquanto estiver ativo; se não houver fim,
    // aplicamos a janela normal de 24h.
    if (String(a.id || '').startsWith('inmet-')) {
        if (Number.isFinite(a.fimTs) && a.fimTs < now) return false;
        if (Number.isFinite(a.inicioTs) && a.inicioTs > now) {
            // Aviso ainda não começou: só aparece com o filtro BR (ou "Me afeta",
            // que inclui o Brasil) ativo — não polui a lista "Tudo" com avisos
            // futuros por padrão, mas dá acesso a eles onde faz sentido pedir.
            return geoFilter === 'br' || geoFilter === 'me';
        }
        if (Number.isFinite(a.inicioTs)) return true;
    }

    return (a.time || 0) >= cut && (a.time || 0) <= now;
}
function looksLikeCyclone(item) {
    if (!item) return false;
    if (item.type === 'hurricane') return true;
    const t = String(item.place || item.detail || item.title || '');
    return /\b(hurricane|typhoon|cyclone|ciclone|tufão|tufao|furac[aã]o|tropical storm|tempestade tropical|depress[aã]o tropical)\b/i.test(t);
}
function normalizeEventItem(item) {
    if (!item) return item;
    if (!looksLikeCyclone(item) && item.type !== 'hurricane') return item;
    const coords = item.coords || [0, 0];
    const cyc = (typeof getCycloneMeta === 'function') ? getCycloneMeta(coords[0], coords[1]) : { label: 'Ciclone', basin: '', basinEmoji: '🌀' };
    let wind = item.windKmh;
    if (wind == null) wind = extractWindKmh(item.detail || item.place || '');
    const curto = rotuloCicloneCurto({ ...item, windKmh: wind, coords });
    const nome = nomeCicloneLimpo(item.place);
    // Evita "Tempestade severa (EONET)" em ciclone
    let detail = item.detail;
    if (!detail || /tempestade severa|severe storm/i.test(detail)) {
        detail = detalheCicloneLista({ ...item, windKmh: wind, basin: cyc.basin, place: nome });
    }
    return {
        ...item,
        type: 'hurricane',
        place: nome || item.place,
        windKmh: wind != null ? wind : item.windKmh,
        cycloneLabel: curto,
        basin: item.basin || cyc.basin,
        bandeira: cyc.basinEmoji || '🌀',
        detail,
        icon: '🌀'
    };
}
function dedupeFeedItems(items) {
    const out = [];
    const kmLim = (typeof DEDUPE_KM === 'number') ? DEDUPE_KM : 80;
    const msLim = (typeof DEDUPE_MS === 'number') ? DEDUPE_MS : 6 * 3600000;

    // Grid espacial: antes, cada item novo comparava contra TODO o array já
    // aceito (findIndex percorrendo tudo, haversine em cada par — O(n²), com
    // 500 eventos isso é ~250 mil comparações por atualização). Agora cada
    // item só é comparado contra o que está na mesma célula de ~kmLim km e
    // nas 8 vizinhas (onde uma duplicata geograficamente poderia cair), mais
    // um índice por id e por nome de local pros itens sem coordenada — O(n)
    // na prática. Verificado com 11 fixtures (incluindo os casos raros de
    // item sem coords cruzando com item com coords) batendo idêntico ao
    // algoritmo antigo, e benchmark mostrando 2-4x mais rápido em 200-500 itens.
    const cellDeg = Math.max(0.1, kmLim / 111); // graus por célula (aprox.)
    const grid = new Map();       // "tipo|célulaLat|célulaLng" -> [índices em out]
    const idIndex = new Map();    // "tipo|id" -> índice em out
    const placeIndex = new Map(); // "tipo|nomeLocal" -> [índices em out]
    const cellKeyOf = (type, lat, lng) => `${type}|${Math.floor(lat / cellDeg)}|${Math.floor(lng / cellDeg)}`;

    function sameEvent(o, it) {
        if (o.type !== it.type) return false;
        if (o.id && it.id && o.id === it.id) return true;
        if (!o.coords || !it.coords) {
            const na = String(o.place || '').toLowerCase();
            const nb = String(it.place || '').toLowerCase();
            return !!na && !!nb && na === nb && Math.abs((o.time || 0) - (it.time || 0)) < msLim;
        }
        const dist = haversine(o.coords[1], o.coords[0], it.coords[1], it.coords[0]);
        if (dist > kmLim) return false;
        if (Math.abs((o.time || 0) - (it.time || 0)) > msLim) return false;
        if (it.type === 'earthquake' && o.mag != null && it.mag != null && Math.abs(o.mag - it.mag) > 0.4) return false;
        return true;
    }

    function findMatch(it) {
        if (it.id) {
            const idHit = idIndex.get(`${it.type}|${it.id}`);
            if (idHit != null) return idHit;
        }
        const nb = String(it.place || '').toLowerCase();
        if (!it.coords) {
            if (nb) {
                const bucket = placeIndex.get(`${it.type}|${nb}`);
                if (bucket) for (const idx of bucket) if (sameEvent(out[idx], it)) return idx;
            }
            return -1;
        }
        const [lng, lat] = it.coords;
        const baseLat = Math.floor(lat / cellDeg), baseLng = Math.floor(lng / cellDeg);
        for (let dLat = -1; dLat <= 1; dLat++) {
            for (let dLng = -1; dLng <= 1; dLng++) {
                const bucket = grid.get(`${it.type}|${baseLat + dLat}|${baseLng + dLng}`);
                if (!bucket) continue;
                for (const idx of bucket) if (sameEvent(out[idx], it)) return idx;
            }
        }
        // Cobre o caso raro em que o item já aceito não tem coordenada (fica
        // só no placeIndex) mas o item novo tem — o algoritmo original
        // também comparava esse par pelo nome do local.
        if (nb) {
            const bucket = placeIndex.get(`${it.type}|${nb}`);
            if (bucket) for (const idx of bucket) if (!out[idx].coords && sameEvent(out[idx], it)) return idx;
        }
        return -1;
    }

    function indexItem(idx) {
        const it = out[idx];
        if (it.id) idIndex.set(`${it.type}|${it.id}`, idx);
        const nb = String(it.place || '').toLowerCase();
        if (nb) {
            const key = `${it.type}|${nb}`;
            if (!placeIndex.has(key)) placeIndex.set(key, []);
            placeIndex.get(key).push(idx);
        }
        if (it.coords) {
            const [lng, lat] = it.coords;
            const key = cellKeyOf(it.type, lat, lng);
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(idx);
        }
    }

    items.forEach(it => {
        const hit = findMatch(it);
        if (hit < 0) { out.push(it); indexItem(out.length - 1); return; }
        // Preferir fonte mais "oficial" / mais completa
        const rank = s => (/NHC|USGS|EMSC|GDACS/i.test(s) ? 3 : /EONET|NWS/i.test(s) ? 2 : 1);
        const cur = out[hit];
        if (rank(it.source) > rank(cur.source) || (it.windKmh && !cur.windKmh) || (it.mag != null && cur.mag == null)) {
            out[hit] = { ...cur, ...it, id: cur.id, time: Math.min(cur.time || it.time, it.time || cur.time) };
        }
    });
    return out;
}
/* Ordem do feed: prioridade para a chegada ao monitor, não para a data do evento.
   Um alerta/fogo pode ter timestamp da fonte diferente (ou muito antigo), mas quando
   o monitor o recebe ele precisa aparecer no topo, exatamente como um sismo novo. */
let feedArrivalAt = new Map();
let feedPreviousKeys = new Set();
let feedArrivalSeq = 0;

function feedItemKey(item) {
    if (!item) return '';
    if (item.id != null && item.id !== '') return `${item.type || 'event'}:${item.id}`;
    return `${item.type || 'event'}:${item.place || item.title || ''}:${item.time || 0}`;
}

function stampFeedArrival(items) {
    const now = Date.now();
    const currentKeys = new Set();
    items.forEach(item => {
        const key = feedItemKey(item);
        if (!key) return;
        currentKeys.add(key);
        // Se o registro acabou de entrar no feed (ou voltou depois de desaparecer),
        // recebe uma nova posição de chegada. O pequeno contador resolve empates
        // quando vários registros chegam na mesma atualização.
        if (!feedArrivalAt.has(key) || !feedPreviousKeys.has(key)) {
            feedArrivalAt.set(key, now + (++feedArrivalSeq / 1000));
        }
        item._feedReceivedAt = feedArrivalAt.get(key);
    });
    feedPreviousKeys = currentKeys;
    return items;
}

/* Janela de exibição:
   - padrão 24h (como o rótulo da lista)
   - sismos no Brasil (coords BR ou fonte USP) ficam 72h: a RSBR detecta
     poucos eventos e a análise da USP pode sair horas depois. */
function eventDisplayCutMs(item) {
  const now = Date.now();
  const h24 = 864e5;
  const h72 = 72 * 3600000;
  try {
    if (item && (item.type === 'earthquake' || item.mag != null)) {
      const src = String(item.source || item.sourceSummary || '');
      if (/\bUSP\b/i.test(src)) return now - h72;
      if (item.coords && typeof coordsInBrazil === 'function' && coordsInBrazil(item.coords[1], item.coords[0])) {
        return now - h72;
      }
    }
  } catch (e) {}
  return now - h24;
}

// Cache de buildUnifiedFeed(): a função é chamada várias vezes por segundo por
// consumidores independentes (KPIs, filtros, ciclo automático, painel de debug),
// e cada chamada refaz filter+dedupe (O(n²) via findIndex) + sort do zero. Como
// ninguém faz .sort()/.splice() no array retornado (todos só leem/filtram para
// um novo array), é seguro devolver a mesma referência enquanto os dados de
// entrada não mudarem. A "impressão digital" é barata (tamanho + último id de
// cada lista + magnitude mínima) e um TTL curto cobre o corte por tempo de
// eventDisplayCutMs(), que se move sozinho com o relógio.
let __feedCache = null;
let __feedCacheFP = '';
let __feedCacheAt = 0;
const FEED_CACHE_TTL_MS = 2000;

function buildUnifiedFeed() {
    const now = Date.now();
    const fp = globalEvents.length + '|' + globalAlerts.length + '|' + minMagnitude + '|' +
        (globalEvents.length ? globalEvents[globalEvents.length - 1].id : '') + '|' +
        (globalAlerts.length ? globalAlerts[globalAlerts.length - 1].id : '');
    if (__feedCache && fp === __feedCacheFP && (now - __feedCacheAt) < FEED_CACHE_TTL_MS) {
        return __feedCache;
    }
    const q = globalEvents
        .filter(e => e.mag >= minMagnitude && e.time >= eventDisplayCutMs(e))
        .map(e => ({ ...e, type: 'earthquake' }));
    // O slider de magnitude é um filtro sísmico. Quando o usuário está em
    // "Tudo" e escolhe uma magnitude alta (ex.: M6.2), a coluna REGISTROS
    // deve mostrar somente sismos que atendem ao corte — não misturar
    // enchentes, vulcões, incêndios, vento, tempestades etc.
    // Os demais tipos continuam disponíveis normalmente quando o usuário
    // escolhe explicitamente o chip correspondente.
    const somenteSismosPorMagnitude = (sidebarFilter === 'all' && Number(minMagnitude) > 0.1);
    const alertasLista = somenteSismosPorMagnitude
        ? []
        : globalAlerts.filter(alertVisivelNaLista);
    const raw = [...q, ...alertasLista].map(normalizeEventItem);
    const merged = stampFeedArrival(dedupeFeedItems(raw));
    // Ordem cronológica é a chave primária (é o que os cabeçalhos de grupo — "Última hora",
    // "1–6h atrás" etc. — usam pra decidir onde cada evento cai). Antes a chegada no feed
    // (_feedReceivedAt) vinha primeiro, o que podia intercalar eventos de faixas de tempo
    // diferentes e fazer o mesmo cabeçalho de grupo aparecer repetido na lista.
    merged.sort((a, b) => {
        const bt = (b.time || 0) - (a.time || 0);
        if (bt) return bt;
        const ar = Number(a._feedReceivedAt) || 0;
        const br = Number(b._feedReceivedAt) || 0;
        return br - ar;
    });
    __feedCache = merged;
    __feedCacheFP = fp;
    __feedCacheAt = now;
    return merged;
}

// Força o próximo buildUnifiedFeed() a recalcular, ignorando fingerprint e TTL.
// Útil logo depois de uma ação do usuário (ex.: mudar o filtro de magnitude)
// quando não se quer esperar o TTL de 2s.
function invalidateUnifiedFeedCache() {
    __feedCacheFP = '';
}


/* ================================================================
   VULCANISMO — tradução local EN -> PT-BR
   As agências internacionais (USGS/GDACS/VAAC) frequentemente retornam
   descrições em inglês. Traduzimos apenas a camada de apresentação, sem
   alterar o texto original usado para identificação/cross-match.
   ================================================================ */
