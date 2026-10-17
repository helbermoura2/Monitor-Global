/* Globe framing and decorative star projection. No planetary ephemerides. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.GlobeSpaceModel=api;})(typeof window==='undefined'?globalThis:window,()=>{
 const rad=Math.PI/180;
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 function rotate(v,sidereal){const a=sidereal*15*rad,c=Math.cos(a),s=Math.sin(a);return [c*v[0]+s*v[1],-s*v[0]+c*v[1],v[2]];}
 // Greenwich mean sidereal time (hours), sufficient for decorative stars.
 function siderealTime(epoch){
  const days=epoch/86400000+2440587.5-2451545,T=days/36525;
  const degrees=280.46061837+360.98564736629*days+.000387933*T*T-T*T*T/38710000;
  return ((degrees%360+360)%360)/15;
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
 return {siderealTime,sphere,fitZoom,project,rotate};
});
