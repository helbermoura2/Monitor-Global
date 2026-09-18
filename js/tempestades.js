// === tempestades.js — Tempestades e rajadas de vento globais/Brasil (linhas originais 7200-7414 do core-app.js) ===

async function fetchGlobalStormCities() {
    try {
        const amostra = CIDADES_MUNDO.filter((_, i) => i % 4 === 0);
        const la = amostra.map(c => c.lat).join(',');
        const lo = amostra.map(c => c.lng).join(',');
        const r = await fetchWithCorsFallback(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=weather_code,wind_gusts_10m,precipitation&timezone=auto`);
        const d = await r.json();
        const res = Array.isArray(d) ? d : [d];
        let nova = false;

        res.forEach((x, i) => {
            const city = amostra[i];
            if (!city || !x || !x.current) return;
            const id = `storm-${city.nome}`;
            if (x.current.weather_code >= 95) {
                const prev = globalAlerts.find(a => a.id === id);
                const isNew = upsertAlert({
                    id, type: 'storm', place: city.nome,
                    bandeira: dicionarioBandeiras[city.pais.toLowerCase()] || '',
                    icon: '⛈️', time: prev ? prev.time : Date.now(),
                    coords: [city.lng, city.lat], source: 'Open-Meteo',
                    detail: `Rajadas ${Math.round(x.current.wind_gusts_10m || 0)} km/h`
                }, { fonte: 'globalStorm' });
                if (isNew) {
                    nova = true;
                    showToast(`⚡ Tempestade em ${city.nome}`, 'warning');
                }
            } else {
                knownAlertIds.delete(id);
                globalAlerts = globalAlerts.filter(a => a.id !== id);
            }
        });
        if (nova) playAlertTone('storm');
        applyFilters();
        marcarBooted('globalStorm');
    } catch (e) { console.error('Tempestades:', e); }
}

/* ═══ RAJADAS DE VENTO SEVERAS — GLOBAL (Open-Meteo, amostragem mundial) ═══ */
const LIMIAR_RAJADA_KMH = 70;
async function fetchGlobalWindGusts() {
    try {
        const amostra = CIDADES_MUNDO.filter((_, i) => i % 3 === 0);
        const la = amostra.map(c => c.lat).join(',');
        const lo = amostra.map(c => c.lng).join(',');
        const r = await fetchWithCorsFallback(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=wind_gusts_10m,wind_speed_10m&timezone=auto`);
        const d = await r.json();
        const res = Array.isArray(d) ? d : [d];
        let nova = false;

        res.forEach((x, i) => {
            const city = amostra[i];
            if (!city || !x || !x.current) return;
            const gust = x.current.wind_gusts_10m || 0;
            const id = `wind-${city.nome}`;
            if (gust >= LIMIAR_RAJADA_KMH) {
                const prev = globalAlerts.find(a => a.id === id);
                const isNew = upsertAlert({
                    id, type: 'wind', place: city.nome,
                    bandeira: dicionarioBandeiras[city.pais.toLowerCase()] || '',
                    icon: '💨', time: prev ? prev.time : Date.now(),
                    coords: [city.lng, city.lat], source: 'Open-Meteo',
                    windKmh: Math.round(gust),
                    detail: `Rajadas ${Math.round(gust)} km/h`
                }, { fonte: 'globalWind' });
                if (isNew) {
                    nova = true;
                    showToast(`💨 Rajadas fortes em ${city.nome} (${Math.round(gust)} km/h)`, 'warning');
                }
            } else {
                knownAlertIds.delete(id);
                globalAlerts = globalAlerts.filter(a => a.id !== id);
            }
        });
        if (nova) playAlertTone('wind');
        applyFilters();
        marcarBooted('globalWind');
    } catch (e) { console.error('Rajadas globais:', e); }
}

// A key da WeatherAPI não fica mais aqui — o Worker guarda ela como secret e
// expõe só a rota /weatherapi?q=lat,lng (ver função weatherApiUrl abaixo).
const weatherApiUrl = (q) => `https://black-sky-9ba0.terrestre.workers.dev/weatherapi?q=${encodeURIComponent(q)}`;
const THUNDER_CODES = new Set([1087, 1273, 1274, 1276, 1279, 1280, 1281, 1282]);

const CIDADES_BR = [
    {nome:"São Paulo",lat:-23.55,lng:-46.63},{nome:"Rio de Janeiro",lat:-22.91,lng:-43.17},
    {nome:"Belo Horizonte",lat:-19.92,lng:-43.94},{nome:"Vitória",lat:-20.32,lng:-40.34},
    {nome:"Curitiba",lat:-25.43,lng:-49.27},{nome:"Porto Alegre",lat:-30.03,lng:-51.23},
    {nome:"Florianópolis",lat:-27.6,lng:-48.55},{nome:"Salvador",lat:-12.97,lng:-38.5},
    {nome:"Recife",lat:-8.05,lng:-34.9},{nome:"Maceió",lat:-9.66,lng:-35.73},
    {nome:"Aracaju",lat:-10.91,lng:-37.07},{nome:"João Pessoa",lat:-7.12,lng:-34.86},
    {nome:"Natal",lat:-5.79,lng:-35.21},{nome:"Fortaleza",lat:-3.72,lng:-38.54},
    {nome:"Teresina",lat:-5.09,lng:-42.8},{nome:"São Luís",lat:-2.53,lng:-44.3},
    {nome:"Belém",lat:-1.45,lng:-48.49},{nome:"Macapá",lat:0.03,lng:-51.07},
    {nome:"Manaus",lat:-3.1,lng:-60.02},{nome:"Boa Vista",lat:2.82,lng:-60.67},
    {nome:"Porto Velho",lat:-8.76,lng:-63.9},{nome:"Rio Branco",lat:-9.97,lng:-67.81},
    {nome:"Cuiabá",lat:-15.6,lng:-56.1},{nome:"Campo Grande",lat:-20.44,lng:-54.65},
    {nome:"Goiânia",lat:-16.68,lng:-49.25},{nome:"Brasília",lat:-15.79,lng:-47.88}
];

async function fetchBrazilStorms() {
    let usados = 0, nova = false, novoBr = null;

    for (const city of CIDADES_BR) {
        const id = `storm-br-${city.nome}`;
        try {
            const r = await fetch(weatherApiUrl(`${city.lat},${city.lng}`));
            if (r.status === 429) break;
            if (!r.ok) throw new Error('wa');
            const d = await r.json();
            const c = d && d.current;
            if (!c) continue;
            usados++;

            const code = (c.condition && c.condition.code) || 0;
            const gust = c.gust_kph || 0;
            const rain = c.precip_mm || 0;
            const thunder = THUNDER_CODES.has(code);
            const tempestade = thunder || gust >= 60 || rain >= 10;

            if (tempestade) {
                const prev = globalAlerts.find(a => a.id === id);
                const obj = {
                    id, type: 'storm', place: `${city.nome}, Brasil`,
                    bandeira: '🇧🇷', pais: 'Brasil',
                    icon: thunder ? '⛈️' : '🌧️',
                    time: prev ? prev.time : Date.now(),
                    coords: [city.lng, city.lat], source: 'WeatherAPI',
                    detail: thunder
                        ? `⛈️ Trovoadas • rajadas ${Math.round(gust)} km/h`
                        : `🌧️ Chuva ${rain} mm • rajadas ${Math.round(gust)} km/h`
                };
                const isNew = upsertAlert(obj, { fonte: 'brStorm' });
                if (isNew) {
                    nova = true;
                    if (!novoBr) novoBr = obj;
                    showToast(`⛈️ Tempestade em ${city.nome}`, 'warning');
                }
            } else {
                knownAlertIds.delete(id);
                globalAlerts = globalAlerts.filter(a => a.id !== id);
            }
        } catch (e) {}
    }

    if (usados === 0) {
        try {
            const la = CIDADES_BR.map(c => c.lat).join(',');
            const lo = CIDADES_BR.map(c => c.lng).join(',');
            const r = await fetchWithCorsFallback(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=weather_code,wind_gusts_10m,precipitation&timezone=auto`);
            const d = await r.json();
            const res = Array.isArray(d) ? d : [d];
            res.forEach((x, i) => {
                const city = CIDADES_BR[i];
                if (!city || !x || !x.current) return;
                const id = `storm-br-${city.nome}`;
                const code = x.current.weather_code || 0;
                const gust = x.current.wind_gusts_10m || 0;
                const rain = x.current.precipitation || 0;
                const tempestade = code >= 95 || gust >= 60 || rain >= 10;
                if (tempestade) {
                    const prev = globalAlerts.find(a => a.id === id);
                    const obj = {
                        id, type: 'storm', place: `${city.nome}, Brasil`,
                        bandeira: '🇧🇷', pais: 'Brasil',
                        icon: code >= 95 ? '⛈️' : '🌧️',
                        time: prev ? prev.time : Date.now(),
                        coords: [city.lng, city.lat], source: 'Open-Meteo',
                        detail: code >= 95
                            ? `⛈️ Tempestade • rajadas ${Math.round(gust)} km/h`
                            : `🌧️ Chuva ${rain} mm • rajadas ${Math.round(gust)} km/h`
                    };
                    const isNew = upsertAlert(obj, { fonte: 'brStorm' });
                    if (isNew) {
                        nova = true;
                        if (!novoBr) novoBr = obj;
                        showToast(`⛈️ Tempestade em ${city.nome}`, 'warning');
                    }
                } else {
                    knownAlertIds.delete(id);
                    globalAlerts = globalAlerts.filter(a => a.id !== id);
                }
            });
        } catch (e) { console.warn('Tempestades BR (reserva):', e.message); }
    }

    if (nova) {
        playAlertTone('storm');
        if (novoBr) showAlertDetails(novoBr, true);
    }
    marcarBooted('brStorm');
    applyFilters();
}

/* ═══════════════ INMET — avisos oficiais (tempestade, chuva, vento…) ═══════════════ */
const UF_NOME = {
  'acre':'AC','alagoas':'AL','amapá':'AP','amapa':'AP','amazonas':'AM','bahia':'BA','ceará':'CE','ceara':'CE',
  'distrito federal':'DF','espírito santo':'ES','espirito santo':'ES','goiás':'GO','goias':'GO','maranhão':'MA','maranhao':'MA',
  'mato grosso':'MT','mato grosso do sul':'MS','minas gerais':'MG','pará':'PA','para':'PA','paraíba':'PB','paraiba':'PB',
  'paraná':'PR','parana':'PR','pernambuco':'PE','piauí':'PI','piaui':'PI','rio de janeiro':'RJ','rio grande do norte':'RN',
  'rio grande do sul':'RS','rondônia':'RO','rondonia':'RO','roraima':'RR','santa catarina':'SC','são paulo':'SP','sao paulo':'SP',
  'sergipe':'SE','tocantins':'TO'
};
const UF_DEFESA = {
  AC:'https://www.defesacivil.ac.gov.br/', AL:'https://defesacivil.al.gov.br/', AM:'https://www.defesacivil.am.gov.br/',
  AP:'https://www.defesacivil.ap.gov.br/', BA:'https://www.defesacivil.ba.gov.br/', CE:'https://www.defesacivil.ce.gov.br/',
  DF:'https://www.defesacivil.df.gov.br/', ES:'https://defesacivil.es.gov.br/', GO:'https://www.defesacivil.go.gov.br/',
  MA:'https://www.defesacivil.ma.gov.br/', MG:'https://www.defesacivil.mg.gov.br/', MS:'https://www.defesacivil.ms.gov.br/',
  MT:'https://www.defesacivil.mt.gov.br/', PA:'https://www.defesacivil.pa.gov.br/', PB:'https://defesacivil.pb.gov.br/',
  PE:'https://www.defesacivil.pe.gov.br/', PI:'https://www.defesacivil.pi.gov.br/', PR:'https://www.defesacivil.pr.gov.br/',
  RJ:'https://www.defesacivil.rj.gov.br/', RN:'https://defesacivil.rn.gov.br/', RO:'https://www.defesacivil.ro.gov.br/',
  RR:'https://www.defesacivil.rr.gov.br/', RS:'https://www.defesacivil.rs.gov.br/', SC:'https://www.defesacivil.sc.gov.br/',
  SE:'https://defesacivil.se.gov.br/', SP:'https://www.defesacivil.sp.gov.br/', TO:'https://www.defesacivil.to.gov.br/'
};
