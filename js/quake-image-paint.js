/* Bounded land-only discrete intensity bands, identical in both image renderers. */
(function(){
 const model=globalThis.SeismicImpactModel;
 const imageProject=(f,lng,lat)=>[(lng-f.minLon)/(f.maxLon-f.minLon)*f.width,(f.maxLat-lat)/(f.maxLat-f.minLat)*f.height];
 const distance=(a,b,c,d)=>{const rad=Math.PI/180,x=Math.sin((c-a)*rad/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin((d-b)*rad/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));};
function paintImageIntensity(rgba,frame,ev,polygons){
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
 let painted=0;
 for(let y=0;y<rows;y+=step)for(let x=0;x<W;x+=step){
  if(!mask[y*W+x])continue;
  const lng=frame.minLon+(x+step/2)/W*(frame.maxLon-frame.minLon),lat=frame.maxLat-(y+step/2)/H*(frame.maxLat-frame.minLat);
  const pga=model.pga(Number(ev.mag),Number(ev.depth)||0,distance(Number(ev.lat),Number(ev.lon),lat,lng));if(pga<.5)continue;
  const bands=[.5,1,2.1,5,11,26,60,140,321.8,740];let b=0;while(b+1<bands.length&&pga>=bands[b+1])b++;
  const value=Math.min(model.pga(Number(ev.mag),Number(ev.depth)||0,0),Math.sqrt(bands[b]*(bands[b+1]||bands[b])));
  const rgb=model.color(value).match(/\d+/g).map(Number);painted++;
  for(let yy=y;yy<Math.min(rows,y+step);yy++)for(let xx=x;xx<Math.min(W,x+step);xx++){const i=(yy*W+xx)*4;for(let c=0;c<3;c++)rgba[i+c]=Math.round(rgba[i+c]*.36+rgb[c]*.64);}
 }
 return painted;
}

 globalThis.QuakeImagePaint={paint:paintImageIntensity};
})();
