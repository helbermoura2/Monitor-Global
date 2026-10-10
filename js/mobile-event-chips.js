/* Local list navigation: never changes map filters, selection or priority queues. */
(function(){
 'use strict';
 const media=matchMedia('(max-width:900px)'),host=document.getElementById('mobile-event-chips');
 if(!host)return;
 const types=[['all','Todos'],['earthquake','Sismos'],['tsunami','Tsunamis'],['volcano','Vulcões'],['hurricane','Ciclones'],['storm','Tempestades'],['tornado','Tornados'],['fire','Incêndios'],['flood','Enchentes'],['wind','Vento'],['civil','Outros alertas']];
 let chosen='all';
 const active=()=>media.matches&&document.body.classList.contains('mobile-events-open');
 const data=()=>typeof lastMerged==='undefined'?[]:lastMerged||[];
 const keys=new Set(types.map(t=>t[0]));
 const type=item=>{const value=item.type||((item.mag!=null)?'earthquake':'civil');return keys.has(value)?value:'civil';};
 function filter(items){return active()&&chosen!=='all'?(items||[]).filter(item=>type(item)===chosen):items;}
 function update(items=data()){
  const counts=new Map();for(const item of items)counts.set(type(item),(counts.get(type(item))||0)+1);
  for(const button of host.children){
   const key=button.dataset.eventType,count=key==='all'?items.length:counts.get(key)||0;
   const label=types.find(t=>t[0]===key)[1];button.setAttribute('aria-pressed',String(key===chosen));
   const value=count.toLocaleString('pt-BR');if(button.lastElementChild.textContent!==value)button.lastElementChild.textContent=value;
   button.setAttribute('aria-label',label+' · '+value+' registro'+(count===1?'':'s'));
  }
  const label=document.getElementById('events-count-label');if(label){const count=(active()?filter(items):items)?.length||0;label.textContent=(media.matches?count.toLocaleString('pt-BR'):String(count))+' registro'+(count===1?'':'s');}
 }
 function redraw(){if(typeof renderSidebarList!=='function')return;renderSidebarList(data());update();}
 for(const [key,label]of types){
  const button=document.createElement('button');button.type='button';button.className='mobile-event-type';button.dataset.eventType=key;button.setAttribute('aria-controls','events');
  const name=document.createElement('span'),count=document.createElement('small');name.textContent=label;count.textContent='0';button.append(name,count);
  button.onclick=e=>{e.stopPropagation();if(chosen===key)return;chosen=key;redraw();const list=document.getElementById('events');if(list)list.scrollTop=0;};host.append(button);
 }
 media.addEventListener('change',redraw);
 window.MobileEventChips={filter,update,redraw};update();
})();
