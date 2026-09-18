(() => {
  const syncHeaderEventCount = () => {
    const source = document.getElementById('events-count-label');
    const target = document.getElementById('ux-events-total-value');
    if (source && target) target.textContent = source.textContent || '-- eventos';
  };
  setTimeout(syncHeaderEventCount, 1200);
  setInterval(syncHeaderEventCount, 3000);
})();

