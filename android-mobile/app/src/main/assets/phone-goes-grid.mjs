// GOES-R geostationary fixed grid, sweep x; no spherical approximation.
// The geographic target is a north-up EPSG:3857 raster spanning Brazil.
export const BOUNDS=Object.freeze([-75,-35,-28,6]);
const rad=Math.PI/180,merc=lat=>Math.log(Math.tan(Math.PI/4+lat*rad/2));
export function project(lon,lat,p){
 const a=p.a,b=p.b,h=p.height,origin=p.origin;
 if(![a,b,h,origin,lon,lat].every(Number.isFinite)||a<=b||b<6300000||a>6400000||h<35000000||h>37000000||p.sweep!=='x'||p.lat0!==0||Math.abs(lat)>85||Math.abs(lon)>180)throw Error('Unsupported GOES projection');
 const phi=lat*rad,dl=(lon-origin)*rad,e2=1-b*b/(a*a),n=a/Math.sqrt(1-e2*Math.sin(phi)**2);
 const earthX=n*Math.cos(phi)*Math.cos(dl),earthY=n*Math.cos(phi)*Math.sin(dl),earthZ=n*(1-e2)*Math.sin(phi);
 const H=a+h,dx=H-earthX;
 if(dx*earthX-earthY**2-earthZ**2*a*a/(b*b)<=0)return null;
 return [Math.atan2(earthY,Math.hypot(dx,earthZ)),Math.atan2(earthZ,dx)];
}
export function nearest(axis,x){
 const n=axis.length,asc=axis[0]<axis[n-1];
 if(!Number.isFinite(x)||x<Math.min(axis[0],axis[n-1])||x>Math.max(axis[0],axis[n-1]))return -1;
 let lo=0,hi=n-1;
 while(hi-lo>1){const mid=(lo+hi)>>1;if((axis[mid]<x)===asc)lo=mid;else hi=mid;}
 return Math.abs(axis[lo]-x)<=Math.abs(axis[hi]-x)?lo:hi;
}
export function planGrid(x,y,p,size=300){
 if(!Number.isInteger(size)||size<32||size>1200)throw Error('Invalid raster size');
 for(const axis of [x,y]){
  if(axis.length!==5424||!Number.isFinite(axis[0]))throw Error('Unexpected GOES grid');
  const sign=Math.sign(axis[1]-axis[0]);if(!sign)throw Error('Invalid GOES coordinates');
  for(let i=1;i<axis.length;i++)if(!Number.isFinite(axis[i])||Math.sign(axis[i]-axis[i-1])!==sign)throw Error('Invalid GOES coordinates');
 }
 const [west,south,east,north]=BOUNDS,top=merc(north),bottom=merc(south);
 const columns=new Int32Array(size*size).fill(-1),rows=new Int32Array(size*size).fill(-1);
 let xmin=x.length,xmax=-1,ymin=y.length,ymax=-1;
 for(let j=0;j<size;j++){
  const lat=(2*Math.atan(Math.exp(top-(j+.5)/size*(top-bottom)))-Math.PI/2)/rad;
  for(let i=0;i<size;i++){
   const lon=west+(i+.5)/size*(east-west),v=project(lon,lat,p);if(!v)continue;
   const ix=nearest(x,v[0]),iy=nearest(y,v[1]);if(ix<0||iy<0)continue;
   const k=j*size+i;columns[k]=ix;rows[k]=iy;xmin=Math.min(xmin,ix);xmax=Math.max(xmax,ix);ymin=Math.min(ymin,iy);ymax=Math.max(ymax,iy);
  }
 }
 if(xmax<xmin||ymax<ymin||(xmax-xmin+1)*(ymax-ymin+1)>9000000)throw Error('GOES crop exceeds memory budget');
 return {columns,rows,xmin,xmax,ymin,ymax,size};
}
