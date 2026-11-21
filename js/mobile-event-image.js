(() => {
  const MAX_LENGTH = 12_000_000;
  const CHUNK_LENGTH = 64_000;
  let image = '';
  let state = 'idle';
  let mime = '';

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
    return dataUrl(blob);
  }

  function dataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function store(url, type) {
    const comma = typeof url === 'string' ? url.indexOf(',') : -1;
    if (comma < 0 || url.length > MAX_LENGTH || !url.startsWith('data:' + type) ||
        !url.slice(0, comma).endsWith(';base64')) return false;
    image = url.slice(comma + 1);
    mime = type;
    state = 'ready';
    return true;
  }

  window.ArgosMobileImage = {
    async render(record, video = false) {
      if (state !== 'idle') return;
      state = 'pending';
      try {
        if (!['earthquake', 'tsunami'].includes(record?.type)) throw Error('Evento indisponível');
        if (video) {
          const {blob,extension} = await window.QuakeSiteVideo.record(record);
          if (!store(await dataUrl(blob), 'video/' + extension)) throw Error('Vídeo indisponível');
          return;
        }
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
            if (store(url, 'image/png')) return;
          } catch {
            // Retry the same cartographic template using bundled assets only.
          }
        }
        state = 'failed';
      } catch {
        state = 'failed';
      }
    },
    mime() { return mime; },
    status() { return state === 'ready' ? image.length : state; },
    chunk(offset) { return image.slice(offset, offset + CHUNK_LENGTH); }
  };
})();
