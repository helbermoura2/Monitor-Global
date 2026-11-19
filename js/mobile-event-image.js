(() => {
  const MAX_LENGTH = 12_000_000;
  const CHUNK_LENGTH = 64_000;
  let image = '';
  let state = 'idle';

  window.ArgosMobileImage = {
    async render(record) {
      if (state !== 'idle') return;
      state = 'pending';
      try {
        if (record?.type !== 'earthquake' || !Number.isFinite(record.mag) ||
            
            !Array.isArray(record.coords) || record.coords.length !== 2 ||
            !record.coords.every(Number.isFinite) || Math.abs(record.coords[0]) > 180 ||
            Math.abs(record.coords[1]) > 90) throw Error('Dados de origem incompletos');
        // Reuse the same renderer invoked by the site's static earthquake card.
        const controller = window.RuptureShaking;
        if (controller) {
          let timer;
          try {
            record.shaking = await Promise.race([
              controller.query(record),
              new Promise(resolve => { timer = setTimeout(() => resolve(null), 2400); })
            ]);
          } finally {
            clearTimeout(timer);
            controller.cancel();
          }
        }
        const canvas = await window.SiteEventStory.render(record);
        const url = canvas.toDataURL('image/png');
        if (!url.startsWith('data:image/png;base64,') || url.length > MAX_LENGTH) {
          throw Error('Imagem indisponível');
        }
        image = url.slice('data:image/png;base64,'.length);
        state = 'ready';
      } catch {
        state = 'failed';
      }
    },
    status() { return state === 'ready' ? image.length : state; },
    chunk(offset) { return image.slice(offset, offset + CHUNK_LENGTH); }
  };
})();
