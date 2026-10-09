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
