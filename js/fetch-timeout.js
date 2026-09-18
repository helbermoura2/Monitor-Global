(() => {
  const nativeFetch = window.fetch.bind(window);
  const activeRequests = new Map();
  window.fetchWithTimeout = async (input, init = {}, timeout = 12000) => {
    const controller = new AbortController();
    const key = typeof input === 'string' ? input : input.url;
    activeRequests.get(key)?.abort();
    activeRequests.set(key, controller);
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await nativeFetch(input, {...init, signal: controller.signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } finally {
      clearTimeout(timer);
      if (activeRequests.get(key) === controller) activeRequests.delete(key);
    }
  };
  window.fetch = (input, init) => window.fetchWithTimeout(input, init);
  const status = (message, type = 'info', retryable = false) => {
    const box = document.getElementById('app-status');
    const text = document.getElementById('app-status-text');
    const retry = document.getElementById('app-status-retry');
    if (!box || !text) return;
    text.textContent = message;
    box.className = `visible ${type}`;
    if (retry) retry.hidden = !retryable;
    if (type === 'info') setTimeout(() => box.classList.remove('visible'), 5000);
  };
  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('button[title]:not([aria-label])').forEach(button => button.setAttribute('aria-label', button.title));
    document.querySelectorAll('button.chip, button.map-tool').forEach(button => {
      if (!button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
      button.addEventListener('click', () => button.setAttribute('aria-pressed', button.classList.contains('active') || button.classList.contains('chip-toggle') ? 'true' : 'false'));
    });
    document.getElementById('app-status-retry')?.addEventListener('click', () => location.reload());
    document.getElementById('empty-map-retry')?.addEventListener('click', () => location.reload());
    window.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      document.body.classList.remove('mobile-events-open', 'mobile-fc-open');
      document.getElementById('ts-vol-panel')?.classList.remove('open');
      document.getElementById('ts-more-menu')?.classList.remove('open');
    });
    status('Conectando às fontes de dados…');
  });
})();

