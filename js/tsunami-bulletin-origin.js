/* Only explicit bulletin fields may establish an earthquake origin. */
(function(root){'use strict';
 function parse(value){
  const text=String(value||'');
  const c=text.match(/(?:COORDINATES|COORDENADAS)\s*(?:[-:]\s*)?(\d+(?:\.\d+)?)\s+(NORTH|SOUTH|NORTE|SUR)\s+(\d+(?:\.\d+)?)\s+(EAST|WEST|ESTE|OESTE)/i);
  const coords=c?[Number(c[3])*(/^(WEST|OESTE)$/i.test(c[4])?-1:1),Number(c[1])*(/^(SOUTH|SUR)$/i.test(c[2])?-1:1)]:null;
  const mag=text.match(/(?:\*\s*)?(?:MAGNITUDE|MAGNITUD)\s*(?:[-:]\s*)?(\d+(?:\.\d+)?)/i);
  const place=text.match(/(?:\*\s*|\n|^)(?:LOCATION|LOCALIZACION)\s*(?:[-:]\s*)?([^\n]+)/i)?.[1]?.trim()||text.match(/\bLOCATION\s*-\s*([\s\S]+?)(?=\s+MAGNITUDE\s*-|\s+EVALUATION\b|$)/i)?.[1]?.trim();
  const depth=text.match(/(?:DEPTH|PROFUNDIDAD)\s*(?:[-:]\s*)?(\d+(?:\.\d+)?)\s*(KM|KILOMETERS|MILES|MILLAS)/i);
  const time=text.match(/(?:ORIGIN TIME|TIEMPO DE ORIGEN)\s*[-:]?\s*(\d{1,2})(\d{2})\s*(AM|PM)?\s+(UTC|HST|CHST|AKDT|AKST|PDT|PST)\s+(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
  let originTime=null;
  if(time){const month=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].indexOf(time[6].toUpperCase()),offset={UTC:0,HST:-10,CHST:10,AKDT:-8,AKST:-9,PDT:-7,PST:-8}[time[4].toUpperCase()];let hour=Number(time[1]);if(time[3])hour=hour%12+(/PM/i.test(time[3])?12:0);if(month>=0&&hour<24&&Number(time[2])<60&&Number(time[5])>=1&&Number(time[5])<=31)originTime=Date.UTC(Number(time[7]),month,Number(time[5]),hour,Number(time[2]))-offset*3600000;}
  return {coords:coords&&Math.abs(coords[0])<=180&&Math.abs(coords[1])<=90?coords:null,originMag:mag?Number(mag[1]):null,originTime,originDepth:depth?Number(depth[1])*(/MILES|MILLAS/i.test(depth[2])?1.609344:1):null,place:place||null};
 }
 function normalize(item){
  if(item?.type!=='tsunami'||item.coordinateRole==='warning-area')return item;
  const fields=parse(item.description||item.detail);
  if(!fields.coords||Array.isArray(item.coords))return item;
  return {...item,...fields,place:fields.place||item.place,originTime:Number.isFinite(item.originTime)?item.originTime:fields.originTime,originMag:Number.isFinite(item.originMag)?item.originMag:fields.originMag,originDepth:Number.isFinite(item.originDepth)?item.originDepth:fields.originDepth,coordinateRole:'earthquake-origin',originEvidence:'explicit-bulletin-fields'};
 }
 const api={parse,normalize};root.TsunamiBulletinOrigin=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
