import {contextFrame,referencePlaces,drawMapReferences} from './alert-cartography.mjs';
// PNG primitives and seismic image rendering. Daily summaries receive prepared data.
import {FONT_CHARS_TEXT, FONT_CHARS_HERO, FLAG_CELL_W, COUNTRY_KEYWORDS, FONT_ATLAS_MICRO_B64, FONT_ATLAS_SMALL_B64, FONT_ATLAS_HERO_B64, FONT_ATLAS_TITLE_B64, FONT_ATLAS_CAPTION_B64, FONT_ATLAS_PLACE_B64, FLAG_ATLAS_B64, FONT_MICRO_CELL_W, FONT_MICRO_CELL_H, FONT_SMALL_CELL_W, FONT_SMALL_CELL_H, FONT_HERO_CELL_W, FONT_HERO_CELL_H, FONT_TITLE_CELL_H, FONT_TITLE_GLYPHS, FONT_CAPTION_CELL_H, FONT_CAPTION_GLYPHS, FONT_PLACE_CELL_W, FONT_PLACE_CELL_H, FLAG_CELL_H, FLAG_MAP} from "./image-assets.mjs";
import {imageMetersPerPixel, validImageShaking, imageEpicenterMmi, queryImageShaking, overlayImageIntensity} from "../seismic-image-data.mjs";
import {QUAKE_HD_FONTS} from "../quake-hd-fonts.mjs";
import {enrichBrazilEpicenter} from "../brazil-epicenter-location.mjs";
import {SUMMARY_FLAGS} from "../summary-flags.mjs";
import {SUMMARY_EDITORIAL_TYPOGRAPHY, SUMMARY_EDITORIAL_TYPOGRAPHY_HD} from "../summary-editorial-assets.mjs";
import {renderEditorialDailySummary} from "../daily-summary-renderer.mjs";
import {telegramIsBrazil} from "./brazil-boundary.mjs";
import {createRenderCache,renderIdentity} from "./render-cache.mjs";
const cachedRender=createRenderCache();


function guessCountryCode(place) {
  if (!place) return null;
  let s = String(place).toLowerCase();
  // remove prefixo de distância/direção tipo "87km SSE of "
  s = s.replace(/^\s*[\d.]+\s*km\s*(n|s|e|w|ne|nw|se|sw|nne|nnw|ene|ese|sse|ssw|wnw|wsw)?\s*of\s+/i, '');
  let best = null;
  for (const [key, code] of COUNTRY_KEYWORDS) {
    if (s.includes(key)) {
      if (!best || key.length > best[0].length) best = [key, code];
    }
  }
  return best ? best[1] : null;
}

function base64ToBytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

function buildCharMap(chars) {
    const map = {};
    for (let i = 0; i < chars.length; i++) map[chars[i]] = i;
    return map;
}
const FONT_CHARMAP_TEXT = buildCharMap(FONT_CHARS_TEXT);
const FONT_CHARMAP_HERO = buildCharMap(FONT_CHARS_HERO);

let _fontAtlasCache = null;
/** Decodifica (1x por instância do Worker) e cacheia os atlas de fonte —
 * os 3 originais (JetBrains Mono, monoespaçada, pra números/dados que
 * precisam alinhar em coluna) mais os 2 novos (Liberation Sans Bold,
 * largura proporcional de verdade, pra títulos/texto corrido — gerados
 * com um navegador de verdade renderizando a fonte, não é bitmap
 * inventado à mão). */
async function getFontAtlases() {
    if (_fontAtlasCache) return _fontAtlasCache;
    const [micro, small, hero, titleProp, captionProp, place, flags] = await Promise.all([
        decodePng(base64ToBytes(FONT_ATLAS_MICRO_B64)),
        decodePng(base64ToBytes(FONT_ATLAS_SMALL_B64)),
        decodePng(base64ToBytes(FONT_ATLAS_HERO_B64)),
        decodePng(base64ToBytes(FONT_ATLAS_TITLE_B64)),
        decodePng(base64ToBytes(FONT_ATLAS_CAPTION_B64)),
        decodePng(base64ToBytes(FONT_ATLAS_PLACE_B64)),
        decodePng(base64ToBytes(FLAG_ATLAS_B64))
    ]);
    _fontAtlasCache = {
        micro: { img: micro, cellW: FONT_MICRO_CELL_W, cellH: FONT_MICRO_CELL_H, map: FONT_CHARMAP_TEXT },
        small: { img: small, cellW: FONT_SMALL_CELL_W, cellH: FONT_SMALL_CELL_H, map: FONT_CHARMAP_TEXT },
        hero: { img: hero, cellW: FONT_HERO_CELL_W, cellH: FONT_HERO_CELL_H, map: FONT_CHARMAP_HERO },
        titleProp: { img: titleProp, cellH: FONT_TITLE_CELL_H, glyphs: FONT_TITLE_GLYPHS },
        captionProp: { img: captionProp, cellH: FONT_CAPTION_CELL_H, glyphs: FONT_CAPTION_GLYPHS },
        place: { img: place, cellW: FONT_PLACE_CELL_W, cellH: FONT_PLACE_CELL_H, map: FONT_CHARMAP_TEXT },
        flags: { img: flags, cellW: FLAG_CELL_W, cellH: FLAG_CELL_H, map: FLAG_MAP }
    };
    return _fontAtlasCache;
}

/** Cola um ícone colorido do atlas (bandeiras) usando a cor de verdade de
 * cada pixel do atlas — ao contrário de blitGlyph, que só usa o alpha
 * como máscara e pinta com uma cor só (serve pra fonte, não pra bandeira,
 * que tem várias cores). */
function blitIcon(rgba, w, h, atlasImg, sx, sy, sw, sh, dx, dy) {
    dx = Math.round(dx); dy = Math.round(dy);
    const y0 = Math.max(0, -dy), y1 = Math.min(sh, h - dy);
    const x0 = Math.max(0, -dx), x1 = Math.min(sw, w - dx);
    for (let yy = y0; yy < y1; yy++) {
        const srcRow = (sy + yy) * atlasImg.width;
        const dstRow = (dy + yy) * w;
        for (let xx = x0; xx < x1; xx++) {
            const si = (srcRow + sx + xx) * 4;
            const a = atlasImg.rgba[si + 3];
            if (a === 0) continue;
            const di = (dstRow + dx + xx) * 4;
            if (a >= 255) {
                rgba[di] = atlasImg.rgba[si]; rgba[di + 1] = atlasImg.rgba[si + 1]; rgba[di + 2] = atlasImg.rgba[si + 2]; rgba[di + 3] = 255;
            } else {
                const ia = 255 - a;
                rgba[di] = ((atlasImg.rgba[si] * a) + (rgba[di] * ia)) / 255;
                rgba[di + 1] = ((atlasImg.rgba[si + 1] * a) + (rgba[di + 1] * ia)) / 255;
                rgba[di + 2] = ((atlasImg.rgba[si + 2] * a) + (rgba[di + 2] * ia)) / 255;
                rgba[di + 3] = 255;
            }
        }
    }
}

/** Desenha a bandeira do país (se o texto do local bater com o dicionário
 * em COUNTRY_KEYWORDS). Retorna false sem desenhar nada se não achar —
 * melhor não mostrar bandeira nenhuma do que mostrar a errada (caso de
 * "South Sandwich Islands region", cordilheiras oceânicas etc). */
function drawFlag(rgba, w, h, flagsFont, code, dx, dy) {
    if (!code || !(code in flagsFont.map)) return false;
    const idx = flagsFont.map[code];
    blitIcon(rgba, w, h, flagsFont.img, idx * flagsFont.cellW, 0, flagsFont.cellW, flagsFont.cellH, dx, dy);
    return true;
}

/** Cola um glifo do atlas usando o alpha dele como máscara de cor (permite qualquer cor com 1 atlas branco só). */
function blitGlyph(rgba, w, h, atlasImg, sx, sy, sw, sh, dx, dy, r, g, b) {
    dx = Math.round(dx); dy = Math.round(dy);
    const y0 = Math.max(0, -dy), y1 = Math.min(sh, h - dy);
    const x0 = Math.max(0, -dx), x1 = Math.min(sw, w - dx);
    for (let yy = y0; yy < y1; yy++) {
        const srcRow = (sy + yy) * atlasImg.width;
        const dstRow = (dy + yy) * w;
        for (let xx = x0; xx < x1; xx++) {
            const si = (srcRow + sx + xx) * 4;
            const a = atlasImg.rgba[si + 3];
            if (a === 0) continue;
            const di = (dstRow + dx + xx) * 4;
            if (a >= 255) {
                rgba[di] = r; rgba[di + 1] = g; rgba[di + 2] = b; rgba[di + 3] = 255;
            } else {
                const ia = 255 - a;
                rgba[di] = ((r * a) + (rgba[di] * ia)) / 255;
                rgba[di + 1] = ((g * a) + (rgba[di + 1] * ia)) / 255;
                rgba[di + 2] = ((b * a) + (rgba[di + 2] * ia)) / 255;
                rgba[di + 3] = 255;
            }
        }
    }
}

/** Desenha texto usando um atlas (fonte real JetBrains Mono). Retorna a largura total desenhada. */
function drawTextFont(rgba, w, h, font, text, x, y, r, g, b) {
    let cx = x;
    for (const ch of text) {
        const idx = (ch in font.map) ? font.map[ch] : font.map['?'];
        if (idx !== undefined) {
            blitGlyph(rgba, w, h, font.img, idx * font.cellW, 0, font.cellW, font.cellH, cx, y, r, g, b);
        }
        cx += font.cellW;
    }
    return cx;
}

function textFontWidth(font, text) {
    return [...text].length * font.cellW;
}

/** Mesma ideia de drawTextFont, mas pra atlas de largura PROPORCIONAL
 * (font.glyphs = {char: [x, largura]} em vez de font.cellW fixo) — usada
 * pelos atlas Liberation Sans (titleProp/captionProp). "tracking" é o
 * respiro entre um glifo e o próximo, em px. */
function drawTextFontProp(rgba, w, h, font, text, x, y, r, g, b, tracking = 1) {
    let cx = x;
    for (const ch of text) {
        const g_ = font.glyphs[ch] || font.glyphs['?'];
        if (g_) {
            blitGlyph(rgba, w, h, font.img, g_[0], 0, g_[1], font.cellH, cx - (g_[2] != null ? (g_[3] ?? 1) : 0), y, r, g, b);
            cx += (g_[2] ?? g_[1]) + tracking;
        } else {
            cx += 6 + tracking;
        }
    }
    return cx;
}

function textFontWidthProp(font, text, tracking = 1) {
    let total = 0;
    for (const ch of text) {
        const g_ = font.glyphs[ch] || font.glyphs['?'];
        total += (g_ ? (g_[2] ?? g_[1]) : 6) + tracking;
    }
    return Math.max(0, total - tracking);
}

/** Normaliza caracteres que não existem no atlas embutido, evitando '?' na imagem. */
function sanitizeFontText(text) {
    let s = String(text ?? '')
        .replace(/[–—−]/g, '-')
        .replace(/→/g, 'para')
        .replace(/[“”«»]/g, '"')
        .replace(/[‘’‚‛]/g, "'")
        .replace(/…/g, '...')
        .replace(/#/g, 'N.')
        .replace(/@/g, 'at')
        .replace(/&/g, 'e')
        .replace(/=/g, '-')
        .replace(/_/g, '-')
        .replace(/\|/g, '/')
        .replace(/[<>\[\]{}]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    // Última barreira: qualquer glifo fora do atlas vira espaço, nunca '?'.
    // Isso cobre caracteres ocasionais enviados pelas agências, como símbolos
    // tipográficos, ordinal masculino, emojis e outros Unicode não suportados.
    return [...s].map(ch => (ch in FONT_CHARMAP_TEXT) ? ch : ' ').join('')
        .replace(/\s{2,}/g, ' ').trim();
}

/** Quebra uma string em até maxLines linhas de no máximo maxChars, respeitando espaços. Trunca com "…" se sobrar. */
function wrapText(text, maxChars, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const candidate = cur ? cur + ' ' + w : w;
        if (candidate.length <= maxChars) {
            cur = candidate;
        } else {
            if (cur) lines.push(cur);
            cur = w;
            if (lines.length >= maxLines) break;
        }
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    // se ainda sobrou conteúdo além do que coube, marca reticências na última linha
    // (usa "..." em vez de "…" pois o atlas de fonte não tem esse glifo)
    const consumed = lines.join(' ').length;
    if (consumed < String(text || '').replace(/\s+/g, ' ').trim().length && lines.length) {
        let last = lines[lines.length - 1];
        if (last.length > maxChars - 3) last = last.slice(0, Math.max(0, maxChars - 3));
        lines[lines.length - 1] = last + '...';
    } else if (lines.length > maxLines) {
        lines.length = maxLines;
    }
    // garante que cada linha caiba mesmo se uma palavra sozinha for maior que maxChars
    return lines.slice(0, maxLines).map(l => l.length > maxChars ? l.slice(0, Math.max(0, maxChars - 3)) + '...' : l);
}

function crc32Png(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
        c ^= buf[i];
        for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
}

function pngChunk(type, data) {
    const len = data.length;
    const out = new Uint8Array(8 + len + 4);
    const v = new DataView(out.buffer);
    v.setUint32(0, len);
    out[4] = type.charCodeAt(0);
    out[5] = type.charCodeAt(1);
    out[6] = type.charCodeAt(2);
    out[7] = type.charCodeAt(3);
    out.set(data, 8);
    const crcBuf = out.subarray(4, 8 + len);
    v.setUint32(8 + len, crc32Png(crcBuf));
    return out;
}

async function rgbaToPng(rgba, w, h) {
    // filtro None por linha
    const raw = new Uint8Array((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
        const row = y * (w * 4 + 1);
        raw[row] = 0;
        raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), row + 1);
    }
    let compressed;
    if (typeof CompressionStream !== 'undefined') {
        const cs = new CompressionStream('deflate');
        const stream = new Blob([raw]).stream().pipeThrough(cs);
        compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
        // fallback improvável no Worker moderno
        throw new Error('CompressionStream indisponível');
    }
    const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = new Uint8Array(13);
    const dv = new DataView(ihdr.buffer);
    dv.setUint32(0, w);
    dv.setUint32(4, h);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    const parts = [sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', new Uint8Array(0))];
    let total = 0;
    for (const p of parts) total += p.length;
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
}

function fillRect(rgba, w, x, y, rw, rh, r, g, b, a = 255) {
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(w, x0 + (rw | 0)), y1 = Math.min(rgba.length / (w * 4), y0 + (rh | 0));
    for (let yy = y0; yy < y1; yy++) {
        let i = (yy * w + x0) * 4;
        for (let xx = x0; xx < x1; xx++) {
            if (a >= 255) {
                rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
            } else if (a > 0) {
                const ia = 255 - a;
                rgba[i] = (r * a + rgba[i] * ia) / 255;
                rgba[i + 1] = (g * a + rgba[i + 1] * ia) / 255;
                rgba[i + 2] = (b * a + rgba[i + 2] * ia) / 255;
                rgba[i + 3] = 255;
            }
            i += 4;
        }
    }
}

/** Igual a fillRect, mas com cantos arredondados (raio em px) — usado nos
 * cartões do resumo diário pra tirar a "cara de planilha" dos retângulos
 * retos. Teste de distância só nos 4 quadrados de canto; o miolo do
 * retângulo é preenchido reto (rápido, sem custo extra no resto da área). */
function fillRoundRect(rgba, w, h, x, y, rw, rh, radius, r, g, b, a = 255) {
    const rad = Math.max(0, Math.min(radius, rw / 2, rh / 2));
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(w, x0 + (rw | 0)), y1 = Math.min(h, y0 + (rh | 0));
    const rr = rad * rad;
    for (let yy = y0; yy < y1; yy++) {
        const inTopBand = yy < y0 + rad, inBottomBand = yy >= y1 - rad;
        let i = (yy * w + x0) * 4;
        for (let xx = x0; xx < x1; xx++) {
            let skip = false;
            if (rad > 0 && (inTopBand || inBottomBand)) {
                const cx = xx < x0 + rad ? x0 + rad : (xx >= x1 - rad ? x1 - rad : null);
                if (cx !== null) {
                    const cy = inTopBand ? y0 + rad : y1 - rad;
                    const dx = xx - cx, dy = yy - cy;
                    if (dx * dx + dy * dy > rr) skip = true;
                }
            }
            if (!skip) {
                if (a >= 255) {
                    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
                } else if (a > 0) {
                    const ia = 255 - a;
                    rgba[i] = (r * a + rgba[i] * ia) / 255;
                    rgba[i + 1] = (g * a + rgba[i + 1] * ia) / 255;
                    rgba[i + 2] = (b * a + rgba[i + 2] * ia) / 255;
                    rgba[i + 3] = 255;
                }
            }
            i += 4;
        }
    }
}

/** Brilho radial suave (glow) — alpha cai por distância ao centro, ao
 * quadrado, pra parecer luz de verdade em vez de um círculo chapado. */
function fillRadialGlow(rgba, w, h, cx, cy, rad, r, g, b, maxAlpha = 0.35) {
    const y0 = Math.max(0, (cy - rad) | 0), y1 = Math.min(h, (cy + rad + 1) | 0);
    const x0 = Math.max(0, (cx - rad) | 0), x1 = Math.min(w, (cx + rad + 1) | 0);
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const dx = x - cx, dy = y - cy;
            const d = Math.sqrt(dx * dx + dy * dy) / rad;
            if (d >= 1) continue;
            const a = maxAlpha * (1 - d * d);
            const i = (y * w + x) * 4;
            rgba[i] = r * a + rgba[i] * (1 - a);
            rgba[i + 1] = g * a + rgba[i + 1] * (1 - a);
            rgba[i + 2] = b * a + rgba[i + 2] * (1 - a);
            rgba[i + 3] = 255;
        }
    }
}

function fillCircle(rgba, w, h, cx, cy, rad, r, g, b, a = 255) {
    const r2 = rad * rad;
    const y0 = Math.max(0, (cy - rad) | 0), y1 = Math.min(h, (cy + rad + 1) | 0);
    const x0 = Math.max(0, (cx - rad) | 0), x1 = Math.min(w, (cx + rad + 1) | 0);
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const dx = x - cx, dy = y - cy;
            if (dx * dx + dy * dy <= r2) {
                const i = (y * w + x) * 4;
                if (a >= 255) {
                    rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
                } else if (a > 0) {
                    const ia = 255 - a;
                    rgba[i] = (r * a + rgba[i] * ia) / 255;
                    rgba[i + 1] = (g * a + rgba[i + 1] * ia) / 255;
                    rgba[i + 2] = (b * a + rgba[i + 2] * ia) / 255;
                    rgba[i + 3] = 255;
                }
            }
        }
    }
}

// =========================================================
// ELEMENTOS "ESTILO STORY" (portados do gerador do site,
// função buildStoryCanvas/drawGauge/etc do index.html) —
// versão em pixels puros pro Worker, sem <canvas> do navegador.
// =========================================================

/** Arco tipo velocímetro (mesma lógica de drawGauge do site): trilho cinza
 * + porção colorida proporcional a `frac`. closeFull=true = anel 360°
 * fechado (usado em eventos sem magnitude numérica). */
function drawArc(rgba, w, h, cx, cy, r, thickness, startDeg, sweepDeg, cr, cg, cb, a = 255) {
    const rOuter = r + thickness / 2, rInner = r - thickness / 2;
    const y0 = Math.max(0, Math.floor(cy - rOuter - 1)), y1 = Math.min(h, Math.ceil(cy + rOuter + 1));
    const x0 = Math.max(0, Math.floor(cx - rOuter - 1)), x1 = Math.min(w, Math.ceil(cx + rOuter + 1));
    const start = ((startDeg % 360) + 360) % 360;
    const sweep = Math.max(0, Math.min(360, sweepDeg));
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const dx = x - cx, dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < rInner || dist > rOuter) continue;
            // ângulo em graus, sentido horário, 0° = direita (como no Canvas 2D)
            let ang = Math.atan2(dy, dx) * 180 / Math.PI;
            ang = ((ang % 360) + 360) % 360;
            let rel = ang - start;
            rel = ((rel % 360) + 360) % 360;
            if (rel <= sweep) {
                const i = (y * w + x) * 4;
                if (a >= 255) {
                    rgba[i] = cr; rgba[i + 1] = cg; rgba[i + 2] = cb; rgba[i + 3] = 255;
                } else if (a > 0) {
                    const ia = 255 - a;
                    rgba[i] = (cr * a + rgba[i] * ia) / 255;
                    rgba[i + 1] = (cg * a + rgba[i + 1] * ia) / 255;
                    rgba[i + 2] = (cb * a + rgba[i + 2] * ia) / 255;
                    rgba[i + 3] = 255;
                }
            }
        }
    }
    // "tampas" arredondadas nas pontas do arco colorido (se não for anel fechado)
    if (sweep < 360 && sweep > 0) {
        const capR = thickness / 2;
        const rad1 = start * Math.PI / 180;
        const rad2 = (start + sweep) * Math.PI / 180;
        fillCircle(rgba, w, h, cx + r * Math.cos(rad1), cy + r * Math.sin(rad1), capR, cr, cg, cb, a);
        fillCircle(rgba, w, h, cx + r * Math.cos(rad2), cy + r * Math.sin(rad2), capR, cr, cg, cb, a);
    }
}

/** Preenche um triângulo (usado pras pontas de seta dos ícones do mecanismo focal). */
function fillTriangle(rgba, w, h, x0, y0, x1, y1, x2, y2, cr, cg, cb, a = 255) {
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
    const denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
    if (denom === 0) return;
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const a1 = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / denom;
            const a2 = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / denom;
            const a3 = 1 - a1 - a2;
            if (a1 >= -0.001 && a2 >= -0.001 && a3 >= -0.001) {
                const i = (y * w + x) * 4;
                if (a >= 255) {
                    rgba[i] = cr; rgba[i + 1] = cg; rgba[i + 2] = cb; rgba[i + 3] = 255;
                } else if (a > 0) {
                    const ia = 255 - a;
                    rgba[i] = (cr * a + rgba[i] * ia) / 255;
                    rgba[i + 1] = (cg * a + rgba[i + 1] * ia) / 255;
                    rgba[i + 2] = (cb * a + rgba[i + 2] * ia) / 255;
                    rgba[i + 3] = 255;
                }
            }
        }
    }
}

/** Ícones vetoriais simples pro mecanismo focal (sem depender de emoji, que a
 * fonte monoespaçada não tem em cores): seta pra cima/baixo, dupla seta
 * lateral, ou "?" pro caso não determinado. */
function drawMechanismIcon(rgba, w, h, cx, cy, size, kind, cr, cg, cb) {
    const shaftT = Math.round(size * 0.16);
    if (kind === 'up' || kind === 'down') {
        const half = size / 2;
        fillRect(rgba, w, cx - shaftT / 2, cy - half, shaftT, size, cr, cg, cb);
        const headW = size * 0.5, headH = size * 0.34;
        if (kind === 'up') {
            fillTriangle(rgba, w, h, cx, cy - half - headH * 0.4, cx - headW / 2, cy - half + headH * 0.5, cx + headW / 2, cy - half + headH * 0.5, cr, cg, cb);
        } else {
            fillTriangle(rgba, w, h, cx, cy + half + headH * 0.4, cx - headW / 2, cy + half - headH * 0.5, cx + headW / 2, cy + half - headH * 0.5, cr, cg, cb);
        }
    } else if (kind === 'leftright') {
        const half = size / 2;
        fillRect(rgba, w, cx - half, cy - shaftT / 2, size, shaftT, cr, cg, cb);
        const headW = size * 0.34, headH = size * 0.5;
        fillTriangle(rgba, w, h, cx - half - headW * 0.4, cy, cx - half + headW * 0.5, cy - headH / 2, cx - half + headW * 0.5, cy + headH / 2, cr, cg, cb);
        fillTriangle(rgba, w, h, cx + half + headW * 0.4, cy, cx + half - headW * 0.5, cy - headH / 2, cx + half - headW * 0.5, cy + headH / 2, cr, cg, cb);
    } else {
        // "indeterminado": círculo vazado com "?" — desenhado com o próprio atlas de fonte
        fillCircle(rgba, w, h, cx, cy, size * 0.42, cr, cg, cb, 40);
    }
}

/** Desenha texto com halo (contorno escuro fino atrás), igual à técnica
 * haloFillText do site — garante contraste mesmo em cima do mapa de satélite. */
function drawTextFontHalo(rgba, w, h, font, text, x, y, r, g, b, hr = 3, hg = 9, hb = 20) {
    const offs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [ox, oy] of offs) drawTextFont(rgba, w, h, font, text, x + ox, y + oy, hr, hg, hb);
    return drawTextFont(rgba, w, h, font, text, x, y, r, g, b);
}

function drawTextFontCenteredHalo(rgba, w, h, font, text, cx, y, r, g, b, hr = 3, hg = 9, hb = 20) {
    const tw = textFontWidth(font, text);
    return drawTextFontHalo(rgba, w, h, font, text, Math.round(cx - tw / 2), y, r, g, b, hr, hg, hb);
}

/** Halo + centralização pro atlas proporcional (Liberation Sans) — mesma
 * ideia das duas funções acima, só trocando drawTextFont/textFontWidth
 * pelas versões "Prop". */
function drawTextFontPropHalo(rgba, w, h, font, text, x, y, r, g, b, hr = 3, hg = 9, hb = 20) {
    const offs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [ox, oy] of offs) drawTextFontProp(rgba, w, h, font, text, x + ox, y + oy, hr, hg, hb);
    return drawTextFontProp(rgba, w, h, font, text, x, y, r, g, b);
}

function drawTextFontPropCenteredHalo(rgba, w, h, font, text, cx, y, r, g, b, hr = 3, hg = 9, hb = 20) {
    const tw = textFontWidthProp(font, text);
    return drawTextFontPropHalo(rgba, w, h, font, text, Math.round(cx - tw / 2), y, r, g, b, hr, hg, hb);
}

/** Escurece o canvas com um degradê vertical (lista de paradas [fração_y, alpha 0-1]),
 * igual ao gradiente do rodapé/cabeçalho do Story — deixa o mapa visível em
 * cima e o texto legível embaixo. */
function applyVerticalDarkGradient(rgba, w, h, stops, yStart = 0, yEnd = h) {
    const rangeH = Math.max(1, yEnd - yStart);
    for (let y = Math.max(0, yStart); y < Math.min(h, yEnd); y++) {
        const f = (y - yStart) / rangeH;
        let alpha = stops[0][1];
        for (let i = 0; i < stops.length - 1; i++) {
            const [f0, a0] = stops[i], [f1, a1] = stops[i + 1];
            if (f >= f0 && f <= f1) {
                const t = (f1 === f0) ? 0 : (f - f0) / (f1 - f0);
                alpha = a0 + (a1 - a0) * t;
                break;
            }
            if (f > f1) alpha = a1;
        }
        if (alpha <= 0) continue;
        const row = y * w * 4;
        for (let x = 0; x < w; x++) {
            const i = row + x * 4;
            rgba[i] = rgba[i] * (1 - alpha);
            rgba[i + 1] = rgba[i + 1] * (1 - alpha);
            rgba[i + 2] = rgba[i + 2] * (1 - alpha);
        }
    }
}

// ---- funções de cálculo puras, portadas 1:1 do index.html (site) ----
function getHexColorFromMag(m) {
    if (m >= 6) return [239, 68, 68];   // #ef4444
    if (m >= 5) return [251, 146, 60];  // #fb923c
    if (m >= 4) return [250, 204, 21];  // #facc15
    return [74, 222, 128];              // #4ade80
}
function classificarProfundidadeCard(km) {
    if (km < 70) return { label: 'Raso', cor: [248, 113, 113] };
    if (km < 300) return { label: 'Intermediário', cor: [251, 191, 36] };
    return { label: 'Profundo', cor: [74, 222, 128] };
}
function estimarMercalliCard(m, d) {
    const b = m - Math.max(0, d) / 50;
    if (b < 2) return { nivel: 'I - II', cor: [74, 222, 128] };
    if (b < 4) return { nivel: 'III - IV', cor: [250, 204, 21] };
    if (b < 5.5) return { nivel: 'V - VI', cor: [251, 146, 60] };
    if (b < 7) return { nivel: 'VII - VIII', cor: [239, 68, 68] };
    return { nivel: 'IX+', cor: [153, 27, 27] };
}
function calcularEnergiaCard(m) {
    const j = Math.pow(10, 1.5 * m + 4.8);
    const t = j / 4.184e9;
    const f = t < 1 ? (t * 1000).toFixed(1).replace('.', ',') + ' kg' :
        t < 1000 ? t.toFixed(1).replace('.', ',') + ' ton' :
            t < 1e6 ? (t / 1000).toFixed(1).replace('.', ',') + ' kt' :
                (t / 1e6).toFixed(1).replace('.', ',') + ' Mt';
    return f;
}
function calcularMecanismoFocalCard(depth, lat, lng, place) {
    // Location/depth alone cannot identify a focal mechanism.
    return { tipo: 'Mecanismo focal indisponivel', desc: 'Tipo de falha sem dados oficiais.', kind: 'unknown' };
}
function formatCoordCard(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'L' : 'O';
    return `${Math.abs(lat).toFixed(2).replace('.', ',')}°${latDir}, ${Math.abs(lon).toFixed(2).replace('.', ',')}°${lonDir}`;
}
function approxLocalTimeCard(timeIso, lon) {
    if (!Number.isFinite(lon) || !timeIso) return '';
    const offsetH = Math.round(lon / 15);
    const d = new Date(new Date(timeIso).getTime() + offsetH * 3600000);
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const sinal = offsetH >= 0 ? '+' : '';
    return `${hh}:${mm} local aprox. (UTC${sinal}${offsetH})`;
}
function niceScaleValueCard(x) {
    if (!Number.isFinite(x) || x <= 0) return 10;
    const exp = Math.floor(Math.log10(x));
    const base = x / Math.pow(10, exp);
    const nice = base >= 5 ? 5 : (base >= 2 ? 2 : 1);
    return nice * Math.pow(10, exp);
}
/** Barra de escala tipo "≈ 200 km" (mesma fórmula de projeção Web Mercator do site). */
function drawScaleBarCard(rgba, w, h, font, x, y, lat, zoom, frame) {
    const metrosPorPx = frame ? imageMetersPerPixel(frame, lat) : 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
    if (!Number.isFinite(metrosPorPx) || metrosPorPx <= 0) return;
    const maxBarPx = 140;
    const kmAlvo = (maxBarPx * metrosPorPx) / 1000;
    const km = niceScaleValueCard(kmAlvo);
    const barPx = Math.round((km * 1000) / metrosPorPx);
    fillRect(rgba, w, x, y - 8, 2, 8, 226, 232, 240);
    fillRect(rgba, w, x, y, barPx, 2, 226, 232, 240);
    fillRect(rgba, w, x + barPx - 2, y - 8, 2, 8, 226, 232, 240);
    drawTextFontHalo(rgba, w, h, font, `~${km >= 1 ? km : km.toFixed(1).replace('.', ',')} km`, x, y - 8 - font.cellH - 2, 226, 232, 240);
}


// =========================================================
// DECODIFICADOR PNG MÍNIMO (pra colar o mapa estático no card)
// Suporta: 8 bits/canal, não-interlaçado, colorType 0/2/3/4/6
// =========================================================
async function inflateZlib(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('DecompressionStream indisponível');
    const ds = new DecompressionStream('deflate'); // 'deflate' = zlib (RFC1950), igual ao IDAT do PNG
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

function pngPaeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

async function decodePng(bytes) {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) throw new Error('PNG inválido (assinatura)');

    let pos = 8, width = 0, height = 0, bitDepth = 8, colorType = 6, interlace = 0;
    let palette = null, trns = null;
    const idatChunks = [];

    while (pos < bytes.length) {
        const dv = new DataView(bytes.buffer, bytes.byteOffset + pos, 8);
        const len = dv.getUint32(0);
        const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
        const data = bytes.subarray(pos + 8, pos + 8 + len);
        pos += 8 + len + 4; // pula dados + CRC

        if (type === 'IHDR') {
            const hdv = new DataView(data.buffer, data.byteOffset, data.byteLength);
            width = hdv.getUint32(0);
            height = hdv.getUint32(4);
            bitDepth = data[8];
            colorType = data[9];
            interlace = data[12];
        } else if (type === 'PLTE') {
            palette = data.slice();
        } else if (type === 'tRNS') {
            trns = data.slice();
        } else if (type === 'IDAT') {
            idatChunks.push(data.slice());
        } else if (type === 'IEND') {
            break;
        }
    }

    if (bitDepth !== 8) throw new Error('PNG bitDepth não suportado: ' + bitDepth);
    if (interlace !== 0) throw new Error('PNG interlaçado não suportado');

    let total = 0;
    for (const c of idatChunks) total += c.length;
    const idat = new Uint8Array(total);
    { let o = 0; for (const c of idatChunks) { idat.set(c, o); o += c.length; } }

    const raw = await inflateZlib(idat);

    const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
    const bpp = channelsByType[colorType];
    if (!bpp) throw new Error('PNG colorType não suportado: ' + colorType);
    const stride = width * bpp;

    const unfiltered = new Uint8Array(height * stride);
    let rp = 0;
    for (let y = 0; y < height; y++) {
        const filter = raw[rp]; rp += 1;
        const rowStart = y * stride;
        const prevRowStart = (y - 1) * stride;
        for (let x = 0; x < stride; x++) {
            const rawByte = raw[rp + x];
            const a = x >= bpp ? unfiltered[rowStart + x - bpp] : 0;
            const b = y > 0 ? unfiltered[prevRowStart + x] : 0;
            const c = (y > 0 && x >= bpp) ? unfiltered[prevRowStart + x - bpp] : 0;
            let val;
            switch (filter) {
                case 0: val = rawByte; break;
                case 1: val = rawByte + a; break;
                case 2: val = rawByte + b; break;
                case 3: val = rawByte + ((a + b) >> 1); break;
                case 4: val = rawByte + pngPaeth(a, b, c); break;
                default: throw new Error('PNG filtro desconhecido: ' + filter);
            }
            unfiltered[rowStart + x] = val & 0xff;
        }
        rp += stride;
    }

    const rgba = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const si = y * stride + x * bpp;
            const di = (y * width + x) * 4;
            let r = 0, g = 0, b = 0, a = 255;
            if (colorType === 2) { r = unfiltered[si]; g = unfiltered[si + 1]; b = unfiltered[si + 2]; }
            else if (colorType === 6) { r = unfiltered[si]; g = unfiltered[si + 1]; b = unfiltered[si + 2]; a = unfiltered[si + 3]; }
            else if (colorType === 0) { r = g = b = unfiltered[si]; }
            else if (colorType === 4) { r = g = b = unfiltered[si]; a = unfiltered[si + 1]; }
            else if (colorType === 3) {
                const idx = unfiltered[si];
                r = palette ? palette[idx * 3] : 0;
                g = palette ? palette[idx * 3 + 1] : 0;
                b = palette ? palette[idx * 3 + 2] : 0;
                a = (trns && idx < trns.length) ? trns[idx] : 255;
            }
            rgba[di] = r; rgba[di + 1] = g; rgba[di + 2] = b; rgba[di + 3] = a;
        }
    }
    return { width, height, rgba };
}

/** Cola `img` (de decodePng) dentro do retângulo dx,dy,dw,dh, cobrindo tudo (crop central, tipo CSS background-size:cover). */
function drawImageCover(rgba, w, h, img, dx, dy, dw, dh) {
    const sw = img.width, sh = img.height;
    const scale = Math.max(dw / sw, dh / sh);
    const cw = sw * scale, ch = sh * scale;
    const ox = dx - (cw - dw) / 2;
    const oy = dy - (ch - dh) / 2;
    const x0 = Math.max(0, dx | 0), y0 = Math.max(0, dy | 0);
    const x1 = Math.min(w, (dx + dw) | 0), y1 = Math.min(h, (dy + dh) | 0);
    for (let y = y0; y < y1; y++) {
        const sy = Math.min(sh - 1, Math.max(0, Math.floor((y - oy) / scale)));
        for (let x = x0; x < x1; x++) {
            const sx = Math.min(sw - 1, Math.max(0, Math.floor((x - ox) / scale)));
            const si = (sy * sw + sx) * 4;
            const di = (y * w + x) * 4;
            const a = img.rgba[si + 3];
            if (a >= 255) {
                rgba[di] = img.rgba[si]; rgba[di + 1] = img.rgba[si + 1]; rgba[di + 2] = img.rgba[si + 2]; rgba[di + 3] = 255;
            } else if (a > 0) {
                const ia = 255 - a;
                rgba[di] = ((img.rgba[si] * a) + (rgba[di] * ia)) / 255;
                rgba[di + 1] = ((img.rgba[si + 1] * a) + (rgba[di + 1] * ia)) / 255;
                rgba[di + 2] = ((img.rgba[si + 2] * a) + (rgba[di + 2] * ia)) / 255;
                rgba[di + 3] = 255;
            }
        }
    }
}

async function fetchBinaryWithTimeout(url, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const r = await fetch(url, {
            signal: controller.signal,
            headers: { 'User-Agent': 'MonitorGlobal/7.3 (+https://monitorglobal.top)' }
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const buf = new Uint8Array(await r.arrayBuffer());
        if (buf.length < 100) throw new Error('resposta vazia/curta demais');
        return buf;
    } finally {
        clearTimeout(timer);
    }
}

/** Tenta cada URL de staticMapUrls em ordem até uma decodificar com sucesso. Retorna null se todas falharem. */
async function fetchEpicenterMap(lat, lon, zoom = 6, imgW = 800, imgH = 440, anchorY = imgH / 2, bounds = null, cartographic = false) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
    const urls = staticMapUrls(lat, lon, zoom, imgW, imgH, anchorY, bounds, cartographic);
    for (const url of urls) {
        try {
            const bytes = await fetchBinaryWithTimeout(url, 6000);
            const img = await decodePng(bytes);
            if (img.width > 10 && img.height > 10) return img;
        } catch (e) {
            console.warn('mapa estático falhou:', url, e.message);
        }
    }
    return null;
}

let quakeHdFonts;
async function getQuakeHdFonts(){
 if(!quakeHdFonts){quakeHdFonts=Promise.all(Object.entries(QUAKE_HD_FONTS).map(async([key,data])=>[key,{...data,img:await decodePng(base64ToBytes(data.b64))}])).then(entries=>Object.fromEntries(entries));}
 return quakeHdFonts;
}
async function renderAlertImage(ev) {
    await enrichBrazilEpicenter(ev);
    if(!validImageShaking(ev.shaking)){const data=await queryImageShaking(ev);ev.shaking=validImageShaking(data)?data:null;}
    const key=await renderIdentity('alert-v12-cartographic-context',ev);
    return key?cachedRender(key,60000,()=>renderAlertPixels(ev)):renderAlertPixels(ev);
}
async function renderAlertPixels(ev) {
    const W=1080,H=1920,sx=W/800,sy=H/1440,rgba=new Uint8Array(W*H*4),fonts=await getQuakeHdFonts();
    const logicalFrame=globalThis.QuakeCardLayout.frame(ev);
    const frame={...logicalFrame,width:W,height:Math.round(logicalFrame.height*sy),anchorX:logicalFrame.anchorX*sx,anchorY:logicalFrame.anchorY*sy};
    fillRect(rgba,W,0,0,W,H,9,33,48);
    const cf=contextFrame(ev);
    const [mapImg,contextImg,places]=await Promise.all([
      fetchEpicenterMap(ev.lat,ev.lon,frame.zoom,W,frame.height,frame.anchorY,[frame.minLon,frame.minLat,frame.maxLon,frame.maxLat],true),
      fetchEpicenterMap(ev.lat,ev.lon,3,cf.width,cf.height,cf.height/2,[cf.minLon,cf.minLat,cf.maxLon,cf.maxLat],true),referencePlaces(ev)
    ]);
    if(mapImg){
        drawImageCover(rgba,W,H,mapImg,0,0,W,frame.height);
        fillRect(rgba,W,0,0,W,frame.height,255,255,255,10);
        await overlayImageIntensity(rgba,frame,ev);
        // Labels and administrative boundaries stay above the intensity colors.
        try{
            const bbox=[frame.minLon,frame.minLat,frame.maxLon,frame.maxLat].join(',');
            const url='https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/export?bbox='+encodeURIComponent(bbox)+'&bboxSR=4326&imageSR=4326&size='+W+','+frame.height+'&dpi=144&format=png32&transparent=true&f=image';
            const labels=await decodePng(await fetchBinaryWithTimeout(url,4000));
            drawImageCover(rgba,W,H,labels,0,0,W,frame.height);
        }catch(e){console.warn('map labels unavailable:',e.message);}
    }
    const rgb=color=>color.match(/[a-f0-9]{2}/gi).map(v=>parseInt(v,16));
    const fontFor=(size,bold)=>fonts[(size*sy>50?96:size*sy>24?40:20)+(bold?'-bold':'-regular')];
    const textWidth=(text,size,bold)=>{const font=fontFor(size,bold);return textFontWidthProp(font,sanitizeFontText(text),0)*size/font.size;};
    const nativeRect=(x,y,w,h,c)=>fillRect(rgba,W,Math.round(x*sx),Math.round(y*sy),Math.round(w*sx),Math.round(h*sy),...rgb(c));
    const painter={
        gradient:(x,y,w,h,from,to)=>{const a=rgb(from),b=rgb(to),rows=Math.round(h*sy);for(let row=0;row<rows;row++)fillRect(rgba,W,Math.round(x*sx),Math.round(y*sy)+row,Math.round(w*sx),1,...a.map((v,i)=>Math.round(v+(b[i]-v)*row/rows)));},
        roundRect:(x,y,w,h,c)=>{x*=sx;y*=sy;w*=sx;h*=sy;const r=8*sy,color=rgb(c);fillRect(rgba,W,Math.round(x+r),Math.round(y),Math.round(w-2*r),Math.round(h),...color);fillRect(rgba,W,Math.round(x),Math.round(y+r),Math.round(w),Math.round(h-2*r),...color);for(const xx of [x+r,x+w-r])for(const yy of [y+r,y+h-r])fillCircle(rgba,W,H,xx,yy,r,...color,255);},
        rect:nativeRect,
        dot:(x,y,r,c)=>fillCircle(rgba,W,H,x*sx,y*sy,r*sy,...rgb(c),255),
        arc:(x,y,r,t,a,s,c)=>drawArc(rgba,W,H,x*sx,y*sy,r*sy,t*sy,a,s,...rgb(c),255),
        measure:textWidth,
        text:(text,x,y,size,c,bold=false)=>{
            text=sanitizeFontText(text);const f=fontFor(size,bold),tw=Math.ceil(textFontWidthProp(f,text,0))+2;
            const pixels=new Uint8Array(tw*f.cellH*4);
            drawTextFontProp(pixels,tw,f.cellH,f,text,0,0,...rgb(c),0);
            const scaleX=size*sx/f.size,scaleY=size*sy/f.size;
            const color=rgb(c),channel=color.indexOf(Math.max(...color)),dh=Math.ceil(f.cellH*scaleY),dw=Math.ceil(tw*scaleX);
            // Bilinear alpha keeps the shared sans-serif typography smooth at any size.
            for(let yy=0;yy<dh;yy++)for(let xx=0;xx<dw;xx++){
                const dx=Math.round(x*sx)+xx,dy=Math.round(y*sy)+yy;if(dx<0||dx>=W||dy<0||dy>=H)continue;
                const sourceX=xx/scaleX,sourceY=yy/scaleY,x0=Math.floor(sourceX),y0=Math.floor(sourceY),tx=sourceX-x0,ty=sourceY-y0;
                const alpha=(ix,iy)=>ix>=0&&ix<tw&&iy>=0&&iy<f.cellH?pixels[(iy*tw+ix)*4+channel]/color[channel]:0;
                const a=alpha(x0,y0)*(1-tx)*(1-ty)+alpha(x0+1,y0)*tx*(1-ty)+alpha(x0,y0+1)*(1-tx)*ty+alpha(x0+1,y0+1)*tx*ty;
                const index=(dy*W+dx)*4;for(let k=0;k<3;k++)rgba[index+k]=Math.round(rgba[index+k]*(1-a)+color[k]*a);
            }
        }
    };
    if(contextImg){const x=660,y=92,w=292,h=188;fillRoundRect(rgba,W,H,x-5,y-36,w+10,h+42,8,245,243,233,255);drawImageCover(rgba,W,H,contextImg,x,y,w,h);
      const px=x+(Number(ev.lon)-cf.minLon)/(cf.maxLon-cf.minLon)*w,py=y+(cf.maxLat-Number(ev.lat))/(cf.maxLat-cf.minLat)*h;fillCircle(rgba,W,H,px,py,8,255,255,255,255);fillCircle(rgba,W,H,px,py,5,225,55,45,255);painter.text('CONTEXTO REGIONAL',(x+8)/sx,(y-28)/sy,14,'#172d36',true);}
    drawMapReferences(painter,frame,ev,places);
    const mmi=estimarMercalliCard(Number(ev.mag),Number(ev.depth)||0);
    globalThis.QuakeCardLayout.draw(painter,{...ev,
        color:'#'+getHexColorFromMag(Number(ev.mag)).map(v=>v.toString(16).padStart(2,'0')).join(''),
        when:ev.timeIso?new Date(ev.timeIso).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' BRT':'--',
        sourceLine:(ev.source||'USGS')+' · '+(ev.reviewed?'revisado':'automático')+' · '+formatCoordCard(ev.lat,ev.lon),
        mmi:imageEpicenterMmi(ev,mmi.nivel),energy:calcularEnergiaCard(Number(ev.mag)),exposure:ev.imageExposure
    });
    return rgbaToPng(rgba,W,H);
}


function staticMapUrls(lat, lon, zoom = 5, imgW = 800, imgH = 440, anchorY = imgH / 2, bounds = null, cartographic = false) {
    const span = 180 / Math.pow(2, Math.max(3, Math.min(10, zoom | 0)));
    const bbox = (bounds || [Number(lon)-span, Number(lat)-2*span*(imgH-anchorY)/imgW, Number(lon)+span, Number(lat)+2*span*anchorY/imgW]).join(',');
    return (cartographic?['World_Topo_Map','World_Imagery']:['World_Imagery','World_Topo_Map']).map(service =>
        `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/export?bbox=${encodeURIComponent(bbox)}&bboxSR=4326&imageSR=4326&size=${imgW},${imgH}&format=png&f=image`);
}
/** Layout de cada cartão do Top 5 é todo calculado ANTES de desenhar —
 * a fonte é monoespaçada (largura por caractere é exata, sem precisar
 * medir texto), então dá pra saber a altura real de cada cartão sem
 * chute. Isso elimina de vez o tipo de bug que havia antes (o número de
 * ranking desenhado numa posição fixa à direita, que colidia com a
 * segunda linha do nome do local quando ele quebrava — ex.: "2." em
 * cima de "Tonga"). Aqui o ranking vira um selo à esquerda, ANTES do
 * texto, então não tem como colidir; e o horário/profundidade vai
 * sempre abaixo do bloco de texto já quebrado, na altura calculada. */
// Espaço reservado pra bandeira antes do nome do local — fixo pra todo
// cartão (mesmo quando não acha o país), pra manter o texto sempre
// começando na mesma coluna nos 5 cartões.
const FLAG_GUTTER = FLAG_CELL_W + 12;

/** Pino de localização desenhado à mão (círculo + gota), sem depender de
 * nenhum atlas de ícone — "buraco" no meio usa a cor de fundo do painel. */
function drawPinIcon(rgba, w, h, cx, cy, r, cr, cg, cb, bg) {
    fillCircle(rgba, w, h, cx, cy - r * 0.2, r, cr, cg, cb, 255);
    fillTriangle(rgba, w, h, cx - r * 0.75, cy + r * 0.15, cx + r * 0.75, cy + r * 0.15, cx, cy + r * 1.7, cr, cg, cb, 255);
    fillCircle(rgba, w, h, cx, cy - r * 0.2, Math.max(1, r * 0.4), bg[0], bg[1], bg[2], 255);
}

/** Relógio desenhado à mão (anel + ponteiros), usado só no cabeçalho. */
function drawClockIcon(rgba, w, h, cx, cy, r, cr, cg, cb, bg) {
    fillCircle(rgba, w, h, cx, cy, r, cr, cg, cb, 220);
    fillCircle(rgba, w, h, cx, cy, Math.max(1, r - 2), bg[0], bg[1], bg[2], 255);
    fillRect(rgba, w, cx - 1, cy - r + 3, 2, r - 3, cr, cg, cb, 255);
    fillRect(rgba, w, cx, cy - 1, Math.round(r * 0.6), 2, cr, cg, cb, 255);
}

/** Avião de papel (ícone clássico do Telegram), só com 2 triângulos. */
function drawPaperPlaneIcon(rgba, w, h, x, y, size, cr, cg, cb, bg) {
    fillTriangle(rgba, w, h, x, y - size * 0.5, x, y + size * 0.5, x + size, y, cr, cg, cb, 255);
    fillTriangle(rgba, w, h, x + size * 0.1, y, x + size * 0.45, y + size * 0.18, x + size * 0.22, y + size * 0.5, bg[0], bg[1], bg[2], 255);
}

/** Ícone de radar — mesmo desenho do logo do app/site (drawRadarLogo,
 * js/story-share.js): 3 anéis concêntricos + cunha de varredura saindo do
 * topo + ponto central. Aqui em primitivas de pixel puro (sem gradiente
 * real — o motor do Worker não tem canvas/gradiente de verdade — a cunha
 * usa alpha fixo em vez de esmaecer, mas o desenho geral é o mesmo). Usado
 * no cabeçalho do Resumo do Dia, que até então só tinha o texto "MONITOR
 * GLOBAL" sem nenhum ícone — inconsistente com o card de evento avulso e
 * com o próprio app, que sempre mostram esse radar junto da marca. */
function drawRadarIcon(rgba, w, h, cx, cy, r, cr, cg, cb) {
    [1, 0.68, 0.36].forEach(f => {
        drawArc(rgba, w, h, cx, cy, r * f, Math.max(1, r * 0.1), 0, 360, cr, cg, cb, 90);
    });
    const steps = 16, startDeg = -90, sweepDeg = 78;
    for (let i = 0; i < steps; i++) {
        const a0 = (startDeg + sweepDeg * i / steps) * Math.PI / 180;
        const a1 = (startDeg + sweepDeg * (i + 1) / steps) * Math.PI / 180;
        fillTriangle(rgba, w, h, cx, cy,
            cx + r * Math.cos(a0), cy + r * Math.sin(a0),
            cx + r * Math.cos(a1), cy + r * Math.sin(a1),
            cr, cg, cb, 130);
    }
    fillCircle(rgba, w, h, cx, cy, Math.max(1, r * 0.14), cr, cg, cb, 255);
}

/** Layout de linha "lado a lado": magnitude à esquerda (centralizada na
 * altura da linha), local+meta à direita começando no topo — em vez do
 * empilhado (magnitude em cima, local embaixo) usado antes. Deixa a linha
 * bem mais baixa/compacta, igual à referência. */
function layoutRow(fonts, item, cardW) {
    const padTop = 18, padBottom = 18, padLeft = 26;
    const magX = padLeft;
    const placeX = 300;
    const countryCode = guessCountryCode(item.place);
    const placeMaxChars = Math.floor((cardW - placeX - FLAG_GUTTER - 26) / fonts.place.cellW);
    const lines = wrapText(sanitizeFontText(item.place), Math.max(10, placeMaxChars), 3);
    const magRowH = fonts.hero.cellH;
    const placeBlockH = lines.length * (fonts.place.cellH + 4);
    const metaH = fonts.micro.cellH * 2 + 6;
    const rightColH = placeBlockH + 8 + metaH;
    const cardH = Math.max(padTop + magRowH + padBottom, padTop + rightColH + padBottom);
    const magY = padTop + Math.round(((cardH - padTop - padBottom) - magRowH) / 2);
    const placeBlockY = padTop;
    const metaY = placeBlockY + placeBlockH + 8;
    return { padTop, padBottom, padLeft, magX, placeX, countryCode, lines, magRowH, magY, placeBlockY, metaY, cardH };
}

// Quebra pela largura real da fonte proporcional, preservando o local completo.
function summaryWrap(font, text, maxWidth) {
    const lines=[]; let line='';
    for(const word of sanitizeFontText(text).split(/\s+/)) {
        const candidate=line ? line+' '+word : word;
        if(line && textFontWidthProp(font,candidate)>maxWidth) { lines.push(line); line=word; }
        else line=candidate;
        while(textFontWidthProp(font,line)>maxWidth) {
            let n=1;
            while(n<line.length && textFontWidthProp(font,line.slice(0,n+1))<=maxWidth) n++;
            lines.push(line.slice(0,n)); line=line.slice(n);
        }
    }
    if(line) lines.push(line);
    return lines.length?lines:['Região não informada'];
}
function summaryPlace(place) {
    const match=/^(\d+(?:\.\d+)?)\s*km\s+([NSEW]{1,3})\s+of\s+(.+)$/i.exec(place);
    const directions={N:'ao norte',S:'ao sul',E:'a leste',W:'a oeste',NE:'a nordeste',NW:'a noroeste',SE:'a sudeste',SW:'a sudoeste',NNE:'a norte-nordeste',ENE:'a leste-nordeste',ESE:'a leste-sudeste',SSE:'a sul-sudeste',SSW:'a sul-sudoeste',WSW:'a oeste-sudoeste',WNW:'a oeste-noroeste',NNW:'a norte-noroeste'};
    let title=match?match[3]:place;
    title=title.replace(/New Caledonia/g,'Nova Caledônia').replace(/Canada/g,'Canadá').replace(/north of Svalbard/i,'Norte de Svalbard');
    title=globalThis.EventPortuguese.place(title);
    return {title,detail:match?`${match[1]} km ${directions[match[2].toUpperCase()]||match[2]}`:''};
}
let _dailySummaryFonts=null;
async function getDailySummaryFonts(){
    if(_dailySummaryFonts)return _dailySummaryFonts;
    const fonts={};
    for(const [name,data] of Object.entries(SUMMARY_EDITORIAL_TYPOGRAPHY)) fonts[name]={img:await decodePng(base64ToBytes(data.b64)),cellH:data.cellH,glyphs:data.glyphs};
    for(const [name,data] of Object.entries(SUMMARY_EDITORIAL_TYPOGRAPHY_HD))fonts[name].hd={img:await decodePng(base64ToBytes(data.b64)),cellH:data.cellH,glyphs:data.glyphs};
    fonts.aq=await decodePng(base64ToBytes('iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAMAAABiM0N1AAAARVBMVEVHcEwmX7UmX7UmX7UmX7UmX7X///9ch8iTr9omX7XJ1+3x9fo0abpBc76gud/W4fG7zeiuw+N3m9Fqkczk6/ZPfcOFpdWLa0WiAAAABnRSTlMAv+9gIM+kpfmZAAABRUlEQVR4Xu3X2W6DMBCG0aQJ/8x4Zc37P2qXVKqclM7I9k0jvms4MkZYzOl1Ozq6nKWh8+WbuQ7S2HD9ct6kubdPaZAODR/7I126nM59oPNJOvX/IB4zkB23QmnFvTGKzLEamvFTBqZaKOGhWyXk8Zh3ickAbaGA8HtOh1xxTcROBqjYhWXHyTqUiv2c6h8tesBt5bt/zuvQ/eYURSQwdlt0SO63O+fwR6MBmmDIGaBthR4bIBE2QMECSYaad6MOhQxDqw4RLKVeEOlQhKVZhSjDklOh4GHK8GgjDHkdEmHosQWKti3SIVmhxTYoQYsUyPqVTGKDJEwt51FJETMT0Tx5wPua8+iZpJBsZ7ZeAY03qYZ8+caqIS4+jqBAxgWtm7SvyMMtbT+jkYiZ4kKyW7cf9m4jRK+hptuY1Wvw6zWKvmxHR++lCXjpbjMoUQAAAABJRU5ErkJggg=='));
    fonts.flags={img:await decodePng(base64ToBytes(SUMMARY_FLAGS.b64)),map:SUMMARY_FLAGS.map};
    // Clip each flag to a softly rounded rectangle while preserving its colors.
    for(const [sx,width,height] of Object.values(fonts.flags.map)){
        const radius=Math.min(5,width/2,height/2),img=fonts.flags.img;
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){
            const cx=Math.max(radius,Math.min(width-radius,x+.5));
            const cy=Math.max(radius,Math.min(height-radius,y+.5));
            const coverage=Math.max(0,Math.min(1,radius+.5-Math.hypot(x+.5-cx,y+.5-cy)));
            const index=(y*img.width+sx+x)*4+3;
            img.rgba[index]=Math.round(img.rgba[index]*coverage);
        }
    }
    _dailySummaryFonts=fonts;return fonts;
}
function summaryCountry(place){
    let code=/balleny|antarctic/i.test(place)?'AQ':guessCountryCode(place);
    if(!code&&/,\s*(AK|CA|HI|NV|WA|OR|ID|UT|AZ|MT|WY|CO|NM|TX|OK|KS)\s*$/.test(place))code='US';
    let label='REGIÃO OCEÂNICA / NÃO IDENTIFICADA';
    if(code){try{label=new Intl.DisplayNames(['pt-BR'],{type:'region'}).of(code).toUpperCase();}catch(_){label=code;}}
    if(code==='AQ')label='ANTÁRTIDA';
    return {code,label};
}
function summaryCleanText(value,font){
    return [...String(value??'').replace(/[–—]/g,ch=>font.glyphs[ch]?ch:'-')].map(ch=>font.glyphs[ch]?ch:ch.normalize('NFD').replace(/[\u0300-\u036f]/g,'')).join('');
}
function summaryCardWrap(font,text,width){
    const lines=[];let line='';
    for(const word of summaryCleanText(text,font).split(/\s+/)){
        const candidate=line?line+' '+word:word;
        if(line&&textFontWidthProp(font,candidate,0)>width){lines.push(line);line=word;}else line=candidate;
        while(textFontWidthProp(font,line,0)>width){let n=1;while(n<line.length&&textFontWidthProp(font,line.slice(0,n+1),0)<=width)n++;lines.push(line.slice(0,n));line=line.slice(n);}
    }
    if(line)lines.push(line);return lines;
}
async function renderDailySummaryImage(quakes) {
    const key=await renderIdentity('daily-v11',quakes);
    return key?cachedRender(key,300000,()=>renderDailySummaryPixels(quakes)):renderDailySummaryPixels(quakes);
}
async function renderDailySummaryPixels(quakes) {
    const data=quakes,fonts=await getDailySummaryFonts();
    return renderEditorialDailySummary(data,fonts,{
        fillRect,fillRoundRect,fillCircle,fillRadialGlow,drawArc,drawRadar:drawRadarIcon,
        drawText:drawTextFontProp,textWidth:textFontWidthProp,clean:summaryCleanText,wrap:summaryCardWrap,
        country:summaryCountry,place:summaryPlace,png:rgbaToPng,magColor:getHexColorFromMag,isBrazil:telegramIsBrazil
    },{scale:2});
}
export { getDailySummaryFonts, summaryCardWrap, summaryCountry, summaryPlace, decodePng, textFontWidthProp, getHexColorFromMag, renderAlertImage, renderDailySummaryImage };
