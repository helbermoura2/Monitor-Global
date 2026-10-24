// Reviewed local patch to MapLibre 5.13.0: a tile with no data must stay loading
// during retry. Marking an errored raster reloading makes hasData() return true
// before it has a texture, and the raster renderer throws at texture.bind().
const fs=require('node:fs');
const path='vendor/maplibre-gl.js';
const before='t&&("loading"!==t.state&&(t.state=i),yield this._loadTile(t,e,i));';
const after='t&&("loading"!==t.state&&(t.state=t.hasData()?i:"loading"),yield this._loadTile(t,e,i));';
const source=fs.readFileSync(path,'utf8');
if(source.includes(after)){process.stdout.write('MapLibre raster retry guard already present\n');}
else{if(source.split(before).length!==2)throw Error('Unexpected MapLibre version: review patch before applying');fs.writeFileSync(path,source.replace(before,after));process.stdout.write('Applied MapLibre raster retry state guard\n');}
