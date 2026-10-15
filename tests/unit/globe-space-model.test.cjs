const {test}=require('node:test'),assert=require('node:assert/strict');
const A=require('../../vendor/astronomy-engine-2.1.19.min.js'),M=require('../../js/globe-space-model.js');
const rad=Math.PI/180;
function solarReference(date){ // NOAA solar-position equations; independent low-order reference.
 const T=(date/86400000+2440587.5-2451545)/36525,L=(280.46646+T*(36000.76983+.0003032*T))*rad,m=(357.52911+T*(35999.05029-.0001537*T))*rad;
 const C=(1.914602-T*(.004817+.000014*T))*Math.sin(m)+(.019993-.000101*T)*Math.sin(2*m)+.000289*Math.sin(3*m),omega=(125.04-1934.136*T)*rad;
 const lambda=L+C*rad-(.00569+.00478*Math.sin(omega))*rad,e=(23+(26+(21.448-T*(46.815+T*(.00059-.001813*T)))/60)/60+.00256*Math.cos(omega))*rad;
 return [Math.cos(lambda),Math.cos(e)*Math.sin(lambda),Math.sin(e)*Math.sin(lambda)];
}
test('Sun direction agrees with NOAA reference, including equinox and solstice',()=>{
 for(const date of ['2026-03-20T12:00:00Z','2026-06-21T12:00:00Z','2026-10-15T00:00:00Z']){
  const t=Date.parse(date),actual=M.ephemeris(A,t).bodies.find(b=>b.id==='Sun').direction,expected=solarReference(t),angle=Math.acos(Math.max(-1,Math.min(1,actual.reduce((s,x,i)=>s+x*expected[i],0))))/rad;
  assert.ok(angle<.03,`${date}: ${angle} degrees`);
 }
});
test('Moon illumination matches independently dated full and new-moon eclipses',()=>{
 const phase=date=>M.ephemeris(A,Date.parse(date)).bodies.find(b=>b.id==='Moon').phase;
 assert.ok(phase('2019-01-21T05:12:00Z')>.999);
 assert.ok(phase('2024-04-08T18:17:00Z')<.001);
});
test('all nine directions are finite; Earth-fixed rotation follows sidereal time',()=>{
 const bodies=M.ephemeris(A,Date.parse('2026-10-15T00:00:00Z')).bodies;assert.equal(bodies.length,9);
 for(const b of bodies){assert.ok(Math.abs(Math.hypot(...b.direction)-1)<1e-12);assert.ok(b.distance>0);}
 const first=M.rotate([1,0,0],0),quarter=M.rotate([1,0,0],6);assert.deepEqual(first,[1,0,0]);assert.ok(Math.abs(quarter[0])<1e-12);assert.equal(quarter[1],-1);
});
test('globe fit and perspective radius agree for mobile, desktop and latitude',()=>{
 for(const [r,lat,h]of [[177,37,900],[230,37,900],[320,-23,1080],[140,65,720]]){
  const z=M.fitZoom(r,lat,h);assert.ok(Math.abs(M.sphere(z,lat,h).radius-r)<1e-9);
 }
});
test('celestial projection rotates with camera bearing without moving astronomical directions',()=>{
 const view={...M.sphere(1,0,900),x:500,y:450,lng:0,lat:0,bearing:0},east=M.project([0,1,0],0,view),north=M.project([0,1,0],0,{...view,bearing:90});
 assert.ok(east.x>500);assert.equal(east.y,450);assert.ok(Math.abs(north.x-500)<1e-9);assert.ok(north.y<450);
});

test('02:31 BRT on 15 October: the Moon is over Australia and below the São Paulo horizon',()=>{
 const t=new Date('2026-10-15T05:31:00Z'),moon=M.ephemeris(A,+t).bodies.find(b=>b.id==='Moon'),v=M.rotate(moon.direction,A.SiderealTime(t));
 const lat=Math.asin(v[2])/rad,lng=Math.atan2(v[1],v[0])/rad;
 assert.ok(lat>-28&&lat<-27);assert.ok(lng>145&&lng<147);assert.ok(moon.phase>.19&&moon.phase<.21);
 const observer=new A.Observer(-23.55,-46.63,760),eq=A.Equator('Moon',t,observer,true,true),horizon=A.Horizon(t,observer,eq.ra,eq.dec,'normal');
 assert.ok(horizon.altitude < -37&&horizon.altitude>-39);
 // Full Moon is opposite the Sun; the crescent in this report is not.
 const sun=M.ephemeris(A,+t).bodies.find(b=>b.id==='Sun'),elongation=Math.acos(Math.max(-1,Math.min(1,moon.direction.reduce((s,x,i)=>s+x*sun.direction[i],0))))/rad;
 assert.ok(elongation<90);
});
