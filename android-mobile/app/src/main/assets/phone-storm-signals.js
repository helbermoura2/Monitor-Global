/* RainViewer Universal Blue (scheme 2), rain colors in published dBZ order. */
(function(root){'use strict';
const COLORS=["","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","","88ddee","6cd1eb","51c5e8","36bae5","1baee2","00a3e0","009ad5","0091ca","0088bf","007fb4","0077aa","0070a3","00699c","006295","005b8e","005588","005180","004e78","004a70","004768","ffee00","ffe000","ffd200","ffc500","ffb700","ffaa00","ff9f00","ff9500","ff8b00","ff8100","ff4400","f23600","e62800","d91b00","cd0d00","c10000","a80000","8f0000","760000","5d0000","ffaaff","ff9fff","ff95ff","ff8bff","ff81ff","ff77ff","ff6cff","ff62ff","ff58ff","ff4eff","ffffff","ffffff","ffffff","ffffff","ffffff","ffffff","ffffff","ffffff","ffffff","ffffff","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00","00ff00"];
const colorIndex=new Map();
COLORS.forEach((hex,i)=>{if(hex&&!colorIndex.has(parseInt(hex,16)))colorIndex.set(parseInt(hex,16),i-32);});
function reflectivity(r,g,b,a){return a<245?null:colorIndex.get((r<<16)|(g<<8)|b)??null;}
function locate(lon,lat,z=6){
 const scale=256*2**z,rad=lat*Math.PI/180;
 return [(lon+180)/360*scale,(1-Math.asinh(Math.tan(rad))/Math.PI)/2*scale];
}
function distance(a,b){
 const rad=Math.PI/180,delta=(a[1]-b[1])*rad;
 return 12742*Math.asin(Math.sqrt(Math.min(1,Math.sin(delta/2)**2+
  Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin((a[0]-b[0])*rad/2)**2)));
}
function rate(dbz){return ((10**(dbz/10))/200)**.625;}
function peak(data,w,h,x,y){
 let matched=0,top=0;
 for(let j=Math.max(0,y-8);j<Math.min(h,y+9);j++)for(let i=Math.max(0,x-8);i<Math.min(w,x+9);i++){
  if(Math.hypot(i-x,j-y)>8)continue;
  const p=(j*w+i)*4,z=reflectivity(data[p],data[p+1],data[p+2],data[p+3]);
  if(z!==null&&z>=40){matched++;top=Math.max(z,top);}
 }
 return matched>=5?top:null;
}
async function scan(collection,template,signal){
 const bins=new Map(),verified=[];
 const candidates=collection.features.filter(f=>f.properties.count>=30)
  .sort((a,b)=>b.properties.count-a.properties.count).slice(0,24);
 for(const f of candidates){
  const [x,y]=locate(...f.geometry.coordinates),col=Math.floor(x/256),row=Math.floor(y/256);
  const key=col+'/'+row;
  if(!bins.has(key))bins.set(key,{col,row,points:[]});
  bins.get(key).points.push({f,x:Math.floor(x-col*256),y:Math.floor(y-row*256)});
 }
 const queue=[...bins.values()].slice(0,12);
 for(let i=0;i<queue.length;i+=4)await Promise.allSettled(queue.slice(i,i+4).map(async tile=>{
  if(signal.aborted)return;
  const url=template.replace('{z}','6').replace('{x}',tile.col).replace('{y}',tile.row);
  const response=await fetch(url,{signal,credentials:'omit',redirect:'error'});
  if(!response.ok||Number(response.headers.get('content-length'))>600000)return;
  const blob=await response.blob();
  if(blob.size>600000||!blob.type.startsWith('image/'))return;
  const image=await createImageBitmap(blob);
  try{
   if(image.width!==256||image.height!==256)return;
   const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
   const pixels=ctx.getImageData(0,0,256,256).data;
   for(const {f,x,y} of tile.points){
    const echo=peak(pixels,256,256,x,y);
    if(echo!==null)verified.push({...f,properties:{count:f.properties.count,echo}});
   }
  }finally{image.close();}
 }));
 const output=[];
 for(const item of verified.sort((a,b)=>b.properties.echo-a.properties.echo||b.properties.count-a.properties.count)){
  if(output.some(other=>distance(item.geometry.coordinates,other.geometry.coordinates)<35))continue;
  output.push(item);
  if(output.length>=12)break;
 }
 return {type:'FeatureCollection',features:output};
}
const legend=[15,25,35,45,50].map(dbz=>({dbz,hex:'#'+COLORS[dbz+32],rate:rate(dbz)}));
const api={reflectivity,peak,scan,legend,distance};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PhoneStormSignals=api;
})(typeof window==='undefined'?globalThis:window);
