// CAPPI regular geographic grids -> Web Mercator RGBA for a MapLibre image source.
// Pixel centres come from each decoded NetCDF, never the STAC bounding box alone.
// No interpolation over missing data. No inferred precipitation rate.
const MAX=512, LIMIT=85.05112878;
const finite=Number.isFinite;
export const DBZ_PALETTE=[[-30,'#5363ae'],[-10,'#669fd4'],[0,'#72c9df'],[10,'#299d70'],[20,'#1ac64b'],[30,'#d9dd37'],[40,'#ff9b32'],[50,'#ed3333'],[60,'#b420a9'],[70,'#ffffff']];
export function dbzColor(v,missing=-99){
 if(v===missing||!finite(v)||v< -30||v>100)return [0,0,0,0];
 let hex=DBZ_PALETTE[0][1];
 for(const [threshold,c] of DBZ_PALETTE){if(v<threshold)break;hex=c;}
 return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255];
}
function axis(input,limit){
 if(!input||!Number.isInteger(input.length)||input.length<2||input.length>MAX)throw Error('Invalid CAPPI axis size');
 const a=Array.from(input);
 if(!a.every(finite))throw Error('Nonfinite CAPPI coordinates');
 const step=(a.at(-1)-a[0])/(a.length-1);
 if(!finite(step)||step===0||a.some((v,i)=>Math.abs(v-(a[0]+i*step))>Math.abs(step)*.01))throw Error('Nonregular CAPPI coordinates');
 const min=Math.min(a[0],a.at(-1))-Math.abs(step)/2,max=Math.max(a[0],a.at(-1))+Math.abs(step)/2;
 if(min< -limit||max>limit)throw Error('CAPPI grid outside supported bounds');
 return {size:a.length,first:a[0],step,min,max};
}
const mercator=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360));
const latitude=y=>(2*Math.atan(Math.exp(y))-Math.PI/2)*180/Math.PI;
const cell=(coord,a)=>Math.max(0,Math.min(a.size-1,Math.round((coord-a.first)/a.step)));
export function prepareGrid({lon,lat,values,missing=-99}){
 const x=axis(lon,180),y=axis(lat,LIMIT);
 if(!values||values.length!==x.size*y.size)throw Error('Invalid CAPPI data dimensions');
 if(!finite(missing))throw Error('Invalid missing-value marker');
 const bounds=[x.min,y.min,x.max,y.max];
 return {x,y,values,missing,bounds,coordinates:[[x.min,y.max],[x.max,y.max],[x.max,y.min],[x.min,y.min]]};
}
export function sample(grid,lon,lat){
 const {x,y,values,missing}=grid;
 if(!finite(lon)||!finite(lat)||lon<x.min||lon>x.max||lat<y.min||lat>y.max)return null;
 const v=values[cell(lat,y)*x.size+cell(lon,x)];
 return typeof v==='number'&&finite(v)&&v!==missing&&v>=-30&&v<=100?v:null;
}
export function renderGrid(grid,width=grid.x.size,height=grid.y.size){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>MAX||height>MAX)throw Error('Invalid CAPPI output size');
 const rgba=new Uint8ClampedArray(width*height*4);
 const [west,south,east,north]=grid.bounds,top=mercator(north),bottom=mercator(south);
 for(let row=0;row<height;row++){
  const lat=latitude(top-(row+.5)*(top-bottom)/height);
  for(let col=0;col<width;col++){
   const lon=west+(col+.5)*(east-west)/width;
   const v=sample(grid,lon,lat);
   if(v!==null)rgba.set(dbzColor(v,grid.missing),(row*width+col)*4);
  }
 }
 return {rgba,width,height,coordinates:grid.coordinates,bounds:grid.bounds};
}
