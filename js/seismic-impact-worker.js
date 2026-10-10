/* Created only for an intensity footprint. Coastlines remain in this Worker. */
'use strict';
importScripts('vendor/polygon-clipping.min.js?v=0.15.7','rupture-shaking-model.js?v=20261010-rupture-focus','seismic-impact-model.js?v=20261010-rupture-focus');
let landPromise;
function land(){
 if(landPromise)return landPromise;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 landPromise=fetch('../assets/seismic/ne-50m-land.geojson?v=50m1',{cache:'force-cache',signal:controller.signal})
  .then(r=>{if(!r.ok)throw Error('Coastlines unavailable');return r.json();})
  .then(d=>d.features.flatMap(f=>f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates))
  .catch(e=>{landPromise=null;throw e;}).finally(()=>clearTimeout(timer));
 return landPromise;
}
self.onmessage=async({data:{id,context}})=>{
 try{const coast=await land(),data=SeismicImpactModel.geometry(context,coast);self.postMessage({id,data,vertices:SeismicImpactModel.vertices(data)});}
 catch(error){self.postMessage({id,error:error.message});}
};
