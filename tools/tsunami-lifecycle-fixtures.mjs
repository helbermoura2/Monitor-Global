// One deterministic, fictional lifecycle consumed by Worker, browser and APK tests.
import {tvSnapshot} from '../worker/tv-snapshot.mjs';
import {writeFileSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function lifecycle(){
 const now=Date.parse('2026-10-27T12:00:00Z');
 const quake={id:'lifecycle-q',properties:{mag:7.2,time:now-60000,updated:now,type:'earthquake',place:'Vanuatu'},geometry:{coordinates:[166,-14,10]}};
 const warning={id:'lifecycle-warn',type:'tsunami',official:true,source:'PTWC',feedKey:'PTWC-WEPA40',originTime:now-60000,originMag:7.2,coords:[166,-14],time:now,hazardNature:'warning',warningLevel:'Ameaça oficial',place:'Vanuatu',sev:4,affectedAreas:[{name:'Vanuatu',category:'0.3 TO 1 METERS'}],link:'https://www.tsunami.gov/'};
 const fiji={...warning,id:'lifecycle-fiji',feedKey:'PTWC-WEPA42',officialEventId:'PHEB:fixture',place:'Fiji',affectedAreas:[{name:'Fiji',category:'Warning'}]};
 const clear={...warning,id:'lifecycle-alaska',source:'NTWC',feedKey:'NTWC-WEAK51',place:'Alaska',hazardNature:'bulletin',warningLevel:'Informativo',sev:0,affectedAreas:[{name:'Alaska',category:'No tsunami threat'}]};
 const stages=[],add=(name,q,items,expected,quakeOk=true,tsunamiOk=true)=>{const at=now+stages.length*60000,bulletins=items.map(a=>({...a,time:at})),quakes={ok:quakeOk,features:q?[q]:[]};stages.push({name,now:at,quakes,tsunamis:{ok:tsunamiOk,items:bulletins},expected,snapshot:tvSnapshot(quakes,{ok:tsunamiOk,items:bulletins},at,{maxAge:72*3600000})});};
 add('baseline',null,[],0);
 add('warning-and-independent-coasts',quake,[warning,fiji,clear],4);
 add('clock-only-repeat',quake,[warning,fiji,clear],0);
 const revision={...quake,properties:{...quake.properties,mag:6.9,updated:now+180000}},higher={...warning,affectedAreas:[{name:'Vanuatu',category:'1 TO 3 METERS'}]};
 add('magnitude-and-threat-revision',revision,[higher,fiji,clear],2);
 add('quake-source-outage',null,[higher,fiji,clear],0,false);
 const corrected={...higher,id:'lifecycle-corrected',originTime:higher.originTime+2000,coords:[166.2,-14]};
 add('corrected-origin-without-new-threat',revision,[corrected,fiji,clear],0);
 const ended={...corrected,id:'lifecycle-ended',cancelled:true,hazardNature:'bulletin',warningLevel:'Encerrado',sev:0,affectedAreas:[{name:'Vanuatu',category:'Cancellation'}]};
 add('vanuatu-ended-fiji-still-active',revision,[ended,fiji,clear],1);
 const fijiClear={...fiji,id:'lifecycle-fiji-clear',hazardNature:'bulletin',warningLevel:'Informativo',sev:0,affectedAreas:[{name:'Fiji',category:'No tsunami threat'}]};
 add('fiji-no-threat',revision,[ended,fijiClear,clear],1);
 add('ended-clock-only-repeat',revision,[ended,fijiClear,clear],0);
 add('tsunami-source-outage',revision,[],0,true,false);
 add('recovery-without-repeat',revision,[ended,fijiClear,clear],0);
 add('new-fiji-escalation',revision,[ended,{...fiji,id:'lifecycle-fiji-escalation'},clear],1);
 add('outage-while-fiji-active',revision,[],0,true,false);
 add('active-recovery-without-repeat',revision,[ended,{...fiji,id:'lifecycle-fiji-escalation'},clear],0);
 add('final-fiji-ending',revision,[ended,{...fiji,id:'lifecycle-fiji-ended',cancelled:true,hazardNature:'bulletin',warningLevel:'Encerrado',affectedAreas:[{name:'Fiji',category:'Cancellation'}]},clear],1);
 return {fictional:true,stages};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const path='android-tv/app/src/test/resources/tsunami-lifecycle.json',text=JSON.stringify(lifecycle(),null,2)+'\n';
 if(process.argv.includes('--check')){if(readFileSync(path,'utf8')!==text)throw Error('Regenerate lifecycle fixture from the current Worker');console.log('PASS: shared lifecycle fixture matches the current Worker');}else writeFileSync(path,text);
}
