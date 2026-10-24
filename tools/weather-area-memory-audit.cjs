// Offline actual-browser cache stress. Pass the baseline weather-warning JS.
const {chromium}=require('playwright'),fs=require('node:fs'),crypto=require('node:crypto');
if(!process.argv[2])throw Error('Pass baseline weather-warning-camera.js');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{const results=[];
 for(const before of [true,false]){
  const page=await browser.newPage({viewport:{width:411,height:806}});await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(()=>CountryBoundaries.ready);
  await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);stopMapCamera();window.__areaCalls=0;fetchWithCorsFallback=async()=>{const offset=__areaCalls++*.1;return Response.json({geometry:{type:'Polygon',coordinates:[Array.from({length:50000},(_,i)=>[-120+offset+(i%1000)*.0001,30+Math.floor(i/1000)*.001])]}});};});
  await page.addScriptTag({content:fs.readFileSync(before?process.argv[2]:'js/weather-warning-camera.js','utf8')});
  const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');const start=await cdp.send('Runtime.getHeapUsage');
  const frames=await page.evaluate(async()=>{const out=[];for(let i=0;i<40;i++)out.push(await WeatherWarningCamera.resolve({affectedZones:['https://api.weather.gov/zones/county/AAA'+i]}));return out;});
  await cdp.send('HeapProfiler.collectGarbage');const end=await cdp.send('Runtime.getHeapUsage');
  results.push({before,heapBefore:start,heapAfter:end,boundsSha256:crypto.createHash('sha256').update(JSON.stringify(frames)).digest('hex'),cache:await page.evaluate(()=>WeatherWarningCamera.stats?.()||null)});await page.close();
 }
 console.log(JSON.stringify({method:'Offline Chromium, 40 zone geometries x 50000 points. Both V8 heap and backing storage reported after GC; not a real-world weather feed or phone RAM measurement.',results},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
