(() => {
  const KEY = 'mg-theme';
  const root = document.documentElement;

  function applyClass(mode) {
    root.classList.toggle('mg-theme-dark', mode === 'dark');
  }

  let mode = 'glass';
  try { mode = localStorage.getItem(KEY) === 'dark' ? 'dark' : 'glass'; } catch (e) {}
  applyClass(mode);

  window.mgToggleTheme = function () {
    mode = mode === 'dark' ? 'glass' : 'dark';
    try { localStorage.setItem(KEY, mode); } catch (e) {}
    applyClass(mode);
    syncChip();
    return mode === 'dark';
  };

  function syncChip() {
    const chip = document.getElementById('chip-visual-theme');
    if (!chip) return;
    chip.classList.toggle('on', mode === 'dark');
    chip.textContent = mode === 'dark' ? '🌑 Visual' : '🪟 Visual';
    chip.title = mode === 'dark'
      ? 'Visual escuro sólido ativo — toque para voltar ao vidro transparente'
      : 'Visual vidro (transparente) ativo — toque para versão escura sólida';
  }

  function install() {
    syncChip();
    document.getElementById('chip-visual-theme')?.addEventListener('click', () => window.mgToggleTheme());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
