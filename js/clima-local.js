// === clima-local.js — Clima local (São Paulo): popup, nowcast, radar de chuva, qualidade do ar, previsão (linhas originais 6537-7199 do core-app.js) ===

async function configurarClimaLocal(lat, lng) {
    weatherLoc.lat = lat;
    weatherLoc.lng = lng;
    weatherLoc.origem = 'GPS';
    let nome = null;
    try {
        const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`);
        const d = await r.json();
        const cands = [d.city, d.locality, d.principalSubdivision].filter(x => x && typeof x === 'string');
        const ufCode = String(d.principalSubdivisionCode || d.principalSubdivision || '').toUpperCase().match(/BR[- ]([A-Z]{2})$/);
        if (ufCode) weatherLoc.uf = ufCode[1];
        cands.sort((a, b) => a.length - b.length);
        nome = cands.find(x => x.length <= 26) || cands[0] || null;
    } catch (e) {}

    if (!nome) {
        const near = CIDADES_MUNDO.map(c => ({ c, d: haversine(lat, lng, c.lat, c.lng) })).sort((a, b) => a.d - b.d)[0];
        if (near && near.d <= 150) nome = near.c.nome;
    }
    if (nome && nome.length > 32) nome = nome.substring(0, 30) + '…';
    weatherLoc.nome = nome || 'Local atual';
    if (!weatherLoc.uf) { const nearUf = CIDADES_MUNDO.find(c => c.nome === weatherLoc.nome && c.pais === 'brasil'); if (nearUf && nearUf.uf) weatherLoc.uf = nearUf.uf; }
    if (!weatherLoc.uf) weatherLoc.uf = 'SP';

    const e1 = document.getElementById('sp-city-name');
    if (e1) e1.textContent = siglaCidade(weatherLoc.nome);
    const e2 = document.getElementById('fc-city-name');
    if (e2) e2.textContent = weatherLoc.nome;
    safeText('pro-location-state',`📍 ${weatherLoc.nome}, ${weatherLoc.uf || '--'} · GPS${weatherLoc.accuracy ? ' · ±'+Math.round(weatherLoc.accuracy)+' m' : ''}`);
    safeText('sp-live-city',(weatherLoc.nome||'São Paulo').toUpperCase());

    globalAlerts = globalAlerts.filter(x => !x.id.startsWith('dc-'));
    fetchSPWeather();
    fetchSPNowcast();
    fetchSPAirQuality();
    fetchSPForecast();
    fetchDefesaCivil();
    fetchMeteoAlerts();
    if (typeof fetchCemaden === 'function') fetchCemaden();
    applyFilters();
}

function isFcPopupOpen() {
    const el = document.getElementById('sp-forecast-air');
    if (!el) return false;
    if (el.classList.contains('open')) return true;
    const d = (el.style && el.style.display) || '';
    if (d === 'block' || d === 'flex') return true;
    try {
      const cs = window.getComputedStyle(el);
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
    } catch (e) { return false; }
}

function showFcPopup() { window.WeatherPanel?.show(); }
function hideFcPopup() { window.WeatherPanel?.hide(); }

function toggleFcPopup() {
    if (isFcPopupOpen()) hideFcPopup();
    else showFcPopup(60000);
}

window.showFcPopup = showFcPopup;
window.hideFcPopup = hideFcPopup;
window.toggleFcPopup = toggleFcPopup;

// Reaplica layout do painel se a janela mudar de tamanho (tablet ↔ desktop ↔ mobile)
let __fcResizeTimer = null;
window.addEventListener('resize', function() {
  if (!isFcPopupOpen()) return;
  clearTimeout(__fcResizeTimer);
  __fcResizeTimer = setTimeout(function() {
    if (isFcPopupOpen()) showFcPopup(60000);
  }, 150);
});

// Corrige o mapa não preencher a tela toda no Chrome/Android quando a barra de
// endereço esconde ou aparece durante a rolagem. O #app já se ajusta sozinho
// via CSS (100dvh), mas o canvas do MapLibre guarda um tamanho fixo em pixels
// que só é atualizado chamando map.resize() — e o Chrome mobile nem sempre
// dispara o evento "resize" da window nesse caso, só o do visualViewport.
function __posicionarTickerAbaixoDoHeader() {
    const ticker = document.getElementById('latest-event-ticker');
    const header = document.getElementById('top-strip');
    if (!ticker || !header) return;
    if (window.innerWidth > 1100) return; // só existe em mobile/tablet
    // setProperty(...,'important') — não basta atribuição normal: em
    // retrato estreito existe uma regra externa
    // ("body.mg-clean-portrait #latest-event-ticker { top: auto
    // !important }", css/mobile-late-patches.css) que sempre vence um
    // "top" inline sem !important, não importa o valor. Só um !important
    // inline consegue vencer um !important externo.
    ticker.style.setProperty('top', header.offsetHeight + 'px', 'important');
}
if (typeof ResizeObserver !== 'undefined') {
    const __headerObserver = new ResizeObserver(__posicionarTickerAbaixoDoHeader);
    document.addEventListener('DOMContentLoaded', () => {
        const h = document.getElementById('top-strip');
        if (h) __headerObserver.observe(h);
    });
}

let __mapViewportResizeTimer = null;
function __resizeMapParaViewportAtual() {
    clearTimeout(__mapViewportResizeTimer);
    __mapViewportResizeTimer = setTimeout(function () {
        // Garantia extra: força a altura exata do viewport visível no #app.
        // Em alguns Chrome/Android, 100dvh via CSS não recalcula de imediato
        // quando a barra de endereço esconde/aparece durante a rolagem.
        const appEl = document.getElementById('app');
        if (appEl) {
            const alturaReal = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
            appEl.style.height = alturaReal + 'px';
        }
        if (map && typeof map.resize === 'function') map.resize();
        __posicionarTickerAbaixoDoHeader();
    }, 120);
}
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', __resizeMapParaViewportAtual);
    window.visualViewport.addEventListener('scroll', __resizeMapParaViewportAtual);
}
window.addEventListener('orientationchange', __resizeMapParaViewportAtual);
window.addEventListener('load', __resizeMapParaViewportAtual);
setTimeout(__resizeMapParaViewportAtual, 800); // garante correção mesmo se 'load' já tiver passado

let lastWeatherSpoken = { rain: 0, storm: 0, humidity: 0, nowcast: 0, air: 0 };

function maybeSpeakWeatherAlert(k, t) {
    const n = Date.now();
    if (n - (lastWeatherSpoken[k] || 0) > 20 * 60000) {
        falarAlertaGenerico(t);
        lastWeatherSpoken[k] = n;
    }
}

function weatherEmoji(code) {
    if (code === 0) return '☀️';
    if (code <= 2) return '🌤️';
    if (code === 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 57) return '🌦️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '🌨️';
    if (code <= 82) return '🌧️';
    if (code <= 86) return '🌨️';
    return '⛈️';
}

/* Política 5.7.1 — chuva na LISTA de eventos:
   - SÓ com evidência mais concreta (radar RainViewer).
   - Probabilidade de modelo Open-Meteo NÃO vira "alerta civil".
   - Modelo fica só no painel de clima, com rótulo explícito. */
function clearModelRainListAlerts() {
    globalAlerts = globalAlerts.filter(x => {
        if (!x) return false;
        if (x.id === 'nc-rain-model') return false;
        if (x.source === 'NOWCASTING' && /Modelo:|chance de chuva|% de chance/i.test(String(x.detail || x.place || ''))) return false;
        return true;
    });
}
function addNowcastAlert(texto, sev, opts) {
    opts = opts || {};
    const concrete = opts.concrete === true || opts.from === 'radar';
    // Modelo / probabilidade: nunca entra como evento na lista
    if (!concrete) {
        console.log('[nowcast] ignorado na lista (só modelo):', texto);
        return;
    }
    const id = 'nc-rain';
    clearModelRainListAlerts();
    const isNew = upsertAlert({
        id, type: 'civil', place: weatherLoc.nome, bandeira: (weatherLoc.uf === 'SP' ? BANDEIRA_SP : ''),
        time: Date.now(), coords: [weatherLoc.lng, weatherLoc.lat],
        source: 'RADAR', detail: texto, sev: sev || 2,
        link: 'https://www.rainviewer.com/map.html'
    }, { fonte: 'nowcast' });
    if (isNew) playAlertTone('storm');
    marcarBooted('nowcast');
    applyFilters();
    // Radar updates the evidence; opening the panel remains manual.
}

async function fetchSPWeather() {
    // Antes buscava uma grade de 9 pontos só pra usar o [0] — desnecessário pra esse
    // KPI simples (a grade faz sentido só pra funções que precisam de área, não pra
    // "temperatura atual de um ponto"). Simplificado pra 1 ponto só, com fallback de
    // CORS igual às outras chamadas, pra não travar caso o open-meteo direto falhe.
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${weatherLoc.lat}&longitude=${weatherLoc.lng}&current=temperature_2m,apparent_temperature,weather_code,wind_gusts_10m,precipitation,relative_humidity_2m&timezone=auto`;

    // O Open-Meteo, ocasionalmente, devolve HTTP 200 com um JSON de erro tipo
    // {"error":true,"reason":"Data corrupted at grid-cell..."} — falha transitória
    // conhecida e documentada, que a própria API recomenda simplesmente tentar de novo.
    // Sem retry, isso aparecia como "falha total" mesmo a fonte estando disponível.
    let temp = null, feels = null, fonte = 'Open-Meteo';
    try {
        let c = null;
        for (let tentativa = 0; tentativa < 2 && !c; tentativa++) {
            if (tentativa > 0) await new Promise(res => setTimeout(res, 1500));
            const r = await fetchWithCorsFallback(url, 10000);
            const d = await r.json();
            if (d && d.current && d.current.temperature_2m != null) c = d.current;
        }
        if (!c) throw new Error('resposta sem campo "current" (após retry)');
        temp = Math.round(c.temperature_2m);
        feels = Math.round(c.apparent_temperature);
    } catch (e) {
        console.error('Clima local (Open-Meteo) falhou, tentando backup wttr.in:', e.message || e);
        // Fonte reserva: wttr.in também não precisa de chave/cadastro e cobre qualquer
        // coordenada do planeta. Só entra em ação se o Open-Meteo falhar de vez, pra não
        // gastar chamada à toa — mesmo padrão de "fallback em cascata" que já usamos com
        // Brent (Yahoo → Stooq) e furacões (GDACS → NASA EONET).
        try {
            const r2 = await fetchWithCorsFallback(
                `https://wttr.in/${weatherLoc.lat},${weatherLoc.lng}?format=j1`, 10000
            );
            const d2 = await r2.json();
            const cc = d2 && d2.current_condition && d2.current_condition[0];
            if (!cc || cc.temp_C == null) throw new Error('wttr.in sem current_condition');
            temp = Math.round(parseFloat(cc.temp_C));
            feels = Math.round(parseFloat(cc.FeelsLikeC));
            fonte = 'wttr.in (backup)';
        } catch (e2) {
            console.error('Clima local: backup wttr.in também falhou:', e2.message || e2);
        }
    }

    const tEl = document.getElementById('kpi-temp');
    const fEl = document.getElementById('kpi-feels');
    if (temp != null && feels != null) {
        if (tEl) tEl.textContent = `${temp}°`;
        if (fEl) { fEl.textContent = `sens ${feels}°`; fEl.title = `Fonte: ${fonte}`; }
    } else {
        if (tEl && tEl.textContent === '--') tEl.textContent = '⚠️';
        if (fEl && fEl.textContent === 'sens --') fEl.textContent = 'sens erro';
    }
    // Reavalia alertas locais (calor/frio/tempestade) com a temp fresca
    try { if (typeof avaliarAlertasLocaisSP === 'function') setTimeout(avaliarAlertasLocaisSP, 400); } catch (e) {}
}

async function fetchSPNowcast() {
    const el = document.getElementById('sp-nowcast');

    function setRainEtaChip(opts) {
        opts = opts || {};
        const etaEl = document.getElementById('sp-rain-eta');
        const chip = document.getElementById('sp-rain-eta-chip');
        const ico = document.getElementById('sp-rain-eta-ico');
        const label = opts.label != null ? opts.label : '--';
        const mm = opts.mm;
        const mmPart = (mm != null && Number(mm) >= 0.05) ? (' · ' + Number(mm).toFixed(1).replace('.', ',') + 'mm') : '';
        const text = label === '--' ? '--' : (label + mmPart);
        if (etaEl) etaEl.textContent = text;
        if (ico) {
            if (opts.state === 'now') ico.textContent = '🌧️';
            else if (opts.state === 'soon') ico.textContent = '🌦️';
            else if (opts.state === 'clear') ico.textContent = '⏱️';
            else ico.textContent = '⏱️';
        }
        if (chip) {
            chip.classList.remove('rain-soon', 'rain-now', 'rain-clear');
            chip.classList.add(opts.state === 'now' ? 'rain-now' : opts.state === 'soon' ? 'rain-soon' : 'rain-clear');
            const src = opts.source ? (' · ' + opts.source) : '';
            chip.title = (opts.title || ('Chuva: ' + text)) + src;
        }
    }

    // Horários de modelo e pixels coloridos de radar não sustentam ETA exato.
    // RainOutlook controls the chip; a background refresh must not overwrite it.
    const box=document.getElementById('sp-nowcast');
    if(box)box.textContent='Previsão de chuva: consulte os modelos abaixo. Radar é imagem de ecos, sem confirmação automática de chuva no bairro.';
    globalAlerts=globalAlerts.filter(x=>x.id!=='nc-rain' && x.id!=='nc-rain-model');
    window.WeatherEvidence?.refresh();
}

const AQI_META = [
    [50,'Ótima','aqi-good','#4ade80','#052e16'],
    [100,'Boa','aqi-mod','#facc15','#1c1917'],
    [150,'Regular','aqi-usg','#fb923c','#431407'],
    [200,'Ruim','aqi-bad','#ef4444','#fff'],
    [300,'Péssima','aqi-vbad','#a855f7','#fff'],
    [99999,'Péssima','aqi-haz','#9f1239','#fff']
];
function aqiQualidadeFala(aqi) {
    if (aqi <= 50) return 'ótima';
    if (aqi <= 100) return 'boa';
    if (aqi <= 150) return 'regular';
    if (aqi <= 200) return 'ruim';
    return 'péssima';
}

async function fetchSPAirQuality() {
    const badge = document.getElementById('aqi-badge');
    try {
        const r = await fetchWithCorsFallback(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${weatherLoc.lat}&longitude=${weatherLoc.lng}&current=us_aqi,pm2_5,pm10&timezone=auto`);
        const d = await r.json();
        const c = d && d.current;
        if (!c || typeof c.us_aqi !== 'number') throw new Error('sem AQI');
        const aqi = Math.round(c.us_aqi);
        const pm = typeof c.pm2_5 === 'number' ? c.pm2_5.toFixed(1).replace('.', ',') : '--';
        const meta = AQI_META.find(a => aqi <= a[0]) || AQI_META[AQI_META.length - 1];
        if (badge) {
            badge.textContent = aqi;
            badge.className = 'aqi-badge ' + meta[2];
            badge.style.background = meta[3];
            badge.style.color = meta[4];
        }
        const lb = document.getElementById('aqi-label');
        if (lb) { lb.textContent = meta[1]; lb.style.color = meta[3]; }
        const pmEl = document.getElementById('aqi-pm');
        if (pmEl) pmEl.textContent = `PM2.5 ${pm} µg/m³`;
        if (aqi >= 101) {
            const qual = aqiQualidadeFala(aqi);
            maybeSpeakWeatherAlert('air', `Atenção. Qualidade do ar ${qual} em ${weatherLoc.nome}.`);
        }
    } catch (e) {
        if (badge) {
            badge.textContent = '--';
            badge.className = 'aqi-badge';
            badge.style.background = '';
            badge.style.color = '';
        }
        const lb = document.getElementById('aqi-label');
        if (lb) { lb.textContent = 'Indisponível'; lb.style.color = '#64748b'; }
        const pmEl = document.getElementById('aqi-pm');
        if (pmEl) pmEl.textContent = 'PM2.5 --';
    }
}

async function fetchSPForecast() {
    const strip = document.getElementById('fc-strip');
    const hourlyEl = document.getElementById('weather-hourly');
    const params = 'hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_gusts_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&forecast_days=5&forecast_hours=18&timezone=auto';
    try {
        const r = await fetchWithCorsFallback(`https://api.open-meteo.com/v1/forecast?latitude=${weatherLoc.lat}&longitude=${weatherLoc.lng}&${params}`);
        const d = await r.json();
        const dl = d && d.daily, h = d && d.hourly;
        if (!dl || !Array.isArray(dl.time) || !h || !Array.isArray(h.time)) throw new Error('sem previsão detalhada');
        let html = '';
        for (let i = 0; i < dl.time.length; i++) {
            const dow = new Date(dl.time[i] + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
            const prob = dl.precipitation_probability_max && dl.precipitation_probability_max[i] != null ? `${dl.precipitation_probability_max[i]}%` : '—';
            const mm = dl.precipitation_sum && dl.precipitation_sum[i] != null ? `${Number(dl.precipitation_sum[i]).toFixed(1).replace('.', ',')}mm` : '—';
            html += `<div class="fc-day"><div class="fc-dow">${i === 0 ? 'hoje' : dow}</div><div class="fc-ico">${weatherEmoji(dl.weather_code[i])}</div><div class="fc-max">${Math.round(dl.temperature_2m_max[i])}°</div><div class="fc-min">${Math.round(dl.temperature_2m_min[i])}°</div><div class="fc-rain">💧${prob}</div><div class="fc-rain">${mm}</div></div>`;
        }
        if (strip) strip.innerHTML = html;
        const now = Date.now();
        const forecastTime=t=>new Date(Date.parse(t+'Z')-Number(d.utc_offset_seconds||0)*1000);
        let idx = h.time.findLastIndex(t => forecastTime(t).getTime() <= now);
        if (idx < 0) idx = 0;
        const pNow = Number(h.precipitation_probability[idx] || 0);
        const mmNow = Number(h.precipitation[idx] || 0);
        const gustNow = Number(h.wind_gusts_10m[idx] || 0);
        const rainIndex = h.precipitation_probability.findIndex((p, i) => i >= idx && Number(p || 0) >= 40 && Number(h.precipitation[i] || 0) >= 0.1);
        const next2 = h.precipitation.slice(idx,idx+2).reduce((a,v)=>a+Number(v||0),0), next6 = h.precipitation.slice(idx,idx+6).reduce((a,v)=>a+Number(v||0),0);
        const temp6 = h.temperature_2m[idx+6]!=null ? Math.round(Number(h.temperature_2m[idx+6]))+'°' : '--';
        safeText('weather-trend-2h',next2.toFixed(1).replace('.', ',')+' mm'); safeText('weather-trend-6h',next6.toFixed(1).replace('.', ',')+' mm'); safeText('weather-trend-temp',temp6);
        const arrival = document.getElementById('weather-arrival');
        const title = document.getElementById('weather-arrival-title');
        const detail = document.getElementById('weather-arrival-detail');
        const probEl = document.getElementById('weather-prob'), mmEl = document.getElementById('weather-mm1'), gustEl = document.getElementById('weather-gust');
        if (probEl) probEl.textContent = `${pNow}%`;
        if (mmEl) mmEl.textContent = `${mmNow.toFixed(1).replace('.', ',')} mm`;
        if (gustEl) gustEl.textContent = `${Math.round(gustNow)} km/h`;
        if (arrival) arrival.className = 'weather-arrival ' + (pNow >= 70 ? 'alert' : pNow >= 40 ? 'warn' : 'ok');
        const summary = document.getElementById('weather-summary-text'), summaryMeta = document.getElementById('weather-summary-meta');
        const summaryMain = rainIndex >= 0 ? 'Possibilidade de chuva nas próximas horas (modelo)' : 'Pouco ou nenhum acumulado previsto nas próximas horas (modelo)';
        if(summary) summary.textContent = `${summaryMain}; ${pNow}% na hora atual; rajadas de ${Math.round(gustNow)} km/h.`;
        if(summaryMeta) summaryMeta.textContent = `Atualizado ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} · modelo numérico Open-Meteo`;
        setWeatherConfidence(rainIndex>=0?'model':'model','MODELO');
        if (rainIndex >= 0) {
            const quando = 'na faixa horária de '+forecastTime(h.time[rainIndex]).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+' (horário deste aparelho; previsão)';
            if (title) title.textContent = `🌧️ Modelo: possibilidade de chuva ${quando}`;
            if (detail) detail.textContent = `${h.precipitation_probability[rainIndex] || 0}% (modelo Open-Meteo) · ~${Number(h.precipitation[rainIndex] || 0).toFixed(1).replace('.', ',')} mm/h estimados · NÃO é alerta oficial nem radar`;
            // 5.7.1: NÃO criar evento na lista a partir de % do Open-Meteo (evita falso "vai chover").
            // Painel de clima continua mostrando a probabilidade com rótulo de modelo.
            try { clearModelRainListAlerts(); applyFilters(); } catch (e) {}
        } else {
            if (title) title.textContent = pNow >= 40 ? `🌦️ Possibilidade de chuva em ${weatherLoc.nome}` : `☀️ Sem chuva relevante nas próximas horas`;
            if (detail) detail.textContent = `${pNow}% na hora atual · acumulado estimado de ${mmNow.toFixed(1).replace('.', ',')} mm · rajada ${Math.round(gustNow)} km/h`;
        }
        if (hourlyEl) {
            hourlyEl.innerHTML = h.time.slice(idx, idx + 12).map((t, j) => {
                const i = idx + j, dt = forecastTime(t), pp = Math.round(Number(h.precipitation_probability[i] || 0));
                return `<div class="weather-hour ${j === 0 ? 'now' : ''}" title="Modelo Open-Meteo"><div class="weather-hour-time">${dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div><div class="weather-hour-icon">${weatherEmoji(Number(h.weather_code[i] || 0))}</div><div class="weather-hour-temp">${Math.round(Number(h.temperature_2m[i] || 0))}°</div><div class="weather-hour-rain">💧${pp}%</div><div class="weather-hour-gust">💨${Math.round(Number(h.wind_gusts_10m[i] || 0))} km/h</div></div>`;
            }).join('');
        }
        const fu = document.getElementById('fc-update');
        if (fu) fu.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        if (strip) strip.innerHTML = '<div style="font-size:10px;color:#64748b;padding:6px;">Previsão indisponível</div>';
        if (hourlyEl) hourlyEl.innerHTML = '<span class="weather-loading">Previsão horária indisponível.</span>';
        const title = document.getElementById('weather-arrival-title');
        if (title) title.textContent = '⚠️ Dados meteorológicos indisponíveis';
    }
}

/* ═══════════════ TEMPESTADES ═══════════════ */
