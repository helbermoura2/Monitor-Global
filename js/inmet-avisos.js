// === inmet-avisos.js — Avisos INMET + helpers de polígono geográfico + cache offline (linhas originais 7415-7901 do core-app.js) ===

function polygonCentroid(polyJson) {
    try {
        const g = typeof polyJson === 'string' ? JSON.parse(polyJson) : polyJson;
        // Aceita Polygon e MultiPolygon
        let rings = [];
        if (g && g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
            g.coordinates.forEach(poly => { if (poly && poly[0]) rings.push(poly[0]); });
        } else {
            const ring = (g && g.coordinates && g.coordinates[0]) || [];
            if (ring.length) rings = [ring];
        }
        if (!rings.length) return null;
        // Centróide por fórmula do laço (shoelace) no maior anel
        let best = null, bestArea = -1;
        rings.forEach(ring => {
            if (!ring || ring.length < 3) return;
            let a = 0, cx = 0, cy = 0;
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const xi = Number(ring[i][0]), yi = Number(ring[i][1]);
                const xj = Number(ring[j][0]), yj = Number(ring[j][1]);
                if (!Number.isFinite(xi) || !Number.isFinite(yi)) continue;
                const f = xi * yj - xj * yi;
                a += f;
                cx += (xi + xj) * f;
                cy += (yi + yj) * f;
            }
            a *= 0.5;
            const area = Math.abs(a);
            if (area > bestArea && Math.abs(a) > 1e-12) {
                bestArea = area;
                best = [cx / (6 * a), cy / (6 * a)];
            }
        });
        if (best && Number.isFinite(best[0]) && Number.isFinite(best[1])) return best;
        // fallback: média dos vértices do primeiro anel
        const ring = rings[0];
        let sx = 0, sy = 0, n = 0;
        ring.forEach(p => { if (Array.isArray(p) && p.length >= 2) { sx += p[0]; sy += p[1]; n++; } });
        if (!n) return null;
        return [sx / n, sy / n];
    } catch (e) { return null; }
}
/* Capitais / âncoras por UF — para avisos multi-estado o centróide pode cair no estado "errado" */
const UF_ANCHOR = {
    AC:[-9.97,-67.81], AL:[-9.67,-35.74], AP:[0.03,-51.05], AM:[-3.10,-60.02], BA:[-12.97,-38.50],
    CE:[-3.72,-38.54], DF:[-15.79,-47.88], ES:[-20.32,-40.34], GO:[-16.68,-49.25], MA:[-2.53,-44.30],
    MT:[-15.60,-56.10], MS:[-20.44,-54.65], MG:[-19.92,-43.94], PA:[-1.45,-48.49], PB:[-7.12,-34.86],
    PR:[-25.43,-49.27], PE:[-8.05,-34.90], PI:[-5.09,-42.80], RJ:[-22.91,-43.17], RN:[-5.79,-35.21],
    RS:[-30.03,-51.23], RO:[-8.76,-63.90], RR:[2.82,-60.67], SC:[-27.59,-48.55], SP:[-23.55,-46.63],
    SE:[-10.91,-37.07], TO:[-10.18,-48.33]
};
// BUG CORRIGIDO: os retângulos de SC e RS se sobrepunham na faixa de
// -29.7 a -27.0 de latitude (ex.: Santa Maria/RS, lat ~-29.68, "passava" no
// teste de bbox de SC). Como SC e RS são vizinhos em diagonal, um retângulo
// frouxo pra um invade o território do outro perto da fronteira — mesmo
// problema da checagem de foco de incêndio Brasil/Bolívia. Ajustado pros
// limites reais de cada UF pra reduzir a faixa de sobreposição.
// AMPLIADO: só 6 UFs tinham bbox (SP/RJ/MG/PR/SC/RS) — os outros 21 estados
// não passavam por checagem nenhuma, então um aviso mal geolocalizado neles
// nunca seria corrigido pro anchor da capital. Adicionados os 21 restantes
// com retângulos aproximados. São retângulos, não polígonos reais — então
// em fronteiras diagonais (tipo SC/RS) ainda pode sobrar uma faixa de
// sobreposição, mas já é bem melhor que não ter checagem nenhuma.
const UF_BBOX = {
    AC:{minLat:-11.14,maxLat:-7.35,minLng:-73.99,maxLng:-66.62},
    AL:{minLat:-10.50,maxLat:-8.81,minLng:-38.24,maxLng:-35.15},
    AP:{minLat:-1.24,maxLat:4.44,minLng:-54.88,maxLng:-49.87},
    AM:{minLat:-9.82,maxLat:2.25,minLng:-73.80,maxLng:-56.09},
    BA:{minLat:-18.35,maxLat:-8.53,minLng:-46.62,maxLng:-37.34},
    CE:{minLat:-7.86,maxLat:-2.78,minLng:-41.42,maxLng:-37.25},
    DF:{minLat:-16.05,maxLat:-15.50,minLng:-48.28,maxLng:-47.31},
    ES:{minLat:-21.30,maxLat:-17.89,minLng:-41.88,maxLng:-39.65},
    GO:{minLat:-19.50,maxLat:-12.39,minLng:-53.25,maxLng:-45.90},
    MA:{minLat:-10.26,maxLat:-1.04,minLng:-48.75,maxLng:-41.79},
    MT:{minLat:-18.04,maxLat:-7.35,minLng:-61.63,maxLng:-50.22},
    MS:{minLat:-24.07,maxLat:-17.17,minLng:-58.17,maxLng:-50.92},
    MG:{minLat:-22.9,maxLat:-14.2,minLng:-51.1,maxLng:-39.8},
    PA:{minLat:-9.84,maxLat:2.59,minLng:-58.90,maxLng:-46.06},
    PB:{minLat:-8.32,maxLat:-6.02,minLng:-38.76,maxLng:-34.79},
    PR:{minLat:-26.8,maxLat:-22.5,minLng:-54.6,maxLng:-48.0},
    PE:{minLat:-9.48,maxLat:-7.29,minLng:-41.36,maxLng:-34.79},
    PI:{minLat:-10.93,maxLat:-2.74,minLng:-45.99,maxLng:-40.37},
    RJ:{minLat:-23.4,maxLat:-20.7,minLng:-44.9,maxLng:-40.9},
    RN:{minLat:-6.98,maxLat:-4.83,minLng:-38.58,maxLng:-34.97},
    RS:{minLat:-33.75,maxLat:-27.08,minLng:-57.65,maxLng:-49.7},
    RO:{minLat:-13.69,maxLat:-7.97,minLng:-66.81,maxLng:-59.77},
    RR:{minLat:-1.58,maxLat:5.27,minLng:-64.82,maxLng:-58.86},
    SC:{minLat:-29.35,maxLat:-25.95,minLng:-53.85,maxLng:-48.35},
    SP:{minLat:-25.3,maxLat:-19.8,minLng:-53.1,maxLng:-44.1},
    SE:{minLat:-11.57,maxLat:-9.51,minLng:-38.24,maxLng:-36.39},
    TO:{minLat:-13.46,maxLat:-5.17,minLng:-50.74,maxLng:-45.72}
};
function pointInUfBbox(lng, lat, uf) {
    const b = UF_BBOX[uf];
    if (!b) return true; // sem bbox → não força snap
    return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}
function parseMunicipiosUF(municipiosStr) {
    const out = [];
    String(municipiosStr || '').split(',').forEach(raw => {
        const s = raw.trim();
        if (!s) return;
        // "Abdon Batista - SC" ou "Abdon Batista (SC)" ou "Abdon Batista-SC"
        let m = s.match(/^(.+?)\s*[-–]\s*([A-Z]{2})\b/);
        if (!m) m = s.match(/^(.+?)\s*\(([A-Z]{2})\)\s*$/);
        if (!m) m = s.match(/^(.+?)\s+([A-Z]{2})\s*$/);
        if (m) out.push({ nome: m[1].replace(/\s*\(\d+\)$/, '').trim(), uf: m[2] });
        else out.push({ nome: s.replace(/\s*\(\d+\)$/, '').trim(), uf: null });
    });
    return out;
}
function inmetPickCoords(a, ufs) {
    const centro = polygonCentroid(a.poligono);
    const munis = parseMunicipiosUF(a.municipios);
    // UF dominante nos municípios listados
    const ufCount = {};
    munis.forEach(m => { if (m.uf) ufCount[m.uf] = (ufCount[m.uf] || 0) + 1; });
    (ufs || []).forEach(u => { ufCount[u] = (ufCount[u] || 0) + 0.5; });
    let primaryUf = null, bestN = 0;
    Object.keys(ufCount).forEach(u => {
        if (ufCount[u] > bestN) { bestN = ufCount[u]; primaryUf = u; }
    });
    if (!primaryUf && ufs && ufs[0]) primaryUf = ufs[0];

    let coords;
    if (centro && Number.isFinite(centro[0]) && Number.isFinite(centro[1])) {
        // Se o centróide cai fora da UF principal (ex.: aviso SC+RS com pino no meio do RS),
        // ancora na capital da UF que mais aparece na lista de municípios.
        if (primaryUf && UF_BBOX[primaryUf] && !pointInUfBbox(centro[0], centro[1], primaryUf)) {
            const anc = UF_ANCHOR[primaryUf];
            dbgLog('INMET: centróide fora do bbox de', primaryUf, `[${centro[1].toFixed(2)}, ${centro[0].toFixed(2)}]`, '→ reancorando na capital', anc);
            coords = anc ? [anc[1], anc[0]] : centro; // [lng, lat]
        } else {
            coords = centro;
        }
    } else if (primaryUf && UF_ANCHOR[primaryUf]) {
        const anc = UF_ANCHOR[primaryUf];
        coords = [anc[1], anc[0]];
    } else {
        coords = [-46.63, -23.55];
    }
    // Devolve também a UF dominante e a lista de municípios já parseada, pra
    // quem chamar poder montar a amostra de texto ("Cidade X, Cidade Y…")
    // batendo com o estado onde o pino realmente foi ancorado — evita mostrar
    // uma cidade de SC no texto enquanto o pino está em SP/RS/PR (o aviso é
    // multiestadual e a amostra pegava sempre as 3 primeiras em ordem alfabética
    // da lista combinada, que podem ser de qualquer estado do aviso).
    return { coords, primaryUf, munis };
}

function pointInPolygon(lng, lat, polyJson) {
    try {
        const g = typeof polyJson === 'string' ? JSON.parse(polyJson) : polyJson;
        const ring = (g && g.coordinates && g.coordinates[0]) || [];
        if (ring.length < 3) return false;
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const xi = ring[i][0], yi = ring[i][1];
            const xj = ring[j][0], yj = ring[j][1];
            const inter = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
            if (inter) inside = !inside;
        }
        return inside;
    } catch (e) { return false; }
}
function inmetSevScore(sev) {
    const s = String(sev || '').toLowerCase();
    if (/grande perigo|extrem/.test(s)) return 4;
    if (/\bperigo\b/.test(s) && !/potencial/.test(s)) return 3;
    if (/potencial|moderado/.test(s)) return 2;
    return 1;
}
function inmetIsStormLike(desc) {
    return /tempestade|chuva|vento|vendaval|granizo|tornado|tromba|raio|trovoad|ciclone/i.test(String(desc || ''));
}
function inmetAlertSoundKind(desc) {
    const d = String(desc || '').toLowerCase();
    if (/vendaval|vento forte|vento intenso|rajada/.test(d)) return 'wind';
    if (/tornado|tromba/.test(d)) return 'tornado';
    if (/granizo/.test(d)) return 'storm';
    if (/tempestade|trovoad|raio|chuva intensa|chuva forte|ciclone/.test(d)) return 'storm';
    if (/alag|inunda|enxurr/.test(d)) return 'flood';
    return 'civil';
}
function estadosToUFs(estados) {
    return String(estados || '').split(',').map(s => {
        const k = s.trim().toLowerCase();
        return UF_NOME[k] || null;
    }).filter(Boolean);
}

function formatCacheAge(ageMs) {
  if (!Number.isFinite(ageMs) || ageMs < 0) return '—';
  if (ageMs < 60000) return Math.max(1, Math.round(ageMs / 1000)) + 's';
  if (ageMs < 3600000) return Math.round(ageMs / 60000) + 'min';
  return Math.round(ageMs / 3600000) + 'h';
}

function salvarCacheOffline() {
  try {
    const payload = {
      v: 2,
      t: Date.now(),
      events: (typeof globalEvents !== 'undefined' && globalEvents) ? globalEvents.slice(0, 150) : [],
      alerts: (typeof globalAlerts !== 'undefined' && globalAlerts) ? globalAlerts.slice(0, 150) : [],
      weather: window.__proWeather || null,
      sismoSuccess: window.__lastSismoSuccess || null,
      sourceStatus: window.sismoSourceStatus || null,
      sourceHealth: (typeof SourceHealth !== 'undefined') ? SourceHealth.snapshot() : null,
      selectedId: (typeof EventStore !== 'undefined' && EventStore.selectedId) || (typeof eventoSelecionadoId !== 'undefined' ? eventoSelecionadoId : null)
    };
    try {
      localStorage.setItem('monitor_offline_cache', JSON.stringify(payload));
    } catch (e) {
      payload.alerts = (payload.alerts || []).slice(0, 40);
      payload.events = (payload.events || []).slice(0, 80);
      try { localStorage.setItem('monitor_offline_cache', JSON.stringify(payload)); } catch (e2) {}
    }
    window.__lastOfflineSaveAt = Date.now();
  } catch (e) {}
}

function restaurarCacheOffline(reason = 'offline') {
  try {
    const raw = localStorage.getItem('monitor_offline_cache');
    if (!raw) return false;

    const p = JSON.parse(raw);
    const ageMs = Date.now() - Number(p.t || 0);
    const MAX_CACHE_AGE = 6 * 3600000;

    if (!p || !p.t || ageMs < 0 || ageMs > MAX_CACHE_AGE) return false;

    const hasLiveEvents = Array.isArray(globalEvents) && globalEvents.length > 0;
    const hasLiveAlerts = Array.isArray(globalAlerts) && globalAlerts.length > 0;

    if (!hasLiveEvents && Array.isArray(p.events) && p.events.length) {
      globalEvents = p.events;
      try { window.globalEvents = globalEvents; } catch (_) {}
      try { p.events.forEach(e => { if (e && e.id != null) knownEventIds.add(e.id); }); } catch (e) {}
    }

    if (!hasLiveAlerts && Array.isArray(p.alerts) && p.alerts.length) {
      globalAlerts = p.alerts;
      try { window.globalAlerts = globalAlerts; } catch (_) {}
      try { p.alerts.forEach(a => { if (a && a.id != null) knownAlertIds.add(a.id); }); } catch (e) {}
    }

    if (p.weather) window.__proWeather = p.weather;
    if (p.sourceStatus) window.sismoSourceStatus = p.sourceStatus;
    try {
      if (p.sourceHealth && typeof SourceHealth !== 'undefined') SourceHealth.restoreSnapshot(p.sourceHealth);
    } catch (e) {}

    window.__sismoUsingCache = true;
    window.__sismoCacheAt = Number(p.t);
    window.__sismoCacheAgeMs = ageMs;
    window.__offlineCacheReason = reason;

    if (typeof applyFilters === 'function') applyFilters();

    try {
      if (p.selectedId && typeof EventStore !== 'undefined') {
        const item = EventStore.getById(p.selectedId);
        if (item) {
          EventStore.setSelected(p.selectedId);
          if (item.type === 'earthquake' || item.mag != null) {
            const idx = globalEvents.findIndex(e => e && e.id === p.selectedId);
            if (idx >= 0 && typeof showEventDetails === 'function') showEventDetails(idx, false, true);
          } else if (typeof showAlertDetails === 'function') {
            showAlertDetails(item, false, true);
          }
        }
      }
    } catch (e) {}

    const age = formatCacheAge(ageMs);
    try {
      const now = Date.now();
      if (!window.__lastCacheToastAt || now - window.__lastCacheToastAt > 45000) {
        window.__lastCacheToastAt = now;
        showToast(
          reason === 'offline'
            ? `📴 Sem conexão — dados de ${age} atrás`
            : `🟠 Fontes indisponíveis — cache de ${age}`,
          'warning'
        );
      }
    } catch (e) {}

    try { if (typeof updateFreshnessUI === 'function') updateFreshnessUI(); } catch (e) {}
    try { if (typeof updateFreshnessBar === 'function') updateFreshnessBar(); } catch (e) {}
    return true;
  } catch (e) {
    return false;
  }
}

if (!window.__offlineNetBound) {
  window.__offlineNetBound = true;

  window.addEventListener('online', () => {
    try {
      window.__sismoUsingCache = false;
      window.__offlineCacheReason = null;
      showToast('🌐 Conexão restabelecida — atualizando fontes agora', 'info');
    } catch (e) {}

    try { if (typeof retomarBuscas === 'function') retomarBuscas(); } catch (e) {}
    try { if (typeof fetchGlobalFeeds === 'function') fetchGlobalFeeds(); } catch (e) {}
    try { if (typeof updateFreshnessBar === 'function') updateFreshnessBar(); } catch (e) {}
    try { if (typeof updateFreshnessUI === 'function') updateFreshnessUI(); } catch (e) {}
  });

  window.addEventListener('offline', () => {
    try {
      // Grava o que tem agora antes de cair no cache antigo
      if (typeof salvarCacheOffline === 'function') salvarCacheOffline();
      showToast('📴 Sem rede — usando dados locais somente se necessário', 'warning');
      restaurarCacheOffline('offline');
    } catch (e) {}
  });

  // Snapshot periódico (a cada 3 min) enquanto a aba está visível — reforça offline
  setInterval(() => {
    try {
      if (document.hidden) return;
      if (typeof salvarCacheOffline === 'function') salvarCacheOffline();
    } catch (e) {}
  }, 180000);
}

function inmetMeAtinge(a, ref) {
    if (!ref) return { hit: false, why: '' };
    const uf = String(ref.uf || '').toUpperCase();
    const nome = String(ref.nome || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const ufs = estadosToUFs(a.estados);
    const munis = String(a.municipios || '');
    // 1) município no texto do aviso
    if (nome.length >= 3 && munis.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(nome)) {
        return { hit: true, why: 'município listado' };
    }
    // 2) ponto GPS dentro do polígono
    if (ref.lat != null && ref.lng != null && a.poligono && pointInPolygon(ref.lng, ref.lat, a.poligono)) {
        return { hit: true, why: 'dentro da área do aviso' };
    }
    // 3) mesma UF do aviso
    if (uf && ufs.includes(uf)) {
        return { hit: true, why: 'estado ' + uf };
    }
    return { hit: false, why: '' };
}
async function fetchInmetAvisos() {
    try {
        const r = await fetchWithCorsFallback('https://apiprevmet3.inmet.gov.br/avisos/ativos', 18000);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json();
        const lista = []
            .concat(Array.isArray(d.hoje) ? d.hoje : [])
            .concat(Array.isArray(d.futuro) ? d.futuro : []);
        const ids = new Set();
        let novoCritico = null, novos = 0;
        const ref = (typeof minhaPosicao !== 'undefined' && minhaPosicao && minhaPosicao.lat != null)
            ? { lat: minhaPosicao.lat, lng: minhaPosicao.lng, nome: (weatherLoc && weatherLoc.nome) || '', uf: (weatherLoc && weatherLoc.uf) || '' }
            : (typeof weatherLoc !== 'undefined' ? weatherLoc : null);

        lista.forEach(a => {
            if (!a || a.encerrado) return;
            const id = 'inmet-' + (a.id || a.id_aviso || Math.random());
            ids.add(id);
            const desc = a.descricao || 'Aviso meteorológico';
            const sevLabel = a.severidade || 'Aviso';
            const estados = a.estados || '';
            const ufs = estadosToUFs(estados);
            const pick = inmetPickCoords(a, ufs);
            const coords = pick.coords;
            const primaryUf = pick.primaryUf;
            const munisRaw = String(a.municipios || '').split(',').map(s => s.trim()).filter(Boolean);
            // Prioriza, na amostra exibida, os municípios da mesma UF onde o
            // pino foi ancorado — sem isso, a amostra pegava sempre os 3
            // primeiros em ordem alfabética da lista combinada (que pode
            // cobrir vários estados de uma vez), então uma cidade de SC podia
            // aparecer no texto mesmo com o pino ancorado em SP/RS/PR.
            let munisParaAmostra = munisRaw;
            if (primaryUf) {
                const daUfPrincipal = munisRaw.filter((_, i) => pick.munis[i] && pick.munis[i].uf === primaryUf);
                if (daUfPrincipal.length) munisParaAmostra = daUfPrincipal;
            }
            const munSample = munisParaAmostra.slice(0, 3).map(m => m.replace(/\s*\(\d+\)$/, '')).join(', ');
            const riscoTxt = Array.isArray(a.riscos) && a.riscos[0] ? String(a.riscos[0]).slice(0, 140) : '';
            const riscosCompletos = Array.isArray(a.riscos) ? a.riscos.join(' ') : '';
            const me = inmetMeAtinge(a, ref);
            // "Chuva Intensa" quase sempre cita alagamento/enxurrada no campo de
            // riscos (não no título). Sem checar esse campo, todo aviso de chuva
            // ficava só em 'storm', e o filtro 💧 Enchentes nunca via nada do Brasil.
            const isFloodLike = /alag|inunda|enxurr/i.test(desc + ' ' + riscosCompletos);
            // Tornado/tromba d'água tinham type 'storm' genérico — mesmo tendo um
            // tipo (TYPE_META.tornado) e ícone/cor próprios no app, ficavam
            // indistinguíveis de qualquer outro aviso de tempestade.
            const isTornadoLike = /tornado|tromba/i.test(desc + ' ' + riscosCompletos);
            const type = isFloodLike ? 'flood' : (isTornadoLike ? 'tornado' : (inmetIsStormLike(desc) ? 'storm' : 'civil'));
            const sev = inmetSevScore(sevLabel);
            const uf0 = primaryUf || ufs[0] || '';
            const defesaUrl = UF_DEFESA[uf0] || 'https://www.gov.br/mdr/pt-br/assuntos/protecao-e-defesa-civil';
            const inicioTs = a.inicio ? new Date(String(a.inicio).replace(' ', 'T') + '-03:00').getTime() : null;
            const fimTs = a.fim ? new Date(String(a.fim).replace(' ', 'T') + '-03:00').getTime() : null;
            const futuro = Number.isFinite(inicioTs) && inicioTs > Date.now();
            // Antes só entrava no texto a amostra de municípios da UF onde o
            // pino foi ancorado — um aviso "Chuvas Intensas — Acorizal — MT"
            // podia, na real, cobrir MT+GO+MS ao mesmo tempo, e essa
            // abrangência ficava escondida (o campo `ufs` já existia, só não
            // era mostrado em lugar nenhum). Agora, quando o aviso cobre mais
            // de uma UF, isso aparece explicitamente no texto e no detalhe.
            const multiEstado = ufs.length > 1;
            const placeBase = munSample
                ? `${desc} — ${munSample}${munisParaAmostra.length > 3 ? '…' : ''}`
                : `${desc} — ${estados || 'Brasil'}`;
            const place = (futuro ? '⏳ EM BREVE — ' : '') + (me.hit ? '📍 ' : '') + placeBase +
                (multiEstado ? ` (+${ufs.length - 1} estado${ufs.length - 1 > 1 ? 's' : ''})` : '');
            const detail = [
                sevLabel,
                me.hit ? ('Afeta você (' + me.why + ')') : null,
                multiEstado ? ('Estados afetados: ' + ufs.join(', ')) : null,
                riscoTxt,
                a.inicio && a.fim ? (a.inicio + ' → ' + a.fim) : null,
                'Defesa Civil 199'
            ].filter(Boolean).join(' · ');

            const prev = globalAlerts.find(x => x.id === id);

            const obj = {
                id, type, place, bandeira: '🇧🇷', pais: 'Brasil', futuro,
                icon: /tempestade|trovoad|raio|granizo/i.test(desc) ? '⛈️' : (/chuva|alag/i.test(desc) ? '🌧️' : (/vento|vendaval/i.test(desc) ? '💨' : '⚠️')),
                // O timestamp do feed é o início do aviso. O filtro da lista usa
                // inicioTs/fimTs para não confundir aviso futuro com registro recente.
                time: prev ? prev.time : (inicioTs || Date.now()),
                inicioTs, fimTs,
                coords, source: 'INMET', detail, sev,
                inmetSeveridade: sevLabel, inmetCor: a.aviso_cor || null,
                meAtinge: me.hit, meWhy: me.why,
                link: a.id_aviso ? ('https://avisos.inmet.gov.br/' + a.id_aviso) : 'https://avisos.inmet.gov.br/',
                defesaLink: defesaUrl,
                estados, ufs,
                // Descrição "crua" (sem prefixo ⏳/📍 nem amostra de municípios),
                // pra quem for montar um texto próprio (ex.: Resumo do Dia) sem
                // precisar tentar desmontar o `place` já formatado.
                descOnly: desc
            };
            const isNew = upsertAlert(obj, { fonte: 'inmet', expiraMs: 300000 });

            if (isNew) {
                novos++;
                // Toast sempre (discreto se não afeta / severidade baixa)
                if (me.hit || sev >= 3) {
                    showToast(`🇧🇷 INMET ${sevLabel}: ${desc}${me.hit ? ' · te afeta' : ''} (${ufs[0] || 'BR'})`, sev >= 3 ? 'warning' : 'info');
                } else {
                    showToast(`🇧🇷 INMET ${desc} · ${ufs.slice(0, 2).join(',') || 'BR'}`, 'info');
                }
                // Som: a partir de Perigo Potencial (amarelo), mas somente quando
                // o aviso realmente atinge a localização monitorada. Grande Perigo
                // continua podendo alertar mesmo fora da localização por ser crítico.
                const deveAlertar = (sev >= 2 && me.hit) || (sev >= 4 && inmetIsStormLike(desc));
                if (deveAlertar) {
                    if (!novoCritico) novoCritico = obj;
                    const soundKind = inmetAlertSoundKind(desc);
                    playAlertTone(soundKind);
                    // Voz fica reservada para Perigo/Grande Perigo; o amarelo
                    // permanece somente com a assinatura sonora para não ser invasivo.
                    if (sev >= 3 && typeof falarAlertaGenerico === 'function') {
                        falarAlertaGenerico(`Aviso do INMET. ${desc}. Severidade ${sevLabel}. ${me.hit ? 'Pode afetar sua região.' : ''} Em emergência ligue 199.`);
                    }
                }
            }
        });

        globalAlerts = globalAlerts.filter(x => !String(x.id).startsWith('inmet-') || ids.has(x.id));
        try { lastFetchTimes['INMET'] = Date.now(); } catch (e) {}
        try { if (typeof setSource === 'function') setSource('INMET', 'ok', lista.length); } catch (e) {}
        try { salvarCacheOffline(); } catch (e) {}
        applyFilters();
        if (novoCritico) showAlertDetails(novoCritico, true);
        marcarBooted('inmet');
    } catch (e) {
        console.warn('INMET avisos:', e && e.message);
        try { if (typeof setSource === 'function') setSource('INMET', 'off', 0, e && e.message); } catch (err) {}
    }
}

/* ═══════════════ GDACS + NWS ═══════════════ */
