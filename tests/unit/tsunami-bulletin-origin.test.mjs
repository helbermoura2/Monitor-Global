import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import '../../js/tsunami-bulletin-origin.js';import {parseNwsTsunamiProduct} from '../../tsunami-official-worker.mjs';
const raw=JSON.parse(readFileSync(new URL('../fixtures/tsunami/NWS-WEHW42-Kamchatka.json',import.meta.url)));
test('Hawaii hyphenated fields preserve the Kamchatka origin, rather than Hawaii coordinates',()=>{
 const [a]=parseNwsTsunamiProduct(raw);assert.deepEqual(a.coords,[157.4,51.9]);assert.equal(a.originMag,7);assert.equal(a.originTime,Date.parse('2026-10-16T03:36:00Z'));assert.match(a.place,/KAMCHATKA/);assert.equal(a.hazardNature,'bulletin');
 const patched=globalThis.TsunamiBulletinOrigin.normalize({type:'tsunami',coords:null,place:'Área do boletim oficial',description:raw.productText.replace(/\s+/g,' ')});assert.deepEqual(patched.coords,[157.4,51.9]);assert.equal(patched.originMag,7);assert.match(patched.place,/KAMCHATKA/);
});
test('regional text cannot manufacture an epicenter or overwrite warning-area coordinates',()=>{const a={type:'tsunami',coords:null,description:'No tsunami threat to Hawaii. Magnitude 7.0'};assert.equal(globalThis.TsunamiBulletinOrigin.normalize(a),a);const b={...a,coordinateRole:'warning-area',coords:[-155,20],description:raw.productText};assert.equal(globalThis.TsunamiBulletinOrigin.normalize(b),b);assert.equal(globalThis.TsunamiBulletinOrigin.parse('Coordinates - 300 NORTH 400 EAST').coords,null);});
