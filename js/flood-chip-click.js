(function () {
  function bind() {
    const chip = document.getElementById('flood-risk-chip');
    if (!chip || chip.dataset.bound) return;
    chip.dataset.bound = '1';
    chip.style.cursor = 'pointer';
    chip.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      try {
        if (typeof showFcPopup === 'function') showFcPopup(60000);
        else if (typeof window.showFcPopup === 'function') window.showFcPopup(60000);
        else document.getElementById('weather-shortcut-desktop')?.click();
      } catch (err) {}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
  setInterval(bind, 5000);
})();

