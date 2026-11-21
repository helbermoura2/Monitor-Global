(() => {
  const MAX_LENGTH = 12_000_000;
  const CHUNK_LENGTH = 64_000;
  let image = '';
  let state = 'idle';

  async function encode(canvas) {
    const blob = await new Promise(resolve => {
      const timer = setTimeout(() => resolve(null), 1400);
      try {
        canvas.toBlob(result => { clearTimeout(timer); resolve(result); }, 'image/png');
      } catch {
        clearTimeout(timer);
        resolve(null);
      }
    });
    if (!blob) return canvas.toDataURL('image/png');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

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
              new Promise(resolve => { timer = setTimeout(() => resolve(null), 1800); })
            ]);
          } catch {
            record.shaking = null;
          } finally {
            clearTimeout(timer);
            controller.cancel();
          }
        }
        for (const skipNetworkMaps of [false, true]) {
          try {
            const canvas = await window.SiteEventStory.render(record, { allowMissingMap: true, skipNetworkMaps });
            const url = await encode(canvas);
            const prefix = 'data:image/png;base64,';
            if (typeof url !== 'string' || !url.startsWith(prefix) || url.length > MAX_LENGTH) continue;
            image = url.slice(prefix.length);
            state = 'ready';
            return;
          } catch {
            // Retry the same cartographic template using bundled assets only.
          }
        }
        state = 'failed';
      } catch {
        state = 'failed';
      }
    },
    status() { return state === 'ready' ? image.length : state; },
    chunk(offset) { return image.slice(offset, offset + CHUNK_LENGTH); }
  };
})();
