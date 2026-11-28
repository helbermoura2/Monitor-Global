import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {prepareGrid,sample,renderGrid,dbzColor} from '../android-mobile/app/src/main/assets/inpe-radar-grid.mjs';
for(const filename of process.argv.slice(2)){
 const d=JSON.parse(readFileSync(filename,'utf8'));
 const g=prepareGrid(d);
 const out=renderGrid(g);
 assert.equal(out.rgba.length,500*500*4);
 assert.equal(g.coordinates[0][1],g.bounds[3]);
 assert.equal(g.coordinates[2][1],g.bounds[1]);
 let checked=0;
 for(const row of [0,100,250,499])for(const col of [0,150,250,499]){
  const v=d.values[row*500+col],expected=typeof v==='number'&&Number.isFinite(v)&&v!==-99&&v>=-30&&v<=100?v:null;
  assert.equal(sample(g,d.lon[col],d.lat[row]),expected);checked++;
 }
 let visible=0;for(let i=3;i<out.rgba.length;i+=4)if(out.rgba[i])visible++;
 assert.ok(visible<=250000);
 console.log(JSON.stringify({product:d.product,altitude:d.altitude,axisOrder:d.lat[0]<d.lat.at(-1)?'south-to-north':'north-to-south',bounds:g.bounds,coordinateChecks:checked,visiblePixels:visible,render:'500 x 500 Web Mercator RGBA'}));
}
