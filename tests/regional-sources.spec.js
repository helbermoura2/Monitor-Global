const {test,expect}=require('@playwright/test');const fs=require('fs');
test('catálogos oficiais: fusos, coordenadas, profundidade e validação',async({page})=>{
 await page.goto('about:blank');await page.addScriptTag({path:'js/regional-seismic.js'});
 const fixtures={gfz:fs.readFileSync('tests/fixtures/geofon-recent.txt','utf8'),ovsi:fs.readFileSync('tests/fixtures/ovsicori-recent.html','utf8'),marn:fs.readFileSync('tests/fixtures/marn-recent.html','utf8')};
 const d=await page.evaluate(f=>{const now=Date.parse('2026-10-01T21:30:00Z'),r=RegionalSeismic;return {g:r.geofon(f.gfz,now),o:r.ovsicori(f.ovsi,now),m:r.marn(f.marn,now),expired:r.ovsicori(f.ovsi,now+3*86400000),future:r.ovsicori(f.ovsi,now-86400000)};},fixtures);
 expect(d.g[0].mag).toBe(5.17);expect(d.g[0].coords).toEqual([167.197,-11.791]);expect(d.o[0].time).toBe(Date.parse('2026-10-01T19:44:40Z'));expect(d.o[0].depth).toBe(29);expect(d.o[0].coords).toEqual([-84.2572,9.2315]);expect(d.m[0].time).toBe(Date.parse('2026-10-01T00:34:00Z'));expect(d.m[0].mag).toBe(4.3);expect(d.m[0].depth).toBe(30.75);expect(d.m[0].coords).toEqual([-88.18816,12.497833]);expect(d.m[1].pais).toBeUndefined();expect(d.expired).toEqual([]);expect(d.future).toEqual([]);
 for(const method of ['geofon','ovsicori','marn'])expect(await page.evaluate(method=>{try{RegionalSeismic[method]('<html>maintenance</html>');return false}catch(e){return true}},method)).toBeTruthy();
});
test('status de fonte não é sobrescrito por pings e explica falha/pausa',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{setSource('OSC-BOL','ok');const before=PRO.sourceState['OSC-BOL'].time;const native=fetch;window.fetch=()=>{throw Error('ping indevido')};try{await checkSources()}finally{window.fetch=native}if(before!==PRO.sourceState['OSC-BOL'].time)throw Error('ping alterou saúde');setSource('GDACS enchentes','off',0,'HTTP 502');setSource('GDACS enchentes','off',0,'HTTP 502');await fetchAnaRios();window.__uxShow('sources');});
 await expect(page.locator('#ux-panel-content')).toContainText('Consulta falhou');await expect(page.locator('#ux-panel-content')).toContainText('HTTP 502');await expect(page.locator('#ux-panel-content')).toContainText('PAUSADA');await expect(page.locator('#ux-panel-content')).toContainText('Resposta válida');await expect(page.locator('#ux-panel-content')).not.toContainText('Fora do ar há');
});
test('EONET registra falha de catálogo e aceita catálogo vazio válido',async({page})=>{
 await page.goto('about:blank');await page.addScriptTag({path:'js/incendios.js'});
 const result=await page.evaluate(async()=>{
  window.EONET='https://example.test';window.globalAlerts=[];window.applyFilters=()=>{};const states=[];window.setSource=(name,status,ms,error)=>states.push({name,status,error});
  let valid=false;window.fetch=async url=>({json:async()=>url.endsWith('/categories')?{categories:[{id:'severeStorms',title:'Severe Storms'}]}:valid?{events:[]}:{error:'indisponível'}});
  let rejected=false;try{await fetchEonetStorms()}catch(e){rejected=true}valid=true;await fetchEonetStorms();return {rejected,states};
 });
 expect(result.rejected).toBeTruthy();expect(result.states[0].status).toBe('off');expect(result.states[0].error).toContain('catálogo inválido');expect(result.states[1].status).toBe('ok');
});
