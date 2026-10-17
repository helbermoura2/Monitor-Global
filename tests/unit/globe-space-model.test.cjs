const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../../js/globe-space-model.js');
test('globe fit and perspective radius agree for mobile, desktop and latitude',()=>{
 for(const [r,lat,h]of [[177,37,900],[230,37,900],[320,-23,1080],[140,65,720]]){
  const z=M.fitZoom(r,lat,h);assert.ok(Math.abs(M.sphere(z,lat,h).radius-r)<1e-9);
 }
});
test('celestial projection rotates with camera bearing without moving astronomical directions',()=>{
 const view={...M.sphere(1,0,900),x:500,y:450,lng:0,lat:0,bearing:0},east=M.project([0,1,0],0,view),north=M.project([0,1,0],0,{...view,bearing:90});
 assert.ok(east.x>500);assert.equal(east.y,450);assert.ok(Math.abs(north.x-500)<1e-9);assert.ok(north.y<450);
});

test('decorative star rotation agrees with the Meeus sidereal-time example',()=>{
 const hours=M.siderealTime(Date.parse('1987-04-10T19:21:00Z'));
 assert.ok(Math.abs(hours-(8+34/60+57.0896/3600))<.00001);
 for(const epoch of [0,Date.parse('2026-10-17T00:00:00Z'),Date.parse('2100-01-01')])assert.ok(M.siderealTime(epoch)>=0&&M.siderealTime(epoch)<24);
});
