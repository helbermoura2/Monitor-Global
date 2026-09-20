// === painel-e-lista.js — Lista lateral, painel de detalhes do evento e câmera do mapa (motor compartilhado por todos os tipos) (linhas originais 3523-5037 do core-app.js) ===

// Escapa texto antes de ir pro innerHTML — necessário porque item.place,
// item.detail etc. vêm crus de feeds externos (EMSC, JMA, GDACS, USGS VONA,
// OSM Overpass via cidades-proximas.js...), que não são confiáveis: um nome
// de lugar/descrição malicioso injetado por qualquer uma dessas fontes (o
// OSM, por exemplo, é editável por qualquer um) executaria HTML/JS arbitrário
// pra todo mundo com o site aberto se fosse interpolado sem escapar.
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function updateFreshnessBar() {
    try {
        const ago = function(ts) {
            if (!ts) return '—';
            const s = Math.round((Date.now() - ts) / 1000);
            if (s < 60) return s + 's';
            if (s < 3600) return Math.round(s / 60) + 'min';
            return Math.round(s / 3600) + 'h';
        };
        const sismoEl = document.getElementById('fresh-sismo');
        const alEl = document.getElementById('fresh-alerts');
        const netEl = document.getElementById('fresh-net');
        if (sismoEl) {
            if (window.__sismoUsingCache && window.__sismoCacheAt) {
                const age = ago(window.__sismoCacheAt);
                sismoEl.innerHTML = 'Sismos: <b class="warn">cache ' + age + '</b>';
                sismoEl.title = 'Dados de cache local — última gravação há ' + age + '. Fontes ao vivo indisponíveis ou sem rede.';
            } else {
                const t = window.__lastSismoSuccess;
                const cls = !t ? 'off' : (Date.now() - t < 120000 ? 'ok' : 'warn');
                sismoEl.innerHTML = 'Sismos: <b class="' + cls + '">há ' + ago(t) + '</b>';
                sismoEl.title = t ? 'Última atualização sísmica ao vivo há ' + ago(t) : 'Aguardando primeira resposta das fontes';
            }
        }
        if (alEl) {
            const n = (typeof globalAlerts !== 'undefined' && globalAlerts) ? globalAlerts.length : 0;
            alEl.innerHTML = 'Alertas: <b>' + n + '</b>';
        }
        if (netEl) {
            const on = navigator.onLine;
            let offNames = [];
            try {
                const st = (window.PRO && window.PRO.sourceState) || {};
                offNames = Object.keys(st).filter(function(k){ return st[k] && st[k].status === 'off'; });
            } catch (e) {}
            if (!on) {
                netEl.innerHTML = 'Rede: <b class="off">offline</b>';
                netEl.title = 'Sem conexão — último estado em cache';
            } else if (offNames.length) {
                netEl.innerHTML = 'Fontes: <b class="warn">' + offNames.length + ' off</b>';
                netEl.title = 'Offline: ' + offNames.join(', ');
            } else {
                netEl.innerHTML = 'Rede: <b class="ok">online</b>';
                netEl.title = '';
            }
        }
        // snooze indicators
        const sn = document.getElementById('fresh-snooze');
        if (sn) {
            const now = Date.now();
            const parts = [];
            if (window.__somSnoozeUntil && window.__somSnoozeUntil > now) {
                parts.push('🔇 som ' + ago(now - (window.__somSnoozeUntil - now) + now).replace(/^/, '') );
                // simpler:
            }
            let txt = '';
            if (window.__somSnoozeUntil && window.__somSnoozeUntil > now) {
                const m = Math.ceil((window.__somSnoozeUntil - now) / 60000);
                txt += '🔇 ' + m + 'min ';
            }
            sn.textContent = txt;
            sn.style.display = txt ? '' : 'none';
        }
    } catch (e) {}
}

function applyFilters() {
    try { if (typeof dedupeFireAlerts === 'function') dedupeFireAlerts(); } catch (e) { console.error('[monitor] dedupeFireAlerts falhou:', e); }
    const mergedAll = buildUnifiedFeed();
    const cnt = { earthquake: 0, fire: 0, storm: 0, hurricane: 0, tornado: 0, tsunami: 0, civil: 0, wind: 0, flood: 0, volcano: 0 };
    mergedAll.forEach(i => { cnt[i.type] = (cnt[i.type] || 0) + 1; });

    const icons = { earthquake: '🌍', fire: '🔥', storm: '⚡', hurricane: '🌀', tornado: '🌪️', tsunami: '🌊', civil: '🚨', wind: '💨', flood: '💧', volcano: '🌋' };
    const tcEl = document.getElementById('type-counters');
    if (tcEl) tcEl.innerHTML = Object.keys(cnt).filter(k => cnt[k] > 0).map(k => `${icons[k]} ${cnt[k]}`).join(' &nbsp;·&nbsp; ') || 'sem eventos';

    let merged = mergedAll;
    if (sidebarFilter !== 'all') merged = merged.filter(i => i.type === sidebarFilter);
    if (soImportantes) merged = merged.filter(i => i.type !== 'earthquake' || i.mag >= 4.5);
    merged = merged.filter(i => confiancaFonte(i).nivel !== 'modelo');
    if (typeof soCriticos !== 'undefined' && soCriticos) merged = merged.filter(isEventoCritico);
    merged = merged.filter(passesGeoFilter);

    /* Modo crise removido — lista sempre completa */

    // ATUALIZADOS sobem temporariamente para o topo, independentemente de
    // terem ocorrido há 3 horas, 12 horas etc. O horário original não é
    // alterado: após 10 minutos o temporizador limpa activeUpdatedIds e este
    // mesmo feed volta à ordem cronológica automaticamente.
    merged = ordenarAtualizadosNoTopo(merged);

    // Fica disponível pro resto do app mesmo que o redesenho abaixo falhe —
    // é por causa dessa linha vir antes que o filtro "BR" e outros consumidores
    // de lastMerged não ficam presos a dados velhos só porque o DOM travou.
    lastMerged = merged;
    try {
        if (typeof EventStore !== 'undefined') {
            EventStore.syncFromLegacy();
            EventStore.notify('filter', { count: merged.length });
        }
    } catch (e) {}

    // Cada passo abaixo mexe no DOM/mapa e pode, em tese, lançar erro com uma
    // combinação específica de dados (ex.: muitos incêndios globais de uma vez).
    // Antes, um erro em QUALQUER um desses passos abortava os que vinham depois
    // — inclusive o próprio redesenho da lista — e como toda chamada externa a
    // applyFilters() já engolia a exceção em silêncio, a tela ficava congelada
    // pra sempre sem nenhum rastro. Agora cada passo é isolado: um falhar não
    // trava os outros, e todos os erros vão pro console.
    try { renderSidebarList(merged); window.__ultimoRenderOk = Date.now(); }
    catch (e) { console.error('[monitor] renderSidebarList falhou:', e); }

    try {
        const l = document.getElementById('events-count-label');
        if (l) l.textContent = `${merged.length} registro${merged.length === 1 ? '' : 's'}`;
    } catch (e) { console.error('[monitor] events-count-label falhou:', e); }

    try { atualizarTickerUltimoEvento(merged[0]); }
    catch (e) { console.error('[monitor] atualizarTickerUltimoEvento falhou:', e); }

    try {
        const fabCount = document.getElementById('mobile-events-fab-count');
        if (fabCount) fabCount.textContent = merged.length;
    } catch (e) { console.error('[monitor] fabCount falhou:', e); }

    try { syncAllMarkers(); } catch (e) { console.error('[monitor] syncAllMarkers falhou:', e); }
    try { updateFeltRadiusLayer(); } catch (e) { console.error('[monitor] updateFeltRadiusLayer falhou:', e); }
    try { updateQuakeLabels(); } catch (e) { console.error('[monitor] updateQuakeLabels falhou:', e); }
    try { updateFreshnessBar(); } catch (e) {}
}

function selectMapEvent(item, speak = false) {
    if (!item) return;
    const idx = globalEvents.findIndex(x => x.id === item.id);
    if (item.type === 'earthquake' && idx >= 0) showEventDetails(idx, false);
    else showAlertDetails(item, false);
    requestAnimationFrame(() => {
        const card = Array.from(document.querySelectorAll('#events .event')).find(el => el.dataset.eventId === String(item.id));
        if (card) {
            card.classList.add('map-selected');
            const list = document.getElementById('events');
            if (list) {
                const cardTop = card.offsetTop;
                const cardBottom = cardTop + card.offsetHeight;
                const viewTop = list.scrollTop;
                const viewBottom = viewTop + list.clientHeight;
                if (cardTop < viewTop || cardBottom > viewBottom) {
                    const target = Math.max(0, cardTop - (list.clientHeight - card.offsetHeight) / 2);
                    list.scrollTo({ top: target, behavior: 'smooth' });
                }
            }
            setTimeout(() => card.classList.remove('map-selected'), 1800);
        }
    });
    if (speak && typeof reproduzirAlertaSismicoManual === 'function' && item.type === 'earthquake') {
        reproduzirAlertaSismicoManual(item);
    }
}
function atualizarTickerUltimoEvento(item) {
    const iconEl = document.getElementById('latest-event-ticker-icon');
    const textEl = document.getElementById('latest-event-ticker-text');
    const kicker = document.getElementById('latest-event-ticker-kicker');
    const box = document.getElementById('latest-event-ticker');
    if (!iconEl || !textEl) return;
    if (!item) {
        iconEl.textContent = '📡';
        textEl.textContent = 'Nenhum evento no filtro atual';
        if (kicker) kicker.textContent = 'AO VIVO';
        if (box) { box.dataset.sev = 'none'; box.style.removeProperty('--ticker-accent'); delete box.dataset.type; }
        document.documentElement.dataset.mgThreat = 'none';
        document.documentElement.style.removeProperty('--mg-threat-color');
        return;
    }
    const meta = TYPE_META[item.type] || TYPE_META.earthquake;
    iconEl.textContent = meta.icon;
    // Mesma cor do selo "NOVO"/"ATUALIZADO" da lista lateral (desktop):
    // sismo usa a cor por magnitude (getHexColor) e ciclone usa a cor da
    // categoria real (classificarCiclone), em vez da cor fixa do tipo —
    // assim um M6.8 pulsa vermelho igual nos dois lugares, não a mesma
    // cor azul genérica de qualquer sismo.
    let accent = meta.color;
    if (item.type === 'earthquake' && typeof getHexColor === 'function') {
        accent = getHexColor(Number(item.mag) || 0);
    } else if ((item.type === 'hurricane' || (typeof looksLikeCyclone === 'function' && looksLikeCyclone(item))) && typeof classificarCiclone === 'function') {
        const w = item.windKmh != null ? item.windKmh : (typeof extractWindKmh === 'function' ? extractWindKmh(item.detail || item.place || '') : null);
        const cycClassif = classificarCiclone(w);
        if (cycClassif && cycClassif.cor) accent = cycClassif.cor;
    }
    if (box && accent) {
        box.style.setProperty('--ticker-accent', accent);
        box.dataset.type = item.type || '';
    }
    const rotulo = item.type === 'earthquake' ? `M${Number(item.mag).toFixed(1)}` : (item.type === 'hurricane' && typeof rotuloCicloneCurto === 'function' ? rotuloCicloneCurto(item) : (item.cycloneLabel || meta.label));
    textEl.textContent = `${rotulo} · ${item.bandeira || ''} ${item.place || ''} · ${formatTime(item.time)}`.replace(/\s+/g, ' ').trim();
    let k = 'AO VIVO';
    if (item.type === 'earthquake' && Number(item.mag) >= 6) k = 'CRÍTICO';
    else if (item.type === 'earthquake' && Number(item.mag) >= 5) k = 'FORTE';
    else if (item.type === 'tsunami' || item.type === 'hurricane') k = 'ALERTA';
    else if (activeUpdatedIds && activeUpdatedIds.has(item.id)) k = 'ATUALIZADO';
    else if (activeAlertingIds && activeAlertingIds.has(item.id)) k = 'NOVO';
    if (kicker) kicker.textContent = k;
    if (box) {
        let sev = 'low';
        if (item.type === 'earthquake') {
            const m = Number(item.mag) || 0;
            sev = m >= 6 ? 'crit' : m >= 5 ? 'high' : m >= 4 ? 'mid' : 'low';
        } else if (item.type === 'tsunami' || item.type === 'hurricane' || item.type === 'volcano') sev = 'high';
        box.dataset.sev = sev;
        // Nível de ameaça em escopo de documento (não só do próprio ticker):
        // cabeçalho e cards da lista puxam a mesma cor/gravidade daqui, em
        // vez de cada componente recalcular por conta própria — a página
        // toda reage visualmente ao evento mais grave do momento.
        document.documentElement.dataset.mgThreat = sev;
        if (accent) document.documentElement.style.setProperty('--mg-threat-color', accent);
    }
}

function severityClassForItem(item) {
    if (!item) return 'pd-sev-none';
    if (item.type === 'earthquake' || (item.mag != null && !item.type)) {
        const m = Number(item.mag) || 0;
        if (m >= 7) return 'pd-sev-extreme';
        if (m >= 6) return 'pd-sev-crit';
        if (m >= 5) return 'pd-sev-high';
        if (m >= 4) return 'pd-sev-mid';
        return 'pd-sev-low';
    }
    if (item.type === 'tsunami') return 'pd-sev-crit';
    if (item.type === 'hurricane' || item.type === 'volcano') return 'pd-sev-high';
    if (item.type === 'tornado' || item.type === 'flood') return 'pd-sev-mid';
    return 'pd-sev-low';
}

function applyPainelSeveridade(item) {
    const panel = document.getElementById('painel-direito');
    if (!panel) return;
    panel.classList.remove('pd-sev-none','pd-sev-low','pd-sev-mid','pd-sev-high','pd-sev-crit','pd-sev-extreme');
    panel.classList.add(severityClassForItem(item));
}

function renderPainelChips(item) {
    const box = document.getElementById('pd-chips');
    if (!box) return;
    if (!item) { box.innerHTML = ''; return; }
    const chips = [];
    const conf = (typeof confiancaFonte === 'function') ? confiancaFonte(item) : null;
    if (item.type === 'earthquake' || item.mag != null) {
        chips.push({ t: item.sourceSummary || item.source || 'Fonte', cls: 'chip-src' });
        if (item.sourceCount > 1) chips.push({ t: item.sourceCount + ' fontes', cls: 'chip-ok' });
        if (item.isPreliminary) chips.push({ t: '? PRELIMINAR', cls: 'chip-upd' });
        if (item.quality) chips.push({ t: 'Q ' + item.quality, cls: 'chip-q' });
        if (activeUpdatedIds && activeUpdatedIds.has(item.id)) chips.push({ t: 'ATUALIZADO', cls: 'chip-upd' });
        else if (!item.isPreliminary) chips.push({ t: 'ATIVO', cls: 'chip-live' });
    } else {
        const meta = (typeof TYPE_META !== 'undefined' && TYPE_META[item.type]) || {};
        chips.push({ t: meta.label || item.type || 'Evento', cls: 'chip-src' });
        chips.push({ t: item.source || '—', cls: 'chip-src' });
        chips.push({ t: 'ATIVO', cls: 'chip-live' });
    }
    if (conf && conf.label) chips.push({ t: conf.label, cls: conf.cls === 'conf-oficial' ? 'chip-ok' : 'chip-src' });
    box.innerHTML = chips.slice(0, 5).map(c => `<span class="pd-chip ${c.cls}">${c.t}</span>`).join('');
}

function renderPainelTimeline(item) {
    const box = document.getElementById('pd-timeline');
    if (!box) return;
    if (!item) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const steps = [];
    const det = item.time ? formatTime(item.time) : '—';
    steps.push({ k: 'Detectado', v: det });
    if (item._updatedAt || (activeUpdatedIds && activeUpdatedIds.has(item.id))) {
        steps.push({ k: 'Atualizado', v: item._deltaTxt ? String(item._deltaTxt).slice(0, 28) : 'revisão' });
    }
    const src = item.sourceSummary || item.source || 'rede';
    steps.push({ k: 'Fontes', v: String(src).slice(0, 24) });
    box.innerHTML = steps.map((s, i) =>
        `<div class="pd-tl-step"><span class="pd-tl-k">${s.k}</span><span class="pd-tl-v">${s.v}</span></div>` +
        (i < steps.length - 1 ? '<span class="pd-tl-sep" aria-hidden="true">›</span>' : '')
    ).join('');
    box.style.display = 'flex';
}

function enrichPainelDetalheUI(item) {
    try {
        applyPainelSeveridade(item);
        renderPainelChips(item);
        renderPainelTimeline(item);
    } catch (e) { console.warn('[pd-ui]', e); }
}

function togglePainelMaisDetalhes(force) {
    const more = document.getElementById('pd-more-details');
    const btn = document.getElementById('pd-more-toggle');
    if (!more || !btn) return;
    const open = typeof force === 'boolean' ? force : more.hasAttribute('hidden');
    if (open) {
        more.removeAttribute('hidden');
        btn.setAttribute('aria-expanded', 'true');
        btn.textContent = 'Menos detalhes ▴';
        document.body.classList.add('pd-more-open');
    } else {
        more.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = 'Mais detalhes ▾';
        document.body.classList.remove('pd-more-open');
    }
}
try { window.togglePainelMaisDetalhes = togglePainelMaisDetalhes; } catch (e) {}

function marcarEventoComoVisto(id, el){
    if (!id) return;
    activeAlertingIds.delete(id);
    activeUpdatedIds.delete(id);
    if (el) el.classList.remove('new-event','new-event-major','new-event-critical','new-event-info','updated-event');
}

const LIST_RENDER_CAP = 120; // evita milhares de nós DOM num dia agitado

function renderSidebarList(items) {
    const c = document.getElementById('events');
    if (!c) return;
    const scrollSalvo = c.scrollTop;
    const agora = Date.now();
    const totalItems = items ? items.length : 0;
    // Cap de render: mantém lastMerged completo (filtros/Story), só limita o DOM
    const renderItems = totalItems > LIST_RENDER_CAP ? items.slice(0, LIST_RENDER_CAP) : (items || []);

    // Assinatura leve: pula rebuild se nada visível mudou (id, selo novo/atualizado, seleção)
    try {
        const sigParts = [
            totalItems,
            eventoSelecionadoId || '',
            sidebarFilter || '',
            geoFilter || '',
            soImportantes ? '1' : '0',
            soCriticos ? '1' : '0'
        ];
        for (let i = 0; i < Math.min(renderItems.length, 40); i++) {
            const it = renderItems[i];
            if (!it) continue;
            sigParts.push(
                String(it.id),
                activeAlertingIds.has(it.id) ? 'n' : '',
                activeUpdatedIds.has(it.id) ? 'u' : '',
                it._deltaTxt || ''
            );
        }
        const sig = sigParts.join('|');
        if (sig === lastListSig && c.childElementCount > 0) {
            // Só restaura destaque do ativo, sem recriar centenas de cards
            try {
                c.querySelectorAll('.event.active').forEach(el => el.classList.remove('active'));
                if (eventoSelecionadoId != null) {
                    const act = c.querySelector('.event[data-event-id="' + CSS.escape(String(eventoSelecionadoId)) + '"]');
                    if (act) act.classList.add('active');
                }
            } catch (e) {}
            return;
        }
        lastListSig = sig;
    } catch (e) { lastListSig = ''; }

    c.innerHTML = '';

    if (!totalItems) {
        // NOVO: antes o "Nenhum evento neste filtro" não dizia qual filtro estava
        // zerando a lista. O filtro geográfico (BR/500km/100km/Me afeta) fica salvo
        // entre sessões — dá pra esquecer que ele ainda está ativo e achar que os
        // dados sumiram, quando na verdade é só um filtro restritivo esquecido ligado.
        const motivos = [];
        if (typeof geoFilter !== 'undefined' && geoFilter && geoFilter !== 'all') {
            const nomeGeo = { br: 'Só Brasil', me: 'Me afeta', '500': 'Raio 500km', '100': 'Raio 100km' }[geoFilter] || geoFilter;
            motivos.push(`filtro geográfico "${nomeGeo}" ativo`);
        }
        if (typeof soImportantes !== 'undefined' && soImportantes) motivos.push('"M4.5+" ativo (só sismos grandes)');
        const aviso = motivos.length
            ? `<div style="font-size:11px;color:#fbbf24;margin-top:10px">⚠️ ${motivos.join(' + ')} — pode estar escondendo eventos que existem.<br><button onclick="geoFilter='all';soImportantes=false;soCriticos=false;try{localStorage.setItem('monitor_geo_filter','all');localStorage.setItem('monitor_so_criticos','0')}catch(e){};document.querySelectorAll('#chips-row [data-geo]').forEach(x=>x.classList.remove('on'));document.getElementById('chip-importantes')&&document.getElementById('chip-importantes').classList.remove('on');document.getElementById('chip-criticos')&&document.getElementById('chip-criticos').classList.remove('on');applyFilters();" style="margin-top:8px;padding:6px 14px;border-radius:8px;border:1px solid #fbbf24;background:transparent;color:#fbbf24;font-size:11px;cursor:pointer">Limpar filtros</button></div>`
            : '';
        c.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#64748b;"><div style="font-size:40px;">📭</div><div style="font-size:13px;">Nenhum evento neste filtro</div>${aviso}</div>`;
        return;
    }

    let grupoAtual = '';
    const frag = document.createDocumentFragment();
    renderItems.forEach(item => {
        const idadeH = (agora - item.time) / 36e5;
        const grupo = idadeH < 1 ? '⏱️ Última hora' : idadeH < 6 ? '🕐 1–6h atrás' : '🕰️ 6–24h atrás';

        if (grupo !== grupoAtual) {
            grupoAtual = grupo;
            if (idadeH >= 1) {
                const gh = document.createElement('div');
                gh.className = 'group-header';
                gh.textContent = grupo;
                frag.appendChild(gh);
            }
        }

        const div = document.createElement('div');
        div.className = 'event';
        div.dataset.eventId = String(item.id);
        div.dataset.eventType = item.type;
        div.tabIndex = 0;
        if (item.id === eventoSelecionadoId) div.classList.add('active');

        const meta = TYPE_META[item.type] || TYPE_META.earthquake;
        const conf=confiancaFonte(item);
        const distVoce = minhaPosicao && item.coords
            ? `<span title="Distância de você">${Math.round(haversine(minhaPosicao.lat, minhaPosicao.lng, item.coords[1], item.coords[0]))} km de você</span>`
            : '';
        const expandido = expandedIds.has(item.id);

        // Fase 3 — dado desatualizado: quando a fonte para de reconfirmar um
        // alerta em andamento (falha de fetch, mudança de critério etc.) sem
        // que o item chegue a ser removido, isso avisa em vez de deixar o
        // registro parado ali parecendo tão fresco quanto um recém-chegado.
        // Não se aplica a sismo — um sismo é um relato único, não algo que a
        // fonte "reconfirma" a cada ciclo.
        let staleTxt = '';
        if (item.type !== 'earthquake' && item._lastSeenAt) {
            const ageMin = (agora - item._lastSeenAt) / 60000;
            if (ageMin >= 120) {
                staleTxt = `<span class="stale-badge stale-off" title="Sem reconfirmação da fonte há ${Math.floor(ageMin / 60)}h">🟠 sem atualização</span>`;
            } else if (ageMin >= 30) {
                staleTxt = `<span class="stale-badge stale-warn" title="Sem reconfirmação da fonte há ${Math.round(ageMin)}min">🟡 desatualizado</span>`;
            }
        }

        // O que mudou de verdade — mostrado direto no card, sem precisar clicar,
        // enquanto o selo "ATUALIZADO" estiver ativo.
        let updatedTxt = '';
        if (activeUpdatedIds.has(item.id) && item._deltaTxt) {
            updatedTxt = `<span class="stale-badge updated-delta">🔄 ${item._deltaTxt}</span>`;
        }

        if (item.type === 'earthquake') {
            const prelimMark = item.isPreliminary
                ? `<span class="prelim-mark" title="Solução automática/preliminar — será atualizada quando a fonte revisar">?</span>`
                : '';
            const placePrefix = item.isPreliminary ? '? ' : '';
            div.innerHTML = `
                <span class="event-icon" aria-hidden="true">${item.mag.toFixed(1)}</span>
                <div class="event-body">
                <div class="event-header">
                    <span class="event-mag ${getMagColorClass(item.mag)}">M${item.mag.toFixed(1)}${prelimMark}</span>
                    ${item.correlationLevel && Number(item.mag)>=5.5 ? `<span class="mg-corr-mini" title="Correlação inteligente de risco">${item.correlationLevel==='ALERTA OFICIAL'?'🌊⚠️':item.correlationLevel==='ALTO'?'🌊🔴':item.correlationLevel==='MODERADO'?'🌊🟠':item.correlationLevel==='ATENÇÃO'?'🌊🟡':'🌊🟢'}</span>` : ''}
                    <span class="event-place">${esc(item.bandeira)} ${placePrefix}${esc(item.place)}</span>
                </div>
                <div class="event-meta">
                    <span>${formatTime(item.time)}</span>
                    <span title="Profundidade">${Math.max(0, item.depth).toFixed(0)} km prof.</span>
                    ${distVoce}
                    <span class="event-source" title="${esc((item.sources||[]).join(' · ')||item.source)}">${esc(item.sourceSummary || item.source)}</span>
                    <span class="conf-badge ${conf.cls}" title="Confiança consolidada">${conf.label}</span>
                    <span class="energy-indicator" title="Energia liberada">Energia ${getEnergyLevel(item.mag)}/10</span>
                    ${updatedTxt}
                </div>
                </div>`;
            div.style.setProperty('--ev-color', getHexColor(item.mag));
        } else {
            const isCyc = item.type === 'hurricane' || looksLikeCyclone(item);
            let cycClassif = null;
            if (isCyc) {
                const w = item.windKmh != null ? item.windKmh : extractWindKmh(item.detail || item.place || '');
                cycClassif = classificarCiclone(w);
            }
            const badgeTxt = isCyc ? rotuloCicloneCurto(item) : (item.cycloneLabel ? item.cycloneLabel : meta.label);
            const placeTxt = isCyc ? nomeCicloneLimpo(item.place)
                : (item.type === 'volcano' ? traduzirTextoVulcanico(item.place)
                : (item.type === 'flood' ? (typeof traduzirTextoEnchente==='function'?traduzirTextoEnchente(item.place):item.place)
                : item.place));
            const flagTxt = isCyc ? (item.bandeira || '🌀') : (item.bandeira || '');
            const detailTxt = isCyc ? detalheCicloneLista(item)
                : (item.type === 'volcano' ? traduzirTextoVulcanico(item.detail || item.activityStatus || item.vulcanicActivity || '')
                : (item.type === 'flood' ? (typeof traduzirTextoEnchente==='function'?traduzirTextoEnchente(item.detail||''): (item.detail||''))
                : (item.detail || '')));
            // Cor do badge: pra ciclones, reflete a categoria real (verde = tempestade
            // tropical, amarelo→roxo = Cat.1→Cat.5) em vez da mesma cor roxa genérica
            // pra tudo — antes um furacão Cat.4 e uma tempestade tropical ficavam
            // visualmente idênticos na lista, só o texto do badge diferenciava.
            const badgeColor = (isCyc && cycClassif) ? cycClassif.cor : meta.color;
            div.innerHTML = `
                <span class="event-icon" aria-hidden="true">${isCyc ? '🌀' : meta.icon}</span>
                <div class="event-body">
                <div class="event-header">
                    <span class="event-type-badge" style="background:${badgeColor}22;color:${badgeColor};border:1px solid ${badgeColor}55;">
                        ${isCyc ? '🌀' : meta.icon} ${esc(badgeTxt)}
                    </span>
                    <span class="event-place">${esc(flagTxt)} ${esc(placeTxt)}</span>
                </div>
                <div class="event-meta">
                    <span>${formatTime(item.time)}</span>
                    ${distVoce}
                    ${detailTxt ? `<span>${esc(detailTxt)}</span>` : ''}
                    ${staleTxt}
                    ${updatedTxt}
                    ${!isCyc ? `<span class="event-source">${esc(item.source)}</span><span class="conf-badge ${conf.cls}" title="Confiança consolidada">${conf.label}</span>` : ''}
                </div>
                </div>`;
            div.style.setProperty('--ev-color', badgeColor);
        }

        if (activeAlertingIds.has(item.id)) {
            const ex = activeAlertingIds.get(item.id);
            if (agora < ex) {
                div.classList.add('new-event');
                div.title = 'Evento novo — clique para marcar como visto';
                if (item.type === 'earthquake') {
                    if (Number(item.mag) >= 6) div.classList.add('new-event-critical');
                    else if (Number(item.mag) >= 5) div.classList.add('new-event-major');
                    else div.classList.add('new-event-info');
                }
                setTimeout(() => {
                    div.classList.remove('new-event','new-event-major','new-event-critical','new-event-info');
                    div.removeAttribute('title');
                    activeAlertingIds.delete(item.id);
                }, ex - agora);
            } else {
                activeAlertingIds.delete(item.id);
            }
        } else if (activeUpdatedIds.has(item.id)) {
            const ex = activeUpdatedIds.get(item.id);
            if (agora < ex) {
                div.classList.add('updated-event');
                div.title = 'Este registro foi atualizado — clique para marcar como visto';
                setTimeout(() => {
                    // O timer global de marcarAtualizadoNoTopo é o responsável por
                    // devolver o card ao lugar original. Este apenas remove a classe
                    // visual se ainda for a mesma revisão.
                    if (activeUpdatedIds.get(item.id) === ex) {
                        div.classList.remove('updated-event');
                        div.removeAttribute('title');
                    }
                }, ex - agora);
            } else {
                activeUpdatedIds.delete(item.id);
            }
        }
        frag.appendChild(div);
    });
    if (totalItems > LIST_RENDER_CAP) {
        const more = document.createElement('div');
        more.className = 'group-header';
        more.style.cssText = 'text-align:center;color:#94a3b8;font-size:11px;padding:10px 8px;';
        more.textContent = 'Mostrando ' + LIST_RENDER_CAP + ' de ' + totalItems + ' — use filtros (tipo, M4.5+, geo) para refinar';
        frag.appendChild(more);
    }
    c.appendChild(frag);
    c.scrollTop = scrollSalvo;
}

// Delegação de clique/teclado em #events: antes, cada card de evento ganhava
// um div.onclick/div.onkeydown NOVO a cada renderSidebarList() — com o filtro
// "Tudo" num dia agitado, isso é centenas de funções alocadas por atualização.
// Agora existe um único listener no contêiner (instalado uma vez), que acha o
// card mais próximo do alvo do evento e busca o item atual em lastMerged pelo
// id — sempre atualizado, sem closure presa a um item de um render antigo.
function handleEventCardActivate(e, isKeyboard) {
    const div = e.target.closest('.event');
    if (!div) return;
    if (isKeyboard && !(e.key === 'Enter' || e.key === ' ')) return;
    const isExpandTarget = !!e.target.closest('.ev-expand');
    // Igual ao comportamento original: pelo teclado, o botão de expandir não
    // tinha ação própria (só clique alternava).
    if (isKeyboard && isExpandTarget) return;
    const idStr = div.dataset.eventId;
    const item = lastMerged.find(x => String(x.id) === idStr);
    if (isExpandTarget) {
        e.stopPropagation();
        toggleExpand(item ? item.id : idStr);
        return;
    }
    if (!item) return;
    if (isKeyboard) e.preventDefault();
    e.stopPropagation();
    marcarEventoComoVisto(item.id, div);
    if (item.type === 'earthquake') {
        const idxNow = globalEvents.findIndex(e2 => e2.id === item.id);
        if (idxNow >= 0) {
            showEventDetails(idxNow, false);
            reproduzirAlertaSismicoManual(item);
        }
    } else if (isKeyboard) {
        selectMapEvent(item, false);
    } else {
        showAlertDetails(item, false);
    }
}
(function installEventsDelegation() {
    function install() {
        const c = document.getElementById('events');
        if (!c) return;
        c.addEventListener('click', (e) => handleEventCardActivate(e, false));
        c.addEventListener('keydown', (e) => handleEventCardActivate(e, true));
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
        install();
    }
})();

function toggleExpand(id) {
    if (expandedIds.has(id)) expandedIds.delete(id);
    else expandedIds.add(id);
    renderSidebarList(lastMerged);
}

/* Resolve link de fonte oficial — evita downloads (.tcw/.txt) e rótulos falsos */
function isUsefulOfficialUrl(url) {
    if (!url || url === '#' || url === 'null' || url === 'undefined') return false;
    try {
        const u = new URL(url, location.href);
        if (!/^https?:$/i.test(u.protocol)) return false;
        const path = u.pathname.toLowerCase();
        // produtos brutos da JTWC/Navy e similares — baixam arquivo em vez de abrir página
        if (/\.(tcw|txt|dat|csv|json|xml|kml|kmz|zip|gz|bin)$/i.test(path)) return false;
        if (/\/products\/[^/]+\.tcw$/i.test(path)) return false;
        return true;
    } catch (e) { return false; }
}
function pickBestSourceUrl(sources) {
    if (!Array.isArray(sources) || !sources.length) return null;
    const scored = sources.map(s => {
        const url = (s && s.url) ? String(s.url) : '';
        let score = 0;
        if (!url) return { url, score: -100 };
        if (/nhc\.noaa\.gov|noaa\.gov|weather\.gov|gdacs\.org|usgs\.gov|emsc-csem|jma\.go\.jp|bom\.gov\.au|metoffice\.gov/i.test(url)) score += 12;
        if (/eonet\.gsfc\.nasa\.gov/i.test(url)) score += 6;
        if (/\.(tcw|txt|dat|csv|json|xml|kml|kmz|zip|gz)$/i.test(url)) score -= 25;
        if (/metoc\.navy\.mil\/jtwc\/products\//i.test(url)) score -= 20;
        if (/^https?:\/\//i.test(url)) score += 1;
        return { url, score };
    }).sort((a, b) => b.score - a.score);
    if (scored[0] && scored[0].score > 0 && isUsefulOfficialUrl(scored[0].url)) return scored[0].url;
    // se só sobrou lixo, tenta o portal JTWC em vez do .tcw
    const navy = sources.find(s => s && s.url && /metoc\.navy\.mil|jtwc/i.test(s.url));
    if (navy) return 'https://www.metoc.navy.mil/jtwc/jtwc.html';
    return null;
}
function resolveOfficialLink(item) {
    if (!item) return { url: null, label: 'Sem fonte', isOfficial: false, note: '' };
    const src = String(item.source || '');
    const id = String(item.id || '');
    const type = String(item.type || '');

    // Sismos
    if (type === 'earthquake' || src === 'USGS' || src === 'EMSC') {
        if (src === 'USGS' || /^us/i.test(id) || /usgs/i.test(id)) {
            const eid = id.replace(/^usgs-?/i, '');
            return {
                url: `https://earthquake.usgs.gov/earthquakes/eventpage/${eid}/executive`,
                label: 'Fonte oficial USGS →',
                isOfficial: true,
                note: ''
            };
        }
        const eid = id.replace(/^emsc-?/i, '');
        // EMSC às vezes usa id numérico; página de busca é mais estável que earthquake.php?id=
        if (/^\d+$/.test(eid)) {
            return {
                url: `https://www.emsc-csem.org/Earthquake_information/earthquake.php?id=${eid}`,
                label: 'Fonte oficial EMSC →',
                isOfficial: true,
                note: ''
            };
        }
        return {
            url: 'https://www.emsc-csem.org/',
            label: 'Portal EMSC →',
            isOfficial: true,
            note: ''
        };
    }

    if (type === 'earthquake' || ['GEOFON','JMA','IGP','ISC','IRIS','FUNVISIS'].includes(src)) {
        const links = {
            GEOFON: ['https://geofon.gfz-potsdam.de/eqinfo/', 'Portal oficial GEOFON →'],
            JMA: ['https://www.data.jma.go.jp/multi/quake/', 'Portal oficial JMA →'],
            IGP: ['https://ultimosismo.igp.gob.pe/', 'Portal oficial IGP →'],
            FUNVISIS: ['http://www.funvisis.gob.ve/', 'Portal oficial FUNVISIS →'],
            ISC: ['https://www.isc.ac.uk/', 'Portal oficial ISC →'],
            IRIS: ['https://www.earthscope.org/data/', 'IRIS / EarthScope →']
        };
        if(links[src]) return {url:links[src][0],label:links[src][1],isOfficial:true,note:''};
    }

    // Open-Meteo = modelo, NÃO aviso oficial
    if (/open-?meteo/i.test(src)) {
        return {
            url: null,
            label: 'Modelo Open-Meteo (não oficial)',
            isOfficial: false,
            note: 'Estimativa por modelo meteorológico — não é aviso de defesa civil.'
        };
    }

    // GDACS
    if (/gdacs/i.test(src) || (item.link && /gdacs\.org/i.test(item.link))) {
        if (isUsefulOfficialUrl(item.link)) {
            return { url: item.link, label: 'Fonte oficial GDACS →', isOfficial: true, note: '' };
        }
        return { url: 'https://www.gdacs.org/', label: 'Portal GDACS →', isOfficial: true, note: '' };
    }

    // NASA EONET
    if (/eonet|nasa/i.test(src) || id.startsWith('eonet')) {
        if (isUsefulOfficialUrl(item.link)) {
            return { url: item.link, label: 'Fonte do evento →', isOfficial: true, note: '' };
        }
        const eonetId = id.replace(/^eonet-(st-)?/, '');
        // Página pública de eventos EONET (JSON legível no browser / referência)
        return {
            url: eonetId ? `https://eonet.gsfc.nasa.gov/api/v3/events/${eonetId}` : 'https://eonet.gsfc.nasa.gov/',
            label: 'Registro NASA EONET →',
            isOfficial: false,
            note: 'EONET agrega fontes; o link direto da agência não estava disponível.'
        };
    }

    // NWS / Weather.gov
    if (/nws|weather\.gov/i.test(src) || (item.link && /weather\.gov/i.test(item.link))) {
        if (isUsefulOfficialUrl(item.link)) {
            return { url: item.link, label: 'Fonte oficial NWS →', isOfficial: true, note: '' };
        }
        return { url: 'https://www.weather.gov/', label: 'Portal NWS →', isOfficial: true, note: '' };
    }

    // Genérico
    if (isUsefulOfficialUrl(item.link)) {
        return { url: item.link, label: 'Fonte oficial →', isOfficial: true, note: '' };
    }
    return {
        url: null,
        label: 'Sem link oficial',
        isOfficial: false,
        note: 'Nenhuma página oficial disponível para este evento.'
    };
}
function applyOfficialLinkToPanel(item) {
    const a = document.getElementById('pd-link');
    if (!a) return;
    const info = resolveOfficialLink(item);
    a.textContent = info.label;
    a.title = info.note || info.label;
    if (info.url) {
        a.href = info.url;
        a.style.opacity = '1';
        a.style.pointerEvents = 'auto';
        a.style.cursor = 'pointer';
        a.removeAttribute('aria-disabled');
        a.onclick = null;
    } else {
        a.href = '#';
        a.style.opacity = '0.55';
        a.style.pointerEvents = 'auto';
        a.style.cursor = 'default';
        a.setAttribute('aria-disabled', 'true');
        a.onclick = function (e) {
            e.preventDefault();
            if (info.note && typeof showToast === 'function') showToast(info.note, 'info');
        };
    }
    // Nota sob o link se existir
    let note = document.getElementById('pd-source-note');
    if (!note) {
        note = document.createElement('div');
        note.id = 'pd-source-note';
        note.style.cssText = 'font-size:10px;color:#94a3b8;margin-top:4px;line-height:1.35;';
        a.parentNode && a.parentNode.appendChild(note);
    }
    note.textContent = info.note || '';
    note.style.display = info.note ? 'block' : 'none';
}


function cinematicFlyTo(o, flash) {
    if (!map) return;
    if (flash) triggerLightningFlash();
    try {
        map.flyTo(Object.assign({ essential: true, easing: CINEMATIC_EASE }, o));
    } catch (e) {}
}

function scheduleNextAutoCycle(ms) {
    clearTimeout(cycleTimeout);
    try { clearTimeout(window.__mgCycleGuard); } catch (e) {}
    // ms = tempo ATÉ a próxima troca (já inclui o voo, se quiser)
    const wait = (typeof ms === 'number' && ms >= 5000) ? ms : 30000;
    cycleTimeout = setTimeout(() => {
        try {
            // Não troca no meio de um voo
            if (map && map.isMoving && map.isMoving()) {
                scheduleNextAutoCycle(4000);
                return;
            }
            const m = (typeof buildUnifiedFeed === 'function') ? buildUnifiedFeed() : [];
            if (!m || !m.length) {
                scheduleNextAutoCycle(20000);
                return;
            }
            const pool = m.slice(0, 50).filter(x => x && x.id !== eventoSelecionadoId);
            const list = pool.length ? pool : m.slice(0, 50);
            const it = list[Math.floor(Math.random() * list.length)];
            if (!it) {
                scheduleNextAutoCycle(20000);
                return;
            }
            window.__mgSoftCycle = true;
            if (it.type === 'earthquake') {
                const i = globalEvents.findIndex(e => e && e.id === it.id);
                if (i !== -1) showEventDetails(i, false);
                else showAlertDetails(it, false);
            } else {
                showAlertDetails(it, false);
            }
        } catch (e) {
            console.warn('[cycle]', e);
            scheduleNextAutoCycle(30000);
        }
    }, wait);
}

function stopMapCamera() {
    try { if (map && typeof map.stop === 'function') map.stop(); } catch (e) {}
    try { clearTimeout(window.__mgRecenterT); } catch (e) {}
    try { clearTimeout(window.__mgRecenterAlertT); } catch (e) {}
    try { clearTimeout(window.__mgSoftFlyT); } catch (e) {}
    try { clearTimeout(window.__mgRadarDelayT); } catch (e) {}
}

/**
 * Transição de câmera.
 * soft=true  → voo único longo (~5.5s), cinematográfico (ciclo automático)
 * soft=false → voo curto (~1.8s) para toque manual / FOCO
 * Retorna a duração usada (ms).
 */
function softFlyToCoords(lng, lat, zoomAlvo, soft) {
    if (!map) return 0;
    userInteractingWithGlobe = true;
    // trava o spin por bastante tempo (voo + um pouco depois)
    try { clearTimeout(window.__mgUnlockSpin); } catch (e) {}
    window.__mgUnlockSpin = setTimeout(() => {
        // só libera se ainda for o mesmo evento
        userInteractingWithGlobe = true; // mantém travado até o próximo ciclo decidir
    }, soft ? 12000 : 4000);

    stopMapCamera();

    let target;
    try {
        target = centroCompensado(lng, lat, zoomAlvo);
    } catch (e) {
        target = [lng, lat];
    }

    // duration controla o tempo total; NÃO misturar com speed (MapLibre prioriza speed)
    const duration = soft ? 6000 : 1800;
    const curve = soft ? 1.6 : 1.25;

    try {
        const opts = {
            center: target,
            zoom: zoomAlvo,
            pitch: 0,
            bearing: 0,
            duration: duration,
            curve: curve,
            essential: true,
            easing: (t) => t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2
        };
        // só no manual usamos speed um pouco maior
        if (!soft) opts.speed = 1.1;
        map.flyTo(opts);
    } catch (e) {
        console.warn('[softFly]', e);
        try { map.jumpTo({ center: target, zoom: zoomAlvo, pitch: 0 }); } catch (e2) {}
        return 300;
    }

    // Re-centra no fim do voo (corrige offset mobile do card)
    try {
        clearTimeout(window.__mgRecenterT);
        window.__mgRecenterT = setTimeout(() => {
            try {
                if (!map) return;
                if (map.isMoving && map.isMoving()) return;
                map.easeTo({
                    center: target,
                    zoom: zoomAlvo,
                    duration: soft ? 800 : 400,
                    essential: true
                });
            } catch (e) {}
        }, duration + 120);
    } catch (e) {}

    return duration;
}

/* ═══════════ PREENCHE O PAINEL DIREITO — SISMO ═══════════ */
// ═══ Painel de detalhe (sismo + qualquer alerta) — reset centralizado ═══
// Vários elementos do painel são reaproveitados por TODOS os tipos de evento
// (rótulos de Profundidade/Intensidade/Energia, o selo de fonte/qualidade do
// sismo, o link do cone oficial do NHC). Antes, cada função de abertura de
// painel (sismo vs. o resto) resetava sua própria lista de campos, e ficava
// fácil um campo novo (ex. o selo "Fonte: X" de um sismo) vazar pro painel
// de outro tipo (ex. um incêndio) quando só uma das duas funções era
// atualizada. Centralizando aqui, só existe UM lugar pra lembrar "resetei
// tudo que é compartilhado" antes de cada função preencher o que é do seu tipo.
function resetPainelDetalheCompartilhado() {
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    set('pd-depth-label', 'Profundidade');
    set('pd-mercalli-label', 'Intensidade (MMI)');
    set('pd-energy-label', 'Energia');
    const magNoteEl = document.getElementById('pd-mag-sources');
    if (magNoteEl) { magNoteEl.style.display = 'none'; magNoteEl.innerHTML = ''; }
    const nhcLink = document.getElementById('nhc-cone-link');
    if (nhcLink) nhcLink.remove();
    const trustBox = document.getElementById('pd-source-trust');
    if (trustBox) { trustBox.style.display='none'; trustBox.innerHTML=''; }
}

function showEventDetails(index, triggerVisualAlert = false, silentRefresh = false) {
    if (!globalEvents[index] || !map) return;
    if (!silentRefresh) {
        closeMobileEventsModalIfOpen();
        scrollToDetailsIfMobile();
        // No ciclo automático, abre o painel sem forçar resize no meio do voo
        const isMobileVp = (typeof window.matchMedia === 'function' && window.matchMedia('(max-width:900px)').matches);
        if (isMobileVp) {
            if (window.__mgSoftCycle) {
                try { document.body.classList.add('mobile-details-mid'); } catch (e) {}
            } else {
                abrirPainelDetalhesMobile();
            }
        } else {
            // Desktop: limpa classes mobile que vazam faixa preta / sheet
            try {
                document.body.classList.remove('mobile-details-mid', 'mobile-details-open', 'mobile-events-open');
            } catch (e) {}
        }
    }
    currentIndex = index;
    eventoSelecionadoId = globalEvents[index].id;
    try { if (typeof EventStore !== 'undefined') EventStore.setSelected(eventoSelecionadoId); } catch (e) {}
    if (!silentRefresh) renderSidebarList(lastMerged);

    const item = globalEvents[index];
    const [lng, lat] = item.coords;
    const mec = item.mecanismoReal || calcularMecanismoFocal(item.depth, lat, lng, item.place);
    const mer = estimarMercalli(item.mag, item.depth);
    const en = calcularEnergia(item.mag);
    const his = getHistoricoRegional(lat, lng, 500, 30);
    const country = getCountryByCoords(lat, lng);
    const paisTxt = item.pais || country.nome;

    let titulo = item.place;
    if (item.pais) {
        const semPais = item.place.replace(new RegExp(',?\\s*' + escapeRegExp(item.pais) + '$', 'i'), '').trim();
        if (semPais) titulo = semPais;
    }

    setGauge(item.mag, true);
    resetPainelDetalheCompartilhado();
    document.getElementById('pd-source').innerHTML = `ANÁLISE SÍSMICA`;
    document.getElementById('pd-flag').innerHTML = item.bandeira || country.flag;
    try { enrichPainelDetalheUI(item); } catch (e) {}

    const regiaoIgual = paisTxt && titulo.toLowerCase().includes(paisTxt.toLowerCase());
    document.getElementById('pd-local').textContent = `${titulo}${regiaoIgual ? '' : ' — ' + paisTxt}`;
    document.getElementById('pd-horario').textContent = `${formatBrasiliaDateTime(item.time)} (${formatTime(item.time)})`;
    // NOVO: distância até sua localização real (a mesma usada no "km de você" da
    // lista lateral), agora também visível no card grande de detalhes.
    const distEl = document.getElementById('pd-distvoce');
    if (distEl) {
        if (minhaPosicao && item.coords) {
            const km = Math.round(haversine(minhaPosicao.lat, minhaPosicao.lng, item.coords[1], item.coords[0]));
            distEl.textContent = `📍 ${km.toLocaleString('pt-BR')} km de você`;
            distEl.style.display = 'block';
        } else {
            distEl.style.display = 'none';
        }
    }
    // NOVO: "há Xmin atrás" ficava congelado no momento em que o painel foi aberto.
    // Agora atualiza sozinho a cada minuto enquanto o painel estiver aberto no mesmo evento.
    if (window.__pdTimeTicker) clearInterval(window.__pdTimeTicker);
    window.__pdTimeTicker = setInterval(() => {
        const el = document.getElementById('pd-horario');
        if (!el || eventoSelecionadoId !== item.id) { clearInterval(window.__pdTimeTicker); return; }
        el.textContent = `${formatBrasiliaDateTime(item.time)} (${formatTime(item.time)})`;
    }, 60000);
    let magNote=document.getElementById('pd-mag-sources');
    if(!magNote){ magNote=document.createElement('div'); magNote.id='pd-mag-sources'; magNote.style.cssText='font-size:11px;color:#94a3b8;margin:3px 0 8px;line-height:1.45;text-align:center;'; const anchor=document.getElementById('pd-horario'); anchor && anchor.parentNode.insertBefore(magNote,anchor.nextSibling); }
    const magLines=(item.magnitudes||[]).sort((a,b)=>sismoSourceRank(b.source)-sismoSourceRank(a.source)).map(x=>`${x.source} M${Number(x.mag).toFixed(1)}`).join(' · ');
    const qs = { A: 'A — confirmado por 2+ fontes (ou agência regional prioritária)', B: 'B — fonte única confiável', C: 'C — magnitude baixa / menos precisa' };
    const qLine = item.quality ? `<div style="margin-top:4px"><span class="qselo q-${item.quality}">${item.quality}</span> <span style="color:#94a3b8">${qs[item.quality] || ''}</span></div>` : '';
    const fontLine = item.sourceCount>1
      ? `Fontes: ${magLines}${item.divergentMagnitude ? ` <span style="color:${item.strongMagnitudeDivergence?'#ef4444':'#fbbf24'}">• ΔM ${item.magnitudeSpread.toFixed(1)}</span>` : ''}`
      : (item.sourceSummary || item.source ? `Fonte: ${item.sourceSummary || item.source}` : '');
    magNote.innerHTML = [fontLine, qLine].filter(Boolean).join('');
    magNote.style.display = (fontLine || qLine) ? 'block' : 'none';
    renderConsolidacaoFonte(item);
    // A intensidade não é mais tratada como EST por padrão. Primeiro usamos
    // MMI fornecido pela fonte/ShakeMap; só então caímos para a estimativa do app.
    try {
      const dl = document.getElementById('pd-depth-label');
      const ml = document.getElementById('pd-mercalli-label');
      const el = document.getElementById('pd-energy-label');
      if (dl) dl.innerHTML = 'Profundidade <span class="estimativa-badge" style="background:rgba(74,222,128,.15);color:#86efac" title="Valor reportado pelas agências sísmicas">FONTE</span>';
      if (ml) ml.innerHTML = 'Intensidade (MMI) <span class="estimativa-badge" title="Será substituída por MMI oficial/ShakeMap quando a fonte fornecer esse produto">AGUARDANDO</span>';
      if (el) el.innerHTML = 'Energia <span class="estimativa-badge" title="Equivalente em TNT calculado a partir da magnitude">CALCULADA</span>';
    } catch (e) {}
    const depthClass = classificarProfundidade(Math.max(0, item.depth));
    document.getElementById('pd-depth').innerHTML = `${Math.max(0, item.depth).toFixed(1)} km <span style="color:${depthClass.cor};font-size:11px;font-weight:600">· ${depthClass.label}</span>`;
    document.getElementById('pd-mercalli').innerHTML = `<span style="color:${mer.cor}">${mer.nivel}</span>`;
    // BUG CORRIGIDO: .split(' ')[0] cortava a unidade — "1.9 kg de TNT" virava só
    // "1.9", sem dar pra saber se era kg, ton, kt ou Mt. Agora mostra o valor com
    // unidade, e adiciona uma comparação de escala humana pra sismos M5+.
    document.getElementById('pd-energy').innerHTML = en.tnt.replace(' de TNT', '') +
        (en.comparativo ? `<br><span style="font-size:10px;color:#94a3b8;font-weight:500">${en.comparativo}</span>` : '');
    document.getElementById('pd-fault-arrow').textContent = mec.emoji;
    document.getElementById('pd-fault-type').textContent = mec.tipo + (item.mecanismoReal ? '' : ' · est.');
    document.getElementById('pd-fault-desc').textContent = mec.desc + (item.mecanismoReal ? '' : ' (estimativa geométrica do app, não solução formal USGS.)');

    if (!item.mecanismoReal && !item.mecanismoRealTentado && item.source === 'USGS' && item.mag >= 4.5) {
        item.mecanismoRealTentado = true;
        document.getElementById('pd-fault-arrow').textContent = '⏳';
        document.getElementById('pd-fault-type').textContent = 'Consultando USGS...';
        buscarMecanismoFocalReal(item).then(r => {
            item.mecanismoReal = r;
            const at = globalEvents[currentIndex];
            if (at && at.id === item.id) {
                const m2 = r || calcularMecanismoFocal(item.depth, lat, lng, item.place);
                document.getElementById('pd-fault-arrow').textContent = m2.emoji;
                document.getElementById('pd-fault-type').textContent = m2.tipo;
                document.getElementById('pd-fault-desc').textContent = m2.desc;
            }
        });
    }

    const impactoEstimadoApp = () => mer.desc + ' (estimativa do app com base em magnitude e profundidade; não substitui avaliação oficial.)';
    document.getElementById('pd-impact').textContent = impactoEstimadoApp();
    // Enriquecimento assíncrono: quando o evento for USGS, consulta o registro
    // oficial selecionado e usa MMI/ShakeMap/felt se realmente existir.
    enriquecerIntensidadeSismicaReal(item, impactoEstimadoApp);
    document.getElementById('pd-cities-title').textContent = '🏙️ Cidades Próximas';

    const raioSentido = Math.round(raioEstimado(item.mag, item.depth));
    const raioCrit = Math.round(raioCritico(item.mag, item.depth));
    const raioDet = Math.round(raioDetectavel(item.mag, item.depth));
    const feltLine = `<div class="city-item"><span class="city-name">📢 Pode ser sentido até ~${raioSentido} km • zona crítica ~${raioCrit} km • detectável ~${raioDet} km <span class="estimativa-badge">EST</span></span></div>`;

    document.getElementById('pd-cities').innerHTML = feltLine +
        '<div class="city-item" style="color:#64748b;">🔎 Buscando localidade mais próxima em tempo real…</div>';
    resolverCidadesProximas(lat, lng, 6).then(({ cidades, reserva }) => {
        if (eventoSelecionadoId !== item.id) return; // usuário já trocou de evento
        const el = document.getElementById('pd-cities');
        if (!el) return;
        el.innerHTML = feltLine + renderCidadesHTML(cidades, reserva);
    });

    let hh = '';
    if (his.total > 0) {
        hh += `<div class="history-item"><span>📊 Total na região:</span><span class="history-mag">${his.total}</span></div>`;
        if (his.maior) hh += `<div class="history-item"><span>🔴 Maior:</span><span class="history-mag" style="color:${getHexColor(his.maior.mag)}">M${his.maior.mag.toFixed(1)}</span></div>`;
        his.eventos.slice(0, 3).forEach(e => {
            hh += `<div class="history-item"><span style="color:#94a3b8;">• ${esc(e.place.substring(0, 25))}...</span><span class="history-mag" style="color:${getHexColor(e.mag)}">M${e.mag.toFixed(1)}</span></div>`;
        });
    } else {
        hh = '<div class="history-item" style="color:#64748b;">Nenhum evento recente (30 dias)</div>';
    }
    document.getElementById('pd-history').innerHTML = hh;

    applyOfficialLinkToPanel(item);

    // Badge ATUALIZADO no card principal quando o store marcou revisão
    try {
        const pdSrc = document.getElementById('pd-source');
        if (pdSrc && item._deltaTxt && typeof activeUpdatedIds !== 'undefined' && activeUpdatedIds.has(item.id)) {
            if (!pdSrc.querySelector('.pd-updated-badge')) {
                const b = document.createElement('span');
                b.className = 'pd-updated-badge';
                b.style.cssText = 'margin-left:8px;padding:2px 7px;border-radius:4px;background:#475569;color:#e2e8f0;font-size:9px;font-weight:800;letter-spacing:.4px;vertical-align:middle;';
                b.textContent = 'ATUALIZADO · ' + String(item._deltaTxt).slice(0, 48);
                pdSrc.appendChild(b);
            }
        }
    } catch (e) {}

    if (silentRefresh) {
        // Só dados do card (revisão de magnitude etc.) — sem fly, sem radar, sem ciclo.
        return;
    }

    // Zoom alvo + voo cinematográfico
    let zoomAlvo = 6.6;
    try {
        if (window.matchMedia('(max-width:900px)').matches) zoomAlvo = 6.9;
    } catch (e) {}
    const soft = !!window.__mgSoftCycle;
    window.__mgSoftCycle = false;

    userInteractingWithGlobe = true;
    if (window.returnCameraTimeout) clearTimeout(window.returnCameraTimeout);

    let totalDur = 1800;
    if (triggerVisualAlert) {
        // EVENTO NOVO — voo destacado + 45s de permanência
        stopMapCamera();
        try {
            map.flyTo({
                center: centroCompensado(lng, lat, zoomAlvo),
                zoom: zoomAlvo,
                pitch: 0,
                duration: 4500,
                curve: 1.6,
                essential: true
            });
        } catch (e) {}
        totalDur = 4000;
        if (typeof triggerLightningFlash === 'function') try { triggerLightningFlash(); } catch (e) {}
        scheduleNextAutoCycle(45000);
    } else {
        totalDur = softFlyToCoords(lng, lat, zoomAlvo, soft);
        // 30s de permanência DEPOIS do voo (ciclo automático)
        // manual: agenda 30s também, mas o usuário pode interromper
        scheduleNextAutoCycle(soft ? (totalDur + 30000) : 30000);
    }

    // Radar só perto do fim do voo
    try {
        clearTimeout(window.__mgRadarDelayT);
        window.__mgRadarDelayT = setTimeout(() => {
            try {
                if (eventoSelecionadoId !== item.id) return;
                startContinuousRadar(lng, lat, item.mag);
            } catch (e) {}
        }, soft ? Math.max(2500, totalDur - 600) : 150);
    } catch (e) {
        try { startContinuousRadar(lng, lat, item.mag); } catch (e2) {}
    }
}

function focarEventoNoMapa() {
    try {
        let item = null;
        if (typeof EventStore !== 'undefined') item = EventStore.getSelected();
        if (!item && eventoSelecionadoId != null) {
            item = (globalEvents || []).find(e => e && e.id === eventoSelecionadoId)
                || (globalAlerts || []).find(a => a && a.id === eventoSelecionadoId);
        }
        if (!item || !item.coords || !map) return;
        const [lng, lat] = item.coords;
        let z = 7.0;
        try { if (window.matchMedia('(max-width:900px)').matches) z = 7.2; } catch (e) {}
        userInteractingWithGlobe = true;
        stopMapCamera();
        map.flyTo({
            center: centroCompensado(lng, lat, z),
            zoom: z,
            pitch: 0,
            duration: 1200,
            essential: true
        });
        try { startContinuousRadar(lng, lat, item.mag != null ? item.mag : 5, (typeof RADAR_COR !== 'undefined' && RADAR_COR[item.type]) || null); } catch (e) {}
    } catch (e) { console.warn('[foco]', e); }
}
try { window.focarEventoNoMapa = focarEventoNoMapa; } catch (e) {}

/* ═══════════ PREENCHE O PAINEL DIREITO — ALERTA (não-sismo) ═══════════ */
function showAlertDetails(item, triggerVisualAlert = false, silentRefresh = false) {
    if (!item) return;
    // Sempre resolve a cópia mais recente no store (evita card com versão velha)
    try {
        if (typeof EventStore !== 'undefined' && item.id != null) {
            const fresh = EventStore.getById(item.id);
            if (fresh) item = fresh;
        }
    } catch (e) {}
    if (!silentRefresh) {
        closeMobileEventsModalIfOpen();
        scrollToDetailsIfMobile();
        const isMobileVp = (typeof window.matchMedia === 'function' && window.matchMedia('(max-width:900px)').matches);
        if (isMobileVp) {
            if (window.__mgSoftCycle) {
                try { document.body.classList.add('mobile-details-mid'); } catch (e) {}
            } else {
                abrirPainelDetalhesMobile();
            }
        } else {
            // Desktop: limpa classes mobile que vazam faixa preta / sheet
            try {
                document.body.classList.remove('mobile-details-mid', 'mobile-details-open', 'mobile-events-open');
            } catch (e) {}
        }
    }
    eventoSelecionadoId = item.id;
    try { if (typeof EventStore !== 'undefined') EventStore.setSelected(item.id); } catch (e) {}
    if (!silentRefresh) renderSidebarList(lastMerged);

    resetPainelDetalheCompartilhado();

    const meta = TYPE_META[item.type] || TYPE_META.storm;
    const cor = meta.color;
    const country = item.coords ? getCountryByCoords(item.coords[1], item.coords[0]) : { nome: '', flag: '' };

    setGauge(0, false, meta.icon, cor, 1);
    document.getElementById('pd-source').textContent = meta.label || 'ALERTA';
    try { enrichPainelDetalheUI(item); } catch (e) {}
    document.getElementById('pd-flag').innerHTML = item.bandeira || country.flag;
    const localTxt = item.type === 'flood' && typeof traduzirTextoEnchente === 'function'
        ? traduzirTextoEnchente(item.place) : (item.type === 'volcano' ? traduzirTextoVulcanico(item.place) : item.place);
    document.getElementById('pd-local').textContent = `${item.cycloneLabel ? item.cycloneLabel + ' — ' : ''}${localTxt}`;
    document.getElementById('pd-horario').textContent = `${formatBrasiliaDateTime(item.time)} (${formatTime(item.time)})`;

    document.getElementById('pd-depth').textContent = meta.label;
    document.getElementById('pd-mercalli').innerHTML = `<span style="color:${cor}">${esc(item.source)}</span>`;
    document.getElementById('pd-energy').textContent = 'Ativo';
    renderConsolidacaoFonte(item);

    if (item.type === 'volcano') prepararTextoVulcao(item);
    if (item.type === 'flood' && typeof prepararTextoEnchente === 'function') prepararTextoEnchente(item);

    // Layout do painel adaptado por tipo (4.1.0)
    if (item.type === 'hurricane') {
        const windKmh = (item.windKmh != null) ? item.windKmh : extractWindKmh(item.detail);
        const classif = classificarCiclone(windKmh);
        document.getElementById('pd-depth-label').textContent = 'Categoria';
        document.getElementById('pd-depth').innerHTML = `<span style="color:${classif.cor}">${classif.cat}</span>`;
        document.getElementById('pd-mercalli-label').textContent = 'Vento Máx.';
        document.getElementById('pd-mercalli').innerHTML = windKmh
            ? `<span style="color:${classif.cor}">${windKmh} km/h</span>`
            : `<span style="color:#94a3b8">Sem dado</span>`;
        document.getElementById('pd-energy-label').textContent = item.pressureMb != null ? 'Pressão' : 'Fonte';
        document.getElementById('pd-energy').textContent = item.pressureMb != null
            ? `${item.pressureMb} hPa · ${item.source}`
            : item.source;
        // Link cone oficial NHC se disponível
        try {
            const box = document.getElementById('pd-cities') || document.querySelector('#painel-direito .bubble-section-content');
            // coneUrl vem cru do feed do GDACS — só usa se for http(s) de verdade
            // (evita "javascript:" ou quebra de atributo via aspas no valor).
            if (item.coneUrl && box && /^https?:\/\//i.test(String(item.coneUrl))) {
                const prev = document.getElementById('nhc-cone-link');
                if (prev) prev.remove();
                const a = document.createElement('div');
                a.id = 'nhc-cone-link';
                a.style.cssText = 'margin-top:8px;font-size:11px';
                a.innerHTML = `<a href="${esc(item.coneUrl)}" target="_blank" rel="noopener" style="color:#a855f7;font-weight:700">🌀 Cone / trilha oficial NHC ↗</a>`;
                box.parentNode && box.parentNode.appendChild(a);
            }
        } catch (e) {}
    } else if (item.type === 'storm' || item.type === 'wind') {
        document.getElementById('pd-depth-label').textContent = 'Tipo';
        document.getElementById('pd-depth').textContent = item.type === 'wind' ? 'Rajada' : 'Tempestade';
        document.getElementById('pd-mercalli-label').textContent = 'Intensidade';
        const wk = item.windKmh != null ? item.windKmh : null;
        document.getElementById('pd-mercalli').innerHTML = wk != null
            ? `<span style="color:${cor}">${wk} km/h</span>`
            : `<span style="color:${cor}">Ativo</span>`;
        document.getElementById('pd-energy-label').textContent = 'Fonte';
        document.getElementById('pd-energy').textContent = item.source;
    } else if (item.type === 'flood') {
        const alertaPt = (typeof mgCorPT==='function' && item.gdacsAlertLevel) ? mgCorPT(item.gdacsAlertLevel, true) : (item.gdacsAlertLevel||'ATIVO');
        document.getElementById('pd-depth-label').textContent = 'Tipo';
        document.getElementById('pd-depth').textContent = 'Enchente';
        document.getElementById('pd-mercalli-label').textContent = 'Alerta';
        document.getElementById('pd-mercalli').innerHTML = `<span style="color:${cor}">${alertaPt || 'ATIVO'}</span>`;
        document.getElementById('pd-energy-label').textContent = 'Fonte';
        document.getElementById('pd-energy').textContent = item.source;
    } else if (item.type === 'fire') {
        document.getElementById('pd-depth-label').textContent = 'Tipo';
        document.getElementById('pd-depth').textContent = 'Incêndio';
        document.getElementById('pd-mercalli-label').textContent = 'Status';
        document.getElementById('pd-mercalli').innerHTML = `<span style="color:${cor}">Ativo</span>`;
        document.getElementById('pd-energy-label').textContent = 'Fonte';
        document.getElementById('pd-energy').textContent = item.source;
    } else if (item.type === 'civil') {
        document.getElementById('pd-depth-label').textContent = 'Severidade';
        const sev = Number(item.sev)||1;
        const sevLabel = sev>=3 ? 'ALTA' : sev>=2 ? 'MÉDIA' : 'BAIXA';
        document.getElementById('pd-depth').innerHTML = `<span style="color:${cor}">${sevLabel}</span>`;
        document.getElementById('pd-mercalli-label').textContent = 'Origem';
        document.getElementById('pd-mercalli').textContent = 'Critérios locais';
        document.getElementById('pd-energy-label').textContent = 'Fonte';
        document.getElementById('pd-energy').textContent = item.source;
        } else if (item.type === 'volcano') {
        const gd=String(item.gdacsAlertLevel||'').toLowerCase();
        const av=String(item.aviationColor||'').toLowerCase();
        const ua=String(item.usgsAlertLevel||'').toUpperCase();
        const color=c=>c==='red'?'#ef4444':c==='orange'?'#fb923c':c==='yellow'?'#facc15':c==='green'?'#4ade80':'#94a3b8';
        const gLabel=gd?({green:'VERDE',yellow:'AMARELO',orange:'LARANJA',red:'VERMELHO'}[gd]||gd.toUpperCase()):'SEM NÍVEL';
        const avLabel=av?({green:'VERDE',yellow:'AMARELO',orange:'LARANJA',red:'VERMELHO'}[av]||(typeof mgCorPT==='function'?mgCorPT(av,true):av.toUpperCase())):'N/D';
        const uaLabel=ua?(typeof traduzirStatusVulcao==='function'?traduzirStatusVulcao(ua):ua):'';
        const obsLabel=item.observatory?(typeof mgObsPT==='function'?mgObsPT(item.observatory):item.observatory):'';
        document.getElementById('pd-depth-label').textContent='Nível de alerta GDACS';
        document.getElementById('pd-depth').innerHTML=`<span style="color:${color(gd)}">${gLabel}</span>`;
        document.getElementById('pd-mercalli-label').textContent='Aviação / VONA';
        document.getElementById('pd-mercalli').innerHTML=`<span style="color:${color(av)}">${avLabel}</span>`;
        document.getElementById('pd-energy-label').textContent='USGS VHP';
        document.getElementById('pd-energy').textContent=uaLabel?`${uaLabel}${obsLabel?' · '+obsLabel:''}`:(item.eruptionStatus||'Monitorado');
    } else if (item.type === 'tsunami' || item.type === 'tornado') {
        document.getElementById('pd-depth-label').textContent = 'Tipo';
        document.getElementById('pd-depth').innerHTML = `<span style="color:${cor}">${meta.label}</span>`;
        document.getElementById('pd-mercalli-label').textContent = 'Status';
        document.getElementById('pd-mercalli').innerHTML = `<span style="color:${cor}">ATIVO</span>`;
        document.getElementById('pd-energy-label').textContent = 'Fonte';
        document.getElementById('pd-energy').textContent = item.source;
    }

    document.getElementById('pd-fault-section-label').textContent =
        item.type === 'hurricane' ? 'Dinâmica do sistema' :
        item.type === 'tsunami' ? 'Aviso de tsunami' :
        item.type === 'civil' ? 'Detalhe do alerta' :
        item.type === 'fire' ? 'Informações do foco' :
        item.type === 'volcano' ? 'Atividade vulcânica' :
        item.type === 'flood' ? 'Situação da enchente' : 'Detalhes do evento';
    document.getElementById('pd-fault-arrow').textContent = meta.icon;
    document.getElementById('pd-fault-type').textContent = item.cycloneLabel || meta.label;
    const detalhePt = item.type === 'volcano' ? traduzirTextoVulcanico(item.detail || '')
        : (item.type === 'flood' && typeof traduzirTextoEnchente === 'function' ? traduzirTextoEnchente(item.detail || '') : (item.detail || ''));
    document.getElementById('pd-fault-desc').textContent = detalhePt || 'Sem detalhes adicionais.';
    document.getElementById('pd-impact').textContent = detalhePt || `Monitorado via ${item.source}.`;

    // Distância até você / SP no impacto
    const dYou = eventDistanceKm(item);
    if (dYou != null) {
        const refName = (minhaPosicao ? 'você' : (weatherLoc?.nome || 'SP'));
        const detPt = item.type === 'volcano' ? traduzirTextoVulcanico(item.detail || '')
            : (item.type === 'flood' && typeof traduzirTextoEnchente === 'function' ? traduzirTextoEnchente(item.detail || '') : (item.detail || ''));
        document.getElementById('pd-impact').textContent =
            (detPt ? detPt + ' · ' : '') + `≈ ${Math.round(dYou)} km de ${refName}.`;
    }

    if (item.type === 'tsunami' && item.coords) {
        const ps = getPaisesAfetadosTsunami(item.coords[1], item.coords[0]);
        document.getElementById('pd-cities-title').textContent = '🌊 Países e cidades próximas';
        document.getElementById('pd-cities').innerHTML =
            '<div class="city-item" style="color:#38bdf8;font-size:10px;font-weight:800;">🌊 Países potencialmente afetados (2.000 km)</div>' +
            (ps.length
                ? ps.map(p => `<div class="city-item"><span class="city-name">${p.flag} ${p.nome}</span><span class="city-dist">${p.dist} km</span></div>`).join('')
                : '<div class="city-item" style="color:#64748b;">Nenhum país costeiro em 2.000 km</div>') +
            '<div class="city-item" style="color:#38bdf8;font-size:10px;font-weight:800;border-top:1px solid rgba(148,163,184,.12);margin-top:5px;padding-top:6px;">🏙️ Cidades próximas ao epicentro do tsunami</div>' +
            '<div class="city-item" style="color:#64748b;">🔎 Buscando localidades em tempo real…</div>';
        if (ps.length) {
            document.getElementById('pd-impact').textContent = `Países no raio de 2.000 km: ${ps.map(p => p.nome).join(', ')}.`;
        }
        resolverCidadesProximas(item.coords[1], item.coords[0], 6).then(({ cidades, reserva }) => {
            if (eventoSelecionadoId !== item.id) return;
            const el = document.getElementById('pd-cities');
            if (!el) return;
            const header = '<div class="city-item" style="color:#38bdf8;font-size:10px;font-weight:800;">🏙️ Cidades próximas ao epicentro do tsunami</div>';
            el.innerHTML =
                '<div class="city-item" style="color:#38bdf8;font-size:10px;font-weight:800;">🌊 Países potencialmente afetados (2.000 km)</div>' +
                (ps.length ? ps.map(p => `<div class="city-item"><span class="city-name">${p.flag} ${p.nome}</span><span class="city-dist">${p.dist} km</span></div>`).join('') : '<div class="city-item" style="color:#64748b;">Nenhum país costeiro em 2.000 km</div>') +
                header + renderCidadesHTML(cidades, reserva);
        });
    } else if (item.type === 'volcano') {
        document.getElementById('pd-cities-title').textContent='🌋 Perfil vulcanológico profissional';
        const esc=v=>String(v==null||v===''?'N/D':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
        const fmt=v=>esc(v);
        const gd=String(item.gdacsAlertLevel||'').toLowerCase();
        const av=String(item.aviationColor||'').toLowerCase();
        const ua=String(item.usgsAlertLevel||'').toUpperCase();
        const gdLbl=({green:'VERDE',yellow:'AMARELO',orange:'LARANJA',red:'VERMELHO'}[gd]||(gd?gd.toUpperCase():''));
        const avLbl=({green:'VERDE',yellow:'AMARELO',orange:'LARANJA',red:'VERMELHO'}[av]||(av?av.toUpperCase():''));
        const uaLbl=ua?(typeof traduzirStatusVulcao==='function'?traduzirStatusVulcao(ua):ua):'';
        const badge=gd?`<span class="volcano-color ${gd}">${esc(gdLbl)}</span>`:'<span style="color:#64748b">N/D</span>';
        const avBadge=av?`<span class="volcano-color ${av}">${esc(avLbl)}</span>`:'<span style="color:#64748b">N/D</span>';
        const uaBadge=uaLbl?`<span class="volcano-alert-level">${fmt(uaLbl)}</span>`:'<span style="color:#64748b">N/D</span>';
        const dist=eventDistanceKm(item);
        const vona=item.usgsVona||null;
        const vonaUrl=item.usgsVonaUrl||'';
        const activity=item.activityStatus||item.vulcanicActivity||item.ashStatus||item.detail;
        const ash=item.ashHeight||item.ashStatus||'N/D';
        const citiesTitle='Cidades próximas';
        document.getElementById('pd-cities').innerHTML=`
          <div class="volcano-pro-grid">
            <div><div class="volcano-pro-k">Alerta GDACS</div><div class="volcano-pro-v">${badge}</div></div>
            <div><div class="volcano-pro-k">Código de aviação</div><div class="volcano-pro-v">${avBadge}</div></div>
            <div><div class="volcano-pro-k">USGS / VHP</div><div class="volcano-pro-v">${uaBadge}</div></div>
            <div><div class="volcano-pro-k">VEI</div><div class="volcano-pro-v">${fmt(item.vei)}</div></div>
            <div><div class="volcano-pro-k">Estado eruptivo</div><div class="volcano-pro-v">${fmt(traduzirStatusVulcao(item.eruptionStatus||item.vulcanicActivity))}</div></div>
            <div><div class="volcano-pro-k">Início da atividade</div><div class="volcano-pro-v">${fmt(item.eruptionStart)}</div></div>
            <div><div class="volcano-pro-k">Última atividade</div><div class="volcano-pro-v">${fmt(traduzirTextoVulcanico(item.lastActivity))}</div></div>
            <div><div class="volcano-pro-k">Observatório</div><div class="volcano-pro-v">${fmt((typeof mgObsPT==='function'?mgObsPT(item.observatory):item.observatory))}</div></div>
            <div><div class="volcano-pro-k">VNUM</div><div class="volcano-pro-v">${fmt(item.usgsVnum)}</div></div>
            <div><div class="volcano-pro-k">Distância</div><div class="volcano-pro-v">${dist!=null?Math.round(dist)+' km':'N/D'}</div></div>
            <div class="volcano-pro-wide"><div class="volcano-pro-k">Cinzas / atividade observada</div><div class="volcano-pro-v">${fmt(traduzirTextoVulcanico(activity))}</div></div>
            <div class="volcano-pro-wide"><div class="volcano-pro-k">Cinzas / pluma</div><div class="volcano-pro-v">${fmt(traduzirTextoVulcanico(ash))}${item.ashSource?' · fonte: '+fmt(item.ashSource):''}</div></div>
            ${item.vonaMovement||item.vonaDuration?`<div class="volcano-pro-wide"><div class="volcano-pro-k">VONA — movimento / duração</div><div class="volcano-pro-v">${fmt(traduzirTextoVulcanico(item.vonaMovement||'N/D'))} · ${fmt(traduzirTextoVulcanico(item.vonaDuration||'N/D'))}</div></div>`:''}
            ${item.vonaRemarks?`<div class="volcano-pro-wide"><div class="volcano-pro-k">Observação VONA</div><div class="volcano-pro-v volcano-pro-note">${fmt(traduzirTextoVulcanico(item.vonaRemarks))}</div></div>`:''}
            <div class="volcano-pro-wide"><div class="volcano-pro-k">Fontes consolidadas</div><div class="volcano-pro-v">${fmt(item.sourceSummary||item.source)}</div></div>
            <div class="volcano-pro-wide volcano-pro-links">
              ${vonaUrl?`<a href="${esc(vonaUrl)}" target="_blank" rel="noopener">✈️ Abrir VONA oficial</a>`:''}
              ${item.usgsVolcanoUrl?`<a href="${esc(item.usgsVolcanoUrl)}" target="_blank" rel="noopener">🌋 Perfil USGS</a>`:''}
              ${item.link&&item.source==='GDACS'?`<a href="${esc(item.link)}" target="_blank" rel="noopener">📡 Registro GDACS</a>`:''}
            </div>
          </div>`;
        if(item.coords)resolverCidadesProximas(item.coords[1],item.coords[0],6).then(({cidades,reserva})=>{
            if(eventoSelecionadoId!==item.id)return;
            const el=document.getElementById('pd-cities');if(!el)return;
            el.insertAdjacentHTML('beforeend',`<div style="margin-top:7px;border-top:1px solid rgba(148,163,184,.12);padding-top:5px"><div class="volcano-pro-k">${citiesTitle}</div>${renderCidadesHTML(cidades,reserva)}</div>`);
        });
    } else if (item.type === 'hurricane') {
        document.getElementById('pd-cities-title').textContent = '🧭 Direção Recente (não é previsão oficial)';
        const dirHtml = item.movementInfo
            ? `<div class="city-item"><span class="city-name">➤ Direção recente: ${item.movementInfo.compass} (${Math.round(item.movementInfo.bearing)}°)</span></div>`
            : '<div class="city-item" style="color:#64748b;">Consultando trajetória no GDACS…</div>';
        document.getElementById('pd-cities').innerHTML = dirHtml +
            '<div class="city-item" style="color:#64748b;">🔎 Buscando cidades próximas em tempo real…</div>';
        if (item.coords) {
            resolverCidadesProximas(item.coords[1], item.coords[0], 4).then(({ cidades, reserva }) => {
                if (eventoSelecionadoId !== item.id) return;
                const el = document.getElementById('pd-cities');
                if (!el) return;
                el.innerHTML = dirHtml + renderCidadesHTML(cidades, reserva);
            });
        } else {
            document.getElementById('pd-cities').innerHTML = dirHtml;
        }
    } else {
        // Todos os demais tipos de evento usam exatamente o mesmo resolvedor geográfico:
        // enchente, incêndio, tempestade, vento, alerta civil, sismo etc.
        document.getElementById('pd-cities-title').textContent = '🏙️ Cidades Próximas';
        if (item.coords) {
            document.getElementById('pd-cities').innerHTML =
                '<div class="city-item" style="color:#64748b;">🔎 Buscando cidades próximas em tempo real…</div>';
            resolverCidadesProximas(item.coords[1], item.coords[0], 6).then(({ cidades, reserva }) => {
                if (eventoSelecionadoId !== item.id) return;
                const el = document.getElementById('pd-cities');
                if (!el) return;
                el.innerHTML = renderCidadesHTML(cidades, reserva);
            });
        } else {
            document.getElementById('pd-cities').innerHTML = '<div class="city-item" style="color:#64748b;">Nenhuma cidade grande próxima</div>';
        }
    }

    document.getElementById('pd-history').innerHTML = '<div class="history-item" style="color:#64748b;">Histórico não aplicável a este tipo de evento.</div>';
    applyOfficialLinkToPanel(item);

    try {
        const pdSrc = document.getElementById('pd-source');
        if (pdSrc && item._deltaTxt && typeof activeUpdatedIds !== 'undefined' && activeUpdatedIds.has(item.id)) {
            if (!pdSrc.querySelector('.pd-updated-badge')) {
                const b = document.createElement('span');
                b.className = 'pd-updated-badge';
                b.style.cssText = 'margin-left:8px;padding:2px 7px;border-radius:4px;background:#475569;color:#e2e8f0;font-size:9px;font-weight:800;letter-spacing:.4px;vertical-align:middle;';
                b.textContent = 'ATUALIZADO · ' + String(item._deltaTxt).slice(0, 48);
                pdSrc.appendChild(b);
            }
        }
    } catch (e) {}

    if (silentRefresh) return;

    if (item.coords && map) {
        let zoomEvento = 6;
        if (item.type === 'earthquake') {
            const rDetKm = raioDetectavel(item.mag, item.depth);
            zoomEvento = Math.max(2, Math.min(6, calcZoomParaAlcance(item.coords[1], rDetKm)));
        }
        const centro = centroCompensado(item.coords[0], item.coords[1], zoomEvento);
        const softA = !!window.__mgSoftCycle;
        window.__mgSoftCycle = false;
        const zA = Math.max(zoomEvento, 5.8);
        if (triggerVisualAlert) {
            if (!window.preAlertCamera) {
                try {
                    window.preAlertCamera = {
                        center: map.getCenter(),
                        zoom: map.getZoom(),
                        bearing: map.getBearing(),
                        pitch: map.getPitch()
                    };
                } catch (e) {}
            }
            userInteractingWithGlobe = true;
            stopMapCamera();
            try {
                map.flyTo({
                    center: centro,
                    zoom: zA,
                    pitch: 0,
                    duration: 4500,
                    curve: 1.6,
                    essential: true
                });
            } catch (e) {}
            if (typeof triggerLightningFlash === 'function') try { triggerLightningFlash(); } catch (e) {}
            if (window.returnCameraTimeout) clearTimeout(window.returnCameraTimeout);
            window.returnCameraTimeout = setTimeout(() => {
                if (window.preAlertCamera && map && !map.isMoving()) {
                    try {
                        map.flyTo({
                            center: window.preAlertCamera.center,
                            zoom: window.preAlertCamera.zoom,
                            bearing: window.preAlertCamera.bearing,
                            pitch: window.preAlertCamera.pitch,
                            duration: VOO_VOLTA_DUR,
                            essential: true
                        });
                    } catch (e) {}
                    window.preAlertCamera = null;
                    userInteractingWithGlobe = false;
                }
            }, 45000);
            scheduleNextAutoCycle(45000);
            try {
                clearTimeout(window.__mgRadarDelayT);
                window.__mgRadarDelayT = setTimeout(() => {
                    if (eventoSelecionadoId !== item.id) return;
                    startContinuousRadar(item.coords[0], item.coords[1], 5, RADAR_COR[item.type] || cor);
                }, 2500);
            } catch (e) {
                startContinuousRadar(item.coords[0], item.coords[1], 5, RADAR_COR[item.type] || cor);
            }
        } else {
            const totalDur = softFlyToCoords(item.coords[0], item.coords[1], zA, softA);
            scheduleNextAutoCycle(softA ? (totalDur + 30000) : 30000);
            try {
                clearTimeout(window.__mgRadarDelayT);
                window.__mgRadarDelayT = setTimeout(() => {
                    if (eventoSelecionadoId !== item.id) return;
                    startContinuousRadar(item.coords[0], item.coords[1], 5, RADAR_COR[item.type] || cor);
                }, softA ? Math.max(2000, totalDur - 800) : 200);
            } catch (e) {
                startContinuousRadar(item.coords[0], item.coords[1], 5, RADAR_COR[item.type] || cor);
            }
        }
    } else {
        scheduleNextAutoCycle(30000);
    }
}

/* ====== ✅ FIM DA PARTE 3 — cole a PARTE 4 logo abaixo ====== */

/* ═══════════════ FAIXAS (KPIs + relógio + countdown) ═══════════════ */
