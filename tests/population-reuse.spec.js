const {test,expect}=require('@playwright/test');
test('population shares concurrent tabs, BroadcastChannel peers, revisions and terminal negatives',async({context})=>{
 await context.route('**/population-fixture',r=>r.fulfill({contentType:'text/html',body:'<section id="pd-alcance-section"><div id="pd-grid-exposure"></div></section>'}));let calls=0;
 await context.route('https://black-sky-9ba0.terrestre.workers.dev/population-exposure**',async r=>{calls++;const unsupported=new URL(r.request().url()).searchParams.get('depth')==='100';await new Promise(resolve=>setTimeout(resolve,60));await r.fulfill({headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'X-Monitor-Population-Cache-Until','X-Monitor-Population-Cache-Until':String(Date.now()+(unsupported?900000:7*86400000))},body:JSON.stringify(unsupported?{status:'unsupported',note:'Sem grade; localidades continuam disponíveis.'}:{status:'available',method:'worldpop',year:2020,ranges:[{population:100},{population:20},{population:2}]})});});
 async function tab(disk=true){const p=await context.newPage();await p.goto('/population-fixture');await p.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>false});window.WORKER_PROXY=()=> 'https://black-sky-9ba0.terrestre.workers.dev/';window.formatarPessoasHeadline=String;window.eventoSelecionadoId='q';});for(const name of [...(disk?['cross-tab-public-requests']:[]),'browser-request-budget','fetch-timeout','population-exposure'])await p.addScriptTag({url:'/js/'+name+'.js'});return p;}
 const a=await tab(),b=await tab(),item={id:'q',type:'earthquake',coords:[-45,-22],mag:4,depth:10,time:Date.now()-13*3600000};
 const image=(p,x)=>p.evaluate(x=>obterExposicaoPopulacionalImagem(x),x);
 const results=await Promise.all([image(a,item),image(b,item)]);expect(results.map(x=>x.ranges[0].population)).toEqual([100,100]);expect(calls).toBe(1);
 await a.evaluate(x=>{carregarExposicaoPopulacional(x);cancelarExposicaoPopulacional();carregarExposicaoPopulacional(x);},item);expect(calls).toBe(1);
 // This peer has no disk sharing helper: only BroadcastChannel can supply it.
 const c=await tab(false);expect(await image(c,item)).toMatchObject({method:'worldpop'});expect(calls).toBe(1);
 await image(b,{...item,mag:4.2});expect(calls).toBe(2);
 const negative={...item,depth:100};expect(await image(a,negative)).toBeNull();expect(await image(c,negative)).toBeNull();expect(calls).toBe(3);
 await c.evaluate(x=>carregarExposicaoPopulacional(x),negative);await expect(c.locator('#pd-grid-exposure')).toContainText('Sem grade');expect(await c.evaluate(x=>exposicaoPopulacionalDoEvento(x),negative)).toBeNull();expect(calls).toBe(3);
 await Promise.all([a.close(),b.close(),c.close()]);
});
