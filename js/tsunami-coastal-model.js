/* Published coastal arrival and sea-level tables. No propagation calculations. */
(function(root){
'use strict';
function utcDate(hhmm,mmdd,issued){
 const m=String(hhmm).match(/^(\d{2})(\d{2})$/),d=String(mmdd).match(/^(\d{2})\/(\d{2})$/);if(!m||!d||m[1]>23||m[2]>59||d[1]<1||d[1]>12||d[2]<1||d[2]>31||!Number.isFinite(issued))return null;
 const year=new Date(issued).getUTCFullYear(),candidates=[year-1,year,year+1].map(y=>Date.UTC(y,+d[1]-1,+d[2],+m[1],+m[2])).filter(t=>new Date(t).getUTCMonth()===+d[1]-1&&new Date(t).getUTCDate()===+d[2]);candidates.sort((a,b)=>Math.abs(a-issued)-Math.abs(b-issued));return candidates.length&&Math.abs(candidates[0]-issued)<7*86400000?candidates[0]:null;
}
function coords(lat,ns,lng,ew){lat=Number(lat);lng=Number(lng);return lat<=90&&lng<=180?[lng*(ew==='W'?-1:1),lat*(ns==='S'?-1:1)]:null;}
function parse(text,issued){
 text=String(text||'');const forecasts=[],observations=[];
 const eta=text.split(/ESTIMATED TIMES OF ARRIVAL[^\n]*\n[-]+/i)[1]?.split(/\n[A-Z][A-Z .-]+\n[-]+/)[0]||'';
 for(const line of eta.split('\n')){const m=line.match(/^\s*(\S.*?)\s{2,}(\S.*?)\s{2,}(\d+(?:\.\d+)?)\s*([NS])\s+(\d+(?:\.\d+)?)\s*([EW])\s+(\d{4})\s+(\d{2}\/\d{2})\s*$/);if(!m)continue;const at=utcDate(m[7],m[8],issued),c=coords(m[3],m[4],m[5],m[6]);if(at!==null&&c)forecasts.push({name:m[1].trim(),region:m[2].trim(),coords:c,arrivalTime:at,kind:'forecast'});}
 // Only parse rows inside the observations section, with an explicit unit.
 const obs=text.split(/(?:TSUNAMI (?:WAVE )?(?:OBSERVATIONS|MEASUREMENTS)|OBSERVATIONS OF TSUNAMI ACTIVITY)[^\n]*\n[-]+/i)[1]?.split(/\n[A-Z][A-Z .-]+\n[-]+/)[0]||'';
 for(const line of obs.split('\n')){const m=line.match(/^\s*(\S.*?)\s{2,}(\d+(?:\.\d+)?)\s*([NS])\s+(\d+(?:\.\d+)?)\s*([EW])\s+(\d{4})(?:\s*UTC)?\s+(?:(\d{2}\/\d{2})\s+)?(\d+(?:\.\d+)?)\s*(M|CM|FT)(?=\s|\/|$)/i);if(!m)continue;const c=coords(m[2],m[3],m[4],m[5]);let at=null;if(m[7])at=utcDate(m[6],m[7],issued);else if(Number.isFinite(issued)){const d=new Date(issued);const day=String(d.getUTCMonth()+1).padStart(2,'0')+'/'+String(d.getUTCDate()).padStart(2,'0');at=utcDate(m[6],day,issued);if(at!==null&&at>issued+300000)at-=86400000;}const height=Number(m[8])*(m[9].toUpperCase()==='FT'?.3048:m[9].toUpperCase()==='CM'?.01:1);if(c&&at!==null&&height<=100)observations.push({name:m[1].trim(),coords:c,time:at,heightM:height,kind:'observed'});}
 return {bulletinNumber:text.match(/(?:TSUNAMI MESSAGE NUMBER|BULLETIN NUMBER)\s+(\d+)/i)?.[1]||null,forecasts,observations};
}
const api={parse,utcDate};root.TsunamiCoastalModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
