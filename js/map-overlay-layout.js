/* Coordinate overlays on UI changes, never on animation frames or map movement. */
(function(){
 'use strict';
 const selector='.wave-front-status,.seismic-impact-status,#mobile-notice-stack,#tsunami-map-legend,.felt-reports-legend';
 let frame=0,observer,resize,inline;
 const tracked=new Set();
 const visible=el=>!!el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none';
 const rect=el=>visible(el)?el.getBoundingClientRect():null;
 function style(el,key,value){if(el.style.getPropertyValue(key)!==value)el.style.setProperty(key,value);}
 function schedule(){if(!frame)frame=requestAnimationFrame(layout);}
 function foldLegend(el,compact){
  let fold=el.querySelector(':scope > .mg-map-legend-fold');
  if(!fold){fold=document.createElement('details');fold.className='mg-map-legend-fold';const summary=document.createElement('summary');const title=el.querySelector(':scope > strong');if(title)summary.append(title);else summary.textContent='Legenda do mapa';const body=document.createElement('div');while(el.firstChild)body.append(el.firstChild);fold.append(summary,body);el.append(fold);fold.addEventListener('toggle',schedule);}
  if(fold.dataset.compact!==String(compact)){fold.dataset.compact=String(compact);fold.open=!compact;}
 }
 function layout(){
  frame=0;const host=document.getElementById('mapWrap');if(!host)return;
  const h=host.getBoundingClientRect(),mobile=innerWidth<=900;
  const headerBottom=Math.max(h.top,...['top-strip','ux-controlbar','latest-event-ticker'].map(id=>rect(document.getElementById(id))?.bottom||0));
  const hub=document.getElementById('sequence-hub'),hubRect=rect(hub),main=document.getElementById('painel-direito');
  const panel=mobile&&hubRect&&document.body.classList.contains('sequence-hub-expanded')?hub:main,p=rect(panel),left=rect(document.getElementById('sidebar-left'));
  const sideHub=hubRect&&hubRect.width<h.width*.7;
  let start=h.left+12,end=Math.min(h.right,innerWidth)-12;
  if(sideHub)start=Math.max(start,hubRect.right+12);
  if(!mobile){if(left)start=Math.max(start,left.right+12);if(p)end=Math.min(end,p.left-12);}
  const width=Math.max(100,end-start),center=(start+end)/2-h.left;
  const dock=!!p&&!(panel===hub&&sideHub)&&!panel.classList.contains('pd-flip-girado')&&(mobile?(document.body.classList.contains('mobile-details-open')||p.top<headerBottom+220):width<140);
  const rank=el=>el.matches('.wave-front-status')?0:el.matches('.seismic-impact-status')?1:el.id==='mobile-notice-stack'?2:3;
  const elements=[...document.querySelectorAll(selector)].sort((a,b)=>rank(a)-rank(b));
  if((dock||p&&width<280)&&elements.length){if(!inline){inline=document.createElement('section');inline.id='map-overlay-inline';inline.setAttribute('aria-label','Legendas do mapa');}if(inline.parentElement!==panel)panel.querySelector('.pd-header-row,.sequence-hub-header')?.after(inline);}
  let top=Math.max(8,headerBottom-h.top+8),bottom=mobile&&p&&p.width>=h.width*.7?Math.min(h.bottom,p.top)-h.top-10:h.height-18;
  const legends=[];
  for(const el of elements){
   if(!tracked.has(el)){tracked.add(el);resize?.observe(el);}
   if(!el.classList.contains('mg-overlay-managed'))el.classList.add('mg-overlay-managed');
   const isLegend=el.matches('#tsunami-map-legend,.felt-reports-legend');
   const dockThis=dock||el.id==='mobile-notice-stack'&&!!p&&!panel.classList.contains('pd-flip-girado')&&width<280;
   if(el.id==='mobile-notice-stack')el.classList.toggle('notice-inline',dockThis);
   if(dockThis&&inline){if(el.parentElement!==inline)inline.append(el);el.classList.add('mg-overlay-inline');if(isLegend)foldLegend(el,true);continue;}
   el.classList.remove('mg-overlay-inline');if(el.parentElement!==host)host.append(el);
   if(!visible(el))continue;
   style(el,'--overlay-left',center+'px');style(el,'--overlay-width',Math.min(isLegend?440:el.id==='mobile-notice-stack'?540:600,width)+'px');
   if(isLegend){legends.push(el);continue;}
   style(el,'--overlay-top',top+'px');top+=el.getBoundingClientRect().height+8;
  }
  // Bottom legends share the free area, instead of occupying independent fixed offsets.
  for(const el of legends){const room=Math.max(40,bottom-top);foldLegend(el,room<180);style(el,'--overlay-max-height',Math.max(40,Math.floor(room/legends.length)-8)+'px');const height=el.getBoundingClientRect().height;style(el,'--overlay-top',Math.max(top,bottom-height)+'px');bottom-=height+8;}
  if(inline)inline.hidden=![...inline.children].some(el=>!el.hidden&&getComputedStyle(el).display!=='none');
  for(const el of tracked)if(!el.isConnected){resize?.unobserve(el);tracked.delete(el);}
 }
 function init(){
  const host=document.getElementById('mapWrap');if(!host)return;
  resize=window.ResizeObserver?new ResizeObserver(schedule):null;
  for(const id of ['mapWrap','top-strip','ux-controlbar','latest-event-ticker','painel-direito','sidebar-left']){const el=document.getElementById(id);if(el)resize?.observe(el);}
  observer=new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'&&r.target.matches?.(selector)||r.type==='childList'&&[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches(selector)||n.querySelector(selector)))))schedule();});
  observer.observe(host,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
  window.addEventListener('sequence-hub-layout',schedule);window.addEventListener('resize',schedule);window.addEventListener('transitionend',schedule);window.visualViewport?.addEventListener('resize',schedule);
  schedule();
 }
 window.MapOverlayLayout={schedule,layout};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
