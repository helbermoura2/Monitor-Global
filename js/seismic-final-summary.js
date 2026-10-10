/* Final recap uses already loaded evidence; no polling, network or alert effects. */
(function(){
 'use strict';
 let active=null,timer=null,box=null,signature='';
 const selected=id=>typeof eventoSelecionadoId!=='undefined'&&eventoSelecionadoId===id;
 const event=id=>typeof globalEvents==='undefined'?null:globalEvents.find(q=>q.id===id);
 function stop(){clearTimeout(timer);timer=null;active=null;box?.remove();box=null;signature='';document.getElementById('painel-direito')?.classList.remove('seismic-final-summary');}
 function refresh(){
  if(!active||!selected(active.id)||!box)return;
  const item=event(active.id)||active;
  const intensity=window.SeismicCinema?.intensitySummary(item)||estimarMercalli(item.mag,item.depth);
  const exposure=window.exposicaoPopulacionalDoEvento?.(item),replicas=window.AftershockSequence?.summary(item.id);
  const rows=[['Intensidade estimada', 'MMI '+intensity.nivel]];
  if(exposure?.status==='available'&&['pager','worldpop'].includes(exposure.method)&&exposure.ranges?.[0]?.population!=null&&Number.isFinite(Number(exposure.ranges[0].population))&&Number(exposure.ranges[0].population)>=0){
   const n=Number(exposure.ranges[0].population);
   rows.push(['População potencialmente exposta · III+', (n?'≈ ':'')+Math.round(n).toLocaleString('pt-BR')+' pessoas'+(exposure.partial?' · cobertura parcial':'')]);
  }
  if(replicas?.count)rows.push(['Possíveis réplicas',replicas.count.toLocaleString('pt-BR')+' · maior M'+replicas.strongest.toFixed(1).replace('.',',')]);
  const next=JSON.stringify(rows);if(next===signature)return;signature=next;box.replaceChildren();
  const title=document.createElement('strong');title.textContent='Resumo do sismo · M'+Number(item.mag).toFixed(1).replace('.',',');box.append(title);
  for(const [label,value]of rows){const row=document.createElement('div'),small=document.createElement('small'),strong=document.createElement('b');small.textContent=label;strong.textContent=value;row.append(small,strong);box.append(row);}
  const note=document.createElement('small');note.className='seismic-final-note';note.textContent='Estimativas: não confirmam quem sentiu o tremor ou danos.';box.append(note);
 }
 function start(context,delay=0){
  stop();active=context;
  timer=setTimeout(()=>{
   timer=null;if(active!==context||!selected(context.id)){stop();return;}
   const host=document.getElementById('painel-direito'),anchor=host?.querySelector('.pd-header-row');if(!host||!anchor)return;
   box=document.createElement('section');box.id='pd-seismic-final-summary';box.setAttribute('aria-label','Resumo final do sismo');anchor.after(box);host.classList.add('seismic-final-summary');refresh();
  },delay);
 }
 window.EventStore?.subscribe(reason=>{if(reason==='select'&&active&&!selected(active.id))stop();else if(reason==='revise'||reason==='replace')refresh();});
 window.addEventListener('pagehide',stop);
 window.SeismicFinalSummary={start,stop,refresh};
})();
