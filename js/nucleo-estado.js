// === nucleo-estado.js — Estado global, EventStore/SourceHealth, upsertAlert, agendamento de buscas, fetchWithCorsFallback (linhas originais 1-762 do core-app.js) ===

/* ══════════════════════════════════════════════════════════════════════════
   ★ MONITOR GLOBAL — Central de Desastres
   PARTE 1: estrutura + CSS + áudio + constantes base
   ══════════════════════════════════════════════════════════════════════════ */

// q()/safeText() eram definidas só lá na PARTE 3 (mais pra frente no arquivo), mas
// já eram chamadas aqui na PARTE 1 (ex.: callback de erro do geolocation). Se essa
// callback assíncrona disparasse antes do <script> da PARTE 3 terminar de rodar
// (ex.: permissão de localização já negada antes, callback volta quase na hora),
// dava "ReferenceError: safeText is not defined". Redeclarando aqui, cedo — a
// versão lá na frente (idêntica) só sobrescreve sem problema nenhum.
function q(id){return document.getElementById(id)}
function safeText(id,v){const e=q(id);if(e)e.textContent=v==null?'--':v}

// Base do mapa: Esri World Imagery (satélite) + Esri World Boundaries and
// Places (fronteiras/nomes de países, estados e cidades — camada oficial da
// Esri pensada pra ficar por cima de imagery). Ruas continuam via OpenFreeMap.
const GL = maplibregl;

const EVENTO_TELA_X = 0.5, EVENTO_TELA_Y = 0.45, ZOOM_MAX = 21;
const SOM_SISMO_MIN = 3.0, VOZ_SISMO_MIN = 6.0;
/* ── CONFIG RÁPIDA ─────────────────────────────────────────── */
const APP_VERSION = '7.2.0';
const APP_BUILD = '2026-09-07T23:30-03';
const FLOOD_RAIN_1H_MOD = 8;
const FLOOD_RAIN_1H_HIGH = 20;
const FLOOD_RAIN_24H_HIGH = 50;
const CRISIS_QUAKE_MAG = 6.0;
const CRISIS_QUAKE_KM = 1500;
const DEDUPE_KM = 80;
const DEDUPE_MS = 6 * 3600000;
// Cruzamento entre catálogos sísmicos: raio maior (a localização do epicentro
// diverge bastante entre agências) pra que USGS/EMSC/GFZ/JMA/IGP encontrem o
// mesmo evento. Janela de TEMPO reduzida de 15 pra 5 minutos (era larga
// demais): 5 minutos ainda cobre uma agência publicando alguns minutos depois
// da outra, mas sem juntar sismos DIFERENTES de um enxame de verdade (Porto
// Rico/Guánica chega a ter vários M1-M3 na mesma área em poucos minutos —
// com 15min esses viravam "um evento só" com dezenas de magnitudes na lista).
const SISMO_DEDUPE_RAIO_KM = 80;
const SISMO_DEDUPE_TOL_MS = 5 * 60 * 1000;
// "Novo" (badge pulsando + som + voo de câmera) só faz sentido pra um sismo que
// de fato ACABOU de acontecer. Uma rede regional pode publicar um sismo pequeno
// só horas depois de ele ter ocorrido de verdade (revisão humana, sincronização
// atrasada) — nesse caso é a primeira vez que esta sessão vê o id, mas o evento
// não é recente, então não deve disparar o mesmo alarme de "aconteceu agora".
const SISMO_NOVO_RECENTE_MS = 30 * 60 * 1000;
// Diferença considerada relevante entre magnitudes publicadas para o mesmo evento.
const SISMO_MAG_DIVERGENCIA_TOL = 0.4;
const SISMO_MAG_DIVERGENCIA_FORTE = 0.8;
const VOZ_HIST_MAX = 8;
let vozHistorico = [];
let lastFetchTimes = {};
let floodRiskState = { level: 'baixo', score: 0, reason: 'Aguardando dados de chuva.' };
/* crisisAutoLatched removido */

const VOO_ALERTA_DUR = 9000, VOO_MANUAL_DUR = 6000, VOO_VOLTA_DUR = 7000;
const SP_LAT = -23.55, SP_LNG = -46.63;

let globalEvents = [], globalAlerts = [];
// Espelha no window para scripts em IIFE (ex.: story-share) sempre enxergarem a lista.
try { window.globalEvents = globalEvents; window.globalAlerts = globalAlerts; } catch (_) {}
let knownEventIds = new Set(), knownAlertIds = new Set(), activeAlertingIds = new Map(), activeUpdatedIds = new Map();
// Sismo novo-pra-esta-sessão mas com origem antiga (fora da janela de
// SISMO_NOVO_RECENTE_MS) — selo discreto "ADICIONADO AGORA", sem som/voo de câmera.
let activeLateIds = new Map();
// Uma revisão precisa ficar visível no topo por tempo suficiente para o usuário
// perceber qual registro mudou. Depois desse prazo, o item volta automaticamente
// para sua posição cronológica original (sem alterar item.time).
const ATUALIZADO_EXPIRA_MS = 10 * 60 * 1000; // 10 minutos
const updatedReturnTimers = new Map();
let currentIndex = -1, isFirstLoad = true, minMagnitude = 0.1;

/* ═══ EventStore — fonte única de verdade (lista / mapa / card / Story) ═══
   Antes cada painel lia globalEvents, globalAlerts ou lastMerged por conta
   própria. Se um sismo era revisado (M5.2→M5.4), o card e o Story podiam
   ficar com a 1ª versão. O store centraliza:
     - selectedId
     - getById / getSelected (sempre a cópia mais recente)
     - notify + subscribe
     - refreshSelectedPanel (silencioso, sem fly/som)
   As variáveis globais continuam existindo pra não quebrar o resto do app.
*/
const EventStore = (function () {
  const listeners = new Set();
  let selectedId = null;
  let _refreshScheduled = false;

  function getById(id) {
    if (id == null) return null;
    try {
      if (Array.isArray(globalEvents)) {
        const e = globalEvents.find(x => x && x.id === id);
        if (e) return e;
      }
      if (Array.isArray(globalAlerts)) {
        const a = globalAlerts.find(x => x && x.id === id);
        if (a) return a;
      }
      if (typeof lastMerged !== 'undefined' && Array.isArray(lastMerged)) {
        const m = lastMerged.find(x => x && x.id === id);
        if (m) return m;
      }
    } catch (e) {}
    return null;
  }

  function getSelected() {
    return getById(selectedId);
  }

  function setSelected(id) {
    selectedId = id != null ? id : null;
    try { eventoSelecionadoId = selectedId; } catch (e) {}
    notify('select', { id: selectedId });
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify(reason, payload) {
    listeners.forEach(fn => {
      try { fn(reason, payload || {}); } catch (e) { console.warn('[EventStore] listener:', e); }
    });
  }

  /** Atualiza o card principal se o evento aberto foi revisado — sem fly, sem som. */
  function refreshSelectedPanel() {
    if (selectedId == null) return;
    if (_refreshScheduled) return;
    _refreshScheduled = true;
    queueAnimationFrame(() => {
      _refreshScheduled = false;
      try {
        const item = getById(selectedId);
        if (!item) return;
        if (item.type === 'earthquake' || (item.mag != null && !item.type)) {
          const idx = Array.isArray(globalEvents) ? globalEvents.findIndex(e => e && e.id === selectedId) : -1;
          if (idx >= 0 && typeof showEventDetails === 'function') {
            showEventDetails(idx, false, true);
          }
        } else if (typeof showAlertDetails === 'function') {
          showAlertDetails(item, false, true);
        }
      } catch (e) { console.warn('[EventStore] refreshSelectedPanel:', e); }
    });
  }

  /** Chamado após merge/upsert quando ids foram revisados. */
  function onDataRevised(ids) {
    const list = Array.isArray(ids) ? ids : (ids != null ? [ids] : []);
    notify('revise', { ids: list });
    if (selectedId != null && list.some(id => id === selectedId)) {
      refreshSelectedPanel();
    }
  }

  function onDataReplaced(kind) {
    notify('replace', { kind: kind || 'all' });
    // Se o selecionado ainda existe, garante card com dados novos
    if (selectedId != null && getById(selectedId)) {
      // só refresca se o objeto mudou de referência/conteúdo relevante —
      // o caller de sismos já passa onDataRevised quando há delta.
    }
  }

  // Espelha selectedId ↔ eventoSelecionadoId (código legado escreve os dois)
  function syncFromLegacy() {
    try {
      if (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId !== selectedId) {
        selectedId = eventoSelecionadoId;
      }
    } catch (e) {}
  }

  return {
    getById, getSelected, setSelected, subscribe, notify,
    refreshSelectedPanel, onDataRevised, onDataReplaced, syncFromLegacy,
    get selectedId() { return selectedId; }
  };
})();
try { window.EventStore = EventStore; } catch (e) {}

/* ═══ SourceHealth — estabilidade de fontes + circuit breaker ═══
   Problema: fonte pública instável gerava OFF/toast a cada ciclo.
   Agora: falhas consecutivas abrem cooldown; sucesso zera contador;
   idade do último OK alimenta o banner de frescura; cache grava resumo.
*/
const SourceHealth = (function () {
  const state = new Map();
  const COOLDOWN_MS = 90000;
  const OPEN_AFTER = 3;
  const FAIL_TO_OFF = 2;

  function get(name) {
    if (!state.has(name)) {
      state.set(name, {
        fails: 0, openUntil: 0, lastOk: 0, lastErr: '', lastMs: 0, status: 'unknown',
        // Histórico leve desta sessão (não persiste em snapshot/reload) — alimenta
        // a narrativa de estabilidade do painel "Status por fonte" (ux-panel.js).
        okCount: 0, failCount: 0, failTimes: [], firstSeenAt: Date.now()
      });
    }
    return state.get(name);
  }
  function isOpen(name) { return get(name).openUntil > Date.now(); }
  function remainingMs(name) { return Math.max(0, get(name).openUntil - Date.now()); }
  function recordOk(name, ms) {
    const s = get(name);
    s.fails = 0; s.openUntil = 0; s.lastOk = Date.now();
    s.lastMs = Number(ms) || 0; s.lastErr = ''; s.status = 'ok';
    s.okCount = (s.okCount || 0) + 1;
  }
  function recordFail(name, error, ms) {
    const s = get(name);
    s.fails = (s.fails || 0) + 1;
    s.lastErr = String(error || 'falha');
    s.lastMs = Number(ms) || s.lastMs || 0;
    s.failCount = (s.failCount || 0) + 1;
    if (!Array.isArray(s.failTimes)) s.failTimes = [];
    s.failTimes.push(Date.now());
    if (s.failTimes.length > 20) s.failTimes.shift();
    if (s.fails >= OPEN_AFTER) { s.openUntil = Date.now() + COOLDOWN_MS; s.status = 'off'; }
    else if (s.fails >= FAIL_TO_OFF) s.status = 'off';
    else s.status = 'warn';
    return s;
  }
  function summary() {
    let ok = 0, warn = 0, off = 0, cooling = 0;
    const offNames = [];
    state.forEach((s, name) => {
      if (s.openUntil > Date.now()) { cooling++; off++; offNames.push(name); }
      else if (s.status === 'ok') ok++;
      else if (s.status === 'warn') warn++;
      else if (s.status === 'off') { off++; offNames.push(name); }
    });
    return { ok, warn, off, cooling, offNames, total: state.size };
  }
  function snapshot() {
    const obj = {};
    state.forEach((s, name) => {
      obj[name] = { status: s.status, fails: s.fails, lastOk: s.lastOk, lastErr: s.lastErr, openUntil: 0 };
    });
    return obj;
  }
  function restoreSnapshot(obj) {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(name => {
      const x = obj[name] || {}, s = get(name);
      s.status = x.status || s.status;
      s.fails = Number(x.fails) || 0;
      s.lastOk = Number(x.lastOk) || 0;
      s.lastErr = x.lastErr || '';
      s.openUntil = 0;
    });
  }
  return { get, isOpen, remainingMs, recordOk, recordFail, summary, snapshot, restoreSnapshot };
})();
try { window.SourceHealth = SourceHealth; } catch (e) {}
let map = null, alertTimeout = null, cycleTimeout = null, currentRadar = null, currentCascade = null;
let audioContext = null, isAudioUnlocked = false, vozesDisponiveis = [], speakAlertTimeoutId = null;
let pendingSounds = [];
let somAtivo = localStorage.getItem('somAtivo') !== '0';
let somVolume = Math.min(1, Math.max(0, parseInt(localStorage.getItem('somVolume') || '70', 10) / 100));
let somMutedTypes = new Set(JSON.parse(localStorage.getItem('somMutedTypes') || '[]'));
let proximoSomLivre = 0;
let filaSonsPendentes = [];
let processandoFilaSom = false;
let sismosSonorizados = new Set();
const GAP_ENTRE_SONS_MS = 900, BACKLOG_SOM_MAX_MS = 12000;
/* Espaça alertas sonoros no mínimo GAP_ENTRE_SONS_MS um do outro — evita que uma
   rajada de eventos diferentes (ex: 3 enchentes + 2 tempestades no mesmo ciclo)
   dispare vários sons ao mesmo tempo, virando uma bagunça sonora. Se o atraso
   acumulado passar de BACKLOG_SOM_MAX_MS, descarta o som (melhor pular um alerta
   sonoro atrasado do que tocar uma fila enorme fora de hora). */
function agendarSom(fn) {
    filaSonsPendentes.push(fn);
    if (filaSonsPendentes.length > 12) filaSonsPendentes = filaSonsPendentes.slice(-12);
    processarFilaSons();
}
function processarFilaSons() {
    if (processandoFilaSom || !filaSonsPendentes.length) return;
    if (!somAtivo) { filaSonsPendentes.length = 0; return; }
    processandoFilaSom = true;
    const fn = filaSonsPendentes.shift();
    const atraso = Math.max(0, proximoSomLivre - Date.now());
    setTimeout(() => {
        try { fn(); } catch (e) { console.warn('[audio] falha ao tocar alerta:', e); }
        proximoSomLivre = Date.now() + GAP_ENTRE_SONS_MS;
        processandoFilaSom = false;
        processarFilaSons();
    }, atraso);
}
let sidebarFilter = 'all', soImportantes = false, soCriticos = false, eventoSelecionadoId = null, minhaPosicao = null;
/* ═══════════════════════════════════════════════════════════════
   CONFIGURAÇÕES QUE VOCÊ PODE MEXER COM SEGURANÇA
   - weatherLoc: cidade padrão do clima (lat/lng/nome)
   - geoFilter / minMagnitude: filtros de eventos
   - agendarBusca(...): intervalos de atualização no boot()
   - dicionarioBandeiras: emoji de bandeira por nome de país
   - PAISES_COSTEIROS / CIDADES_MUNDO: geolocalização de bandeira
   ═══════════════════════════════════════════════════════════════ */
/* Filtro geográfico: 'all' | 'br' | '500' | '100' — persiste no localStorage */
let geoFilter = (function(){ try { return localStorage.getItem('monitor_geo_filter') || 'all'; } catch(e){ return 'all'; } })();
try { soCriticos = localStorage.getItem('monitor_so_criticos') === '1'; } catch(e) {}
// A lista de registros é sempre cronológica. A antiga opção "Sev." podia
// deixar eventos de horas diferentes fora de ordem e também ficava persistida no aparelho.
try { localStorage.removeItem('monitor_sort_sev'); } catch(e) {}
const sortBySeverity = false; // mantido só por compatibilidade; nunca altera a ordem da lista.

/* Pop-up de registros no celular: abre/fecha a lista de eventos como uma folha
   em tela cheia (retrato ou paisagem), em vez de deixá-la espremida no grid. */
function toggleMobileEventsModal(open) {
    document.body.classList.toggle('mobile-events-open', open);
}
function alternarPainelDetalhesMobile() {
    // Toque na caixa avança um estágio: fechada→meio→completa. Na completa,
    // toque não faz nada (evita fechar sem querer enquanto rola o conteúdo);
    // pra fechar, usa o ✕.
    if (window.innerWidth > 900) return; // desktop = painel sempre visível
    const b = document.body.classList;
    if (b.contains('mobile-details-open')) return;
    if (b.contains('mobile-details-mid')) {
        b.remove('mobile-details-mid');
        b.add('mobile-details-open');
    } else {
        b.add('mobile-details-mid');
    }
}
function abrirPainelDetalhesMobile() {
    // Ao selecionar um evento novo, abre direto no estágio "meio"
    // (magnitude + profundidade/intensidade/energia) — o resto (dinâmica da
    // falha, impacto, cidades, histórico) só aparece se a pessoa tocar de novo.
    if (window.innerWidth > 900) return;
    document.body.classList.remove('mobile-details-open');
    document.body.classList.add('mobile-details-mid');
}
function fecharPainelDetalhesMobile() {
    document.body.classList.remove('mobile-details-open', 'mobile-details-mid');
}
function alternarCaixaRegistrosMobile() {
    // Só a faixa recolhida (peek) deve reagir ao toque pra abrir;
    // quando já está expandida, o toque nela não faz nada (evita
    // fechar sem querer enquanto rola a lista) — use o ✕ pra fechar.
    if (!document.body.classList.contains('mobile-events-open')) {
        toggleMobileEventsModal(true);
    }
}
function closeMobileEventsModalIfOpen() {
    if (document.body.classList.contains('mobile-events-open')) {
        setTimeout(() => toggleMobileEventsModal(false), 150);
    }
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleMobileEventsModal(false);
});

/* Menu "⋯" da faixa de topo (celular): abre/fecha e some ao tocar fora dele. */
function toggleMoreMenu(force) {
    const m = document.getElementById('ts-more-menu');
    if (!m) return;
    if (typeof force === 'boolean') m.classList.toggle('open', force);
    else m.classList.toggle('open');
}
document.addEventListener('click', (e) => {
    const wrap = document.getElementById('ts-more-wrap');
    const menu = document.getElementById('ts-more-menu');
    if (wrap && menu && menu.classList.contains('open') && !wrap.contains(e.target)) {
        toggleMoreMenu(false);
    }
    if (menu && menu.classList.contains('open') && e.target.closest('.ts-more-menu .icon-btn')) {
        setTimeout(() => toggleMoreMenu(false), 120);
    }
});

/* No celular, ao selecionar um evento, rola até o painel de detalhes — ele já
   fica logo abaixo do mapa, mas nem sempre visível sem rolar manualmente. */
function scrollToDetailsIfMobile() {
    if (window.innerWidth > 900) return;
    const pd = document.getElementById('painel-direito');
    if (pd) pd.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
let expandedIds = new Set(), lastMerged = [], lastListSig = '';
/* ═══ Controle centralizado de "primeira carga" por fonte de alerta ═══
   Cada fonte de alerta automático (INMET, GDACS, tsunami, tempestades locais etc.)
   só deve tocar som/voz para o que muda DEPOIS que ela já rodou pela 1ª vez —
   senão tudo que já estava ativo quando a página abre seria anunciado como "novo"
   (foi exatamente o bug corrigido no INMET). Antes cada fonte tinha sua própria
   variável solta (hurricBooted, wfGBooted...), fácil de esquecer numa fonte nova.
   Agora é uma função só: toda fonte ganha a proteção automaticamente. */
const fontesBooted = new Set();
function fonteBooted(nome) { return fontesBooted.has(nome); }
function marcarBooted(nome) { fontesBooted.add(nome); }
function isNovoPosBoot(nome, id) { return fonteBooted(nome) && !knownAlertIds.has(id); }

// upsertAlert(obj, opts): centraliza o padrão que se repetia em ~20 lugares
// do arquivo (uma função por fonte — INMET, GDACS, INPE, CGE, tsunami, vulcão
// etc.): verificar se o id é novo desde o boot da fonte, marcar em
// knownAlertIds, tirar a versão antiga do mesmo id de globalAlerts e inserir
// a nova, e — se for novo — registrar em activeAlertingIds pra acender o
// "novo" na lista/mapa. Antes cada fonte reimplementava essas mesmas 4-5
// linhas com pequenas variações (algumas erravam o expiraMs, outras
// esqueciam de marcar em knownAlertIds antes do filter).
//
// Quem chama continua responsável por:
//  - buscar a versão anterior ANTES de montar `obj`, se precisar preservar
//    campos como o `time` original: const prev = globalAlerts.find(a=>a.id===id)
//  - decidir se toca som/mostra popup quando o retorno for `true` (é novo) —
//    isso varia por fonte e continua no chamador.
// opts.skipRemove: true quando o chamador já limpou o grupo inteiro por
// prefixo antes do loop (ex.: focos de incêndio recalculados a cada ciclo) —
// evita um filter() redundante por item nesses casos.
// Descreve em poucas palavras o que mudou entre duas versões do mesmo alerta —
// é o texto que aparece junto do selo "ATUALIZADO" na lista. Prioriza o campo
// mais informativo pro tipo de alerta; se nada específico bater, cai no texto
// genérico do próprio alerta.
function descreverMudanca(prev, obj) {
    if (prev.aviationColor !== obj.aviationColor && obj.aviationColor) {
        return `Cor de aviação: ${prev.aviationColor || '—'} → ${obj.aviationColor}`;
    }
    if (prev.gdacsAlertLevel !== obj.gdacsAlertLevel && obj.gdacsAlertLevel) {
        return `Nível de alerta: ${prev.gdacsAlertLevel || '—'} → ${obj.gdacsAlertLevel}`;
    }
    if (prev.eruptionStatus !== obj.eruptionStatus && obj.eruptionStatus) {
        return `Status: ${obj.eruptionStatus}`;
    }
    if (prev.windKmh !== obj.windKmh && obj.windKmh != null) {
        return `Rajada: ${prev.windKmh ?? '—'} → ${obj.windKmh} km/h`;
    }
    if (prev.sev !== obj.sev && obj.sev != null) {
        return `Severidade: ${prev.sev ?? '—'} → ${obj.sev}`;
    }
    if (prev.mag !== obj.mag && obj.mag != null) {
        return `M${prev.mag ?? '—'} → M${obj.mag}`;
    }
    if (prev.detail !== obj.detail && obj.detail) {
        return obj.detail.slice(0, 70);
    }
    return 'Dado atualizado pela fonte';
}

function marcarAtualizadoNoTopo(id, deltaTxt = '', ttl = ATUALIZADO_EXPIRA_MS) {
    if (id == null) return;
    const agora = Date.now();
    const expira = agora + ttl;
    activeUpdatedIds.set(id, expira);

    // Cancela o temporizador anterior do mesmo evento, caso a fonte faça uma
    // segunda revisão antes dos 10 minutos. O novo prazo passa a valer.
    try {
        const oldTimer = updatedReturnTimers.get(id);
        if (oldTimer) clearTimeout(oldTimer);
    } catch (e) {}

    const timer = setTimeout(() => {
        // Só o timer correspondente à revisão atual pode devolver o card.
        if (activeUpdatedIds.get(id) !== expira) return;
        activeUpdatedIds.delete(id);
        updatedReturnTimers.delete(id);
        // Reordena a lista imediatamente: o evento volta à posição que sua
        // data/hora original determinava, sem esperar o próximo fetch.
        try { if (typeof applyFilters === 'function') applyFilters(); } catch (e) {}
    }, Math.max(1000, ttl));
    updatedReturnTimers.set(id, timer);

    // O timestamp separado da ocorrência é o que permite ordenar várias
    // atualizações recentes sem mexer no horário original do evento.
    try {
        const item = (globalEvents || []).find(x => x && x.id === id) || (globalAlerts || []).find(x => x && x.id === id);
        if (item) {
            item._updatedAt = agora;
            if (deltaTxt) item._deltaTxt = deltaTxt;
        }
    } catch (e) {}
}

// Era "atualizados sobem pro topo" — usuário reportou que isso confundia
// (o card principal já mostra a revisão; ver o mesmo registro pular lá em
// cima na lista, às vezes horas depois de ter ocorrido, parecia um evento
// novo que não era). Trocado pra "novos sobem pro topo": um registro recém-
// chegado (activeAlertingIds, já usado pro selo "NOVO") fica em destaque por
// alguns minutos e depois se encaixa sozinho no horário real de ocorrência —
// "atualizado" continua com seu próprio selo no card (activeUpdatedIds, não
// mexido aqui), só não reordena mais a lista; a informação da revisão agora
// vai pra pílula de atualização (ver showSismoAtualizadoPill).
function ordenarNovosNoTopo(items) {
    const arr = Array.isArray(items) ? items.slice() : [];
    const agora = Date.now();
    return arr
        .map((item, index) => ({ item, index, expira: activeAlertingIds.get(item && item.id) || 0 }))
        .sort((a, b) => {
            const an = a.expira > agora;
            const bn = b.expira > agora;
            if (an !== bn) return an ? -1 : 1;
            if (an && bn) {
                const at = Number(a.item && (a.item._novoAt || a.item._lastSeenAt)) || 0;
                const bt = Number(b.item && (b.item._novoAt || b.item._lastSeenAt)) || 0;
                if (bt !== at) return bt - at;
            }
            return a.index - b.index;
        })
        .map(x => x.item);
}

function upsertAlert(obj, opts = {}) {
    if (!obj || obj.id == null) return false;
    const { fonte, expiraMs = 180000, skipRemove = false } = opts;
    const id = obj.id;
    const prev = globalAlerts.find(a => a.id === id);
    const isNew = fonte ? isNovoPosBoot(fonte, id) : !knownAlertIds.has(id);
    knownAlertIds.add(id);
    // Carimbo de "visto pela última vez" — independente do `time`, que várias
    // fontes preservam como o horário original do evento (via prev.time), não
    // o do último recebimento. É esse carimbo que alimenta o aviso de dado
    // desatualizado na lista (Fase 3).
    obj._lastSeenAt = Date.now();
    if (!skipRemove) globalAlerts = globalAlerts.filter(a => a.id !== id);
    globalAlerts.push(obj);
    if (isNew) {
        activeAlertingIds.set(id, Date.now() + expiraMs);
        activeUpdatedIds.delete(id);
    } else if (prev && !activeAlertingIds.has(id)) {
        // "Atualizado" só quando algo que o usuário notaria realmente mudou —
        // não a cada vez que a fonte apenas reconfirma o mesmo dado no ciclo
        // seguinte (a maioria das fontes reenvia o alerta inteiro enquanto ele
        // segue ativo, mesmo sem nenhuma mudança real).
        const mudou = prev.detail !== obj.detail || prev.sev !== obj.sev ||
            prev.mag !== obj.mag || prev.eruptionStatus !== obj.eruptionStatus ||
            prev.gdacsAlertLevel !== obj.gdacsAlertLevel || prev.aviationColor !== obj.aviationColor ||
            prev.windKmh !== obj.windKmh;
        if (mudou) {
            obj._deltaTxt = descreverMudanca(prev, obj);
            obj._updatedAt = Date.now();
            marcarAtualizadoNoTopo(id, obj._deltaTxt, ATUALIZADO_EXPIRA_MS);
            try {
                if (typeof EventStore !== 'undefined') EventStore.onDataRevised([id]);
            } catch (e) {}
        } else if (activeUpdatedIds.has(id)) {
            // Ainda dentro da janela "atualizado" de uma mudança anterior — mantém
            // o texto do que mudou, não deixa sumir antes do selo em si sumir.
            obj._deltaTxt = prev._deltaTxt;
        }
    }
    return isNew;
}

/* ═══ Limpeza periódica de memória ═══
   knownEventIds, knownAlertIds e feedArrivalAt só cresciam — nada nunca era
   removido deles, mesmo depois que o evento/alerta original já tinha saído
   da lista de 24h há muito tempo. Numa aba deixada aberta por horas/dias isso
   ia acumulando memória à toa. A cada hora, reduzimos cada um só ao que ainda
   está de fato ativo agora. Pior caso de "esquecer" um ID demais cedo: se o
   mesmo evento reaparecer, ele é anunciado de novo como "novo" — o que nem
   chega a ser um problema de verdade (o normal seria ele não voltar mesmo). */
function limparIdsAntigos() {
    try {
        const idsEventosAtivos = new Set((globalEvents || []).map(e => e.id));
        knownEventIds.forEach(id => { if (!idsEventosAtivos.has(id)) knownEventIds.delete(id); });

        const idsAlertasAtivos = new Set((globalAlerts || []).map(a => a.id));
        knownAlertIds.forEach(id => { if (!idsAlertasAtivos.has(id)) knownAlertIds.delete(id); });

        // activeAlertingIds (badge NOVO) e activeUpdatedIds (badge ATUALIZADO) normalmente
        // se limpam sozinhos via setTimeout no momento do render — mas se o item sair de
        // globalEvents/globalAlerts antes desse timer disparar (ou o card nunca mais for
        // renderizado), a entrada fica presa no Map pra sempre.
        activeAlertingIds.forEach((_, id) => { if (!idsEventosAtivos.has(id) && !idsAlertasAtivos.has(id)) activeAlertingIds.delete(id); });
        activeUpdatedIds.forEach((_, id) => { if (!idsEventosAtivos.has(id) && !idsAlertasAtivos.has(id)) activeUpdatedIds.delete(id); });
        activeLateIds.forEach((_, id) => { if (!idsEventosAtivos.has(id) && !idsAlertasAtivos.has(id)) activeLateIds.delete(id); });

        feedArrivalAt.forEach((_, key) => { if (!feedPreviousKeys.has(key)) feedArrivalAt.delete(key); });
    } catch (e) { console.warn('[limpeza] falhou:', e && e.message); }
}
setInterval(limparIdsAntigos, 3600000); // a cada 1h — bem espaçado, não é urgente
let fcPopupTimeout = null;
const cycloneHistory = new Map();
// Persiste o histórico de posições dos ciclones (GDACS) entre recarregamentos da página —
// sem isso, toda vez que o app é reaberto o histórico zera e a seta de direção só aparece
// depois do próximo ciclo de atualização (até 2h de espera). Descarta pontos com mais de
// 12h (ciclone provavelmente já não existe mais ou os dados estão obsoletos).
try {
    const salvo = JSON.parse(localStorage.getItem('monitor_cyclone_hist') || '{}');
    const limite = Date.now() - 12 * 3600000;
    Object.entries(salvo).forEach(([id, hist]) => {
        if (Array.isArray(hist) && hist.length && hist[hist.length - 1].t > limite) {
            cycloneHistory.set(id, hist);
        }
    });
} catch (e) {}
function salvarCycloneHistory() {
    try {
        const obj = {};
        cycloneHistory.forEach((hist, id) => { obj[id] = hist; });
        localStorage.setItem('monitor_cyclone_hist', JSON.stringify(obj));
    } catch (e) {}
}
const layerVisibility = { earthquakes: true, fires: true, lightning: true, hurricanes: true, tornado: true, tsunami: true, civil: true, wind: true, flood: true, volcano: true };
const markerStores = { quake: new Map(), fire: new Map(), cyclone: new Map(), tsunami: new Map(), tornado: new Map(), storm: new Map(), civil: new Map(), wind: new Map(), flood: new Map(), volcano: new Map() };
const geoLabels = { country: [], state: [], city: [] };

/* Notificações do navegador */
let notificacoesAtivas = false;
function pedirPermissaoNotificacao() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') { notificacoesAtivas = true; return; }
    if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => { notificacoesAtivas = (p === 'granted'); });
    }
}
function notificarNavegador(titulo, corpo, tipo = 'info') {
    if (!notificacoesAtivas || document.hasFocus()) return;
    try {
        const n = new Notification(titulo, {
            body: corpo,
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌐</text></svg>',
            tag: 'monitor-global'
        });
        setTimeout(() => n.close(), 8000);
    } catch (e) {}
}

/* Na carga inicial, muitas funções de busca chamavam fetch() + setInterval() ao mesmo
   tempo — isso disparava umas 18 requisições de uma vez, todas competindo pelos mesmos
   proxies de CORS gratuitos (que têm limite de requisições por minuto), estourando a
   cota logo de cara. E como o setInterval sempre soma a partir do momento da primeira
   chamada, isso se repetia a cada ciclo. Aqui a primeira chamada é escalonada com um
   pequeno atraso — o que também desincroniza automaticamente as repetições seguintes. */
/* ── AGENDAMENTO DE BUSCAS ────────────────────────────────────
   Para mudar intervalos, edite as chamadas agendarBusca(...) no boot (final do arquivo).
   Pausado automaticamente quando a aba fica oculta (economiza bateria/dados). */
const __buscasAgendadas = []; // { fn, intervalId, intervaloMs, paused }
let __buscasPausadasPorAba = false;

function agendarBusca(fn, atrasoInicialMs, intervaloMs) {
    const entry = { fn, intervalId: null, intervaloMs, paused: false };
    __buscasAgendadas.push(entry);
    setTimeout(() => {
        if (!__buscasPausadasPorAba) {
            try { fn(); } catch (e) { console.warn('[busca]', e); }
        }
        entry.intervalId = setInterval(() => {
            if (__buscasPausadasPorAba || entry.paused) return;
            try { fn(); } catch (e) { console.warn('[busca]', e); }
        }, intervaloMs);
    }, atrasoInicialMs);
}

function pausarBuscas() {
    __buscasPausadasPorAba = true;
    console.log('[monitor] buscas pausadas (aba oculta)');
}
function retomarBuscas() {
    const jaEstavaPausado = __buscasPausadasPorAba;
    __buscasPausadasPorAba = false;
    if (jaEstavaPausado) console.log('[monitor] buscas retomadas (aba visível)');
    // 'focus', 'pageshow' e 'visibilitychange' costumam disparar juntos no
    // mesmo instante de "voltar" — sem isso, dispararíamos 2-3 buscas
    // idênticas de uma vez só.
    const agora = Date.now();
    if (window.__ultimoRetomarBuscas && agora - window.__ultimoRetomarBuscas < 4000) return;
    window.__ultimoRetomarBuscas = agora;
    // Dispara uma rodada imediata das fontes críticas ao voltar. Sismos é o
    // motivo do app existir, então ele SEMPRE dispara aqui, garantido — não
    // fica na dependência de estar entre "os 3 primeiros" registrados.
    try { if (typeof fetchGlobalFeeds === 'function') fetchGlobalFeeds(); } catch (err) {}
    __buscasAgendadas.slice(0, 3).forEach(e => {
        if (e.fn !== fetchGlobalFeeds) { try { e.fn(); } catch (err) {} }
    });
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) pausarBuscas();
    else retomarBuscas();
});
// Reforço pra celular: em algumas combinações de navegador/SO, a aba fica
// tocando em segundo plano por muito tempo (tela bloqueada, app trocado) e o
// 'visibilitychange' não dispara na volta com a confiabilidade que a gente
// gostaria — então escuta também 'focus' e 'pageshow' (esse último cobre o
// caso do navegador restaurar a página do cache em vez de recarregar).
window.addEventListener('focus', retomarBuscas);
window.addEventListener('pageshow', retomarBuscas);

// ── VIGIA DE ATUALIZAÇÃO (watchdog) ──────────────────────────────────────
// Rede de segurança independente do agendamento normal: a cada 1 min, se a
// aba estiver visível e os sismos não tiverem sido atualizados com sucesso
// há mais de 2 minutos (o ciclo normal é a cada 45s), força uma busca na
// marra. Isso cobre qualquer cenário em que o setInterval do agendamento
// principal tenha sido suspenso/matado pelo navegador sem avisar (comum em
// Android depois de muito tempo com a tela bloqueada), sem depender de um
// único mecanismo de "acordar".
setInterval(() => {
    try {
        if (document.hidden) return;
        const ultimoSucesso = window.__lastSismoSuccess || 0;
        const ultimaTentativa = window.__lastSismoAttempt || 0;
        const paradoHaMuito = (Date.now() - ultimoSucesso) > 120000;
        const semTentativaRecente = (Date.now() - ultimaTentativa) > 60000;
        if (paradoHaMuito && semTentativaRecente) {
            console.warn('[monitor] watchdog: sismos parados há mais de 2min, forçando nova busca');
            __buscasPausadasPorAba = false;
            if (typeof fetchGlobalFeeds === 'function') fetchGlobalFeeds();
        }
    } catch (e) {}
}, 60000);


// Proxy próprio no Cloudflare Workers (100 mil requisições/dia, só desse app).
// A cota dele não é compartilhada com milhares de outros apps no mundo — e como
// ele roda num datacenter da Cloudflare, também contorna o "Daily API request
// limit exceeded" que a rede de casa/celular pode ter estourado direto com o
// Open-Meteo.
//
// Os proxies públicos de terceiro (allorigins.win, isomorphic-git.org) que
// existiam aqui como reserva foram removidos: são o elo mais frágil da cadeia —
// podem sumir, ficar lentos ou mudar de política sem aviso, e a cota deles é
// compartilhada com milhares de outros apps. Se algum dia o Worker próprio
// também apresentar instabilidade, o ideal é subir um segundo Worker seu como
// backup em vez de voltar a depender de proxy público.
const WORKER_PROXY = (u) => `https://black-sky-9ba0.terrestre.workers.dev/?url=${encodeURIComponent(u)}`;

const CORS_PROXIES = [WORKER_PROXY];
// O log mostrou vários HTTP 429 (rate limit) do Open-Meteo: no boot(), várias funções
// (clima atual, previsão horária, minutely, qualidade do ar, previsão diária...) disparam
// chamadas quase simultâneas pro mesmo host, e o Open-Meteo bloqueia rajadas assim mesmo
// no free tier. Essa fila força um espaçamento mínimo só entre chamadas pro open-meteo.com,
// sem afetar nenhuma outra fonte.
let __openMeteoQueue = Promise.resolve();
const OPEN_METEO_GAP_MS = 650;
function throttleOpenMeteo(url) {
    if (!/open-meteo\.com/i.test(url)) return Promise.resolve();
    const wait = __openMeteoQueue.then(() => new Promise(res => setTimeout(res, OPEN_METEO_GAP_MS)));
    __openMeteoQueue = wait;
    return wait;
}

async function fetchWithCorsFallback(url, timeoutMs = 12000) {
    await throttleOpenMeteo(url);
    // Antes só checava r.ok — um proxy podia responder "200 OK" com corpo vazio (timeout no
    // meio do repasse, instabilidade, etc.) e quebrar no r.json() de quem chamou, tarde demais
    // pra tentar o próximo proxy. Agora lê o corpo aqui, confirma que não veio vazio, e só então
    // devolve uma Response nova (reconstruída a partir do texto já lido).
    async function tentar(alvo) {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), timeoutMs);
        try {
            const r = await fetch(alvo, { signal: c.signal });
            clearTimeout(t);
            if (!r.ok) {
                console.warn('[proxy] HTTP ' + r.status + ' em', alvo);
                return null;
            }
            const texto = await r.text();
            if (!texto || !texto.trim()) {
                console.warn('[proxy] resposta vazia em', alvo);
                return null;
            }
            // Fonte respondeu 200 mas com HTML/erro em vez do JSON esperado (ex.: página
            // de bloqueio/manutenção) — isso não é falha de rede, então merece log próprio
            // pra não ficar indistinguível de um proxy realmente fora do ar.
            const pareceJson = texto.trim()[0] === '{' || texto.trim()[0] === '[';
            if (!pareceJson) {
                console.warn('[proxy] resposta não-JSON (200 OK) em', alvo, '→ início:', texto.slice(0, 80));
            }
            return new Response(texto, { status: 200, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json' } });
        } catch (e) {
            clearTimeout(t);
            console.warn('[proxy] erro de rede/timeout em', alvo, '→', e?.message || e);
            return null;
        }
    }

    let resp = await tentar(url);
    if (resp) return resp;
    for (const b of CORS_PROXIES) {
        resp = await tentar(b(url));
        if (resp) return resp;
    }
    // Antes desistia na primeira volta completa (direto + todos os proxies falharam).
    // Só que boa parte das falhas que a gente via no log eram blips passageiros de rede/
    // proxy, não indisponibilidade real da fonte — então vale uma segunda volta rápida
    // depois de uma pausa curta, em vez de já jogar a toalha.
    await new Promise(res => setTimeout(res, 1800));
    resp = await tentar(url);
    if (resp) return resp;
    for (const b of CORS_PROXIES) {
        resp = await tentar(b(url));
        if (resp) return resp;
    }
    throw new Error('Falha total (todas as fontes vazias/indisponíveis): ' + url);
}

/* ============================ ÁUDIO ============================ */
