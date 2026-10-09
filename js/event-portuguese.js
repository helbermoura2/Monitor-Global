/* Presentation only: preserve original reports, IDs and numeric data. Shared by browser and Worker. */
(function(root){
'use strict';
const placeMemo=new Map(),localMemo=new Map();
function remember(map,key,value){if(map.size>=512)map.delete(map.keys().next().value);map.set(key,value);return value;}
const directions={N:'norte',NNE:'norte-nordeste',NE:'nordeste',ENE:'leste-nordeste',E:'leste',ESE:'leste-sudeste',SE:'sudeste',SSE:'sul-sudeste',S:'sul',SSW:'sul-sudoeste',SW:'sudoeste',WSW:'oeste-sudoeste',W:'oeste',WNW:'oeste-noroeste',NW:'noroeste',NNW:'norte-noroeste'};
const countries={};
try{const en=new Intl.DisplayNames(['en'],{type:'region'}),pt=new Intl.DisplayNames(['pt-BR'],{type:'region'});for(const a of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')for(const b of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){const code=a+b,name=en.of(code);if(name&&name!==code)countries[name]=pt.of(code);}}catch{}
Object.assign(countries,{'Panama':'Panamá','Brazil':'Brasil','Japan':'Japão','Mexico':'México','Peru':'Peru','Turkey':'Turquia','East Timor':'Timor-Leste','Ivory Coast':'Costa do Marfim','Russia':'Rússia','South Korea':'Coreia do Sul','North Korea':'Coreia do Norte','USA':'Estados Unidos','Hawaii':'Havaí','Alaska':'Alasca','California':'Califórnia','Honshu':'Honshu','Caribbean':'Caribe','Mediterranean':'Mediterrâneo','Central America':'América Central','South America':'América do Sul','North America':'América do Norte','Pacific Ocean':'Oceano Pacífico','Atlantic Ocean':'Oceano Atlântico','Indian Ocean':'Oceano Índico','Dodecanese Islands':'Ilhas do Dodecaneso','Balleny Islands':'Ilhas Balleny','Kuril Islands':'Ilhas Curilas','Aegean Sea':'Mar Egeu','South China Sea':'Mar do Sul da China','Java Sea':'Mar de Java','Savu Sea':'Mar de Savu','Banda Sea':'Mar de Banda','South Sandwich Islands':'Ilhas Sandwich do Sul','South Shetland Islands':'Ilhas Shetland do Sul','Reykjanes Ridge':'Dorsal de Reykjanes','Southeast Indian Ridge':'Dorsal Sudeste do Índico','East Pacific Rise':'Elevação do Pacífico Leste','Near East Coast of Honshu':'Perto da costa leste de Honshu'});
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const countryRules=Object.entries(countries).filter(([a,b])=>a!==b).sort((a,b)=>b[0].length-a[0].length).map(([a,b])=>[new RegExp('\\b'+escape(a)+'\\b','gi'),b]);
function place(value){
 const original=String(value??'');if(placeMemo.has(original))return placeMemo.get(original);
 let s=original;
 s=s.replace(/\b(\d+(?:[.,]\d+)?)\s*km\s+(?:al|a)\s+(NNE|ENE|ESE|SSE|SSO|OSO|ONO|NNO|NE|SE|SO|NO|N|E|S|O)\s+de\s+/gi,(_,n,d)=>Math.round(Number(n.replace(',','.')))+' km a '+directions[d.toUpperCase().replace(/O/g,'W')]+' de ');
 s=s.replace(/\b(?:al|a) (norte|sur|este|oeste) de\b/gi,(_,d)=>'a '+({norte:'norte',sur:'sul',este:'leste',oeste:'oeste'})[d.toLowerCase()]+' de');
 s=s.replace(/\b(\d+(?:[.,]\d+)?)\s*km\s+(NNE|ENE|ESE|SSE|SSW|WSW|WNW|NNW|NE|SE|SW|NW|N|E|S|W)\s+(?:of|de)\s+/gi,(_,n,d)=>Math.round(Number(n.replace(',','.')))+' km a '+directions[d.toUpperCase()]+' de ');
 const rules=[[/\bnear ([NSEW])\.?([NSEW])?\.? coast of\b/gi,(_,a,b)=>'perto da costa '+directions[(a+(b||'')).toUpperCase()]+' de'],[/\bnear the (east|west|north|south) coast of\b/gi,'perto da costa $1 de'],[/\bnear (east|west|north|south) coast of\b/gi,'perto da costa $1 de'],[/\boff the (east|west|north|south) coast of\b/gi,'ao largo da costa $1 de'],[/\boffshore\b/gi,'ao largo da costa de'],[/\boff the coast of\b/gi,'ao largo da costa de'],[/\bnear the coast of\b/gi,'perto da costa de'],[/\bnear coast of\b/gi,'perto da costa de'],[/\bborder region\b/gi,'região de fronteira'],[/\bislands region\b/gi,'região das ilhas'],[/\bisland region\b/gi,'região da ilha'],[/\bmid[- ]atlantic ridge\b/gi,'dorsal mesoatlântica'],[/\b(south|north|east|west) of\b/gi,'a $1 de'],[/\b(southern|northern|eastern|western)\b/gi,'$1'],[/\bnear the\b/gi,'perto de'],[/\bnear\b/gi,'perto de'],[/\bcoast of\b/gi,'costa de'],[/\bregion\b/gi,'região']];
 for(const [re,to] of rules)s=s.replace(re,to);
 // Geographic descriptors, never arbitrary city-name fragments.
 s=s.replace(/\b(a |costa )(south|north|east|west)\b/gi,(_,prefix,w)=>prefix+({south:'sul',north:'norte',east:'leste',west:'oeste'})[w.toLowerCase()]);
 s=s.replace(/^(southern|northern|eastern|western)\s+/i,w=>({southern:'Sul de ',northern:'Norte de ',eastern:'Leste de ',western:'Oeste de '})[w.trim().toLowerCase()]);
 for(const [re,to] of countryRules)s=s.replace(re,to);
 return remember(placeMemo,original,s.trim());
}
// Only format presentation values; source numbers and identifiers stay numeric.
const numberFormats=new Map();
function number(value,digits=0){
 if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return '—';
 digits=Math.max(0,Math.min(3,digits));
 try{if(!numberFormats.has(digits))numberFormats.set(digits,new Intl.NumberFormat('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits}));return numberFormats.get(digits).format(Number(value));}
 catch{return Number(value).toFixed(digits).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
}
function revision(item){
 if(!item?._deltaTxt)return '';
 return local(item._deltaTxt).replace(/\bM(-?\d+(?:[.,]\d+)?)\b/g,(_,v)=>'M'+number(Number(v.replace(',','.')),1))
  .replace(/(?<![\d.])(\d+)\.(\d{1,2})(?![\d.])/g,'$1,$2');
}
// Spoken text uses Portuguese names and units on both cloud and device voices.
function speech(value){return local(value).normalize('NFC')
 .replace(/\b(\d+)\.(\d+)\b/g,'$1 vírgula $2')
 .replace(/\bkm\b/gi,'quilômetros');}
const phrases={
 'New South Wales':'Nova Gales do Sul','Western Australia':'Austrália Ocidental','South Australia':'Austrália Meridional','Northern Territory':'Território do Norte','Queensland':'Queensland','Tasmania':'Tasmânia','Bureau of Meteorology':'Serviço de Meteorologia','Environment and Climate Change Canada':'Meio Ambiente e Mudanças Climáticas do Canadá','Environment Canada':'Meio Ambiente do Canadá','MSC Open Data':'Dados abertos do Serviço Meteorológico do Canadá',
 'Special Weather Statement':'Comunicado meteorológico especial','Winter Storm Warning':'Alerta de tempestade de inverno','Winter Storm Watch':'Vigilância de tempestade de inverno','Winter Weather Advisory':'Aviso de tempo invernal','Heat Advisory':'Aviso de calor','Extreme Heat Warning':'Alerta de calor extremo','Excessive Heat Warning':'Alerta de calor excessivo','Dense Fog Advisory':'Aviso de nevoeiro denso','Dust Storm Warning':'Alerta de tempestade de poeira','Blizzard Warning':'Alerta de nevasca','High Surf Advisory':'Aviso de ondas fortes','Storm Surge Warning':'Alerta de inundação por maré de tempestade','Storm Surge Watch':'Vigilância de inundação por maré de tempestade','Red Flag Warning':'Alerta de condições favoráveis a incêndios','Fire Weather Watch':'Vigilância de condições favoráveis a incêndios','Gale Warning':'Alerta de vendaval','Storm Warning':'Alerta de tempestade','Small Craft Advisory':'Aviso para pequenas embarcações',
 'Tsunami Information Statement':'Boletim informativo de tsunami','Tsunami Warning':'Alerta de tsunami','Tsunami Advisory':'Aviso de tsunami','Tsunami Watch':'Vigilância de tsunami',
 'Severe Thunderstorm Warning':'Alerta de tempestade severa','Severe Thunderstorm Watch':'Vigilância de tempestade severa','Flash Flood Warning':'Alerta de enxurrada','Flash Flood Watch':'Vigilância de enxurrada','Coastal Flood Warning':'Alerta de inundação costeira','Flood Warning':'Alerta de enchente','Flood Watch':'Vigilância de enchente','High Wind Warning':'Alerta de vento forte','Wind Advisory':'Aviso de vento','Tornado Warning':'Alerta de tornado','Tornado Watch':'Vigilância de tornado',
 'Super Typhoon':'Supertufão','Severe Tropical Storm':'Tempestade tropical severa','Tropical Depression':'Depressão tropical','Tropical Storm':'Tempestade tropical','Tropical Cyclone':'Ciclone tropical','Post-Tropical Cyclone':'Ciclone pós-tropical','Hurricane':'Furacão','Typhoon':'Tufão','Cyclone':'Ciclone',
 'Volcano':'Vulcão','Volcanic':'Vulcânico','Air Quality':'Qualidade do ar','Tsunami threat':'Ameaça de tsunami',
 'Volcanic Ash Advisory':'Aviso de cinzas vulcânicas','Volcano Hazards Program':'Programa de Riscos Vulcânicos','Hawaiian Volcano Observatory':'Observatório Vulcanológico do Havaí','Alaska Volcano Observatory':'Observatório Vulcanológico do Alasca','Cascades Volcano Observatory':'Observatório Vulcanológico das Cascatas','Volcanic activity':'Atividade vulcânica','Ash plume':'Pluma de cinzas','Ash cloud':'Nuvem de cinzas','Ash emissions':'Emissões de cinzas','Lava flow':'Fluxo de lava','Eruption ongoing':'Erupção em andamento','Ongoing eruption':'Erupção em andamento','Eruption continues':'A erupção continua','No eruption':'Sem erupção',
 'Low humidity':'Baixa umidade','Heavy rain':'Chuva intensa','Strong winds':'Ventos fortes','Wildfire':'Incêndio florestal','Wildfires':'Incêndios florestais','Fire':'Incêndio','Flood':'Enchente',
 'Green':'Verde','Yellow':'Amarelo','Orange':'Laranja','Red':'Vermelho','Extreme':'Extrema','Severe':'Severa','Moderate':'Moderada','Minor':'Leve','Unknown':'Não informado','Likely':'Provável','Observed':'Observado','Possible':'Possível','Unlikely':'Improvável','Immediate':'Imediata','Expected':'Prevista','Future':'Futura','Past':'Encerrada','Warning':'Alerta','Advisory':'Aviso','Watch':'Vigilância','Unassigned':'Não atribuído','Normal':'Normal','Active':'Ativo','Dormant':'Dormente','Extinct':'Extinto','Erupting':'Em erupção','Unrest':'Agitação vulcânica','Elevated':'Elevado',
 'January':'janeiro','February':'fevereiro','March':'março','April':'abril','May':'maio','June':'junho','July':'julho','August':'agosto','September':'setembro','October':'outubro','November':'novembro','December':'dezembro',
 'Replay':'Reprodução','Story':'Imagem','Stories':'Imagens','Live':'Ao vivo','Source':'Fonte','Update':'Atualização','Status':'Situação','N/A':'Não informado','Information Statement':'Boletim informativo','Information':'Informativo','No threat':'Sem ameaça','Cancellation':'Cancelamento','Cancelled':'Cancelado','Critical':'Crítico','Latitude':'Latitude','Longitude':'Longitude'
};
const phraseRules=Object.entries(phrases).sort((a,b)=>b[0].length-a[0].length).map(([a,b])=>[new RegExp('(?<![\\p{L}])'+escape(a)+'(?![\\p{L}])','giu'),b]);
const cache=new Map(),inflight=new Map(),retryAfter=new Map();
function local(value){const original=String(value??'');if(localMemo.has(original))return localMemo.get(original);let s=original;for(const [re,to] of phraseRules)s=s.replace(re,to);return remember(localMemo,original,place(s));}
function foreign(value){return /\b(?:the|with|without|issued|until|from|between|along|across|hazardous|possible|waves|earthquake|warning|watch|advisory|eruption|eruptive|erupting|ash|plume|lava lake|action|needed|emission|report|unrest|reported|detected|continues|occupies|crater|vents|depth|intensity|magnitude|estimated|statement|affected|flooding|damaging|winds|thunderstorms|rainfall|residents|evacuate|remain|located|miles|above|below|this|these|that|there|been|will|would|may|was|were|are|not|and|but|sismo de magnitud|profundidad|fuerte|peligro|lluvias|sequia|nord|ouest|est de|sud de)\b/i.test(String(value||''));}
function text(value){const s=String(value??'');if(cache.has(s))return cache.get(s);const translated=local(s);return foreign(translated)?'Tradução do boletim em andamento. Consulte a fonte oficial.':translated;}
const fields=['detail','warningDescription','warningInstruction','bulletinSummary','eruptionStatus','vulcanicActivity','activityStatus','ashStatus','ashHeight','vonaRemarks','vonaMovement','vonaDuration','locationNote','descOnly','observatory'];
function view(item){if(!item)return item;const next={...item,_translatedAutomatically:fields.some(k=>typeof item[k]==='string'&&cache.has(item[k]))};for(const k of ['place','pais','basin','displayLabel','severityLabel','warningLevel','usgsAlertLevel','warningEvent','event','cycloneLabel','source'])if(typeof next[k]==='string')next[k]=local(next[k]);for(const k of fields)if(typeof next[k]==='string')next[k]=text(next[k]);if(next.movementInfo)next.movementInfo={...next.movementInfo,compass:directions[next.movementInfo.compass]||local(next.movementInfo.compass||'')};return next;}
async function ensure(item){
 if(!root.document||!item)return false;
 const values=[...new Set(fields.map(k=>item[k]).filter(s=>typeof s==='string'&&s.trim()&&foreign(local(s))&&!cache.has(s)&&Date.now()>=(retryAfter.get(s)||0)))];
 if(!values.length)return false;
 const key=JSON.stringify(values);if(inflight.has(key))return inflight.get(key);
 const promise=(async()=>{let changed=false;for(let i=0;i<values.length;i+=6){const batch=values.slice(i,i+6);batch.forEach(s=>retryAfter.set(s,Date.now()+300000));while(retryAfter.size>512)retryAfter.delete(retryAfter.keys().next().value);try{const base=typeof workerBaseUrl==='function'?workerBaseUrl():'';if(!base)return changed;const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);try{const r=await fetch(base+'/translate-pt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texts:batch}),signal:c.signal});if(!r.ok)continue;const d=await r.json();d.translations?.forEach((t,n)=>{if(t&&batch[n]){cache.set(batch[n],t);retryAfter.delete(batch[n]);changed=true;}else if(batch[n])retryAfter.set(batch[n],Date.now()+300000);});while(cache.size>512)cache.delete(cache.keys().next().value);}finally{clearTimeout(timer);}}catch(e){console.warn('[tradução do boletim]',e.message);}}return changed;})().finally(()=>inflight.delete(key));
 inflight.set(key,promise);return promise;
}
root.EventPortuguese={place,local,text,speech,number,revision,view,ensure,foreign,directions,kinds:{earthquake:'Sismo',hurricane:'Ciclone',storm:'Tempestade',volcano:'Vulcão',fire:'Incêndio',flood:'Enchente',wind:'Vento',tornado:'Tornado',tsunami:'Tsunami',civil:'Alerta da Defesa Civil'}};
})(globalThis);
