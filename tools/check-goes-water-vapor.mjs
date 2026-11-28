import h5wasm from 'h5wasm/node';
import {decodeGoes} from './goes-water-vapor-reader.mjs';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
for(const band of ['B08','B09','B10']){
 const reference=JSON.parse(readFileSync('/tmp/argos-goes-'+band+'.json','utf8'));
 const result=await decodeGoes(h5wasm,readFileSync('/tmp/argos-goes-'+band+'.nc'),band,reference.size);
 let valid=0,maxDelta=0;
 for(let i=0;i<reference.values.length;i++){
  assert.equal(result.rows[i],reference.rows[i],`row ${i} (expected ${reference.rows[i]}, actual ${result.rows[i]})`);assert.equal(result.columns[i],reference.columns[i],`column ${i} (expected ${reference.columns[i]}, actual ${result.columns[i]})`);
  if(reference.values[i]===null)assert(Number.isNaN(result.celsius[i]),'masked '+i);
  else{const delta=Math.abs(result.celsius[i]-reference.values[i]);assert(delta<.01,'Temperature mismatch '+i+': '+delta);assert.equal(result.quality[i],reference.quality[i]);valid++;maxDelta=Math.max(maxDelta,delta);}
 }
 assert(valid>reference.values.length*.8,'insufficient valid grid');
 console.log(JSON.stringify({band,checked:reference.values.length,valid,cropPixels:result.cropPixels,fullDiskPixels:5424*5424,maxDelta,decoder:'passed'}));
}
