/* Meteorologia: medições, previsão e ocorrência de alagamento são evidências distintas. */
(() => {
  const MODELS = [['ecmwf_ifs025','ECMWF'],['gfs_seamless','GFS'],['icon_seamless','ICON']];
  let forecast = null, fetching = false, observed = [];
  const $ = id => document.getElementById(id);
  function samePlace(a,b) { return a && b && Math.abs(a.lat-b.lat)<.02 && Math.abs(a.lng-b.lng)<.02; }
  function fresh(at,now,minutes) { return Number.isFinite(at) && at<=now+60000 && now-at<=minutes*60000; }
  function assess({now,loc,cge,stations=[]}) {
    const sp=samePlace(loc,{lat:-23.55,lng:-46.63});
    const validCge=sp && cge?.ok && fresh(cge.at,now,20) && Number.isInteger(cge.count) && cge.count>=0;
    const measured=stations.filter(s=>fresh(s.updatedAt,now,75) && Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map(s=>({...s,distance:haversine(loc.lat,loc.lng,s.lat,s.lng)})).filter(s=>s.distance<=35).sort((a,b)=>a.distance-b.distance || b.updatedAt-a.updatedAt)[0];
    let label='ALAG.: SEM CONSULTA',level='unknown',reason='Sem consulta recente de ocorrências locais. Isso não confirma nem descarta alagamentos.';
    if(validCge) { label=cge.count>0?'CGE: '+cge.count+' ATIVOS':'CGE: 0 ATIVOS'; level=cge.count>0?'confirmed':'none'; reason=cge.count+' ponto(s) ativo(s) informado(s) pelo CGE no município de São Paulo. Consulta '+new Date(cge.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'.'; }
    let observation='Sem estação próxima com leitura recente. Chuva do modelo não é uma medição.';
    if(measured) observation=(measured.chuvaIntensidade?'Chuva '+measured.chuvaIntensidade+' observada':measured.tempestade?'Trovoada observada':'Sem chuva reportada')+' em '+measured.icao+' · '+Math.round(measured.distance)+' km · '+Math.max(0,Math.round((now-measured.updatedAt)/60000))+' min atrás'+(measured.source?' · '+measured.source:' · REDEMET')+'. Leitura local do aeródromo; não representa todos os bairros.';
    return {label,level,reason,observation,measured};
  }
  function summarize(data,now) {
    const h=data?.hourly;
    if(!Array.isArray(h?.time)) throw Error('Previsão sem horários');
    const indices=h.time.map((time,i)=>({i,at:Date.parse(time.endsWith('Z')?time:time+'Z')})).filter(x=>x.at>now && x.at<=now+6*3600000).slice(0,6);
    const rows=MODELS.map(([key,name])=>{
      const values=indices.map(x=>h['precipitation_'+key]?.[x.i]);
      if(values.length<5 || values.some(v=>v==null || !Number.isFinite(v) || v<0))return null;
      return {name,total:values.reduce((a,b)=>a+b,0),hours:indices.map((x,i)=>({end:x.at,mm:values[i]}))};
    }).filter(Boolean);
    if(!rows.length) throw Error('Modelos indisponíveis');
    const totals=rows.map(x=>x.total),wet=totals.filter(x=>x>=1).length;
    const agreement=rows.length<2?'Apenas um modelo disponível':wet===0?'Os modelos consultados indicam pouco ou nenhum acumulado':wet===rows.length?'Os modelos consultados indicam possibilidade de chuva':'Modelos divergem sobre chuva';
    return {rows,agreement,min:Math.min(...totals),max:Math.max(...totals)};
  }
  function update() {
    if(typeof weatherLoc==='undefined' || !weatherLoc)return;
    const state=assess({now:Date.now(),loc:weatherLoc,cge:window.__cgeEvidence,stations:[...(window.REDEMET?.stations||[]),...observed]});
    window.__weatherEvidenceState=state;
    if(typeof floodRiskState!=='undefined')floodRiskState={level:state.level,score:null,reason:state.reason};
    const label=$('flood-risk-label'),chip=$('flood-risk-chip');
    if(label)label.textContent=state.label;
    if(chip){chip.title=state.reason;chip.classList.remove('flood-ok','flood-mod','flood-high','flood-crit');if(state.level==='confirmed')chip.classList.add('flood-high');chip.setAttribute('aria-label','Alagamentos: '+state.reason);}
    const panel=$('weather-evidence');if(!panel)return;
    panel.replaceChildren();
    const entries=[['CHUVA OBSERVADA',state.observation],['ALAGAMENTOS · CGE',samePlace(weatherLoc,{lat:-23.55,lng:-46.63})?state.reason:'CGE cobre a capital paulista. Sem dados de ocorrências para a cidade selecionada.']];
    const valid=forecast && samePlace(forecast.loc,weatherLoc) && fresh(forecast.at,Date.now(),20);
    window.__weatherForecastBrief=valid?forecast:null;
    window.__rainOutlook=window.RainOutlook?.summarize({forecast:valid?forecast:null,loc:weatherLoc,now:Date.now()});
    const rain=$('sp-rain-eta'),rainChip=$('sp-rain-eta-chip'),outlook=window.__rainOutlook;
    if(rain)rain.textContent=outlook?.header||'Chuva: s/ previsão';
    if(rainChip){rainChip.title=(outlook?.detail||'Previsão indisponível')+' · '+(outlook?.source||'Modelos');rainChip.setAttribute('aria-label',rainChip.title);}
    window.WeatherPanel?.update();
    entries.push(['PREVISÃO · COMPARAÇÃO DE MODELOS',valid?forecast.agreement+' · '+forecast.min.toFixed(1).replace('.', ',')+'–'+forecast.max.toFixed(1).replace('.', ',')+' mm nas próximas ~6 h. '+forecast.rows.map(x=>x.name+': '+x.total.toFixed(1).replace('.', ',')+' mm').join(' · ')+'. Consulta '+new Date(forecast.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'. Previsão, não certeza; não determina horário exato nem risco de alagamento.':'Comparação indisponível ou desatualizada. A previsão individual abaixo continua identificada como modelo.']);
    entries.push(['CHUVA · CURTO PRAZO',outlook?.detail||'Estimativa indisponível.']);
    for(const [title,detail]of entries){const row=document.createElement('div');const heading=document.createElement('strong'),text=document.createElement('p');heading.textContent=title;text.textContent=detail;row.append(heading,text);panel.appendChild(row);}
  }
  async function refresh() {
    if(typeof weatherLoc==='undefined' || !weatherLoc)return;
    update();if(fetching)return;
    const loc={...weatherLoc};if(forecast && samePlace(forecast.loc,loc) && fresh(forecast.at,Date.now(),5)){update();return;}
    fetching=true;
    const metarTask=(async()=>{
      try{
        if(typeof workerBaseUrl!=='function')return;
        const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000);
        let data;try{const r=await fetch(workerBaseUrl()+'/metar-observed?ids=SBSP,SBGR,SBMT',{signal:c.signal});if(!r.ok)throw Error('METAR indisponível');data=await r.json();}finally{clearTimeout(timer);}
        observed=(data.stations||[]).map(x=>({...x,...parseMetarBasico(x.raw)}));
      }catch(e){console.warn('Backup METAR:',e.message);}
    })();
    try{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
      let data;
      try{const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+loc.lat+'&longitude='+loc.lng+'&hourly=precipitation&forecast_hours=8&models='+MODELS.map(x=>x[0]).join(',')+'&timezone=UTC',{signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);data=await r.json();}finally{clearTimeout(timer);}
      forecast={...summarize(data,Date.now()),at:Date.now(),loc};
    }catch(e){console.warn('Comparação meteorológica:',e.message);}finally{await metarTask;fetching=false;update();}
  }
  window.WeatherEvidence={assess,summarize,update,refresh};
  document.addEventListener('DOMContentLoaded',()=>{update();PeriodicScheduler.every('weather-evidence',refresh,6000,60000);},{once:true});
})();
