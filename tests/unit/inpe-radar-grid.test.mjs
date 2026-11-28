import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareGrid,sample,renderGrid,dbzColor} from '../../android-mobile/app/src/main/assets/inpe-radar-grid.mjs';
test('ascending and descending latitude produce identical north-up pixels',()=>{
 const a=prepareGrid({lon:[-47,-46],lat:[-24,-23],values:[10,20,30,40]});
 const b=prepareGrid({lon:[-47,-46],lat:[-23,-24],values:[30,40,10,20]});
 assert.deepEqual(renderGrid(a),renderGrid(b));
 assert.deepEqual(a.coordinates,[[-47.5,-22.5],[-45.5,-22.5],[-45.5,-24.5],[-47.5,-24.5]]);
 assert.deepEqual([...renderGrid(a).rgba.slice(0,4)],dbzColor(30));
 assert.equal(sample(a,-47,-24),10);
 assert.equal(sample(a,-47,-23),30);
});
test('missing data remains transparent, including nulls and sentinel',()=>{
 const a=prepareGrid({lon:[-47,-46],lat:[-24,-23],values:[null,-99,0,50]});
 const r=renderGrid(a);
 assert.equal(r.rgba[3],255);
 assert.equal(r.rgba[7],255);
 assert.equal(r.rgba[11],0);
 assert.equal(r.rgba[15],0);
 assert.equal(sample(a,-48,-24),null);
 assert.equal(sample(a,-47,-24),null);
});
test('invalid axes, mismatched grids and oversized render are rejected',()=>{
 assert.throws(()=>prepareGrid({lon:[0,1,4],lat:[0,1],values:Array(6).fill(0)}));
 assert.throws(()=>prepareGrid({lon:[0,1],lat:[86,87],values:Array(4).fill(0)}));
 assert.throws(()=>prepareGrid({lon:[0,1],lat:[0,1],values:[0]}));
 const a=prepareGrid({lon:[0,1],lat:[0,1],values:[1,2,3,4]});
 assert.throws(()=>renderGrid(a,513,500));
});
test('descending longitude is corrected without flipping precipitation',()=>{
 const a=prepareGrid({lon:[-46,-47],lat:[-23,-24],values:[40,30,20,10]});
 assert.equal(sample(a,-47,-23),30);
 assert.deepEqual([...renderGrid(a).rgba.slice(0,4)],dbzColor(30));
});
