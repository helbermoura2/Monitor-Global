// === ui-wiring-final.js — Toasts, painel de volume, seleção de cidade, e todo o wiring final de botões/eventos (bootstrap do app) (linhas originais 9562-10043 do core-app.js) ===

function showToast(m, t = 'info') {
    const msg = String(m ?? '').trim();
    if (!msg) return;

    // Evita que várias fontes atualizadas ao mesmo tempo criem uma pilha de
    // mensagens idênticas. As diferentes mensagens continuam aparecendo, mas
    // sempre em uma única coluna, sem uma sobrepor a outra.
    const now = Date.now();
    const last = __toastState.recent.get(msg) || 0;
    if (now - last < 2500) return;
    __toastState.recent.set(msg, now);
    for (const [key, ts] of __toastState.recent) {
        if (now - ts > 10000) __toastState.recent.delete(key);
    }

    let stack = document.getElementById('toast-stack');
    if (!stack) {
        stack = document.createElement('div');
        stack.id = 'toast-stack';
        stack.className = 'toast-stack';
        stack.setAttribute('aria-live', 'polite');
        stack.setAttribute('aria-atomic', 'false');
        document.body.appendChild(stack);
    }

    // No máximo quatro avisos simultâneos; o mais antigo sai primeiro.
    while (stack.children.length >= 4) stack.firstElementChild?.remove();

    // Normaliza o nome usado por algumas chamadas antigas (warn -> warning).
    const type = t === 'warn' ? 'warning' : (t === 'error' ? 'error' : (t === 'warning' ? 'warning' : 'info'));
    const d = document.createElement('div');
    d.className = 'toast toast-' + type;
    d.dataset.toastId = String(++__toastState.seq);
    d.textContent = msg;
    stack.appendChild(d);

    const remove = () => {
        if (!d.isConnected) return;
        d.style.opacity = '0';
        d.style.transform = 'translateX(400px)';
        d.style.transition = 'opacity .4s, transform .4s';
        setTimeout(() => d.remove(), 400);
    };
    setTimeout(remove, 4200);
}

/* ═══════════════ INTERFACE ═══════════════ */
document.getElementById('btn-som').textContent = somAtivo ? '🔊' : '🔇';
document.getElementById('btn-som')?.addEventListener('click', function () {
    somAtivo = !somAtivo;
    localStorage.setItem('somAtivo', somAtivo ? '1' : '0');
    this.textContent = somAtivo ? '🔊 Som ativo' : '🔇 Som mudo';
    if (somAtivo) {
        unlockAudio(true);
        showToast('🔊 Som ativado', 'info');
    } else {
        try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
        showToast('🔇 Som silenciado', 'info');
        mostrarBannerSom(false);
    }
    if (typeof atualizarBotaoSomHeader === 'function') atualizarBotaoSomHeader();
});

/* Painel de volume + mudo por tipo de alerta */
document.getElementById('vol-slider').value = Math.round(somVolume * 100);
document.getElementById('vol-value').textContent = Math.round(somVolume * 100) + '%';
function setSomVolume(v) {
    somVolume = Math.min(1, Math.max(0, parseInt(v, 10) / 100));
    localStorage.setItem('somVolume', String(Math.round(somVolume * 100)));
    document.getElementById('vol-value').textContent = Math.round(somVolume * 100) + '%';
}
function toggleVolPanel(force) {
    const p = document.getElementById('ts-vol-panel');
    if (!p) return;
    if (typeof force === 'boolean') p.classList.toggle('open', force);
    else p.classList.toggle('open');
}
document.addEventListener('click', (e) => {
    const wrap = document.getElementById('ts-vol-wrap');
    const panel = document.getElementById('ts-vol-panel');
    if (wrap && panel && panel.classList.contains('open') && !wrap.contains(e.target)) {
        toggleVolPanel(false);
    }
});
function atualizarChipsSomTipo() {
    document.querySelectorAll('.chip-som').forEach(ch => {
        ch.classList.toggle('muted', somMutedTypes.has(ch.dataset.tipo));
    });
}
document.querySelectorAll('.chip-som').forEach(ch => {
    ch.addEventListener('click', () => {
        const tipo = ch.dataset.tipo;
        if (somMutedTypes.has(tipo)) somMutedTypes.delete(tipo); else somMutedTypes.add(tipo);
        localStorage.setItem('somMutedTypes', JSON.stringify([...somMutedTypes]));
        atualizarChipsSomTipo();
    });
});
atualizarChipsSomTipo();

/* ═══════════════ TOOLTIP PRÓPRIO PROS CHIPS ═══════════════
   O title nativo do navegador segue o cursor (fica escondido atrás da
   "mão") e some no timer do sistema, rápido demais pra ler. Aqui a gente
   converte os title= dos chips pra data-tt e desenha um tooltip nosso,
   ancorado embaixo do próprio chip (não do cursor), que fica visível
   enquanto o mouse continuar em cima. */
(function () {
    document.querySelectorAll('.chip[title]').forEach(el => {
        const t = el.getAttribute('title');
        if (t) { el.setAttribute('data-tt', t); el.removeAttribute('title'); }
    });

    let ttEl = null, hoverTimer = null;
    function ensureTT() {
        if (!ttEl) {
            ttEl = document.createElement('div');
            ttEl.id = 'smart-tooltip';
            document.body.appendChild(ttEl);
        }
        return ttEl;
    }
    function showTT(target) {
        const txt = target.getAttribute('data-tt');
        if (!txt) return;
        const el = ensureTT();
        el.textContent = txt;
        el.style.display = 'block';
        const r = target.getBoundingClientRect();
        const tw = el.offsetWidth, th = el.offsetHeight;
        let left = r.left + r.width / 2 - tw / 2;
        left = Math.max(6, Math.min(left, window.innerWidth - tw - 6));
        // Por padrão mostra ACIMA do chip — embaixo o cursor fica perto demais
        // (chips são pequenos) e sobrepõe o início do texto.
        let top = r.top - th - 10;
        if (top < 4) top = r.bottom + 10; // sem espaço em cima: cai pra baixo
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        requestAnimationFrame(() => el.classList.add('show'));
    }
    function hideTT() { if (ttEl) ttEl.classList.remove('show'); }

    document.addEventListener('mouseover', (e) => {
        const t = e.target.closest('[data-tt]');
        if (!t) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => showTT(t), 220);
    });
    document.addEventListener('mouseout', (e) => {
        const t = e.target.closest('[data-tt]');
        if (!t) return;
        clearTimeout(hoverTimer);
        hideTT();
    });
    document.addEventListener('focusin', (e) => { const t = e.target.closest('[data-tt]'); if (t) showTT(t); });
    document.addEventListener('focusout', (e) => { const t = e.target.closest('[data-tt]'); if (t) hideTT(); });
})();

document.getElementById('btn-teste')?.addEventListener('click', () => {
    unlockAudio();
    setTimeout(() => {
        if (!ensureAudio()) return;
        showToast('🔊 Teste: M4 → M6 → tufão → tsunami → defesa civil', 'info');
        // Espaçamento generoso pra cada som (e a voz do M6, que depende de
        // uma chamada de rede e pode demorar alguns segundos) terminar antes
        // do próximo começar — sem isso o M6 (mais alto) entrava em cima do
        // M4 ainda tocando e mascarava o último bipe dele.
        playEarthquakeSound(4.2, 'teste', 10, 0, true);
        setTimeout(() => playEarthquakeSound(6.3, 'teste', 20, 0, true), 2500);
        setTimeout(() => playAlertTone('hurricane'), 12000);
        setTimeout(() => playAlertTone('tsunami'), 14000);
        setTimeout(() => playAlertTone('civil'), 17500);
    }, 300);
});
document.getElementById('btn-teste-faixas')?.addEventListener('click', () => {
    unlockAudio();
    setTimeout(() => {
        if (!ensureAudio()) {
            showToast('🔊 Toque novamente para liberar o áudio no Chrome/DeX.', 'warning');
            return;
        }
        showToast('🎚️ ASSINATURAS: M3 = agudo (3x) → M4 = médio-grave (4x) → M5 = grave forte (5x) → M6 = emergência + voz', 'info');
        playEarthquakeSound(3.2, 'teste M3', 10, 0, true);
        setTimeout(() => playEarthquakeSound(4.5, 'teste M4', 12, 0, true), 2000);
        setTimeout(() => playEarthquakeSound(5.5, 'teste M5', 15, 0, true), 4700);
        setTimeout(() => playEarthquakeSound(6.3, 'teste M6', 20, 0, true), 8200);
    }, 350);
});
document.getElementById('btn-voz-hist')?.addEventListener('click', () => {
    const linhas = (vozHistorico || []).slice().reverse().map((x, i) =>
        `<div style="padding:6px 0;border-bottom:1px solid #1e293b;font-size:12px;color:#cbd5e1"><b style="color:#38bdf8">${i + 1}.</b> ${x.txt}<br><small style="color:#64748b">${new Date(x.t).toLocaleString('pt-BR')}</small></div>`
    ).join('') || '<p style="color:#94a3b8">Nenhum alerta falado ainda nesta sessão.</p>';
    if (typeof showFloat === 'function') {
        /* menu float may not exist in this scope */
    }
    const el = document.getElementById('menu-float-panel') || (() => { const d = document.createElement('div'); d.id = 'menu-float-panel'; document.body.appendChild(d); return d; })();
    el.innerHTML = '<button type="button" class="close-x" id="voz-hist-close">✕</button><h3>Histórico de voz</h3>' + linhas;
    el.classList.add('open'); el.style.display = 'block';
    document.getElementById('voz-hist-close').onclick = () => { el.classList.remove('open'); el.style.display = 'none'; };
});
document.getElementById('btn-share-resumo')?.addEventListener('click', () => {
    try {
        const n = (typeof lastMerged !== 'undefined' && lastMerged) ? lastMerged.length : (globalEvents.length + globalAlerts.length);
        const eq = globalEvents.filter(e => e.mag >= minMagnitude);
        const max = eq.reduce((m, e) => Math.max(m, e.mag || 0), 0);
        const cyc = globalAlerts.filter(a => a.type === 'hurricane');
        const flood = (typeof floodRiskState !== 'undefined') ? floodRiskState : {};
        const txt = [
            `Monitor Global`,
            `Eventos filtrados: ${n}`,
            `Sismos: ${eq.length} · maior M${max ? max.toFixed(1) : '--'}`,
            `Ciclones ativos: ${cyc.length}${cyc[0] ? ' · ' + cyc.map(c => c.place).slice(0, 3).join(', ') : ''}`,
            `Alagamento local: ${(flood.level || '--').toUpperCase()} — ${flood.reason || ''}`,
            `Clima: ${(window.__proWeather && window.__proWeather.temp != null) ? Math.round(window.__proWeather.temp) + '°C' : '--'}`,
            new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' BRT'
        ].join('\n');
        navigator.clipboard?.writeText(txt).then(() => showToast('📋 Resumo copiado', 'info')).catch(() => alert(txt));
    } catch (e) { console.warn(e); }
});

document.querySelectorAll('#chips-row .chip[data-f]').forEach(ch => {
    ch.addEventListener('click', () => {
        sidebarFilter = ch.dataset.f;
        document.querySelectorAll('#chips-row .chip[data-f]').forEach(x => x.classList.toggle('active', x === ch));
        applyFilters();
    });
});

// Menu principal dentro da mesma faixa de chips no desktop.
// Não usa data-f para não interferir nos filtros de eventos.
document.getElementById('chip-menu-desktop')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof window.__openMobileMenu === 'function') window.__openMobileMenu(event);
});

// Navegação dos filtros: botões + roda do mouse para facilitar o uso no DeX.
(function initChipsHorizontalScroll(){
    const row = document.getElementById('chips-row');
    const left = document.getElementById('chips-scroll-left');
    const right = document.getElementById('chips-scroll-right');
    if (!row) return;
    const step = () => Math.max(140, Math.round(row.clientWidth * 0.55));
    left?.addEventListener('click', () => row.scrollBy({ left: -step(), behavior: 'smooth' }));
    right?.addEventListener('click', () => row.scrollBy({ left: step(), behavior: 'smooth' }));
    row.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();
            row.scrollLeft += e.deltaY;
        }
    }, { passive: false });
    const updateButtons = () => {
        const max = row.scrollWidth - row.clientWidth;
        const overflow = max > 4;
        if (left) { left.style.opacity = overflow && row.scrollLeft > 2 ? '1' : '.35'; left.disabled = !(overflow && row.scrollLeft > 2); }
        if (right) { right.style.opacity = overflow && row.scrollLeft < max - 2 ? '1' : '.35'; right.disabled = !(overflow && row.scrollLeft < max - 2); }
    };
    row.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
    requestAnimationFrame(updateButtons);
})();

document.getElementById('chip-importantes').addEventListener('click', function () {
    soImportantes = !soImportantes;
    this.classList.toggle('on', soImportantes);
    applyFilters();
});
document.getElementById('chip-criticos') && document.getElementById('chip-criticos').addEventListener('click', function () {
    soCriticos = !soCriticos;
    this.classList.toggle('on', soCriticos);
    try { localStorage.setItem('monitor_so_criticos', soCriticos ? '1' : '0'); } catch (e) {}
    applyFilters();
    if (typeof showToast === 'function') showToast(soCriticos ? '⚡ Só eventos críticos (global)' : 'Mostrando todos os eventos', 'info');
});
try { var _cc = document.getElementById('chip-criticos'); if (_cc) _cc.classList.toggle('on', !!soCriticos); } catch (e) {}


function syncGeoChips() {
    document.querySelectorAll('#chips-row [data-geo]').forEach(ch => {
        ch.classList.toggle('on', geoFilter === ch.dataset.geo);
    });
}
document.querySelectorAll('#chips-row [data-geo]').forEach(ch => {
    ch.addEventListener('click', () => {
        geoFilter = (geoFilter === ch.dataset.geo) ? 'all' : ch.dataset.geo;
        try { localStorage.setItem('monitor_geo_filter', geoFilter); } catch (e) {}
        syncGeoChips();
        applyFilters();
        const labels = { all: 'Mundo inteiro', br: 'Brasil', me: 'Me afeta (BR ou 500 km)', '500': 'Raio 500 km', '100': 'Raio 100 km' };
        if (typeof showToast === 'function') showToast('Filtro geo: ' + (labels[geoFilter] || geoFilter), 'info');
    });
});
syncGeoChips();

/* Atalhos de teclado (desktop / DeX) — 4.1.0 */
document.addEventListener('keydown', (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'r') { e.preventDefault(); if (typeof toggleRadar === 'function') toggleRadar(); }
    /* atalho 'c' para crise removido */
    else if (k === ' ') {
        e.preventDefault();
        if (typeof PRO !== 'undefined') {
            PRO.follow = !PRO.follow;
            q('btn-follow-pro')?.classList.toggle('active', PRO.follow);
            if (typeof showToast === 'function') showToast(PRO.follow ? '🎯 Auto-câmera ON' : '🎯 Auto-câmera OFF', 'info');
        }
    }
    else if (k === 'escape') {
        toggleMobileEventsModal(false);
        if (typeof hideFcPopup === 'function') hideFcPopup();
    }
});


// Controles meteorológicos: cidade brasileira, resumo operacional, fixação e atalho do cabeçalho.
const WEATHER_UF = {'São Paulo':'SP','Rio de Janeiro':'RJ','Belo Horizonte':'MG','Brasília':'DF','Curitiba':'PR','Porto Alegre':'RS','Salvador':'BA','Recife':'PE','Fortaleza':'CE','Manaus':'AM','Belém':'PA','Goiânia':'GO'};
function weatherCityCatalog(){return [{nome:'São Paulo',lat:-23.55,lng:-46.63},{nome:'Rio de Janeiro',lat:-22.91,lng:-43.17},{nome:'Belo Horizonte',lat:-19.92,lng:-43.94},{nome:'Brasília',lat:-15.79,lng:-47.88},{nome:'Curitiba',lat:-25.43,lng:-49.27},{nome:'Porto Alegre',lat:-30.03,lng:-51.23},{nome:'Salvador',lat:-12.97,lng:-38.5},{nome:'Recife',lat:-8.05,lng:-34.9},{nome:'Fortaleza',lat:-3.72,lng:-38.54},{nome:'Manaus',lat:-3.1,lng:-60.02},{nome:'Belém',lat:-1.45,lng:-48.49},{nome:'Goiânia',lat:-16.68,lng:-49.25}];}
async function selectWeatherCity(nome){const c=weatherCityCatalog().find(x=>x.nome===nome);if(!c)return;weatherLoc={...weatherLoc,nome:c.nome,lat:c.lat,lng:c.lng,uf:WEATHER_UF[c.nome]||'BR',origem:'manual',accuracy:null};safeText('fc-city-name',c.nome);safeText('sp-live-city',c.nome.toUpperCase());safeText('pro-location-state',`📍 ${c.nome}, ${weatherLoc.uf} · seleção manual`);const sel=q('weather-city-select');if(sel)sel.value=c.nome;fetchSPWeather();fetchSPNowcast();fetchSPAirQuality();fetchSPForecast();fetchDefesaCivil();fetchMeteoAlerts();if(typeof fetchCemaden==='function')fetchCemaden();showFcPopup(30000);}
function toggleWeatherPin(){const on=document.body.classList.toggle('weather-panel-pinned'),p=q('sp-forecast-air'),b=q('weather-pin-btn');if(p)p.classList.toggle('weather-pinned',on);if(b){b.classList.toggle('active',on);b.textContent=on?'📍':'📌';b.title=on?'Desafixar painel meteorológico':'Fixar painel meteorológico';}if(on){if(fcPopupTimeout)clearTimeout(fcPopupTimeout);showFcPopup(86400000);}else showFcPopup(30000);try{localStorage.setItem('weather_panel_pinned',on?'1':'0')}catch(e){}}
function setWeatherConfidence(kind,text){const el=q('weather-confidence');if(!el)return;el.className='weather-confidence '+kind;el.textContent=text;}

let __meteoClickLock = 0;
function openMeteoFromClick(e){
  if (e) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
  }
  // Debounce: evita abrir+fechar no mesmo clique (inline residual / bubble / capture)
  const now = Date.now();
  if (now - __meteoClickLock < 350) return;
  __meteoClickLock = now;
  try {
    if (typeof isFcPopupOpen === 'function' && isFcPopupOpen()) hideFcPopup();
    else showFcPopup(60000);
  } catch (err) {
    console.error('[meteo]', err);
    try { showFcPopup(60000); } catch (e2) {}
  }
}
document.getElementById('btn-previsao')?.addEventListener('click', openMeteoFromClick);
document.getElementById('weather-shortcut')?.addEventListener('click', openMeteoFromClick);
document.getElementById('weather-shortcut-desktop')?.addEventListener('click', openMeteoFromClick);
// Mobile: clique na faixa de temperatura também abre a previsão
document.querySelector('.mobile-weather-mini')?.addEventListener('click', (e) => {
  if (e.target && e.target.closest && e.target.closest('a')) return;
  openMeteoFromClick(e);
});
const mwm = document.querySelector('.mobile-weather-mini');
if (mwm) {
  mwm.style.cursor = 'pointer';
  mwm.setAttribute('role', 'button');
  mwm.setAttribute('aria-label', 'Abrir previsão meteorológica');
}
document.getElementById('sp-live-card')?.addEventListener('click', (e) => {
  if (e.target && e.target.closest && e.target.closest('a')) return;
  // Se o clique veio do botão 🌤️, o listener do botão já tratou — não repetir
  if (e.target && e.target.closest && e.target.closest('#weather-shortcut-desktop, #weather-shortcut, .weather-header-shortcut')) return;
  e.preventDefault(); e.stopPropagation();
  const now = Date.now();
  if (now - __meteoClickLock < 350) return;
  __meteoClickLock = now;
  // Clique na temperatura/clima: se fechado abre; se aberto mantém (não fecha por acidente)
  if (typeof isFcPopupOpen === 'function' && isFcPopupOpen()) return;
  try { showFcPopup(60000); } catch (err) { console.error(err); }
});
// Delegação global: qualquer clique no atalho/clima abre o painel (DeX/desktop)
document.addEventListener('click', function(e){
  const t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('#weather-shortcut, #weather-shortcut-desktop, .weather-header-shortcut, #btn-previsao, #sp-live-card')) {
    // evita double-toggle se o listener direto já rodou
    if (e.__meteoHandled) return;
    e.__meteoHandled = true;
    // se o alvo direto já tem listener, deixa ele; senão abre aqui
  }
}, true);
// Atalho de teclado: tecla M abre/fecha meteorologia
document.addEventListener('keydown', function(e){
  if (e.key === 'm' || e.key === 'M') {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    openMeteoFromClick(e);
  }
});
document.getElementById('weather-city-select')?.addEventListener('change',e=>selectWeatherCity(e.target.value));
document.getElementById('weather-pin-btn')?.addEventListener('click',toggleWeatherPin);
try{if(localStorage.getItem('weather_panel_pinned')==='1'){document.body.classList.add('weather-panel-pinned');q('sp-forecast-air')?.classList.add('weather-pinned');q('weather-pin-btn')&&(q('weather-pin-btn').classList.add('active'),q('weather-pin-btn').textContent='📍');}}catch(e){}
/* weather-shortcut já ligado via toggleFcPopup acima */

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(p => {
        minhaPosicao = { lat: p.coords.latitude, lng: p.coords.longitude };
        weatherLoc.accuracy = p.coords.accuracy || null;
        applyFilters();
        configurarClimaLocal(p.coords.latitude, p.coords.longitude);
    }, () => {
        weatherLoc.origem = 'padrão';
        safeText('pro-location-state','📍 SP padrão · localização não autorizada');
    }, { timeout: 10000, maximumAge: 300000 });
}

/* ═══════════════ INICIALIZAÇÃO ═══════════════ */
window.addEventListener('load', () => {
    // BUG CORRIGIDO: a ordem era restaurarCacheOffline() (que já renderiza a lista
    // com os dados salvos) seguido de renderEventsSkeleton() — que SOBRESCREVIA
    // essa lista recém-preenchida com 6 caixinhas cinzas vazias de "carregando".
    // O contador no topo ficava certo (vinha do cache), mas a lista embaixo ficava
    // muda até o primeiro fetch ao vivo terminar — parecendo travado em "offline"
    // por mais tempo do que realmente estava. Agora o esqueleto vem PRIMEIRO (como
    // estado inicial de verdade) e o cache — se existir — substitui ele por cima
    // imediatamente, sem nada apagando o outro depois.
    renderEventsSkeleton();

    // Com internet, NÃO mostrar o cache antes da consulta ao vivo.
    // O cache só entra como fallback se a rede estiver offline ou se todas
    // as fontes sísmicas falharem.
    try {
        if (navigator.onLine === false) restaurarCacheOffline('offline');
    } catch (e) {}

    carregarMagnitudeSalva();

    const cn = document.getElementById('sp-city-name');
    if (cn && cn.textContent === '--') cn.textContent = siglaCidade(weatherLoc.nome);

    initMap();

    /* ── INTERVALOS DE ATUALIZAÇÃO (ms) ─────────────────────────
       1º número = atraso inicial | 2º = intervalo de repetição
       Aumente os intervalos em conexões lentas; diminua sismos se precisar. */
    // Ciclos por criticidade (4.1.0): sismos e alertas graves mais rápidos;
    // clima/contexto mais espaçados pra reduzir 429 e carga de proxy.
    agendarBusca(fetchGlobalFeeds, 0, 45000);
    setInterval(function(){ try{updateFreshnessBar();}catch(e){} }, 15000);           // sismos — crítico
    agendarBusca(fetchAfadQuakes, 5000, 60000);       // AFAD Turquia (incl. M baixas)
    agendarBusca(fetchPlanetReinforcementQuakes, 7000, 60000);     // reforço planetário (5 fatias de longitude, mesmo USGS, sem teto global)
    agendarBusca(fetchEmscPlanetReinforcementQuakes, 7500, 60000); // idem, mas pro EMSC (cobertura melhor de eventos menores)
    agendarBusca(fetchTsunamiAlerts, 2000, 180000);     // tsunami NWS
    agendarBusca(fetchTsunamiAlertsGDACS, 4000, 180000);
    agendarBusca(fetchTornadoAlerts, 6000, 180000);
    agendarBusca(fetchGdacsFloods, 8000, 300000);
    agendarBusca(fetchCgeSP, 9000, 600000);        // alagamentos ativos — CGE São Paulo
    agendarBusca(fetchVolcanoes, 3000, 120000);
    agendarBusca(fetchDefesaCivil, 10000, 300000);
    agendarBusca(fetchBrazilStorms, 12000, 300000);
    agendarBusca(fetchInmetAvisos, 11000, 300000);     // avisos oficiais INMET Brasil
    agendarBusca(fetchRealHurricanes, 14000, 600000);   // ciclones GDACS+NHC 10min
    agendarBusca(fetchEonetStorms, 16000, 900000);
    agendarBusca(fetchFires, 8000, 21600000);          // incêndios/queimadas a cada 6 horas
    agendarBusca(fetchGlobalStormCities, 20000, 600000);
    agendarBusca(fetchGlobalWindGusts, 22000, 600000);
    agendarBusca(fetchSPWeather, 24000, 300000);
    agendarBusca(fetchSPNowcast, 26000, 300000);
    setTimeout(function(){ try { clearModelRainListAlerts(); if (typeof applyFilters==='function') applyFilters(); } catch(e){} }, 8000);
    agendarBusca(avaliarAlertasLocaisSP, 28000, 300000); // temp / tempestade / chuva local
    agendarBusca(fetchSPAirQuality, 30000, 600000);
    agendarBusca(fetchSPForecast, 32000, 1800000);
    agendarBusca(fetchRealBrent, 0, 300000);
    agendarBusca(fetchMeteoAlerts, 34000, 600000);

    /* Auto-abre previsão só em telas largas (tablet/desktop/TV).
       No celular o usuário toca no 🌤️ — evita cobrir o mapa na abertura. */
    setTimeout(() => {
      try {
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        if (vw > 900) showFcPopup(20000);
      } catch (e) {}
    }, 2800);
    // Relembra o painel 1x por hora só no desktop (se não estiver fixado)
    setInterval(() => {
      try {
        const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
        if (vw > 900 && !document.body.classList.contains('weather-panel-pinned')) showFcPopup(20000);
      } catch (e) {}
    }, 3600000);

    // Tecla ESC fecha painéis abertos (clima, menus)
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      try { if (typeof hideFcPopup === 'function') hideFcPopup(); } catch (err) {}
      try { document.body.classList.remove('mobile-events-open', 'mobile-fc-open'); } catch (err) {}
    });

    updateKPIs();
});

