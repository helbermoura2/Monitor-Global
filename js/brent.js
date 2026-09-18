// === brent.js — Preço do petróleo Brent (linhas originais 6404-6536 do core-app.js) ===

function renderBrent(p, cp, cv, label, real, closed) {
    const el = document.getElementById('kpi-brent');
    const lb = document.getElementById('kpi-brent-label');
    if (el) {
        if (Number.isFinite(p)) {
            const price = p.toFixed(2);
            const change = Number.isFinite(cp) ? `${cp >= 0 ? '▲ +' : '▼ '}${cp.toFixed(1)}%` : '';
            el.innerHTML = `<span class="brent-price">${price}</span>${change ? ` <span class="brent-change ${cp >= 0 ? 'brent-up' : 'brent-down'}">${change}</span>` : ''}`;
            el.style.color = '#f1f7ff';
        } else {
            el.textContent = '--';
            el.style.color = '#94a3b8';
        }
        el.title = label || 'Brent';
    }
    if (lb) {
        if (!real) {
            lb.textContent = '🛢️ BRENT • SEM DADOS';
            lb.style.color = '#f59e0b';
        } else if (closed) {
            lb.textContent = '🛢️ BRENT • FECHADO';
            lb.style.color = '#f59e0b';
        } else {
            lb.textContent = '🛢️ BRENT • ABERTO';
            lb.style.color = '#64748b';
        }
    }
}

function salvarBrentReal(price, prevClose, source) {
    brentBasePrice = price;
    brentPrevClose = Number.isFinite(prevClose) && prevClose > 0 ? prevClose : price;
    brentLastRealAt = Date.now();
    try {
        localStorage.setItem(BRENT_CACHE_KEY, JSON.stringify({
            price: brentBasePrice,
            prevClose: brentPrevClose,
            at: brentLastRealAt,
            source: source || 'real'
        }));
    } catch (e) {}
}

function carregarBrentRealCache() {
    if (brentBasePrice !== null && brentPrevClose !== null && brentLastRealAt) return true;
    try {
        const c = JSON.parse(localStorage.getItem(BRENT_CACHE_KEY) || 'null');
        if (!c || !Number.isFinite(c.price) || c.price < 5 || !Number.isFinite(c.at)) return false;
        if (Date.now() - c.at > BRENT_CACHE_MAX_AGE) return false;
        brentBasePrice = c.price;
        brentPrevClose = Number.isFinite(c.prevClose) && c.prevClose > 0 ? c.prevClose : c.price;
        brentLastRealAt = c.at;
        return true;
    } catch (e) { return false; }
}

function renderBrentReal(price, prevClose, source, marketClosed) {
    salvarBrentReal(price, prevClose, source);
    const pc = brentPrevClose;
    const ch = price - pc;
    renderBrent(price, ch / pc * 100, ch, `REAL • ${source}`, true, marketClosed);
}

async function fetchYahooBrent(url, sourceName) {
    const r = await fetchWithCorsFallback(url, 12000);
    if (!r.ok) throw new Error(`${sourceName}: HTTP ${r.status}`);
    const d = await r.json();
    const res = d?.chart?.result?.[0];
    const m = res?.meta;
    const price = Number(m?.regularMarketPrice);
    const pc = Number(m?.chartPreviousClose ?? m?.previousClose);
    if (!Number.isFinite(price) || price < 5 || price > 300) throw new Error(`${sourceName}: preço inválido`);
    const prev = Number.isFinite(pc) && pc > 0 ? pc : price;
    const closed = m?.marketState ? m.marketState !== 'REGULAR' : brentMercadoFechado();
    renderBrentReal(price, prev, sourceName, closed);
    return true;
}

async function fetchRealBrent() {
    // 1) Yahoo chart — primeira fonte em tempo quase real.
    const yahooUrls = [
        ['https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1m&range=1d', 'YAHOO'],
        ['https://query2.finance.yahoo.com/v8/finance/chart/BZ=F?interval=1m&range=1d', 'YAHOO 2']
    ];
    for (const [url, source] of yahooUrls) {
        try {
            if (await fetchYahooBrent(url, source)) return;
        } catch (e) {
            console.warn(`Brent ${source} falhou:`, e.message || e);
        }
    }

    // 2) Stooq — fallback real, normalmente com fechamento diário.
    try {
        const r = await fetchWithCorsFallback('https://stooq.com/q/d/l/?s=br.f&i=d', 12000);
        if (!r.ok) throw new Error(`STOOQ: HTTP ${r.status}`);
        const txt = await r.text();
        const lines = txt.trim().split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) throw new Error('STOOQ: resposta curta');
        const head = lines[0].split(',');
        const ci = head.indexOf('Close');
        if (ci < 0) throw new Error('STOOQ: coluna Close ausente');
        const rows = lines.slice(1).map(x => x.split(','));
        const valid = rows.filter(row => Number.isFinite(parseFloat(row[ci])));
        if (!valid.length) throw new Error('STOOQ: sem preço válido');
        const last = valid[valid.length - 1];
        const prev = valid.length > 1 ? valid[valid.length - 2] : null;
        const price = parseFloat(last[ci]);
        const pc = prev ? parseFloat(prev[ci]) : price;
        if (!Number.isFinite(price) || price < 5 || price > 300) throw new Error('STOOQ: preço inválido');
        renderBrentReal(price, Number.isFinite(pc) && pc > 0 ? pc : price, 'STOOQ', brentMercadoFechado());
        return;
    } catch (e) {
        console.warn('Brent Stooq falhou:', e.message || e);
    }

    // 3) Última cotação REAL recente. Nunca gerar preço artificial.
    if (carregarBrentRealCache()) {
        const ageMin = Math.max(0, Math.round((Date.now() - brentLastRealAt) / 60000));
        const pc = brentPrevClose;
        const ch = brentBasePrice - pc;
        renderBrent(brentBasePrice, ch / pc * 100, ch, `REAL • ÚLTIMA (${ageMin} min)`, true, brentMercadoFechado());
        return;
    }

    // Sem fonte e sem cache recente: informar indisponibilidade, sem simulação.
    renderBrent(null, null, null, 'SEM DADOS • FONTES OFFLINE', false, brentMercadoFechado());
}

/* ═══════════════ CLIMA LOCAL ═══════════════ */
let weatherLoc = { nome: 'São Paulo', uf: 'SP', lat: SP_LAT, lng: SP_LNG, origem: 'padrão', accuracy: null };


