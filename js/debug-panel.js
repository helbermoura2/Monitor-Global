// ═══ PAINEL DE DEBUG EM TELA — captura console.log/warn/error sem precisar de DevTools ═══
// (necessário porque o app roda via Samsung DeX/mobile, sem acesso a console de desktop)
(function () {
    const buf = [];
    const MAX = 200;
    const cores = { log: '#94a3b8', warn: '#facc15', error: '#f87171' };
    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function render() {
        const el = document.getElementById('debug-log');
        if (!el) return;
        el.innerHTML = buf.map(l =>
            `<div style="border-bottom:1px solid #1e293b;padding:3px 0;color:${cores[l.tipo]}">[${l.hora}] ${escapeHtml(l.msg)}</div>`
        ).join('');
        el.scrollTop = el.scrollHeight;
    }
    function capturar(tipo) {
        const original = console[tipo];
        console[tipo] = function (...args) {
            original.apply(console, args);
            const msg = args.map(a => {
                if (a instanceof Error) return a.message;
                if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
                return String(a);
            }).join(' ');
            buf.push({ tipo, msg, hora: new Date().toLocaleTimeString('pt-BR') });
            if (buf.length > MAX) buf.shift();
            render();
        };
    }
    ['log', 'warn', 'error'].forEach(capturar);
    window.addEventListener('error', (e) => {
        buf.push({ tipo: 'error', msg: `${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`, hora: new Date().toLocaleTimeString('pt-BR') });
        if (buf.length > MAX) buf.shift();
        render();
    });
    window.addEventListener('unhandledrejection', (e) => {
        buf.push({ tipo: 'error', msg: `Promise rejeitada: ${e.reason && e.reason.message || e.reason}`, hora: new Date().toLocaleTimeString('pt-BR') });
        if (buf.length > MAX) buf.shift();
        render();
    });
    window.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('debug-toggle');
        const panel = document.getElementById('debug-panel');
        const clearBtn = document.getElementById('debug-clear');
        // Painel de diagnóstico só fica acessível com ?debug=1 na URL — visitantes
        // comuns (ou qualquer link compartilhado) não veem o botão nem o painel.
        const debugHabilitado = new URLSearchParams(location.search).get('debug') === '1';
        if (!debugHabilitado) {
            if (btn) btn.style.display = 'none';
            return;
        }
        if (btn && panel) btn.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        });
        if (clearBtn) clearBtn.addEventListener('click', () => { buf.length = 0; render(); });
    });
})();

