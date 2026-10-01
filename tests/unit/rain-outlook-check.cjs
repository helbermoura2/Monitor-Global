const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../../js/rain-outlook.js'),'utf8'),ctx);
const summarize=ctx.window.RainOutlook.summarize,now=Date.parse('2026-10-01T12:20Z'),loc={lat:-23.55,lng:-46.63};
function forecast(values){return {at:now,loc,rows:values.map((mm,i)=>({name:['ECMWF','GFS','ICON'][i],hours:mm.map((mm,j)=>({end:Date.parse('2026-10-01T13:00Z')+j*3600000,mm}))}))};}
const dry=[0,0,0,0,0,0],wet=[0,2,0,0,0,0];
let result=summarize({forecast:forecast([wet,wet,wet]),loc,now});assert.equal(result.status,'possible');assert.equal(result.arrival.minMinutes,40);assert.equal(result.arrival.maxMinutes,100);assert.equal(result.min,2);assert.equal(result.max,2);assert.equal(result.start,Date.parse('2026-10-01T13:00Z'));assert.match(result.header,/2,0mm/);assert.match(result.source,/NOAA\/GFS.*DWD\/ICON/);
result=summarize({forecast:forecast([[4,0,0,0,0,0],[4,0,0,0,0,0]]),loc,now});assert.equal(result.arrival.minMinutes,0);assert.equal(result.arrival.maxMinutes,40);assert.equal(result.max,0); // No pro-rating past-hour rain as a future accumulation.
assert.equal(summarize({forecast:forecast([wet,dry,wet]),loc,now}).status,'divergent');
assert.equal(summarize({forecast:forecast([wet,[0,0,0,4,0,0]]),loc,now}).status,'divergent');
assert.equal(summarize({forecast:forecast([dry,dry,dry]),loc,now}).status,'dry');
assert.equal(summarize({forecast:forecast([wet]),loc,now}).status,'limited');
for(const bad of [null,{...forecast([wet,wet]),at:now-21*60000},{...forecast([wet,wet]),at:now+120000},{...forecast([wet,wet]),loc:{lat:0,lng:0}},forecast([[0,null,0,0,0,0],[0,NaN,0,0,0,0]])])assert.equal(summarize({forecast:bad,loc,now}).status,'unknown');
console.log('PASS: hourly rainfall windows, preceding-hour semantics, unmodified future amounts, consensus/divergence, single model, missing/stale/wrong-location data');
