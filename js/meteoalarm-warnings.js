/* Public Meteoalarm Atom feeds. Unlocated notices remain in Meteorologia. */
(function(){
 const countries=[['germany','Alemanha','🇩🇪'],['france','França','🇫🇷'],['spain','Espanha','🇪🇸'],['portugal','Portugal','🇵🇹'],['italy','Itália','🇮🇹'],['united-kingdom','Reino Unido','🇬🇧'],['austria','Áustria','🇦🇹'],['belgium','Bélgica','🇧🇪'],['netherlands','Países Baixos','🇳🇱'],['switzerland','Suíça','🇨🇭'],['poland','Polônia','🇵🇱'],['norway','Noruega','🇳🇴'],['sweden','Suécia','🇸🇪'],['finland','Finlândia','🇫🇮'],['denmark','Dinamarca','🇩🇰'],['ireland','Irlanda','🇮🇪']];
 const CAP='urn:oasis:names:tc:emergency:cap:1.2';let loading=false;
 function parse(xml,country,now=Date.now()){
  const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror')||doc.documentElement.localName!=='feed'||doc.documentElement.namespaceURI!=='http://www.w3.org/2005/Atom')throw Error('Feed Meteoalarm inválido');
  const unique=new Map(),cancelled=new Map(),cancelledReferences=new Set();
  for(const e of doc.getElementsByTagNameNS('*','entry')){
   const tag=n=>e.getElementsByTagNameNS(CAP,n)[0]?.textContent?.trim()||'',expires=Date.parse(tag('expires')),onset=Date.parse(tag('onset')),event=tag('event'),area=tag('areaDesc'),time=Date.parse(tag('sent')),type=HazardEvidence.warningType(event);
   if(tag('status')!=='Actual'||tag('scope')==='Private'||time>now+300000||!type)continue;
   const code=[...e.getElementsByTagNameNS(CAP,'geocode')].map(x=>x.textContent.replace(/\s+/g,' ').trim()).join('|')||area;
   const id='meteoalarm-weather-'+country+'-'+code+'-'+event+'-'+(Number.isFinite(onset)?onset:'');
   if((tag('message_type')||tag('msgType'))==='Cancel'){cancelled.set(id,Number.isFinite(time)?time:Infinity);tag('references').split(/\s+/).forEach(x=>{const ref=x.split(',')[1];if(ref)cancelledReferences.add(ref);});continue;}
   if(!(expires>now))continue;
   const polygon=tag('polygon'),pairs=polygon?polygon.split(/\s+/).map(x=>x.split(',').map(Number)):[];
   const coords=pairs.length>=3?HazardEvidence.polygonPoint({type:'Polygon',coordinates:[pairs.map(([lat,lon])=>[lon,lat])]}):null;
   const candidate=[...e.getElementsByTagNameNS('*','link')].find(x=>x.getAttribute('hreflang')==='en')?.getAttribute('href'),link=OfficialWeatherAlerts.validLink(candidate,['meteoalarm.org','www.meteoalarm.org'])||'https://meteoalarm.org/';
   const row={id,sourceIdentifier:tag('identifier'),country,area,event,severity:tag('severity'),severityLabel:HazardEvidence.severityLabel(tag('severity')),onset,expires,expiresAt:expires,time,type,place:area+' — '+country,source:'Meteoalarm / '+country,bandeira:countries.find(x=>x[1]===country)?.[2],hazardNature:'warning',warningEvent:event,warningLevel:'Aviso',detail:event+' · '+area,link,...(coords?{coords}:{}),locationNote:coords?'Marcador representativo do polígono oficial.':'Aviso regional sem coordenadas verificadas; consulte a área descrita na fonte.'};
   if(!unique.has(id)||(row.time||0)>(unique.get(id).time||0))unique.set(id,row);
  }return [...unique.values()].filter(x=>!cancelledReferences.has(x.sourceIdentifier)&&(!cancelled.has(x.id)||x.time>cancelled.get(x.id)));
 }
 async function load(){
  if(loading)return;loading=true;
  try{for(let i=0;i<countries.length;i+=2)await Promise.allSettled(countries.slice(i,i+2).map(async([code,country])=>{
   const label='Meteoalarm '+country;
   try{const r=await fetchWithCorsFallback('https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-'+code,15000);if(!r.ok)throw Error('HTTP '+r.status);OfficialWeatherAlerts.set('meteoalarm-'+code,label,parse(await r.text(),country),{credit:'Meteoalarm / serviço meteorológico nacional · CC BY 4.0'});}
   catch(e){OfficialWeatherAlerts.set('meteoalarm-'+code,label,[],{error:e.message});}
  }));}finally{loading=false;}
 }
 document.addEventListener('DOMContentLoaded',()=>{PeriodicScheduler.every('meteoalarm',load,30000,600000);});
 window.MeteoalarmWarnings={parse,load,countries};
})();
