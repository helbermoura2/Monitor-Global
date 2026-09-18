// === tsunami-tornado.js — Alertas de tsunami (geral) e tornado (linhas originais 8840-8933 do core-app.js) ===

async function fetchTsunamiAlerts() {
    try {
        const r = await fetch('https://api.weather.gov/alerts/active?event=Tsunami%20Warning,Tsunami%20Watch,Tsunami%20Advisory');
        if (!r.ok) throw new Error('NWS off');
        const d = await r.json();
        const ids = new Set();
        let primeiroNovo = null;

        (d.features || []).forEach(a => {
            ids.add(a.id);
            let coords = null;
            if (a.geometry && a.geometry.type === 'Polygon') {
                const ring = a.geometry.coordinates[0];
                coords = [
                    ring.reduce((s, c) => s + c[0], 0) / ring.length,
                    ring.reduce((s, c) => s + c[1], 0) / ring.length
                ];
            }
            const pr = a.properties;
            const obj = {
                id: a.id, type: 'tsunami',
                place: pr.areaDesc || 'Área não especificada',
                bandeira: '🇺🇸',
                time: new Date(pr.sent || Date.now()).getTime(),
                coords, source: 'NWS/NOAA', detail: pr.event
            };
            const isNew = upsertAlert(obj, { fonte: 'tsunamiNws' });

            if (isNew) {
                primeiroNovo = primeiroNovo || obj;
                playAlertTone('tsunami');
                showToast(`🌊 TSUNAMI: ${pr.event}`, 'error');
                notificarNavegador(`🌊 TSUNAMI — ${pr.event}`, pr.areaDesc || '');
            }
        });

        globalAlerts = globalAlerts.filter(al =>
            al.type !== 'tsunami' ||
            ids.has(al.id) ||
            (window.__gdacsTsIds && window.__gdacsTsIds.has(al.id))
        );
        marcarBooted('tsunamiNws');
        applyFilters();
        if (primeiroNovo) showAlertDetails(primeiroNovo, true);
    } catch (e) { console.error('NWS tsunami:', e); }
}

async function fetchTornadoAlerts() {
    try {
        const r = await fetch('https://api.weather.gov/alerts/active?event=Tornado%20Warning,Tornado%20Watch');
        if (!r.ok) throw new Error('NWS off');
        const d = await r.json();
        const ids = new Set();
        let grave = null;

        (d.features || []).forEach(a => {
            ids.add(a.id);
            let coords = null;
            if (a.geometry && a.geometry.type === 'Polygon') {
                const ring = a.geometry.coordinates[0];
                coords = [
                    ring.reduce((s, c) => s + c[0], 0) / ring.length,
                    ring.reduce((s, c) => s + c[1], 0) / ring.length
                ];
            }
            const pr = a.properties;
            const obj = {
                id: a.id, type: 'tornado',
                place: pr.areaDesc || 'Área não especificada',
                bandeira: '🇺🇸',
                time: new Date(pr.sent || Date.now()).getTime(),
                coords, source: 'NWS/NOAA', detail: pr.event
            };
            const isNew = upsertAlert(obj, { fonte: 'tornado' });

            if (isNew && pr.event && pr.event.toLowerCase().includes('warning')) {
                grave = obj;
                playAlertTone('tornado');
                showToast(`🌪️ TORNADO: ${obj.place}`, 'error');
                notificarNavegador(`🌪️ TORNADO WARNING`, obj.place);
            }
        });

        globalAlerts = globalAlerts.filter(al => al.type !== 'tornado' || ids.has(al.id));
        marcarBooted('tornado');
        applyFilters();
        if (grave) showAlertDetails(grave, true);
    } catch (e) { console.error('NWS tornado:', e); }
}

/* ═══════════════ INCÊNDIOS + EONET ═══════════════ */
const EONET = 'https://eonet.gsfc.nasa.gov/api/v3';

// Incêndios: mantemos só América do Sul (nunca apagam os globais, geram muito ruído)
