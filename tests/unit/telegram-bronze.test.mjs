import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderAlertImage,decodePng,patchAlertTsunami} from '../../worker/image-rendering.mjs';
import {telegramCardVersion,imageRefreshDue} from '../../telegram-image-refresh.mjs';
const B=globalThis.QuakeTelegramBronzeLayout;
function recorder(){
 const texts=[],flags=[],logos=[];
 const p={
  measure:(s,z)=>String(s).length*z*.52,
  text:(s,x,y,size)=>texts.push({s:String(s),x,y,size}),
  flag:(kind,code,x,y,w,h)=>flags.push({kind,code,x,y,w,h}),
  officialLogo:(...args)=>logos.push(args),
  rect(){},roundRect(){},dot(){},arc(){},gradient(){},
 };
 return {p,texts,flags,logos};
}
const quake={mag:6.7,lat:-7.9,lon:130.1,place:'Tanimbar região das ilhas, Indonésia',imageCountryCode:'ID',timeIso:'2026-11-16T21:11:00Z',depth:10,source:'GEOFON',reviewStatus:'unknown',mmi:'IX',imageMapAvailable:true};
test('approved bronze M6 layout uses one magnitude badge and a flag immediately after the country',()=>{
 assert(B&&B.version==='telegram-imperial-bronze-v1');
 const a=recorder();B.draw(a.p,quake);
 assert.equal(a.texts.filter(t=>t.s==='M6,7').length,1);
 assert(!a.texts.some(t=>/EPICENTRO|Tanimbar · M6/.test(t.s)),'Do not repeat magnitude in the map');
 assert.deepEqual(a.flags.map(x=>[x.kind,x.code]),[['country','ID']]);
 const title=a.texts.find(t=>t.s.includes('Indonésia'));
 assert(title,'Country must be displayed');
 assert(a.flags[0].x>title.x,'Flag follows country name, not in a floating box');
 assert.equal(a.logos.length,1,'The full official eye (with inscriptions) is displayed once');
 assert(a.texts.some(t=>t.s==='@argosorbis'));
 assert(a.texts.some(t=>t.s==='argosorbis.com.br'));
 assert(a.texts.some(t=>t.s==='GEOFON'));
 assert(!a.texts.some(t=>t.s==='Tual'),'No frozen locality from sample imagery');
});
test('other countries and long source names remain dynamic; M5 image version stays glass',()=>{
 const a=recorder();B.draw(a.p,{...quake,mag:7.1,place:'off the east coast of Honshu, Japan',imageCountryCode:'JP',source:'PROVIDER-TEST-LONG-STRING'});
 assert(a.flags.some(f=>f.code==='JP'));assert(a.texts.some(t=>t.s==='M7,1'));
 assert(!a.texts.some(t=>t.s==='Indonésia'));
 assert.equal(telegramCardVersion(6),'telegram-imperial-bronze-v1');
 assert.equal(telegramCardVersion(5.9),'telegram-glass-v19');
 const now=Date.now(),record={id:'b',delivery:'sent',messageType:'photo',messageId:101,mag:6.7,timeIso:new Date(now-120000).toISOString(),imageShakingCheckedAt:now-5000,imageExposureCheckedAt:now-5000,cardImageVersion:'telegram-imperial-bronze-v1'};
 assert.equal(imageRefreshDue(record,now),false,'Do not rerender every minute just because the bronze version differs from glass');
 assert.equal(imageRefreshDue({...record,cardImageVersion:'telegram-glass-v19'},now),true);
});
test('only confirmed active tsunami warnings appear in the reserved bronze region',()=>{
 const missing=recorder();B.drawTsunami(missing.p,{state:'cancelled'});assert.equal(missing.texts.length,0);
 const warning=recorder();B.drawTsunami(warning.p,{state:'warning',source:'PTWC',areas:'Vanuatu'});
 assert(warning.texts.some(x=>x.s==='AVISO OFICIAL DE TSUNAMI'));
 assert(warning.texts.some(x=>x.s==='Vanuatu'));
 assert.equal(B.TSUNAMI_Y,930);
});
test('M6+ bronze PNG is generated offline at official Telegram size, with protected cancellation',async()=>{
 const saved=globalThis.fetch;
 globalThis.fetch=async(url)=>{assert(!String(url).includes('api.telegram.org'));return new Response('Offline fixture',{status:503});};
 try{
  const png=await renderAlertImage({...quake,id:'imperial-bronze-test',test:true,imageTsunami:{state:'warning',source:'PTWC',areas:'Costa de teste'}});
  const image=await decodePng(png);assert.equal(image.width,1080);assert.equal(image.height,1920);
  const cancelled=await patchAlertTsunami(png,{state:'cancelled'},B.version);
  const after=await decodePng(cancelled);
  let changes=0;
  for(let y=0;y<image.height;y++){
   for(let x=0;x<image.width;x++){const i=(y*image.width+x)*4;
    if(image.rgba[i]!==after.rgba[i]||image.rgba[i+1]!==after.rgba[i+1]||image.rgba[i+2]!==after.rgba[i+2]){
     changes++;assert(y>=1240&&y<1435,'Tsunami-only update must not alter map, logo or statistics');
    }
   }
  }
  assert(changes>100);
 }finally{globalThis.fetch=saved;}
});
