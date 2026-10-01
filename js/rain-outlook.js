/* Hourly model windows, not radar extrapolation or a minute-resolution nowcast. */
(() => {
  const HOUR=3600000;
  const mm=v=>Number(v).toFixed(1).replace('.',',');
  function summarize({forecast,loc,now=Date.now()}){
    const unknown={status:'unknown',header:'Chuva: s/ previsão',detail:'Previsão indisponível ou desatualizada. Não é possível estimar horário ou acumulado.',source:'ECMWF · NOAA/GFS · DWD/ICON via Open-Meteo',arrival:null};
    if(!forecast||!loc||!Number.isFinite(forecast.at)||forecast.at>now+60000||now-forecast.at>20*60000||!forecast.loc||Math.abs(forecast.loc.lat-loc.lat)>=.02||Math.abs(forecast.loc.lng-loc.lng)>=.02)return unknown;
    const rows=(forecast.rows||[]).filter(row=>Array.isArray(row.hours)&&row.hours.filter(h=>h.end>now&&h.end<=now+6*HOUR&&Number.isFinite(h.mm)&&h.mm>=0).length>=5);
    if(!rows.length)return unknown;
    // Open-Meteo hourly precipitation is the accumulation in the PRECEDING hour.
    // Show the next complete forecast hour, without prorating an hourly total.
    const start=Math.ceil(now/HOUR)*HOUR,end=start+HOUR;
    const amounts=rows.map(r=>r.hours.find(h=>h.end===end)?.mm);
    if(amounts.some(v=>!Number.isFinite(v)||v<0))return unknown;
    const min=Math.min(...amounts),max=Math.max(...amounts),range=(min===max?mm(min):mm(min)+'–'+mm(max))+' mm';
    const interval=new Date(start).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'})+'–'+new Date(end).toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'});
    const source=rows.map(r=>r.name==='GFS'?'NOAA/GFS':r.name==='ICON'?'DWD/ICON':r.name).join(' · ')+' via Open-Meteo';
    const base={min,max,start,end,range,interval,source,consultedAt:forecast.at,arrival:null};
    const first=rows.map(r=>r.hours.find(h=>h.end>now&&h.end<=now+6*HOUR&&h.mm>=.2));
    if(rows.length<2)return {...base,status:'limited',header:'Modelo: '+range+'/h',detail:'Apenas um modelo disponível; sem faixa de chegada consensual. '+range+' previstos na faixa '+interval+'.'};
    if(first.every(h=>!h))return {...base,status:'dry',header:'Pouca chuva · '+range+'/h',detail:'Os modelos não indicam chuva de pelo menos 0,2 mm/h nas próximas ~6 h. Acumulado '+range+' na faixa '+interval+'.'};
    if(first.some(h=>!h)||Math.max(...first.map(h=>h.end))-Math.min(...first.map(h=>h.end))>HOUR)return {...base,status:'divergent',header:'Divergem · '+range+'/h',detail:'Os modelos divergem sobre a faixa de chuva; sem estimativa de chegada. '+range+' previstos na faixa '+interval+'.'};
    const from=Math.max(now,Math.min(...first.map(h=>h.end-HOUR))),to=Math.max(...first.map(h=>h.end));
    const lo=Math.max(0,Math.floor((from-now)/60000)),hi=Math.ceil((to-now)/60000);
    const arrival={from,to,minMinutes:lo,maxMinutes:hi};
    return {...base,status:'possible',arrival,header:'Prev. '+lo+'–'+hi+'m · '+range.replace(' mm','mm')+'/1h',detail:'Chuva possível na faixa de '+lo+'–'+hi+' min (resolução horária). '+range+' previstos entre '+interval+'. É uma faixa do modelo, não o horário exato de início nem previsão por radar.'};
  }
  window.RainOutlook={summarize};
})();
