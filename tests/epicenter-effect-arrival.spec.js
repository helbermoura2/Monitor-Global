const {test,expect}=require('@playwright/test');
const path=require('path');
for(const width of [411,1280])test('M6+ waits for visible arrival, then gets its full duration and cleans up '+width,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.setContent('<div id="map"></div>');
 await page.evaluate(()=>{window.qa={zoom:2,travel:true,point:{x:200,y:300},listeners:new Map(),markers:0};window.map={on(n,f){if(!qa.listeners.has(n))qa.listeners.set(n,new Set());qa.listeners.get(n).add(f);},off(n,f){qa.listeners.get(n)?.delete(f);},getContainer:()=>({clientWidth:411,clientHeight:844}),project:()=>qa.point,getZoom:()=>qa.zoom};window.EventCamera={owns:()=>qa.travel};window.maplibregl={Marker:class{constructor({element}){this.el=element;}setLngLat(){return this;}addTo(){document.body.append(this.el);qa.markers++;return this;}remove(){this.el.remove();qa.markers--;}}};});
 await page.addScriptTag({path:path.join(__dirname,'../js/seismic-epicenter-detail.js')});
 expect(await page.evaluate(()=>SeismicEpicenterDetail.start({id:'m6',mag:6,coords:[1,2]},8000))).toBe(true);
 await expect(page.locator('.seismic-epicenter-detail')).toHaveCount(0);
 await page.clock.install();await page.clock.fastForward(15000);
 await page.evaluate(()=>{qa.zoom=7;qa.travel=false;qa.point={x:-100,y:300};for(const f of qa.listeners.get('moveend'))f();});
 await expect(page.locator('.seismic-epicenter-detail')).toHaveCount(0);
 await page.evaluate(()=>{qa.point={x:200,y:300};for(const f of qa.listeners.get('moveend'))f();});
 await expect(page.locator('.seismic-epicenter-detail')).toHaveCount(1);
 await page.clock.fastForward(7000);await expect(page.locator('.seismic-epicenter-detail')).toHaveCount(1);
 await page.clock.fastForward(1500);await expect(page.locator('.seismic-epicenter-detail')).toHaveCount(0);
 await page.evaluate(()=>{qa.zoom=2;SeismicEpicenterDetail.start({mag:7,coords:[1,2]});SeismicEpicenterDetail.stop();qa.zoom=7;for(const f of qa.listeners.get('moveend'))f();});
 await expect(page.locator('.seismic-epicenter-detail')).toHaveCount(0);
 expect(await page.evaluate(()=>[...qa.listeners.values()].every(s=>s.size===0))).toBe(true);
 expect(await page.evaluate(()=>SeismicEpicenterDetail.start({mag:5.9,coords:[1,2]}))).toBe(false);
 await page.evaluate(()=>{document.body.insertAdjacentHTML('beforeend','<div id=app><div id=painel-direito></div></div>');});
 await page.addScriptTag({path:path.join(__dirname,'../js/card-effect-quality.js')});
 await page.addScriptTag({path:path.join(__dirname,'../js/seismic-cinema.js')});
 await page.evaluate(()=>SeismicCinema.play({id:'auto6',mag:6,coords:[1,2]},'auto'));
 await page.clock.fastForward(5000);expect(await page.evaluate(()=>SeismicCinema.state())).toBe(null);await expect(page.locator('.seismic-epicenter-detail')).toHaveCount(1);
 await page.clock.fastForward(3500);await expect(page.locator('.seismic-epicenter-detail')).toHaveCount(0);
 await page.evaluate(()=>{SeismicCinema.play({id:'auto6',mag:6,coords:[1,2]},'auto');SeismicCinema.stop();});await expect(page.locator('.seismic-epicenter-detail')).toHaveCount(0);

});
