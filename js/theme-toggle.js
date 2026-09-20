(() => {
  const KEY = 'mg-theme';
  const btn = document.getElementById('btn-theme-toggle');
  const root = document.documentElement;

  function apply(mode) {
    root.classList.toggle('mg-theme-dark', mode === 'dark');
    if (!btn) return;
    btn.textContent = mode === 'dark' ? '🌑 Visual: Escuro' : '🪟 Visual: Vidro';
    btn.title = mode === 'dark'
      ? 'Visual escuro sólido ativo — toque para voltar ao vidro transparente'
      : 'Visual vidro (transparente) ativo — toque para versão escura sólida';
    btn.setAttribute('aria-pressed', mode === 'dark' ? 'true' : 'false');
  }

  let mode = 'glass';
  try { mode = localStorage.getItem(KEY) === 'dark' ? 'dark' : 'glass'; } catch (e) {}
  apply(mode);

  btn?.addEventListener('click', () => {
    mode = mode === 'dark' ? 'glass' : 'dark';
    try { localStorage.setItem(KEY, mode); } catch (e) {}
    apply(mode);
  });
})();
