import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {renderAlertImage,renderDailySummaryImage,decodePng} from '../../worker/image-rendering.mjs';
const hashes=JSON.parse(await readFile(new URL('../fixtures/worker-modules/image-parity.json',import.meta.url),'utf8'));
const fixture=JSON.parse(await readFile(new URL('../fixtures/daily-summary/2026-10-01-usgs.json',import.meta.url),'utf8'));
for(const [name,input]of [['daily',fixture],['empty',{day:fixture.day,events:[]}],['alert',{id:'parity-japan',mag:4.2,lat:35,lon:140,depth:10,timeIso:'2026-10-17T00:00:00Z',place:'Japan',source:'USGS',provider:'USGS',reviewed:true}]]){
 test('modular renderer preserves original pixels: '+name,async()=>{
  const saved=globalThis.fetch;globalThis.fetch=async()=>new Response('Offline fixture',{status:503});
  try{
   const png=name==='alert'?await renderAlertImage(structuredClone(input)):(await renderDailySummaryImage(structuredClone(input))).png;
   const image=await decodePng(png),expected=hashes[name];assert.equal(image.width,expected.width);assert.equal(image.height,expected.height);assert.equal(createHash('sha256').update(image.rgba).digest('hex'),expected.pixelsBefore);
  }finally{globalThis.fetch=saved;}
 });
}
