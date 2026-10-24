// Serve the site on 4173. Pass the pre-fix sismo-fontes.js as the first argument.
// All external traffic is blocked. Replays catalogue updates, not camera flights.
const {chromium}=require('playwright');
const fs=require('node:fs'),crypto=require('node:crypto');
const baseline=process.argv[2];
if(!baseline)throw Error('Usage: node tools/catalog-report-browser-audit.cjs /path/to/pre-fix-sismo-fontes.js');
const baselineSource=fs.readFileSync(baseline,'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const results=[];
 try{
  for(const before of [true,false]){
   const page=await browser.newPage({viewport:{width:411,height:806},deviceScaleFactor:2.625});
   await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());
   await page.goto('http://127.0.0.1:4173');
   await page.waitForFunction(()=>window.__mgMapReady&&!__fetchGlobalFeedsEmAndamento);
   await page.evaluate(()=>CountryBoundaries.ready);
   await page.evaluate(()=>{
    pausarBuscas();clearTimeout(cycleTimeout);clearTimeout(window.__mgCycleGuard);
    EventCamera.cancel();SeismicCinema.stop();CinematicCard.stop();stopWaveFront();stopFeltZone();stopMapCamera();
    globalEvents=[];globalAlerts=[];lastMerged=[];
   });
   if(before)await page.addScriptTag({content:baselineSource.slice(baselineSource.indexOf('function sismoReconcileReports('),baselineSource.indexOf('\nfunction mergeEarthquakeReports('))});
   const cdp=await page.context().newCDPSession(page),samples=[];
   for(let batch=0;batch<=8;batch++){
    if(batch)await page.evaluate(()=>{
     const sources=['GEONET','JMA','BMKG','CSN-Chile','OSC-BOL'];
     for(let n=0;n<120;n++)globalEvents=Array.from({length:200},(_,i)=>{
      const source=sources[i%5],raw=JSON.parse(JSON.stringify({type:'earthquake',id:source+'-regional-'+i,source,time:1792470038737-i*600000,coords:[165+(i%5)*.1,-14],mag:4.3+(n%2)*.1,depth:10,depthReported:10,place:'Localidade regional de teste '+i,quality:'A',detailUrl:'https://source.example/quake/'+i}));
      return sismoPreserveMatchedReports(mergeEarthquakeReports([raw])[0],globalEvents[i]);
     });
     lastMerged=globalEvents;
    });
    await cdp.send('HeapProfiler.collectGarbage');
    samples.push({round:batch*120,heapBytes:(await cdp.send('Runtime.getHeapUsage')).usedSize,counts:await page.evaluate(()=>SismoReportMemory.stats())});
   }
   if(before&&process.env.MEMORY_SNAPSHOT_PATH){
    const chunks=[];cdp.on('HeapProfiler.addHeapSnapshotChunk',e=>chunks.push(e.chunk));
    await cdp.send('HeapProfiler.takeHeapSnapshot',{reportProgress:false});
    fs.writeFileSync(process.env.MEMORY_SNAPSHOT_PATH,chunks.join(''));
   }
   results.push({before,samples});await page.close();
  }
  console.log(JSON.stringify({method:'Offline replay in the actual site; 200 regional events, 960 updates, main JS heap after explicit GC; not 12 wall-clock hours or a phone/GPU benchmark.',baselineSourceSha256:hash(baselineSource),currentSourceSha256:hash(fs.readFileSync('js/sismo-fontes.js','utf8')),results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
