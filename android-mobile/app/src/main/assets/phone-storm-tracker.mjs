// Storm Tracker: observed CAPPI reflectivity objects, bounded 4-connected components.
// Never infer motion across different antennas, altitude, grid or expired frames.
// Development core; predictions are not official alerts.
import {prepareGrid} from './inpe-radar-grid.mjs';
export const THRESHOLD=40,MIN_PIXELS=9,MAX_AGE=90*60000,MIN_INTERVAL=3*60000,MAX_INTERVAL=20*60000,MAX_SPEED=150,MAX_OBJECTS=80;
const rad=Math.PI/180,R=6371,finite=Number.isFinite;
export function distance(a,b){
 const dlat=(b[1]-a[1])*rad,dlon=(b[0]-a[0])*rad;
 return 2*R*Math.asin(Math.sqrt(Math.min(1,Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlon/2)**2)));
}
export function bearing(a,b){
 const p=a[1]*rad,q=b[1]*rad,d=(b[0]-a[0])*rad;
 return (Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))/rad+360)%360;
}
export function destination(p,km,heading){
 const a=p[1]*rad,l=p[0]*rad,d=km/R,h=heading*rad;
 const lat=Math.asin(Math.sin(a)*Math.cos(d)+Math.cos(a)*Math.sin(d)*Math.cos(h));
 const lon=l+Math.atan2(Math.sin(h)*Math.sin(d)*Math.cos(a),Math.cos(d)-Math.sin(a)*Math.sin(lat));
 return [((lon/rad+540)%360)-180,lat/rad];
}
export function identify(frame){
 const grid=prepareGrid(frame),{x,y,values,missing}=grid,w=x.size,h=y.size,n=w*h;
 const labels=new Int32Array(n),queue=new Int32Array(n);const objects=[];let id=0,valid=0;
 const value=i=>typeof values[i]==='number'&&finite(values[i])&&values[i]!==missing&&values[i]>=-30&&values[i]<=100?values[i]:null;
 for(let i=0;i<n;i++)if(value(i)!==null)valid++;
 for(let i=0;i<n;i++){
  if(labels[i]||value(i)===null||value(i)<THRESHOLD)continue;
  id++;let head=0,tail=1,sumX=0,sumY=0,peak=-Infinity,minX=w,maxX=0,minY=h,maxY=0,edge=false;
  queue[0]=i;labels[i]=id;
  while(head<tail){
   const p=queue[head++],row=Math.floor(p/w),col=p%w,z=value(p);
   sumX+=col;sumY+=row;peak=Math.max(peak,z);minX=Math.min(minX,col);maxX=Math.max(maxX,col);minY=Math.min(minY,row);maxY=Math.max(maxY,row);
   if(!row||!col||row===h-1||col===w-1)edge=true;
   const visit=j=>{if(value(j)===null){edge=true;return;}if(!labels[j]&&value(j)>=THRESHOLD){labels[j]=id;queue[tail++]=j;}};
   if(col>0)visit(p-1);if(col<w-1)visit(p+1);if(row>0)visit(p-w);if(row<h-1)visit(p+w);
  }
  if(tail<MIN_PIXELS)continue;
  const center=[x.first+sumX/tail*x.step,y.first+sumY/tail*y.step];
  const dx=distance(center,[center[0]+Math.abs(x.step),center[1]]),dy=distance(center,[center[0],center[1]+Math.abs(y.step)]);
  objects.push({id,center,pixels:tail,areaKm2:tail*dx*dy,peakDbz:peak,truncated:edge,radiusKm:Math.max(dx,dy)*Math.hypot(maxX-minX+1,maxY-minY+1)/2});
 }
 // If too many objects are present, suppress motion rather than discard ambiguous matches.
 return {grid,objects:objects.length>MAX_OBJECTS?[]:objects,overflow:objects.length>MAX_OBJECTS,validFraction:valid/n};
}
function compatible(a,b,now){
 if(!a||!b||typeof a.radar!=='string'||!a.radar||a.radar!==b.radar||typeof a.owner!=='string'||!a.owner||a.owner!==b.owner||a.altitude!==3000||b.altitude!==3000||a.product!==b.product||!['cappi3km','cappi15l'].includes(a.product))return false;
 const dt=b.time-a.time;
 return finite(now)&&finite(a.time)&&finite(b.time)&&dt>=MIN_INTERVAL&&dt<=MAX_INTERVAL&&b.time<=now&&now-a.time<=MAX_AGE;
}
export function track(previous,current,now=Date.now()){
 if(!compatible(previous,current,now))return {status:'incompatible',tracks:[],observed:[]};
 const a=identify(previous),b=identify(current);
 const same=['x','y'].every(k=>a.grid[k].size===b.grid[k].size&&Math.abs(a.grid[k].first-b.grid[k].first)<1e-7&&Math.abs(a.grid[k].step-b.grid[k].step)<1e-8);
 if(!same||a.overflow||b.overflow)return {status:same?'too_many_objects':'different_grid',tracks:[],observed:b.objects};
 const minutes=(current.time-previous.time)/60000,maxKm=MAX_SPEED*minutes/60;
 const candidates=new Map(),reverse=new Map();
 for(const old of a.objects)for(const next of b.objects){
  const d=distance(old.center,next.center);
  if(d>maxKm+old.radiusKm+next.radiusKm)continue;
  if(!candidates.has(old.id))candidates.set(old.id,[]);
  if(!reverse.has(next.id))reverse.set(next.id,[]);
  candidates.get(old.id).push({old,next,d});reverse.get(next.id).push(old.id);
 }
 const tracks=[];
 for(const matches of candidates.values()){
  // A unique link in both directions is conservative: merges/splits stay untracked.
  if(matches.length!==1)continue;
  const {old,next,d}=matches[0];
  const ratio=next.areaKm2/old.areaKm2;
  if(reverse.get(next.id).length!==1||old.truncated||next.truncated||d>maxKm||ratio<.5||ratio>2)continue;
  const speed=d*60/minutes,heading=d<.5?null:bearing(old.center,next.center);
  tracks.push({previous:old.center,current:next.center,peakDbz:next.peakDbz,areaKm2:next.areaKm2,speedKmh:speed,bearingDeg:heading,intervalMinutes:minutes,observedAt:current.time});
 }
 return {status:'ok',tracks,observed:b.objects,unmatched:b.objects.length-tracks.length,validFraction:b.validFraction};
}
export function extrapolate(track,horizonMinutes){
 if(!track||!Array.isArray(track.current)||track.current.length!==2||!track.current.every(finite)||!finite(track.speedKmh)||track.speedKmh<0||track.speedKmh>MAX_SPEED||!finite(track.bearingDeg)||!Number.isInteger(horizonMinutes)||horizonMinutes<5||horizonMinutes>30)return null;
 const km=track.speedKmh*horizonMinutes/60;
 return {center:destination(track.current,km,track.bearingDeg),minutes:horizonMinutes,validAt:track.observedAt+horizonMinutes*60000,method:'linear_extrapolation_unvalidated',uncertainty:'not_calibrated'};
}
