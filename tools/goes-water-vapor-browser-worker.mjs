// Development browser gate: one decode at a time, transferable typed arrays.
import h5wasm from 'h5wasm';
import {decodeGoes} from './goes-water-vapor-reader.mjs';
let busy=false;
self.onmessage=async({data})=>{
 if(busy)return;
 busy=true;
 try{
  const {celsius,quality,rows,columns,cropPixels,size}=await decodeGoes(h5wasm,data.bytes,data.band,data.size);
  self.postMessage({id:data.id,celsius,quality,rows,columns,cropPixels,size},[celsius.buffer,quality.buffer,rows.buffer,columns.buffer]);
 }catch(e){self.postMessage({id:data.id,error:String(e?.message||e).slice(0,200)});}
 finally{busy=false;}
};
