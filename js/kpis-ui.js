// === kpis-ui.js — KPIs do topo, filtro de magnitude salvo, skeleton de loading (linhas originais 5038-5126 do core-app.js) ===

function siglaCidade(nome) {
    if (!nome) return '--';
    const small = new Set(['de','do','da','dos','das','e','del','la']);
    const words = String(nome).normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/\s+/).filter(w => w && !small.has(w.toLowerCase()));
    if (!words.length) return String(nome).slice(0,3).toUpperCase();
    if (words.length === 1) return words[0].slice(0,3).toUpperCase();
    return words.slice(0,3).map(w => w[0].toUpperCase()).join('');
}

function brentMercadoFechado() {
    const d = new Date();
    const day = d.getUTCDay();
    const h = d.getUTCHours();
    return day === 6 || (day === 5 && h >= 21) || (day === 0 && h < 21);
}

function updateKPIs() {
    const feed = buildUnifiedFeed();
    const ev = document.getElementById('kpi-eventos');
    if (ev) ev.textContent = feed.length;

    const maior = document.getElementById('kpi-maior');
    if (maior) {
        const sismos = feed.filter(i => i.type === 'earthquake');
        if (sismos.length) {
            const m = sismos.reduce((a, b) => (a.mag > b.mag ? a : b));
            maior.textContent = 'M' + m.mag.toFixed(1);
            maior.style.color = getHexColor(m.mag);
        } else {
            maior.textContent = '--';
        }
    }
}

let nextRefresh = Date.now() + 60000;
setInterval(() => {
    const r = document.getElementById('kpi-relogio');
    if (r) r.textContent = new Date().toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const s = Math.max(0, Math.round((nextRefresh - Date.now()) / 1000));
    document.querySelectorAll('.bs-count').forEach(el => {
        el.textContent = `0:${String(s).padStart(2, '0')}`;
    });
    updateKPIs();
}, 1000);

/* ═══════════════ LOCALSTORAGE (magnitude salva) ═══════════════ */
function carregarMagnitudeSalva() {
    try {
        const salva = localStorage.getItem('monitor_min_mag');
        if (salva !== null) {
            const val = parseFloat(salva);
            if (!isNaN(val) && val >= 0 && val <= 7) {
                minMagnitude = val;
                const slider = document.getElementById('mag-slider');
                const label = document.getElementById('mag-value');
                if (slider) slider.value = val;
                if (label) label.textContent = 'M ' + val.toFixed(1);
            }
        }
    } catch (e) {}
}

function updateMagFilter(val) {
    minMagnitude = parseFloat(val);
    document.getElementById('mag-value').textContent = 'M ' + minMagnitude.toFixed(1);
    try { localStorage.setItem('monitor_min_mag', minMagnitude); } catch (e) {}
    applyFilters();
}

/* ═══════════════ SISMOS (USGS + EMSC) ═══════════════ */
function renderEventsSkeleton() {
    const c = document.getElementById('events');
    let h = '';
    for (let i = 0; i < 6; i++) {
        h += `<div class="event skeleton-card">
            <div class="event-header">
                <div class="skeleton-line" style="width:52px;height:18px;"></div>
                <div class="skeleton-line" style="width:70%;height:12px;"></div>
            </div>
            <div class="skeleton-line" style="width:40%;margin-top:8px;"></div>
        </div>`;
    }
    c.innerHTML = h;
}

