const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(fetcher){let now=100000;class Clock extends Date{static now(){return now;}}const listeners={};const c={Date:Clock,URL,Map,Set,Float64Array,Promise,fetchWithCorsFallback:fetcher,addEventListener:(n,f)=>listeners[n]=f};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('js/weather-warning-camera.js','utf8'),c);return {api:c.WeatherWarningCamera,advance:ms=>now+=ms,listeners};}
function original(points){if(!points.length)return null;const xs=points.map(p=>(p[0]+360)%360).sort((a,b)=>a-b);let gap=-1,start=0;for(let i=0;i<xs.length;i++){const d=(i+1<xs.length?xs[i+1]:xs[0]+360)-xs[i];if(d>gap){gap=d;start=(i+1)%xs.length;}}let west=xs[start],east=west+360-gap;if(west>180){west-=360;east-=360;}return [[west,Math.min(...points.map(p=>p[1]))],[east,Math.max(...points.map(p=>p[1]))]];}
const clean=x=>JSON.parse(JSON.stringify(x));
test('compact bounds preserve exact largest-gap/dateline behaviour, including multi-zone gaps',async()=>{
 const sets=[[[0,0],[100,10],[200-360,5]],[[280-360,1],[281-360,1],[280-360,1]]];let calls=0;
 const f=setup(async()=>Response.json({geometry:{type:'Polygon',coordinates:[sets[calls++]]}}));
 const b=await f.api.resolve({affectedZones:['https://api.weather.gov/zones/county/AAA001','https://api.weather.gov/zones/county/AAA002']});
 assert.deepEqual(clean(b),original(sets.flat()));
 for(let seed=0;seed<40;seed++){const points=Array.from({length:250},(_,i)=>[((i*137.123+seed)%360)-180,Math.sin(i+seed)*85]);assert.deepEqual(clean(f.api.bounds(points)),original(points));}
});
test('large-zone cache bounds actual retained coordinate bytes and expires untouched entries',async()=>{
 let calls=0;const points=Array.from({length:50000},(_,i)=>[-120+(i%1000)*.0001,30+Math.floor(i/1000)*.001]);
 const body=JSON.stringify({geometry:{type:'Polygon',coordinates:[points]}}),f=setup(async()=>{calls++;return new Response(body);});
 for(let i=0;i<40;i++)await f.api.resolve({affectedZones:['https://api.weather.gov/zones/county/AAA'+i]});
 const stats=f.api.stats();assert(stats.coordinateBytes<=8*1024*1024);assert.equal(stats.entries,20);assert.equal(stats.inflight,0);assert.equal(calls,40);
 f.advance(86400001);assert.equal(f.api.stats().entries,0);assert.equal(f.api.stats().coordinateBytes,0);
 assert.deepEqual(clean(f.api.geometryPoints({type:'Polygon',coordinates:[Array(50001).fill([0,0])]})),[]);
});
test('page exit clears cached coordinates and late responses cannot repopulate them',async()=>{
 let release;const f=setup(()=>new Promise(r=>release=r));
 const pending=f.api.resolve({affectedZones:['https://api.weather.gov/zones/county/AAA001']});
 f.listeners.pagehide();release(Response.json({geometry:{type:'Polygon',coordinates:[[[1,1],[2,2],[1,1]]]}}));await pending;
 assert.equal(f.api.stats().entries,0);assert.equal(f.api.stats().inflight,0);
});
