import {writeFileSync} from 'node:fs';
import {tvCoastalMap} from '../worker/tv-map.mjs';
const item={id:'demo-coast',type:'tsunami',source:'PTWC',official:true,feedKey:'demo',time:1800000000000,originTime:1800000000000,coords:[165.55,-14.06],coordinateRole:'origin',hazardNature:'warning',warningLevel:'Warning',affectedAreas:[{name:'Vanuatu',category:'Warning',radiusKm:300}]};
writeFileSync(new URL('../android-tv/app/src/main/assets/maps/demo-vanuatu.json',import.meta.url),JSON.stringify(tvCoastalMap(item))+'\n');
