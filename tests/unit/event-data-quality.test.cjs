const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const doc={addEventListener(){},documentElement:{classList:{add(){}}},getElementById(){return null},querySelectorAll(){return []}};
async function countries(){const c=vm.createContext({console,document:doc,fetch:async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync('assets/geography/countries-10m.json','utf8'))})});c.window=c;vm.runInContext(fs.readFileSync('js/country-boundaries.js','utf8'),c);await c.CountryBoundaries.ready;return c.CountryBoundaries;}
test('country flags follow coordinates across US states, borders, overseas territories and ocean',async()=>{
 const geo=await countries();const cases=[['Texas',31.5,-100,'US'],['Kansas',38.5,-98,'US'],['Montana',47,-110,'US'],['Washington',47.5,-120.5,'US'],['California',36,-120,'US'],['Canada',50,-120,'CA'],['Mexico',27,-105,'MX'],['Alaska',64,-150,'US'],['Hawaii',19.6,-155.6,'US'],['Puerto Rico',18.2,-66.4,'PR'],['Guam',13.45,144.75,'GU'],['French Guiana',4,-53,'FR'],['Brazil',-20.71,-47.66,'BR']];
 for(const [name,lat,lng,code]of cases)assert.equal(geo.lookup(lat,lng).countryCode,code,name);
 for(const [lat,lng]of [[49,-110],[0,-140],[90,0],[NaN,1],[0,181]])assert.equal(geo.lookup(lat,lng).flag,'','Uncertain border/ocean/invalid coordinates');
 const event={type:'earthquake',mag:2,coords:[-98,38.5],place:'CA, Canada, Mexico',countryCode:'MX',pais:'México',bandeira:'🇲🇽'};geo.apply(event);assert.equal(event.countryCode,'US');assert.equal(event.bandeira,'🇺🇸');event.coords=[-140,0];geo.apply(event);assert.equal(event.countryCode,null);assert.equal(event.bandeira,'');
});
test('MMI accepts only genuine intensity, keeps magnitude separate and labels estimates',()=>{
 const c=vm.createContext({document:doc,console});c.window=c;vm.runInContext(fs.readFileSync('js/seismic-cinema.js','utf8'),c);const api=c.SeismicCinema;
 for(const sourceMmi of [null,undefined,'',0,'0',NaN,-1,50]){const r=api.intensitySummary({id:'x',mag:2.1,depth:10,sourceMmi});assert.equal(r.kind,'estimated');assert.notEqual(r.nivel,'0');}
 const r=api.intensitySummary({id:'reported',mag:2.1,depth:10,sourceMmi:6});assert.equal(r.kind,'official');assert.equal(r.nivel,'VI');assert.equal(api.intensitySummary({id:'missing',mag:null,depth:null}).kind,'unavailable');
 api.recordIntensity('bad',null,'USGS');assert.equal(api.intensitySummary({id:'bad',mag:2,depth:10}).kind,'estimated');
});
test('volcano translation is idempotent and translates ended and resuspended states',()=>{
 const c=vm.createContext({document:doc,console});c.window=c;vm.runInContext(fs.readFileSync('mg-volcano-flood-pt.js','utf8'),c);
 for(const input of ['Alerta Orange','Alerta laranja','alertaa Laranja','ERUPTION ENDED','RE-SUSPENDED ASH','NO FURTHER ADVISORIES']){const once=c.traduzirTextoVulcanico(input),twice=c.traduzirTextoVulcanico(once);assert.equal(twice,once,input);assert.doesNotMatch(once,/alertaa|ENDED|RE-SUSPENDED|ORANGE/i);}
 assert.match(c.traduzirTextoVulcanico('RE-SUSPENDED ASH'),/vento/);
});
test('weather states independently expire, reject other locations and preserve zero readings',()=>{
 let time=Date.now();const c=vm.createContext({document:doc,console,weatherLoc:{lat:-23.55,lng:-46.63}});c.window=c;vm.runInContext(fs.readFileSync('js/weather-data-status.js','utf8'),c);const s=c.WeatherDataStatus;
 s.record('current','updated',{at:time,source:'current'});s.record('forecast','error');assert.equal(s.state('current').status,'updated');assert.equal(s.state('forecast').status,'error');assert.equal(s.state('current',time+91*60000).status,'stale');s.record('current','error',{loc:{lat:0,lng:0}});assert.equal(s.state('current').status,'updated');assert.equal(s.valid(null),false);assert.equal(s.valid(''),false);assert.equal(s.valid(0),true);assert.equal(s.modelTime('2026-10-15T12:00',-10800),Date.parse('2026-10-15T15:00Z'));s.record('current','updated',{at:time,sourceAt:time-91*60000});assert.equal(s.state('current').status,'stale');
});
