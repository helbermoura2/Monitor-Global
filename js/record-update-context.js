/* Presentation of already detected updates. No new event/revision detection. */
(function(root){
 'use strict';
 const clean=v=>String(v??'').trim();
 const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const num=v=>valid(v)?Number(v).toLocaleString('pt-BR',{maximumFractionDigits:2}):'não informado';
 const local=v=>root.EventPortuguese?.local(clean(v))||clean(v);
 function describe(before,after){
  const parts=[];
  const text=(key,label)=>{if(clean(after[key])&&clean(before[key])!==clean(after[key]))parts.push(label+': '+(clean(before[key])?local(before[key])+' → ':'')+local(after[key]));};
  const number=(key,label,unit='')=>{if(valid(after[key])&&(!valid(before[key])||Number(before[key])!==Number(after[key])))parts.push(label+': '+num(before[key])+' → '+num(after[key])+unit);};
  if(after.type==='volcano'){
   text('aviationColor','Cor de aviação');text('gdacsAlertLevel','Nível de alerta');text('usgsAlertLevel','Alerta vulcânico');
   for(const key of ['eruptionStatus','activityStatus','vulcanicActivity','ashStatus']){if(parts.length>=3)break;text(key,key==='ashStatus'?'Cinzas':'Atividade');}
  }else{text('warningLevel','Nível do aviso');text('severityLabel','Severidade');}
  number('windKmh','Vento',' km/h');number('pressureMb','Pressão',' hPa');
  if(valid(after.mag)&&(!valid(before.mag)||Number(after.mag)!==Number(before.mag)))parts.push('Magnitude: '+(valid(before.mag)?'M'+Number(before.mag).toFixed(1).replace('.',','):'não informada')+' → M'+Number(after.mag).toFixed(1).replace('.',','));
  number('depth','Profundidade',' km');
  if(!parts.length)text('sev','Nível informado pela fonte');
  if(!parts.length&&clean(after.detail)!==clean(before.detail)&&clean(after.detail))parts.push('Boletim atualizado: '+local(after.detail));
  const result=parts.slice(0,3).join(' · ')||'Nova versão da fonte · alteração não detalhada';
  return result.length>280?result.slice(0,277)+'…':result;
 }
 function summary(item){
  let text=root.EventPortuguese?.revision(item)||clean(item?._deltaTxt);
  if(!text)return item?._volcanoEscalation?local(item._volcanoEscalation):'';
  if(/^(?:Dado[s]? atualizad[oa]s? pela fonte|Dados revisados pela fonte|Registro atualizado|revisão)$/i.test(text))return 'Nova versão da fonte · alteração não detalhada';
  if(/^Fontes\s*(?:\/|e|·)\s*Qualidade$/i.test(text))return 'Fontes ou qualidade do registro atualizadas';
  return text.split(' · ').map(part=>/^M\d/.test(part)?'Magnitude: '+part:/^\d[\d.,]*\s*→\s*\d[\d.,]*\s*km$/.test(part)?'Profundidade: '+part:part).join(' · ');
 }
 function kind(item){if(item?._updateKind)return item._updateKind;const text=clean(item?._deltaTxt),physical=/M[\d.,]+\s*→\s*M[\d.,]+|[\d.,]+\s*→\s*[\d.,]+\s*km|preliminar\s*→|Status de revisão/i.test(text);return /^(?:Fontes|Qualidade)/i.test(text)&&!physical?'sources':'physical';}
 function classify(before,after){
  const oldDepth=root.SeismicDepth?.describe(before),newDepth=root.SeismicDepth?.describe(after),sameSource=(before.reports||[]).find(r=>(r.source||'').replace(/-RT$/,'')===(after.source||'').replace(/-RT$/,''))||((before.source||'').replace(/-RT$/,'')===(after.source||'').replace(/-RT$/,'')?before:null),latest=(after.reports||[]).find(r=>r.source===after.source)||after;
  const sources=v=>clean(v.sourceSummary||v.source).split(/\s*·\s*/).sort().join('|');
  const magChanged=valid(before.mag)&&valid(after.mag)&&Math.abs(Number(before.mag)-Number(after.mag))>=.1-1e-9,depthChanged=!!oldDepth?.known&&!!newDepth?.known&&Math.abs(oldDepth.value-newDepth.value)>=5,reviewChanged=!!sameSource&&!!sameSource.isPreliminary!==!!latest.isPreliminary;
  return {magChanged,depthChanged,reviewChanged,sourcesChanged:sources(before)!==sources(after),qualityChanged:clean(before.quality)!==clean(after.quality),kind:magChanged||depthChanged||reviewChanged?'physical':'sources'};
 }
 const api={describe,summary,kind,classify};root.RecordUpdateContext=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
