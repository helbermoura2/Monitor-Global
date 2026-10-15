const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const A=require('../../vendor/astronomy-engine-2.1.19.min.js');
const context={Date,window:{addEventListener(){}}};vm.runInNewContext(fs.readFileSync('js/solar-system.js','utf8'),context);const S=context.window.SolarSystem;
test('heliocentric physical scales preserve solar radius, orbital ranges and lunar distance',()=>{
 const limits={Mercury:[.30,.47],Venus:[.71,.74],Earth:[.98,1.02],Mars:[1.38,1.67],Jupiter:[4.94,5.46],Saturn:[9,10.2],Uranus:[18.2,20.2],Neptune:[29.7,30.4]};
 for(const date of ['2026-01-01','2026-06-21','2026-10-15']){const rows=S.calculate(A,Date.parse(date)),sun=rows.find(b=>b.id==='Sun'),earth=rows.find(b=>b.id==='Earth'),moon=rows.find(b=>b.id==='Moon');assert.equal(sun.distance,0);assert.equal(sun.radiusAU,695700/149597870.7);assert.ok(Math.abs(earth.z)<.001);
 for(const [id,[lo,hi]] of Object.entries(limits)){const b=rows.find(b=>b.id===id);assert.ok(b.distance>lo&&b.distance<hi,id+' orbit');assert.ok(b.radiusAU<b.distance/1000,id+' physical radius');}
 const separation=Math.hypot(moon.x-earth.x,moon.y-earth.y,moon.z-earth.z)*S.AU;assert.ok(separation>350000&&separation<410000,'Moon stays at physical geocentric distance');assert.ok(sun.radiusAU/earth.radiusAU>109&&sun.radiusAU/earth.radiusAU<110);
 }
});
test('planet positions advance with the date rather than a decorative layout',()=>{
 const first=S.calculate(A,Date.parse('2026-10-15')).find(b=>b.id==='Earth'),second=S.calculate(A,Date.parse('2026-10-16')).find(b=>b.id==='Earth');const km=Math.hypot(second.x-first.x,second.y-first.y)*S.AU;assert.ok(km>2400000&&km<2700000);
});
