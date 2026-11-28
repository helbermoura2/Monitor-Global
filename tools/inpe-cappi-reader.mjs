import {NetCDFReader} from 'netcdfjs';
import h5wasm from 'h5wasm';
const assert={ok(v,m='Invalid NetCDF data'){if(!v)throw Error(m);},equal(a,b){if(a!==b)throw Error('Unexpected NetCDF dimension');},deepEqual(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Unexpected NetCDF dimension order');}};
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

export async function decodeCappi(input,product,altitude){
 const bytes=new Uint8Array(input);
 if(bytes.byteLength<8||bytes.byteLength>32*1024*1024)throw Error('NetCDF size outside limit');
 if(!['cappi3km','cappi15l'].includes(product)||!Number.isInteger(altitude)||altitude<2000||altitude>16000||altitude%1000||product==='cappi3km'&&altitude!==3000)throw Error('Invalid CAPPI selection');
 const classicFormat=bytes[0]===67&&bytes[1]===68&&bytes[2]===70&&[1,2].includes(bytes[3]);
 const hdfFormat=[137,72,68,70,13,10,26,10].every((v,i)=>bytes[i]===v);
 if(!classicFormat&&!hdfFormat)throw Error('Unsupported NetCDF file');
 const result=await (classicFormat?classic:hdf)(bytes,product==='cappi3km'?null:altitude);
 return {...result,product,altitude};
}
