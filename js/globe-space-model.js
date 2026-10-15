/* Geocentric directions from Astronomy Engine; visual distances are not to scale. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GlobeSpaceModel=api;})(typeof window==='undefined'?globalThis:window,()=>{
 const rad=Math.PI/180;
 const bodies=[['Sun','Sol','#ffd16a',17],['Moon','Lua','#d4d9df',11],['Mercury','Mercúrio','#a9a39a',4],['Venus','Vênus','#f2d5a0',7],['Mars','Marte','#dc8661',6],['Jupiter','Júpiter','#d6b28d',10],['Saturn','Saturno','#dccb9e',8],['Uranus','Urano','#9fd8df',6],['Neptune','Netuno','#6899df',6]];
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 function rotate(v,sidereal){const a=sidereal*15*rad,c=Math.cos(a),s=Math.sin(a);return [c*v[0]+s*v[1],-s*v[0]+c*v[1],v[2]];}
 function ephemeris(A,epoch){
  const time=A.MakeTime(new Date(epoch)),rotation=A.Rotation_EQJ_EQD(time);
  return {epoch,bodies:bodies.map(([id,name,color,size])=>{
   const v=A.RotateVector(rotation,A.GeoVector(id,time,true)),distance=Math.hypot(v.x,v.y,v.z),direction=[v.x/distance,v.y/distance,v.z/distance];
   const phase=id==='Moon'?A.Illumination(id,time).phase_fraction:1;
   return {id,name,color,size,direction,distance,phase};
  })};
 }
 function sphere(zoom,lat,height,fov=36.86989765){
  const d=height/(2*Math.tan(fov*rad/2)),R=512*2**zoom/(2*Math.PI*Math.max(.08,Math.cos(lat*rad)));
  return {d,R,D:d+R,radius:d*R/Math.sqrt(d*d+2*d*R)};
 }
 function fitZoom(radius,lat,height,fov=36.86989765){
  const d=height/(2*Math.tan(fov*rad/2)),a=radius*radius/d,R=a+Math.sqrt(a*a+radius*radius);
  return Math.log2(R*2*Math.PI*Math.max(.08,Math.cos(lat*rad))/512);
 }
 function project(direction,sidereal,view,shell=1.8){
  const v=rotate(direction,sidereal),lon=view.lng*rad,lat=view.lat*rad;
  const east=[-Math.sin(lon),Math.cos(lon),0],north=[-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)],normal=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];
  const depth=dot(v,normal)*view.R*shell,den=view.D-depth;
  if(den<=view.R*.05)return null;
  const x=view.d*view.R*shell*dot(v,east)/den,y=-view.d*view.R*shell*dot(v,north)/den,b=(view.bearing||0)*rad;
  return {x:view.x+x*Math.cos(b)+y*Math.sin(b),y:view.y-x*Math.sin(b)+y*Math.cos(b),depth};
 }
 return {ephemeris,sphere,fitZoom,project,rotate,bodies};
});
