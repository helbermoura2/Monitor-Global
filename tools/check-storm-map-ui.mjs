// Storm Tracker UI replay: actual historical NetCDF bytes and original timestamps.
// The fixture is not a current weather report. No production service is modified.
import {chromium,expect} from '@playwright/test';
import {readFile,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {track,observedFeatures} from '../android-mobile/app/src/main/assets/phone-storm-tracker.mjs';
const base=resolve('android-mobile/app/src/main/assets'),bundle=process.argv[2];
const origin='https://appassets.androidplatform.net',prefix='/assets/v66/';
const root='/tmp/argos-storm-sequences',manifest=JSON.parse(await readFile(root+'/manifest.json','utf8'));
let sample,expected;
for(let i=0;i<manifest.length&&!sample;i++){
 const {meta,frames}=JSON.parse(await readFile(root+'/'+i+'.json','utf8'));
 for(let j=0;j<2;j++){
  const result=track(frames[j],frames[j+1],meta.now);
  const geo=observedFeatures(result);
  if(geo.features.some(f=>f.geometry.type==='LineString')){
   sample={...meta,frames:meta.frames.slice(j,j+2),bounds:meta.frames[j+1].bounds};expected=geo;break;
  }
 }
}
if(!sample)throw Error('No observed moving core in real sequence; UI validation pending');
const now=sample.now,actual=new Map();
for(const f of sample.frames)actual.set(f.href,await readFile(f.file));
const catalog={type:'FeatureCollection',features:sample.frames.map(f=>({type:'Feature',id:f.id,collection:'br-weather-radar-cappi-1',bbox:f.bounds,properties:{radar:sample.radar,owner:sample.owner,datetime:new Date(f.time).toISOString()},assets:{cappi3km:{href:f.href,type:'application/octet-stream'}}})),links:[]};
function png(rain,w=256){
 const raw=Buffer.alloc(w*(1+4*w));for(let y=0;y<w;y++)for(let x=0;x<w;x++){const i=y*(1+4*w)+1+4*x,d=Math.hypot(x-120,y-125),c=rain?(d<32?[255,68,0]:d<55?[255,220,0]:d<95?[40,190,60]:[0,0,0]):[21+(x>>4)%2*8,53+(y>>4)%2*8,66];raw.set(c,i);raw[i+3]=rain?(d<32?255:d<95?185:0):255;}
 function crc(b){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
 function chunk(n,b){const t=Buffer.from(n),l=Buffer.alloc(4),c=Buffer.alloc(4);l.writeUInt32BE(b.length);c.writeUInt32BE(crc(Buffer.concat([t,b])));return Buffer.concat([l,t,b,c]);}
 const h=Buffer.alloc(13);h.writeUInt32BE(w);h.writeUInt32BE(w,4);h[8]=8;h[9]=6;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}

const blank=png(false);
const dirs=[base,resolve('js'),resolve('css'),resolve('vendor'),resolve('data'),resolve('assets/weather')];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:760},deviceScaleFactor:1});
 let catalogCalls=0,downloads=0;const errors=[],diagnostics=[];
 page.on('pageerror',e=>{errors.push(e.message);console.log('pageerror:',e.message);});
 page.on('console',m=>{if(['error','warning'].includes(m.type()))diagnostics.push(m.text().slice(0,300));});
 page.on('requestfailed',r=>diagnostics.push(r.url().slice(0,200)+' '+r.failure()?.errorText));
 await page.addInitScript(now=>{window.__testNow=now;Date.now=()=>window.__testNow;let lib;Object.defineProperty(window,'maplibregl',{configurable:true,get:()=>lib,set:value=>{lib=value;const Original=value.Map;value.Map=class extends Original{constructor(o){super(o);window.__map=this;}};}});},now);
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url()),cors={'Access-Control-Allow-Origin':'*'};
  if(u.origin===origin&&u.pathname==='/favicon.ico')return route.fulfill({status:204});
  if(u.origin===origin&&u.pathname.startsWith(prefix)){
   const name=u.pathname.slice(prefix.length);
   if(name==='vendor/cappi/inpe-cappi-worker.mjs')return route.fulfill({contentType:'text/javascript',path:bundle});
   if(name.includes('..'))return route.abort();
   for(const dir of dirs){
    const path=resolve(dir,name.startsWith('vendor/')||name.startsWith('data/')?name.split('/').slice(1).join('/'):name);
    try{if((await stat(path)).isFile())return route.fulfill({path, ...(/\.(m?js)$/.test(name)?{contentType:'text/javascript'}:name.endsWith('.css')?{contentType:'text/css'}:{})});}catch{}
   }
   diagnostics.push('Missing fixture asset: '+name);return route.fulfill({status:404,body:'unavailable fixture asset'});
  }
  if(u.hostname==='data.inpe.br'&&u.pathname==='/bdc/stac/v1/search'){catalogCalls++;return route.fulfill({headers:cors,json:catalog});}
  if(actual.has(u.href)){downloads++;return route.fulfill({headers:cors,contentType:'application/octet-stream',body:actual.get(u.href)});}
  if(u.hostname==='server.arcgisonline.com'||u.hostname==='tilecache.rainviewer.com')return route.fulfill({headers:cors,contentType:'image/png',body:blank});
  if(u.hostname==='api.rainviewer.com')return route.fulfill({headers:cors,json:{version:'2.0',host:'https://tilecache.rainviewer.com',radar:{past:[]}}});
  if(u.hostname==='api.open-meteo.com'){
   const day=new Date(now-3*3600000).toISOString().slice(0,10),start=Date.parse(day+'T00:00:00Z'),hours=Array.from({length:72},(_,i)=>new Date(start+i*3600000).toISOString().slice(0,16));
   return route.fulfill({headers:cors,json:{latitude:-23.555,longitude:-46.635,timezone:'America/Sao_Paulo',hourly:{time:hours,temperature_2m:hours.map(()=>22),wind_speed_10m:hours.map(()=>9),wind_direction_10m:hours.map(()=>90),precipitation:hours.map(()=>.1),pressure_msl:hours.map(()=>1013)}}});
  }
  return route.fulfill({status:503,headers:cors,body:'offline fixture'});
 });
 await page.goto(origin+prefix+'phone-brazil.html');
 try{await page.waitForFunction(()=>window.__map?.isStyleLoaded()&&window.MonitorMap?.inpeCenter());}catch(e){console.log(JSON.stringify({errors,diagnostics:diagnostics.slice(-30),state:await page.evaluate(()=>({map:!!window.__map,style:window.__map?.isStyleLoaded(),center:window.MonitorMap?.inpeCenter?.(),headline:document.querySelector('#brazil-status')?.textContent}))}));throw e;}
 await page.evaluate(([w,s,e,n])=>window.__map.jumpTo({center:[(w+e)/2,(s+n)/2],zoom:5}),sample.bounds);
 await page.locator('#layers-toggle').click();
 await page.locator('#inpe-catalog-toggle').click();
 await page.locator('#inpe-catalog-search').click();
 const details=page.locator('#inpe-catalog-results details').first();
 await details.locator('summary').click();
 const motion=details.getByRole('button',{name:'Storm Tracker · deslocamento observado'});
 await expect(motion).toBeEnabled();
 await motion.click();
 await expect(page.locator('#inpe-map-label')).toContainText('não é previsão',{timeout:90000});
 await page.waitForFunction(()=>window.__map.getLayer('br-inpe-motion-line')&&window.__map.isSourceLoaded('br-inpe-motion'),{},{timeout:45000});
 assert.equal(downloads,2);
 const points=expected.features.filter(f=>f.geometry.type==='Point'),line=expected.features.find(f=>f.geometry.type==='LineString');
 await page.evaluate(p=>window.__map.jumpTo({center:p,zoom:8}),line.geometry.coordinates[1]);
 await page.waitForFunction(()=>window.__map.queryRenderedFeatures({layers:['br-inpe-motion-point']}).length>0);
 await page.waitForFunction(()=>window.__map.queryRenderedFeatures({layers:['br-inpe-motion-line']}).length>0);
 await expect(page.locator('.inpe-motion-marker')).toHaveCount(points.length);
 const labels=await page.locator('.inpe-motion-marker').allTextContents();
 assert.deepEqual(labels.sort(),points.map(f=>f.properties.label).sort());
 await page.locator('#inpe-map-clear').click();
 assert.equal(await page.evaluate(()=>!!window.__map.getSource('br-inpe-motion')),false);
 await expect(page.locator('.inpe-motion-marker')).toHaveCount(0);
 await expect(page.locator('#inpe-map-readout')).toBeHidden();
 await page.evaluate(()=>window.MonitorMap.openInpeCatalog());
 await motion.click();
 await expect(page.locator('#inpe-map-label')).toContainText('não é previsão',{timeout:90000});
 await page.evaluate(()=>{window.MonitorMap.pause();window.MonitorMap.resume();});
 assert.equal(await page.evaluate(()=>!!window.__map.getSource('br-inpe-motion')),false);
 await expect(page.locator('.inpe-motion-marker')).toHaveCount(0);
 await page.evaluate(()=>{window.__testNow+=91*60000;window.MonitorMap.openInpeCatalog();});
 const before=downloads;
 await motion.click();
 await expect(page.locator('#inpe-catalog-status')).toContainText('não disponíveis');
 assert.equal(downloads,before);
 assert.equal(await page.evaluate(()=>!!window.__map.getSource('br-inpe-motion')),false);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({mode:'isolated real replay',radar:sample.radar,observedPoints:points.length,labels,downloads,rendered:true,clear:true,pause:true,expiredRejected:true,forecast:false}));
}finally{await browser.close();}
