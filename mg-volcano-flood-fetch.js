/* Fontes globais de vulcão (VAAC + EONET + GDACS recente) e enchentes em PT-BR */
(function () {
  function baseWorker() {
    try {
      if (typeof workerBaseUrl === 'function') return workerBaseUrl();
      if (typeof WORKER_PROXY === 'function') return WORKER_PROXY('').split('?')[0].replace(/\/$/, '');
    } catch (e) {}
    return 'https://black-sky-9ba0.terrestre.workers.dev';
  }

  function nomeVulcaoLimpo(n) {
    return String(n || '')
      .replace(/\s+volcano\b/ig, '')
      .replace(/\s+\d{6}\s*$/, '')
      .replace(/\s+\[[^\]]*\]\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function achouVulcaoExistente(nome, coords) {
    const list = (typeof globalAlerts !== 'undefined' && globalAlerts) || [];
    const nn = (typeof normalizarNomeVulcao === 'function')
      ? normalizarNomeVulcao(nome)
      : String(nome || '').toLowerCase();
    return list.find((a) => {
      if (a.type !== 'volcano') return false;
      const an = (typeof normalizarNomeVulcao === 'function')
        ? normalizarNomeVulcao(a.place)
        : String(a.place || '').toLowerCase();
      if (nn && an && (nn === an || nn.includes(an) || an.includes(nn))) return true;
      if (coords && a.coords && typeof haversine === 'function') {
        try {
          return haversine(a.coords[1], a.coords[0], coords[1], coords[0]) < 80;
        } catch (e) { return false; }
      }
      return false;
    });
  }

  async function fetchVaacGlobal() {
    const out = [];
    try {
      const r = await fetch(baseWorker() + '/global-volcano?t=' + Date.now(), { cache: 'no-store', mode: 'cors' });
      if (!r.ok) return out;
      const d = await r.json();
      const items = Array.isArray(d && d.items) ? d.items : [];
      const seen = new Set();
      for (const it of items) {
        const name = nomeVulcaoLimpo(it.name);
        if (!name || /va test|test advisory/i.test(String(it.detail || '') + name)) continue;
        const key = (typeof normalizarNomeVulcao === 'function' ? normalizarNomeVulcao(name) : name.toLowerCase());
        if (seen.has(key)) continue;
        seen.add(key);
        let coords = Array.isArray(it.coords) ? it.coords : null;
        if (!coords || !Number.isFinite(Number(coords[0])) || !Number.isFinite(Number(coords[1]))) {
          coords = (typeof mgCoordsVulcao === 'function') ? mgCoordsVulcao(name) : null;
        }
        if (!coords || !Number.isFinite(Number(coords[0]))) continue;
        const lat = Number(coords[1]), lng = Number(coords[0]);
        const infoT = (typeof traduzirEIdentificar === 'function') ? traduzirEIdentificar(it.area || name) : { bandeira: '', pais: '' };
        const flag = infoT.bandeira || (typeof getFlagByCoords === 'function' ? getFlagByCoords(lat, lng) : '');
        const detailRaw = it.detail || it.ashStatus || 'Aviso de cinzas vulcânicas (VAAC)';
        out.push({
          id: 'vaac-' + key.replace(/[^a-z0-9]+/g, '-'),
          type: 'volcano',
          place: name,
          bandeira: flag,
          pais: infoT.pais || (typeof mgPaisPT === 'function' ? mgPaisPT(it.area) : it.area),
          time: Number(it.time) || Date.now(),
          coords: [lng, lat],
          source: it.source || 'VAAC',
          sources: [it.source || 'VAAC'],
          sourceSummary: it.source || 'VAAC',
          detail: detailRaw,
          ashStatus: detailRaw,
          eruptionStatus: 'Aviso de cinzas vulcânicas',
          aviationColor: it.aviationColor || '',
          usgsAlertLevel: it.alertLevel || 'WARNING',
          observatory: it.source || 'VAAC',
          link: 'https://www.bom.gov.au/products/Volc_ash_latest.shtml'
        });
      }
    } catch (e) {
      console.warn('[VAAC global]', e && e.message);
    }
    return out;
  }

  async function fetchEonetVolcanoes() {
    const out = [];
    try {
      const url = 'https://eonet.gsfc.nasa.gov/api/v3/events?category=volcanoes&status=open&limit=80';
      let r;
      if (typeof fetchWithCorsFallback === 'function') {
        r = await fetchWithCorsFallback(url, 18000);
      } else {
        r = await fetch(url, { cache: 'no-store' });
      }
      if (!r || !r.ok) return out;
      const d = await r.json();
      for (const ev of (d.events || [])) {
        const g = ev.geometry && ev.geometry[ev.geometry.length - 1];
        if (!g || !Array.isArray(g.coordinates)) continue;
        const [lng, lat] = g.coordinates;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const name = nomeVulcaoLimpo(ev.title);
        const infoT = (typeof traduzirEIdentificar === 'function') ? traduzirEIdentificar(ev.title) : { bandeira: '', pais: '' };
        const src = ev.sources && ev.sources[0];
        const when = g.date ? new Date(g.date).getTime() : Date.now();
        const tFire = (when && (Date.now() - when) < 48 * 3600000) ? when : Date.now();
        out.push({
          id: 'eonet-vo-' + ev.id,
          type: 'volcano',
          place: name,
          bandeira: infoT.bandeira || (typeof getFlagByCoords === 'function' ? getFlagByCoords(lat, lng) : ''),
          pais: infoT.pais,
          time: tFire,
          coords: [lng, lat],
          source: 'NASA EONET',
          sources: ['NASA EONET'],
          sourceSummary: 'NASA EONET',
          detail: 'Atividade vulcânica em andamento (EONET / Smithsonian GVP)',
          eruptionStatus: 'Em andamento',
          link: (src && src.url) || ev.link || ('https://eonet.gsfc.nasa.gov/api/v3/events/' + ev.id)
        });
      }
    } catch (e) {
      console.warn('[EONET vulcões]', e && e.message);
    }
    return out;
  }

  const _fetchVolcanoesOrig = typeof fetchVolcanoes === 'function' ? fetchVolcanoes : null;

  async function fetchVolcanoesGlobal() {
    if (typeof _fetchVolcanoesOrig === 'function') {
      try { await _fetchVolcanoesOrig(); } catch (e) { console.warn('vulcões USGS/GDACS:', e); }
    }
    try {
      const [vaac, eonet] = await Promise.all([fetchVaacGlobal(), fetchEonetVolcanoes()]);
      const extra = vaac.concat(eonet);
      let novos = 0;
      extra.forEach((obj) => {
        const hit = achouVulcaoExistente(obj.place, obj.coords);
        if (hit) {
          if (!hit.sources) hit.sources = [hit.source].filter(Boolean);
          if (obj.source && !hit.sources.includes(obj.source)) hit.sources.push(obj.source);
          hit.sourceSummary = hit.sources.join(' · ');
          if (obj.detail && (!hit.detail || /status do usgs|usgs volcano hazards/i.test(hit.detail))) {
            hit.detail = obj.detail;
          }
          if (obj.ashStatus && !hit.ashStatus) hit.ashStatus = obj.ashStatus;
          // Mesmo bug do merge equivalente em js/vulcao.js: esse caminho troca
          // upsertAlert() (que carimba _lastSeenAt) por um merge direto no
          // registro existente — sem isso, o selo "sem atualização" (2h+ sem
          // reconfirmação) acendia mesmo com a VAAC/EONET confirmando o vulcão
          // ativamente a cada ciclo, só porque esse carimbo nunca era tocado.
          hit._lastSeenAt = Date.now();
          return;
        }
        const isNew = (typeof upsertAlert === 'function')
          ? upsertAlert(obj, { fonte: obj.id.startsWith('vaac-') ? 'volcanoVaac' : 'volcanoEonet' })
          : false;
        if (isNew) novos++;
      });
      if (typeof globalAlerts !== 'undefined') {
        globalAlerts.filter((a) => a.type === 'volcano').forEach((a) => {
          try { a.confidence = consolidarConfianca(a); } catch (e) {}
        });
      }
      try { if (typeof marcarBooted === 'function') { marcarBooted('volcanoVaac'); marcarBooted('volcanoEonet'); } } catch (e) {}
      try { if (typeof applyFilters === 'function') applyFilters(); } catch (e) {}
      try {
        console.info('[vulcanismo] extra VAAC:', vaac.length, '| EONET:', eonet.length, '| novos:', novos);
      } catch (e) {}
    } catch (e) {
      console.warn('vulcões globais:', e && e.message);
    }
  }

  window.fetchVolcanoes = fetchVolcanoesGlobal;

  const _fetchGdacsFloodsOrig = typeof fetchGdacsFloods === 'function' ? fetchGdacsFloods : null;

  window.fetchGdacsFloods = async function fetchGdacsFloodsPT() {
    try {
      const base = baseWorker();
      const r = await fetch(base + '/gdacs-floods?t=' + Date.now(), { cache: 'no-store', mode: 'cors' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (d && d.ok === false) throw new Error(d.error || 'gdacs-floods indisponível');
      const items = Array.isArray(d && d.items) ? d.items : [];
      const ids = new Set();
      let primeiroNovo = null;
      const agora = Date.now();

      items.forEach((p) => {
        const toTs = p.todate ? Date.parse(p.todate) : NaN;
        const recente = Number.isFinite(toTs) ? (agora - toTs) < 12 * 864e5 : false;
        if (!p.iscurrent && !recente) return;
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return;

        const id = 'gdacs-fl-' + (p.eventid || p.lat + '-' + p.lon);
        ids.add(id);
        const paisNome = (typeof mgPaisPT === 'function' ? mgPaisPT(p.country) : p.country)
          || (typeof traduzirTextoEnchente === 'function'
            ? traduzirTextoEnchente((p.title || '').replace(/^.*flood alert in\s*/i, ''))
            : p.country)
          || 'Área não especificada';
        const infoT = (typeof traduzirEIdentificar === 'function') ? traduzirEIdentificar(p.country || paisNome) : { bandeira: '', pais: paisNome };
        const prev = (typeof globalAlerts !== 'undefined') ? globalAlerts.find((a) => a.id === id) : null;
        const cor = (typeof mgCorPT === 'function') ? mgCorPT(p.alertlevel) : (p.alertlevel || '');
        const desc = (typeof traduzirTextoEnchente === 'function')
          ? traduzirTextoEnchente(p.description || '')
          : (p.description || '');
        const obj = {
          id,
          type: 'flood',
          place: paisNome,
          bandeira: infoT.bandeira || (typeof getFlagByCoords === 'function' ? getFlagByCoords(p.lat, p.lon) : ''),
          pais: infoT.pais || paisNome,
          time: prev ? prev.time : (Number.isFinite(Date.parse(p.fromdate)) ? Date.parse(p.fromdate) : Date.now()),
          coords: [p.lon, p.lat],
          source: 'GDACS',
          gdacsAlertLevel: String(p.alertlevel || '').toLowerCase(),
          detail: [cor ? ('Alerta ' + cor) : null, desc || null].filter(Boolean).join(' · '),
          link: p.link || '#'
        };
        const isNew = (typeof upsertAlert === 'function') ? upsertAlert(obj, { fonte: 'floodGdacs' }) : false;
        if (isNew) {
          primeiroNovo = primeiroNovo || obj;
          try { playAlertTone('flood'); } catch (e) {}
          try { showToast('💧 Enchente: ' + paisNome, 'warning'); } catch (e) {}
          try { notificarNavegador('💧 Enchente — ' + paisNome, 'Alerta GDACS'); } catch (e) {}
        }
      });

      if (typeof globalAlerts !== 'undefined') {
        globalAlerts = globalAlerts.filter((a) => a.type !== 'flood' || a.source !== 'GDACS' || ids.has(a.id));
      }
      try { if (typeof marcarBooted === 'function') marcarBooted('floodGdacs'); } catch (e) {}
      try { if (typeof applyFilters === 'function') applyFilters(); } catch (e) {}
      if (primeiroNovo && typeof showAlertDetails === 'function') showAlertDetails(primeiroNovo, true);
    } catch (e) {
      console.error('GDACS FL:', e);
      if (typeof _fetchGdacsFloodsOrig === 'function') {
        try { await _fetchGdacsFloodsOrig(); } catch (err) {}
      }
    }
  };
})();
