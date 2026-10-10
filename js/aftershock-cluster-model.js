/* Screen-scale grouping of an already associated sequence. No catalog mutation. */
(function(root){
 'use strict';
 const MAX_ZOOM=9,RADIUS=64;
 function build(children,lng,zoom,selectedId){
  const singles=[],groups=[],cells=new Map(),scale=512*Math.pow(2,zoom);
  const unwrap=x=>lng+((x-lng+540)%360)-180;
  const pixel=q=>{const lat=Math.max(-85,Math.min(85,q.coords[1]))*Math.PI/180;return [unwrap(q.coords[0])/360*scale,-Math.log(Math.tan(Math.PI/4+lat/2))/(2*Math.PI)*scale];};
  const key=(x,y)=>x+':'+y;
  for(const q of [...children].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
   if(q.id===selectedId||zoom>=MAX_ZOOM){singles.push(q);continue;}
   const [x,y]=pixel(q),cx=Math.floor(x/RADIUS),cy=Math.floor(y/RADIUS);let group=null,best=RADIUS*RADIUS;
   for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const candidate of cells.get(key(cx+i,cy+j))||[]){const d=(candidate.x-x)**2+(candidate.y-y)**2;if(d<=best){best=d;group=candidate;}}
   if(!group){group={x,y,members:[]};groups.push(group);const k=key(cx,cy);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(group);}
   group.members.push(q);
  }
  const clusters=[];
  for(const group of groups){
   if(group.members.length===1){singles.push(group.members[0]);continue;}
   let w=Infinity,e=-Infinity,s=Infinity,n=-Infinity,x=0,y=0;
   for(const q of group.members){const a=unwrap(q.coords[0]),b=q.coords[1];w=Math.min(w,a);e=Math.max(e,a);s=Math.min(s,b);n=Math.max(n,b);x+=a;y+=b;}
   clusters.push({id:'cluster:'+String(group.members[0].id),members:group.members,coords:[x/group.members.length,y/group.members.length],bounds:[[w,s],[e,n]],mag:Math.max(...group.members.map(q=>q.mag))});
  }
  return {singles,clusters};
 }
 const api={build,MAX_ZOOM,RADIUS};root.AftershockClusterModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
