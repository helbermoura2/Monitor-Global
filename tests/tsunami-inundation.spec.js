const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
test.use({serviceWorkers:'block'});
// Veja storm-lightning.spec.js (silenceBaseTileRetry) — issue #327: evita a
// corrida do Playwright Clock com o retry (agendado antes do clock.install, logo
// imune a ele) de tiles base do mapa quando a rede do ArcGIS falha/está bloqueada.
async function silenceBaseTileRetry(page){
 await page.evaluate(()=>{for(const id of ['satellite','esri-boundaries-places']){try{const src=map.getSource(id);if(src)src.setTiles=()=>{};}catch(e){}}});
}
// PNG 1x1 transparente — ver comentário no route() abaixo.
const TRANSPARENT_PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=','base64');
async function boot(page,width,cpu=false){
 if(cpu)await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)&&this.classList.contains('pd-tsunami-surface')?null:get.call(this,type,...args);};});
 // server.arcgisonline.com (tiles satellite/esri-boundaries-places, js/mapa.js)
 // recebe um PNG 1x1 em vez de abort(): abortar faz o MapLibre emitir 'error'
 // pra essas fontes, o que arma o retry nativo de 4s (setTimeout agendado
 // antes de qualquer page.clock.install — issue #327) que, ao disparar, pode
 // achar o mapa num estado que o faz crashar ("Cannot read properties of
 // undefined (reading 'bind')"). silenceBaseTileRetry (abaixo) neutraliza
 // esse retry depois que a fonte já existe, mas é uma corrida contra esse
 // timer de 4s — inofensiva quando o resto do boot() é rápido, mas num CI
 // real mais carregado (ou mais tarde numa bateria longa de testes, como
 // "sem GPU" roda depois dos dois testes de ciclo de vida) o próprio
 // waitForFunction abaixo pode levar mais que 4s pra resolver, e o retry
 // dispara antes do patch. Responder com um tile válido (em vez de abortar)
 // evita o 'error' na largada — sem erro, sem retry nenhum agendado — então
 // não existe corrida pra ganhar ou perder, em qualquer máquina.
 await page.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(u.hostname==='127.0.0.1')return r.continue();
  if(u.hostname==='server.arcgisonline.com')return r.fulfill({status:200,contentType:'image/png',body:TRANSPARENT_PNG});
  return r.abort();
 });
 await page.setViewportSize({width,height:844});await page.goto('/',{waitUntil:'domcontentloaded'});await page.evaluate(()=>OptionalFeatures.effect("tsunami"));await page.waitForFunction(()=>!__fetchGlobalFeedsEmAndamento&&!!window.CardTsunamiSurge);
 // Mantido como segunda camada de defesa (ex.: algum outro tile-id futuro
 // acabar caindo no mesmo map.on('error',...) por outro motivo que não rede).
 await silenceBaseTileRetry(page);
 await page.evaluate(()=>{const item={id:'procedural-tsunami',type:'tsunami',place:'Tsunami — boletim de teste 🇯🇵',source:'QA',coords:[-46.63,-23.55],time:Date.now(),sev:3};globalAlerts=[item];upsertAlert(item);showAlertDetails(item,false);clearTimeout(cycleTimeout);clearTimeout(window.__mgRadarDelayT);clearTimeout(window.__mgWaveDelayT);if(innerWidth<900){document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');}});
 await expect(page.locator('#pd-local')).toContainText('boletim de teste');
}
async function picture(page,name){const r=await page.locator('#painel-direito').boundingBox(),v=page.viewportSize(),x=Math.max(0,r.x),y=Math.max(0,r.y);await page.screenshot({path:name,clip:{x,y,width:Math.min(r.width,v.width-x),height:Math.min(r.height,v.height-y)}});}
async function surfaceEnergy(page){return page.locator('.pd-tsunami-surface').evaluate(c=>{let data;if(c.dataset.renderer.endsWith('webgl')){const gl=c.getContext('webgl');data=new Uint8Array(c.width*c.height*4);gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,data);}else data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let min=255,max=0;for(let i=0;i<data.length;i+=4){min=Math.min(min,data[i]);max=Math.max(max,data[i]);}return {min,max,alpha:data[3]};});}
for(const width of [1280,390])test('tsunami procedural: superfície única, impacto, dados, Menu e ciclo de vida '+width,async({page})=>{
 test.setTimeout(120000);const errors=[],videos=[];page.on('pageerror',e=>{if(e.message!=='Failed to fetch')errors.push(e.message);});page.on('request',r=>{if(/tsunami.*\.(?:mp4|webm|jpg)/.test(r.url()))videos.push(r.url());});await boot(page,width);
 const surface=page.locator('.pd-tsunami-surface');await expect(surface).toHaveCount(1);await expect(surface).toHaveAttribute('data-renderer','hydraulic-bore-webgl');await expect(page.locator('.pd-cinema-film,.pd-cinema-footage')).toHaveCount(0);await expect(page.locator('.pd-tsunami-contact')).toHaveCount(1);await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-weather-material','hydraulic-bore');
 const energy=await surfaceEnergy(page);expect(energy.max-energy.min).toBeGreaterThan(40);expect(energy.alpha).toBe(255);const time=await surface.getAttribute('data-time');await expect.poll(()=>surface.getAttribute('data-time')).not.toBe(time);
 await expect.poll(()=>page.locator('#pd-local .pd-fx-windletter').evaluateAll(els=>els.some(el=>el.style.transform.includes('translate3d')&&el.style.transform!=='translate3d(0.00px,0.00px,0) rotate(0.00deg) skewX(0.00deg)'))).toBe(true);
 const first=await surface.elementHandle();await page.evaluate(()=>{const item={...EventStore.getSelected(),place:'Tsunami — boletim atualizado 🇯🇵',sev:1};upsertAlert(item);showAlertDetails(item,false,true);clearTimeout(cycleTimeout);});await expect(page.locator('#pd-local')).toContainText('boletim atualizado');expect(await first.evaluate(el=>el.isConnected)).toBe(true);
 // Hidden/back faces pause the one shared clock; no separate water RAF survives.
 await page.evaluate(()=>document.getElementById('painel-direito').classList.add('pd-flip-girado'));await page.waitForTimeout(220);const paused=await surface.getAttribute('data-time');await page.waitForTimeout(250);expect(await surface.getAttribute('data-time')).toBe(paused);await page.evaluate(()=>document.getElementById('painel-direito').classList.remove('pd-flip-girado'));await expect.poll(()=>surface.getAttribute('data-time')).not.toBe(paused);
 // A cena compara performance.now() (real, capturado em scene.start na criação)
 // contra o "agora" do rAF pra saber quando bateu os 16000ms de duração
 // (Math.min(duration,16000) em cinematic-card.js). O Clock do Playwright não
 // é contínuo com o tempo real: ao instalar, suas ticks reiniciam de ~0 em vez
 // de herdar o performance.now() já decorrido. Por isso só é seguro avançar o
 // clock por "tempo real já gasto até aqui + duração + margem" — nunca por um
 // valor fixo pequeno, senão o salto nunca alcança scene.start+16000 e a cena
 // (e .pd-cinema-layer) nunca é removida.
 // page.clock.install() por si só não congela o tempo: sem um pauseAt(),
 // o relógio falso continua avançando em sincronia com o relógio real entre
 // cada await daqui pra frente (storm-lightning.spec.js/storm-cinema.spec.js
 // já fazem pauseAt logo após install por isso). Sem congelar, os próximos
 // fastForward/runFor ficam sujeitos ao tempo real gasto pelos passos do
 // teste (screenshots, round-trips de evaluate etc.), o que mais abaixo
 // chega a adiantar o fim do demo (60000ms) o bastante pra cair dentro da
 // janela de 30000ms que o próprio app usa pra retomar o ciclo automático
 // (scheduleNextAutoCycle em js/painel-e-lista.js) — recriando um
 // .pd-cinema-layer real (não-demo) antes da hora.
 const elapsedBeforeClock=await page.evaluate(()=>performance.now());
 await page.clock.install();
 // O requestAnimationFrame que a cena já tinha agendado (via rAF nativo,
 // antes do install acima) continua pendente no compositor real do browser
 // até o próprio browser decidir pintar o próximo frame — isso não entra na
 // fila de timers do clock falso, então fastForward/runFor não têm como
 // adiantá-lo. Só quando esse frame nativo finalmente dispara é que o loop
 // (cinematic-card.js) chama requestAnimationFrame de novo e cai, agora sim,
 // na versão fake instalada — virando um timer "AnimationFrame" rastreável
 // pelo clock. Sem esperar essa transição (uma corrida de tempo real, não
 // simulado — por isso mais visível em CI real/carregado do que aqui),
 // fastForward avança o relógio falso sem que ninguém esteja de fato
 // escutando, e a cena nunca bate o Math.min(duration,16000) de
 // cinematic-card.js: .pd-cinema-layer sobrevive ao teardown esperado.
 await page.waitForFunction(()=>{const c=window.__pwClock&&window.__pwClock.controller;if(!c)return false;for(const t of c._timers.values())if(t.type==='AnimationFrame')return true;return false;},null,{timeout:2000});
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+500));await page.clock.fastForward(elapsedBeforeClock+16000+2000);await page.clock.runFor(100);await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);await expect(surface).toHaveCount(0);
 const text=await page.locator('#pd-local').textContent();await page.evaluate(()=>CardEffectDemo.preview('tsunami'));await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-demo','true');await expect(surface).toHaveCount(1);await expect(page.locator('.pd-cinema-footage,.pd-cinema-film')).toHaveCount(0);expect(await page.locator('#pd-local').textContent()).toBe(text);await page.clock.runFor(2500);
 expect(await page.locator('#pd-focus-btn').evaluate(el=>{const r=el.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#pd-focus-btn')===el;})).toBe(true);
 const bounds=await page.locator('#painel-direito').boundingBox();expect(bounds.x).toBeGreaterThanOrEqual(-1);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);expect(await surface.evaluate(c=>Math.abs(c.offsetHeight-document.getElementById('painel-direito').clientHeight)<1)).toBe(true);
 // CardEffectDemo.preview('tsunami') sem modo explícito usa 'warning', cuja
 // duração (js/card-effect-demo.js) é 60000ms desde #269/#275 (antes era o
 // genérico 16000ms) — a barra '#card-fx-demo-status' só desaparece no
 // próprio setTimeout(stop,60000) do demo, independente da cena visual
 // (.pd-cinema-layer), que já se encerra antes por ter duração própria
 // capada em 16000ms. 22000 não alcança os 60000, daí a barra sobrava.
 // Alvo: total de 70000ms avançados desde a chamada de preview() (2500 do
 // runFor acima + 67500 aqui). Isso fica bem acima dos 60000ms do timer do
 // demo (margem de 10s) e, com o relógio já congelado por pauseAt(), bem
 // abaixo dos 90000ms (60000+30000) em que o ciclo automático do app
 // recriaria um .pd-cinema-layer real pra esse mesmo alerta (margem de 20s).
 await picture(page,'/tmp/tsunami-inundation-'+width+'.png');await page.clock.fastForward(67500);await expect(page.locator('#card-fx-demo-status')).toHaveCount(0);await expect(page.locator('.pd-cinema-layer')).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-tsunami-surface,.pd-weather-material,.pd-weather-lenses,.pd-cinema-layer,.pd-fx-windletter,.pd-water-submerged')).toHaveCount(0);await expect(page.locator('#pd-local')).toHaveText(text);expect(await page.locator('#painel-direito').evaluate(p=>p.style.getPropertyValue('--pd-surge-y'))).toBe('');expect(videos).toEqual([]);expect(errors).toEqual([]);
});
for(const mode of ['2D','context-loss'])test('tsunami mantém correnteza, letras e controles sem GPU '+mode,async({page})=>{
 test.setTimeout(90000);const errors=[];page.on('pageerror',e=>{if(e.message!=='Failed to fetch')errors.push(e.message);});await boot(page,1280,mode==='2D');if(mode==='context-loss'){await expect(page.locator('.pd-tsunami-surface')).toHaveAttribute('data-renderer','hydraulic-bore-webgl');await page.locator('.pd-tsunami-surface').evaluate(c=>c.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());}
 await expect(page.locator('.pd-tsunami-surface')).toHaveAttribute('data-renderer','hydraulic-bore-2d');await expect(page.locator('.pd-cinema-layer')).toHaveAttribute('data-renderer','hydraulic-bore-2d');await expect(page.locator('.pd-tsunami-surface')).toHaveCount(1);const e=await surfaceEnergy(page);expect(e.max-e.min).toBeGreaterThan(40);expect(e.alpha).toBe(255);await expect(page.locator('#pd-local')).toContainText('boletim de teste');await expect(page.locator('#pd-focus-btn')).toBeEnabled();await picture(page,'/tmp/tsunami-reserve-'+mode+'.png');await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.pd-tsunami-surface,.pd-weather-material,.pd-fx-windletter')).toHaveCount(0);expect(errors).toEqual([]);
});
test('frente hidráulica carrega as letras originais na posição de cada linha e preserva estilos',async({page})=>{
 await page.setContent('<div id="painel-direito" style="width:320px;height:600px;display:flow-root"><div id="pd-local" style="margin:240px 15px 20px">TSUNAMI 🇯🇵</div><div id="pd-source">Fonte oficial</div><div class="stat-card"><span class="stat-card-value"><b style="color:rgb(240,210,120)">3</b> ALERTA</span></div><button id="control">Detalhes</button></div>');
 for(const name of ['painel-fx.js','card-tsunami-surge.js'])await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js',name),'utf8')});
 const original=await page.locator('#painel-direito').innerText();const samples=await page.evaluate(()=>{triggerWindLetters(Infinity,{controlled:true,allText:true});const p=document.getElementById('painel-direito'),s=CardTsunamiSurge.create({type:'tsunami',strength:1},false,p);p.append(s.background,s.canvas,s.lensLayer);s.resize(320,600);let max=0,secondary=0;for(let i=1;i<270;i++){const t=i/30;s.load(t,1/30,1,{strength:1});for(const el of p.querySelectorAll('.pd-fx-windletter')){const n=Math.abs(new DOMMatrix(el.style.transform).m42);if(el.closest('#pd-local'))max=Math.max(max,n);else secondary=Math.max(secondary,n);}}const low=s.load(3,1/30,1,{strength:.3}).pressure,high=s.load(3,1/30,1,{strength:1}).pressure;window.__surge=s;return {max,secondary,low,high,flags:Array.from(p.querySelectorAll('#pd-local .pd-fx-windletter')).filter(el=>el.textContent==='🇯🇵').length,frontLow:CardTsunamiSurge.front(1),frontHigh:CardTsunamiSurge.front(4.8)};});
 expect(samples.flags).toBe(1);expect(samples.max).toBeGreaterThan(8);expect(samples.secondary).toBeGreaterThan(.5);expect(samples.high).toBeGreaterThan(samples.low);expect(samples.frontHigh-samples.frontLow).toBeGreaterThan(.5);expect(await page.locator('#painel-direito').innerText()).toBe(original);await expect(page.locator('.stat-card-value b')).toHaveCSS('color','rgb(240, 210, 120)');await page.locator('#control').click();await page.evaluate(()=>{__surge.destroy();restoreWindLetters();});await expect(page.locator('.pd-tsunami-surface,.pd-weather-material,.pd-fx-windletter')).toHaveCount(0);expect(await page.locator('#painel-direito').innerText()).toBe(original);
});
