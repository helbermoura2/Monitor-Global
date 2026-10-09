// === confianca-fontes.js — Textos de vulcão + score de confiança/consolidação de fontes (linhas originais 3317-3522 do core-app.js) ===

function traduzirTextoVulcanico(valor){
  if(globalThis.EventPortuguese)return globalThis.EventPortuguese.text(valor);
  if(valor==null || valor==='') return valor;
  let s=String(valor);
  const repl=[
    [/no eruptive activity at surface but significant volcanic unrest/gi,'sem atividade eruptiva na superfície, mas com perturbação vulcânica significativa'],
    [/frequent explosions and ash emissions continue/gi,'explosões frequentes e emissões de cinzas continuam'],
    [/activity remains at comparably low levels/gi,'a atividade permanece em níveis relativamente baixos'],
    [/remains at alert level/gi,'permanece no nível de alerta'],
    [/after brief ash emission/gi,'após breve emissão de cinzas'],
    [/new vents in /gi,'novas bocas eruptivas em '],
    [/indicate possible change in eruption/gi,'indicam possível mudança na erupção'],
    [/possible change in eruption/gi,'possível mudança na erupção'],
    [/eruption continues/gi,'a erupção continua'],
    [/eruption ongoing/gi,'erupção em andamento'],
    [/ongoing eruption/gi,'erupção em andamento'],
    [/continuing activity/gi,'atividade contínua'],
    [/continued activity/gi,'atividade contínua'],
    [/significant volcanic unrest/gi,'perturbação vulcânica significativa'],
    [/volcanic unrest/gi,'perturbação vulcânica'],
    [/volcanic activity/gi,'atividade vulcânica'],
    [/eruptive activity/gi,'atividade eruptiva'],
    [/eruption/gi,'erupção'],
    [/eruptive/gi,'eruptivo'],
    [/explosions/gi,'explosões'],
    [/explosion/gi,'explosão'],
    [/ash emissions/gi,'emissões de cinzas'],
    [/ash emission/gi,'emissão de cinzas'],
    [/ash plume/gi,'pluma de cinzas'],
    [/ash cloud/gi,'nuvem de cinzas'],
    [/ash/gi,'cinzas'],
    [/emissions/gi,'emissões'],
    [/emission/gi,'emissão'],
    [/surface/gi,'superfície'],
    [/alert level/gi,'nível de alerta'],
    [/alert/gi,'alerta'],
    [/warning/gi,'aviso'],
    [/advisory/gi,'aviso'],
    [/watch/gi,'vigilância'],
    [/normal/gi,'normal'],
    [/aviation color code/gi,'código de cores da aviação'],
    [/aviation/gi,'aviação'],
    [/volcano/gi,'vulcão'],
    [/volcanic/gi,'vulcânico'],
    [/observatory/gi,'observatório'],
    [/elevated/gi,'elevado'],
    [/ongoing/gi,'em andamento'],
    [/detected/gi,'detectada'],
    [/reported/gi,'relatada'],
    [/continues/gi,'continua'],
    [/continue/gi,'continuam'],
    [/possible/gi,'possível'],
    [/significant/gi,'significativa'],
    [/frequent/gi,'frequentes'],
    [/brief/gi,'breve'],
    [/levels/gi,'níveis'],
    [/level/gi,'nível'],
    [/activity/gi,'atividade'],
    [/at surface/gi,'na superfície'],
    [/at low levels/gi,'em níveis baixos']
  ];
  for(const [re,to] of repl) s=s.replace(re,to);
  // Pequenos ajustes de frases que ficam naturais após as substituições acima.
  s=s.replace(/nível de alerta (\\d+)/gi,'nível de alerta $1');
  s=s.replace(/nível de alerta nível/gi,'nível de alerta');
  return s.replace(/\\s{2,}/g,' ').trim();
}
function traduzirStatusVulcao(v){
  if(v==null || v==='') return v;
  const raw=String(v).trim();
  const key=raw.toUpperCase();
  const map={
    NORMAL:'NORMAL', ADVISORY:'AVISO', WATCH:'VIGILÂNCIA', WARNING:'AVISO',
    ALERT:'ALERTA', ELEVATED:'ELEVADO', ONGOING:'EM ANDAMENTO',
    ERUPTING:'EM ERUPÇÃO', ERUPTION:'ERUPÇÃO', ACTIVE:'ATIVO',
    DORMANT:'DORMENTE', EXTINCT:'EXTINTO', UNREST:'PERTURBAÇÃO VULCÂNICA'
  };
  return map[key] || traduzirTextoVulcanico(raw);
}
function prepararTextoVulcao(item){
  if(!item || item.type!=='volcano') return item;
  const fields=['place','detail','eruptionStatus','vulcanicActivity','activityStatus','ashStatus','ashHeight','vonaRemarks','vonaMovement','vonaDuration'];
  fields.forEach(k=>{
    if(item[k]!=null && item[k]!=='') item[k]=(k==='eruptionStatus'||k==='usgsAlertLevel')?traduzirStatusVulcao(item[k]):traduzirTextoVulcanico(item[k]);
  });
  if(item.usgsAlertLevel) item.usgsAlertLevel=traduzirStatusVulcao(item.usgsAlertLevel);
  return item;
}

function normalizarNomeVulcao(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
function fonteEhOficial(src){return /ECCC|Bureau of Meteorology|NOAA|METEOALARM|GDACS|ANA|USGS|INMET|AFAD|JMA|NHC|NWS|PTWC|CEMADEN|CGE|DEFESA|BMKG|GEONET|USP|OSC-BOL|EMSC|GEOFON|IGP|FUNVISIS/i.test(String(src||''));}
function consolidarConfianca(item){
  if(!item)return{score:0,label:'SEM DADOS',cls:'low',sources:[],officialSources:[],reason:'Evento sem registro.',nature:'desconhecido'};
  const raw=[];
  (Array.isArray(item.sources)?item.sources:[]).forEach(x=>x&&raw.push(String(x)));
  if(item.source)raw.push(String(item.source));
  const sources=[...new Set(raw.map(x=>x.trim()).filter(Boolean))];
  let score=48,reasons=[];
  const official=sources.filter(fonteEhOficial);
  if(official.length){score+=18;reasons.push('fonte institucional')}
  if(sources.length>=2){score+=12;reasons.push('convergência entre fontes')}
  if(sources.length>=3)score+=7;
  if(item.sourceCount>=2)score+=8;
  if(item.divergentMagnitude){score-=8;reasons.push('divergência de magnitude')}
  if(item.strongMagnitudeDivergence)score-=8;
  if(/OPEN-?METEO|MODELO|NOWCAST/i.test(String(item.source||''))){score-=22;reasons.push('dado modelado')}
  if(item.type==='volcano'){
    if(item.usgsVona||item.usgsStatus){score+=14;reasons.push('monitoramento USGS')}
    if(item.gdacsAlertLevel){score+=6;reasons.push('nível GDACS')}
  }
  const age=Date.now()-(Number(item.time)||Date.now());
  if(age>6*3600000){score-=6;reasons.push('registro antigo')}
  if(age>24*3600000)score-=10;
  score=Math.max(0,Math.min(100,Math.round(score)));
  const label=score>=85?'MUITO ALTA':score>=70?'ALTA':score>=50?'MODERADA':'BAIXA';
  const cls=score>=70?'high':score>=50?'mid':'low';
  let nature='rede';
  if(/OPEN-?METEO|MODELO|NOWCAST/i.test(String(item.source||''))) nature='modelo';
  else if(official.length) nature='oficial';
  else if(sources.length>=2) nature='consolidada';
  return{score,label,cls,sources,officialSources:official,reason:reasons.slice(0,4).join(' · ')||'registro consistente',nature};
}
function legendaNaturezaDados(item){
  if(!item) return {fonte:'',estima:''};
  if(item.type==='earthquake' || (item.mag!=null && !item.type)){
    return {
      fonte: 'Magnitude, profundidade, horário e local vêm das agências sísmicas.',
      estima: 'MMI, quando calculada pelo app, energia em TNT, raio sentido e mecanismo focal estimado são estimativas. MMI/ShakeMap ou mecanismo fornecidos pela agência são dados da fonte.'
    };
  }
  if(item.type==='volcano'){
    return {
      fonte: 'Nível GDACS / VONA / USGS VHP, quando presentes, vêm dos produtos institucionais.',
      estima: 'Impacto local e lista de cidades podem incluir cálculo geográfico do app.'
    };
  }
  if(item.type==='hurricane'){
    return {
      fonte: 'Posição, vento e pressão seguem o produto da fonte (ex.: NHC/GDACS).',
      estima: 'Rótulos de severidade e distância até você são calculados no app.'
    };
  }
  if(item.hazardNature && window.HazardEvidence){
    const h=HazardEvidence.classify(item);return {fonte:h.label+' · '+h.note,estima:'Distância e marcador representativo são calculados no app.'};
  }
  if(item.type==='storm'||item.type==='wind'){
    const modelo=/OPEN-?METEO|MODELO|NOWCAST|WEATHERAPI/i.test(String(item.source||''));
    return {
      fonte: modelo ? 'Condição derivada de modelo meteorológico (não é aviso de defesa civil).' : 'Registro da fonte indicada no card.',
      estima: 'Distância e prioridade local são calculadas no app.'
    };
  }
  return {
    fonte: 'Campos principais seguem a fonte listada abaixo.',
    estima: 'Distância, prioridade e textos de impacto podem ser estimativa do app.'
  };
}
// Evidências observáveis; o score legado não é apresentado como probabilidade.
function evidenciasFontes(item){
  item=item||{};
  const raw=[...(Array.isArray(item.sources)?item.sources:[]),item.source,
    ...String(item.sourceSummary||'').split(/\s*[·,;|]\s*/),
    ...(Array.isArray(item.magnitudes)?item.magnitudes:[]).map(x=>x.source)];
  const sources=[], seen=new Set();
  raw.forEach(value=>{
    const name=String(value||'').trim().replace(/^USGS-RT$/i,'USGS');
    const key=name.toUpperCase();
    if(name&&!seen.has(key)){seen.add(key);sources.push(name);}
  });
  const reports=(Array.isArray(item.magnitudes)?item.magnitudes:[])
    .filter(x=>x.mag!==null&&x.mag!==undefined&&String(x.mag).trim()!==''&&Number.isFinite(Number(x.mag)))
    .map(x=>({source:String(x.source||'Fonte não identificada'),mag:Number(x.mag)}));
  const modeled=sources.some(x=>/OPEN-?METEO|WEATHERAPI|MODELO|NOWCAST/i.test(x));
  const institutional=sources.filter(fonteEhOficial);
  const origin=modeled?'Dados de modelo':institutional.length?'Fonte institucional':sources.length?'Fonte identificada':'Fonte não identificada';
  const hazard=window.HazardEvidence?.classify(item);
  const badges=[hazard?.nature?hazard.label:origin];
  if(sources.length>1) badges.push('Reportado por '+sources.length+' fontes');
  const quake=item.type==='earthquake'||(!item.type&&item.mag!=null);
  if(quake){
    if(item.isPreliminary) badges.push('Magnitude preliminar');
    const values=reports.map(x=>x.mag);
    if(values.length>1&&Math.max(...values)-Math.min(...values)>=0.099){
      badges.push('Magnitudes divergentes · M'+Math.min(...values).toFixed(1)+' a M'+Math.max(...values).toFixed(1));
    }
    const revision=String(item._deltaTxt||'').match(/M[\d.,]+\s*→\s*M[\d.,]+/);
    if(revision) badges.push('Magnitude revisada · '+revision[0]);
  }
  return {sources,reports,institutional,modeled,origin,badges};
}
function preencherEvidenciasFontes(box,item){
  const e=evidenciasFontes(item),leg=legendaNaturezaDados(item);
  box.replaceChildren();
  const add=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;box.appendChild(node);return node;};
  add('h3','source-evidence-title','Fontes e natureza dos dados');
  e.badges.forEach(label=>add('p','source-evidence-fact',label));
  add('p','source-evidence-text','Fontes: '+(e.sources.join(' · ')||'não identificadas'));
  e.reports.forEach(r=>add('p','source-evidence-report',r.source+' · M'+r.mag.toFixed(1)));
  if(e.sources.length>1) add('p','source-evidence-text','As fontes podem compartilhar dados. A contagem não representa confirmações independentes.');
  add('h4','source-evidence-label','Dados da fonte');
  add('p','source-evidence-text',leg.fonte);
  add('h4','source-evidence-label','Estimativas do app');
  add('p','source-evidence-text',leg.estima);
}
function renderConsolidacaoFonte(item){
  const box=document.getElementById('pd-source-trust');
  if(!box)return;
  preencherEvidenciasFontes(box,item);box.style.display='block';
}
function abrirEvidenciasFontes(item){
  let dialog=document.getElementById('source-evidence-dialog');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='source-evidence-dialog';
    dialog.setAttribute('aria-label','Fontes e natureza dos dados');
    const close=document.createElement('button');close.type='button';close.className='source-evidence-close';
    close.textContent='✕';close.setAttribute('aria-label','Fechar informações das fontes');
    close.onclick=()=>dialog.close();dialog.appendChild(close);
    const body=document.createElement('div');body.className='source-evidence-body';dialog.appendChild(body);
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
    document.body.appendChild(dialog);
  }
  preencherEvidenciasFontes(dialog.querySelector('.source-evidence-body'),item);
  if(!dialog.open)dialog.showModal();
}
function confiancaFonte(item){
  const e=evidenciasFontes(item),src=String(item&&item.source||'').toUpperCase();
  let nivel='rede',cls='conf-rede';
  // Preserva a classificação usada pelos filtros, inclusive condição atual do tempo.
  if(src==='RADAR'||/RAINVIEWER/.test(src)){nivel='radar';cls='conf-radar';}
  else if(item&&(item.type==='storm'||item.type==='wind')&&item.id!=='sp-storm-soon'&&/OPEN-?METEO|WEATHERAPI|MODELO LOCAL/i.test(src)){}
  else if(/OPEN-?METEO|MODELO|NOWCAST/i.test(src)){nivel='modelo';cls='conf-modelo';}
  else if(fonteEhOficial(src)||(item&&item.type==='volcano'&&(item.usgsVona||item.usgsStatus))){nivel='oficial';cls='conf-oficial';}
  const label=item?.hazardNature==='bulletin'?'BOLETIM OFICIAL':nivel==='radar'?'RADAR':e.origin;
  return {nivel,cls,label};
}
function isEventoCritico(item) {
    if (!item) return false;
    if (item.type === 'earthquake' && Number(item.mag) >= 4.5) return true;
    if (item.type === 'tsunami' || item.type === 'hurricane' || item.type === 'tornado') return true;
    if (item.meAtinge && (Number(item.sev) >= 2 || /perigo|grande perigo/i.test(String(item.detail || '')))) return true;
    if (String(item.id || '').startsWith('inmet-') && /grande perigo|\bperigo\b/i.test(String(item.detail || item.place || ''))) return true;
    if (String(item.source || '').toUpperCase() === 'RADAR') return true;
    if (typeof eventSeverityScore === 'function' && eventSeverityScore(item) >= 45) return true;
    if (item.type === 'storm' && (Number(item.sev) >= 3 || /grande perigo/i.test(String(item.detail || '')))) return true;
    return false;
}

