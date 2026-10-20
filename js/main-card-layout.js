/* Model 1 moves the live nodes, preserving their IDs, listeners and data updates. */
(function(){
 const homes=new Map();let location=null,footer=null,technical=null;
 function move(el,host){if(!el||!host)return;if(!homes.has(el)){const marker=document.createComment('Main card original position');el.before(marker);homes.set(el,marker);}host.append(el);}
 function restore(){for(const [el,marker] of homes){if(marker.isConnected)marker.after(el);marker.remove();}homes.clear();location?.remove();footer?.remove();const group=technical?.parentElement?.tagName==='DETAILS'?technical.parentElement:null;technical?.remove();group?.remove();location=footer=technical=null;document.getElementById('painel-direito')?.classList.remove('pd-model-one');}
 function sync(item){
  const p=document.getElementById('painel-direito');if(!p)return;
  if(item?.type!=='earthquake'){restore();return;}
  p.classList.add('pd-model-one');
  if(!location){location=document.createElement('div');location.className='pd-location-row';document.getElementById('pd-local').before(location);}
  move(document.getElementById('pd-flag'),location);move(document.getElementById('pd-local'),location);
  const more=document.getElementById('pd-more-details');
  if(!technical){technical=document.createElement('section');technical.id='pd-model-one-technical';technical.className='bubble-section';const title=document.createElement('div');title.className='bubble-section-title';title.textContent='Dados complementares do sismo';technical.append(title);more.prepend(technical);}
  for(const node of [document.getElementById('pd-energy')?.closest('.stat-card'),p.querySelector('.pd-impact-section'),document.getElementById('pd-timeline'),document.getElementById('pd-distvoce')])move(node,technical);
  if(!footer){footer=document.createElement('footer');footer.className='pd-model-one-footer';more.before(footer);}
  move(document.getElementById('pd-mag-sources'),technical);move(document.getElementById('pd-chips'),footer);move(p.querySelector('.pd-header-actions'),footer);
  // Keep related official bulletins after the primary measurements, before the footer.
  const linked=document.getElementById('pd-tsunami-link');if(linked)footer.before(linked);
 }
 window.MainCardLayout={sync,restore};
})();
