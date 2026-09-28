// === populacao-sismo.js — Estimativa de pessoas afetadas + MMI por cidade
// para o pop-up "Alcance do sismo" (Modelo A) e a seção fixa em Mais
// Detalhes. Só sismo tem esse conceito (zona sentida por distância); outros
// tipos de evento não usam nada deste arquivo.
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
        el.classList.remove('mg-popup-visivel');
        setTimeout(() => { try { el.remove(); } catch (e) {} }, 400);
    }
}

// Posiciona o card grudado em #painel-direito, "saindo" dele: no desktop
// (card é a sidebar fixa da direita) sai pra esquerda, alinhado ao topo do
// card; no mobile (card é uma barra/sheet no rodapé) sai pra cima, saindo
// do topo do card. Recalcula a cada abertura (não fixo em CSS) porque
// #painel-direito muda de posição/tamanho entre os estados mobile
// (colapsado/mid/aberto) e entre breakpoints.
function posicionarPopupAlcance(card) {
    const painel = document.getElementById('painel-direito');
    const r = painel ? painel.getBoundingClientRect() : null;
    const mobile = window.matchMedia && window.matchMedia('(max-width:900px)').matches;
    card.classList.remove('mg-popup-lado-esquerdo', 'mg-popup-lado-cima');
    if (!r || !r.width || !r.height) {
        // Sem o card pra ancorar (não deveria acontecer) — fallback simples.
        card.style.cssText = 'top:16px;right:16px;';
        card.classList.add('mg-popup-lado-esquerdo');
        return;
    }
    if (mobile) {
        // Sai por cima do card, alinhado às bordas laterais dele.
        card.style.cssText = `left:${Math.max(8, r.left)}px;right:${Math.max(8, window.innerWidth - r.right)}px;bottom:${Math.max(8, window.innerHeight - r.top + 8)}px;`;
        card.classList.add('mg-popup-lado-cima');
    } else {
        // Sai pela esquerda do card, alinhado ao topo dele.
        card.style.cssText = `top:${Math.max(8, r.top)}px;right:${Math.max(8, window.innerWidth - r.left + 10)}px;`;
        card.classList.add('mg-popup-lado-esquerdo');
    }
}

// Agenda a abertura do "slidebar" Alcance do sismo: abre depois de ~12s,
// desliza pra fora de #painel-direito, fica visível por ~10s e retrai
// sozinho de volta — a MESMA informação (cidades + MMI + total de pessoas)
// já fica disponível de forma permanente em #pd-cities (seção "Mais
// detalhes"), então fechar/retrair não faz a informação desaparecer, só
// some o destaque temporário. Sem fundo escurecido nem bloqueio de clique
// no resto da tela — é um anexo do card, não um modal. Só ao vivo e clique
// manual chamam isto — nunca o ciclo automático (mesmo padrão já usado pra
// frente de onda P/S: o auto-ciclo troca de evento rápido demais pra um
// destaque de ~22s fazer sentido).
function agendarPopupAlcanceSismo(lat, lng, item) {
    fecharPopupAlcanceSismo();
    window.__mgPopupAlcanceAbrirT = setTimeout(async () => {
        if (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId !== item.id) return;
        let dados;
        try { dados = await estimarPessoasAfetadas(lat, lng, item.mag, item.depth); }
        catch (e) { return; }
        if (typeof eventoSelecionadoId !== 'undefined' && eventoSelecionadoId !== item.id) return; // trocou de evento enquanto buscava

        // Sempre mostra o slidebar pra TODO evento novo (ao vivo/manual) —
        // mesmo sem nenhuma cidade cadastrada no alcance (área muito remota
        // — oceano aberto, deserto etc.), com uma mensagem explicando em
        // vez de simplesmente não aparecer nada.
        const semCidades = !dados.cidades.length;
        const corpo = semCidades
            ? `<div class="mg-popup-alcance-vazio">Nenhuma cidade cadastrada densamente povoada dentro do alcance detectável — área provavelmente remota (oceano, deserto ou litoral pouco povoado).</div>`
            : `<div class="mg-popup-alcance-list">
                <div class="mg-popup-alcance-listhead"><span>Cidade / distância / população</span><span>MMI</span></div>
                ${dados.cidades.map(linhaCidadePopup).join('')}
                <div class="mg-popup-alcance-credito">Dados de população: <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames.org</a> (CC BY 4.0)</div>
            </div>`;

        const card = document.createElement('div');
        card.id = 'mg-popup-alcance';
        card.className = 'mg-popup-alcance-card';
        card.innerHTML = `
            <div class="mg-popup-alcance-head">
                <span class="mg-popup-alcance-tag">🌍 ALCANCE DO SISMO</span>
                <span class="mg-popup-alcance-close">✕</span>
            </div>
            <div class="mg-popup-alcance-headline">
                <span class="mg-popup-alcance-num">${semCidades ? '—' : formatarPessoasHeadline(dados.totalPessoas)}</span>
                <span class="mg-popup-alcance-sub">${semCidades ? 'sem estimativa de pessoas atingidas' : 'pessoas podem ter sentido este tremor'}</span>
            </div>
            ${corpo}`;
        card.querySelector('.mg-popup-alcance-close').addEventListener('click', fecharPopupAlcanceSismo);
        posicionarPopupAlcance(card);
        document.body.appendChild(card);
        requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('mg-popup-visivel')));

        window.__mgPopupAlcanceFecharT = setTimeout(fecharPopupAlcanceSismo, 10000);
    }, 12000);
}
