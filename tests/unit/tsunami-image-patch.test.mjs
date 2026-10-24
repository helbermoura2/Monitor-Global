import test from 'node:test';import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
import {renderAlertImage,patchAlertTsunami,decodePng} from '../../worker/image-rendering.mjs';
test('cancellation patches only bulletin pixels, preserving the archived official map and statistics',async()=>{
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('Offline fixture',{status:503});
 try{
  const png=await renderAlertImage({id:'tsunami-qa',mag:6.9,lat:-14,lon:165,depth:10,timeIso:'2026-10-24T02:30:00Z',place:'Vanuatu — cenário de teste',test:true,imageTsunami:{state:'warning',headline:'AVISO OFICIAL DE TSUNAMI',source:'PTWC · cenário de teste',issuedAt:Date.parse('2026-10-24T02:40:00Z'),areas:'Vanuatu · consulte as regiões do boletim',version:'qa-warning'}});
  const updated=await patchAlertTsunami(png,{state:'cancelled',headline:'AVISO DE TSUNAMI ENCERRADO',source:'PTWC · cenário de teste',issuedAt:Date.parse('2026-10-24T03:00:00Z'),areas:'Vanuatu · siga as orientações locais',version:'qa-cancelled'});
  const a=await decodePng(png),b=await decodePng(updated);let changes=0;
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++)for(let c=0;c<4;c++){const i=(y*a.width+x)*4+c;if(a.rgba[i]!==b.rgba[i]){changes++;assert(y>=820&&y<977,'No pixel outside bulletin region may change');}}
  assert(changes>100);assert.equal(b.width,1080);assert.equal(b.height,1920);
  await writeFile('/tmp/tsunami-image-warning.png',png);await writeFile('/tmp/tsunami-image-cancelled.png',updated);
 }finally{globalThis.fetch=originalFetch;}
});
