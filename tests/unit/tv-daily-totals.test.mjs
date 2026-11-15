import test from 'node:test';
import assert from 'node:assert/strict';
import {dailySeismicTotals} from '../../worker/tv-daily-totals.mjs';
import {handleTvHistory} from '../../worker/tv-history.mjs';

const day='2026-11-14';
const now=Date.parse('2026-11-15T10:00:00.000Z');
const start=Date.parse('2026-11-14T03:00:00.000Z');
const sample=(mag,i)=>({id:'quake-'+i,provider:'USGS',time:start+1000*i,mag});
const events=[...Array.from({length:173},(_,i)=>sample(1.5,i)),
 ...Array.from({length:15},(_,i)=>sample(4.4,i+173)),
 ...Array.from({length:2},(_,i)=>sample(5.5,i+188))];

test('magnitudes use Telegram image bands, not five TV event cards',()=>{
 const totals=dailySeismicTotals({day,events,brazilFailedSources:[],globalFailedSources:[]});
 assert.deepEqual(totals,{day,total:190,m6:0,m5:2,m4:15,below4:173,partial:false});
 assert.equal(totals.m6+totals.m5+totals.m4+totals.below4,totals.total);
});
test('a M6+ is counted once in its exclusive range, not in M5 and below',()=>{
 const totals=dailySeismicTotals({day,events:[sample(7.1,1),sample(6,2),sample(5.99,3),sample(5,4),sample(4.99,5),sample(4,6),sample(3.999,7)]});
 assert.deepEqual([totals.total,totals.m6,totals.m5,totals.m4,totals.below4],[7,2,2,2,1]);
});
test('failed sources are flagged partial, never authoritative zeros',()=>{
 const totals=dailySeismicTotals({day,events,brazilFailedSources:['EMSC']});assert.equal(totals.partial,true);
 assert.throws(()=>dailySeismicTotals({day,events:[sample(NaN,1)]}),/incompleto/);
 assert.throws(()=>dailySeismicTotals({day,events:[sample(5,1),sample(5,1)]}),/duplicado/);
});
test('daily and completed views attach same day totals, preserve prior date, and never invent after a source failure',async()=>{
 const feature={id:'us-day',properties:{mag:5.5,time:start+12000,updated:start+12000,place:'Atlântico',type:'earthquake'},
   geometry:{coordinates:[-27,-3,10]}};
 let requestedDay;
 const opts={view:'completed',now,cache:null,env:{},
  fetcher:async()=>Response.json({features:[feature]}),
  regional:async()=>({features:[],catalogs:{USGS:true}}),supplemental:async()=>({sources:[]}),
  dailyLoader:async requested=>{requestedDay=requested;return {day:requested,events};}};
 const request=new Request('https://test/tv-alerts?policy=telegram-v1&view=completed');
 const response=await handleTvHistory(request,opts);
 assert.equal(response.status,200);
 const json=await response.json();
 assert.equal(requestedDay,day);assert.equal(json.day,day);assert.equal(json.alerts.length,1);
 assert.deepEqual(json.dailyTotals,{day,total:190,m6:0,m5:2,m4:15,below4:173,partial:false});
 const broken=await(await handleTvHistory(request,{...opts,dailyLoader:async()=>{throw Error('not available');}})).json();
 assert.equal(broken.dailyTotals,undefined);
 assert.equal(broken.alerts.length,1);
 const partial=await(await handleTvHistory(request,{...opts,dailyLoader:async()=>({day,events,brazilFailedSources:['USP']})})).json();
 assert.equal(partial.dailyTotals?.partial,true);
});
