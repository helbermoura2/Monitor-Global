(function(root){'use strict';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const TTL=45*60000;
function volcano(q,e={}){const text=norm([q.ashStatus,q.activityStatus,q.eruptionStatus,q.vulcanicActivity,q.detail].filter(Boolean).join('. '));let label='Atividade monitorada · sem descrição conclusiva';
 if(/re[- ]?suspend|ressuspens/.test(text))label='Cinzas ressuspensas · não confirma nova erupção';
 else if(!/last erupt|ultima erup|histor|previous|anterior|not ended|nao.{0,15}encerr/.test(text)&&/\bended\b|\bceased\b|encerrad|cessou/.test(text))label='Encerramento reportado no boletim';
 else if(e.explosive)label='Atividade explosiva reportada';else if(e.lava)label='Lava reportada';else if(e.erupting)label='Atividade eruptiva reportada';else if(e.ash)label='Emissão de cinzas reportada';
 const height=String(q.ashHeight||'').trim(),movement=String(q.vonaMovement||q.plumeMovement||'').trim()||height.match(/\bMOV(?:ING)?\s+([NSEW]{1,3}(?:\s+\d+\s*KT)?)/i)?.[1]||'';
 const flight=height.match(/\bFL(\d{2,3})\b/i);return {label,height:height||null,movement:movement||null,flightNote:flight?'FL'+flight[1]+' indica '+(Number(flight[1])*100).toLocaleString('pt-BR')+' pés de altitude de pressão; não é altura sobre a cratera.':null,reportAt:Number(q.reportAt)||Date.parse(q.noticeSent||'')||Number(q.time)||null};}
function catalog(d,now=Date.now()){if(d?.version!==1||!Number.isFinite(d.checkedAt)||d.checkedAt>now+300000||!Array.isArray(d.alerts)||d.alerts.length>5000)throw Error('Catálogo Cemaden inválido');const fresh=now-d.checkedAt<=TTL;const rows=d.alerts.filter(a=>a&&/^\d{7}$/.test(String(a.ibge))&&Number.isFinite(a.lat)&&Number.isFinite(a.lng)&&Math.abs(a.lat)<=90&&Math.abs(a.lng)<=180&&a.status===1&&['Moderado','Alto','Muito Alto'].includes(a.level));return {fresh,checkedAt:d.checkedAt,alerts:fresh?rows:[],expiredRows:!fresh?rows.length:0};}
const api={volcano,catalog,TTL};root.HazardContextModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
