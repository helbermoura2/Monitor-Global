/* Official European warnings without invented coordinates. Keep unlocated warnings in a list. */
(function(){
 const countries=[['germany','Alemanha'],['france','França'],['spain','Espanha'],['portugal','Portugal'],['italy','Itália'],['united-kingdom','Reino Unido']];
 const state=new Map();const CAP='urn:oasis:names:tc:emergency:cap:1.2';
 function parse(xml,country,now=Date.now()){
  const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw Error('XML inválido');
  return [...doc.getElementsByTagNameNS('*','entry')].map(e=>{
   const tag=n=>e.getElementsByTagNameNS(CAP,n)[0]?.textContent?.trim()||'';
   const expires=Date.parse(tag('expires'));const onset=Date.parse(tag('onset'));const event=tag('event');
   if(tag('status')!=='Actual'||tag('message_type')==='Cancel'||!(expires>now)||!/(rain|flood|wind|thunder|storm)/i.test(event))return null;
   const link=[...e.getElementsByTagNameNS('*','link')].find(x=>x.getAttribute('hreflang')==='en')?.getAttribute('href');
   return {id:e.getElementsByTagNameNS('*','id')[0]?.textContent,country,area:tag('areaDesc'),event,severity:tag('severity'),onset,expires,link:link?.startsWith('https://meteoalarm.org')?link:'https://meteoalarm.org/'};
  }).filter(Boolean);
 }
 function render(){
  const parent=document.getElementById('weather-more');if(!parent)return;
  let host=document.getElementById('meteoalarm-warnings');if(!host){host=document.createElement('section');host.id='meteoalarm-warnings';parent.append(host);}host.replaceChildren();
  const title=document.createElement('h3');title.textContent='Avisos oficiais · Meteoalarm';host.append(title);
  const note=document.createElement('p');note.textContent='Cobertura inicial: Alemanha, França, Espanha, Portugal, Itália e Reino Unido. Avisos regionais, sem coordenadas verificadas, ficam nesta lista. Não são ocorrências confirmadas.';host.append(note);
  let count=0;
  countries.forEach(([code,country])=>{
   const s=state.get(code);const details=document.createElement('details'),summary=document.createElement('summary');
   const rows=(s?.rows||[]).filter(x=>x.expires>Date.now());count+=rows.length;summary.textContent=country+' · '+(!s?'Aguardando consulta':s.error?'Consulta indisponível':rows.length+' aviso(s)');details.append(summary);
   rows.slice(0,12).forEach(x=>{const p=document.createElement('p'),a=document.createElement('a');a.href=x.link;a.target='_blank';a.rel='noopener';a.textContent=x.area+' · '+x.event+' · '+x.severity;p.append(a);const small=document.createElement('small');small.textContent=' · '+(x.onset>Date.now()?'Início '+new Date(x.onset).toLocaleString('pt-BR')+' · ':'')+'Válido até '+new Date(x.expires).toLocaleString('pt-BR');p.append(small);details.append(p);});
   if(rows.length>12){const a=document.createElement('a');a.href='https://meteoalarm.org/';a.target='_blank';a.rel='noopener';a.textContent='Ver todos os '+rows.length+' avisos na fonte';details.append(a);}host.append(details);
  });
  const credit=document.createElement('small');credit.textContent='Meteoalarm / serviços meteorológicos nacionais · CC BY 4.0 · consulta a cada 10 min';host.append(credit);
 }
 async function load(){
  // Two requests at a time; keep failure visible, do not turn missing data into "no alerts".
  for(let i=0;i<countries.length;i+=2)await Promise.allSettled(countries.slice(i,i+2).map(async([code,country])=>{
   try{const r=await fetchWithCorsFallback('https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-'+code,15000);if(!r.ok)throw Error('HTTP '+r.status);state.set(code,{rows:parse(await r.text(),country),consultedAt:Date.now()});}
   catch(e){state.set(code,{rows:[],error:e.message});}render();
  }));
 }
 document.addEventListener('DOMContentLoaded',()=>{render();setTimeout(load,30000);setInterval(load,600000);setInterval(render,60000);});
 window.MeteoalarmWarnings={parse,load};
})();
