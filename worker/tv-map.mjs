// Uses the same named-region matching and explicit authority radius as shared images.
import {bulletinModel,coastalMap} from './tsunami-bulletin.mjs';
import references from './tv-coastal-references.mjs';
export function tvCoastalMap(bulletin){
 const map=coastalMap(bulletinModel([bulletin]),references);
 if(!map.frame)return null;
 const all=map.lines, selected=all.slice().sort((a,b)=>b.points.length-a.points.length).slice(0,80);
 const total=selected.reduce((n,l)=>n+l.points.length,0),budget=360;
 const lines=selected.map(l=>{
  const count=Math.min(l.points.length,Math.max(2,Math.floor(budget*l.points.length/Math.max(1,total))));
  return {color:l.color,points:Array.from({length:count},(_,i)=>l.points[Math.round(i*(l.points.length-1)/(count-1))].map(n=>Math.round(n*1000)/1000))};
 });
 return {frame:map.frame,origin:map.origin,lines,partial:map.unmapped.length>0||all.length>selected.length,reference:true};
}
