const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('VAAC eruption report retains estimated cloud and multiline remarks from Ibu bulletin',()=>{
 const src=fs.readFileSync('monitor-global-worker-7_7_0.js','utf8'),start=src.indexOf('function parseVolcanoAdvisoryText('),c=vm.createContext({Date,lookupKnownVolcanoCoords:()=>null});vm.runInContext(src.slice(start,src.indexOf('\n}',start)+2),c);
 const bulletin='VA ADVISORY\nDTG: 20261013/0100Z\nVAAC: DARWIN\nVOLCANO: IBU 268030\nPSN: N0129 E12738\nAREA: INDONESIA\nADVISORY NR: 2026/1161\nERUPTION DETAILS: ERUPTION REP AT 12/2252Z\nEST VA CLD: SFC/FL070 N0127 E12741\nRMK: VA NOT IDENTIFIABLE ON CURRENT SATELLITE IMAGERY DUE TO\n MET CLOUD. ONGOING EMISSIONS REPORTED BY CVGHM.\nNXT ADVISORY: NO LATER THAN 20261013/0700Z=';
 const r=c.parseVolcanoAdvisoryText(bulletin,'DARWIN')[0];assert.equal(r.detail,'ERUPTION REP AT 12/2252Z');assert.match(r.ashHeight,/SFC\/FL070/);assert.match(r.vonaRemarks,/ONGOING EMISSIONS REPORTED BY CVGHM/);assert.doesNotMatch(r.vonaRemarks,/NXT ADVISORY/);assert.equal(r.time,Date.parse('2026-10-13T01:00:00Z'));
});
test('USGS older VONA never replaces current status, while a newer eruptive notice takes precedence',async()=>{
 const src=fs.readFileSync('monitor-global-worker-7_7_0.js','utf8'),start=src.indexOf('function arrOf('),end=src.indexOf('\n}',src.indexOf('async function getUsgsVolcanoProfessional('))+2;
 let date='2026-10-06T19:20:00Z';const latest='2026-10-12T19:50:45Z',status={vName:'Kilauea',vnum:'332010',lat:19.421,long:-155.287,alertDate:latest,noticeSynopsis:'Current monitoring status',noticeId:'daily-12',noticeUrl:'https://volcanoes.usgs.gov/current',colorCode:'ORANGE',alertLevel:'WATCH'};
 const c=vm.createContext({Date,nowIso:()=>latest,fetchJson:async url=>url.includes('/vonas/')?[{vName:'Kilauea',vnum:'332010',sentUtc:date,noticeId:'vona',noticeSynopsis:'Eruption reported at 12/2252Z',colorCode:'RED',alertLevel:'WARNING'}]:[status]});vm.runInContext(src.slice(start,end),c);
 let r=(await c.getUsgsVolcanoProfessional()).all[0];assert.equal(r.noticeId,'daily-12');assert.equal(r.time,Date.parse(latest));assert.equal(r.aviationColor,'ORANGE');assert.equal(r.detail,'Current monitoring status');assert.equal(r.usgsVona.noticeId,'vona');assert.equal(r.usgsUrl,status.noticeUrl);
 date='2026-10-12T23:00:00Z';r=(await c.getUsgsVolcanoProfessional()).all[0];assert.equal(r.noticeId,'vona');assert.equal(r.aviationColor,'RED');assert.match(r.detail,/Eruption reported/);assert.equal(r.time,Date.parse(date));
});
