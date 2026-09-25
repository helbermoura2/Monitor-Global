// === audio.js — Motor de áudio completo: vozes, tons, alertas sonoros, fala (TTS) (linhas originais 763-1306 do core-app.js) ===

function carregarVozesDisponiveis() {
    if (window.speechSynthesis) vozesDisponiveis = window.speechSynthesis.getVoices();
}
// Diagnóstico temporário: abrir o site com ?debugvoz=1 na URL mostra num
// alert() nativo (funciona em qualquer celular, sem precisar de console) a
// lista real de vozes que o Chrome enxerga, pra confirmar se uma troca de
// motor de TTS nas configs do sistema realmente chegou até o navegador.
if (/[?&]debugvoz=1\b/.test(location.search) && window.speechSynthesis) {
    const mostrarVozesDebug = () => {
        const vs = window.speechSynthesis.getVoices();
        // Alert nativo trunca texto muito longo — filtra só português (é o
        // que importa aqui) pra caber inteiro na caixa.
        const pt = vs.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('pt'));
        const linhas = pt.map(v => `${v.name} — ${v.lang}${v.default ? ' (padrão)' : ''}`);
        alert('Vozes em português (' + pt.length + ' de ' + vs.length + ' no total):\n\n' + (linhas.join('\n') || 'NENHUMA voz em português encontrada'));
    };
    if (window.speechSynthesis.getVoices().length) mostrarVozesDebug();
    else window.speechSynthesis.addEventListener('voiceschanged', mostrarVozesDebug, { once: true });
}
// Diagnóstico temporário: abrir com ?testevoz=1 e tocar em qualquer lugar da
// tela força uma frase de teste na voz (nuvem, com fallback pro navegador se
// a nuvem falhar) sem precisar esperar um terremoto de M6+ de verdade. Exige
// um toque real (em vez de disparar sozinho ao carregar) porque o navegador
// bloqueia áudio automático sem interação do usuário.
if (/[?&]testevoz=1\b/.test(location.search)) {
    let testeVozDisparado = false;
    const dispararTesteVoz = () => {
        if (testeVozDisparado) return;
        testeVozDisparado = true;
        if (typeof falarAlertaGenerico === 'function') {
            falarAlertaGenerico('Isto é um teste de voz do Monitor Global.');
        }
    };
    document.addEventListener('click', dispararTesteVoz, { once: true });
    document.addEventListener('touchstart', dispararTesteVoz, { once: true });
}
function ensureAudio() {
    if (!audioContext || audioContext.state === 'closed') return false;
    if (audioContext.state === 'suspended') {
        try {
            const r = audioContext.resume();
            if (r && typeof r.then === 'function') {
                r.then(() => {
                    if (audioContext && audioContext.state === 'running') {
                        isAudioUnlocked = true;
                        atualizarTodosBotoesSom();
                        flushPendingSounds();
                    }
                }).catch(() => {
                    isAudioUnlocked = false;
                    atualizarTodosBotoesSom();
                });
            }
        } catch (e) {
            isAudioUnlocked = false;
            return false;
        }
        return false;
    }
    return audioContext.state === 'running';
}
function queuePendingSound(sound) {
    pendingSounds.push(sound);
    if (pendingSounds.length > 8) pendingSounds = pendingSounds.slice(-8);
}
function flushPendingSounds() {
    if (!isAudioUnlocked || !audioContext || audioContext.state !== 'running' || !somAtivo) return;
    const fila = pendingSounds.splice(0);
    if (!fila.length) return;
    setTimeout(() => {
        fila.forEach((ps, i) => {
            setTimeout(() => {
                if (ps.type === 'tone') playAlertTone(ps.kind);
                else playEarthquakeSound(ps.mag, ps.place, ps.depth, ps.qtd, false, !!ps.isUpdate, ps.deltaTxt || '');
            }, i * 1200);
        });
    }, 150);
}
let noiseBuf = null;
function getNoise() {
    if (noiseBuf) return noiseBuf;
    const len = audioContext.sampleRate * 2;
    noiseBuf = audioContext.createBuffer(1, len, audioContext.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
}
function tone(f0, { t = 0, dur = .3, type = 'sine', vol = .35, glide = null, attack = .02, release = .08 } = {}) {
    if (!audioContext) return;
    const now = audioContext.currentTime + t;
    const o = audioContext.createOscillator(), g = audioContext.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, now + dur);
    o.connect(g); g.connect(audioContext.destination);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * somVolume), now + Math.min(attack, dur * 0.45));
    g.gain.setValueAtTime(Math.max(0.0001, vol * somVolume), Math.max(now + Math.min(attack, dur * 0.45), now + dur - release));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now); o.stop(now + dur + .05);
}
function noise({ t = 0, dur = 1, vol = .35, fFrom = 800, fTo = 100, type = 'lowpass', q = 1 } = {}) {
    if (!audioContext) return;
    const now = audioContext.currentTime + t;
    const src = audioContext.createBufferSource();
    src.buffer = getNoise();
    const f = audioContext.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(fFrom, now);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, fTo), now + dur);
    f.Q.value = q;
    const g = audioContext.createGain();
    src.connect(f); f.connect(g); g.connect(audioContext.destination);
    g.gain.setValueAtTime(Math.max(0.0001, vol * somVolume), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.start(now); src.stop(now + dur);
}
function playUnlockChime() {
    if (!audioContext) return;
    tone(880, { dur: .15, vol: .3 });
    tone(1320, { t: .14, dur: .25, vol: .3 });
}
function atualizarBotaoSomHeader() {
    const btn = document.getElementById('btn-som-header');
    if (!btn) return;
    if (!somAtivo) {
        btn.textContent = '🔇';
        btn.setAttribute('data-state', 'off');
    } else if (!isAudioUnlocked) {
        btn.textContent = '🔊';
        btn.setAttribute('data-state', 'pending');
    } else {
        btn.textContent = '🔊';
        btn.setAttribute('data-state', 'on');
    }
    btn.classList.toggle('muted', !somAtivo);
    btn.classList.toggle('needs-gesture', !!(somAtivo && !isAudioUnlocked));
    btn.title = !somAtivo
        ? 'Voz: desligada — clique para ligar'
        : (somMutedTypes.has('quake') ? 'Alertas de sismo silenciados — abra Áudio > Volume e tipos' : (isAudioUnlocked ? 'Voz: ligada — clique para desligar' : 'Voz: aguardando toque para liberar (Chrome)'));
    btn.setAttribute('aria-label', btn.title);
}
function mostrarBannerSom(show) {
    // Só mostra 1x por sessão de aba (não enche o saco a cada reload mental)
    try {
        if (show && sessionStorage.getItem('somBannerDismissed') === '1') show = false;
    } catch (e) {}
    let b = document.getElementById('som-gesture-banner');
    if (!b) {
        b = document.createElement('div');
        b.id = 'som-gesture-banner';
        b.innerHTML = '🔊 Toque para ativar alertas de voz <span style="opacity:.6;font-weight:600">(só esta vez)</span>';
        b.addEventListener('click', function () {
            if (!somAtivo) {
                somAtivo = true;
                try { localStorage.setItem('somAtivo', '1'); } catch (e) {}
            }
            try { sessionStorage.setItem('somBannerDismissed', '1'); } catch (e) {}
            unlockAudio(true);
            mostrarBannerSom(false);
        });
        document.body.appendChild(b);
    }
    if (!show) {
        try { if (isAudioUnlocked) sessionStorage.setItem('somBannerDismissed', '1'); } catch (e) {}
    }
    b.classList.toggle('show', !!show);
}
function unlockAudio(forceSpeak) {
    if (!somAtivo) return false;
    try {
        if (!audioContext || audioContext.state === 'closed') {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = audioContext;
        const concluir = () => {
            if (!audioContext || audioContext.state !== 'running') return false;
            isAudioUnlocked = true;
            carregarVozesDisponiveis();
            playUnlockChime();
            try { pedirPermissaoNotificacao(); } catch (e) {}
            if (forceSpeak) {
                try {
                    const n = (typeof globalAlerts !== 'undefined' && globalAlerts.length) || 0;
                    falarAlertaGenerico(`Áudio ativado. Central armada.${n > 0 ? ` ${n} alertas ativos agora.` : ''}`);
                } catch (e) {}
            }
            flushPendingSounds();
            mostrarBannerSom(false);
            atualizarTodosBotoesSom();
            return true;
        };
        if (ctx.state === 'running') return concluir();
        const r = ctx.resume();
        if (r && typeof r.then === 'function') {
            r.then(() => concluir()).catch(e => {
                console.warn('[audio] resume bloqueado:', e && e.message);
                isAudioUnlocked = false;
                atualizarTodosBotoesSom();
                if (somAtivo) mostrarBannerSom(true);
            });
        }
        return false;
    } catch (e) {
        console.warn('[audio] unlock falhou:', e && e.message);
        isAudioUnlocked = false;
        atualizarTodosBotoesSom();
        if (somAtivo) mostrarBannerSom(true);
        return false;
    }
}
// No Android/Chrome/DeX, o desbloqueio precisa acontecer dentro de um gesto real.
// Usamos pointerdown + touchstart + click, sem {once:true}, para que um primeiro
// toque consumido por outro controle não deixe o áudio permanentemente bloqueado.
function gestoParaAudio() {
    if (somAtivo && (!audioContext || audioContext.state !== 'running')) unlockAudio(false);
}
document.addEventListener('pointerdown', gestoParaAudio, {capture:true, passive:true});
document.addEventListener('touchstart', gestoParaAudio, {capture:true, passive:true});
document.addEventListener('click', gestoParaAudio, {capture:true, passive:true});
document.addEventListener('keydown', gestoParaAudio, {capture:true});
if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = carregarVozesDisponiveis;

// Liga/desliga áudio de verdade (cabeçalho, FAB e menu)
function atualizarTodosBotoesSom() {
    try { atualizarBotaoSomHeader(); } catch (e) {}
    const fab = document.getElementById('fab-audio');
    if (fab) {
        fab.textContent = somAtivo ? '🔊' : '🔇';
        fab.setAttribute('data-state', somAtivo ? (typeof isAudioUnlocked !== 'undefined' && isAudioUnlocked ? 'on' : 'pending') : 'off');
        fab.classList.toggle('muted', !somAtivo);
        fab.title = somAtivo
            ? (isAudioUnlocked ? 'Áudio ligado — toque para desligar' : 'Áudio ligado — toque para liberar no Chrome')
            : 'Áudio desligado — toque para ligar';
        fab.setAttribute('aria-label', fab.title);
    }
    const old = document.getElementById('btn-som');
    if (old) old.textContent = somAtivo ? '🔊 Som ativo' : '🔇 Som mudo';
    const menuAudio = document.getElementById('menu-btn-audio');
    if (menuAudio) menuAudio.textContent = somAtivo ? '🔊 Áudio: ligado (tocar p/ desligar)' : '🔇 Áudio: desligado (tocar p/ ligar)';
}
function toggleSomAtivo(opts) {
    opts = opts || {};
    const force = opts.force; // true=ligar, false=desligar, undefined=toggle
    if (force === true) somAtivo = true;
    else if (force === false) somAtivo = false;
    else somAtivo = !somAtivo;
    try { localStorage.setItem('somAtivo', somAtivo ? '1' : '0'); } catch (err) {}
    if (somAtivo) {
        try { unlockAudio(!!opts.speak); } catch (e) {}
        if (!opts.silent) {
            try { showToast('🔊 Alertas de voz ligados', 'info'); } catch (err) {}
        }
    } else {
        try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (err) {}
        try { mostrarBannerSom(false); } catch (e) {}
        if (!opts.silent) {
            try { showToast('🔇 Alertas de voz desligados', 'info'); } catch (err) {}
        }
    }
    atualizarTodosBotoesSom();
    return somAtivo;
}
window.toggleSomAtivo = toggleSomAtivo;
window.atualizarTodosBotoesSom = atualizarTodosBotoesSom;
// expõe leitura (não atribuição direta do let)
Object.defineProperty(window, 'somAtivo', {
    get: function () { return somAtivo; },
    set: function (v) { somAtivo = !!v; try { localStorage.setItem('somAtivo', somAtivo ? '1' : '0'); } catch (e) {} atualizarTodosBotoesSom(); },
    configurable: true
});

function bindBotaoSomHeader() {
    const btn = document.getElementById('btn-som-header');
    if (!btn || btn.dataset.somBound === '1') return;
    btn.dataset.somBound = '1';
    btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        toggleSomAtivo({ speak: true });
    }, true);
    btn.addEventListener('touchend', function (e) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        toggleSomAtivo({ speak: true });
    }, { passive: false });
}
document.addEventListener('DOMContentLoaded', function () {
    bindBotaoSomHeader();
    atualizarTodosBotoesSom();
    if (somAtivo) {
        setTimeout(function () {
            try { unlockAudio(false); } catch (e) {}
            if (!isAudioUnlocked) mostrarBannerSom(true);
            atualizarTodosBotoesSom();
        }, 800);
    }
});
// se o script rodar após DOMContentLoaded
if (document.readyState !== 'loading') {
    bindBotaoSomHeader();
    atualizarTodosBotoesSom();
}


/*
 * ALARME SÍSMICO — assinatura sonora dedicada.
 * Cada magnitude é UM ÚNICO bloco de áudio: isso evita que os bipes sejam
 * tratados como alertas separados pela fila e garante que todos sejam agendados
 * juntos no mesmo AudioContext.
 *
 * M3.x = 3 bipes | M4.x = 4 bipes | M5.x = 5 bipes
 * M6+ = alerta especial + voz | M7+ = alerta máximo + voz
 */
function quakeBeep(freq, t, dur, vol, last = false) {
    if (!audioContext || audioContext.state !== 'running') return;
    const now = audioContext.currentTime + t;
    const g = audioContext.createGain();
    const level = Math.min(0.92, Math.max(0.02, vol * somVolume * 1.35));
    const o1 = audioContext.createOscillator();
    const o2 = audioContext.createOscillator();
    o1.type = 'triangle';
    o2.type = 'sine';
    o1.frequency.setValueAtTime(freq, now);
    o2.frequency.setValueAtTime(freq / 2, now);
    o1.connect(g); o2.connect(g); g.connect(audioContext.destination);

    const finalDur = last ? dur + 0.10 : dur;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(level, now + 0.018);
    g.gain.setValueAtTime(level, now + Math.max(0.03, finalDur - 0.055));
    g.gain.exponentialRampToValueAtTime(0.0001, now + finalDur);

    o1.start(now); o2.start(now);
    o1.stop(now + finalDur + 0.04);
    o2.stop(now + finalDur + 0.04);
}


function playEarthquakeSound(mag, place, depth, qtd = 0, forceManual = false, isUpdate = false, deltaTxt = '') {
    if (!somAtivo || somMutedTypes.has('quake')) return;
    // Áudio ainda não desbloqueado (comum logo após abrir a página) — sem
    // isso o alerta de M6+/M7+ (beep + voz) se perdia de vez: guardava numa
    // variável (`pendingSound`, singular) que nada nunca lia. flushPendingSounds()
    // já sabe tocar isso da fila (pendingSounds, plural) assim que o áudio
    // desbloquear — só faltava usar a fila certa.
    if (!ensureAudio()) { queuePendingSound({ type: 'quake', mag, place, depth, qtd, isUpdate, deltaTxt }); return; }
    // Alertas automáticos respeitam o filtro mínimo; uma reprodução manual
    // deve tocar mesmo que o usuário esteja filtrando magnitudes maiores.
    if (!forceManual && mag < Math.max(SOM_SISMO_MIN, minMagnitude)) return;

    // Guardamos no closure para a fila de som (M6+ fala "Atualização" se for revisão)
    const _isUpdate = !!isUpdate;
    const _deltaTxt = deltaTxt || '';

    agendarSom(() => {
        /*
         * ASSINATURAS SONORAS DOS SISMOS
         * M3 = 3 bipes agudos / atenção
         * M4 = 4 bipes médios-graves / alerta
         * M5 = 5 bipes graves / alerta forte, último prolongado
         * M6+ = emergência + voz
         *
         * Cada faixa tem timbre, duração e envelope próprios.
         * A quantidade de bipes continua sendo o código visual/auditivo da magnitude.
         */
        if (mag >= 7) {
            // M7+: assinatura máxima — pulsos alternados + grave contínuo + voz
            for (let i = 0; i < 5; i++) {
                tone(i % 2 ? 430 : 720, {
                    t: i * .38,
                    dur: i === 4 ? .42 : .30,
                    type: 'sawtooth',
                    vol: .62,
                    attack: .018,
                    release: .10
                });
            }
            noise({ t: 1.75, dur: 2.0, vol: .48, fFrom: 360, fTo: 55 });
            tone(110, { t: 1.75, dur: 2.0, type: 'sine', vol: .48, glide: 72, attack: .04, release: .22 });
            agendarFala(mag, place, depth, qtd, 1800, _isUpdate, _deltaTxt);
        } else if (mag >= 6) {
            // M6: emergência — dois pares graves + ruído/impacto + voz
            tone(560, { t: 0, dur: .24, type: 'square', vol: .52, attack: .015, release: .08 });
            tone(560, { t: .32, dur: .24, type: 'square', vol: .52, attack: .015, release: .08 });
            tone(430, { t: .68, dur: .28, type: 'sawtooth', vol: .56, attack: .015, release: .10 });
            tone(430, { t: 1.04, dur: .28, type: 'sawtooth', vol: .56, attack: .015, release: .10 });
            noise({ t: 1.42, dur: 1.25, vol: .45, fFrom: 260, fTo: 55 });
            tone(105, { t: 1.42, dur: 1.25, type: 'sine', vol: .42, glide: 72, attack: .03, release: .20 });
            agendarFala(mag, place, depth, qtd, 1450, _isUpdate, _deltaTxt);
        } else if (mag >= 5.0) {
            // M5: grave, encorpado e claramente mais forte. 5º pulso é prolongado.
            const gap = .57;
            const freqs = [300, 300, 300, 300, 240];
            for (let i = 0; i < 5; i++) {
                tone(freqs[i], {
                    t: i * gap,
                    dur: i === 4 ? .46 : .30,
                    type: 'sawtooth',
                    vol: i === 4 ? .62 : .54,
                    attack: .018,
                    release: i === 4 ? .16 : .10
                });
            }
            // Subgrave curto para dar corpo sem transformar o alerta em ruído.
            tone(92, { t: 4 * gap, dur: .40, type: 'sine', vol: .28, glide: 72, attack: .02, release: .16 });
        } else if (mag >= 4.0) {
            // M4: assinatura média-grave, 4 pulsos bem separados.
            const gap = .54;
            for (let i = 0; i < 4; i++) {
                tone(420, {
                    t: i * gap,
                    dur: i === 3 ? .38 : .28,
                    type: 'triangle',
                    vol: i === 3 ? .52 : .46,
                    attack: .018,
                    release: i === 3 ? .13 : .09
                });
            }
        } else if (mag >= 3.0) {
            // M3: assinatura aguda e limpa, 3 bipes de atenção.
            const gap = .52;
            for (let i = 0; i < 3; i++) {
                tone(860, {
                    t: i * gap,
                    dur: i === 2 ? .34 : .26,
                    type: 'sine',
                    vol: i === 2 ? .46 : .40,
                    attack: .012,
                    release: .08
                });
            }
        }
    });
}
function playAlertTone(kind) {
    if (!somAtivo || somMutedTypes.has(kind)) return;
    if (!ensureAudio()) { queuePendingSound({ type: 'tone', kind }); return; }
    agendarSom(() => {
        switch (kind) {
            case 'fire':
                for (let i = 0; i < 6; i++) noise({ t: i * .11, dur: .07, vol: .3, fFrom: 2500, fTo: 900, type: 'bandpass', q: 2 });
                tone(320, { t: .1, dur: .6, type: 'triangle', vol: .35, glide: 520 });
                break;
            case 'hurricane':
                tone(160, { dur: 1.4, type: 'sawtooth', vol: .4, glide: 240 });
                noise({ dur: 1.6, vol: .3, fFrom: 300, fTo: 1400, type: 'bandpass', q: 1.5 });
                break;
            case 'tornado':
                for (let i = 0; i < 8; i++) tone(i % 2 ? 300 : 900, { t: i * .09, dur: .09, type: 'sawtooth', vol: .35 });
                break;
            case 'tsunami':
                tone(220, { dur: 1.5, type: 'square', vol: .45, glide: 880 });
                tone(220, { t: 1.7, dur: 1.5, type: 'square', vol: .45, glide: 880 });
                break;
            case 'storm':
                noise({ dur: 2, vol: .5, fFrom: 400, fTo: 60 });
                tone(90, { dur: 1.6, vol: .3 });
                break;
            case 'civil':
                tone(880, { dur: .5, type: 'square', vol: .4, glide: 620 });
                tone(880, { t: .6, dur: .5, type: 'square', vol: .4, glide: 620 });
                break;
            case 'wind':
                // Vendaval / vento forte: assinatura própria, audível e distinta
                // dos terremotos. Três rajadas curtas, crescendo levemente,
                // seguidas por um sopro grave que dá sensação de vento.
                noise({ t: 0, dur: .55, vol: .46, fFrom: 1500, fTo: 420, type: 'bandpass', q: 1.1 });
                noise({ t: .72, dur: .55, vol: .52, fFrom: 1700, fTo: 380, type: 'bandpass', q: 1.05 });
                noise({ t: 1.44, dur: .65, vol: .60, fFrom: 1900, fTo: 300, type: 'bandpass', q: 1.0 });
                tone(125, { t: 1.48, dur: .78, type: 'sine', vol: .28, glide: 72, attack: .06, release: .22 });
                break;
            case 'flood':
                tone(180, { dur: 1.2, type: 'sine', vol: .4, glide: 60 });
                tone(180, { t: 1.3, dur: 1.2, type: 'sine', vol: .4, glide: 60 });
                break;
            case 'volcano':
                noise({ dur: 1.8, vol: .4, fFrom: 200, fTo: 60, type: 'lowpass', q: 1 });
                tone(70, { t: .1, dur: 1.5, type: 'sawtooth', vol: .35, glide: -20 });
                break;
        }
    });
}
function agendarFala(mag, place, depth, qtd, delay, isUpdate = false, deltaTxt = '') {
    if (speakAlertTimeoutId) clearTimeout(speakAlertTimeoutId);
    speakAlertTimeoutId = setTimeout(() => {
        speakAlert(mag, place, depth, qtd, isUpdate, deltaTxt);
        speakAlertTimeoutId = null;
    }, delay);
}
// Nomes de lugar no formato do USGS ("16 km S of Twentynine Palms, CA") vêm
// em inglês — lidos com a voz pt-BR, saem com sotaque estranho (o motivo do
// pedido). Nomes de lugar em português (sismos no Brasil, sempre por fontes
// locais) continuam na voz pt-BR normalmente — só trocamos quando o texto
// bate com o padrão de distância+direção cardinal do USGS.
function pareceLugarEmIngles(s) {
    return /\d+\s*km\s+(N|S|E|W|NE|NW|SE|SW|NNE|NNW|SSE|SSW|ENE|ESE|WNW|WSW)\s+of\s+/i.test(String(s || ''));
}

// Escolhe a melhor voz disponível pra um idioma, testando prefixos em ordem
// (ex.: 'en-us' antes de 'en' genérico). Retorna null se nada bater — quem
// chama decide o que fazer (cair pra voz padrão do navegador).
function escolherVoz(prefixos) {
    if (!vozesDisponiveis.length) carregarVozesDisponiveis();
    for (const p of prefixos) {
        const candidatas = vozesDisponiveis.filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(p));
        if (!candidatas.length) continue;
        // Quando o aparelho tem mais de um motor de TTS instalado, o Chrome
        // lista as vozes de todos juntas — sem isso, a gente sempre pegava a
        // primeira da lista, que podia continuar sendo a do Google mesmo
        // depois do usuário trocar o motor padrão nas configs do sistema.
        // Prioriza a voz marcada como padrão do navegador e, se não tiver
        // nenhuma, prefere qualquer voz que não seja do motor do Google.
        return candidatas.find(v => v.default) ||
            candidatas.find(v => !/google/i.test(v.name)) ||
            candidatas[0];
    }
    return null;
}

// Fala uma sequência de trechos, cada um podendo ter idioma/voz própria —
// é assim que a gente troca de pt-BR pro inglês só no nome do lugar e volta,
// numa frase só, sem precisar de nenhuma API paga de voz. speechSynthesis já
// enfileira .speak() chamados em sequência, então basta disparar todos na
// ordem certa depois do mesmo delay de acomodação que já existia.
function falarTrechos(trechos) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setTimeout(() => {
        trechos.forEach((trecho) => {
            if (!trecho.texto) return;
            const u = new SpeechSynthesisUtterance(trecho.texto);
            u.lang = trecho.lang;
            u.rate = trecho.rate != null ? trecho.rate : .9;
            u.pitch = trecho.pitch != null ? trecho.pitch : 1.1;
            // Fallback nativo (só entra se a voz na nuvem falhar): a API do
            // navegador não tem reforço de ganho como a nuvem acima, e o
            // teto dela já é 1.0 — então sempre fala no máximo, sem
            // multiplicar de novo pelo volume dos bipes (que já deixava a
            // voz nativa, sozinha mais baixa que a da nuvem, ainda pior).
            u.volume = 1;
            const ehIngles = trecho.lang.toLowerCase().startsWith('en');
            const voz = escolherVoz(ehIngles ? ['en-us', 'en-gb', 'en'] : ['pt-br', 'pt']);
            if (voz) u.voice = voz;
            else if (!ehIngles) avisarVozIndisponivel(); // só avisa se faltar a voz principal (pt)
            window.speechSynthesis.speak(u);
        });
    }, 500);
}

// Tenta falar com uma voz melhor (Amazon Polly, via Worker) antes de cair pra
// síntese nativa do navegador — resolve o problema de só existir uma voz
// genérica em português no Chrome Android, sem depender de configuração
// nenhuma do aparelho. Se a cota grátis acabar, a rede falhar, ou o Worker
// não tiver a chave configurada ainda, cai pra window.speechSynthesis
// sozinho, sem quebrar o alerta.
let vozNuvemAtual = null;
async function falarNaNuvem(texto) {
    if (!texto || typeof workerBaseUrl !== 'function') return false;
    // Interrompe um áudio de alerta anterior ainda tocando — mesmo
    // comportamento que window.speechSynthesis.cancel() já dava pra fila de
    // fala nativa, importante em sismos com atualizações rápidas seguidas.
    if (vozNuvemAtual) { try { vozNuvemAtual.pause(); } catch (_) {} }
    try {
        const r = await fetch(workerBaseUrl() + '/tts?text=' + encodeURIComponent(texto), { cache: 'no-store' });
        if (!r.ok) return false;
        const blob = await r.blob();
        if (!blob || !blob.size) return false;
        const url = URL.createObjectURL(blob);
        const audio = new Audio();
        audio.addEventListener('ended', () => URL.revokeObjectURL(url));
        audio.addEventListener('error', () => URL.revokeObjectURL(url));
        vozNuvemAtual = audio;
        audio.src = url;
        // Reforça o volume da voz na nuvem via Web Audio API — um <audio>
        // sozinho não passa de volume=1 (100%), e mesmo nesse máximo a voz
        // da Polly soa mais baixa que os bipes de alerta (que já saem com
        // ganho extra, ver "vol * somVolume * 1.35" mais abaixo). Usuário
        // relatou a voz ainda baixa mesmo com esse reforço — ganho e teto
        // aumentados (1.8→2.4, teto 3→3.2) pra ficar audível de verdade sem
        // chegar perto de distorcer. Só entra em ação se o AudioContext já
        // estiver desbloqueado/rodando — sem isso, cai pro volume normal em
        // vez de arriscar tocar mudo.
        let boosted = false;
        try {
            if (audioContext && audioContext.state === 'running') {
                const source = audioContext.createMediaElementSource(audio);
                const gain = audioContext.createGain();
                gain.gain.value = Math.min(3.2, somVolume * 2.4);
                source.connect(gain).connect(audioContext.destination);
                audio.volume = 1;
                boosted = true;
            }
        } catch (e) {}
        if (!boosted) audio.volume = somVolume;
        // Espera o navegador confirmar que o áudio já está pronto pra tocar
        // sem travar antes de dar play — sem isso, o começo da fala (ex.: a
        // palavra "Atenção") pode sair cortado em alguns aparelhos/navegadores,
        // mesmo com o arquivo inteiro já baixado (o corte é de decodificação,
        // não de rede). Timeout de segurança pra não travar se o evento não
        // disparar por algum motivo.
        await new Promise((resolve) => {
            audio.addEventListener('canplaythrough', resolve, { once: true });
            audio.load();
            setTimeout(resolve, 800);
        });
        await audio.play();
        return true;
    } catch (e) {
        console.warn('TTS nuvem indisponível, caindo pra voz do navegador:', e?.message || e);
        return false;
    }
}
function speakAlert(mag, place, depth, qtd = 0, isUpdate = false, deltaTxt = '') {
    if (!somAtivo) return;
    const prof = (typeof depth === 'number' && !isNaN(depth)) ? `, a ${depth.toFixed(0)} quilômetros de profundidade` : '';
    let intro;
    if (isUpdate) {
        // Deixa claro que NÃO é um sismo novo — é revisão do que já estava no ar.
        const deltaFala = String(deltaTxt || '')
            .replace(/M(\d+(?:\.\d+)?)/g, 'magnitude $1')
            .replace(/→/g, ' para ')
            .replace(/·/g, ',')
            .trim();
        intro = `Atualização sísmica. `;
        if (deltaFala) intro += `${deltaFala}. `;
        intro += `Terremoto de magnitude ${Number(mag).toFixed(1)} em`;
    } else {
        intro = `Atenção. Terremoto de magnitude ${Number(mag).toFixed(1)} detectado em`;
    }
    let outro = `${prof}.`;
    if (!isUpdate && qtd > 0) outro += ` Mais ${qtd} evento(s) nesta atualização.`;

    const langLugar = pareceLugarEmIngles(place) ? 'en-US' : 'pt-BR';
    falarNaNuvem(`${intro} ${place}${outro}`).then(ok => {
        if (ok || !window.speechSynthesis) return;
        falarTrechos([
            { texto: intro, lang: 'pt-BR' },
            { texto: place, lang: langLugar, rate: langLugar === 'en-US' ? .95 : .9 },
            { texto: outro, lang: 'pt-BR' }
        ]);
    });
}
function falarAlertaGenerico(txt) {
    if (!somAtivo) return;
    falarNaNuvem(txt).then(ok => {
        if (ok || !window.speechSynthesis) return;
        const u = new SpeechSynthesisUtterance(txt);
        u.lang = 'pt-BR';
        u.rate = .95;
        u.volume = 1; // fallback nativo sem reforço de ganho — sempre no teto (ver falarTrechos)
        const v = escolherVoz(['pt-br']);
        if (v) u.voice = v; else avisarVozIndisponivel();
        window.speechSynthesis.cancel();
        setTimeout(() => window.speechSynthesis.speak(u), 300);
    });
}
let vozIndisponivelAvisada = false;
function avisarVozIndisponivel() {
    if (vozIndisponivelAvisada) return;
    vozIndisponivelAvisada = true;
    showToast('Nenhuma voz em português encontrada neste aparelho — os alertas falados vão sair na voz padrão do sistema.', 'warning');
}
function reproduzirAlertaSismicoManual(item) {
    if (!item || item.type !== 'earthquake') return;

    // Cancelamos uma fala pendente/anterior para que o evento clicado seja o único foco.
    if (speakAlertTimeoutId) {
        clearTimeout(speakAlertTimeoutId);
        speakAlertTimeoutId = null;
    }

    // O mesmo alerta sonoro usado para um novo evento é reproduzido novamente.
    // forceManual=true permite ouvir o alerta mesmo se o slider de magnitude estiver
    // acima da magnitude do evento selecionado.
    try {
        playEarthquakeSound(item.mag, item.place, item.depth, 0, true);
    } catch (e) {
        console.warn('[audio] falha no replay manual do sismo:', e);
    }

    // REGRA DA VOZ:
    // M6.0 ou maior -> alerta sonoro + voz.
    // M5.9 ou menor -> somente alerta sonoro.
    if (Number(item.mag) >= VOZ_SISMO_MIN && somAtivo && window.speechSynthesis) {
        speakAlert(item.mag, item.place, item.depth, 0);
    } else if (window.speechSynthesis && Number(item.mag) < VOZ_SISMO_MIN) {
        // Garante que uma fala anterior não continue ao clicar em um M5.9 ou menor.
        try { window.speechSynthesis.cancel(); } catch (e) {}
    }
}

// Compatibilidade com chamadas antigas do projeto.
// Agora clicar em um sismo nunca fala abaixo de M6.0.

function triggerLightningFlash() {
    const el = document.getElementById('lightning-flash');
    if (!el) return;
    el.classList.remove('lightning-flash-active');
    void el.offsetWidth;
    el.classList.add('lightning-flash-active');
    const v = document.getElementById('vignette-cinematic');
    if (v) {
        v.classList.add('vignette-active');
        setTimeout(() => v.classList.remove('vignette-active'), 3200);
    }
}

/* ====== ✅ FIM DA PARTE 1 — cole a PARTE 2 logo abaixo ====== */
