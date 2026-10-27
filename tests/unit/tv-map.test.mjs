import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {tvCoastalMap} from '../../worker/tv-map.mjs';import {tvSnapshot} from '../../worker/tv-snapshot.mjs';import {historySnapshot} from '../../worker/tv-history.mjs';
import '../../js/tsunami-link.js';
const now=1800000000000,bulletin={id:'map-test',type:'tsunami',official:true,source:'PTWC',feedKey:'PTWC-test',time:now,originTime:now-60000,coords:[165.55,-14.06],coordinateRole:'origin',hazardNature:'warning',affectedAreas:[{name:'Vanuatu',category:'Warning',radiusKm:300}]};
test('TV coast is the named region, limited to the radius in the bulletin, with no inundation polygon',()=>{
 const m=tvCoastalMap(bulletin);assert(m.reference);assert(m.lines.length);assert(m.lines.every(l=>l.points.length>=2));assert(JSON.stringify(m).length<16000);
 for(const l of m.lines)for(const p of l.points)assert(TsunamiLink.distance(bulletin.coords,p)<=301);
 assert(m.frame.minLon<165.55&&m.frame.maxLon>165.55);assert(m.lines.every(l=>l.color==='#fb7148'));assert(!('polygons' in m));
});
test('cancellation/no-threat replace threat color; another region remains independent; unknown coast is never invented',()=>{
 const clear=tvCoastalMap({...bulletin,hazardNature:'bulletin',affectedAreas:[{name:'Vanuatu',category:'No tsunami threat'}]});
 const ended=tvCoastalMap({...bulletin,cancelled:true,affectedAreas:[{name:'Vanuatu',category:'Cancellation'}]});
 assert(clear.lines.every(l=>l.color==='#70c9b5'));assert(ended.lines.every(l=>l.color==='#94a3b8'));
 assert(tvCoastalMap({...bulletin,affectedAreas:[{name:'Fiji',category:'Warning'}]}).lines.some(l=>l.color==='#fb7148'));
 const missing=tvCoastalMap({...bulletin,affectedAreas:[{name:'Unknown fictional coast',category:'Warning'}]});assert(missing.partial);assert.equal(missing.lines.length,0);
 assert.equal(tvCoastalMap({...bulletin,coords:null,originTime:null,affectedAreas:[]}),null);
});
test('the five summary entries, replay and live feed preserve their own valid epicenters, never defaulting to zero',()=>{
 const features=Array.from({length:5},(_,i)=>({id:'map-q'+i,properties:{mag:7-i*.1,time:now-i*1000,place:'Vanuatu',type:'earthquake'},geometry:{coordinates:[165+i,-14-i,10]}}));
 const summary=historySnapshot(features,'daily',now);assert.equal(summary.alerts.length,5);
 summary.alerts.forEach((a,i)=>{assert.equal(a.originLongitude,165+i);assert.equal(a.originLatitude,-14-i);});
 assert.equal(historySnapshot(features,'replay',now).alerts[0].originLongitude,165);
 const invalid={...features[0],geometry:{coordinates:[null,NaN,10]}};assert.equal(tvSnapshot({features:[invalid]},{ok:false},now).alerts[0].originLongitude,undefined);
});
test('date-line coastal frame stays regional and worst-sized live feed stays inside Android byte cap',()=>{
 const map=tvCoastalMap({...bulletin,coords:[179,-18],affectedAreas:[{name:'Fiji',category:'Warning'}]});assert(map.frame.maxLon-map.frame.minLon<40);
 const items=Array.from({length:12},(_,i)=>({...bulletin,id:'many'+i,feedKey:'product'+i,affectedAreas:[{name:'Japan',category:'Warning'},{name:'Alaska',category:'Warning'},{name:'Vanuatu',category:'Warning'}]}));
 const q=Array.from({length:108},(_,i)=>({id:'q'+i,properties:{mag:6,time:now-1000,place:'Test quake'},geometry:{coordinates:[165,-14,10]}}));
 assert(Buffer.byteLength(JSON.stringify(tvSnapshot({features:q},{ok:true,items},now)))<256*1024);
 const fixture=JSON.parse(readFileSync('android-tv/app/src/main/assets/maps/demo-vanuatu.json','utf8'));assert.deepEqual(fixture,tvCoastalMap({...bulletin,id:'demo-coast',feedKey:'demo',originTime:now,warningLevel:'Warning'}));
});

test('mixed regional cancellation removes Vanuatu warning coast while keeping Fiji warning geometry',()=>{
 const areas=[{name:'Vanuatu',category:'Cancellation'},{name:'Fiji',category:'Warning'}];
 const mixed=tvCoastalMap({...bulletin,affectedAreas:areas});
 const fiji=tvCoastalMap({...bulletin,affectedAreas:[areas[1]]});
 assert(mixed.lines.length);assert.deepEqual(mixed.lines,fiji.lines);
});
