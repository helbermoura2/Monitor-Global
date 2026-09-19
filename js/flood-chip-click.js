(function () {
  // Delegação: um listener só, em document, em vez de ficar reagendando um
  // bind() a cada 5s pra sempre esperando o chip aparecer (ele é criado
  // dinamicamente). Delegação funciona não importa quando o chip aparece
  // ou reaparece (ex.: re-renderização que troca o elemento), sem precisar
  // de nenhum polling nem de reconferir "já tá vinculado?".
  document.addEventListener('click', function (e) {
    const chip = e.target.closest && e.target.closest('#flood-risk-chip');
    if (!chip) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      if (typeof showFcPopup === 'function') showFcPopup(60000);
      else if (typeof window.showFcPopup === 'function') window.showFcPopup(60000);
      else document.getElementById('weather-shortcut-desktop')?.click();
    } catch (err) {}
  });
})();

