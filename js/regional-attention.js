/* Editorial screening, not a hazard forecast or an official warning. No network. */
(function(root){
 'use strict';
 const rules=[
  ['marmara','Mar de Mármara / Istambul',7,30,[29,40.8],180],
  ['manila','Manila e Vale Oeste',7,30,[121.05,14.6],160],
  ['tehran','Teerã',7,30,[51.4,35.7],150],
  ['himalaya','Himalaia',8,40,[[72,29],[80,25],[90,25],[98,29],[95,33],[82,36]]],
  ['indo-burma','Bangladesh / margem indo-birmanesa',8,50,[[89,19],[95,19],[96,27],[90,27]]],
  ['nankai','Japão / Nankai',8,50,[[130,30],[140,30],[140,35],[135,36],[130,34]]],
  ['cascadia','Cascadia',8.7,50,[[-130,40],[-123,40],[-122,50],[-129,51]]],
  ['sunda','Sumatra / margem de Sunda',8.5,50,[[91,7],[99,7],[108,-6],[120,-8],[120,-12],[105,-12],[94,-3]]],
  ['andes','Margem do Peru e Chile',8.5,60,[[-84,1],[-77,1],[-69,-18],[-67,-30],[-71,-47],[-78,-47],[-76,-20],[-84,-5]]],
  // Unwrapped longitudes cover both sides of the international date line.
  ['alaska','Alasca / Aleutas',8.5,50,[[160,48],[190,48],[212,55],[220,59],[210,64],[190,56],[160,55]]]
 ].map(([id,name,minMag,maxDepth,area,radiusKm])=>({id,name,minMag,maxDepth,area,radiusKm}));
 const numeric=v=>typeof v==='number'&&Number.isFinite(v);
 function distance(a,b){const r=Math.PI/180,dlat=(a[1]-b[1])*r,dlon=(a[0]-b[0])*r,s=Math.sin(dlat/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(dlon/2)**2;return 12742*Math.asin(Math.sqrt(Math.min(1,s)));}
 function inside(point,polygon){let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
 function evaluate(item){
  if(!item||(item.type&&item.type!=='earthquake')||item.__cinemaDemo||!numeric(item.mag)||!numeric(item.depth)||item.depth<=0||item.mag>10||!Array.isArray(item.coords)||item.coords.length!==2||!item.coords.every(numeric)||Math.abs(item.coords[0])>180||Math.abs(item.coords[1])>90)return [];
  return rules.filter(rule=>item.mag>=rule.minMag&&item.depth<=rule.maxDepth&&(rule.radiusKm?distance(item.coords,rule.area)<=rule.radiusKm:inside([rule.id==='alaska'&&item.coords[0]<0?item.coords[0]+360:item.coords[0],item.coords[1]],rule.area)));
 }
 root.RegionalAttention={evaluate,rules};
 if(!root.document)return;
 const panel=document.getElementById('painel-direito');if(!panel)return;
 const card=document.createElement('section');card.id='regional-attention-card';card.hidden=true;card.setAttribute('aria-label','Atenção regional — avaliação automática');card.setAttribute('aria-live','polite');
 const add=(tag,text,parent=card)=>{const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;};
 add('strong','ATENÇÃO REGIONAL');const title=add('h3',''),summary=add('p','');add('p','Sismo forte em região monitorada. Os impactos ainda não foram confirmados. Acompanhe as autoridades locais.');
 const details=document.createElement('details');card.append(details);add('summary','Entenda o aviso',details);const reason=add('p','',details);add('p','Critérios editoriais do Monitor Global. As áreas são aproximadas e não representam a extensão do tremor. Fora delas, ou abaixo destes valores, também podem ocorrer danos. Este aviso não prevê tsunami.',details);
 add('small','Avaliação automática · não substitui avisos oficiais');
 card.addEventListener('click',e=>e.stopPropagation());
 const mobile=()=>matchMedia('(max-width:900px)').matches;
 function layout(){if(mobile()){if(card.parentNode!==panel)panel.append(card);panel.style.removeProperty('--regional-card-space');}else{if(card.parentNode!==panel.parentNode)panel.after(card);const rect=panel.getBoundingClientRect();card.style.width=rect.width+'px';card.style.right=(innerWidth-rect.right)+'px';panel.style.setProperty('--regional-card-space',(card.hidden?0:card.getBoundingClientRect().height+10)+'px');}}
 let signature='';
 function sync(){const item=root.EventStore?.getSelected?.(),matches=evaluate(item),key=JSON.stringify([item?.id,item?.mag,item?.depth,item?.coords,matches.map(r=>r.id)]);if(key===signature)return;signature=key;card.hidden=!matches.length;panel.classList.toggle('has-regional-attention',!!matches.length);if(matches.length){const r=matches[0];title.textContent=matches.map(r=>r.name).join(' · ');summary.textContent='M'+item.mag.toLocaleString('pt-BR',{minimumFractionDigits:1})+' · Profundidade informada: '+item.depth.toLocaleString('pt-BR')+' km';reason.textContent='Critério acionado: epicentro na área de referência de '+r.name+', magnitude ≥ '+r.minMag.toLocaleString('pt-BR')+' e profundidade informada de até '+r.maxDepth+' km. Fonte sísmica: '+(item.source||'consulte o cartão do evento')+'.';details.open=false;}layout();}
 root.EventStore?.subscribe(sync);root.addEventListener('resize',layout);new ResizeObserver(layout).observe(card);sync();
})(globalThis);
