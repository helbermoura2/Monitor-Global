// === alertas-locais-sp.js — Alertas locais de São Paulo, Defesa Civil, alertas meteorológicos (linhas originais 9341-9561 do core-app.js) ===

function upsertSpAlert(id, type, detail, sev) {
    const isNew = upsertAlert({
        id,
        type: type || 'civil',
        place: (weatherLoc && weatherLoc.nome) ? weatherLoc.nome : 'São Paulo',
        bandeira: (weatherLoc && weatherLoc.uf === 'SP') ? (typeof BANDEIRA_SP !== 'undefined' ? BANDEIRA_SP : '🇧🇷') : '🇧🇷',
        time: Date.now(),
        coords: [weatherLoc.lng, weatherLoc.lat],
        source: 'MODELO LOCAL',
        detail,
        sev: sev || 2
    }, { fonte: 'spAlert' });
    if (isNew) {
        try { playAlertTone(type === 'storm' ? 'storm' : 'civil'); } catch (e) {}
        try { showToast(detail, sev >= 3 ? 'error' : 'warning'); } catch (e) {}
    }
    return isNew;
}
function clearSpAlert(id) {
    knownAlertIds.delete(id);
    globalAlerts = globalAlerts.filter(x => x.id !== id);
}
function speakSpOnce(key, texto, minMinutos) {
    const gap = (minMinutos || 25) * 60000;
    const n = Date.now();
    if (n - (lastSpAlertSpoken[key] || 0) < gap) return;
    lastSpAlertSpoken[key] = n;
    try { maybeSpeakWeatherAlert(key, texto); } catch (e) {
        try { falarAlertaGenerico(texto); } catch (e2) {}
    }
}

async function avaliarAlertasLocaisSP() {
    if (!weatherLoc || weatherLoc.lat == null) return;
    const nome = weatherLoc.nome || 'São Paulo';
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${weatherLoc.lat}&longitude=${weatherLoc.lng}` +
            `&current=temperature_2m,apparent_temperature,weather_code,precipitation,wind_gusts_10m,relative_humidity_2m` +
            `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_gusts_10m` +
            `&forecast_hours=6&timezone=auto`;
        const r = await fetchWithCorsFallback(url, 12000);
        const d = await r.json();
        const cur = d && d.current;
        const h = d && d.hourly;
        if (!cur) return;

        const temp = Number(cur.temperature_2m);
        const feels = Number(cur.apparent_temperature);
        const code = Number(cur.weather_code || 0);
        const rainNow = Number(cur.precipitation || 0);
        const gust = Number(cur.wind_gusts_10m || 0);

        // —— Temperatura ——
        if (Number.isFinite(temp) && temp >= SP_ALERT.calorC) {
            const novo = upsertSpAlert('sp-calor', 'civil',
                `🔥 Calor elevado em ${nome}: ${Math.round(temp)}° (sensação ${Math.round(feels)}°)`, 2);
            if (novo) speakSpOnce('spHeat', `Atenção. Calor elevado em ${nome}. Temperatura ${Math.round(temp)} graus.`, 40);
        } else {
            clearSpAlert('sp-calor');
        }
        if (Number.isFinite(temp) && temp <= SP_ALERT.frioC) {
            const novo = upsertSpAlert('sp-frio', 'civil',
                `❄️ Frio atípico em ${nome}: ${Math.round(temp)}°`, 2);
            if (novo) speakSpOnce('spCold', `Atenção. Temperatura baixa em ${nome}. ${Math.round(temp)} graus.`, 40);
        } else {
            clearSpAlert('sp-frio');
        }

        // —— Agora: tempestade / chuva forte ——
        if (code >= SP_ALERT.codeTempestade || (code >= 95)) {
            const novo = upsertSpAlert('sp-storm-now', 'storm',
                `⛈️ Tempestade em ${nome} agora • rajadas ${Math.round(gust)} km/h`, 3);
            if (novo) speakSpOnce('spStormNow', `Atenção. Tempestade em andamento em ${nome}.`, 20);
        } else {
            clearSpAlert('sp-storm-now');
        }

        // —— Próximas horas: tempestade / chuva chegando ——
        let stormInMin = null, rainInMin = null, rainMm = 0, rainProb = 0;
        if (h && Array.isArray(h.time)) {
            const now = Date.now();
            for (let i = 0; i < h.time.length; i++) {
                const t = new Date(h.time[i]).getTime();
                const mins = Math.round((t - now) / 60000);
                if (mins < -20 || mins > 360) continue;
                const wc = Number(h.weather_code[i] || 0);
                const pp = Number(h.precipitation_probability[i] || 0);
                const mm = Number(h.precipitation[i] || 0);
                if (stormInMin == null && wc >= SP_ALERT.codeTempestade && mins >= 0) stormInMin = mins;
                if (rainInMin == null && mins >= 0 && (pp >= SP_ALERT.chuvaProb1h || mm >= SP_ALERT.chuvaMm1h || wc >= SP_ALERT.codeChuvaForte)) {
                    rainInMin = mins;
                    rainMm = mm;
                    rainProb = pp;
                }
            }
        }

        if (stormInMin != null) {
            const quando = stormInMin <= 15 ? 'em breve' : `em ~${stormInMin} min`;
            const novo = upsertSpAlert('sp-storm-soon', 'storm',
                `⛈️ Tempestade chegando em ${nome} ${quando}`, 3);
            if (novo) speakSpOnce('spStormSoon', `Atenção. Tempestade chegando em ${nome} ${quando}.`, 25);
        } else {
            clearSpAlert('sp-storm-soon');
        }

        if (rainInMin != null && stormInMin == null) {
            const quando = rainInMin <= 10 ? 'agora / iminente' : `em ~${rainInMin} min`;
            const extra = rainMm > 0 ? ` · ~${rainMm.toFixed(1)} mm` : (rainProb ? ` · ${rainProb}%` : '');
            const novo = upsertSpAlert('sp-rain-soon', 'civil',
                `🌧️ Chuva chegando em ${nome} ${quando}${extra}`, 2);
            if (novo) speakSpOnce('spRainSoon', `Chuva chegando em ${nome} ${quando}.`, 25);
        } else if (rainNow >= SP_ALERT.chuvaMm1h) {
            const novo = upsertSpAlert('sp-rain-now', 'civil',
                `🌧️ Chuva em ${nome} agora · ${rainNow.toFixed(1)} mm`, 2);
            if (novo) speakSpOnce('spRainNow', `Chuva em andamento em ${nome}.`, 30);
        } else {
            clearSpAlert('sp-rain-soon');
            clearSpAlert('sp-rain-now');
        }

        try { applyFilters(); } catch (e) {}
        marcarBooted('spAlert');
    } catch (e) {
        console.warn('avaliarAlertasLocaisSP:', e.message || e);
    }
}

/* ═══════════════ DEFESA CIVIL + AVISOS ═══════════════ */
async function fetchDefesaCivil() {
    try {
        const r = await fetchWithCorsFallback(`https://api.open-meteo.com/v1/forecast?latitude=${weatherLoc.lat}&longitude=${weatherLoc.lng}&current=temperature_2m,relative_humidity_2m,wind_gusts_10m,precipitation,weather_code&timezone=auto`);
        const d = await r.json();
        const c = d && d.current;
        if (!c) throw new Error('sem current');

        const cidade = weatherLoc.nome;
        const avisos = [];
        const hum = Math.round(c.relative_humidity_2m || 999);

        if (hum <= 12) avisos.push(['umid', `Umidade crítica ${hum}% — EMERGÊNCIA`, 3]);
        else if (hum <= 20) avisos.push(['umid', `Umidade muito baixa ${hum}% — ALERTA`, 2]);
        else if (hum <= 30) avisos.push(['umid', `Umidade baixa ${hum}% — ATENÇÃO`, 1]);

        if (c.temperature_2m >= 38) avisos.push(['calor', `Calor extremo ${Math.round(c.temperature_2m)}°C`, 2]);
        if (c.wind_gusts_10m >= 60) avisos.push(['vento', `Rajadas fortes ${Math.round(c.wind_gusts_10m)} km/h`, 2]);
        if (c.precipitation >= 15) avisos.push(['chuva', `Chuva intensa ${c.precipitation} mm/h`, 2]);
        if ((c.weather_code || 0) >= 95) avisos.push(['raios', `Tempestade com raios`, 3]);

        const idsNow = new Set(avisos.map(a => 'dc-' + a[0]));

        avisos.forEach(a => {
            const id = 'dc-' + a[0];
            const prev = globalAlerts.find(x => x.id === id);

            const isNew = upsertAlert({
                id, type: 'civil', place: cidade, bandeira: (weatherLoc.uf === 'SP' ? BANDEIRA_SP : ''),
                time: prev ? prev.time : Date.now(),
                coords: [weatherLoc.lng, weatherLoc.lat],
                source: 'DEFESA CIVIL (critérios)', detail: a[1], sev: a[2]
            }, { fonte: 'defesaCivil' });

            if (isNew) {
                showToast(`🚨 Defesa Civil ${cidade}: ${a[1]}`, 'warning');
                playAlertTone('civil');
                falarAlertaGenerico(`Atenção. Alerta da Defesa Civil para ${cidade}: ${a[1]}.`);
            }
        });

        globalAlerts = globalAlerts.filter(x => !x.id.startsWith('dc-') || idsNow.has(x.id));
        applyFilters();
        marcarBooted('defesaCivil');
    } catch (e) { console.warn('Defesa Civil:', e.message); }
}

async function fetchMeteoAlerts() {
    // Desativado: api.open-meteo.com/v1/alerts não existe na API pública do Open-Meteo
    // (confirmado na documentação oficial deles — nunca existiu endpoint de alertas).
    // Toda tentativa aqui sempre vai bater 404 na fonte, direto ou via qualquer proxy —
    // não é falha de rede nem de proxy, é chamada pra um endpoint que não é real.
    return;
    try {
        const r = await fetchWithCorsFallback(`https://api.open-meteo.com/v1/alerts?latitude=${weatherLoc.lat}&longitude=${weatherLoc.lng}&radius=100&timezone=auto`);
        if (!r.ok) throw new Error('alerts off');
        const d = await r.json();
        const alerts = Array.isArray(d.alerts) ? d.alerts : [];
        const ids = new Set();
        let novos = 0;

        alerts.forEach(a => {
            const id = ('alert-' + (a.id || a.event || '')).slice(0, 60);
            ids.add(id);
            const prev = globalAlerts.find(x => x.id === id);

            const sevEn = a.level || a.severity || 'Minor';
            const isNew = upsertAlert({
                id, type: 'civil',
                place: `${weatherLoc.nome} — ${a.event || 'Aviso'}`,
                bandeira: (weatherLoc.uf === 'SP' ? BANDEIRA_SP : ''),
                time: a.start ? new Date(a.start).getTime() : (prev ? prev.time : Date.now()),
                coords: [weatherLoc.lng, weatherLoc.lat],
                source: a.sender_name || 'Serviço Meteorológico',
                detail: `${sevEn} • ${(a.headline || a.description || '').slice(0, 280)}`,
                sev: (sevEn === 'Extreme' || sevEn === 'Severe') ? 3 : (sevEn === 'Moderate' ? 2 : 1)
            });

            if (isNew) {
                novos++;
                activeAlertingIds.set(id, Date.now() + 240000);
                showToast(`🛰️ ${a.event || 'Aviso'} (${sevEn})`, 'warning');
                playAlertTone('civil');
            }
        });

        globalAlerts = globalAlerts.filter(x => !x.id.startsWith('alert-') || ids.has(x.id));
        applyFilters();
    } catch (e) { console.warn('Alerts:', e.message); }
}

/* ═══════════════ TOAST ═══════════════ */
const __toastState = { recent: new Map(), seq: 0 };
