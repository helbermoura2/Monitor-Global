/* Manual weather chip: event updates continue without switching the selected view. */
(() => {
  const $=id=>document.getElementById(id);
  let ready=false;
  const mobile=()=>window.innerWidth<=900;
  function init(){
    if(ready)return;const panel=$('sp-forecast-air'),event=$('painel-direito');if(!panel||!event)return;ready=true;
    document.body.appendChild(panel);
    $('chip-meteorologia')?.addEventListener('click',e=>{e.stopPropagation();document.body.classList.contains('weather-view')?hide():show();});
    const rainChip=$('sp-rain-eta-chip');
    if(rainChip){rainChip.setAttribute('role','button');rainChip.tabIndex=0;
      rainChip.addEventListener('click',e=>{e.stopPropagation();show();});
      rainChip.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();show();}});}
    const brief=document.createElement('section');brief.id='weather-brief';brief.setAttribute('aria-label','Resumo meteorológico');
    const details=document.createElement('details');details.id='weather-more';const summary=document.createElement('summary');summary.textContent='Ver fontes e detalhes';details.appendChild(summary);
    const controls=panel.querySelector('.weather-control-row'),header=panel.querySelector('.topbar-card-header');
    for(const child of [...panel.children])if(child!==controls&&child!==header)details.appendChild(child);
    panel.append(brief,details);
    const sources=document.createElement('div');sources.className='weather-official-links';
    for(const [text,url]of [['Radar CGE/SP','https://www.cgesp.org/v3/mapas.jsp?arq=precipitacaoradar'],['SAISP/FCTH','https://www.saisp.br/online/']]){const a=document.createElement('a');a.textContent=text+' ↗';a.href=url;a.target='_blank';a.rel='noopener';sources.appendChild(a);}
    const radarNote=document.createElement('small');radarNote.textContent='Consulta aos radares oficiais. Previsões por minuto e por modelos são identificadas separadamente; confira a data das imagens.';sources.appendChild(radarNote);details.appendChild(sources);
    $('weather-pin-btn')?.setAttribute('hidden','');
    document.body.classList.remove('weather-panel-pinned');
    window.addEventListener('resize',layout);new ResizeObserver(layout).observe(event);
    new MutationObserver(update).observe($('sp-live-card')||$('sp-live-temp'),{childList:true,subtree:true,characterData:true});
    layout();update();
  }
  function layout(){
    if(!ready)return;const r=$('painel-direito').getBoundingClientRect();
    if(!mobile()){
      for(const el of [$('sp-forecast-air')]){
        el.style.setProperty('left',r.left+'px','important');el.style.setProperty('right','auto','important');el.style.setProperty('width',r.width+'px','important');
      }
      const panel=$('sp-forecast-air');panel.style.setProperty('top',r.top+'px','important');panel.style.setProperty('bottom','auto','important');panel.style.setProperty('max-height',Math.max(100,r.height)+'px','important');
    }else{
      const panel=$('sp-forecast-air');for(const [key,value]of Object.entries({left:'0',right:'0',top:'auto',bottom:'0',width:'100%', 'max-height':'75dvh'}))panel.style.setProperty(key,value,'important');
    }
  }
  function update(){
    if(!ready)return;const brief=$('weather-brief');brief.replaceChildren();
    const state=window.__weatherEvidenceState,forecast=window.__weatherForecastBrief,outlook=window.__rainOutlook;
    const city=typeof weatherLoc!=='undefined'?weatherLoc.nome:'Meteorologia';
    if($('fc-city-name')?.textContent==='--')$('fc-city-name').textContent=city;
    const heading=document.createElement('h3');heading.textContent=($('fc-city-name')?.textContent||city)+' · '+($('sp-live-temp')?.textContent||'--')+' · '+($('sp-live-feels')?.textContent||'');brief.appendChild(heading);
    if(outlook?.provider==='rainbow')window.RainbowNowcast.appendChart(brief,outlook);
    else if(window.__rainbowStatus){const status=document.createElement('small');status.className='rainbow-status';status.textContent=window.__rainbowStatus.detail+' Abaixo: previsão por modelos horários.';brief.appendChild(status);}
    const measured=state?.measured;
    const observation=measured?(measured.chuvaIntensidade?'Chuva '+measured.chuvaIntensidade:measured.tempestade?'Trovoada observada':'Sem chuva reportada')+' · '+measured.icao+' · '+Math.round(measured.distance)+' km':'Sem leitura próxima recente';
    const rain=forecast?forecast.min.toFixed(1).replace('.', ',')+'–'+forecast.max.toFixed(1).replace('.', ',')+' mm previstos · '+forecast.rows.length+' modelo(s)':'Previsão indisponível ou desatualizada';
    const flood=state?.level==='confirmed'?state.label:state?.level==='none'?'Nenhum ponto ativo informado pelo CGE':'Consulta local indisponível';
    for(const [label,text]of [['Chuva observada',observation],['Chuva · curto prazo',outlook?.detail||'Previsão indisponível'],['Próximas 6 h',rain],['Alagamentos',flood]]){const row=document.createElement('p'),strong=document.createElement('strong');strong.textContent=label;const span=document.createElement('span');span.textContent=text;row.append(strong,span);brief.appendChild(row);}
    if(outlook?.status&&outlook.status!=='unknown'&&outlook.provider!=='rainbow'){const meta=document.createElement('small');meta.textContent=outlook.source+' · Consulta '+new Date(outlook.consultedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+' · Acumulado na próxima faixa horária completa';brief.appendChild(meta);}
    const note=document.createElement('small');note.textContent='Leitura do aeródromo é local. Previsão de chuva não confirma alagamentos.';brief.appendChild(note);
  }
  function setChipState(open){const chip=$('chip-meteorologia');if(!chip)return;chip.classList.toggle('active',open);chip.setAttribute('aria-pressed',String(open));chip.setAttribute('aria-expanded',String(open));chip.title=open?'Fechar meteorologia':'Abrir meteorologia';}
  function show(){window.EventDetailsBack?.close();init();if(!ready)return;if(typeof fcPopupTimeout!=='undefined'&&fcPopupTimeout)clearTimeout(fcPopupTimeout);document.body.classList.add('weather-view');document.body.classList.toggle('mobile-fc-open',mobile());$('sp-forecast-air').classList.add('open');layout();update();setChipState(true);}
  function hide(){document.body.classList.remove('weather-view','mobile-fc-open');$('sp-forecast-air')?.classList.remove('open');setChipState(false);}
  window.WeatherPanel={show,hide,update};document.addEventListener('DOMContentLoaded',init,{once:true});
})();
