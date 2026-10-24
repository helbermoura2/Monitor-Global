/* Hollow, land-clipped MMI isolines shared by Telegram and image export. */
(function(){
 const model=globalThis.SeismicImpactModel;
 const imageProject=(f,lng,lat)=>[(lng-f.minLon)/(f.maxLon-f.minLon)*f.width,(f.maxLat-lat)/(f.maxLat-f.minLat)*f.height];
 const distance=(a,b,c,d)=>{const rad=Math.PI/180,x=Math.sin((c-a)*rad/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));};
function estimatedMmi(ev){
 const thresholds=[.5,1,2.1,5,11,26,60,140,321.8,740,1702,3000],pga=model.pga(Number(ev.mag),Number(ev.depth)||0,0);let i=0;while(i<thresholds.length-1&&pga>=thresholds[i+1])i++;
 return ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][i];
}
function paintImageIntensity(rgba,frame,ev,polygons,annotations=[]){
 const {width:W,height:H}=frame,rows=H,step=2,mask=new Uint8Array(W*rows);
 for(const polygon of polygons)for(const shift of [-360,0,360]){
  const rings=polygon.map(r=>r.map(([lng,lat])=>imageProject(frame,lng+shift,lat))),xs=rings[0].map(p=>p[0]),ys=rings[0].map(p=>p[1]);
  if(Math.max(...xs)<0||Math.min(...xs)>W||Math.max(...ys)<0||Math.min(...ys)>rows)continue;
  for(let y=Math.max(0,Math.floor(Math.min(...ys)/step)*step);y<Math.min(rows,Math.max(...ys));y+=step){
   const hits=[],scan=y+step/2;
   for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i];if((a[1]>scan)!==(b[1]>scan))hits.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
   }
   hits.sort((a,b)=>a-b);for(let i=0;i+1<hits.length;i+=2){const left=Math.max(0,Math.min(W,Math.ceil(hits[i]/step)*step)),right=Math.max(0,Math.min(W,Math.floor(hits[i+1]/step)*step));if(right>left)mask.fill(1,y*W+left,y*W+right);}
  }
 }
 const grid=globalThis.RuptureShakingModel?.valid(ev.shaking?.grid)?ev.shaking.grid:null;
 const scale=[.5,1,2.1,5,11,26,60,140,321.8,740,1702,3000];
 const levels=[
  [2,'II','Fraca'],[3,'III','Fraca'],[4,'IV','Leve'],[5,'V','Moderada'],
  [6,'VI','Forte'],[7,'VII','Muito forte'],[8,'VIII','Severa'],[9,'IX','Violenta'],[10,'X','Extrema']
 ];
 // Sample the physical field, then interpolate its isolines. No filled pixels,
 // coastline outlines, or fabricated closure around the edge of an official grid.
 const stride=4,nx=Math.ceil((W-1)/stride)+1,ny=Math.ceil((H-1)/stride)+1;
 const values=new Float32Array(nx*ny);values.fill(NaN);
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const px=Math.min(W-1,x*stride),py=Math.min(H-1,y*stride);
  const lng=frame.minLon+px/W*(frame.maxLon-frame.minLon),lat=frame.maxLat-py/H*(frame.maxLat-frame.minLat);
  let mmi=grid?globalThis.RuptureShakingModel.sample(grid,lng,lat):null;
  if(!grid){const pga=model.pga(Number(ev.mag),Number(ev.depth)||0,distance(Number(ev.lat),Number(ev.lon),lat,lng));let i=0;while(i<scale.length-1&&pga>=scale[i+1])i++;
   mmi=pga<scale[0]?0:i+1+(i<scale.length-1?Math.max(0,Math.min(1,Math.log(pga/scale[i])/Math.log(scale[i+1]/scale[i]))):0);}
  if(mmi!==null)values[y*nx+x]=mmi;
 }
 const strokes=[],anchors=new Map();let painted=0;
 for(const [level,roman,description] of levels){
  const rgb=(globalThis.RuptureShakingModel?.color(level)||model.color(scale[level-1])).match(/\d+/g).map(Number),hex='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
  for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
   const v=[values[y*nx+x],values[y*nx+x+1],values[(y+1)*nx+x+1],values[(y+1)*nx+x]];
   if(v.some(n=>!Number.isFinite(n)))continue;
   const corners=[[x*stride,y*stride],[Math.min(W-1,(x+1)*stride),y*stride],[Math.min(W-1,(x+1)*stride),Math.min(H-1,(y+1)*stride)],[x*stride,Math.min(H-1,(y+1)*stride)]],hits=[];
   for(let i=0;i<4;i++){const j=(i+1)%4;if((v[i]>=level)===(v[j]>=level))continue;const t=(level-v[i])/(v[j]-v[i]);hits.push([corners[i][0]+t*(corners[j][0]-corners[i][0]),corners[i][1]+t*(corners[j][1]-corners[i][1]),i]);}
   // Cell-centre choice preserves disconnected lobes in saddle cells.
   if(hits.length===4&&v.reduce((a,b)=>a+b,0)/4>=level)hits.push(hits.shift());
   for(let i=0;i+1<hits.length;i+=2){const a=hits[i],b=hits[i+1],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
    const k=Math.floor(my/step)*step*W+Math.floor(mx/step)*step;if(!mask[k])continue;
    strokes.push({a,b,rgb});painted++;
    if(my/H>.34&&my/H<.82){const score=-Math.hypot(mx-W*.64,my-(306+(level-2)*36)*H/820),old=anchors.get(level);if(!old||score>old.score)anchors.set(level,{level,roman,description,color:hex,x:mx,y:my,score});}
   }
  }
 }
 const stroke=(s,r,color)=>{const [a,b]=[s.a,s.b],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
  for(let y=Math.max(0,Math.floor(Math.min(a[1],b[1])-r));y<Math.min(H,Math.ceil(Math.max(a[1],b[1])+r));y++)for(let x=Math.max(0,Math.floor(Math.min(a[0],b[0])-r));x<Math.min(W,Math.ceil(Math.max(a[0],b[0])+r));x++){
   if(!mask[Math.floor(y/step)*step*W+Math.floor(x/step)*step])continue;
   const t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/len)):0,d=Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy),alpha=Math.max(0,Math.min(1,r-d));if(!alpha)continue;
   const k=(y*W+x)*4;for(let c=0;c<3;c++)rgba[k+c]=Math.round(rgba[k+c]*(1-alpha)+color[c]*alpha);
  }
 };
 for(const s of strokes)stroke(s,3.2,[8,23,30]);
 for(const s of strokes)stroke(s,1.9,s.rgb);
 annotations.push(...anchors.values());

 return painted;
}

 globalThis.QuakeImagePaint={paint:paintImageIntensity,estimatedMmi};
})();
