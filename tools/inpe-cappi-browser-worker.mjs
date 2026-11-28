import {decodeCappi} from './inpe-cappi-reader.mjs';
import {prepareGrid,renderGrid} from '../android-mobile/app/src/main/assets/inpe-radar-grid.mjs';
import h5wasm from 'h5wasm';
import {decodeGoes} from './goes-water-vapor-reader.mjs';
let busy=false;
self.onmessage=async({data})=>{
 if(busy)return;
 busy=true;
 try{
  if(data.kind==='goes-vapor'){
   const {celsius,quality,rows,columns,cropPixels,size}=await decodeGoes(h5wasm,data.bytes,data.band,data.size);
   self.postMessage({id:data.id,celsius,quality,rows,columns,cropPixels,size},[celsius.buffer,quality.buffer,rows.buffer,columns.buffer]);
   return;
  }
  const decoded=await decodeCappi(data.bytes,data.product,data.altitude);
  const grid=prepareGrid(decoded),image=renderGrid(grid);
  self.postMessage({id:data.id,lon:decoded.lon,lat:decoded.lat,values:decoded.values,bounds:image.bounds,coordinates:image.coordinates,rgba:image.rgba},[image.rgba.buffer]);
 }catch(e){self.postMessage({id:data.id,error:String(e?.message||e).slice(0,200)});}
 finally{busy=false;}
};
