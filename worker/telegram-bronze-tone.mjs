/* Overlay source geography onto the approved Tual ocean texture. */
export function tintBronzeMap(map, width, height, card, top) {
 const land = new Uint8Array(width * height);
 for (let i = 0; i < land.length; i++) {
  const offset = i * 4;
  const r = map[offset], g = map[offset + 1], b = map[offset + 2];
  land[i] = map[offset + 3] && !(b > g + 4 && b > r + 6);
 }
 // Suppress single-pixel color noise before beveling real geographic edges.
 const classified = land.slice();
 for (let y = 1; y < height - 1; y++) {
  for (let x = 1; x < width - 1; x++) {
   const i = y * width + x;
   let votes = 0;
   for (let row = i - width; row <= i + width; row += width) {
    votes += classified[row - 1] + classified[row] + classified[row + 1];
   }
   land[i] = votes >= 5;
  }
 }
 for (let y = 1; y < height - 1; y++) {
  const cardY = top + y;
  for (let x = 16; x < width - 16; x++) {
   const i = y * width + x;
   if (!land[i]) continue;
   if (x >= 40 && x < 320 && cardY >= 338 && cardY < 474) continue;
   if (x >= 444 && x < 582 && cardY >= 932) continue;
   const mapOffset = i * 4;
   const dest = (cardY * width + x) * 4;
   const lightEdge = !land[i - 1] || !land[i - width];
   const darkEdge = !land[i + 1] || !land[i + width];
   const lum = (map[mapOffset] * 3 + map[mapOffset + 1] * 5 + map[mapOffset + 2] * 2) / 10;
   const relief = (lum - 64) * .35 + (lightEdge ? 112 : darkEdge ? -22 : 21);
   card[dest] = Math.max(0, Math.min(255, card[dest] + 35 + relief));
   card[dest + 1] = Math.max(0, Math.min(255, card[dest + 1] + 22 + relief * .77));
   card[dest + 2] = Math.max(0, Math.min(255, card[dest + 2] + 12 + relief * .50));
  }
 }
}
