/* Move live nodes without duplicating their IDs, listeners or asynchronous data. */
(function(){
 const homes=new Map();let location=null,footer=null,technical=null,kind=null;
 const panel=()=>document.getElementById('painel-direito');
 function move(el,host){
  if(!el||!host)return;
  if(!homes.has(el)){const marker=document.createComment('Main card original position');el.before(marker);homes.set(el,marker);}
  host.append(el);
 }
 function restore(){
  for(const [el,marker] of homes){if(marker.isConnected)marker.after(el);marker.remove();}
  homes.clear();location?.remove();footer?.remove();panel()?.querySelector('#pd-data-nature')?.remove();
  const group=technical?.parentElement?.tagName==='DETAILS'?technical.parentElement:null;
  technical?.remove();group?.remove();location=footer=technical=null;kind=null;
  panel()?.classList.remove('pd-model-one','pd-model-capital');
 }
 function countryImage(code,name){
  if(!/^[A-Z]{2}$/.test(code||''))return null;
  const flag=document.createElement('img');flag.className='pd-country-flag';
  flag.src='assets/flags/countries/'+code.toLowerCase()+'.svg';flag.width=36;flag.height=27;
  flag.alt='Bandeira · '+(name||code);flag.title=name||code;flag.decoding='async';return flag;
 }
 function updateFlag(item){
  const host=document.getElementById('pd-flag');if(!host||!item)return;
  // Ocean epicentres and uncertain borders do not inherit a nation from a place name.
  const country=window.CountryBoundaries?.lookup(item.coords?.[1],item.coords?.[0]);
  const code=country?.countryCode;host.replaceChildren();host.hidden=!code;
  if(!code)return;
  const flag=countryImage(code,country.nome);
  flag.onerror=()=>{flag.remove();if(!host.childElementCount)host.hidden=true;};host.append(flag);
  if(code==='BR'){const state=window.BrazilStateFlags?.image(item);if(state)host.append(state);}
 }
 function presentation(item){return item?.type==='capital-weather'?'capital':item?.type==='earthquake'||(!item?.type&&item?.mag!=null)?'quake':'alert';}
 function prepare(item){if(kind&&kind!==presentation(item))restore();}
 function sync(item){
  const p=panel();if(!p)return;
  if(!item){restore();return;}
  const next=presentation(item);
  if(kind!==next)restore();kind=next;p.classList.add('pd-model-one');
  if(next==='capital'){p.classList.add('pd-model-capital');window.DataContext?.annotate(item);return;}
  if(!location){location=document.createElement('div');location.className='pd-location-row';document.getElementById('pd-local').before(location);}
  move(document.getElementById('pd-flag'),location);move(document.getElementById('pd-local'),location);updateFlag(item);
  const more=document.getElementById('pd-more-details');
  if(!technical){
   technical=document.createElement('section');technical.id='pd-model-one-technical';technical.className='bubble-section';
   const title=document.createElement('div');title.className='bubble-section-title';title.textContent=next==='quake'?'Dados complementares do sismo':'Dados complementares do evento';technical.append(title);more.prepend(technical);
  }
  for(const node of [document.getElementById('pd-timeline'),document.getElementById('pd-distvoce'),document.getElementById('pd-mag-sources')])move(node,technical);
  // Alert measurements can include wind, pressure or volcanic levels: retain all three.
  if(next==='quake')for(const node of [document.getElementById('pd-energy')?.closest('.stat-card'),p.querySelector('.pd-impact-section')])move(node,technical);
  if(!footer){footer=document.createElement('footer');footer.className='pd-model-one-footer';more.before(footer);}
  move(document.getElementById('pd-chips'),footer);
  // Actions remain in the header, available before any card scrolling.
  const linked=document.getElementById('pd-tsunami-link');if(linked)footer.before(linked);
  window.DataContext?.annotate(item);
 }
 window.MainCardLayout={sync,restore,updateFlag,prepare,countryImage};
 Promise.resolve(window.CountryBoundaries?.ready).then(()=>{
  const item=window.EventStore?.getSelected();if(panel()?.classList.contains('pd-model-one')&&kind!=='capital')updateFlag(item);
 });
})();
