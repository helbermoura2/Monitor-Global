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
        if (!['earthquake', 'tsunami'].includes(record?.type)) throw Error('Evento indisponível');
        const controller = window.RuptureShaking;
        if (record.type === 'earthquake' && record.coords?.length === 2 && controller) {
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
        const canvas = await window.SiteEventStory.render(record, { allowMissingMap: true });
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
