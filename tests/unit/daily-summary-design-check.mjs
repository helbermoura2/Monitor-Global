import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {summaryMapFrame} from '../../daily-summary-renderer.mjs';
let source=await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8');
source=source.replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));
const mod=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {renderDailySummaryPng,decodePng,summaryCountry,getDailySummaryFonts,summaryCardWrap,textFontWidthProp,fetchDailyQuakesBrt};').toString('base64'));
const fixture=JSON.parse(await readFile(new URL('../fixtures/daily-summary/2026-10-01-usgs.json',import.meta.url),'utf8'));
const events=[...fixture.events,...Array.from({length:258},(_,i)=>({...fixture.events[0],id:'extra-'+i,mag:i<11?4:2}))];
const savedFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('PNG must not fetch maps or fonts')};
const normal=await mod.renderDailySummaryPng({day:fixture.day,events});
assert.equal(normal.total,264);assert.equal(normal.top.length,5);assert.equal(normal.design,'referencia-editorial-v3');
const image=await mod.decodePng(normal.png);assert.equal(image.width,900);assert.equal(image.height,1344);assert(normal.png.length>50000);
const brightRegion=(x0,y0,x1,y1)=>{let n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*image.width+x)*4;if(image.rgba[i]>100&&image.rgba[i+1]>100&&image.rgba[i+2]>100)n++;}return n;};
assert(brightRegion(35,120,555,295)>8000,'Two-line heading must remain visible');
assert(brightRegion(690,215,750,250)>500,'Primary event flag must remain visible');
assert.equal(normal.layout.rowHeights.length,4);assert(normal.layout.rowsEnd<=normal.layout.totalsY);
assert.deepEqual(normal.epicenters.map(e=>[e.id,e.lat,e.lon]),fixture.events.slice(0,5).map(e=>[e.id,e.lat,e.lon]));
assert.deepEqual([events.filter(e=>e.mag>=6).length,events.filter(e=>e.mag>=5&&e.mag<6).length,events.filter(e=>e.mag>=4&&e.mag<5).length,events.filter(e=>e.mag<4).length],[0,6,11,247]);
if(process.env.SUMMARY_PREVIEW_PATH)await writeFile(process.env.SUMMARY_PREVIEW_PATH,normal.png);
const colors=new Set();for(let y=350;y<760;y+=7)for(let x=60;x<500;x+=7){const i=(y*image.width+x)*4;colors.add([...image.rgba.subarray(i,i+3)].join(','));}
assert(colors.has('20,43,64'));assert(colors.has('2,16,31'));assert(colors.size>15);
for(const rows of [[],[{...events[0],lat:null,lon:null,depth:null}],Array.from({length:5},(_,i)=>({...events[i],place:'A very long earthquake location with an extraordinarilylongunbrokentokenandadditionalregionalinformationwhichmustwrapsafely, Japan'}))]){
 const result=await mod.renderDailySummaryPng({day:fixture.day,events:rows});const png=await mod.decodePng(result.png);
 assert.equal(result.total,rows.length);assert.equal(png.width,900);assert(png.height>=1344&&png.height<3000);assert(result.layout.rowsEnd<=result.layout.totalsY);
 assert.equal(result.epicenters.length,rows.filter(e=>Number.isFinite(e.lat)&&Number.isFinite(e.lon)).length);
}
const fonts=await mod.getDailySummaryFonts();assert(fonts.hero.glyphs[',']);assert(fonts.title.glyphs['ñ']);assert(fonts.subtitle.glyphs['í']);assert(fonts.heading.glyphs['R'][3]>=1);
assert.equal(mod.summaryCountry('Balleny Islands region').code,'AQ');assert.equal(mod.summaryCountry('8 km ESE of Valle Vista, CA').code,'US');assert.equal(mod.summaryCountry('central Atlantic Ocean').code,null);
for(const line of mod.summaryCardWrap(fonts.title,'extraordinarilylongunbrokentokenxxxxxxxxxxxxxx',280))assert(mod.textFontWidthProp(fonts.title,line,0)<=280);
for(const code of ['JP','SB','PH'])assert(fonts.flags.map[code]);
const seam=summaryMapFrame([{lat:10,lon:179.6},{lat:10.1,lon:-179.7},{lat:null,lon:null}]);assert.equal(seam.markers.length,2);assert(Math.abs(seam.markers[0].x-seam.markers[1].x)<60);
const clustered=summaryMapFrame(Array.from({length:5},()=>({lat:0,lon:0})));assert.equal(clustered.markers.length,5);
for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)assert(Math.hypot(clustered.labels[i].x-clustered.labels[j].x,clustered.labels[i].y-clustered.labels[j].y)>24);
for(const data of [fixture.events,[{lat:85,lon:-179},{lat:-85,lon:179},{lat:0,lon:0}],Array.from({length:5},(_,i)=>({lat:(i-2)*23,lon:i*72-180}))]){
 for(const world of [false,true]){const frame=summaryMapFrame(data,575,390,{world});for(const point of frame.markers)assert(point.x>=0&&point.x<=frame.width&&point.y>=0&&point.y<=frame.height);}
}
globalThis.fetch=async()=>Response.json({features:fixture.events.map(e=>({id:e.id,properties:{mag:e.mag,place:e.place,time:e.time,net:'us'},geometry:{coordinates:[e.lon,e.lat,e.depth]}}))});
const queried=await mod.fetchDailyQuakesBrt();assert.deepEqual(queried.events.map(e=>[e.id,e.lat,e.lon]),fixture.events.map(e=>[e.id,e.lat,e.lon]));
globalThis.fetch=savedFetch;
console.log('PASS: editorial PNG, official top-five epicentres, offline geography/fonts, long/empty/missing data, close labels, dateline and USGS coordinate ingestion');
