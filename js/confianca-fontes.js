// === confianca-fontes.js — Textos de vulcão + score de confiança/consolidação de fontes (linhas originais 3317-3522 do core-app.js) ===

function traduzirTextoVulcanico(valor){
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
function fonteEhOficial(src){return /USGS|INMET|AFAD|JMA|NHC|NWS|PTWC|CEMADEN|CGE|DEFESA|BMKG|GEONET|USP|OSC-BOL|EMSC|GEOFON|IGP|FUNVISIS/i.test(String(src||''));}
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
      estima: 'Intensidade (MMI), energia em TNT, raio sentido e mecanismo focal (quando estimado) são do app — não são boletim oficial.'
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
function renderConsolidacaoFonte(item){
  const box=document.getElementById('pd-source-trust');
  if(!box)return;
  const c=consolidarConfianca(item);
  const conf=typeof confiancaFonte==='function'?confiancaFonte(item):{label:'—',cls:''};
  const leg=legendaNaturezaDados(item);
  const natureLabel={
    oficial:'DADO INSTITUCIONAL',
    consolidada:'CONSOLIDADO (várias fontes)',
    rede:'REDE / AGREGADOR',
    modelo:'MODELO (não oficial)',
    desconhecido:'—'
  }[c.nature]||c.nature;
  const natureColor=c.nature==='oficial'?'#4ade80':c.nature==='modelo'?'#fbbf24':c.nature==='consolidada'?'#38bdf8':'#94a3b8';
  box.innerHTML=`
    <div class="source-trust-head">
      <span class="source-trust-title">📡 Confiança & natureza dos dados</span>
      <span class="source-trust-score ${c.cls}">${c.score}%</span>
    </div>
    <div class="source-trust-bar"><div class="source-trust-fill" style="width:${c.score}%"></div></div>
    <div class="source-trust-meta"><b style="color:#e2e8f0">${c.label}</b> · selo lista: <span class="${conf.cls||''}">${conf.label||'—'}</span></div>
    <div class="source-trust-meta" style="margin-top:4px">Natureza: <b style="color:${natureColor}">${natureLabel}</b></div>
    <div class="source-trust-meta" style="margin-top:6px;padding:6px 7px;border-radius:6px;background:rgba(15,23,42,.65);border:1px solid rgba(148,163,184,.12)">
      <div style="color:#86efac;font-weight:800;font-size:9px;letter-spacing:.4px">✅ DADO DA FONTE</div>
      <div style="margin-top:2px;line-height:1.35">${leg.fonte}</div>
      <div style="color:#fbbf24;font-weight:800;font-size:9px;letter-spacing:.4px;margin-top:6px">📐 ESTIMATIVA DO APP</div>
      <div style="margin-top:2px;line-height:1.35">${leg.estima}</div>
    </div>
    <div class="source-trust-meta" style="margin-top:5px">Fontes: ${c.sources.join(' · ')||'não identificadas'}${c.officialSources&&c.officialSources.length?` · institucionais: ${c.officialSources.join(', ')}`:''}</div>
    <div class="source-trust-meta" style="margin-top:3px;opacity:.85">${c.reason}</div>
    <div class="source-trust-meta" style="margin-top:4px;font-size:8px;color:#64748b">Não substitui alerta de defesa civil, bombeiros ou agência oficial do país afetado.</div>
  `;
  box.style.display='block';
}
function confiancaFonte(item){if(!item)return{nivel:'rede',label:'REDE',cls:'conf-rede'};const c=consolidarConfianca(item),src=String(item.source||'').toUpperCase();if(item.type==='volcano'&&(item.usgsVona||item.usgsStatus))return{nivel:'oficial',label:'VULCANOLÓGICO',cls:'conf-oficial'};if(src==='RADAR'||/RAINVIEWER/.test(src))return{nivel:'radar',label:'RADAR',cls:'conf-radar'};
// Tempestade/vento com condição ATUAL (weather_code >= 95 agora, não previsão) —
// antes caía junto com "modelo" só por vir de Open-Meteo/WeatherAPI, e por isso
// nunca entrava nos registros/chips (o toast ainda disparava, então parecia que
// o evento tinha sumido). "sp-storm-soon" é a única previsão de fato (chegando
// em N min) e continua como modelo de propósito.
if((item.type==='storm'||item.type==='wind')&&item.id!=='sp-storm-soon'&&/OPEN-?METEO|WEATHERAPI|MODELO LOCAL/i.test(src))return{nivel:'rede',label:'REDE',cls:'conf-rede'};
if(/OPEN-?METEO|MODELO|NOWCAST/i.test(src))return{nivel:'modelo',label:'MODELO',cls:'conf-modelo'};if(fonteEhOficial(src))return{nivel:'oficial',label:'OFICIAL',cls:'conf-oficial'};if(/GDACS/.test(src))return{nivel:'rede',label:'GDACS',cls:'conf-rede'};return{nivel:c.score>=70?'oficial':'rede',label:c.score>=70?'CONSOLIDADA':'REDE',cls:c.score>=70?'conf-oficial':'conf-rede'};}
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
