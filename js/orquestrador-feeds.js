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

async function fetchGlobalFeeds() {
    if (__fetchGlobalFeedsEmAndamento) return;
    __fetchGlobalFeedsEmAndamento = true;
    window.__lastSismoAttempt = Date.now();

    try {
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.style.display = 'flex';

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
            'USGS', 'USGS-RT', 'GEOFON', 'FUNVISIS', 'JMA',
            'IGP', 'OSC-BOL', 'BMKG', 'GEONET', 'USP',
            'CSN-Chile', 'SSN-Mexico', 'EMSC'
        ];

        const settled = await Promise.allSettled(tasks);
        const reports = [];
        const sourceStatus = {};
        const sourceErrors = {};

        settled.forEach((result, i) => {
            const name = names[i];

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
                'USGS', 'USGS-RT', 'GEOFON', 'FUNVISIS', 'JMA',
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
        const earthquakesAntes = (Array.isArray(globalEvents) ? globalEvents : [])
            .filter(e => e && e.type === 'earthquake' && e.id != null);

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
            for (const cand of earthquakesAntes) {
                if (seenNow.has(cand.id)) continue; // já casado com outro report deste ciclo
                const d = haversine(ev.coords[1], ev.coords[0], cand.coords[1], cand.coords[0]);
                if (d > SISMO_DEDUPE_RAIO_KM) continue;
                if (Math.abs(ev.time - cand.time) > SISMO_DEDUPE_TOL_MS) continue;
                prev = cand;
                break;
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
                        if (magMudou) parts.push(`M${Number(prev.mag).toFixed(1)} → M${Number(ev.mag).toFixed(1)}`);
                        if (depthMudou) parts.push(`${Number(prev.depth).toFixed(0)} → ${Number(ev.depth).toFixed(0)} km`);
                        if (prelimMudou && prev.isPreliminary && !ev.isPreliminary) parts.push('preliminar → revisado');
                        if (fontesMudou && !magMudou) parts.push(`Fontes: ${ev.sourceSummary || ev.source}`);
                        if (qualityMudou && !magMudou && !prelimMudou) parts.push(`Qualidade ${prev.quality || '—'} → ${ev.quality || '—'}`);
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

        if (novos.length) {
            const novoExpira = Date.now() + 180000;
            const novoAgora = Date.now();
            novos.forEach(ev => {
                activeAlertingIds.set(ev.id, novoExpira);
                activeUpdatedIds.delete(ev.id);
                // Desempate de ordenarNovosNoTopo quando vários sismos chegam
                // no mesmo ciclo — sem isso, todos empatam e ficam na ordem
                // original do merge, não na ordem de chegada de verdade.
                ev._novoAt = novoAgora;
            });
            try { mostrarNovosSismosNoMapa(novos); } catch (e) { console.warn('[radar novo] falhou:', e); }
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

        if (isFirstLoad) {
            if (globalEvents.length) showEventDetails(0, false);
        } else if (novos.length) {
            novos.sort((a, b) => b.mag - a.mag);
            const i = globalEvents.findIndex(e => e.id === novos[0].id);
            if (i !== -1) showEventDetails(i, true);
        }

        isFirstLoad = false;

        // Atualização (revisão de magnitude/profundidade/fonte) não toca mais
        // som nem pula pro topo da lista — usuário achou confuso ouvir/ver um
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

        if (novos.length) {
            const max = novos.reduce((a, b) => a.mag > b.mag ? a : b);

            if (max.mag >= 5) {
                notificarNavegador(
                    `🌍 M${max.mag.toFixed(1)} — ${max.place}`,
                    `${novos.length} novo(s) • ${max.sourceSummary || max.source}`
                );
            }

            const novosComSom = novos.filter(
                ev => ev.mag >= Math.max(SOM_SISMO_MIN, minMagnitude)
            );

            if (novosComSom.length) {
                const alvo = novosComSom.sort((a, b) => b.mag - a.mag)[0];

                if (!sismosSonorizados.has(alvo.id)) {
                    const disparado = playEarthquakeSound(
                        alvo.mag,
                        alvo.place,
                        alvo.depth,
                        novosComSom.length - 1
                    );

                    if (disparado || pendingSounds.length) {
                        sismosSonorizados.add(alvo.id);

                        if (sismosSonorizados.size > 300) {
                            sismosSonorizados =
                                new Set([...sismosSonorizados].slice(-150));
                        }
                    }
                }
            }

            // Voz automática: somente M6.0 ou maior.
            const novosComVoz =
                novos.filter(ev => Number(ev.mag) >= VOZ_SISMO_MIN);

            if (novosComVoz.length && somAtivo && window.speechSynthesis) {
                const alvoVoz =
                    novosComVoz.sort((a, b) => b.mag - a.mag)[0];

                agendarFala(
                    Number(alvoVoz.mag),
                    alvoVoz.place,
                    alvoVoz.depth,
                    Math.max(0, novosComVoz.length - 1),
                    1400
                );
            }

            showToast(
                `✅ ${novos.length} novo(s) sismo(s) • ${successfulSources.length} fonte(s) online`,
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
        const loading = document.getElementById('loading-indicator');
        if (loading) loading.style.display = 'none';
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

