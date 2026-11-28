import {planGrid} from '../android-mobile/app/src/main/assets/phone-goes-grid.mjs';
const attr=(d,k)=>{const v=d.attrs[k]?.value;return ArrayBuffer.isView(v)||Array.isArray(v)?v[0]:v;};
const number=(d,k,def)=>{const v=attr(d,k);if(v===undefined&&def!==undefined)return def;const n=Number(v);if(!Number.isFinite(n))throw Error('Invalid attribute '+k);return n;};
function unpack(d,raw){
 const scale=number(d,'scale_factor',1),offset=number(d,'add_offset',0),fill=attr(d,'_FillValue'),missing=attr(d,'missing_value');
 const unsigned=String(attr(d,'_Unsigned')).toLowerCase()==='true';
 const bits=raw.BYTES_PER_ELEMENT*8,mod=2**bits;
 const normalize=v=>unsigned&&v<0?v+mod:v;
 const vr=d.attrs.valid_range?.value,lo=vr?normalize(Number(vr[0])):-Infinity,hi=vr?normalize(Number(vr[1])):Infinity;
 return i=>{const r=raw[i],n=normalize(r);if(!Number.isFinite(n)||n===normalize(fill)||n===normalize(missing)||n<lo||n>hi)return NaN;return n*scale+offset;};
}
export async function decodeGoes(h5wasm,input,band,size=300){
 const bytes=new Uint8Array(input);
 if(!['B08','B09','B10'].includes(band)||bytes.length>32*1024*1024||![137,72,68,70,13,10,26,10].every((v,i)=>bytes[i]===v))throw Error('Invalid GOES NetCDF');
 const {FS}=await h5wasm.ready,path='/tmp/argos-goes.nc';FS.writeFile(path,bytes);
 let file;
 try{
  file=new h5wasm.File(path,'r');
  if(Number(file.get('band_id').value[0])!==Number(band.slice(1)))throw Error('Incorrect ABI band');
  const xd=file.get('x'),yd=file.get('y'),d=file.get('CMI'),q=file.get('DQF'),proj=file.get('goes_imager_projection');
  if(attr(xd,'units')!=='rad'||attr(yd,'units')!=='rad'||attr(d,'units')!=='K'||attr(proj,'grid_mapping_name')!=='geostationary')throw Error('Unsupported GOES metadata');
  if(JSON.stringify(d.shape)!=='[5424,5424]'||JSON.stringify(q.shape)!=='[5424,5424]')throw Error('Unexpected GOES shape');
  const xr=xd.value,yr=yd.value,xu=unpack(xd,xr),yu=unpack(yd,yr),x=Float64Array.from(xr,(_,i)=>xu(i)),y=Float64Array.from(yr,(_,i)=>yu(i));
  const p={a:number(proj,'semi_major_axis'),b:number(proj,'semi_minor_axis'),height:number(proj,'perspective_point_height'),origin:number(proj,'longitude_of_projection_origin'),lat0:number(proj,'latitude_of_projection_origin'),sweep:attr(proj,'sweep_angle_axis')};
  const grid=planGrid(x,y,p,size),{xmin,xmax,ymin,ymax,rows,columns}=grid,w=xmax-xmin+1,area=w*(ymax-ymin+1);
  const slice=[[ymin,ymax+1],[xmin,xmax+1]],raw=d.slice(slice),flags=q.slice(slice);
  if(raw.length!==area||flags.length!==area)throw Error('Invalid cropped GOES slice');
  const value=unpack(d,raw),readFlag=unpack(q,flags),celsius=new Float32Array(size*size).fill(NaN),quality=new Uint8Array(size*size).fill(255);
  for(let i=0;i<celsius.length;i++){
   if(rows[i]<0)continue;
   const idx=(rows[i]-ymin)*w+columns[i]-xmin,flag=readFlag(idx),temp=value(idx)-273.15;
   if((flag===0||flag===1)&&Number.isFinite(temp)&&temp>=-120&&temp<=80){celsius[i]=temp;quality[i]=flag;}
  }
  return {celsius,quality,columns,rows,cropPixels:area,size};
 }finally{if(file)file.close();FS.unlink(path);}
}
