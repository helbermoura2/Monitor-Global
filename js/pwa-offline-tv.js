/* ═══════════════════════════════════════════════════════════════
   PWA OFFLINE + MODO TV/KIOSK
   - Service Worker: cacheia o shell (este HTML) para abrir offline
   - ?mode=tv  ou  localStorage monitor_mode=tv  → interface sala
   Você pode forçar:  monitor-global-pro-4.html?mode=tv
   Voltar ao normal:  ?mode=normal  ou limpar localStorage
   ═══════════════════════════════════════════════════════════════ */

(function initPwaAndTv() {
  // --- Banner offline ---
  function ensureOfflineBanner() {
    if (document.getElementById('offline-banner')) return;
    const b = document.createElement('div');
    b.id = 'offline-banner';
    b.setAttribute('role', 'status');
    b.style.cssText = 'display:none;position:fixed;left:50%;top:calc(10px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:300000;padding:8px 14px;border-radius:8px;background:#7f1d1d;color:#fecaca;font-size:12px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.45);max-width:90vw;text-align:center';
    b.textContent = 'Sem conexão — mostrando última versão em cache';
    document.body.appendChild(b);
  }
  function syncOnlineStatus() {
    ensureOfflineBanner();
    const b = document.getElementById('offline-banner');
    if (!b) return;
    b.style.display = navigator.onLine ? 'none' : 'block';
    if (navigator.onLine) {
      try { if (typeof retomarBuscas === 'function') retomarBuscas(); } catch (e) {}
    } else {
      try { if (typeof pausarBuscas === 'function') pausarBuscas(); } catch (e) {}
    }
  }
  window.addEventListener('online', syncOnlineStatus);
  window.addEventListener('offline', syncOnlineStatus);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncOnlineStatus);
  else syncOnlineStatus();

  // --- Service Worker (só em http/https; file:// não registra) ---
  // Arquivo: sw-monitor.js (na mesma pasta do HTML)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
    navigator.serviceWorker.register('./sw-monitor.js', {
      scope: './',
      updateViaCache: 'none'
    }).then((reg) => {
      console.log('[PWA] SW registrado', reg.scope);
      reg.update().catch(() => {});
    }).catch((err) => console.warn('[PWA] SW falhou:', err && err.message));
  } else {
    console.log('[PWA] Service Worker requer http/https (não file://)');
  }

  // --- Modo TV / Kiosk ---
  function detectTvMode() {
    try {
      const q = new URLSearchParams(location.search).get('mode');
      if (q === 'tv' || q === 'kiosk') {
        localStorage.setItem('monitor_mode', 'tv');
        return true;
      }
      if (q === 'normal' || q === 'desktop') {
        localStorage.setItem('monitor_mode', 'normal');
        return false;
      }
      return localStorage.getItem('monitor_mode') === 'tv';
    } catch (e) { return false; }
  }

  function applyTvMode(on) {
    document.body.classList.toggle('mode-tv', !!on);
    document.documentElement.classList.toggle('mode-tv', !!on);
    let badge = document.getElementById('tv-mode-badge');
    if (on) {
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'tv-mode-badge';
        badge.title = 'Clique para sair do modo TV';
        badge.style.cssText = 'position:fixed;left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:250000;padding:6px 10px;border-radius:8px;background:rgba(2,8,22,.92);border:1px solid #1e3a8a;color:#7dd3fc;font-size:11px;font-weight:800;cursor:pointer;letter-spacing:.5px';
        badge.textContent = 'MODO TV · clique para sair';
        badge.onclick = () => {
          try { localStorage.setItem('monitor_mode', 'normal'); } catch (e) {}
          location.search = location.search.replace(/[?&]mode=tv/, '').replace(/[?&]mode=kiosk/, '') || '';
          applyTvMode(false);
        };
        document.body.appendChild(badge);
      }
      // Auto-ciclo leve de eventos na lista (destaque)
      if (!window.__tvCycleTimer) {
        let idx = 0;
        window.__tvCycleTimer = setInterval(() => {
          const events = document.querySelectorAll('#event-list .event, #lista-eventos .event, .event');
          if (!events.length) return;
          events.forEach(el => el.classList.remove('tv-highlight'));
          const el = events[idx % events.length];
          if (el) {
            el.classList.add('tv-highlight');
            try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
            try { el.click(); } catch (e) {}
          }
          idx++;
        }, 12000);
      }
      // Preferir painel de clima fixo se existir
      try {
        if (typeof showFcPopup === 'function' && !document.body.classList.contains('weather-panel-pinned')) {
          // não força pin; só evita auto-hide agressivo
        }
      } catch (e) {}
    } else {
      if (badge) badge.remove();
      if (window.__tvCycleTimer) {
        clearInterval(window.__tvCycleTimer);
        window.__tvCycleTimer = null;
      }
      document.querySelectorAll('.tv-highlight').forEach(el => el.classList.remove('tv-highlight'));
    }
  }

  window.toggleTvMode = function () {
    const next = !document.body.classList.contains('mode-tv');
    try { localStorage.setItem('monitor_mode', next ? 'tv' : 'normal'); } catch (e) {}
    applyTvMode(next);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyTvMode(detectTvMode()));
  } else {
    applyTvMode(detectTvMode());
  }
})();

