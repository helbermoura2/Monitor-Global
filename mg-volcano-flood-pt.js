/* ================================================================
   VULCÕES GLOBAIS + TRADUÇÃO PT-BR (vulcões e enchentes)
   Camada só de apresentação: nomes próprios e IDs permanecem iguais.
   ================================================================ */
(function () {
  const PAISES_PT = {
    'united states': 'Estados Unidos', 'usa': 'Estados Unidos', 'u.s.': 'Estados Unidos',
    'mexico': 'México', 'nepal': 'Nepal', 'india': 'Índia', 'thailand': 'Tailândia',
    'italy': 'Itália', 'china': 'China', 'nigeria': 'Nigéria', 'japan': 'Japão',
    'spain': 'Espanha', 'indonesia': 'Indonésia', 'philippines': 'Filipinas',
    'russia': 'Rússia', 'chile': 'Chile', 'peru': 'Peru', 'colombia': 'Colômbia',
    'ecuador': 'Equador', 'guatemala': 'Guatemala', 'nicaragua': 'Nicarágua',
    'costa rica': 'Costa Rica', 'vanuatu': 'Vanuatu', 'papua new guinea': 'Papua-Nova Guiné',
    'iceland': 'Islândia', 'new zealand': 'Nova Zelândia', 'canada': 'Canadá',
    'france': 'França', 'greece': 'Grécia', 'turkey': 'Turquia', 'ethiopia': 'Etiópia',
    'kenya': 'Quênia', 'tanzania': 'Tanzânia', 'congo': 'Congo', 'drc': 'RD Congo',
    'democratic republic of the congo': 'RD Congo', 'el salvador': 'El Salvador',
    'honduras': 'Honduras', 'bolivia': 'Bolívia', 'argentina': 'Argentina',
    'brazil': 'Brasil', 'portugal': 'Portugal', 'united kingdom': 'Reino Unido',
    'south korea': 'Coreia do Sul', 'north korea': 'Coreia do Norte',
    'taiwan': 'Taiwan', 'vietnam': 'Vietnã', 'myanmar': 'Mianmar',
    'bangladesh': 'Bangladesh', 'pakistan': 'Paquistão', 'afghanistan': 'Afeganistão',
    'iran': 'Irã', 'iraq': 'Iraque', 'saudi arabia': 'Arábia Saudita',
    'australia': 'Austrália', 'fiji': 'Fiji', 'tonga': 'Tonga', 'samoa': 'Samoa',
    'solomon islands': 'Ilhas Salomão', 'hawaii': 'Havaí', 'alaska': 'Alasca',
    'sicily volcanic province': 'Sicília', 'sicily': 'Sicília'
  };

  const MESES_PT = {
    january: 'janeiro', february: 'fevereiro', march: 'março', april: 'abril',
    may: 'maio', june: 'junho', july: 'julho', august: 'agosto',
    september: 'setembro', october: 'outubro', november: 'novembro', december: 'dezembro'
  };

  const COR_PT = { green: 'verde', yellow: 'amarelo', orange: 'laranja', red: 'vermelho' };
  const NIVEL_PT = {
    NORMAL: 'NORMAL', ADVISORY: 'ATENÇÃO', WATCH: 'VIGILÂNCIA', WARNING: 'AVISO',
    ALERT: 'ALERTA', ELEVATED: 'ELEVADO', ONGOING: 'EM ANDAMENTO',
    ERUPTING: 'EM ERUPÇÃO', ERUPTION: 'ERUPÇÃO', ACTIVE: 'ATIVO',
    DORMANT: 'DORMENTE', EXTINCT: 'EXTINTO', UNREST: 'PERTURBAÇÃO VULCÂNICA',
    GREEN: 'VERDE', YELLOW: 'AMARELO', ORANGE: 'LARANJA', RED: 'VERMELHO',
    UNASSIGNED: 'SEM NÍVEL'
  };

  const OBS_PT = {
    'hawaiian volcano observatory': 'Observatório Vulcanológico do Havaí',
    'alaska volcano observatory': 'Observatório Vulcanológico do Alasca',
    'cascades volcano observatory': 'Observatório Vulcanológico das Cascatas',
    'northern mariana islands volcano observatory': 'Observatório Vulcanológico das Marianas do Norte',
    'yellowstone volcano observatory': 'Observatório Vulcanológico de Yellowstone',
    'usgs volcano hazards program': 'Programa de Riscos Vulcânicos do USGS',
    'usgs vhp': 'USGS VHP',
    'vaac darwin': 'VAAC Darwin',
    'vaac tokyo': 'VAAC Tóquio',
    'nasa eonet': 'NASA EONET',
    'smithsonian': 'Smithsonian GVP'
  };

  const VOLCANO_COORDS = {
    semeru: [112.92, -8.108], lewotolok: [123.508, -8.274], ibu: [127.63, 1.488],
    dukono: [127.88, 1.70], sakurajima: [130.657, 31.593], 'aira caldera': [130.657, 31.593],
    etna: [15.004, 37.748], 'santa maria': [-91.552, 14.756], sangay: [-78.341, -2.002],
    fuego: [-90.88, 14.473], purace: [-76.395, 2.314], reventador: [-77.656, -0.077],
    popocatepetl: [-98.622, 19.023], kilauea: [-155.287, 19.421],
    'great sitkin': [-176.13, 52.076], krakatau: [105.423, -6.102], anak: [105.423, -6.102],
    stromboli: [15.213, 38.789], mayon: [123.685, 13.257], kanlaon: [123.13, 10.41],
    sheveluch: [161.36, 56.653], bezymianny: [160.595, 55.972],
    suwanosejima: [129.714, 29.638], marapi: [100.474, -0.38], lewotobi: [122.775, -8.542],
    sabancaya: [-71.857, -15.787], ambae: [167.83, -15.4], masaya: [-86.169, 11.984],
    telica: [-86.84, 12.606], 'nevados del chillan': [-71.378, -36.868],
    'rincon de la vieja': [-85.324, 10.83], kikai: [130.305, 30.793],
    langila: [148.42, -5.525], 'ivao group': [149.676, 45.759],
    'titan ridge': [147.78, -3.03], 'krasheninnikov': [160.27, 54.596],
    merapi: [110.446, -7.54], agung: [115.508, -8.342],
    'whakaari white island': [177.183, -37.52], ruapehu: [175.57, -39.28],
    cotopaxi: [-78.436, -0.677], tungurahua: [-78.442, -1.467],
    colima: [-103.617, 19.514], 'el chichon': [-93.23, 17.36],
    nyiragongo: [29.25, -1.52], nyamulagira: [29.2, -1.408],
    'erte ale': [40.67, 13.6], 'hayli gubbi': [40.72, 13.51],
    'piton de la fournaise': [55.713, -21.244], teide: [-16.641, 28.272],
    vesuvius: [14.426, 40.821], vulcano: [14.962, 38.404],
    unzen: [130.294, 32.761], asosan: [131.104, 32.884], aso: [131.104, 32.884],
    ontake: [137.48, 35.893], fuji: [138.731, 35.361],
    shyveluch: [161.36, 56.653], klyuchevskoy: [160.638, 56.056],
    karymsky: [159.443, 54.049], avachinsky: [158.83, 53.256],
    shishaldin: [-163.97, 54.756], pavlof: [-161.894, 55.418],
    cleveland: [-169.945, 52.825], makushin: [-166.93, 53.89],
    'ahyi seamount': [145.03, 20.42], kupreanof: [-132.83, 56.96],
    katmai: [-154.963, 58.28], 'spurr': [-152.251, 61.299],
    'redoubt': [-152.743, 60.485], augustine: [-153.435, 59.363],
    'home reef': [-175.52, -18.99], hunga: [-175.39, -20.57],
    yasur: [169.447, -19.532], ambrym: [168.12, -16.25],
    manam: [145.037, -4.08], bagana: [155.197, -6.137],
    ulawun: [151.33, -5.05], rabaul: [152.203, -4.271],
    taall: [120.993, 14.002], taal: [120.993, 14.002],
    pinatubo: [120.35, 15.13], 'bulkang bulusan': [124.05, 12.77],
    bulusan: [124.05, 12.77], 'canlaon': [123.13, 10.41],
    semeru: [112.92, -8.108], raung: [114.042, -8.125],
    kelud: [112.308, -7.93], 'sinabung': [98.392, 3.17],
    'sangeang api': [119.07, -8.2], 'ili lewotolok': [123.508, -8.274],
    'lewotobi laki-laki': [122.775, -8.542]
  };

  function paisPT(nome) {
    if (!nome) return '';
    const k = String(nome).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return PAISES_PT[k] || PAISES_PT[k.replace(/^the /, '')] || String(nome).trim();
  }

  function corPT(v, upper) {
    const s = String(v || '').trim().toLowerCase();
    const t = COR_PT[s] || s;
    if (!t) return '';
    return upper ? t.toUpperCase() : t;
  }

  function nivelPT(v) {
    if (v == null || v === '') return v;
    const raw = String(v).trim();
    const key = raw.toUpperCase();
    if (NIVEL_PT[key]) return NIVEL_PT[key];
    const c = corPT(raw, true);
    return c || raw;
  }

  function obsPT(v) {
    if (!v) return v;
    const k = String(v).trim().toLowerCase();
    return OBS_PT[k] || v;
  }

  function coordsVulcao(nome) {
    if (!nome) return null;
    const k = String(nome).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\[.*?\]/g, ' ').replace(/volcano/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
    if (VOLCANO_COORDS[k]) return VOLCANO_COORDS[k];
    for (const [key, xy] of Object.entries(VOLCANO_COORDS)) {
      if (k.includes(key) || key.includes(k)) return xy;
    }
    return null;
  }

  const FRASES = [
    [/no eruptive activity at surface but significant volcanic unrest/gi, 'sem atividade eruptiva na superfície, mas com perturbação vulcânica significativa'],
    [/precursory low-level eruptive activity before episode\s+(\d+)\s+of the ongoing\s+(.+?)\s+eruption began around\s+(.+?)\s+on\s+(.+?)\./gi,
      'Atividade eruptiva precursora de baixo nível antes do episódio $1 da erupção em andamento de $2 começou por volta de $3 em $4.'],
    [/slow eruption of lava within the summit crater continues, accompanied by weak seismicity/gi,
      'A erupção lenta de lava na cratera do cume continua, acompanhada de sismicidade fraca'],
    [/frequent explosions and ash emissions continue/gi, 'explosões frequentes e emissões de cinzas continuam'],
    [/activity remains at comparably low levels/gi, 'a atividade permanece em níveis relativamente baixos'],
    [/lava fountaining at halemaʻ?umaʻ?u/gi, 'fontes de lava em Halemaʻumaʻu'],
    [/low-level eruptive activity/gi, 'atividade eruptiva de baixo nível'],
    [/precursory low-level eruptive activity/gi, 'atividade eruptiva precursora de baixo nível'],
    [/summit crater continues/gi, 'o crater do cume continua'],
    [/accompanied by weak seismicity/gi, 'acompanhada de sismicidade fraca'],
    [/weak seismicity/gi, 'sismicidade fraca'],
    [/lava within the summit crater/gi, 'lava no crater do cume'],
    [/slow eruption of lava/gi, 'erupção lenta de lava'],
    [/remains at alert level/gi, 'permanece no nível de alerta'],
    [/after brief ash emission/gi, 'após breve emissão de cinzas'],
    [/new vents in /gi, 'novas bocas eruptivas em '],
    [/indicate possible change in eruption/gi, 'indicam possível mudança na erupção'],
    [/possible change in eruption/gi, 'possível mudança na erupção'],
    [/eruption continues/gi, 'a erupção continua'],
    [/eruption ongoing/gi, 'erupção em andamento'],
    [/ongoing eruption/gi, 'erupção em andamento'],
    [/continuing activity/gi, 'atividade contínua'],
    [/continued activity/gi, 'atividade contínua'],
    [/significant volcanic unrest/gi, 'perturbação vulcânica significativa'],
    [/volcanic unrest/gi, 'perturbação vulcânica'],
    [/volcanic activity/gi, 'atividade vulcânica'],
    [/eruptive activity/gi, 'atividade eruptiva'],
    [/ash emissions/gi, 'emissões de cinzas'],
    [/ash emission/gi, 'emissão de cinzas'],
    [/ash plume/gi, 'pluma de cinzas'],
    [/ash cloud/gi, 'nuvem de cinzas'],
    [/volcanic ash advisory/gi, 'aviso de cinzas vulcânicas'],
    [/volcanic ash/gi, 'cinzas vulcânicas'],
    [/aviation color code/gi, 'código de cores da aviação'],
    [/color code/gi, 'código de cor'],
    [/alert level/gi, 'nível de alerta'],
    [/ground based/gi, 'observação em solo'],
    [/satellite imagery/gi, 'imagem de satélite'],
    [/not identifiable/gi, 'não identificável'],
    [/status of the usgs volcano hazards program/gi, 'status do Programa de Riscos Vulcânicos do USGS'],
    [/usgs volcano hazards program/gi, 'Programa de Riscos Vulcânicos do USGS'],
    [/hawaiian volcano observatory/gi, 'Observatório Vulcanológico do Havaí'],
    [/alaska volcano observatory/gi, 'Observatório Vulcanológico do Alasca'],
    [/elevated unrest/gi, 'perturbação elevada'],
    [/steam and gas/gi, 'vapor e gás'],
    [/lava flow/gi, 'fluxo de lava'],
    [/lava lake/gi, 'lago de lava'],
    [/summit crater/gi, 'crater do cume'],
    [/low-level/gi, 'de baixo nível'],
    [/began around/gi, 'começou por volta de'],
    [/last update/gi, 'última atualização'],
    [/last reported/gi, 'último relatório'],
    [/last observed/gi, 'última observação']
  ];

  const PALAVRAS = [
    [/eruptions/gi, 'erupções'], [/eruption/gi, 'erupção'], [/eruptive/gi, 'eruptivo'],
    [/explosions/gi, 'explosões'], [/explosion/gi, 'explosão'],
    [/emissions/gi, 'emissões'], [/emission/gi, 'emissão'],
    [/seismicity/gi, 'sismicidade'], [/seismic/gi, 'sísmico'],
    [/volcanoes/gi, 'vulcões'], [/volcano/gi, 'vulcão'], [/volcanic/gi, 'vulcânico'],
    [/observatory/gi, 'observatório'], [/unrest/gi, 'perturbação'],
    [/elevated/gi, 'elevado'], [/ongoing/gi, 'em andamento'],
    [/detected/gi, 'detectada'], [/reported/gi, 'relatada'],
    [/observed/gi, 'observada'], [/continues/gi, 'continua'], [/continue/gi, 'continuam'],
    [/possible/gi, 'possível'], [/significant/gi, 'significativa'],
    [/frequent/gi, 'frequentes'], [/brief/gi, 'breve'],
    [/activity/gi, 'atividade'], [/surface/gi, 'superfície'],
    [/warning/gi, 'aviso'], [/advisory/gi, 'aviso'], [/watch/gi, 'vigilância'],
    [/alert/gi, 'alerta'], [/aviation/gi, 'aviação'],
    [/ash\b/gi, 'cinzas'], [/lava\b/gi, 'lava'], [/plume/gi, 'pluma'],
    [/crater/gi, 'cratera'], [/summit/gi, 'cume'],
    [/episode/gi, 'episódio'], [/precursory/gi, 'precursora'],
    [/weak/gi, 'fraca'], [/strong/gi, 'forte'], [/moderate/gi, 'moderada'],
    [/normal/gi, 'normal'], [/orange/gi, 'laranja'], [/yellow/gi, 'amarelo'],
    [/green/gi, 'verde'], [/red\b/gi, 'vermelho'],
    [/floods/gi, 'enchentes'], [/flood/gi, 'enchente'],
    [/deaths/gi, 'mortes'], [/death/gi, 'morte'],
    [/displaced/gi, 'deslocados'], [/started/gi, 'começou'],
    [/lasting until/gi, 'durando até'], [/caused/gi, 'causou'],
    [/around/gi, 'por volta de'], [/before/gi, 'antes de'],
    [/within/gi, 'dentro de'], [/accompanied by/gi, 'acompanhada de'],
    [/levels/gi, 'níveis'], [/level/gi, 'nível']
  ];

  function traduzirDataEN(s) {
    return String(s).replace(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})/gi,
      (_, m, d, y) => `${d} de ${MESES_PT[m.toLowerCase()] || m} de ${y}`
    ).replace(/\b(\d{1,2}):(\d{2})\s*p\.m\./gi, '$1h$2')
     .replace(/\b(\d{1,2}):(\d{2})\s*a\.m\./gi, '$1h$2');
  }

  function traduzirVaac(s) {
    let t = String(s || '');
    t = t.replace(/\bVA TO FL(\d+)/gi, 'cinzas vulcânicas até FL$1');
    t = t.replace(/\bOVER FL(\d+)/gi, 'acima de FL$1');
    t = t.replace(/\bLAST REP(?:ORTED)? AT\b/gi, 'último relatório em');
    t = t.replace(/\bLAST OBS(?:ERVED)? AT\b/gi, 'última observação em');
    t = t.replace(/\bOBS AT\b/gi, 'observado em');
    t = t.replace(/\bREP AT\b/gi, 'relatado em');
    t = t.replace(/\bMOV\b/gi, 'movimento');
    t = t.replace(/\bEXT\b/gi, 'extensão');
    t = t.replace(/\bSTNR\b/gi, 'estacionário');
    t = t.replace(/\bERUPTED AT\b/gi, 'erupcionou em');
    t = t.replace(/\bERUPTION AT\b/gi, 'erupção em');
    t = t.replace(/\bWEAK ASH EMISSION\b/gi, 'emissão fraca de cinzas');
    t = t.replace(/\bOCNL VA EMS\.?/gi, 'emissões ocasionais de cinzas');
    t = t.replace(/\bPSBL CONTG VA EMS\.?/gi, 'possíveis emissões contínuas de cinzas');
    t = t.replace(/\bNO VA EMS OBSD\b/gi, 'nenhuma emissão de cinzas observada');
    t = t.replace(/\bVONA RPT OF VA EM\.?/gi, 'VONA relata emissão de cinzas');
    t = t.replace(/\bVA EM OBS IN SAT\.?/gi, 'emissão de cinzas observada por satélite');
    t = t.replace(/\bVA IS NOT IDENTIFIABLE IN SATELLITE IMAGERY\.?/gi, 'cinzas não identificáveis em imagem de satélite');
    t = t.replace(/\bVA ADVISORY\b/gi, 'aviso de cinzas vulcânicas');
    t = t.replace(/\bVA EM(?:ISSION)?S?\b/gi, 'emissões de cinzas');
    t = t.replace(/\bVA\b/g, 'cinzas vulcânicas');
    return t;
  }

  function traduzirEnchenteGDACS(s) {
    if (!s) return s;
    let t = String(s);
    t = t.replace(/^(Green|Orange|Red|Yellow)\s+flood alert in\s+(.+)$/i, (_, cor, pais) =>
      `Alerta ${corPT(cor)} de enchente em ${paisPT(pais)}`);
    t = t.replace(
      /On\s+(\d{2}\/\d{2}\/\d{4}),\s+a flood started in\s+([^,]+),\s+lasting until\s+(\d{2}\/\d{2}\/\d{4})\s*\((?:last update|última atualização)\)\.\s*The flood caused\s+(\d+)\s+deaths?\s+and\s+(\d+)\s+displaced\s*\.?/gi,
      (_, ini, pais, fim, mortes, desp) => {
        const m = Number(mortes), d = Number(desp);
        const mortesTxt = m === 1 ? '1 morte' : `${m} mortes`;
        const despTxt = d === 0 ? 'nenhum deslocado' : (d === 1 ? '1 deslocado' : `${d} deslocados`);
        return `Em ${ini}, uma enchente começou em ${paisPT(pais)} e durou até ${fim} (última atualização). A enchente causou ${mortesTxt} e ${despTxt}.`;
      }
    );
    return t;
  }

  function traduzirTextoVulcanico(valor) {
    if (valor == null || valor === '') return valor;
    let s = traduzirDataEN(String(valor));
    s = traduzirEnchenteGDACS(s);
    s = traduzirVaac(s);
    for (const [re, to] of FRASES) s = s.replace(re, to);
    s = s.replace(/\bORANGE\/WATCH\b/gi, 'LARANJA/VIGILÂNCIA');
    s = s.replace(/\bYELLOW\/ADVISORY\b/gi, 'AMARELO/ATENÇÃO');
    s = s.replace(/\bRED\/WARNING\b/gi, 'VERMELHO/AVISO');
    s = s.replace(/\bGREEN\/NORMAL\b/gi, 'VERDE/NORMAL');
    s = s.replace(/\bORANGE\b/g, 'LARANJA');
    s = s.replace(/\bYELLOW\b/g, 'AMARELO');
    s = s.replace(/\bWATCH\b/g, 'VIGILÂNCIA');
    s = s.replace(/\bWARNING\b/g, 'AVISO');
    s = s.replace(/\bADVISORY\b/g, 'ATENÇÃO');
    for (const [re, to] of PALAVRAS) s = s.replace(re, to);
    s = s.replace(/nível de alerta nível/gi, 'nível de alerta');
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
  }

  function traduzirStatusVulcao(v) {
    return nivelPT(v) || traduzirTextoVulcanico(v);
  }

  function traduzirTextoEnchente(valor) {
    if (valor == null || valor === '') return valor;
    let s = traduzirEnchenteGDACS(String(valor));
    s = s.replace(/\bAlerta\s+(Green|Orange|Red|Yellow)\b/gi, (_, c) => `Alerta ${corPT(c)}`);
    s = s.replace(/\b(Green|Orange|Red|Yellow)\b/g, (c) => corPT(c));
    return traduzirTextoVulcanico(s);
  }

  function prepararTextoVulcao(item) {
    if (!item || item.type !== 'volcano') return item;
    const fields = ['place', 'detail', 'eruptionStatus', 'vulcanicActivity', 'activityStatus',
      'ashStatus', 'ashHeight', 'vonaRemarks', 'vonaMovement', 'vonaDuration', 'lastActivity'];
    fields.forEach((k) => {
      if (item[k] != null && item[k] !== '') {
        item[k] = (k === 'eruptionStatus') ? traduzirStatusVulcao(item[k]) : traduzirTextoVulcanico(item[k]);
      }
    });
    if (item.usgsAlertLevel) item.usgsAlertLevel = traduzirStatusVulcao(item.usgsAlertLevel);
    if (item.observatory) item.observatory = obsPT(item.observatory);
    if (item.aviationColor) item.aviationColorLabel = corPT(item.aviationColor, true);
    return item;
  }

  function prepararTextoEnchente(item) {
    if (!item || item.type !== 'flood') return item;
    if (item.place) item.place = paisPT(item.place) || traduzirTextoEnchente(item.place);
    if (item.detail) item.detail = traduzirTextoEnchente(item.detail);
    if (item.gdacsAlertLevel) item.gdacsAlertLevelPt = corPT(item.gdacsAlertLevel, true);
    return item;
  }

  window.traduzirTextoVulcanico = traduzirTextoVulcanico;
  window.traduzirStatusVulcao = traduzirStatusVulcao;
  window.traduzirTextoEnchente = traduzirTextoEnchente;
  window.prepararTextoVulcao = prepararTextoVulcao;
  window.prepararTextoEnchente = prepararTextoEnchente;
  window.mgPaisPT = paisPT;
  window.mgCorPT = corPT;
  window.mgNivelPT = nivelPT;
  window.mgObsPT = obsPT;
  window.mgCoordsVulcao = coordsVulcao;
})();
