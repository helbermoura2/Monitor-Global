/* Local list navigation: never changes map filters, selection or priority queues. */
(function(){
 'use strict';
 const media=matchMedia('(max-width:900px)'),host=document.getElementById('mobile-event-chips');
 if(!host)return;
 const types=[['all','Todos'],['earthquake','Sismos'],['tsunami','Tsunamis'],['volcano','Vulcões'],['hurricane','Ciclones'],['storm','Tempestades'],['tornado','Tornados'],['fire','Incêndios'],['flood','Enchentes'],['wind','Vento'],['civil','Outros alertas']];
 let chosen='all',minimum=0,order='recent',query='';
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const active=()=>media.matches&&document.body.classList.contains('mobile-events-open');
 const data=()=>typeof lastMerged==='undefined'?[]:lastMerged||[];
 const keys=new Set(types.map(t=>t[0]));
 const type=item=>{const value=item.type||((item.mag!=null)?'earthquake':'civil');return keys.has(value)?value:'civil';};
 function filter(items){if(!active())return items;let rows=(items||[]).filter(item=>(chosen==='all'||type(item)===chosen)&&(!minimum||type(item)==='earthquake'&&Number(item.mag)>=minimum)&&(!query||normalize([item.place,item.pais,item.source].join(' ')).includes(normalize(query))));if(order==='magnitude')rows=rows.slice().sort((a,b)=>(Number(b.mag)||0)-(Number(a.mag)||0)||b.time-a.time);return rows;}
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
  button.onclick=e=>{e.stopPropagation();if(chosen===key)return;chosen=key;if(key!=='earthquake'){minimum=0;magInput.value='0';}redraw();const list=document.getElementById('events');if(list)list.scrollTop=0;};host.append(button);
 }
 const tools=document.createElement('section');tools.id='mobile-event-tools';tools.setAttribute('aria-label','Procurar registros');
 function field(text,element){const label=document.createElement('label'),name=document.createElement('span');name.textContent=text;label.append(name,element);tools.append(label);return element;}
 const magInput=document.createElement('select');magInput.id='mobile-event-magnitude';magInput.setAttribute('aria-label','Magnitude mínima na lista');for(const value of [0,2,3,4,5,5.5,6,6.5,7,8]){const option=document.createElement('option');option.value=value;option.textContent=value?'M'+String(value).replace('.',',')+' ou mais':'Todas';magInput.append(option);}field('Magnitude mínima',magInput);
 magInput.onchange=()=>{minimum=Number(magInput.value);if(minimum)chosen='earthquake';redraw();document.getElementById('events').scrollTop=0;};
 const sort=document.createElement('select');sort.setAttribute('aria-label','Ordenar registros');for(const [value,text]of [['recent','Mais recentes'],['magnitude','Maiores magnitudes']]){const o=document.createElement('option');o.value=value;o.textContent=text;sort.append(o);}field('Ordenar',sort);sort.onchange=()=>{order=sort.value;redraw();};
 const search=document.createElement('input');search.type='search';search.placeholder='Cidade, país ou fonte';search.setAttribute('aria-label','Buscar local nos registros');field('Buscar local',search).parentElement.className='mobile-event-search';search.oninput=()=>{query=search.value.trim().slice(0,100);redraw();};host.after(tools);
 media.addEventListener('change',redraw);
 window.MobileEventChips={filter,update,redraw,state:()=>[chosen,minimum,order,query]};update();
})();
