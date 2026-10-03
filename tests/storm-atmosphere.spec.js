const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');

// Sample actual pixels, independently of the card's foreground rain and bolts.
// A storm must remain a moving, shaded cloud deck when no discharge is active;
// a discharge must illuminate that deck only while lightning is enabled.
for(const mobile of [false,true])test('nuvens de tempestade têm relevo, advecção e luz interna '+(mobile?'celular':'computador'),async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.text().includes('[CardCinema]'))errors.push(m.text());});
 await page.setContent('<body></body>');
 await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../js/card-cinema-film.js'),'utf8')});
 const result=await page.evaluate(mobile=>{
  function render(travel,flash,lightning){
   const cfg={type:'storm',strength:.92,windTravel:travel,gust:.75,flash};
   const film=CardCinemaFilm.create(cfg,mobile);if(!film)throw Error('WebGL unavailable');
   film.resize(360,740);film.draw(10,cfg,lightning,false);
   const c=document.createElement('canvas');c.width=film.canvas.width;c.height=film.canvas.height;
   const ctx=c.getContext('2d');ctx.drawImage(film.canvas,0,0);
   const pixels=Array.from(ctx.getImageData(0,0,c.width,c.height).data);
   film.destroy();return {pixels,width:c.width,height:c.height};
  }
  const base=render(1,0,true),moved=render(5,0,true);
  const disabled=render(1,.8,false),illuminated=render(1,.8,true);
  const luminance=p=>p.filter((_,i)=>i%4===0).map((r,i)=>r*.2126+p[i*4+1]*.7152+p[i*4+2]*.0722);
  const a=luminance(base.pixels),b=luminance(moved.pixels),c=luminance(illuminated.pixels);
  const mean=values=>values.reduce((sum,v)=>sum+v,0)/values.length;
  const sorted=[...a].sort((x,y)=>x-y);
  return {
   width:base.width,height:base.height,mean:mean(a),
   relief:sorted[Math.floor(sorted.length*.95)]-sorted[Math.floor(sorted.length*.05)],
   movement:mean(a.map((v,i)=>Math.abs(v-b[i]))),
   flashGain:mean(c)-mean(a),
   disabledDifference:mean(base.pixels.map((v,i)=>Math.abs(v-disabled.pixels[i]))),
   opaque:mean(base.pixels.filter((_,i)=>i%4===3)),
   chroma:mean(base.pixels.filter((_,i)=>i%4===0).map((r,i)=>Math.max(r,base.pixels[i*4+1],base.pixels[i*4+2])-Math.min(r,base.pixels[i*4+1],base.pixels[i*4+2])))
  };
 },mobile);
 expect(result.width).toBeLessThanOrEqual(mobile?176:240);
 expect(result.height).toBeLessThanOrEqual(mobile?360:480);
 expect(result.mean).toBeGreaterThan(3);expect(result.mean).toBeLessThan(80);
 expect(result.relief).toBeGreaterThan(12);
 expect(result.movement).toBeGreaterThan(3);
 expect(result.flashGain).toBeGreaterThan(10);
 expect(result.disabledDifference).toBe(0);
 expect(result.opaque).toBeGreaterThan(190);
 expect(result.chroma).toBeLessThan(18);
 expect(errors).toEqual([]);
});
