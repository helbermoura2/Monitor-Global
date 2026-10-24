// Offline browser benchmark of actual catalogue reconciliation. Pass baseline JS.
const {chromium}=require('playwright'),fs=require('node:fs'),crypto=require('node:crypto');
const baseline=process.argv[2];if(!baseline)throw Error('Pass the baseline sismo-fontes.js path');
const extract=s=>s.slice(s.indexOf('function mergeEarthquakeReports('),s.indexOf('// The orchestrator has already matched'));
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:411,height:806},deviceScaleFactor:2.625});await page.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.abort());await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(()=>CountryBoundaries.ready);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);stopMapCamera();window.__originalDistance=haversine;window.__distanceCalls=0;haversine=(...a)=>{__distanceCalls++;return __originalDistance(...a);};window.__mergeAuditInput=Array.from({length:1200},(_,i)=>({id:(i%2?'EMSC-':'GEONET-')+Math.floor(i/2),sourceEventId:String(Math.floor(i/2)),source:i%2?'EMSC':'GEONET',type:'earthquake',time:Date.now()-Math.floor(i/2)*180000-(i%2)*10000,coords:[-150+(Math.floor(i/2)%50)*6+(i%2)*.01,-40+(Math.floor(Math.floor(i/2)/50)%10)*8],depth:10,mag:4.3,isPreliminary:false,place:'Ensaio local'}));});
 const results=[];
 for(const before of [true,false]){
  await page.addScriptTag({content:extract(fs.readFileSync(before?baseline:'js/sismo-fontes.js','utf8'))});
  await page.evaluate(()=>mergeEarthquakeReports(__mergeAuditInput));
  const rows=await page.evaluate(()=>Array.from({length:4},()=>{__distanceCalls=0;const start=performance.now(),out=mergeEarthquakeReports(__mergeAuditInput),ms=performance.now()-start;return {ms,distanceCalls:__distanceCalls,result:JSON.stringify(out)};}));
  results.push({before,measurements:rows.map(r=>({ms:r.ms,distanceCalls:r.distanceCalls,resultSha256:crypto.createHash('sha256').update(r.result).digest('hex')}))});
 }
 console.log(JSON.stringify({method:'Actual site, 1200 reports covering 30 hours; Chromium 4x CPU emulation; no external network. Four warmed measurements, no camera change.',results},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
