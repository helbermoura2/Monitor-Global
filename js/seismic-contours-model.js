/* Bounded MMI isolines. Never trace the edge of a grid or a coastline as MMI. */
(function(root){
 'use strict';
 const names=['','Fraca','Fraca','Fraca','Leve','Moderada','Forte','Muito forte','Severa','Violenta','Extrema','Extrema','Extrema'];
 const romans=['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
 function contours(c,land){
  const model=root.SeismicImpactModel,official=root.RuptureShakingModel,features=[];
  if(c.shaking?.status==='rupture-only')return {type:'FeatureCollection',features};
  const grid=official?.valid(c.shaking?.grid)?c.shaking.grid:null;
  const landRows=land.map(p=>{let w=Infinity,e=-Infinity,s=Infinity,n=-Infinity;for(const [x,y]of p[0]){w=Math.min(w,x);e=Math.max(e,x);s=Math.min(s,y);n=Math.max(n,y);}return {p,w,e,s,n};});
  const inRing=(x,y,r)=>{let inside=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
  const onLand=point=>{const x=((point[0]+540)%360)-180,y=point[1];return landRows.some(({p,w,e,s,n})=>x>=w&&x<=e&&y>=s&&y<=n&&inRing(x,y,p[0])&&!p.slice(1).some(r=>inRing(x,y,r)));};
  const thresholds=[0,.5,1,2.1,5,11,26,60,140,321.8,740,1702,3000];
  const destination=(radius,az)=>{const d=radius/6371,t=az*Math.PI/180,a=c.lat*Math.PI/180,b=c.lng*Math.PI/180,y=Math.asin(Math.sin(a)*Math.cos(d)+Math.cos(a)*Math.sin(d)*Math.cos(t)),x=b+Math.atan2(Math.sin(t)*Math.sin(d)*Math.cos(a),Math.cos(d)-Math.sin(a)*Math.sin(y));return [c.lng+((x*180/Math.PI-c.lng+540)%360)-180,y*180/Math.PI];};
  let nx=0,ny=0,values;
  if(grid){
    nx=Math.min(128,grid.nx);ny=Math.min(128,grid.ny);values=new Float32Array(nx*ny);values.fill(NaN);
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const v=official.sample(grid,grid.x0+x/(nx-1)*(grid.x1-grid.x0),grid.y0+y/(ny-1)*(grid.y1-grid.y0));if(v!==null)values[y*nx+x]=v;}
  }
  let total=0;
  for(let level=grid?2:1;level<=12;level++){
   const lines=[],radius=grid?0:model.extent(c.mag,c.depth,thresholds[level]);
   const add=(a,b)=>{if(total>=48000||Math.abs(a[0]-b[0])>180||!onLand([(a[0]+b[0])/2,(a[1]+b[1])/2]))return;lines.push([a,b]);total+=2;};
   if(grid){
    // Interpolate actual samples, retaining gaps. The cap bounds work even for
    // the largest supported official products; resolution never exceeds source.
    for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
     const v=[values[y*nx+x],values[y*nx+x+1],values[(y+1)*nx+x+1],values[(y+1)*nx+x]];if(v.some(n=>!Number.isFinite(n)))continue;
     const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],hits=[];
     for(let i=0;i<4;i++){const j=(i+1)%4;if((v[i]>=level)===(v[j]>=level))continue;const t=(level-v[i])/(v[j]-v[i]);hits.push([grid.x0+(corners[i][0]+t*(corners[j][0]-corners[i][0]))/(nx-1)*(grid.x1-grid.x0),grid.y0+(corners[i][1]+t*(corners[j][1]-corners[i][1]))/(ny-1)*(grid.y1-grid.y0)]);}
     if(hits.length===4&&v.reduce((a,b)=>a+b,0)/4>=level)hits.push(hits.shift());
     for(let i=0;i+1<hits.length;i+=2)add(hits[i],hits[i+1]);
    }
   }else if(radius>.001){for(let i=0;i<256;i++)add(destination(radius,i*360/256),destination(radius,(i+1)*360/256));}
   if(lines.length)features.push({type:'Feature',properties:{mmi:level,roman:romans[level],description:names[level],color:grid?official.color(level):model.color(thresholds[level]),distanceKm:radius,official:!!grid},geometry:{type:'MultiLineString',coordinates:lines}});
  }
  return {type:'FeatureCollection',features};
 }
 root.SeismicContoursModel={contours};if(typeof module!=='undefined')module.exports=root.SeismicContoursModel;
})(globalThis);
