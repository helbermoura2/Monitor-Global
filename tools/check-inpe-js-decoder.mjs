// Development-only decoder comparison. Pin open-source readers in the diagnostic;
// no runtime CDN, service, or new dependency in the APK before validation.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {NetCDFReader} from 'netcdfjs';
import h5wasm from 'h5wasm/node';
import {prepareGrid,renderGrid} from '../android-mobile/app/src/main/assets/inpe-radar-grid.mjs';
const flat=v=>Array.isArray(v)?v.flat(Infinity):Array.from(v);
const scalar=(v,fallback)=>{if(v===undefined||v===null)return fallback;const n=typeof v==='number'?v:v[0];return typeof n==='number'?n:fallback;};
function unpack(data,attrs){
 const fill=scalar(attrs._FillValue,NaN),missing=scalar(attrs.missing_value,NaN),scale=scalar(attrs.scale_factor,1),offset=scalar(attrs.add_offset,0);
 if(!Number.isFinite(scale)||!Number.isFinite(offset))throw Error('Invalid scaling');
 return flat(data).map(v=>{if(typeof v!=='number'||!Number.isFinite(v)||v===fill||v===missing)return null;const actual=v*scale+offset;return !Number.isFinite(actual)||actual===-99?null:actual;});
}
function classic(bytes,altitude){
 const r=new NetCDFReader(bytes);
 const variable=r.variables.find(v=>v.name==='dbz');assert.ok(variable);
 const dims=variable.dimensions.map(i=>r.dimensions[i].name);
 assert.deepEqual(dims,altitude===null?['time','lat','lon']:['time','sfc','lat','lon']);
 const lat=flat(r.getDataVariable('lat')),lon=flat(r.getDataVariable('lon'));
 assert.equal(lat.length,500);assert.equal(lon.length,500);
 const attrs=Object.fromEntries(variable.attributes.map(a=>[a.name,a.value]));
 let values=flat(r.getDataVariable('dbz'));
 if(altitude!==null){
  const levels=flat(r.getDataVariable('sfc'));const i=levels.indexOf(altitude);
  assert.equal(levels.length,15);assert.ok(i>=0);assert.equal(values.length,15*250000);
  values=values.slice(i*250000,(i+1)*250000);
 }
 assert.equal(values.length,250000);
 return {lon,lat,values:unpack(values,attrs)};
}
async function hdf(bytes,altitude){
 const {FS}=await h5wasm.ready,path='/tmp/argos-radar.nc';
 // Emscripten's root filesystem is not writable by default; /tmp is its writable scratch space.
 // Keep the data ephemeral and do not relax filesystem permissions.
 FS.writeFile(path,bytes);
 let f;
 try{
  f=new h5wasm.File(path,'r');
  const lat=flat(f.get('lat').value),lon=flat(f.get('lon').value),dbz=f.get('dbz');
  assert.equal(lat.length,500);assert.equal(lon.length,500);
  const shape=Array.from(dbz.shape);
  assert.deepEqual(shape,altitude===null?[1,500,500]:[1,15,500,500]);
  let values;
  if(altitude===null)values=dbz.slice([[0,1],[],[]]);
  else{
   const levels=flat(f.get('sfc').value),i=levels.indexOf(altitude);
   assert.equal(levels.length,15);assert.ok(i>=0);
   values=dbz.slice([[0,1],[i,i+1],[],[]]);
  }
  const attrs={};
  for(const key of ['_FillValue','missing_value','scale_factor','add_offset']){
   const a=dbz.attrs[key];if(a)attrs[key]=a.value;
  }
  assert.equal(flat(values).length,250000);
  return {lon,lat,values:unpack(values,attrs)};
 }finally{if(f)f.close();FS.unlink(path);}
}
for(const [product,altitudes] of [['cappi3km',[3000]],['cappi15l',[3000,16000]]]){
 const bytes=readFileSync('/tmp/argos-raw-'+product+'.nc');
 assert.ok(bytes.length>8&&bytes.length<=32*1024*1024);
 const isClassic=bytes.subarray(0,3).toString()==='CDF'&&[1,2].includes(bytes[3]);
 const isHdf=bytes.subarray(0,8).equals(Buffer.from([137,72,68,70,13,10,26,10]));
 assert.ok(isClassic||isHdf,'Unsupported file signature');
 for(const altitude of altitudes){
  const result=await (isClassic?classic:hdf)(bytes,product==='cappi3km'?null:altitude);
  const expected=JSON.parse(readFileSync('/tmp/argos-grid-'+product+'-'+altitude+'.json','utf8'));
  for(const axis of ['lon','lat'])for(let i=0;i<500;i++)assert.ok(Math.abs(result[axis][i]-expected[axis][i])<1e-5,'Coordinate mismatch');
  let valid=0;
  for(let i=0;i<250000;i++){
   const a=result.values[i],b=expected.values[i];
   if(b===null)assert.equal(a,null,'Missing pixel mismatch at '+i);
   else{assert.ok(a!==null&&Math.abs(a-b)<1e-4,'Pixel mismatch at '+i+': '+a+' vs '+b);valid++;}
  }
  const raster=renderGrid(prepareGrid(result));
  assert.equal(raster.rgba.length,1000000);
  console.log(JSON.stringify({product,altitude,format:isClassic?'NetCDF classic':'NetCDF4/HDF5',checkedPixels:250000,valid,render:'OK'}));
 }
}
