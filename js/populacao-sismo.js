// === populacao-sismo.js — Estimativa de pessoas afetadas + MMI por cidade
// para o pop-up "Alcance do sismo" (Modelo A) e a seção fixa em Mais
// Detalhes. Só sismo tem esse conceito (zona sentida por distância); outros
// tipos de evento não usam nada deste arquivo.
//
// Fonte de população: Natural Earth "populated places" (domínio público,
// ~7.3 mil cidades no mundo todo, população real e consistente — bem mais
// confiável que o campo de população do OpenStreetMap usado em
// cidades-proximas.js, que falta na maioria das cidades pequenas/médias).
// Carregado uma única vez, sob demanda (só quando o primeiro sismo precisar
// disso), e cacheado em memória pelo resto da sessão.

const NATURAL_EARTH_PLACES_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson';

let _lugaresPopulososCache = null;
let _lugaresPopulososInflight = null;

function fetchLugaresPopulosos() {
    if (_lugaresPopulososCache) return Promise.resolve(_lugaresPopulososCache);
    if (_lugaresPopulososInflight) return _lugaresPopulososInflight;
    _lugaresPopulososInflight = fetch(NATURAL_EARTH_PLACES_URL)
        .then(r => r.json())
        .then(geojson => {
            const lugares = (geojson.features || []).map(f => {
                const p = f.properties || {};
                const lat = Number(p.latitude), lng = Number(p.longitude), pop = Number(p.pop_max) || 0;
                const nome = p.nameascii || p.name;
                if (!nome || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                return { nome, lat, lng, pop };
            }).filter(Boolean);
            _lugaresPopulososCache = lugares;
            return lugares;
        })
        .catch(() => { _lugaresPopulososCache = []; return []; })
        .finally(() => { _lugaresPopulososInflight = null; });
    return _lugaresPopulososInflight;
}

// Classifica a intensidade sentida numa distância dada, reaproveitando os
// MESMOS raios já usados na zona crítica visual (startFeltZone) — sem
// inventar um segundo modelo de atenuação. Ordem real: raioCritico (mais
// apertado, mais forte) < raioEstimado < raioDetectavel (mais largo, mais
// fraco).
function mmiPorDistancia(distanciaKm, mag, depth) {
    if (typeof raioCritico !== 'function') return null;
    const rc = raioCritico(mag, depth);
    const re = raioEstimado(mag, depth);
    const rd = raioDetectavel(mag, depth);
    if (distanciaKm <= rc) return { nivel: 'V-VI', cor: '#fb923c' };
    if (distanciaKm <= re) return { nivel: 'III-IV', cor: '#facc15' };
    if (distanciaKm <= rd) return { nivel: 'I-II', cor: '#4ade80' };
    return null; // fora do alcance detectável — não entra na lista/soma
}

// Retorna { totalPessoas, cidades } — cidades já ordenadas por distância,
// cada uma com {nome, lat, lng, pop, distancia, mmi}. totalPessoas soma a
// população de TODOS os lugares dentro do raio detectável (não só os
// exibidos na lista, que fica limitada a maxC pra não virar uma lista
// infinita) — dá uma estimativa mais completa do alcance real.
async function estimarPessoasAfetadas(lat, lng, mag, depth, maxC = 8) {
    const lugares = await fetchLugaresPopulosos();
    const rd = raioDetectavel(mag, depth);
    const dentroDoAlcance = lugares
        .map(l => ({ ...l, distancia: haversine(lat, lng, l.lat, l.lng) }))
        .filter(l => l.distancia <= rd && l.distancia > 0)
        .sort((a, b) => a.distancia - b.distancia);

    const totalPessoas = dentroDoAlcance.reduce((soma, l) => soma + l.pop, 0);
    const cidades = dentroDoAlcance.slice(0, maxC).map(l => ({
        ...l,
        mmi: mmiPorDistancia(l.distancia, mag, depth)
    }));
    return { totalPessoas, cidades };
}

function formatarPessoasHeadline(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'k';
    return String(Math.round(n));
}

function escPopup(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function linhaCidadePopup(c) {
    const mmiHtml = c.mmi
        ? `<span class="mg-popup-mmi" style="color:${c.mmi.cor};background:${c.mmi.cor}22;border-color:${c.mmi.cor}55;">${c.mmi.nivel}</span>`
        : '';
    return `<div class="mg-popup-cidade">
        <span class="mg-popup-cidade-nome">🏙️ ${escPopup(c.nome)}</span>
        <span class="mg-popup-cidade-dist">${Math.round(c.distancia)} km</span>
        <span class="mg-popup-cidade-pop">${c.pop ? formatarPopulacao(c.pop) : '—'}</span>
        ${mmiHtml}
    </div>`;
}

// Timers/estado do pop-up "Alcance do sismo" — só um por vez, guardado em
// window pra sobreviver a qualquer re-execução acidental do script e pra
// outras funções (troca de evento) conseguirem fechar de fora.
function fecharPopupAlcanceSismo() {
    try { clearTimeout(window.__mgPopupAlcanceAbrirT); } catch (e) {}
    try { clearTimeout(window.__mgPopupAlcanceFecharT); } catch (e) {}
    window.__mgPopupAlcanceAbrirT = null;
    window.__mgPopupAlcanceFecharT = null;
    const el = document.getElementById('mg-popup-alcance');
    if (el) {
        el.classList.add('mg-popup-saindo');
        setTimeout(() => { try { el.remove(); } catch (e) {} }, 350);
    }
}

// Agenda a abertura do pop-up "Alcance do sismo" (Modelo A): abre depois de
// ~12s, fica visível por ~15s e depois se fecha sozinho — a MESMA
// informação (cidades + MMI + total de pessoas) já fica disponível de
// forma permanente em #pd-cities (seção "Mais detalhes"), então fechar o
// pop-up não faz a informação desaparecer, só some o destaque temporário.
// Só ao vivo e clique manual chamam isto — nunca o ciclo automático (mesmo
// padrão já usado pra frente de onda P/S: o auto-ciclo troca de evento
// rápido demais pra um pop-up de ~27s fazer sentido).
function agendarPopupAlcanceSismo(lat, lng, item) {
    fecharPopupAlcanceSismo();
    window.__mgPopupAlcanceAbrirT = setTimeout(async () => {
        if (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId !== item.id) return;
        let dados;
        try { dados = await estimarPessoasAfetadas(lat, lng, item.mag, item.depth); }
        catch (e) { return; }
        if (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId !== item.id) return; // trocou de evento enquanto buscava
        if (!dados.cidades.length) return; // sem nenhuma cidade no alcance — nada pra mostrar

        const overlay = document.createElement('div');
        overlay.id = 'mg-popup-alcance';
        overlay.className = 'mg-popup-alcance-overlay';
        overlay.innerHTML = `
            <div class="mg-popup-alcance-card">
                <div class="mg-popup-alcance-head">
                    <span class="mg-popup-alcance-tag">🌍 ALCANCE DO SISMO</span>
                    <span class="mg-popup-alcance-close">✕</span>
                </div>
                <div class="mg-popup-alcance-headline">
                    <span class="mg-popup-alcance-num">${formatarPessoasHeadline(dados.totalPessoas)}</span>
                    <span class="mg-popup-alcance-sub">pessoas podem ter sentido este tremor</span>
                </div>
                <div class="mg-popup-alcance-list">
                    <div class="mg-popup-alcance-listhead"><span>Cidade / distância / população</span><span>MMI</span></div>
                    ${dados.cidades.map(linhaCidadePopup).join('')}
                </div>
            </div>`;
        overlay.querySelector('.mg-popup-alcance-close').addEventListener('click', fecharPopupAlcanceSismo);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) fecharPopupAlcanceSismo(); });
        document.body.appendChild(overlay);
        requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('mg-popup-visivel')));

        window.__mgPopupAlcanceFecharT = setTimeout(fecharPopupAlcanceSismo, 15000);
    }, 12000);
}
