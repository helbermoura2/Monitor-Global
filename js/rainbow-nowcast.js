/* Minute-resolution short-term estimates. No animation loop or radar tile fetch. */
(() => {
  const MINUTE=60000,THRESHOLD=.1;
  const same=(a,b)=>a&&b&&Math.abs(a.lat-b.lat)<=.002&&Math.abs(a.lng-b.lng)<=.002;
  const intensity=rate=>rate<2.5?'fraca':rate<7.5?'moderada':rate<50?'forte':'muito forte';
  let data=null,lastAttempt=null,inFlight=null;
  function summarize(input,loc,now=Date.now()) {
    if(!input?.ok||!same(input.loc,loc)||!Number.isFinite(input.at)||input.at>now+MINUTE||
        now-input.at>20*MINUTE||!Number.isFinite(input.expiresAt)||input.expiresAt<=now||!Array.isArray(input.forecast))return null;
    const points=input.forecast;
    if(points.some((p,i)=>!Number.isFinite(p.start)||!Number.isFinite(p.end)||p.end-p.start!==MINUTE||
        !Number.isFinite(p.rate)||p.rate<0||p.rate>1000||!['rain','mixed','snow','no_precipitation'].includes(p.type)||i&&p.start!==points[i-1].end))return null;
    const index=points.findIndex(p=>p.start<=now&&p.end>now);
    if(index<0||points.at(-1).end<now+60*MINUTE)return null;
    const series=points.slice(index),wet=p=>p.rate>=THRESHOLD&&p.type!=='no_precipitation';
    const first=series.findIndex(wet),current=series[0],nowWet=wet(current);
    const noun=(nowWet?current:series[first])?.type==='snow'?'Neve':'Chuva';
    let stop=null;
    if(first>=0)for(let i=first+1;i<=series.length-10;i++){
      if(series.slice(i,i+10).every(p=>!wet(p))){stop=Math.max(1,Math.ceil((series[i].start-now)/MINUTE));break;}
    }
    const arrival=first>=0?Math.max(0,Math.ceil((series[first].start-now)/MINUTE)):null;
    const hour=series.filter(p=>p.start<now+60*MINUTE);
    const amount=hour.reduce((sum,p)=>sum+p.rate*(Math.min(p.end,now+60*MINUTE)-Math.max(p.start,now))/3600000,0);
    const horizon=Math.floor((series.at(-1).end-now)/MINUTE);
    const detail=nowWet?(noun+' '+intensity(current.rate)+' estimada agora. '+(stop===null?'Sem término estimado nos próximos '+horizon+' min.':'Pode terminar em cerca de '+stop+' min.')):
      arrival!==null&&arrival<=60?(noun+' estimada para começar em cerca de '+arrival+' min'+(stop!==null?' e terminar em cerca de '+stop+' min a partir de agora.':'.')):
      'Sem precipitação de pelo menos 0,1 mm/h prevista na próxima hora para este ponto.';
    return {provider:'rainbow',status:nowWet?'now':arrival!==null&&arrival<=60?'soon':'dry',
      header:nowWet?noun+' '+intensity(current.rate)+' · agora':arrival!==null&&arrival<=60?noun+' em ~'+arrival+' min':'Sem chuva prevista · 1 h',
      detail:detail+' Previsão por minuto, sujeita a mudanças; não é medição nem aviso oficial.',
      source:'Rainbow Weather',consultedAt:input.at,rate:current.rate,arrivalMinutes:arrival,stopMinutes:stop,amount,
      series:hour,now,loc:input.loc};
  }
  function outlook(loc,now=Date.now()){return summarize(data,loc,now);}
  function status(loc,now=Date.now()){
    return lastAttempt&&same(lastAttempt.loc,loc)&&lastAttempt.retryAt>now?lastAttempt:null;
  }
  async function refresh(loc) {
    if(!loc||!Number.isFinite(loc.lat)||!Number.isFinite(loc.lng)||typeof workerBaseUrl!=='function')return;
    const now=Date.now();
    if(outlook(loc,now)||status(loc,now))return;
    if(inFlight){await inFlight;if(!same(data?.loc,loc)&&!status(loc))return refresh(loc);return;}
    const position={lat:loc.lat,lng:loc.lng};
    inFlight=(async()=>{
      const c=new AbortController(),timer=setTimeout(()=>c.abort(),18000);
      try{
        const response=await fetch(workerBaseUrl()+'/rain-nowcast?lat='+position.lat+'&lng='+position.lng,{signal:c.signal});
        const result=await response.json();
        if(response.ok&&summarize(result,position,Date.now())){
          data=result;lastAttempt=null;
        }else{
          // A failed refresh never extends the age of an earlier successful estimate.
          lastAttempt={loc:position,reason:result.reason||'unavailable',detail:result.detail||'Previsão por minuto indisponível.',
            retryAt:Number.isFinite(result.retryAt)?Math.max(Date.now()+MINUTE,result.retryAt):Date.now()+5*MINUTE};
        }
      }catch{
        lastAttempt={loc:position,reason:'unavailable',detail:'Previsão por minuto temporariamente indisponível.',retryAt:Date.now()+5*MINUTE};
      }finally{clearTimeout(timer);}
    })();
    try{await inFlight;}finally{inFlight=null;}
  }
  function appendChart(parent,summary){
    const section=document.createElement('section');section.className='rainbow-chart-card';section.id='rainbow-rain-chart';
    section.setAttribute('aria-label','Previsão de precipitação para os próximos 60 minutos');
    const heading=document.createElement('strong');heading.textContent=summary.header;section.append(heading);
    const description=document.createElement('p');description.textContent=summary.detail;section.append(description);
    const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');
    svg.setAttribute('viewBox','0 0 320 150');svg.setAttribute('role','img');
    const title=document.createElementNS(NS,'title');title.textContent='Intensidade prevista: '+summary.header+'. Próximos 60 minutos, em milímetros por hora.';svg.append(title);
    const max=Math.max(2.5,...summary.series.map(p=>p.rate)),x=t=>28+Math.max(0,Math.min(60,(t-summary.now)/MINUTE))*4.6,y=rate=>112-Math.min(max,rate)/max*88;
    const add=(tag,attributes,text)=>{const el=document.createElementNS(NS,tag);for(const [key,val]of Object.entries(attributes))el.setAttribute(key,String(val));if(text!==undefined)el.textContent=text;svg.append(el);return el;};
    for(const fraction of [0,.5,1]){
      const level=fraction*max;add('line',{x1:28,x2:304,y1:y(level),y2:y(level),class:'rainbow-grid'});
      add('text',{x:24,y:y(level)+3,'text-anchor':'end',class:'rainbow-axis'},level.toLocaleString('pt-BR',{maximumFractionDigits:1}));
    }
    add('text',{x:28,y:12,class:'rainbow-axis'},'mm/h');
    for(const m of [0,15,30,45,60])add('text',{x:28+m*4.6,y:135,'text-anchor':m===0?'start':m===60?'end':'middle',class:'rainbow-axis'},m===0?'Agora':m+' min');
    // Straight segments preserve the provider's values without spline overshoot.
    const line=summary.series.map((p,i)=>(i===0?'M':'L')+x(p.start)+','+y(p.rate)).join(' ')+
      ' L'+x(summary.series.at(-1).end)+','+y(summary.series.at(-1).rate);
    add('path',{d:line+' L304,112 L28,112 Z',class:'rainbow-area'});
    add('path',{d:line,class:'rainbow-line'});section.append(svg);
    const meta=document.createElement('small');meta.textContent=summary.amount.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' mm estimados na próxima hora · Consulta '+new Date(summary.consultedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});section.append(meta);
    const a=document.createElement('a');a.href='https://rainbow.ai/';a.target='_blank';a.rel='noopener';a.textContent='Dados: Rainbow Weather ↗';section.append(a);parent.append(section);
  }
  window.RainbowNowcast={refresh,outlook,status,summarize,appendChart};
})();
