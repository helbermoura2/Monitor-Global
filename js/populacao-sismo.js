// === populacao-sismo.js — Estimativa de pessoas afetadas + MMI por cidade
// para a "virada" do card principal (como uma carta de baralho, ver
// agendarViradaCardAlcance) e a seção fixa em Mais Detalhes. Só sismo tem
// esse conceito (zona sentida por distância); outros tipos de evento não
// usam nada deste arquivo.
//
// Fonte de população: extrato do GeoNames Gazetteer (mirror lmfmaier/
// cities-json, atualizado periodicamente a partir do dump oficial do
// GeoNames) — ~178 mil lugares povoados reais do mundo todo (cidades,
// vilas, sedes administrativas) com população ≥ 500 habitantes, TODOS com
// campo de população preenchido. Bem mais denso que a fonte anterior
// (Natural Earth, ~7,3 mil lugares "notáveis" pra rótulo de mapa) — áreas
// rurais/remotas (ex.: litoral do Iêmen, onde um sismo só encontrava 2
// cidades cadastradas antes) agora têm cobertura de verdade. CC BY 4.0
// (GeoNames exige atribuição — ver crédito em #pd-alcance e no menu de
// fontes), diferente da Natural Earth que era domínio público. Carregado
// uma única vez, sob demanda (só quando o primeiro sismo precisar disso),
// e cacheado em memória pelo resto da sessão. Arquivo bem maior que antes
// (~7MB comprimido) — aceitável pra um recurso opcional carregado uma vez
// por sessão, nunca no carregamento inicial da página.
const GEONAMES_CITIES_URL = 'https://raw.githubusercontent.com/lmfmaier/cities-json/master/cities500.json';

let _lugaresPopulososCache = null;
let _lugaresPopulososInflight = null;

function fetchLugaresPopulosos() {
    if (_lugaresPopulososCache) return Promise.resolve(_lugaresPopulososCache);
    if (_lugaresPopulososInflight) return _lugaresPopulososInflight;
    _lugaresPopulososInflight = fetch(GEONAMES_CITIES_URL)
        .then(r => r.json())
        .then(lista => {
            const lugares = (lista || []).map(p => {
                const lat = Number(p.lat), lng = Number(p.lon), pop = Number(p.pop) || 0;
                const nome = p.name;
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

// "k"/"M" são abreviações comuns em apps técnicos, mas nem todo mundo
// reconhece na hora — escreve por extenso ("mil"/"milhão(ões)") pra não
// exigir essa tradução mental de quem está vendo.
function formatarPessoasHeadline(n) {
    if (n >= 1e6) {
        const milhoes = n / 1e6;
        return milhoes.toFixed(1).replace('.', ',') + (milhoes < 1.05 ? ' milhão' : ' milhões');
    }
    if (n >= 1e3) return Math.round(n / 1e3) + ' mil';
    return String(Math.round(n));
}

function escPopup(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function linhaCidadePopup(c) {
    const mmiHtml = c.mmi
        ? `<span class="pd-flip-verso-mmi" style="color:${c.mmi.cor};background:${c.mmi.cor}22;border-color:${c.mmi.cor}55;">${c.mmi.nivel}</span>`
        : '';
    return `<div class="pd-flip-verso-cidade">
        <span class="pd-flip-verso-cidade-nome">🏙️ ${escPopup(c.nome)}</span>
        <span class="pd-flip-verso-cidade-dist">${Math.round(c.distancia)} km</span>
        <span class="pd-flip-verso-cidade-pop">${c.pop ? formatarPopulacao(c.pop) : '—'}</span>
        ${mmiHtml}
    </div>`;
}

// Timers/estado da "virada" do card principal — só uma por vez, guardado em
// window pra sobreviver a qualquer re-execução acidental do script e pra
// outras funções (troca de evento) conseguirem cancelar de fora.
function fecharViradaCardAlcance() {
    try { clearTimeout(window.__mgFlipAbrirT); } catch (e) {}
    try { clearTimeout(window.__mgFlipFecharT); } catch (e) {}
    try { clearTimeout(window.__mgFlipRemoveT); } catch (e) {}
    try { window.removeEventListener('resize', window.__mgFlipReposiciona); } catch (e) {}
    window.__mgFlipAbrirT = null;
    window.__mgFlipFecharT = null;
    window.__mgFlipRemoveT = null;
    const painel = document.getElementById('painel-direito');
    if (painel) painel.classList.remove('pd-flip-girado', 'pd-flip-preparado');
    const verso = document.getElementById('pd-flip-verso');
    if (verso) { try { verso.remove(); } catch (e) {} }
}

// Cobre o verso exatamente sobre #painel-direito — recalcula a cada abertura
// (não fixo em CSS) porque #painel-direito muda de posição/tamanho entre os
// estados mobile (colapsado/mid/aberto) e entre breakpoints.
function posicionarVersoCard(verso) {
    const painel = document.getElementById('painel-direito');
    const r = painel ? painel.getBoundingClientRect() : null;
    if (!r || !r.width || !r.height) return;
    verso.style.top = r.top + 'px';
    verso.style.left = r.left + 'px';
    verso.style.width = r.width + 'px';
    verso.style.height = r.height + 'px';
}

// Agenda a "virada" do card principal (como uma carta de baralho) pra
// mostrar o alcance do sismo (cidades + MMI + total de pessoas): o tremor de
// entrada (pdQuakeShake, 7s, ver painel-fx.js) acontece normal, 7s depois
// disso (14s desde a seleção) o card vira mostrando o verso, e 12s depois
// (26s desde a seleção) vira de volta pra frente e fica assim — bem menos
// que o tempo total em tela do evento (pedido do usuário: substituir o
// antigo pop-up/slidebar por essa animação no próprio card). A MESMA
// informação já fica disponível de forma permanente em #pd-cities/
// #pd-alcance ("Mais detalhes"), então a virada é só um destaque temporário.
// Busca os dados desde já (t=0) pra já estarem prontos quando a virada
// acontecer aos 14s. Só ao vivo e clique manual chamam isto — nunca o ciclo
// automático (mesmo padrão já usado pra frente de onda P/S: o auto-ciclo
// troca de evento rápido demais pra essa animação fazer sentido).
function agendarViradaCardAlcance(lat, lng, item) {
    fecharViradaCardAlcance();
    const dadosPromise = estimarPessoasAfetadas(lat, lng, item.mag, item.depth).catch(() => null);

    window.__mgFlipAbrirT = setTimeout(async () => {
        if (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId !== item.id) return;
        const painel = document.getElementById('painel-direito');
        if (!painel) return;
        const dados = await dadosPromise;
        if (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId !== item.id) return; // trocou de evento enquanto buscava
        if (!dados) return;

        // Sempre vira o card pra TODO evento novo (ao vivo/manual) — mesmo
        // sem nenhuma cidade cadastrada no alcance (área muito remota —
        // oceano aberto, deserto etc.), com uma mensagem explicando em vez
        // de simplesmente não virar nada.
        const semCidades = !dados.cidades.length;
        const corpo = semCidades
            ? `<div class="pd-flip-verso-vazio">Nenhuma cidade cadastrada densamente povoada dentro do alcance detectável — área provavelmente remota (oceano, deserto ou litoral pouco povoado).</div>`
            : `<div class="pd-flip-verso-list">
                <div class="pd-flip-verso-listhead"><span>Cidade / distância / população</span><span>MMI</span></div>
                ${dados.cidades.map(linhaCidadePopup).join('')}
                <div class="pd-flip-verso-credito">Dados de população: <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames.org</a> (CC BY 4.0)</div>
            </div>`;

        const verso = document.createElement('div');
        verso.id = 'pd-flip-verso';
        verso.className = 'pd-flip-verso';
        verso.innerHTML = `
            <div class="pd-flip-verso-head">
                <span class="pd-flip-verso-tag">🌍 ALCANCE DO SISMO</span>
            </div>
            <div class="pd-flip-verso-headline">
                <span class="pd-flip-verso-num">${semCidades ? '—' : formatarPessoasHeadline(dados.totalPessoas)}</span>
                <span class="pd-flip-verso-sub">${semCidades ? 'sem estimativa de pessoas atingidas' : 'pessoas podem ter sentido este tremor'}</span>
            </div>
            ${corpo}`;
        posicionarVersoCard(verso);
        document.body.appendChild(verso);
        // Reposiciona se a janela mudar de tamanho/orientação enquanto o
        // verso está visível (ex.: girar o celular).
        window.__mgFlipReposiciona = () => posicionarVersoCard(verso);
        window.addEventListener('resize', window.__mgFlipReposiciona);

        painel.classList.add('pd-flip-preparado');
        void painel.offsetWidth; // força reflow pra garantir a transição
        requestAnimationFrame(() => requestAnimationFrame(() => {
            painel.classList.add('pd-flip-girado');
            verso.classList.add('pd-flip-visivel');
        }));

        window.__mgFlipFecharT = setTimeout(() => {
            if (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId !== item.id) return;
            painel.classList.remove('pd-flip-girado');
            verso.classList.remove('pd-flip-visivel');
            try { window.removeEventListener('resize', window.__mgFlipReposiciona); } catch (e) {}
            window.__mgFlipRemoveT = setTimeout(() => {
                try { verso.remove(); } catch (e) {}
                painel.classList.remove('pd-flip-preparado');
            }, 750);
        }, 12000);
    }, 14000);
}
