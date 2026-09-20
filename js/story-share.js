(function () {
  // Matemática padrão de tile slippy-map (Web Mercator) pra converter lat/lng em
  // posição de pixel no "mundo" num dado zoom, e descobrir quais tiles 256x256
  // cobrem a área que queremos desenhar.
  function lonLatToWorldPx(lon, lat, zoom) {
    const scale = 256 * Math.pow(2, zoom);
    const x = (lon + 180) / 360 * scale;
    const sinLat = Math.sin(lat * Math.PI / 180);
    const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    return [x, y];
  }

  function loadImgCORS(url, timeoutMs = 3500) {
    // Antes não tinha limite de tempo: se um tile nunca disparasse onload
    // NEM onerror (conexão ruim, bloqueio silencioso), o Promise.all() de
    // drawMapBackground ficava esperando pra sempre e o botão "Story"
    // nunca saía de "Gerando…". Agora cada tile desiste sozinho.
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => reject(new Error('tile timeout')), timeoutMs);
      img.crossOrigin = 'anonymous';
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); reject(new Error('tile error')); };
      img.src = url;
    });
  }

  // Mesmo servidor de tiles satélite do mapa principal (ArcGIS World Imagery).
  // Google mt*.google.com NÃO envia CORS → canvas contaminado / tiles falham e
  // o Story ficava preso em "Gerando…" ou saía sem mapa. ArcGIS libera CORS.
  // 'boundaries' é a mesma camada de fronteiras (país/estado/condado) + nomes
  // de lugares que o mapa principal sobrepõe ao satélite (Esri Reference/
  // World_Boundaries_and_Places) — mesmo domínio, mesmo CORS liberado.
  function tileUrl(x, y, z, layer) {
    const path = layer === 'boundaries'
      ? 'Reference/World_Boundaries_and_Places/MapServer'
      : 'World_Imagery/MapServer';
    return `https://server.arcgisonline.com/ArcGIS/rest/services/${path}/tile/${z}/${y}/${x}`;
  }

  async function drawMapBackground(ctx, lon, lat, zoom, w, h, centerPxX, centerPxY) {
    if (centerPxX == null) centerPxX = w / 2;
    if (centerPxY == null) centerPxY = h / 2;
    const [wx, wy] = lonLatToWorldPx(lon, lat, zoom);
    const originX = wx - centerPxX, originY = wy - centerPxY;
    const maxTile = Math.pow(2, zoom);
    const x0 = Math.floor(originX / 256), x1 = Math.floor((originX + w) / 256);
    const y0 = Math.floor(originY / 256), y1 = Math.floor((originY + h) / 256);
    const tiles = [];
    for (let tx = x0; tx <= x1; tx++) {
      for (let ty = y0; ty <= y1; ty++) {
        if (ty < 0 || ty >= maxTile) continue;
        const txw = ((tx % maxTile) + maxTile) % maxTile;
        const px = tx * 256 - originX, py = ty * 256 - originY;
        tiles.push({ txw, ty, px, py });
      }
    }
    // 1ª passada: satélite (base opaca). 2ª passada: fronteiras/nomes por cima
    // — precisa ser depois e esperada à parte, senão uma camada mais lenta
    // pode desenhar antes da outra e ficar por baixo.
    await Promise.all(tiles.map(t =>
      loadImgCORS(tileUrl(t.txw, t.ty, zoom))
        .then(img => ctx.drawImage(img, t.px, t.py, 256, 256))
        .catch(() => {}) // um tile falhar não deve derrubar o resto
    ));
    await Promise.all(tiles.map(t =>
      loadImgCORS(tileUrl(t.txw, t.ty, zoom, 'boundaries'))
        .then(img => ctx.drawImage(img, t.px, t.py, 256, 256))
        .catch(() => {}) // fronteiras são só um extra — se falhar, fica só o satélite
    ));
  }

  // Mesma matemática de calcZoomParaAlcance() (usada pra enquadrar o sismo
  // selecionado na tela), mas usando as dimensões fixas do canvas da imagem
  // de compartilhamento (1080x1920) em vez do container do mapa ao vivo —
  // são superfícies diferentes, então não dá pra só chamar a função da tela.
  function calcZoomParaCanvas(lat, raioKm, larguraPx, alturaPx, margem = 0.8) {
    try {
      const dim = Math.min(larguraPx, alturaPx);
      if (!dim || !raioKm) return 6;
      const diametroMetros = raioKm * 1000 * 2;
      const pxDesejados = dim * margem;
      const mppNecessario = diametroMetros / pxDesejados;
      return Math.log2(156543.03392 * Math.cos(lat * Math.PI / 180) / mppNecessario);
    } catch (e) { return 6; }
  }

  // Zoom fixo pra que a barra de escala do card SEMPRE mostre ≈ 50 km, em vez
  // de variar por magnitude/tipo de evento (antes podia sair até 200 km,
  // deixando as imagens com aproximações bem diferentes entre si). O zoom
  // ainda depende da latitude porque a projeção Web Mercator distorce a
  // escala conforme se afasta do equador — sem isso o "50 km" da barra
  // ficaria errado em eventos longe do equador.
  function zoomFor50km(lat) {
    // Mirar exatamente em 50 km (via log2/pow) é frágil: o arredondamento de
    // ponto flutuante devolve algo como 49.999999999999986, e a função que
    // escolhe o número "bonito" da régua (niceScaleValue, com corte em >=5)
    // empurra isso pro balde de baixo (20 km em vez de 50 km). Mirando um
    // pouco ACIMA de 50 (bem no meio da faixa 50–99), sempre sobra folga
    // suficiente pra cair no balde certo e a régua nunca mostra menos de 50 km.
    //
    // BUG CORRIGIDO: essa conta devolve um zoom FRACIONÁRIO (ex: 9.29). Isso é
    // ótimo pra régua de escala, mas é veneno pra busca de tiles — um esquema
    // de tiles XYZ (usado em drawMapBackground/tileUrl) só existe em zooms
    // INTEIROS; Math.pow(2, zoom) precisa ser uma potência de 2 exata pra
    // formar a grade (largura/altura do "mundo" em tiles, wraparound de
    // longitude etc.). Com zoom fracionário essa grade fica quebrada: o app
    // calculava a posição de um tile inexistente e acabava desenhando o
    // pedaço de mapa de OUTRO lugar do mundo (epicentro aparecendo sobre o
    // Oriente Médio em vez da Croácia) ou nenhum tile carregava (mapa
    // totalmente branco, caso de São Paulo). A partir de agora devolvemos um
    // zoom já arredondado pro inteiro mais próximo — tanto os tiles quanto a
    // régua de escala usam esse MESMO valor inteiro, então ficam sempre
    // consistentes entre si.
    const KM_ALVO = 70, MAX_BAR_PX = 200;
    const metrosPorPxAlvo = (KM_ALVO * 1000) / MAX_BAR_PX;
    try {
      const z = Math.log2(156543.03392 * Math.cos((Number(lat) || 0) * Math.PI / 180) / metrosPorPxAlvo);
      return Math.max(2, Math.min(18, Math.round(z)));
    } catch (e) { return 9; }
  }

  function zoomForItem(item) {
    const lat = (item.coords && isFinite(item.coords[1])) ? item.coords[1] : 0;
    return zoomFor50km(lat);
  }

  function titleForItem(item) {
    const meta = (typeof TYPE_META !== 'undefined' && TYPE_META[item.type]) || {};
    if (item.type === 'earthquake') return `M ${Number(item.mag).toFixed(1)}`;
    return (meta.label || item.type || 'EVENTO').toUpperCase();
  }

  // Extrai o tamanho em px de uma string de ctx.font (ex: '700 32px "X"')
  function fontPxSize(ctx) {
    const m = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
    return m ? parseFloat(m[1]) : 20;
  }

  // Desenha texto com um contorno sólido e fino atrás (halo), em vez de sombra
  // desfocada — mantém as letras nítidas e legíveis em qualquer fundo de mapa,
  // mesmo dando zoom, sem o "vazamento" de cor do mapa por trás.
  function haloFillText(ctx, text, x, y) {
    const size = fontPxSize(ctx);
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = 'rgba(2,6,14,.92)';
    ctx.lineWidth = Math.min(6, Math.max(2, size * 0.11));
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text || '').split(' ');
    let line = '', lines = [];
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    lines.forEach((l, i) => haloFillText(ctx, l, x, y + i * lineHeight));
    return lines.length * lineHeight;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Ícone oficial do app (mesma "varredura de radar" do selo AO VIVO e do
  // epicentro no mapa) — desenhado como vetor (arcos/cunha), não colado como
  // imagem, pra ficar nítido em qualquer resolução de export.
  function drawRadarLogo(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, r * 0.055);
    ctx.globalAlpha = .35;
    [1, 0.68, 0.36].forEach(f => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * f, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    const grad = ctx.createLinearGradient(cx, cy - r, cx, cy);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, r * 0.12), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // Cabeçalho de marca (ícone + "MONITOR GLOBAL") usado nas imagens geradas
  // pra compartilhar — evento avulso e resumo do dia. x/y = onde o TEXTO
  // começa (mesma âncora que já existia); o ícone entra à esquerda dele,
  // sem precisar realinhar o resto do cabeçalho em cada um dos dois lugares.
  function drawBrandHeaderStory(ctx, x, y, color) {
    color = color || '#7dd3fc';
    const r = 20;
    ctx.textAlign = 'left';
    drawRadarLogo(ctx, x + r, y - 11, r, color);
    ctx.fillStyle = color;
    ctx.font = '700 32px "JetBrains Mono", monospace';
    haloFillText(ctx, 'MONITOR GLOBAL', x + r * 2 + 14, y);
  }

  // Arredonda um valor de distância pra um número "redondo" de escala de mapa
  // (1, 2 ou 5 × potência de 10) — mesma lógica usada em barras de escala de
  // mapas de verdade (Google Maps, Leaflet, etc.)
  function niceScaleValue(x) {
    if (!isFinite(x) || x <= 0) return 10;
    const exp = Math.floor(Math.log10(x));
    const base = x / Math.pow(10, exp);
    const nice = base >= 5 ? 5 : (base >= 2 ? 2 : 1);
    return nice * Math.pow(10, exp);
  }

  // Desenha uma barra de escala no mapa (tipo "≈ 100 km"), calculada a partir
  // do zoom real usado pra desenhar os tiles + a latitude (a projeção Web
  // Mercator distorce a escala conforme se afasta do equador).
  function drawScaleBar(ctx, x, y, lat, zoom, cor) {
    const metrosPorPx = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
    if (!isFinite(metrosPorPx) || metrosPorPx <= 0) return;
    const maxBarPx = 200;
    const kmAlvo = (maxBarPx * metrosPorPx) / 1000;
    const km = niceScaleValue(kmAlvo);
    const barPx = (km * 1000) / metrosPorPx;
    ctx.save();
    ctx.strokeStyle = 'rgba(226,232,240,.85)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y - 10);
    ctx.moveTo(x, y); ctx.lineTo(x + barPx, y);
    ctx.moveTo(x + barPx, y); ctx.lineTo(x + barPx, y - 10);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 22px system-ui, sans-serif';
    haloFillText(ctx, `≈ ${km >= 1 ? km : km.toFixed(1)} km`, x, y - 16);
    ctx.restore();
  }

  // Coordenadas em formato legível (N/S/L/O), já que o card mostra o local por
  // extenso mas não o par lat/long — útil pra quem quer conferir num app de mapa.
  function formatCoord(lat, lon) {
    if (!isFinite(lat) || !isFinite(lon)) return '';
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'L' : 'O';
    return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
  }

  // Hora local aproximada no epicentro, estimada só pela longitude (sem base
  // de fusos horários reais/DST) — por isso sempre rotulada como "aprox.".
  function approxLocalTime(t, lon) {
    if (!isFinite(lon)) return '';
    const offsetH = Math.round(lon / 15);
    const d = new Date(new Date(t).getTime() + offsetH * 3600000);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const sinal = offsetH >= 0 ? '+' : '';
    return `${hh}:${mm} local aprox. (UTC${sinal}${offsetH})`;
  }

  // Fundo alternativo (sem mapa real) — usado quando os tiles não carregam ou
  // o canvas fica "contaminado" por CORS (não dá pra exportar). Garante que a
  // função NUNCA falhe silenciosamente: sempre sai uma imagem, no pior caso
  // sem a imagem de satélite.
  // Fundo do Resumo do dia / fallback do Story:
  // base escura + glow na cor do evento (magnitude / tipo) + grade bem suave
  // + arco de “globo” discreto. Mantém legibilidade e identidade de monitor,
  // sem competir com os cards.
  function drawBackground(ctx, w, h, cor) {
    // 1) Base — radial frio (azul-noite → quase preto)
    const base = ctx.createRadialGradient(w * 0.28, h * 0.18, 20, w * 0.45, h * 0.35, w * 1.15);
    base.addColorStop(0, '#122a45');
    base.addColorStop(0.45, '#0a1628');
    base.addColorStop(1, '#03070f');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // 2) Glow da magnitude / cor de destaque (laranja em M5+, azul em dia calmo…)
    // Camada ampla e fraca + mancha menor um pouco mais presente no topo.
    const accent = cor || '#38bdf8';
    function hexToRgba(hex, a) {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
      if (!m) return `rgba(56,189,248,${a})`;
      const n = parseInt(m[1], 16);
      const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      return `rgba(${r},${g},${b},${a})`;
    }
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.12, 10, w * 0.5, h * 0.22, w * 0.75);
    glow.addColorStop(0, hexToRgba(accent, 0.22));
    glow.addColorStop(0.35, hexToRgba(accent, 0.08));
    glow.addColorStop(1, hexToRgba(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // 3) Grade bem mais suave (antes .08; agora quase imperceptível)
    ctx.strokeStyle = 'rgba(125,211,252,.035)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= w; gx += 72) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    }
    for (let gy = 0; gy <= h; gy += 72) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
    }

    // 4) Arco de globo (identidade “global”) — só contorno, bem transparente
    ctx.save();
    ctx.strokeStyle = 'rgba(125,211,252,.10)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // arco inferior-esquerdo → direita, sugerindo curvatura da Terra
    ctx.ellipse(w * 0.5, h * 1.05, w * 0.62, h * 0.28, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(125,211,252,.06)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 1.08, w * 0.48, h * 0.22, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    // meridianos bem leves
    ctx.strokeStyle = 'rgba(125,211,252,.05)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 1.05, w * 0.22, h * 0.28, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.restore();

    // 5) Vignette leve nas bordas (foco no conteúdo)
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.4, h * 0.2, w * 0.5, h * 0.45, h * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // Desenha o arco tipo velocímetro (270°, abertura embaixo) igual ao gauge do
  // painel de detalhe do app: trilho cinza + porção colorida proporcional à
  // "fração" do valor (magnitude normalizada, ou 100% pra eventos sem número).
  // closeFull=true desenha um anel 360° fechado (usado em eventos sem
  // magnitude, tipo alerta civil/vulcão/enchente) em vez do arco de 270° com
  // abertura embaixo — esse "gauge" com abertura só faz sentido pra sismo,
  // onde o preenchimento representa a magnitude; num evento sem número, o
  // anel aberto ficava parecendo quebrado/incompleto em vez de decorativo.
  function drawGauge(ctx, cx, cy, r, frac, cor, closeFull = false) {
    const startDeg = closeFull ? 0 : 135, sweepDeg = closeFull ? 360 : 270;
    const toRad = d => d * Math.PI / 180;
    ctx.lineCap = closeFull ? 'butt' : 'round';
    ctx.lineWidth = 28;
    ctx.strokeStyle = 'rgba(148,163,184,.18)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, toRad(startDeg), toRad(startDeg + sweepDeg));
    ctx.stroke();
    ctx.strokeStyle = cor;
    ctx.shadowColor = cor;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, r, toRad(startDeg), toRad(startDeg + sweepDeg * (closeFull ? 1 : Math.max(0.03, frac))));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }


  /*
   * BANDEIRA NO STORY — correção importante
   * ---------------------------------------
   * BANDEIRA_SP é um SVG em string. Isso funciona corretamente em HTML
   * (innerHTML), mas NÃO pode ser passado para ctx.fillText().
   * Quando isso acontecia, o Canvas desenhava o código "<svg ...>" como
   * texto na imagem compartilhada, que é exatamente o defeito visto no Story.
   *
   * Aqui desenhamos a bandeira do Estado de São Paulo diretamente no Canvas.
   * Assim ela vira pixels reais na imagem PNG e nunca aparece como markup.
   */
  function drawBandeiraStory(ctx, bandeira, cx, baselineY, scale = 0.82) {
    const isSvg = typeof bandeira === 'string' && /^\s*<svg[\s>]/i.test(bandeira);
    if (!isSvg) {
      ctx.textAlign = 'center';
      ctx.font = '46px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(bandeira || '🌐', cx, baselineY);
      return { width: 46, height: 46 };
    }

    // Proporção 300×200 do SVG original, reduzida para ficar elegante
    // ao lado do nome da cidade.
    const W = Math.round(76 * scale / 0.82);
    const H = Math.round(51 * scale / 0.82);
    const x = cx - W / 2;
    const y = baselineY - H + 2;
    const rows = 13;
    const rowH = H / rows;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, W, H);
    ctx.clip();

    for (let i = 0; i < rows; i++) {
      ctx.fillStyle = (i % 2 === 0) ? '#111' : '#fff';
      ctx.fillRect(x, y + i * rowH, W, rowH + 0.5);
    }

    const cw = W * (128 / 300);
    const ch = H * (96 / 200);

    ctx.fillStyle = '#c8102e';
    ctx.fillRect(x, y, cw, ch);

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + cw / 2, y + ch / 2, H * 0.17, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0047ab';
    ctx.beginPath();
    ctx.moveTo(x + cw * 0.352, y + ch * 0.396);
    ctx.quadraticCurveTo(x + cw * 0.43, y + ch * 0.229, x + cw * 0.609, y + ch * 0.292);
    ctx.quadraticCurveTo(x + cw * 0.719, y + ch * 0.354, x + cw * 0.688, y + ch * 0.542);
    ctx.quadraticCurveTo(x + cw * 0.625, y + ch * 0.729, x + cw * 0.484, y + ch * 0.708);
    ctx.quadraticCurveTo(x + cw * 0.344, y + ch * 0.688, x + cw * 0.352, y + ch * 0.396);
    ctx.closePath();
    ctx.fill();

    const star = (sx, sy, r) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = Math.PI / 2 + i * Math.PI / 5;
        const rad = i % 2 === 0 ? r : r * 0.42;
        const px = sx + rad * Math.cos(ang);
        const py = sy - rad * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = '#fedb00';
      ctx.fill();
    };

    const sr = H * 0.045;
    star(x + cw * 0.117, y + ch * 0.12, sr);
    star(x + cw * 0.883, y + ch * 0.12, sr);
    star(x + cw * 0.117, y + ch * 0.88, sr);
    star(x + cw * 0.883, y + ch * 0.88, sr);

    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.75, y + 0.75, W - 1.5, H - 1.5);
    ctx.restore();

    return { width: W, height: H };
  }

  // Bloco "Cidades próximas" no Story: até 2 cidades, com margem inferior
  // segura (Stories cortam o rodapé). Se o y atual estourar, sobe o bloco.
  function drawCidadesProximasStory(ctx, y, rC, W, H) {
    const cities = (rC && Array.isArray(rC.cidades)) ? rC.cidades : [];
    if (!cities.length) return y;
    const n = Math.min(2, cities.length);
    const reserva = !!(rC && rC.reserva);
    const lineH = 28;
    const titleGap = 22;
    const topPad = 18;
    const bottomSafe = 64;
    let need = topPad + titleGap + n * lineH + (reserva ? 24 : 0) + 8;
    if (y + need > H - bottomSafe) {
      y = Math.max(120, H - bottomSafe - need);
    }
    ctx.strokeStyle = 'rgba(148,163,184,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W - 60, y); ctx.stroke();
    y += topPad;
    // Título do bloco com linhas laterais para um acabamento mais limpo.
    ctx.textAlign = 'center';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 18px system-ui, sans-serif';
    const cityTitle = reserva ? 'CIDADES PRÓXIMAS · REFERÊNCIA' : 'CIDADES PRÓXIMAS';
    haloFillText(ctx, cityTitle, W / 2, y);

    ctx.strokeStyle = 'rgba(56,189,248,.42)';
    ctx.lineWidth = 2;
    const titleW = ctx.measureText(cityTitle).width;
    ctx.beginPath();
    ctx.moveTo(60, y - 6); ctx.lineTo((W - titleW) / 2 - 24, y - 6);
    ctx.moveTo((W + titleW) / 2 + 24, y - 6); ctx.lineTo(W - 60, y - 6);
    ctx.stroke();

    y += titleGap + 2;
    for (let i = 0; i < n; i++) {
      const c = cities[i];
      const popTxt = c.pop ? ` · ${formatarPopulacao(c.pop)}` : '';
      const dist = Number.isFinite(Number(c.distancia)) ? Math.round(c.distancia) : '?';

      // Pequena linha-guia à esquerda + texto centralizado.
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(82, y - 7, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f1f5f9';
      ctx.font = '650 22px system-ui, sans-serif';
      haloFillText(ctx, `${c.nome} · ${dist} km${popTxt}`, W / 2, y);
      y += lineH;
    }
    if (reserva) {
      ctx.fillStyle = '#facc15';
      ctx.font = '500 15px system-ui, sans-serif';
      y += wrapText(ctx, '⚠️ lista de referência — sem conexão em tempo real', W / 2, y, W - 160, 18);
    }
    return y;
  }

  // CTA do canal do Telegram, sempre no fim do Story (depois de todo o
  // conteúdo dinâmico) — mesma lógica defensiva do bloco de cidades: se o
  // y atual estourar a margem de segurança do rodapé, sobe o bloco em vez
  // de deixar cortar.
  function drawTelegramCtaStory(ctx, y, W, H) {
    // CTA acompanha o conteúdo. Não fica mais "pregado" no fim do canvas,
    // evitando aquele grande vazio entre Brasil e rodapé.
    const boxX = 90;
    const boxW = W - 180;
    const topGap = 28;
    const boxH = 108;

    y += topGap;

    roundRect(ctx, boxX, y, boxW, boxH, 18);
    ctx.fillStyle = 'rgba(14,165,233,.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(14,165,233,.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.textAlign = 'center';

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 25px system-ui, sans-serif';
    haloFillText(ctx, '📢 Alertas de terremoto M6+ em tempo real', W / 2, y + 42);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 24px system-ui, sans-serif';
    haloFillText(ctx, '📋 Resumo do dia no Telegram: @monitor_global', W / 2, y + 78);

    ctx.restore();
    return y + boxH;
  }

  // Resumo do dia — Top 5 sismos, destaques de outros tipos de evento
  // (vulcão/ciclone/tsunami/tornado/enchente) e um bloco dedicado ao Brasil,
  // no mesmo estilo visual dos Stories por evento (mesma marca, mesmo CTA
  // do Telegram). Diferente do Story de evento único: aqui não há um item
  // central, então o fundo é o gradiente padrão (sem mapa de satélite) e a
  // cor de destaque vem da magnitude do maior sismo do dia.
  //
  // A altura do canvas é calculada ANTES de desenhar (com base na
  // quantidade de itens de cada bloco), pra imagem nunca cortar conteúdo
  // em dias cheios nem sobrar espaço vazio demais em dias tranquilos. Os
  // números usados no cálculo (ex.: 96px por card de destaque) precisam
  // bater com os incrementos de `y` usados de fato no desenho logo abaixo
  // — se um dia mudar o layout de um bloco, ajustar os dois juntos.
  function buildResumoDiarioCanvas() {
    // Layout clássico do Resumo (texto grande, legível em Story/Telegram).
    // Nomes NÃO são cortados com "…" — usam quebra de linha (wrapText).
    const W = 1080;
    const padX = 56;

    function inicioDiaBrasiliaMs(refMs) {
      const ref = Number.isFinite(refMs) ? refMs : Date.now();
      try {
        const fmt = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric', month: '2-digit', day: '2-digit'
        });
        const parts = fmt.formatToParts(new Date(ref));
        const y = parts.find(p => p.type === 'year').value;
        const m = parts.find(p => p.type === 'month').value;
        const d = parts.find(p => p.type === 'day').value;
        return Date.parse(`${y}-${m}-${d}T03:00:00.000Z`);
      } catch (e) {
        const hoje = new Date(ref); hoje.setHours(0, 0, 0, 0);
        return hoje.getTime();
      }
    }
    const inicioHoje = inicioDiaBrasiliaMs(Date.now());
    const fimHoje = inicioHoje + 24 * 3600000 - 1;

    function polirLocalResumo(s) {
      if (!s) return '';
      let t = String(s);
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+SSE\s+of\b/gi, '$1 km SSE de');
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+SSW\s+of\b/gi, '$1 km SSO de');
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+NNE\s+of\b/gi, '$1 km NNE de');
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+NNW\s+of\b/gi, '$1 km NNO de');
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+(?:north-east|northeast)\s+of\b/gi, '$1 km NE de');
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+(?:north-west|northwest)\s+of\b/gi, '$1 km NO de');
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+(?:south-east|southeast)\s+of\b/gi, '$1 km SE de');
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+(?:south-west|southwest)\s+of\b/gi, '$1 km SO de');
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+north\s+of\b/gi, '$1 km N de');
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+south\s+of\b/gi, '$1 km S de');
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+east\s+of\b/gi, '$1 km L de');
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+west\s+of\b/gi, '$1 km O de');
      t = t.replace(/\b(\d+(?:\.\d+)?)\s*km\s+al\s+O\s+de\b/gi, '$1 km a O de');
      t = t.replace(/\bREGION\b/g, 'região');
      t = t.replace(/\bBORDER\b/g, 'fronteira');
      t = t.replace(/\bOFFSHORE\b/gi, 'Offshore');
      t = t.replace(/\bof\b/gi, 'de');
      return t;
    }

    function listaSismosDisponiveis() {
      const buckets = [];
      try { if (typeof globalEvents !== 'undefined' && Array.isArray(globalEvents)) buckets.push(globalEvents); } catch (_) {}
      try { if (typeof window !== 'undefined' && Array.isArray(window.globalEvents)) buckets.push(window.globalEvents); } catch (_) {}
      try { if (typeof lastMerged !== 'undefined' && Array.isArray(lastMerged)) buckets.push(lastMerged); } catch (_) {}
      const byId = new Map();
      buckets.forEach(arr => {
        arr.forEach(e => {
          if (!e || e.type !== 'earthquake') return;
          const id = e.id || `${e.time}|${e.mag}|${(e.coords || []).join(',')}`;
          const prev = byId.get(id);
          if (!prev || (Number(e.mag) || 0) > (Number(prev.mag) || 0)) byId.set(id, e);
        });
      });
      return Array.from(byId.values());
    }

    const sismosHoje = listaSismosDisponiveis()
      .filter(e => Number.isFinite(e.time) && e.time >= inicioHoje && e.time <= Date.now() + 3600000)
      .slice()
      .sort((a, b) => (Number(b.mag) || 0) - (Number(a.mag) || 0))
      .slice(0, 5);

    const top1 = sismosHoje[0];
    const cor = top1 ? getHexColor(top1.mag) : '#38bdf8';

    const labelPlural = {
      volcano: ['vulcão', 'vulcões'],
      hurricane: ['ciclone', 'ciclones'],
      tsunami: ['tsunami', 'tsunamis'],
      tornado: ['tornado', 'tornados'],
      flood: ['enchente', 'enchentes']
    };
    const ALERT_RANK = { red: 3, orange: 2, yellow: 1.5, green: 1 };
    const NIVEL_PT = { green: 'Verde', yellow: 'Amarelo', orange: 'Laranja', red: 'Vermelho' };
    const corAlertLevel = c => c === 'red' ? '#ef4444' : c === 'orange' ? '#fb923c' : c === 'yellow' ? '#facc15' : c === 'green' ? '#4ade80' : '#94a3b8';

    function severidadeEvento(item) {
      if (item.type === 'volcano') return (ALERT_RANK[item.gdacsAlertLevel] || 0.5) + (Number(item.vei) || 0);
      if (item.type === 'hurricane') return (Number(item.windKmh) || 0) / 20;
      if (item.type === 'tsunami') return 5;
      if (item.type === 'flood') return Number(item.sev) || 2;
      return 1;
    }

    function isEventoBrasil(item) {
      if (!item) return false;
      const txt = ((item.place || '') + ' ' + (item.pais || '') + ' ' + (item.descOnly || '')).toLowerCase();
      if (/\b(peru|bol[ií]via|col[oô]mbia|venezuela|guiana|guiana francesa|suriname|paraguai|argentina|uruguai|chile|equador|ecuador)\b/.test(txt)) return false;
      if (item.bandeira && item.bandeira !== '🇧🇷' && item.bandeira !== '🌐') return false;
      if (item.bandeira === '🇧🇷') return true;
      if (item.pais && /brasil|brazil/i.test(String(item.pais))) return true;
      if (/brasil|brazil/.test(txt)) return true;
      if (Array.isArray(item.ufs) && item.ufs.length) return true;
      if (item.coords && Number.isFinite(item.coords[1]) && Number.isFinite(item.coords[0])) {
        const lat = item.coords[1], lng = item.coords[0];
        if (typeof getCountryByCoords === 'function') {
          try {
            const c = getCountryByCoords(lat, lng);
            if (c && /brasil/i.test(c.nome || '')) return true;
            if (c && c.flag && c.flag !== '🇧🇷' && c.flag !== '🌐') return false;
          } catch (_) {}
        }
        return typeof coordsInBrazil === 'function' && coordsInBrazil(lat, lng);
      }
      return false;
    }

    // Mundo (sem Brasil) → Outros eventos
    const eventosMundo = (globalAlerts || []).filter(a => {
      if (!a || !labelPlural[a.type]) return false;
      const t = a.time || a._lastSeenAt || 0;
      if (t < inicioHoje) return false;
      if (isEventoBrasil(a)) return false;
      return true;
    });
    const destaques = eventosMundo.slice().sort((a, b) => severidadeEvento(b) - severidadeEvento(a)).slice(0, 3);
    const contagemPorTipo = {};
    eventosMundo.forEach(e => { contagemPorTipo[e.type] = (contagemPorTipo[e.type] || 0) + 1; });
    destaques.forEach(d => { contagemPorTipo[d.type] = Math.max(0, (contagemPorTipo[d.type] || 0) - 1); });
    const resumoRestantes = Object.keys(labelPlural)
      .filter(t => contagemPorTipo[t] > 0)
      .map(t => {
        const n = contagemPorTipo[t];
        const [s, p] = labelPlural[t];
        const icon = (typeof TYPE_META !== 'undefined' && TYPE_META[t] && TYPE_META[t].icon) || '•';
        return `${icon} +${n} ${n > 1 ? p : s}`;
      });

    const sismosBrasilHoje = listaSismosDisponiveis()
      .filter(e => Number.isFinite(e.time) && e.time >= inicioHoje && isEventoBrasil(e));

    const alertasBrasilPool = (globalAlerts || []).filter(a => {
      if (!a || !isEventoBrasil(a)) return false;
      const t = a.time || a._lastSeenAt || 0;
      if (t > fimHoje) return false;
      return t >= (inicioHoje - 24 * 3600000);
    });
    // Dedupa queimadas INPE parecidas (vários "N focos hoje")
    const seenFire = new Set();
    const alertasBrUniq = [];
    alertasBrasilPool.forEach(a => {
      const isFire = a.type === 'fire' || /queimada|inpe|foco/i.test(String(a.place || '') + String(a.descOnly || ''));
      if (isFire) {
        const key = `fire|${String(a.place || a.descOnly || '').replace(/\d+/g, 'N')}`;
        if (seenFire.has(key)) return;
        seenFire.add(key);
      }
      alertasBrUniq.push(a);
    });
    const noDia = [], vigentes = [];
    alertasBrUniq.forEach(a => {
      const t = a.time || a._lastSeenAt || 0;
      if (t >= inicioHoje && t <= fimHoje) noDia.push(a);
      else vigentes.push(a);
    });
    const itensBrasil = sismosBrasilHoje.concat(noDia).concat(vigentes)
      .sort((a, b) => (b.time || 0) - (a.time || 0))
      .slice(0, 5);

    function fmtHora(t) {
      if (!Number.isFinite(t)) return '—';
      if (typeof formatBrasiliaDateTime === 'function') return formatBrasiliaDateTime(t);
      return new Date(t).toLocaleString('pt-BR');
    }

    function fontesSismosTxt() {
      const set = new Set();
      sismosHoje.forEach(e => {
        const raw = String(e.sourceSummary || e.source || '');
        raw.split(/[·|,;/]+/).map(s => s.trim()).filter(Boolean).forEach(s => {
          const u = s.toUpperCase();
          if (/USGS|EMSC|GEOFON|USP|FUNVISIS|JMA|CSN|IGN|GFZ|IRIS|INGV/.test(u) || s.length <= 12) set.add(s.replace(/\s+/g, ' '));
        });
      });
      // ordem preferencial
      const prefer = ['USGS', 'EMSC', 'GEOFON', 'USP'];
      const list = [];
      prefer.forEach(p => {
        for (const s of set) {
          if (s.toUpperCase().includes(p) && !list.includes(s)) list.push(s);
        }
      });
      set.forEach(s => { if (!list.includes(s)) list.push(s); });
      if (!list.length) return 'USGS · EMSC · outras redes';
      return list.slice(0, 5).join(' · ');
    }

    function tituloEventoCompleto(item) {
      const meta = (typeof TYPE_META !== 'undefined' && TYPE_META[item.type]) || {};
      let nome = polirLocalResumo(item.place || item.descOnly || meta.label || '').trim();
      const emBreve = /^em\s*breve\b/i.test(nome);
      if (emBreve) nome = nome.replace(/^em\s*breve\s*[—\-–:]?\s*/i, '').trim();
      if (item.bandeira && !nome.includes(item.bandeira)) nome = `${item.bandeira} ${nome}`.trim();
      if (emBreve) nome = `Em breve — ${nome}`;
      return nome || meta.label || 'Evento';
    }

    function rotuloBrasilCompleto(item) {
      const meta = (typeof TYPE_META !== 'undefined' && TYPE_META[item.type]) || {};
      if (item.type === 'earthquake') {
        return `M${Number(item.mag).toFixed(1)} · ${polirLocalResumo(item.place || '')}`;
      }
      const isFire = item.type === 'fire' || /queimada|inpe|foco/i.test(String(item.place || '') + String(item.descOnly || ''));
      if (isFire) {
        const m = String(item.place || item.descOnly || '').match(/(\d+)\s*(detec|foco)/i);
        return m ? `Queimadas INPE · ${m[1]} focos hoje` : (item.place || 'Queimadas INPE');
      }
      if (Array.isArray(item.ufs) && item.ufs.length) {
        const titulo = (item.descOnly || meta.label || 'Alerta').trim();
        return `${titulo} — ${item.ufs.join(', ')}`;
      }
      return polirLocalResumo(item.place || meta.label || 'Alerta');
    }

    // ── Altura dinâmica (nomes longos quebram linha) ──
    const boxX = 90, boxW = W - 180;
    // estimativa: ~36px por linha extra de place
    function estimLines(str, charsPerLine) {
      const n = String(str || '').length;
      return Math.max(1, Math.ceil(n / charsPerLine));
    }
    let estSismos = 160;
    if (sismosHoje.length) {
      estSismos = 200 + estimLines(top1 && top1.place, 36) * 36;
      for (let i = 1; i < sismosHoje.length; i++) {
        estSismos += 56 + Math.max(0, estimLines(sismosHoje[i].place, 34) - 1) * 28;
      }
      estSismos += 40;
    }
    let estOutros = 60;
    if (destaques.length) {
      destaques.forEach(d => {
        estOutros += 88 + Math.max(0, estimLines(d.place || d.descOnly, 40) - 1) * 28;
      });
      if (resumoRestantes.length) estOutros += 40;
      estOutros += 20;
    }
    let estBrasil = 60;
    if (itensBrasil.length) {
      itensBrasil.forEach(it => {
        estBrasil += 56 + Math.max(0, estimLines(rotuloBrasilCompleto(it), 38) - 1) * 26;
      });
      estBrasil += 10;
    }
    let H = 320 + estSismos + 90 + estOutros + 90 + estBrasil + 180;
    H = Math.max(1600, Math.min(3200, Math.round(H)));

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    drawBackground(ctx, W, H, cor);

    // ═══ Cabeçalho ═══
    drawBrandHeaderStory(ctx, padX, 74);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(148,163,184,.78)';
    ctx.font = '600 22px system-ui, sans-serif';
    haloFillText(ctx, 'monitorglobal.top', W - padX, 74);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 22px system-ui, sans-serif';
    haloFillText(ctx, 'RESUMO DO DIA', padX, 106);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = '500 20px system-ui, sans-serif';
    const agoraTxt = (typeof formatBrasiliaDateTime === 'function') ? formatBrasiliaDateTime(Date.now()) : new Date().toLocaleString('pt-BR');
    haloFillText(ctx, `Até ${agoraTxt}`, W - padX, 106);

    let y = 200;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 52px system-ui, sans-serif';
    haloFillText(ctx, 'TOP 5 SISMOS DO DIA', W / 2, y);
    y += 42;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 22px system-ui, sans-serif';
    haloFillText(ctx, `Fontes: ${fontesSismosTxt()}`, W / 2, y);
    y += 50;

    if (!sismosHoje.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 30px system-ui, sans-serif';
      haloFillText(ctx, 'Nenhum sismo registrado hoje', W / 2, y + 50);
      y += 140;
    } else {
      // Card #1
      const placeTop = `${top1.bandeira || ''} ${polirLocalResumo(top1.place || '')}`.trim();
      ctx.font = '700 30px system-ui, sans-serif';
      // altura do card conforme linhas do local
      const linesProbe = [];
      {
        const words = placeTop.split(/\s+/);
        let line = '';
        const maxW = boxW - 80;
        words.forEach(w => {
          const test = line ? line + ' ' + w : w;
          if (ctx.measureText(test).width > maxW && line) { linesProbe.push(line); line = w; }
          else line = test;
        });
        if (line) linesProbe.push(line);
      }
      const placeLines = Math.max(1, linesProbe.length);
      const boxH = 150 + (placeLines - 1) * 34;

      roundRect(ctx, boxX, y, boxW, boxH, 20);
      ctx.fillStyle = cor; ctx.globalAlpha = .14; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = cor;
      ctx.font = '800 68px "JetBrains Mono", monospace';
      const magStr = `M${Number(top1.mag).toFixed(1)}`;
      const magW = ctx.measureText(magStr).width;
      haloFillText(ctx, magStr, boxX + 36, y + 72);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '700 20px system-ui, sans-serif';
      haloFillText(ctx, 'MAIOR DO DIA', boxX + 36 + magW + 18, y + 58);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 28px system-ui, sans-serif';
      const used = wrapText(ctx, placeTop, boxX + 36, y + 118, 600, 34);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 22px system-ui, sans-serif';
      haloFillText(ctx, fmtHora(top1.time), boxX + boxW - 36, y + 48);

      y += boxH + 28;

      // #2–#5 — nome completo com wrap
      for (let i = 1; i < sismosHoje.length; i++) {
        const ev = sismosHoje[i];
        const rowTop = y;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#64748b';
        ctx.font = '700 28px "JetBrains Mono", monospace';
        haloFillText(ctx, String(i + 1), boxX + 4, rowTop + 8);

        ctx.fillStyle = getHexColor(ev.mag);
        ctx.font = '800 32px "JetBrains Mono", monospace';
        haloFillText(ctx, `M${Number(ev.mag).toFixed(1)}`, boxX + 48, rowTop + 8);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 26px system-ui, sans-serif';
        const pl = `${ev.bandeira || ''} ${polirLocalResumo(ev.place || '')}`.trim();
        const hPlace = wrapText(ctx, pl, boxX + 180, rowTop + 8, 500, 30);

        ctx.strokeStyle = 'rgba(148,163,184,.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(boxX + 710, rowTop - 8);
        ctx.lineTo(boxX + 710, rowTop + Math.max(40, hPlace + 10));
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillStyle = '#64748b';
        ctx.font = '500 18px system-ui, sans-serif';
        haloFillText(ctx, fmtHora(ev.time), boxX + boxW, rowTop + 8);

        y += Math.max(58, hPlace + 28);
      }
      y += 24;
    }

    // ═══ Outros eventos (mundo) ═══
    ctx.strokeStyle = 'rgba(148,163,184,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W - 60, y); ctx.stroke();
    y += 48;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 36px system-ui, sans-serif';
    haloFillText(ctx, '🌎 OUTROS EVENTOS EM DESTAQUE', W / 2, y);
    y += 44;

    if (!destaques.length) {
      ctx.fillStyle = '#64748b';
      ctx.font = '500 26px system-ui, sans-serif';
      haloFillText(ctx, 'Nenhum outro alerta global prioritário hoje', W / 2, y + 10);
      y += 70;
    } else {
      destaques.forEach(item => {
        const meta = (typeof TYPE_META !== 'undefined' && TYPE_META[item.type]) || { icon: '⚠️', color: '#94a3b8', label: '' };
        const nivel = item.type === 'volcano' ? item.gdacsAlertLevel : null;
        const corItem = nivel ? corAlertLevel(nivel) : (meta.color || '#94a3b8');

        const nome = tituloEventoCompleto(item);
        ctx.font = '650 26px system-ui, sans-serif';
        // estimar altura
        const words = nome.split(/\s+/);
        let lines = 1, line = '';
        words.forEach(w => {
          const test = line ? line + ' ' + w : w;
          if (ctx.measureText(test).width > boxW - 120 && line) { lines++; line = w; }
          else line = test;
        });
        const cardH = 78 + Math.max(0, lines - 1) * 30;

        roundRect(ctx, boxX, y, boxW, cardH, 16);
        ctx.fillStyle = corItem; ctx.globalAlpha = .12; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = corItem; ctx.lineWidth = 1.5; ctx.stroke();

        ctx.textAlign = 'left';
        ctx.fillStyle = corItem;
        ctx.font = '700 32px system-ui, sans-serif';
        haloFillText(ctx, meta.icon || '⚠️', boxX + 22, y + 40);

        ctx.fillStyle = '#f1f5f9';
        ctx.font = '650 26px system-ui, sans-serif';
        const hNome = wrapText(ctx, nome, boxX + 74, y + 34, boxW - 120, 30);

        let sub = meta.label || '';
        if (item.type === 'volcano' && nivel) sub = `Vulcanismo · Nível ${NIVEL_PT[nivel] || nivel}`;
        else if (item.type === 'flood' && item.sev != null) sub = `Enchente · sev. ${item.sev}`;
        else if (item.type === 'hurricane' && item.windKmh) sub = `Ciclone · ${Math.round(item.windKmh)} km/h`;
        else if (item.type === 'tornado') sub = 'Tornado';
        else if (item.type === 'tsunami') sub = 'Tsunami';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 20px system-ui, sans-serif';
        haloFillText(ctx, sub, boxX + 74, y + 34 + hNome + 8);

        y += cardH + 14;
      });

      if (resumoRestantes.length) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = '500 22px system-ui, sans-serif';
        haloFillText(ctx, resumoRestantes.join('   ·   '), W / 2, y + 12);
        y += 44;
      }
      y += 8;
    }

    // ═══ Brasil ═══
    ctx.strokeStyle = 'rgba(148,163,184,.18)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, y); ctx.lineTo(W - 60, y); ctx.stroke();
    y += 48;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 36px system-ui, sans-serif';
    haloFillText(ctx, '🇧🇷 BRASIL HOJE', W / 2, y);
    y += 44;

    if (!itensBrasil.length) {
      ctx.fillStyle = '#4ade80';
      ctx.font = '600 26px system-ui, sans-serif';
      haloFillText(ctx, '✓ Nenhum registro relevante hoje', W / 2, y + 8);
      y += 60;
    } else {
      itensBrasil.forEach(item => {
        const meta = (typeof TYPE_META !== 'undefined' && TYPE_META[item.type]) || { icon: '📍', color: '#94a3b8' };
        const isFire = item.type === 'fire' || /queimada|inpe|foco/i.test(String(item.place || '') + String(item.descOnly || ''));
        const txt = rotuloBrasilCompleto(item);
        const icon = isFire ? '🔥' : (meta.icon || '📍');

        ctx.textAlign = 'left';
        ctx.fillStyle = meta.color || '#94a3b8';
        ctx.font = '700 28px system-ui, sans-serif';
        haloFillText(ctx, icon, boxX, y + 4);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 24px system-ui, sans-serif';
        const hTxt = wrapText(ctx, txt, boxX + 48, y + 4, 560, 28);

        ctx.strokeStyle = 'rgba(148,163,184,.14)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(boxX + 700, y - 8);
        ctx.lineTo(boxX + 700, y + Math.max(36, hTxt + 8));
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillStyle = '#64748b';
        ctx.font = '500 18px system-ui, sans-serif';
        const t = item.time || item._lastSeenAt || 0;
        let horaLabel = fmtHora(t);
        if (isFire && t >= inicioHoje && t <= inicioHoje + 5 * 60000) horaLabel = 'hoje';
        haloFillText(ctx, horaLabel, boxX + boxW, y + 4);

        y += Math.max(52, hTxt + 24);
      });
      y += 8;
    }

    y = drawTelegramCtaStory(ctx, y, W, H);

    // Corta o canvas exatamente depois do rodapé. Isso elimina o espaço
    // vazio que aparecia quando a estimativa de altura ficava maior que o
    // conteúdo realmente desenhado.
    const finalH = Math.min(H, Math.max(900, Math.ceil(y + 42)));
    if (finalH < H) {
      const cropped = document.createElement('canvas');
      cropped.width = W;
      cropped.height = finalH;
      const cctx = cropped.getContext('2d');
      cctx.drawImage(canvas, 0, 0, W, finalH, 0, 0, W, finalH);
      return cropped;
    }
    return canvas;
  }

  async function shareResumoDiarioStory() {
    if (storyBusy) return;
    storyBusy = true;
    const btn = document.getElementById('btn-resumo-dia');
    const originalLabel = btn ? btn.textContent : '';
    if (btn) { btn.textContent = '⏳ Gerando…'; btn.disabled = true; }
    try {
      const canvas = await comTimeout(Promise.resolve(buildResumoDiarioCanvas()), 15000, 'geração da imagem demorou demais');
      const blob = await comTimeout(canvasToBlob(canvas), 6000, 'exportação da imagem demorou demais');
      if (!blob || !blob.size) throw new Error('blob vazio');
      const dataStamp = new Date().toISOString().slice(0, 10);
      const fileName = `resumo-do-dia-${dataStamp}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      const shareData = { files: [file], title: 'Monitor Global', text: 'Resumo do dia — Top 5 sismos' };
      let shared = false;
      try {
        if (navigator.canShare && navigator.canShare(shareData) && navigator.share) {
          if (btn) btn.textContent = '📤 Abrindo…';
          await navigator.share(shareData);
          shared = true;
        }
      } catch (shareErr) {
        if (shareErr && shareErr.name === 'AbortError') {
          shared = true;
        } else if (typeof dbgLog === 'function') {
          dbgLog('resumo-dia-share navigator.share:', shareErr);
        }
      }
      if (!shared) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 8000);
        if (typeof showToast === 'function') {
          showToast('Imagem pronta — salva nos downloads pra postar no canal.', 'info');
        }
      }
    } catch (e) {
      if (e && e.name !== 'AbortError' && typeof showToast === 'function') {
        showToast('Não consegui gerar o resumo do dia. Tenta de novo?', 'error');
      }
      if (typeof dbgLog === 'function') dbgLog('resumo-dia falhou:', e);
    } finally {
      storyBusy = false;
      if (btn) { btn.textContent = originalLabel || '🏆 Resumo do dia'; btn.disabled = false; }
    }
  }
  // O botão #btn-resumo-dia chama isso via onclick inline no HTML (fora
  // desta closure) — sem isso, o clique dava ReferenceError silencioso e
  // o botão parecia simplesmente não fazer nada.
  window.shareResumoDiarioStory = shareResumoDiarioStory;

  async function buildStoryCanvas(item) {
    // Sempre a versão mais recente (revisão de mag etc.) — evita Story com dado velho
    try {
      if (item && item.id != null && typeof EventStore !== 'undefined') {
        const fresh = EventStore.getById(item.id);
        if (fresh) item = fresh;
      }
    } catch (e) {}
    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const meta = (typeof TYPE_META !== 'undefined' && TYPE_META[item.type]) || { color: '#38bdf8', icon: '🌍' };
    const isQuake = item.type === 'earthquake' || (item.mag != null && !item.type);
    const isUpdatedStory = !!(item && item._deltaTxt && typeof activeUpdatedIds !== 'undefined' && activeUpdatedIds.has(item.id));
    const cor = isQuake && typeof getHexColor === 'function' ? getHexColor(item.mag) : (meta.color || '#38bdf8');
    const [lng, lat] = item.coords || [0, 0];

    // Mapa de satélite com o epicentro centralizado — a referência que fica no
    // topo, com o resto do card sobreposto por baixo (degradê escuro).
    const markerCx = W / 2, markerCy = H * 0.27;
    const mapZoom = zoomForItem(item);
    let usouMapa = true;
    try {
      await drawMapBackground(ctx, lng, lat, mapZoom, W, H, markerCx, markerCy);
      // Se der SecurityError na hora de exportar (canvas contaminado por tile
      // sem CORS liberado), cai no catch e refaz tudo sem mapa.
      canvas.getContext('2d').getImageData(0, 0, 1, 1);
    } catch (e) {
      usouMapa = false;
    }
    if (!usouMapa) {
      ctx.clearRect(0, 0, W, H);
      drawBackground(ctx, W, H, cor);
    }

    // Degradê escuro cobrindo a parte de baixo, onde fica o card — deixa o
    // mapa visível em cima e o texto legível embaixo
    const grad = ctx.createLinearGradient(0, H * 0.10, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.30, 'rgba(0,0,0,.10)');
    grad.addColorStop(0.55, 'rgba(0,0,0,.45)');
    grad.addColorStop(1, 'rgba(0,0,0,.62)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, H * 0.10, W, H * 0.90);
    // Leve degradê no topo, pro cabeçalho de marca não brigar com o mapa
    const gradTop = ctx.createLinearGradient(0, 0, 0, 200);
    gradTop.addColorStop(0, 'rgba(3,9,20,.8)');
    gradTop.addColorStop(1, 'rgba(3,9,20,0)');
    ctx.fillStyle = gradTop;
    ctx.fillRect(0, 0, W, 200);

    // Marcador no epicentro — anel externo suave + anel principal com brilho +
    // ponto central, pra ficar claramente em destaque mesmo com o mapa por trás
    ctx.beginPath(); ctx.arc(markerCx, markerCy, 68, 0, Math.PI * 2);
    ctx.strokeStyle = cor; ctx.globalAlpha = .35; ctx.lineWidth = 3; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(markerCx, markerCy, 46, 0, Math.PI * 2);
    ctx.strokeStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = 22; ctx.lineWidth = 6; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(markerCx, markerCy, 7, 0, Math.PI * 2);
    ctx.fillStyle = cor; ctx.shadowColor = cor; ctx.shadowBlur = 16; ctx.fill();
    ctx.shadowBlur = 0;

    // Escala de distância no mapa (ex: "≈ 100 km"), calculada a partir do
    // zoom real dos tiles — dá noção de proporção sem precisar conhecer a região
    drawScaleBar(ctx, 60, 700, lat, mapZoom, cor);

    // Texto: usamos halo (contorno sólido, ver haloFillText/wrapText) em vez
    // de sombra desfocada — mais nítido e sem vazar a cor do mapa por trás

    // Cabeçalho de marca — nome à esquerda, domínio à direita na mesma linha
    // (a marca d'água saiu do rodapé: embaixo já não cabia com cidade + aviso)
    // Não usar location.hostname aqui: ao compartilhar um HTML local no Android,
    // ele pode virar "com.google.android.apps.nbu.files.provider" na imagem.
    const brandHost = 'monitorglobal.top';
    drawBrandHeaderStory(ctx, 56, 74);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(148,163,184,.78)';
    ctx.font = '600 22px system-ui, sans-serif';
    haloFillText(ctx, brandHost, W - 56, 74);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 22px system-ui, sans-serif';
    haloFillText(ctx, isUpdatedStory ? 'ATUALIZADO' : 'AO VIVO', 56, 106);
    if (isUpdatedStory && item._deltaTxt) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '700 22px system-ui, sans-serif';
      haloFillText(ctx, String(item._deltaTxt).slice(0, 42), 56, 136);
    }

    // Gauge estilo velocímetro do painel — o anel e o texto (M5.5 etc.) são
    // tratados como um bloco único e centralizados juntos, em vez de usar uma
    // posição X fixa (que deixava o conjunto puxado pro canto)
    const gy = isQuake ? 860 : 1080, gr = 130;
    const frac = isQuake ? Math.max(0.04, Math.min(1, (item.mag - 2) / 7)) : 1;
    const gapGaugeText = 40;
    const mainFont = isQuake ? '800 96px "JetBrains Mono", monospace' : '800 42px "JetBrains Mono", monospace';
    const mainText = isQuake ? `M${Number(item.mag).toFixed(1)}` : (meta.label || item.type || '').toUpperCase();
    ctx.font = mainFont;
    const mainTextW = ctx.measureText(mainText).width;
    const gaugeOuterR = gr + 14; // raio + metade da espessura do traço
    const groupW = gaugeOuterR * 2 + gapGaugeText + mainTextW;
    const gx = W / 2 - groupW / 2 + gaugeOuterR;
    drawGauge(ctx, gx, gy, gr, frac, cor, !isQuake);
    ctx.textAlign = 'left';
    ctx.fillStyle = cor;
    if (isQuake) {
      haloFillText(ctx, mainText, gx + gr + gapGaugeText, gy + 30);
    } else {
      ctx.font = '700 100px system-ui, sans-serif';
      const iconTxt = meta.icon || '🌍';
      const iconW = ctx.measureText(iconTxt).width;
      ctx.fillText(iconTxt, gx - iconW / 2, gy + 34);
      ctx.fillStyle = cor;
      ctx.font = mainFont;
      haloFillText(ctx, mainText, gx + gr + gapGaugeText, gy + 14);
    }

    let y = gy + gr + 72;

    // Local + bandeira
    // A bandeira é desenhada como pixels no Canvas (nunca como SVG/texto).
    // Ela fica na mesma linha do nome para o cabeçalho ficar mais compacto,
    // equilibrado e bonito no formato vertical de Story.
    const placeTxt = item.place || '';
    ctx.font = '700 42px system-ui, sans-serif';
    const placeW = ctx.measureText(placeTxt).width;
    const flagW = 76;
    const gapTitle = 18;
    const placeGroupW = flagW + gapTitle + placeW;

    if (placeTxt && placeGroupW <= W - 140) {
      const groupX = (W - placeGroupW) / 2;
      drawBandeiraStory(ctx, item.bandeira || '🌐', groupX + flagW / 2, y - 2, 0.82);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 42px system-ui, sans-serif';
      haloFillText(ctx, placeTxt, groupX + flagW + gapTitle, y + 2);
      ctx.textAlign = 'center';
      y += isQuake ? 70 : 92;
    } else {
      drawBandeiraStory(ctx, item.bandeira || '🌐', W / 2, y, 0.82);
      y += isQuake ? 62 : 82;
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 42px system-ui, sans-serif';
      y += wrapText(ctx, placeTxt, W / 2, y, W - 140, 48);
      y += isQuake ? 18 : 40;
    }

    // Data/hora
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 27px system-ui, sans-serif';
    const horario = (typeof formatBrasiliaDateTime === 'function') ? formatBrasiliaDateTime(item.time) : new Date(item.time).toLocaleString('pt-BR');
    haloFillText(ctx, horario, W / 2, y);
    y += isQuake ? 34 : 50;

    // Horário local aproximado do epicentro (estimado pela longitude) +
    // coordenadas — informação extra útil pra quem tá fora do fuso do evento
    const infoExtra = [approxLocalTime(item.time, lng), formatCoord(lat, lng)].filter(Boolean).join(' · ');
    if (infoExtra) {
      ctx.fillStyle = '#64748b';
      ctx.font = '500 21px system-ui, sans-serif';
      y += wrapText(ctx, infoExtra, W / 2, y, W - 140, 24);
      y += isQuake ? 10 : 30;
    }

    // Fontes + selo de qualidade (mesma lógica do painel: várias fontes com
    // magnitude cada, ou uma fonte só; selo A/B/C explicado por extenso)
    if (isQuake) {
      const magLines = (item.magnitudes || []).map(x => `${x.source} M${Number(x.mag).toFixed(1)}`).join(' · ');
      const fontLine = item.sourceCount > 1 && magLines
        ? `Fontes: ${magLines}`
        : `Fonte: ${item.sourceSummary || item.source || '—'}`;
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '500 25px system-ui, sans-serif';
      y += wrapText(ctx, fontLine, W / 2, y, W - 140, 32);
      y += 18;
      if (item.quality) {
        const qs = { A: 'confirmado por 2+ fontes', B: 'fonte única confiável', C: 'magnitude baixa / menos precisa' };
        const qCor = { A: '#4ade80', B: '#38bdf8', C: '#fbbf24' }[item.quality] || '#94a3b8';
        ctx.textAlign = 'left';
        ctx.font = '800 24px "JetBrains Mono", monospace';
        const label = item.quality;
        const bw = ctx.measureText(label).width + 24;
        ctx.font = '500 22px system-ui, sans-serif';
        const descTxt = qs[item.quality] || '';
        const gapBadgeTxt = 12;
        const descW = ctx.measureText(descTxt).width;
        const totalW = bw + gapBadgeTxt + descW;
        const startX = W / 2 - totalW / 2;
        roundRect(ctx, startX, y - 28, bw, 36, 8);
        ctx.fillStyle = qCor; ctx.globalAlpha = .18; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = qCor; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = qCor;
        ctx.font = '800 24px "JetBrains Mono", monospace';
        haloFillText(ctx, label, startX + 12, y - 2);
        ctx.font = '500 22px system-ui, sans-serif';
        ctx.fillStyle = '#94a3b8';
        haloFillText(ctx, descTxt, startX + bw + gapBadgeTxt, y - 2);
        ctx.textAlign = 'center';
      }
      y += 52;
    } else {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '500 25px system-ui, sans-serif';
      haloFillText(ctx, `Fonte: ${item.sourceSummary || item.source || '—'}`, W / 2, y);
      y += 90;

      // Selo de nível de alerta (GDACS: green/orange/red) — mesmo estilo do
      // selo A/B/C dos sismos, pra preencher o card em tipos sem cards de
      // estatística (vulcão, enchente etc.) em vez de deixar espaço vazio
      const nivelMatch = String(item.detail || '').match(/green|orange|red/i);
      if (nivelMatch) {
        const nivelInfo = {
          green:  { label: 'VERDE', desc: 'monitorado, sem impacto significativo', cor: '#4ade80' },
          orange: { label: 'LARANJA', desc: 'impacto moderado, atenção', cor: '#fb923c' },
          red:    { label: 'VERMELHO', desc: 'impacto potencialmente grave', cor: '#ef4444' }
        }[nivelMatch[0].toLowerCase()];
        ctx.textAlign = 'left';
        ctx.font = '800 24px "JetBrains Mono", monospace';
        const label = nivelInfo.label;
        const bw = ctx.measureText(label).width + 24;
        ctx.font = '500 22px system-ui, sans-serif';
        const descTxt = nivelInfo.desc;
        const gapBadgeTxt = 12;
        const descW = ctx.measureText(descTxt).width;
        const totalW = bw + gapBadgeTxt + descW;
        const startX = W / 2 - totalW / 2;
        roundRect(ctx, startX, y - 28, bw, 36, 8);
        ctx.fillStyle = nivelInfo.cor; ctx.globalAlpha = .18; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = nivelInfo.cor; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = nivelInfo.cor;
        ctx.font = '800 24px "JetBrains Mono", monospace';
        haloFillText(ctx, label, startX + 12, y - 2);
        ctx.font = '500 22px system-ui, sans-serif';
        ctx.fillStyle = '#94a3b8';
        haloFillText(ctx, descTxt, startX + bw + gapBadgeTxt, y - 2);
        ctx.textAlign = 'center';
        y += 100;
      }

      // Cidades próximas (até 2) — mesmo bloco do sismo, com margem segura
      if (item.coords) {
        const rC2 = await resolverCidadesStory(item.coords[1], item.coords[0], 2);
        y = drawCidadesProximasStory(ctx, y, rC2, W, H);
      }
    }

    // Cards de estatística (só sismo — profundidade/intensidade/energia, igual
    // ao painel de detalhe)
    if (isQuake) {
      const depth = Math.max(0, item.depth || 0);
      const depthInfo = (typeof classificarProfundidade === 'function') ? classificarProfundidade(depth) : { label: '', cor: '#94a3b8' };
      const mer = (typeof estimarMercalli === 'function') ? estimarMercalli(item.mag, depth) : { nivel: '—', cor: '#94a3b8' };
      const en = (typeof calcularEnergia === 'function') ? calcularEnergia(item.mag) : { tnt: '—' };

      const cardW = 300, cardH = 170, gap = 30, cardsTotalW = cardW * 3 + gap * 2;
      const cardX0 = (W - cardsTotalW) / 2;
      const cards = [
        { label: 'PROFUNDIDADE', value: `${depth.toFixed(1)} km`, sub: depthInfo.label, subCor: depthInfo.cor },
        { label: 'INTENSIDADE (MMI)', value: mer.nivel, sub: '', subCor: mer.cor, valCor: mer.cor },
        { label: 'ENERGIA', value: en.tnt.replace(' de TNT', ''), sub: 'TNT equiv.', subCor: '#94a3b8' }
      ];
      cards.forEach((c, i) => {
        const cxCard = cardX0 + i * (cardW + gap);
        if (i > 0) {
          ctx.strokeStyle = 'rgba(148,163,184,.18)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cxCard - gap / 2, y + 10);
          ctx.lineTo(cxCard - gap / 2, y + cardH - 10);
          ctx.stroke();
        }
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748b';
        ctx.font = '700 18px system-ui, sans-serif';
        wrapText(ctx, c.label, cxCard + cardW / 2, y + 38, cardW - 24, 22);
        ctx.fillStyle = c.valCor || '#f8fafc';
        ctx.font = '800 38px "JetBrains Mono", monospace';
        haloFillText(ctx, c.value, cxCard + cardW / 2, y + 100);
        if (c.sub) {
          ctx.fillStyle = c.subCor || '#94a3b8';
          ctx.font = '600 20px system-ui, sans-serif';
          haloFillText(ctx, c.sub, cxCard + cardW / 2, y + 138);
        }
      });
      y += cardH + 36;

      // Mecanismo focal (mesma função usada no painel — sem esperar a consulta
      // real ao USGS, que é assíncrona; usa direto a estimativa geométrica)
      if (typeof calcularMecanismoFocal === 'function' && item.coords) {
        const mec = item.mecanismoReal || calcularMecanismoFocal(depth, item.coords[1], item.coords[0], item.place);
        // boxH maior: a descrição ("As placas…") ficava colada no ícone/título
        const boxH = 158;
        ctx.strokeStyle = 'rgba(148,163,184,.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(60, y);
        ctx.lineTo(W - 60, y);
        ctx.stroke();

        const iconTxt = mec.emoji || '➡️';
        const tipoTxt = mec.tipo || '';
        ctx.font = '54px system-ui, sans-serif';
        const iconW = ctx.measureText(iconTxt).width;
        ctx.font = '700 28px system-ui, sans-serif';
        const tipoW = ctx.measureText(tipoTxt).width;
        const headGap = 20;
        const headStartX = W / 2 - (iconW + headGap + tipoW) / 2;

        // Ícone + tipo alinhados; descrição bem abaixo pra não sobrepor o desenho
        ctx.textAlign = 'left';
        ctx.font = '54px system-ui, sans-serif';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(iconTxt, headStartX, y + 72);
        ctx.font = '700 28px system-ui, sans-serif';
        ctx.fillStyle = '#f8fafc';
        haloFillText(ctx, tipoTxt, headStartX + iconW + headGap, y + 48);

        ctx.textAlign = 'center';
        ctx.font = '500 23px system-ui, sans-serif';
        ctx.fillStyle = '#94a3b8';
        wrapText(ctx, mec.desc || '', W / 2, y + 118, W - 160, 28);
        y += boxH + 40;
      }

      // Cidades próximas (até 2) — bloco sobe sozinho se o rodapé cortar
      if (item.coords) {
        const rC = await resolverCidadesStory(item.coords[1], item.coords[0], 2);
        y = drawCidadesProximasStory(ctx, y, rC, W, H);
      }
    }

    // Marca d'água fica no cabeçalho (mesma linha do nome do projeto);
    // o canal do Telegram fecha o Story, sempre por último.
    y = drawTelegramCtaStory(ctx, y, W, H);

    return canvas;
  }

  function canvasToDataURLBlob(canvas) {
    // Fallback pro bug conhecido de algumas WebViews Android: toBlob() às
    // vezes nunca chama o callback. toDataURL() é síncrono, então não tem
    // como travar — convertemos o base64 pra Blob na mão.
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
  }

  function canvasToBlob(canvas, timeoutMs = 5000) {
    return new Promise((resolve) => {
      let done = false;
      const fallback = setTimeout(() => {
        if (done) return;
        done = true;
        try { resolve(canvasToDataURLBlob(canvas)); } catch (e) { resolve(null); }
      }, timeoutMs);
      try {
        canvas.toBlob(b => {
          if (done) return;
          done = true;
          clearTimeout(fallback);
          resolve(b || canvasToDataURLBlob(canvas));
        }, 'image/png', 0.95);
      } catch (e) {
        if (!done) { done = true; clearTimeout(fallback); resolve(canvasToDataURLBlob(canvas)); }
      }
    });
  }

  // Se o gerador todo (mapa + cidade mais próxima + desenho) travar por
  // qualquer motivo (rede lenta/bloqueada, mirror fora do ar etc.), o botão
  // não pode ficar preso em "Gerando…" pra sempre — depois de 12s desiste
  // e avisa, em vez de deixar o usuário sem resposta nenhuma.
  function comTimeout(promise, ms, msg) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(msg || 'timeout')), ms))
    ]);
  }

  // Cidades no Story: tenta ao vivo (Worker / Photon / Overpass) com timeout
  // curto; se falhar, cai na lista de referência — sem travar o botão.
  async function resolverCidadesStory(lat, lng, maxC) {
    const n = Math.max(1, Math.min(4, maxC || 2));
    const withTimeout = (p, ms) => Promise.race([
      p,
      new Promise(resolve => setTimeout(() => resolve(null), ms))
    ]);

    // 1) Endpoint próprio do Worker (melhor no Android / sem CORS)
    try {
      let base = '';
      try {
        if (typeof WORKER_PROXY === 'function') base = WORKER_PROXY('').split('?')[0].replace(/\/$/,'');
      } catch (e) {}
      if (!base) base = 'https://black-sky-9ba0.terrestre.workers.dev';
      const u = base + '/nearby-cities?lat=' + encodeURIComponent(lat) +
        '&lon=' + encodeURIComponent(lng) + '&limit=' + encodeURIComponent(n);
      const r = await withTimeout(fetch(u, { cache: 'no-store' }).then(async res => {
        if (!res.ok) return null;
        return res.json();
      }), 4500);
      const arr = r && Array.isArray(r.cities) ? r.cities : [];
      const mapped = arr.map(c => ({
        nome: c.name || c.nome || '',
        lat: Number(c.lat),
        lng: Number(c.lon != null ? c.lon : c.lng),
        distancia: Number(c.distanceKm != null ? c.distanceKm : c.distancia),
        pop: Number(c.population || c.pop) || 0
      })).filter(c => c.nome && Number.isFinite(c.distancia));
      if (mapped.length) return { cidades: mapped.slice(0, n), reserva: false };
    } catch (e) {}

    // 2) Mesma resolução ao vivo do painel do site
    try {
      if (typeof getCidadesProximasReal === 'function') {
        const real = await withTimeout(getCidadesProximasReal(lat, lng, n), 4500);
        if (real && real.length) return { cidades: real.slice(0, n), reserva: false };
      }
    } catch (e) {}

    // 3) Reserva local (só se a rede falhar)
    try {
      if (typeof getCidadesProximas === 'function') {
        const local = getCidadesProximas(lat, lng, 800, n) || [];
        return { cidades: local, reserva: true };
      }
    } catch (e) {}
    return { cidades: [], reserva: true };
  }

  let storyBusy = false;

  async function shareEventAsStory(item) {
    if (storyBusy) return;
    try {
      if (item && item.id != null && typeof EventStore !== 'undefined') {
        const fresh = EventStore.getById(item.id);
        if (fresh) item = fresh;
      }
    } catch (e) {}
    if (storyBusy) return;
    storyBusy = true;
    const btn = document.getElementById('pd-share-btn');
    const originalLabel = '📤 Story';
    if (btn) { btn.textContent = '⏳ Gerando…'; btn.disabled = true; }
    try {
      const canvas = await comTimeout(buildStoryCanvas(item), 15000, 'geração da imagem demorou demais');
      const blob = await comTimeout(canvasToBlob(canvas), 6000, 'exportação da imagem demorou demais');
      if (!blob || !blob.size) throw new Error('blob vazio');
      const fileName = `evento-${(item.type || 'evento')}-${String(item.id || Date.now()).replace(/[^\w.-]+/g, '_')}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      const shareData = {
        files: [file],
        title: 'Monitor Global',
        text: `${titleForItem(item)} — ${item.place || ''}`
      };
      let shared = false;
      try {
        if (navigator.canShare && navigator.canShare(shareData) && navigator.share) {
          if (btn) btn.textContent = '📤 Abrindo…';
          await navigator.share(shareData);
          shared = true;
        }
      } catch (shareErr) {
        if (shareErr && shareErr.name === 'AbortError') {
          shared = true; // usuário cancelou o sheet — não é falha de geração
        } else if (typeof dbgLog === 'function') {
          dbgLog('story-share navigator.share:', shareErr);
        }
      }
      if (!shared) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 8000);
        if (typeof showToast === 'function') {
          showToast('Imagem pronta — salva nos downloads pra postar no Story.', 'info');
        }
      }
    } catch (e) {
      if (e && e.name !== 'AbortError' && typeof showToast === 'function') {
        showToast('Não consegui gerar a imagem pra compartilhar. Tenta de novo?', 'error');
      }
      if (typeof dbgLog === 'function') dbgLog('story-share falhou:', e);
    } finally {
      storyBusy = false;
      if (btn) { btn.textContent = originalLabel; btn.disabled = false; }
    }
  }

  function install() {
    const btn = document.getElementById('pd-share-btn');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      // Fonte única: EventStore → globalEvents → globalAlerts → lastMerged
      let item = null;
      try {
        if (typeof EventStore !== 'undefined') {
          EventStore.syncFromLegacy();
          item = EventStore.getSelected();
        }
      } catch (e) {}
      if (!item) {
        const id = (typeof eventoSelecionadoId !== 'undefined') ? eventoSelecionadoId : null;
        if (id != null) {
          if (typeof globalEvents !== 'undefined' && Array.isArray(globalEvents))
            item = globalEvents.find(x => x.id === id) || null;
          if (!item && typeof globalAlerts !== 'undefined' && Array.isArray(globalAlerts))
            item = globalAlerts.find(x => x.id === id) || null;
          if (!item && typeof lastMerged !== 'undefined' && Array.isArray(lastMerged))
            item = lastMerged.find(x => x.id === id) || null;
        }
      }
      if (!item || !item.coords) {
        if (typeof showToast === 'function') showToast('Selecione um evento na lista primeiro.', 'info');
        return;
      }
      shareEventAsStory(item);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();

