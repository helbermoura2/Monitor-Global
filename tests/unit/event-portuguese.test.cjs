const {test}=require('node:test');const assert=require('node:assert/strict');require('../../js/event-portuguese.js');const p=globalThis.EventPortuguese;
test('earthquake distances, compass directions, countries and geographic descriptors are Portuguese',()=>{
 assert.equal(p.place('12 km WSW of Pitaloza Arriba, Panama'),'12 km a oeste-sudoeste de Pitaloza Arriba, Panamá');
 assert.equal(p.place('NEAR EAST COAST OF HONSHU, JAPAN'),'perto da costa leste de HONSHU, Japão');
 assert.equal(p.place('NORTHERN MID-ATLANTIC RIDGE'),'Norte de dorsal mesoatlântica');
 assert.equal(p.place('West Yellowstone, Montana'),'West Yellowstone, Montana');
});
test('all event categories share translated labels and raw hazard data stays unchanged',()=>{
 for(const [raw,expected] of [['Tsunami Warning','Alerta de tsunami'],['Tropical Depression','Depressão tropical'],['Super Typhoon','Supertufão'],['Volcanic Ash Advisory','Aviso de cinzas vulcânicas'],['Flash Flood Warning','Alerta de enxurrada'],['Wildfire','Incêndio florestal'],['Tornado Watch','Vigilância de tornado'],['High Wind Warning','Alerta de vento forte'],['Low humidity','Baixa umidade']])assert.equal(p.local(raw),expected);
 const raw={id:'v',type:'volcano',place:'Japan',detail:'No ash observed. Eruption has stopped.',usgsAlertLevel:'WARNING',depth:12.647};const next=p.view(raw);
 assert.equal(next.place,'Japão');assert.equal(next.usgsAlertLevel,'Alerta');assert.equal(next.detail,'Tradução do boletim em andamento. Consulte a fonte oficial.');assert.equal(raw.detail,'No ash observed. Eruption has stopped.');assert.equal(raw.usgsAlertLevel,'WARNING');assert.equal(next.depth,12.647);
});

test('native Portuguese contractions and verb forms never request foreign translation',()=>{const text='Quando houver chuva forte no Brasil e for necessário, consulte as orientações da Defesa Civil.';assert.equal(p.foreign(text),false);assert.equal(p.view({detail:text}).detail,text);assert.equal(p.foreign('Aviso de tsunami'),false);});

test('short foreign instructions are translated, proper names remain intact in volcano text',()=>{assert.equal(p.foreign('No action is needed.'),true);assert.equal(p.text('Washington'),'Washington');const vm=require('node:vm'),fs=require('node:fs');const context={EventPortuguese:p};vm.createContext(context);vm.runInContext(fs.readFileSync('js/confianca-fontes.js','utf8'),context);assert.equal(context.traduzirTextoVulcanico('Washington'),'Washington');});


test('Portuguese speech names work without Intl.DisplayNames and preserve place names',()=>{
 const vm=require('node:vm'),fs=require('node:fs'),context={Intl:{}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('js/event-portuguese.js','utf8'),context);
 const p=context.EventPortuguese;
 assert.equal(p.speech('Terremoto de magnitude 6.6 em Panama, a 13 km de profundidade.'),'Terremoto de magnitude 6 vírgula 6 em Panamá, a 13 quilômetros de profundidade.');
 assert.equal(p.speech('12 km WSW of Pitaloza Arriba, Panama'),'12 quilômetros a oeste-sudoeste de Pitaloza Arriba, Panamá');
 assert.equal(p.place('PANAMA'),'Panamá');
 assert.equal(p.speech('West Yellowstone, Montana'),'West Yellowstone, Montana');
});


test('Brazilian numeric presentation retains precision in raw data and normalizes revisions',()=>{
 assert.equal(p.number(6.6,1),'6,6');assert.equal(p.number(1427358),'1.427.358');assert.equal(p.number(12.647),'13');assert.equal(p.number(-81.47,2),'-81,47');assert.equal(p.number(null),'—');assert.equal(p.number(NaN),'—');
 const raw={mag:6.3,depth:12.647,_deltaTxt:'M6.6 → M6.3 · 10 → 13 km'};
 assert.equal(p.revision(raw),'M6,6 → M6,3 · 10 → 13 km');assert.equal(raw.mag,6.3);assert.equal(raw.depth,12.647);assert.equal(raw._deltaTxt,'M6.6 → M6.3 · 10 → 13 km');
});
