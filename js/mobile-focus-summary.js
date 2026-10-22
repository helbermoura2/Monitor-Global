/* Selected-event summary; the existing latest-event ticker keeps its data. */
(function(){'use strict';
 const mq=matchMedia('(max-width:700px) and (orientation:portrait)');let content,ticker,observer,frame=0;const labels=new Set();let lastSignature=null,until=0,expiry=0,closed=false;
 function visibility(){if(!ticker)return;const active=mq.matches&&ticker.classList.contains('has-focus-summary');const hide=active&&(closed||Date.now()>=until||!!window.AftershockSequence?.summary(window.EventStore?.selectedId));ticker.classList.toggle('mobile-focus-dismissed',hide);if(mq.matches)ticker.style.setProperty('display',hide||document.body.classList.contains('sequence-hub-active')?'none':'flex','important');else ticker.style.removeProperty('display');window.MapOverlayLayout?.schedule();schedule();}
 function dismiss(){closed=true;clearTimeout(expiry);visibility();}
 function reveal(item){closed=false;until=Date.now()+(Number(item?.mag)>=6?60000:30000);clearTimeout(expiry);expiry=setTimeout(visibility,Math.max(1,until-Date.now()));visibility();}
 const kinds={earthquake:'SISMO',hurricane:'CICLONE',tsunami:'TSUNAMI',volcano:'VULCÃO',storm:'TEMPESTADE',wind:'VENTO',fire:'INCÊNDIO',flood:'ENCHENTE',tornado:'TORNADO',civil:'ALERTA'};
 function text(selector,value){const e=content.querySelector(selector);if(e.textContent!==value)e.textContent=value;}
 function refresh(){
  if(!ticker)return;const item=window.EventStore?.getSelected();
  ticker.classList.toggle('has-focus-summary',!!item);
  const signature=item?[item.id,item.mag,item.depth].join('|'):null;
  if(signature!==lastSignature){lastSignature=signature;reveal(item);}else visibility();
  const handle=document.getElementById('mobile-detail-handle');if(handle)handle.dataset.caption=item?.type==='earthquake'?'Detalhes do sismo':'Detalhes do evento';
  for(const el of ticker.children)if(el!==content&&!el.classList.contains('mobile-focus-close')){if(mq.matches&&item)el.style.setProperty('display','none','important');else el.style.removeProperty('display');}
  if(item){
   const q=item.type==='earthquake'||(!item.type&&item.mag!=null),n=Number(item.mag),depth=item.depth;
   const tone=q&&Number.isFinite(n)?getHexColor(n):(TYPE_META[item.type]?.color||'#72d9ef');
   content.style.setProperty('--focus-tone',tone);
   text('.focus-kind','EVENTO EM FOCO · '+(item.type==='capital-weather'?'TEMPO NA CAPITAL':kinds[item.type]||'EVENTO'));
   text('.focus-metric',item.type==='capital-weather'?item.temperature.toLocaleString('pt-BR')+' °C':q&&Number.isFinite(n)?'M '+n.toFixed(1).replace('.',','):(TYPE_META[item.type]?.icon||'📍'));
   text('.focus-place',window.EventPortuguese?.place(item.place)||item.place||'Local não informado');
   text('.focus-detail',q&&depth!=null&&Number.isFinite(Number(depth))?'Profundidade: '+Math.max(0,Math.round(Number(depth))).toLocaleString('pt-BR')+' km':(item.source?'Fonte: '+item.source:'Em monitoramento'));
  }
  ticker.setAttribute('aria-label',mq.matches&&item?'Evento em foco — abrir lista de registros':'Último evento — abrir lista de registros');schedule();
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(layout);}
 function layout(){
  frame=0;if(!mq.matches)return;
  const wrap=document.getElementById('mapWrap');if(!wrap)return;
  const headerBottom=Math.max(...['top-strip','ux-controlbar'].map(id=>document.getElementById(id)?.getBoundingClientRect().bottom||0));document.documentElement.style.setProperty('--mobile-event-slot-top',(headerBottom+8)+'px');
  const top=Math.max(...['top-strip','latest-event-ticker'].map(id=>document.getElementById(id)?.getBoundingClientRect().bottom||0))-wrap.getBoundingClientRect().top+8;
  const wave=wrap.querySelector('.wave-front-status'),gap=wave&&getComputedStyle(wave).display!=='none'?wave.getBoundingClientRect().height+6:0;
  wrap.style.setProperty('--mobile-notices-top',Math.max(8,top)+'px');wrap.style.setProperty('--mobile-wave-gap',gap+'px');
  for(const el of labels)if(!el.isConnected){observer.unobserve(el);labels.delete(el);}
  for(const el of wrap.querySelectorAll('.wave-front-status,.seismic-impact-status'))if(!labels.has(el)){labels.add(el);observer.observe(el);}
 }
 function init(){
  ticker=document.getElementById('latest-event-ticker');if(!ticker)return;
  content=document.createElement('span');content.className='mobile-focus-content';content.setAttribute('aria-live','polite');content.setAttribute('aria-atomic','true');
  for(const cls of ['focus-kind','focus-metric','focus-place','focus-detail']){const e=document.createElement('span');e.className=cls;content.append(e);}
  const close=document.createElement('button');close.type='button';close.className='mobile-focus-close';close.textContent='×';close.setAttribute('aria-label','Ocultar registro');close.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();dismiss();},true);close.addEventListener('keydown',e=>e.stopPropagation());ticker.append(close);
  const arrow=document.createElement('span');arrow.className='focus-arrow';arrow.textContent='⌄';arrow.setAttribute('aria-hidden','true');content.append(arrow);ticker.append(content);
  observer=new ResizeObserver(schedule);observer.observe(ticker);const header=document.getElementById('top-strip');if(header)observer.observe(header);
  new MutationObserver(schedule).observe(document.getElementById('mapWrap'),{childList:true});
  window.EventStore?.subscribe(refresh);mq.addEventListener('change',refresh);window.addEventListener('sequence-hub-layout',visibility);window.addEventListener('pagehide',()=>clearTimeout(expiry));window.addEventListener('pageshow',()=>{clearTimeout(expiry);visibility();if(until>Date.now())expiry=setTimeout(visibility,until-Date.now());});window.addEventListener('resize',schedule);refresh();
 }
 window.MobileFocusSummary={refresh,dismiss,show:()=>reveal(window.EventStore?.getSelected())};window.addEventListener('load',init,{once:true});
})();
