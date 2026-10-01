import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
let source=await readFile(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8');source=source.replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../../'+p.slice(2),import.meta.url).href));
const mod=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {renderDailySummaryPng,decodePng,summaryCountry,getDailySummaryFonts,summaryCardWrap,textFontWidthProp};').toString('base64'));
const rows=[['74 km S of Yonaguni, Japan',5.6,'02:00',11],['94 km SW of Tamarindo, Costa Rica',5.6,'18:55',8],['Balleny Islands region',5.4,'01:48',10],['Balleny Islands region',5.2,'04:07',10],['7 km ESE of Baghlān, Afghanistan',5.2,'22:29',50]].map(([place,mag,time,depth])=>({place,mag,time:Date.parse('2026-09-30T'+time+':00-03:00'),depth,source:'US'}));
const events=[...rows,...Array.from({length:214},(_,i)=>({...rows[0],mag:i<4?5:i<16?4:2}))];
const normal=await mod.renderDailySummaryPng({day:'2026-09-30',events});assert.equal(normal.total,219);assert.equal(normal.top.length,5);const png=await mod.decodePng(normal.png);assert.equal(png.width,800);assert(png.height>1100&&png.height<1600);
if(process.env.SUMMARY_PREVIEW_PATH)await writeFile(process.env.SUMMARY_PREVIEW_PATH,normal.png);
for(const rows of [[],[{...events[0],place:'A very long earthquake location with an extraordinarilylongunbrokentokenandadditionalregionalinformationwhichmustwrapsafely',depth:null}]]){const result=await mod.renderDailySummaryPng({day:'2026-09-30',events:rows});assert.equal(result.total,rows.length);assert.equal((await mod.decodePng(result.png)).width,800);}
assert.equal(mod.summaryCountry('Balleny Islands region').code,'AQ');assert.equal(mod.summaryCountry('74 km S of Yonaguni, Japan').code,'JP');assert.equal(mod.summaryCountry('8 km ESE of Valle Vista, CA').code,'US');assert.equal(mod.summaryCountry('central Atlantic Ocean').code,null);
const fonts=await mod.getDailySummaryFonts();for(const line of mod.summaryCardWrap(fonts.title,'extraordinarilylongunbrokentokenxxxxxxxxxxxxxx',410))assert(mod.textFontWidthProp(fonts.title,line,0)<=410);
assert.equal(events.filter(e=>e.mag>=5&&e.mag<6).length,9);
for(const code of ['JP','CR','AF','US']){const flag=fonts.flags.map[code];assert(flag);assert(flag[1]>=40&&flag[2]>=25);}
for(const text of ['M6+: 99999','M5-5,9: 99999','M4-4,9: 99999','Outros: 99999'])assert(mod.textFontWidthProp(fonts.country,text,0)<178);
assert(fonts.magnitude.glyphs[',']);assert(fonts.title.glyphs['ñ']);
console.log('PASS: real PNG with Inter, 5 cards, 219 records, flags and ocean attribution, empty/long summaries and safe wrapping');
