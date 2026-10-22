const {test}=require('node:test'),assert=require('node:assert/strict');
const motion=require('../../js/quake-card-motion.js');
test('magnitude progression is continuous, bounded and settles without hiding data',()=>{
 let previous=0;for(let mag=0;mag<=5.9;mag+=.1){const p=motion.profile(mag);assert.ok(p.amplitude>=previous-1e-9);assert.ok(p.amplitude<=1.5);previous=p.amplitude;for(let t=0;t<8;t+=.05){const v=motion.sample(mag,t);assert.ok(Math.abs(v.x)<=p.amplitude);assert.ok(Math.abs(v.y)<=p.amplitude*.45);if(t>p.duration){assert.equal(Math.abs(v.x),0);assert.equal(Math.abs(v.y),0);}}}
 assert.equal(motion.profile(1).particles,0);assert.equal(motion.profile(3).particles,0);assert.ok(motion.profile(5.9).particles>0);
 assert.ok(motion.profile(9.5).amplitude<=2.8);
});
