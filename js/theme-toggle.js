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
    return mode === 'dark';
  };
})();
