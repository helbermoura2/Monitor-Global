// === orquestrador-feeds.js — fetchGlobalFeeds — orquestrador que dispara todas as fontes (linhas originais 6038-6403 do core-app.js) ===

// Evita rodadas sobrepostas. fetchGlobalFeeds é chamado de 3 lugares
// independentes (o ciclo normal de 45s, retomarBuscas() ao voltar pra aba, e
// o watchdog de 60s se os sismos pararem de atualizar) — numa rede ruim, uma
// chamada com fallback em 11 fontes pode levar dezenas de segundos, tempo
// suficiente pra um desses gatilhos disparar outra rodada por cima. Sem essa
// trava, a rodada mais LENTA podia terminar DEPOIS da mais rápida e
// sobrescrever globalEvents com dado já superado (ex.: uma preliminar velha
// pisando por cima de uma revisão mais nova).
let __fetchGlobalFeedsEmAndamento = false;


// Revisões aguardam os eventos novos/ao vivo; maior magnitude vem primeiro.
const pendingNewCameraQuakes = new Map();
function queueNewCameraQuakes(items) {
    for (const item of items || []) {
        if (item && item.id != null) pendingNewCameraQuakes.set(item.id, {arrived:Date.now()});
    }
    // The election UI cannot prevent an arrival from entering the camera queue.
    try { window.ElectionPanel?.newQuakes(items); } catch(e) { console.warn('[prioridade sísmica] eleição:',e); }
}
function isRecentCameraQuake(event){
    const age=Date.now()-Number(event?.time);
    const limit=typeof SISMO_NOVO_RECENTE_MS==='number'?SISMO_NOVO_RECENTE_MS:30*60000;
    return Number.isFinite(age)&&age>=-5*60000&&age<=limit;
}
function focusNextNewCameraQuake(minMagnitude = 0) {
    if(document.hidden)return false;
    if (!map) return false;
    const current=globalEvents.find(e=>e && e.id===eventoSelecionadoId);
    const currentMag=Number(current?.mag) || 0;
    const protectedSelection = window.__mgQuakePresentationMode !== 'auto' &&
        window.__mgRevisionProtectedId === eventoSelecionadoId && Date.now() < (window.__mgRevisionProtectedUntil || 0) &&
        (window.__mgQuakePresentationMode==='new' || currentMag>=5 || isRecentCameraQuake(current));
    const candidates = [],included=new Set();
    for (const [id, entry] of pendingNewCameraQuakes) {
        const index = globalEvents.findIndex(e => e && e.id === id);
        if (index < 0 || id === eventoSelecionadoId || !isWithinAutoCycleAge(globalEvents[index])) { pendingNewCameraQuakes.delete(id); continue; }
        candidates.push({index, event:globalEvents[index], arrived:entry.arrived});included.add(id);
    }
    // Revisions can raise an already known event above the quake on screen.
    // Also recover a newly badged arrival if its enqueue path was interrupted.
    for(let index=0;index<globalEvents.length;index++){
        const event=globalEvents[index];
        if(!event||!isRecentCameraQuake(event)||event.id===eventoSelecionadoId||included.has(event.id))continue;
        const revision=pendingQuakeRevisions.get(event.id);
        const freshBadge=typeof activeAlertingIds!=='undefined'&&(activeAlertingIds.get(event.id)||0)>Date.now();
        const presented=window.__mgQuakeCameraPresented?.get(event.id);
        const raised=revision&&Number(event.mag)>Number(revision._previousMag??presented??event.mag);
        if(raised&&Number(event.mag)<=currentMag&&!freshBadge)continue;
        if(!raised&&(!freshBadge||(presented!=null&&presented>=Number(event.mag))))continue;
        const arrived=Number(revision?._updatedAt||event._novoAt)||Date.now();
        candidates.push({index,event,arrived});
        if(freshBadge&&!pendingNewCameraQuakes.has(event.id))pendingNewCameraQuakes.set(event.id,{arrived});
    }
    candidates.sort((a,b)=>Number(b.event.mag)-Number(a.event.mag) || b.arrived-a.arrived);
    if (minMagnitude > 0) {
        for (let i=candidates.length-1;i>=0;i--) if(Number(candidates[i].event.mag)<minMagnitude)candidates.splice(i,1);
    }
    if (!candidates.length) return false;
    const next=candidates[0];
    if(Number(next.event.mag)<5&&window.VolcanoPriority?.presentationActive())return false;
    // Automatic revisits never delay a newly arrived quake. A larger arrival
    // may interrupt a live/manual hold; equal or smaller arrivals wait.
    if (protectedSelection && Number(next.event.mag)<=currentMag) return false;
    pendingNewCameraQuakes.delete(next.event.id);
    pendingQuakeRevisions.delete(next.event.id);
    window.__mgSoftCycle=false;
    showEventDetails(next.index,true);
    return true;
}
const pendingQuakeRevisions = new Map();
function queueQuakeRevisions(items) {
    for (const item of items || []) {
        if (item && item.id != null) pendingQuakeRevisions.set(item.id, item);
    }
}
function focusNextQuakeRevision(blocked = false) {
    if(document.hidden)return false;
    // Chegadas novas têm prioridade sobre todas as revisões pendentes.
    if (focusNextNewCameraQuake()) return true;
    if (pendingNewCameraQuakes.size || window.NewEventPriority?.hasPending()) return false;
    const live = window.__mgLiveQuakeId === eventoSelecionadoId &&
        Date.now() < (window.__mgLiveQuakeUntil || 0);
    const protectedSelection = window.__mgRevisionProtectedId === eventoSelecionadoId &&
        Date.now() < (window.__mgRevisionProtectedUntil || 0);
    if (blocked || live || protectedSelection || window.__mgResumeRotation || !map) return false;
    const candidates = [];
    for (const [id, revision] of pendingQuakeRevisions) {
        const index = globalEvents.findIndex(e => e && e.id === id);
        if (index < 0 || id===eventoSelecionadoId || !isWithinAutoCycleAge(globalEvents[index])) { pendingQuakeRevisions.delete(id); continue; }
        candidates.push({index, revision, event:globalEvents[index]});
    }
    candidates.sort((a,b) => (Number(b.event.mag)||0)-(Number(a.event.mag)||0) ||
        (Number(b.revision._updatedAt)||0)-(Number(a.revision._updatedAt)||0));
    const next = candidates[0];
    if (!next) return false;
    pendingQuakeRevisions.delete(next.event.id);
    window.__mgSoftCycle = true;
    showEventDetails(next.index, false);
    window.__mgResumeRotation = true;
    if (typeof showPanelRevisionFocus === 'function') showPanelRevisionFocus(next.revision);
    return true;
}

async function fetchGlobalFeeds() {
    if (__fetchGlobalFeedsEmAndamento) return;
    __fetchGlobalFeedsEmAndamento = true;
    window.__lastSismoAttempt = Date.now();
    window.MonitorFreshness?.beginQuakes();

    try {
        const startTime = new Date(Date.now() - 36 * 3600000).toISOString();
        const endTime = new Date(Date.now() + 5 * 60000).toISOString();

        // BUG CORRIGIDO: minmagnitude vinha fixo em 2.5 aqui, ignorando completamente
        // o slider "Magnitude mínima" da UI (que podia estar em M 0.0) — essas 4 fontes
        // (USGS/GEOFON/ISC) nunca devolviam nada abaixo de 2.5, não importa o que
        // o usuário escolhesse. Agora usa minMagnitude de verdade, com piso de 0.1
        // (o usuário pediu "tudo, de 0.1 pra cima"). orderby também trocou de
        // time-asc pra time-desc: com minmagnitude baixo o volume de eventos pode
        // passar do "limit" — em ordem ascendente isso cortava os mais RECENTES
        // (ficavam só os mais antigos da janela); em ordem descendente o corte
        // sacrifica os mais antigos, que é o que faz sentido pra um monitor ao vivo.
        const minMagQuery = Math.max(0.1, typeof minMagnitude === 'number' ? minMagnitude : 0.1);
        const base =
            `format=geojson` +
            `&starttime=${encodeURIComponent(startTime)}` +
            `&endtime=${encodeURIComponent(endTime)}` +
            `&minmagnitude=${minMagQuery}` +
            `&limit=1000` +
            `&orderby=time`;

        const tasks = [
            fetchFdsnGeoJSON(`https://earthquake.usgs.gov/fdsnws/event/1/query?${base}`, 'USGS'),
            fetchUsgsRealtimeFeeds(), // preliminares rápidos (all_hour / 2.5_day / all_day)
            fetchOVSICORIData(),
            fetchMARNSismos(),
            fetchGeofonData(),        // GEOFON/GFZ — boa cobertura Ásia/Pacífico
            fetchFunvisisData(),      // FUNVISIS Venezuela (espelho comunitário oficial)
            fetchJMAData(),
            fetchIGPData(),
            fetchOSCBoliviaData(),
            fetchBMKGData(),
            fetchGeoNetData(),
            fetchUspSismos(),
            fetchCSNChileData(),      // CSN Chile — trecho mais ativo do Círculo de Fogo
            fetchSSNMexicoData(),     // SSN México — subducção Cocos/Rivera
            fetchEMSCData().then(features => normalizarSismoGeoJSON(features, 'EMSC', {
                mag: (f, p) => p.mag,
                time: (f, p) => Date.parse(p.time || p.origin_time || ''),
                place: (f, p) => p.flynn_region || p.place || '',
                detailUrl: () => null,
                status: (f, p) => p.status || p.evalMode || ''
            }))
        ];

        const names = [
            'USGS', 'USGS-RT', 'OVSICORI', 'MARN-SV', 'GEOFON', 'FUNVISIS', 'JMA',
            'IGP', 'OSC-BOL', 'BMKG', 'GEONET', 'USP',
            'CSN-Chile', 'SSN-Mexico', 'EMSC'
        ];

        // Publish the first successful catalog while slower agencies continue.
        // Keep isFirstLoad true until the full merge, avoiding startup alarms.
        const progressiveTasks = tasks.map(task => Promise.resolve(task).then(rows => {
            if (isFirstLoad && isFirstDisplay && !window.__mgInitialCatalogReady && Array.isArray(rows) && rows.length) {
                window.__mgInitialCatalogReady = true;
                globalEvents = mergeEarthquakeReports(rows).map(ev => {
                    ev.id = `EQ-${Math.round(ev.time / 1000)}-${ev.coords[1].toFixed(3)}-${ev.coords[0].toFixed(3)}`;
                    knownEventIds.add(ev.id);
                    return ev;
                });
                window.globalEvents = globalEvents;
                applyFilters();
            }
            return rows;
        }));
        const settled = await Promise.allSettled(progressiveTasks);
        const reports = [];
        const sourceStatus = {};
        const sourceErrors = {};

        settled.forEach((result, i) => {
            const name = names[i];
            window.MonitorFreshness?.record(name,result.status==='fulfilled');

            if (result.status === 'fulfilled') {
                sourceStatus[name] = true;
                reports.push(...(result.value || []));
            } else {
                sourceStatus[name] = false;
                sourceErrors[name] =
                    String(result.reason?.message || result.reason || 'erro desconhecido');
                console.warn(`Sismo ${name}:`, result.reason);
            }
        });

        const successfulSources = names.filter(name => sourceStatus[name] === true);

        try {
            [
                'USGS', 'USGS-RT', 'OVSICORI', 'MARN-SV', 'GEOFON', 'FUNVISIS', 'JMA',
                'IGP', 'OSC-BOL', 'BMKG', 'GEONET', 'USP',
                'CSN-Chile', 'SSN-Mexico', 'EMSC'
            ].forEach(src => {
                setSource(
                    src,
                    sourceStatus[src] ? 'ok' : 'off',
                    sourceStatus[src] ? 0 : 1,
                    sourceErrors[src]
                );
            });
        } catch (e) {}

        /*
         * REGRA CRÍTICA:
         * Se todas as fontes falharem, isto NÃO é um "sucesso".
         * A versão anterior podia chegar ao final de Promise.allSettled()
         * com zero fontes funcionando e ainda assim apagar globalEvents,
         * marcar __lastSismoSuccess e parecer que os dados estavam atualizados.
         */
        if (successfulSources.length === 0) {
            const erroResumo = names
                .map(n => sourceErrors[n] ? `${n}: ${sourceErrors[n]}` : `${n}: offline`)
                .join(' | ');

            window.sismoSourceStatus = sourceStatus;
            window.sismoSourceSummary = Object.entries(sourceStatus)
                .map(([k, v]) => `${k}:${v === true ? 'OK' : 'OFF'}`)
                .join(' · ');

            window.__lastSismoError = erroResumo;

            // Mantém os dados que já estavam na tela.
            // Se não houver dados em memória, tenta o cache local.
            if (!Array.isArray(globalEvents) || !globalEvents.length) {
                restaurarCacheOffline('sources-off');
            } else {
                window.__sismoUsingCache = true;
                window.__sismoCacheAt =
                    Number(window.__lastSismoSuccess || Date.now());
            }

            try {
                if (typeof updateFreshnessUI === 'function') updateFreshnessUI();
            } catch (e) {}

            showToast(
                '⚠️ Nenhuma fonte sísmica respondeu. Dados anteriores preservados.',
                'error'
            );

            // Seleção inicial só dispara UMA vez na vida da sessão, mesmo que essa
            // primeira rodada tenha falhado — senão o próximo ciclo que falhar de
            // novo re-seleciona o índice 0 e cancela qualquer voo/perseguição de
            // câmera que já esteja em andamento por outro motivo.
            if (isFirstDisplay) {
                requestInitialAutoDisplay();
            }

            return;
        }

        /*
         * Pelo menos uma fonte respondeu.
         * Agora sim esta rodada pode ser considerada uma atualização ao vivo.
         */
        const merged = mergeEarthquakeReports(reports);

        let novos = [];
        let atualizados = [];
        const seenNow = new Set();
        // BUG CORRIGIDO: filtrava por `e.type === 'earthquake'`, mas os
        // objetos que vêm do merge multiagência principal (USGS/JMA/EMSC/
        // GEOFON/IGP/BMKG/GeoNet/USP/CSN-Chile/SSN-México/OSC-Bolívia) NUNCA
        // recebem esse campo — só o canal paralelo do AFAD marca `type`
        // explicitamente. Na prática esse filtro deixava `earthquakesAntes`
        // vazio (ou quase) pra maioria dos sismos, e a correspondência por
        // proximidade/id nativo logo abaixo (o "prev") nunca encontrava
        // nada — cada ciclo tratava a MESMA revisão como um evento
        // totalmente novo (bug relatado: M5.1 no Japão "tocando" de novo a
        // cada correção de magnitude, 5.1→5.0→4.9). `globalEvents` só
        // contém sismos por definição (é o array irmão de `globalAlerts`,
        // que guarda tudo o mais) — não precisa desse campo pra confirmar.
        const earthquakesAntes = (Array.isArray(globalEvents) ? globalEvents : [])
            .filter(e => e && e.id != null);

        merged.forEach(ev => {
            // Casa com um evento JÁ conhecido pela posição/hora aproximada (mesma
            // folga usada pra deduplicar entre fontes em mergeEarthquakeReports),
            // em vez de recalcular um id "fresco" a partir de time/coords
            // arredondados a cada ciclo. Uma REVISÃO de verdade costuma ajustar o
            // horário de origem em ~1-2s e/ou o epicentro em alguns km — o
            // suficiente pra mudar esse id antigo e fazer o app achar que era um
            // sismo NOVO, tocando som e disparando os efeitos visuais de novo
            // pra um registro de minutos atrás que só estava sendo corrigido.
            let prev = null;
            // 1) Correspondência EXATA pelo id nativo do catálogo de origem
            // (sourceEventId — USGS/EMSC/GEOFON preservam esse id em
            // normalizarSismoGeoJSON, ver sismo-fontes.js). É a fonte de
            // verdade mais confiável que existe: o catálogo garante que o
            // MESMO id nunca muda entre revisões, não importa quanto tempo
            // passe ou o quanto a magnitude/hora/epicentro publicado seja
            // corrigido — ao contrário da correspondência por proximidade
            // espaço-temporal abaixo, que falha se uma revisão empurrar o
            // horário publicado além da tolerância (bug relatado: um M5.1 no
            // Japão "tocando" de novo a cada revisão de magnitude, 5.1→5.0→
            // 4.9 — a fonte japonesa republica o boletim com um novo
            // carimbo de hora a cada correção, e o app achava que era um
            // sismo novo a cada vez). Sempre checada ANTES da correspondência
            // por proximidade, nunca depois.
            if (ev.sourceEventId) {
                for (const cand of earthquakesAntes) {
                    if (seenNow.has(cand.id)) continue;
                    if (cand.sourceEventId && cand.sourceEventId === ev.sourceEventId) {
                        prev = cand;
                        break;
                    }
                }
            }
            // 2) Sem id nativo estável disponível (fontes sem catálogo FDSN
            // próprio, ex.: JMA, IGP, BMKG...) — cai na correspondência por
            // proximidade espaço-temporal de sempre.
            if (!prev) {
                for (const cand of earthquakesAntes) {
                    if (seenNow.has(cand.id)) continue; // já casado com outro report deste ciclo
                    const d = haversine(ev.coords[1], ev.coords[0], cand.coords[1], cand.coords[0]);
                    if (d > SISMO_DEDUPE_RAIO_KM) continue;
                    if (Math.abs(ev.time - cand.time) > SISMO_DEDUPE_TOL_MS) continue;
                    prev = cand;
                    break;
                }
            }

            const canonical = prev ? prev.id :
                `EQ-${Math.round(ev.time / 1000)}-${ev.coords[1].toFixed(3)}-${ev.coords[0].toFixed(3)}`;

            ev.id = canonical;
            seenNow.add(canonical);

            const isNew =
                !knownEventIds.has(canonical) && !isFirstLoad;

            knownEventIds.add(canonical);

            if (isNew) {
                novos.push(ev);
            } else if (!isFirstLoad) {
                if (prev) {
                    const magMudou = Number.isFinite(prev.mag) && Number.isFinite(ev.mag)
                        && Math.abs(Number(prev.mag) - Number(ev.mag)) >= 0.1;
                    const depthMudou = Number.isFinite(prev.depth) && Number.isFinite(ev.depth)
                        && Math.abs(Number(prev.depth) - Number(ev.depth)) >= 5;
                    const fontesMudou = (prev.sourceSummary || prev.source || '') !== (ev.sourceSummary || ev.source || '');
                    const qualityMudou = (prev.quality || '') !== (ev.quality || '');
                    const prelimMudou = !!prev.isPreliminary !== !!ev.isPreliminary;
                    if (magMudou || depthMudou || fontesMudou || qualityMudou || prelimMudou) {
                        const parts = [];
                        if (magMudou) parts.push(`M${Number(prev.mag).toFixed(1).replace('.', ',')} → M${Number(ev.mag).toFixed(1).replace('.', ',')}`);
                        if (depthMudou) parts.push(`${Number(prev.depth).toFixed(0)} → ${Number(ev.depth).toFixed(0)} km`);
                        if (prelimMudou && prev.isPreliminary && !ev.isPreliminary) parts.push('preliminar → revisado');
                        if (fontesMudou && !magMudou) parts.push(`Fontes: ${ev.sourceSummary || ev.source}`);
                        if (qualityMudou && !magMudou && !prelimMudou) parts.push(`Qualidade ${prev.quality || '—'} → ${ev.quality || '—'}`);
                        ev._previousMag = Number(prev.mag);
                        ev._deltaTxt = parts.join(' · ') || 'Dado atualizado pela fonte';
                        ev._updatedAt = Date.now();
                        atualizados.push(ev);
                    } else if (prev._deltaTxt && activeUpdatedIds.has(canonical)) {
                        ev._deltaTxt = prev._deltaTxt;
                        ev._updatedAt = prev._updatedAt;
                    }
                }
            }
        });

        // "Novo pra esta sessão" (isNew) não é o mesmo que "aconteceu agora": uma
        // rede regional pode publicar um sismo pequeno horas depois da origem real
        // (revisão humana, sincronização atrasada). O som e o selo de chegada
        // recente continuam usando a origem; a fila de apresentação inclui
        // todos os registros novos válidos até 72h, mesmo publicados com atraso.
        const novoAgora = Date.now();
        const novosRecentes = [];
        const novosTardios = [];
        novos.forEach(ev => {
            const idadeMs = novoAgora - (Number(ev.time) || novoAgora);
            (idadeMs <= SISMO_NOVO_RECENTE_MS ? novosRecentes : novosTardios).push(ev);
        });

        if (novosRecentes.length) {
            const novoExpira = novoAgora + 180000;
            novosRecentes.forEach(ev => {
                activeAlertingIds.set(ev.id, novoExpira);
                activeUpdatedIds.delete(ev.id);
                // Desempate de ordenarNovosNoTopo quando vários sismos chegam
                // no mesmo ciclo — sem isso, todos empatam e ficam na ordem
                // original do merge, não na ordem de chegada de verdade.
                ev._novoAt = novoAgora;
            });
            try { mostrarNovosSismosNoMapa(novosRecentes); } catch (e) { console.warn('[radar novo] falhou:', e); }
        }
        if (novosTardios.length) {
            const tardioExpira = novoAgora + 180000;
            novosTardios.forEach(ev => {
                activeLateIds.set(ev.id, tardioExpira);
                activeUpdatedIds.delete(ev.id);
            });
        }
        if (atualizados.length) {
            atualizados.forEach(ev => {
                if (!activeAlertingIds.has(ev.id)) {
                    marcarAtualizadoNoTopo(ev.id, ev._deltaTxt || '', ATUALIZADO_EXPIRA_MS);
                }
            });
        }

        // `merged` só reflete as 11 fontes deste ciclo. Sismos que chegaram por
        // canais paralelos com relógio próprio (AFAD a cada 60s, reforço
        // planetário USGS/EMSC a cada 60s — ver js/ui-wiring-final.js) ou que uma
        // fonte específica simplesmente não reconfirmou neste ciclo (falha de
        // rede pontual) não aparecem em `merged`. Sem preservá-los aqui, a
        // reatribuição abaixo os apagava a cada ~45s até o canal paralelo os
        // adicionar de volta — um pisca-apaga constante pros exatos sismos que
        // esses canais existem pra resgatar. Mantém só o que ainda está dentro
        // da mesma janela de 36h usada pro resto do app.
        const cutoffPreserva = Date.now() - 36 * 3600000;
        const preservados = (Array.isArray(globalEvents) ? globalEvents : []).filter(e =>
            e && e.type === 'earthquake' && e.id != null && !seenNow.has(e.id) &&
            Number.isFinite(e.time) && e.time >= cutoffPreserva
        );
        const mergedFinal = preservados.length ? merged.concat(preservados).sort((a, b) => b.time - a.time) : merged;

        globalEvents = mergedFinal;
        try { window.globalEvents = globalEvents; } catch (_) {}
        window.sismoSourceStatus = sourceStatus;
        window.sismoSourceSummary = Object.entries(sourceStatus)
            .map(([k, v]) => `${k}:${v === true ? 'OK' : v === 'legado' ? 'LEG' : 'OFF'}`)
            .join(' · ');

        window.__lastSismoSuccess = Date.now();
        window.__lastSismoError = null;
        window.__sismoUsingCache = false;
        window.__sismoCacheAt = null;
        window.__sismoCacheAgeMs = 0;

        try {
            lastFetchTimes['SISMOS'] = window.__lastSismoSuccess;
        } catch (e) {}

        try { salvarCacheOffline(); } catch (e) {}

        applyFilters();

        try {
            /* avaliarCriseAutomatica removido */
        } catch (e) {}

        updateKPIs();
        nextRefresh = Date.now() + 45000;

        // Fonte única: avisa o store das revisões → card principal atualiza sozinho
        // (o aviso pra tela — pílula, não mais toast de uma linha só pro
        // selecionado — sai mais abaixo, junto com o que antes era o som).
        try {
            if (atualizados.length && typeof EventStore !== 'undefined') {
                EventStore.onDataRevised(atualizados.map(e => e.id));
            }
        } catch (e) { console.warn('[sismo] EventStore revise:', e); }

        queueQuakeRevisions(atualizados);
        const firstRevisionDisplay = isFirstDisplay;
        if (isFirstDisplay) {
            requestInitialAutoDisplay();
        } else {
            queueNewCameraQuakes(novos.filter(ev=>isWithinAutoCycleAge(ev)));
            focusNextNewCameraQuake();
        }

        if (!firstRevisionDisplay) focusNextQuakeRevision(novosRecentes.length > 0);

        isFirstLoad = false;

        // Atualização (revisão de magnitude/profundidade/fonte) não toca mais
        // som nem pula pro topo da lista — mantém a distinção entre um
        // "sismo novo" quando na real era um registro antigo só sendo
        // corrigido. A informação agora vai pra uma pílula maior no rodapé
        // (mesmo estilo dos toasts, só que com o card inteiro: lugar, M
        // antiga → nova etc.), sem som e sem reordenar nada.
        if (atualizados.length) {
            const jaAvisados = new Set();
            atualizados.forEach(ev => {
                const pillKey = ev.id + '|updpill|' + (ev._deltaTxt || '');
                if (jaAvisados.has(pillKey) || sismosSonorizados.has(pillKey)) return;
                jaAvisados.add(pillKey);
                sismosSonorizados.add(pillKey);
                try { if (typeof showSismoAtualizadoPill === 'function') showSismoAtualizadoPill(ev); } catch (e) {}
            });
            if (sismosSonorizados.size > 300) {
                sismosSonorizados = new Set([...sismosSonorizados].slice(-150));
            }
        }

        // Som, voz e notificação são o "alarme de aconteceu agora" — só cabem
        // pros sismos recentes de verdade (novosTardios só ganha o selo discreto
        // já aplicado acima, sem nenhum desses efeitos).
        if (novosRecentes.length) {
            const max = novosRecentes.reduce((a, b) => a.mag > b.mag ? a : b);

            if (max.mag >= 5) {
                notificarNavegador(
                    `🌍 M${max.mag.toFixed(1).replace('.', ',')} — ${max.place}`,
                    `${novosRecentes.length} novo(s) • ${max.sourceSummary || max.source}`
                );
            }

            const novosComSom = novosRecentes.filter(
                ev => ev.mag >= Math.max(SOM_SISMO_MIN, minMagnitude)
            );

            if (novosComSom.length) {
                const alvo = novosComSom.sort((a, b) => b.mag - a.mag)[0];

                if (!sismosSonorizados.has(alvo.id)) {
                    // Redes diferentes (USGS, EMSC, GFZ...) — incluindo os canais
                    // paralelos de reforço planetário (fetchPlanetReinforcementQuakes/
                    // fetchEmscPlanetReinforcementQuakes, com tolerância de
                    // deduplicação própria e mais apertada) — podem publicar o MESMO
                    // tremor físico com coordenadas/hora levemente diferentes, cada
                    // uma virando um ID "novo" pro dedup principal e tocando o som de
                    // novo (caso relatado: um M5.6 tocando 6 vezes seguidas). Só toca
                    // se não for um quase-duplicado de um som já tocado recentemente
                    // na mesma região.
                    if (somJaTocadoParaRegiao(alvo)) {
                        sismosSonorizados.add(alvo.id);
                    } else {
                        const disparado = playEarthquakeSound(
                            alvo.mag,
                            alvo.place,
                            alvo.depth,
                            novosComSom.length - 1
                        );

                        if (disparado) {
                            sismosSonorizados.add(alvo.id);
                            registrarSomSismo(alvo);

                            if (sismosSonorizados.size > 300) {
                                sismosSonorizados =
                                    new Set([...sismosSonorizados].slice(-150));
                            }
                        }
                    }
                }
            }

            // Voz automática: somente M6.0 ou maior.
            const novosComVoz =
                novosRecentes.filter(ev => Number(ev.mag) >= VOZ_SISMO_MIN);

            if (novosComVoz.length && somAtivo && window.speechSynthesis) {
                const alvoVoz =
                    novosComVoz.sort((a, b) => b.mag - a.mag)[0];

                // Mesma checagem de quase-duplicata do som (ver acima) — não repete
                // o anúncio de voz pro mesmo tremor sob outro ID de rede.
                if (!somJaTocadoParaRegiao(alvoVoz)) {
                    agendarFala(
                        Number(alvoVoz.mag),
                        alvoVoz.place,
                        alvoVoz.depth,
                        Math.max(0, novosComVoz.length - 1),
                        1400
                    );
                    registrarSomSismo(alvoVoz);
                }
            }
        }

        if (novos.length) {
            const tardioTxt = novosTardios.length ? ` (${novosTardios.length} publicado(s) com atraso)` : '';
            showToast(
                `✅ ${novos.length} novo(s) sismo(s)${tardioTxt} • ${successfulSources.length} fonte(s) online`,
                'info'
            );
        }
    } catch (e) {
        console.error('Feeds sísmicos multiagência:', e);
        window.__lastSismoError = String(e && e.message || e);

        // Não destrói a lista atual em caso de erro inesperado.
        if (!Array.isArray(globalEvents) || !globalEvents.length) {
            restaurarCacheOffline('error');
        } else {
            window.__sismoUsingCache = true;
            try {
                if (typeof updateFreshnessUI === 'function') updateFreshnessUI();
            } catch (err) {}
        }

        showToast(
            '⚠️ Falha na atualização sísmica. Dados anteriores preservados.',
            'error'
        );
    } finally {
        __fetchGlobalFeedsEmAndamento = false;
        window.MonitorFreshness?.endQuakes();
        try {
            if (typeof updateFreshnessUI === 'function') updateFreshnessUI();
        } catch (e) {}
    }
}

/* ═══════════════ BRENT ═══════════════ */
// Brent: somente dados reais. Nunca simular ou inventar preço.
let brentBasePrice = null, brentPrevClose = null, brentLastRealAt = null;
const BRENT_CACHE_KEY = 'monitor_global_brent_real_v1';
const BRENT_CACHE_MAX_AGE = 30 * 60 * 1000; // 30 min

