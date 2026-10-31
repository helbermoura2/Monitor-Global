const {test,expect}=require('@playwright/test');test.use({serviceWorkers:'block',reducedMotion:'reduce'});
for(const width of [1280,390])test('coordinate flags and missing USGS intensity remain consistent in list and card '+width,async({page})=>{
 await page.setViewportSize({width,height:844});await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(async()=>{pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();stopMapCamera();await CountryBoundaries.ready;});
 const result=await page.evaluate(async()=>{
  const rows=[['Texas',-100,31.5],['Kansas',-98,38.5],['Montana',-110,47],['Washington',-120.5,47.5]].map(([place,lng,lat],i)=>({id:'country-'+i,type:'earthquake',source:'EMSC',sourceEventId:'fake-'+i,time:Date.now()-i*1000,mag:2.1,depth:10,coords:[lng,lat],place,bandeira:'🇲🇽',pais:'México',countryCode:'MX'}));
  globalEvents=rows;globalAlerts=[];applyFilters();showEventDetails(0,false,true);clearTimeout(cycleTimeout);
  const flags=rows.map(x=>x.bandeira),codes=rows.map(x=>x.countryCode),detail=document.querySelector('#pd-flag .pd-country-flag')?.getAttribute('src');
  const event={...rows[0],id:'USGS-qa',source:'USGS',sourceEventId:'qa'};eventoSelecionadoId=event.id;
  const cases=[];for(const mmi of [null,0,'',4.6]){event.sourceEventId='qa-'+cases.length;EventProducts.detail=async()=>({properties:{mmi,felt:null}});await enriquecerIntensidadeSismicaReal(event,()=> 'Intensidade estimada pelo modelo epicentral.');cases.push({mmi,value:document.getElementById('pd-mercalli').textContent,impact:document.getElementById('pd-impact').textContent,label:document.getElementById('pd-mercalli-label').textContent});}
  return{flags,codes,detail,cases};
 });
 expect(result.flags).toEqual(['🇺🇸','🇺🇸','🇺🇸','🇺🇸']);expect(result.codes).toEqual(['US','US','US','US']);expect(result.detail).toBe('assets/flags/countries/us.svg');for(const r of result.cases.slice(0,3)){expect(r.impact).not.toMatch(/MMI 0/);expect(r.label).toContain('estimada');}expect(result.cases[3].label).toContain('FONTE');expect(result.cases[3].value).toContain('V ·');
});
test('weather separates successful current conditions from empty or failed hourly and rain forecasts',async({page})=>{
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.goto('/');await page.waitForFunction(()=>__mgMapReady&&!__fetchGlobalFeedsEmAndamento);await page.evaluate(()=>{pausarBuscas();clearTimeout(cycleTimeout);EventCamera.cancel();stopMapCamera();});
 const r=await page.evaluate(async()=>{
  await fetchProSP();
  RainbowWeather.refresh=async()=>null;
  const current={temperature_2m:22,apparent_temperature:21,wind_gusts_10m:0,precipitation:0,relative_humidity_2m:80,weather_code:0};
  fetchWithCorsFallback=async url=>Response.json(url.includes('current=')?{current}: {daily:{time:[]},hourly:{time:[]}});
  await fetchProSP();await fetchSPForecast();WeatherDataStatus.record('rain','error');WeatherPanel.show();
  const available={temp:document.getElementById('sp-live-temp').textContent,current:WeatherDataStatus.state('current').status,forecast:WeatherDataStatus.state('forecast').status,panel:document.getElementById('weather-data-status').textContent};
  fetchWithCorsFallback=async()=>{throw Error('offline');};await fetchProSP();
  const after={temp:document.getElementById('sp-live-temp').textContent,status:WeatherDataStatus.state('current').status,badge:document.getElementById('weather-current-status').textContent};
  const hour=Math.floor(Date.now()/3600000)*3600000,time=Array.from({length:8},(_,i)=>new Date(hour+i*3600000).toISOString());
  fetchWithCorsFallback=async()=>Response.json({utc_offset_seconds:0,daily:{time:[new Date().toISOString().slice(0,10)],temperature_2m_max:[24],temperature_2m_min:[null],weather_code:[null]},hourly:{time,temperature_2m:[null,22,22,22,22,22,22,22],precipitation:Array(8).fill(null),precipitation_probability:Array(8).fill(null),wind_gusts_10m:Array(8).fill(null),weather_code:Array(8).fill(null)}});await fetchSPForecast();
  return{available,after,partial:{status:WeatherDataStatus.state('forecast').status,prob:document.getElementById('weather-prob').textContent,amount:document.getElementById('weather-mm1').textContent,summary:document.getElementById('weather-arrival-title').textContent}};
 });expect(r.available.temp).toBe('22°');expect(r.available.current).toBe('updated');expect(r.available.forecast).toBe('error');expect(r.available.panel).toContain('Condições atuais: atualizado');expect(r.available.panel).toContain('Previsão horária: indisponível');expect(r.after.temp).toBe('—');expect(r.after.status).toBe('error');expect(r.after.badge).toBe('Indisponível');expect(r.partial.status).toBe('updated');expect(r.partial.prob).toBe('—');expect(r.partial.amount).toBe('—');expect(r.partial.summary).toContain('incompleta');
});
