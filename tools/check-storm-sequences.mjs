// Real retrospective diagnostic, not independently labeled storm identity.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {identify,track,extrapolate,distance} from '../android-mobile/app/src/main/assets/phone-storm-tracker.mjs';
const root='/tmp/argos-storm-sequences',manifest=JSON.parse(await readFile(root+'/manifest.json','utf8'));
let total=0,links=0,verified=0,errors=[],persistence=[],regions=new Set();
for(let i=0;i<manifest.length;i++){
 const {meta,frames}=JSON.parse(await readFile(root+'/'+i+'.json','utf8'));
 for(const f of frames){
  const a=identify(f),b=f.reference;
  assert.equal(a.overflow,f.overflow);assert.equal(a.objects.length,b.length);assert(Math.abs(a.validFraction-f.validFraction)<1e-10);
  for(let j=0;j<b.length;j++){
   const x=a.objects[j],y=b[j];assert.equal(x.pixels,y.pixels);assert(Math.abs(x.peakDbz-y.peakDbz)<1e-5);assert(distance(x.center,y.center)<.002,'Centroid mismatch');
  }
  total+=b.length;
 }
 const [a,b,c]=frames,ab=track(a,b,meta.now),bc=track(b,c,meta.now),horizon=(c.time-b.time)/60000;links+=ab.tracks.length;
 const cases=[];
 for(const t of ab.tracks){
  const matching=bc.tracks.filter(next=>distance(next.previous,t.current)<.002);
  if(matching.length!==1||!Number.isInteger(horizon))continue;
  const predicted=extrapolate(t,horizon);if(!predicted)continue;
  const actual=matching[0].current,error=distance(predicted.center,actual),baseline=distance(t.current,actual);
  assert(Number.isFinite(error)&&Number.isFinite(baseline));errors.push(error);persistence.push(baseline);verified++;regions.add(meta.region);
  cases.push({horizon,errorKm:+error.toFixed(3),persistenceKm:+baseline.toFixed(3),speedKmh:+t.speedKmh.toFixed(2)});
 }
 console.log(JSON.stringify({radar:meta.radar,region:meta.region,mode:meta.mode,objects:frames.map(f=>f.reference.length),pairStatus:[ab.status,bc.status],links:ab.tracks.length,cases}));
}
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
console.log(JSON.stringify({status:verified?'retrospective_sample_only':'inconclusive_no_trackable_sequence',sequences:manifest.length,objectsCompared:total,links,verified,regions:[...regions],meanErrorKm:mean(errors),meanPersistenceKm:mean(persistence),forecastCalibrated:false}));
if(!verified){console.log('::warning::No trackable three-frame storm; predictive validation remains pending.');}
