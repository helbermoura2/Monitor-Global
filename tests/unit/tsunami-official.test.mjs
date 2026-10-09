import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {parseTsunamiAtom,getOfficialTsunamis} from '../../tsunami-official-worker.mjs';
const xml=readFileSync('tests/fixtures/tsunami/PHEBAtom.xml','utf8');
test('real Panama bulletin extracts coordinates, category and bulletin rather than CAP link',()=>{
 const [item]=parseTsunamiAtom(xml,'PTWC');assert.deepEqual(item.coords,[-80.75,7.54]);assert.equal(item.warningLevel,'Informativo');assert.equal(item.hazardNature,'bulletin');assert.equal(item.sev,0);assert.match(item.link,/\.txt$/);assert.equal(item.place,'PANAMA');
});
test('Warning, Watch, Advisory and cancellation are distinct; missing coordinates are not zero',()=>{
 for(const [category,label,sev] of [['Warning','Aviso',4],['Watch','Vigilância',3],['Advisory','Atenção',2],['Cancellation','Encerrado',0]]){
  const [item]=parseTsunamiAtom(xml.replace('Category:</strong> Information','Category:</strong> '+category).replace(/<geo:lat>[^<]*<\/geo:lat>/,''),'PTWC');assert.equal(item.warningLevel,label);assert.equal(item.sev,sev);assert.equal(item.coords,null);assert.equal(item.hazardNature,sev?'warning':'bulletin');
 }
 assert.equal(parseTsunamiAtom(xml.replace(/<updated>[^<]*<\/updated>/g,'<updated>invalid</updated>'),'PTWC').length,0);
});
test('empty healthy feed does not equal outage and a failed center cannot erase the other',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=async url=>String(url).includes('PHEB')?new Response('<feed xmlns="http://www.w3.org/2005/Atom"></feed>'):new Response('',{status:503});
 try{const data=await getOfficialTsunamis();assert.equal(data.ok,true);assert.equal(data.items.length,0);assert.equal(data.sources[0].ok,true);assert.equal(data.sources[1].ok,false);}finally{globalThis.fetch=saved;}
});
test('Pacific threat product carries Panama 1–3m even when the general Atom says Information',async()=>{
 const {parseTsunamiProduct}=await import('../../tsunami-official-worker.mjs');const data=readFileSync('tests/fixtures/tsunami/PHEBWEPA40.js.txt','utf8');const [item]=parseTsunamiProduct(data,'WEPA40');assert.equal(item.warningLevel,'Ameaça oficial');assert.equal(item.hazardNature,'warning');assert.equal(item.sev,4);assert(item.affectedAreas.some(a=>a.name==='Panama'&&a.category==='1-3 meters'));assert.deepEqual(item.coords,[-80.75,7.54]);assert.match(item.link,/WEPA40.txt$/);
 const [old]=parseTsunamiProduct(data.replaceAll('1-3 meters','Cancellation').replaceAll('0.3-1 meters','Cancellation'),'WEPA40');assert.equal(old.warningLevel,'Encerrado');assert.equal(old.hazardNature,'bulletin');
 assert.throws(()=>parseTsunamiProduct('var x = (()=> { globalThis.hacked=true })();','WEPA40'));assert.equal(globalThis.hacked,undefined);
});
