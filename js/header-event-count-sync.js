(() => {
  const syncHeaderEventCount = () => {
    const source = document.getElementById('events-count-label');
    const target = document.getElementById('ux-events-total-value');
    if (source && target && target.textContent !== source.textContent) target.textContent = source.textContent || '-- eventos';
  };
  PeriodicScheduler.every('header-event-count',syncHeaderEventCount,1200,3000,'ui');
})();

