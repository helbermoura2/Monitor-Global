/* Move the live detail nodes; never duplicate their IDs or their asynchronous updates. */
(function(){
 let back=null,home=null,openedId=null,generation=0;
 const panel=()=>document.getElementById('painel-direito');
 function selected(){return window.EventStore?.getSelected?.();}
 function position(){
  const p=panel();if(!back||!p)return;
  const css=getComputedStyle(p),width=p.offsetWidth,height=p.offsetHeight;
  const top=Math.max(0,Number.isFinite(parseFloat(css.top))?parseFloat(css.top):innerHeight-(parseFloat(css.bottom)||0)-height);
  const left=Math.max(0,Number.isFinite(parseFloat(css.left))?parseFloat(css.left):innerWidth-(parseFloat(css.right)||0)-width);
  Object.assign(back.style,{zIndex:String(Math.max(700,Number(css.zIndex)||0)+2),top:top+'px',left:left+'px',width:Math.min(width,innerWidth-left)+'px',height:Math.max(80,Math.min(height,innerHeight-top))+'px'});
 }
 function close(){
  generation++;const more=document.getElementById('pd-more-details');
  if(home&&more)home.after(more);
  if(more)more.hidden=true;
  back?.remove();back=null;openedId=null;
  panel()?.classList.remove('pd-flip-girado','pd-flip-preparado');document.body.classList.remove('pd-more-open');
  const btn=document.getElementById('pd-more-toggle');if(btn){btn.textContent=window.RecordPresentation?.isBulletin(selected())?'Ler boletim ↻':'Detalhes ↻';btn.setAttribute('aria-expanded','false');}
 }
 async function riverContext(item,host,token){
  host.textContent='Consultando vazão prevista dos rios…';
  try{
   const [lng,lat]=item.coords;
   const url='https://flood-api.open-meteo.com/v1/flood?latitude='+lat+'&longitude='+lng+'&daily=river_discharge&forecast_days=7';
   const r=await fetchWithCorsFallback(url,15000);if(!r.ok)throw Error('HTTP '+r.status);
   const d=await r.json();if(token!==generation||!host.isConnected)return;
   const unit=d.daily_units?.river_discharge;if(unit!=='m³/s')throw Error('Unidade desconhecida');
   const values=d.daily?.river_discharge,dates=d.daily?.time;
   if(!Array.isArray(values)||!Array.isArray(dates)||!values.some(Number.isFinite))throw Error('Sem série válida');
   host.textContent='';const note=document.createElement('p');note.textContent='GloFAS / Copernicus via Open-Meteo · vazão diária prevista na célula fluvial próxima ('+d.latitude+', '+d.longitude+'). Não prevê alagamentos urbanos. Sem a cota local, estes valores não confirmam enchente.';host.append(note);
   const table=document.createElement('table');const head=document.createElement('tr');for(const t of ['Dia','Vazão prevista']){const th=document.createElement('th');th.textContent=t;head.append(th);}table.append(head);
   dates.forEach((date,i)=>{const tr=document.createElement('tr');for(const t of [date,Number.isFinite(values[i])?values[i].toLocaleString('pt-BR',{maximumFractionDigits:1})+' m³/s':'Sem dado']){const td=document.createElement('td');td.textContent=t;tr.append(td);}table.append(tr);});host.append(table);
  }catch(e){if(token===generation&&host.isConnected)host.textContent='Vazão prevista indisponível. Isso não confirma nem descarta enchente.';}
 }
 function section(title,content,open=false){const d=document.createElement('details'),s=document.createElement('summary');s.textContent=title;d.open=open;d.append(s,content);return d;}
 function renderBulletin(host,item){
  host.querySelector('.pd-bulletin-article')?.remove();
  const article=document.createElement('article');article.className='pd-bulletin-article';
  const h=document.createElement('h2');h.textContent=item.detail||'Boletim meteorológico';article.append(h);
  const meta=document.createElement('p');meta.className='pd-bulletin-meta';meta.textContent='CGE · Prefeitura de São Paulo · '+formatBrasiliaDateTime(item.time);article.append(meta);
  const text=document.createElement('div');text.className='pd-bulletin-text';text.textContent=item.warningDescription||'Texto do boletim indisponível. Consulte a publicação original.';article.append(text);
  try{const url=new URL(item.link);if(url.protocol==='https:'&&url.hostname==='www.cgesp.org'&&!url.username&&!url.password){const a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener';a.textContent='Abrir publicação no CGE ↗';article.append(a);}}catch(e){}
  const note=document.createElement('p');note.className='pd-bulletin-note';note.textContent='Texto original do CGE. Relatos e previsões referem-se ao horário da publicação; não confirmam alagamentos nem reproduzem o SMS da Defesa Civil.';article.append(note);host.append(article);
 }
 function refreshBulletin(item){if(back?.classList.contains('pd-bulletin-back')&&item.id===openedId)renderBulletin(back,item);}
 function toggle(force){
  const open=typeof force==='boolean'?force:!back;
  if(!open){close();return;}
  if(back)return;
  const more=document.getElementById('pd-more-details');if(!more||!panel())return;
  if(typeof fecharViradaCardAlcance==='function')fecharViradaCardAlcance();
  if(matchMedia('(max-width:900px)').matches){document.body.classList.remove('mobile-details-mid');document.body.classList.add('mobile-details-open');}
  if(!home){home=document.createComment('Details return here');more.before(home);}
  const item=selected();openedId=item?.id ?? window.EventStore?.selectedId ?? null;const token=++generation;
  back=document.createElement('section');back.id='pd-details-verso';back.className='pd-flip-verso pd-details-back';back.setAttribute('aria-label','Detalhes do evento');
  const header=document.createElement('header'),returnBtn=document.createElement('button');returnBtn.type='button';returnBtn.textContent='↶ Voltar ao evento';returnBtn.onclick=()=>close();header.append(returnBtn);back.append(header);
  if(window.RecordPresentation?.isBulletin(item)){
   back.classList.add('pd-bulletin-back');back.setAttribute('aria-label','Boletim do CGE');returnBtn.textContent='↶ Voltar ao boletim';renderBulletin(back,item);
  }else{
  const title=document.createElement('h2');title.textContent=item?.place||'Detalhes do evento';back.append(title);
  // Wrap once, retaining each original section as the visibility authority.
  if(!more.dataset.grouped){
   for(const child of [...more.children]){const title=child.id==='pd-source-trust'?'Fontes e evidências':child.querySelector('.bubble-section-title')?.textContent?.trim()||'Informações';
    const group=section(title,child,child.id==='pd-source-trust'||child.id==='pd-alcance-section');more.append(group);
   }more.dataset.grouped='true';
  }
  more.hidden=false;back.append(more);
  const evidence=document.createElement('div');const h=window.HazardEvidence?.classify(item);if(h?.nature){const p=document.createElement('p');p.textContent=h.label+' · '+h.note;evidence.append(p);}
  if(item?.severityLabel){const p=document.createElement('p');p.textContent='Severidade informada pela fonte: '+item.severityLabel;evidence.append(p);}
  if(item?.onset>Date.now()){const p=document.createElement('p');p.textContent='Início previsto '+new Date(item.onset).toLocaleString('pt-BR');evidence.append(p);}
  if(item?.expiresAt){const p=document.createElement('p');p.textContent='Validade até '+new Date(item.expiresAt).toLocaleString('pt-BR');evidence.append(p);}
  for(const key of ['locationNote','warningDescription','warningInstruction'])if(item?.[key]){const p=document.createElement('p');p.textContent=item[key];evidence.append(p);}
  if(evidence.childNodes.length)back.append(section('Produto, área e validade',evidence,true));
  if(item?.type==='flood'&&Array.isArray(item.coords)&&!/storm surge|coastal|lakeshore|tidal|tsunami/i.test(item.warningEvent||'')){const host=document.createElement('div');back.append(section('Rios · previsão de vazão',host,true));riverContext(item,host,token);}
  }
  document.body.append(back);position();document.body.classList.add('pd-more-open');panel().classList.add('pd-flip-preparado');
  const btn=document.getElementById('pd-more-toggle');btn.textContent=window.RecordPresentation?.isBulletin(item)?'Voltar ao boletim ↶':'Voltar ao evento ↶';btn.setAttribute('aria-expanded','true');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!back)return;panel().classList.add('pd-flip-girado');back.classList.add('pd-flip-visivel');returnBtn.focus({preventScroll:true});}));
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.getElementById('pd-more-toggle');if(btn)btn.textContent='Detalhes ↻';
  window.EventStore?.subscribe((reason,payload)=>{if(back&&reason==='select'&&payload.id!==openedId)close();});
  new ResizeObserver(position).observe(panel());
 });
 window.EventDetailsBack={toggle,close,refreshBulletin,isOpen:()=>!!back};
 window.addEventListener('resize',position);document.addEventListener('keydown',e=>{if(e.key==='Escape'&&back)close();});
})();
