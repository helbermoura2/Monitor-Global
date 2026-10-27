import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {lifecycle} from '../../tools/tsunami-lifecycle-fixtures.mjs';
const data=lifecycle();
test('the exact Worker lifecycle is committed for Android and browser consumption',()=>{assert.equal(JSON.stringify(data,null,2)+'\n',readFileSync('android-tv/app/src/test/resources/tsunami-lifecycle.json','utf8'));});
test('changing quake availability or correcting the origin does not change the meaning of a regional bulletin',()=>{
 const rows=name=>data.stages.find(s=>s.name===name).snapshot.alerts.filter(a=>a.kind==='tsunami');
 const warning=name=>rows(name).find(a=>a.bulletinProduct==='PTWC-WEPA40');
 assert.equal(warning('magnitude-and-threat-revision').semanticVersion,warning('quake-source-outage').semanticVersion);
 assert.equal(warning('quake-source-outage').semanticVersion,warning('corrected-origin-without-new-threat').semanticVersion);
 assert.notEqual(warning('quake-source-outage').id,warning('corrected-origin-without-new-threat').id);
 const ended=rows('vanuatu-ended-fiji-still-active');assert(ended.some(a=>a.state==='warning'&&a.title.includes('Fiji')));assert(ended.some(a=>a.state==='ended'&&a.title.includes('Vanuatu')));assert(ended.some(a=>a.state==='noThreat'&&a.title.includes('Alasca')));
 assert.equal(rows('fiji-no-threat').filter(a=>a.state==='warning').length,0);
});
