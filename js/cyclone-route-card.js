/* Selected cyclone presentation; reuses existing feeds and KMZ download. No polling. */
(function(){'use strict';
const M=CycloneRouteModel;let current=null,section=null,legend=null,popup=null,currentPin=null,pins=[],mapRef=null,touched=false,jmaDrawn=null,legendKey=null;const products=new Map();
const item=()=>window.EventStore?.getSelected();
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function button(host,text,action){const n=el('button',text);n.type='button';n.onclick=action;host.append(n);return n;}
function num(v){return v!==null&&v!==undefined&&Number.isFinite(Number(v))?Number(v).toLocaleString('pt-BR'):'—';}
const time=t=>Number.isFinite(t)?new Date(t).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' BRT':null;
function product(q){const p=products.get(q?.id);return p&&(p.provider==='JMA'?!q.coneUrl&&p.until>Date.now():p.url===q.coneUrl)?p:null;}
function history(q){return typeof cycloneHistory==='undefined'?[]:(cycloneHistory.get(q.id)||[]).filter(h=>M.point([h.lng,h.lat])).slice(-24);}
function points(q){const p=product(q),out=history(q).map(h=>[h.lng,h.lat]);if(M.point(q?.coords))out.push(q.coords);if(p){if(p.data.history)out.push(...p.data.history);for(const f of p.data.linhas||[])for(const c of f.geometry?.type==='MultiLineString'?f.geometry.coordinates.flat():f.geometry?.coordinates||[])if(M.point(c))out.push(c);for(const f of p.data.poligonos||[])for(const ring of f.geometry?.coordinates||[])for(const c of ring){const wrapped=[((c[0]+540)%360)-180,c[1]];if(M.point(wrapped))out.push(wrapped);};}return out;}
function camera(q){if(q?.type!=='hurricane')return null;const pts=points(q);if(pts.length<2)return null;const b=window.WeatherWarningCamera?.bounds(pts);if(!b||b[0][0]===b[1][0]&&b[0][1]===b[1][1])return null;const c=WeatherWarningCamera.frame(b);return c?{...c,zoom:Math.min(7,c.zoom)}:null;}
function pause(){touched=true;window.EventCamera?.cancel();if(typeof stopMapCamera==='function')stopMapCamera();map.stop();userInteractingWithGlobe=true;}
function revealMap(){if(matchMedia('(max-width:700px) and (orientation:portrait)').matches&&typeof fecharPainelDetalhesMobile==='function')fecharPainelDetalhesMobile();}
function fit(q){revealMap();const c=camera(q);if(!c)return;pause();map.flyTo({...c,duration:matchMedia('(prefers-reduced-motion:reduce)').matches?0:1800,essential:true});}
function tooltip(coords,title,detail){popup?.remove();const box=el('div',undefined,'cyclone-point-detail');box.append(el('strong',title),el('p',detail));popup=new GL.Popup({closeButton:true,maxWidth:'260px',className:'cyclone-route-popup'}).setLngLat(coords).setDOMContent(box).addTo(map);}
function pin(coords,text,cls,action){const n=el('button',text,cls);n.type='button';n.onclick=e=>{e.stopPropagation();action();};return new GL.Marker({element:n,anchor:'bottom',offset:[0,-10]}).setLngLat(coords).addTo(map);}
function clearPins(clearPopup=true){pins.forEach(p=>p.remove());pins=[];currentPin?.remove();currentPin=null;if(clearPopup){popup?.remove();popup=null;}}
function stage(r){return r.hours!==null?(r.hours===0?'Boletim':'+'+r.hours+' h'):r.name;}
function detail(r,provider='NHC'){return [r.validAt?time(r.validAt):null,r.windKmh!==null?num(r.windKmh)+' km/h':null,'Posição publicada · '+provider].filter(Boolean).join(' · ');}
function drawJma(p){
 if(typeof map==='undefined'||!map)return;const ids=['cyclone-jma-probability','cyclone-jma-forecast-line','cyclone-jma-history-line'];
 if(p?.provider!=='JMA'){jmaDrawn=null;for(const id of ids)if(map.getLayer(id))map.removeLayer(id);if(map.getSource('cyclone-jma'))map.removeSource('cyclone-jma');return;}
 if(jmaDrawn===p&&map.getSource('cyclone-jma'))return;jmaDrawn=p;
 const features=[...(p.data.history?.length>1?[{type:'Feature',geometry:M.line(p.data.history),properties:{kind:'history'}}]:[]),...p.data.poligonos.map(f=>({...f,properties:{...f.properties,kind:'cone'}})),...p.data.linhas.map(f=>({...f,properties:{...f.properties,kind:'forecast'}}))];
 const data={type:'FeatureCollection',features};if(map.getSource('cyclone-jma'))map.getSource('cyclone-jma').setData(data);else map.addSource('cyclone-jma',{type:'geojson',data});
 if(!map.getLayer(ids[0]))map.addLayer({id:ids[0],type:'fill',source:'cyclone-jma',filter:['==',['get','kind'],'cone'],paint:{'fill-color':'#c5adeb','fill-opacity':.10,'fill-outline-color':'#bca3df'}});
 if(!map.getLayer(ids[2]))map.addLayer({id:ids[2],type:'line',source:'cyclone-jma',filter:['==',['get','kind'],'history'],paint:{'line-color':'#70c9c5','line-width':2,'line-opacity':.7}});
 if(!map.getLayer(ids[1]))map.addLayer({id:ids[1],type:'line',source:'cyclone-jma',filter:['==',['get','kind'],'forecast'],paint:{'line-color':'#d6bff7','line-width':2.5,'line-dasharray':[2,2]}});
}
function mapUI(q,keepPopup=false){
 if(typeof map==='undefined'||!map)return;
 clearPins(!keepPopup);const p=product(q),h=history(q);drawJma(p);document.body.classList.add('cyclone-route-active');
 if(M.point(q.coords)){const wind=q.windKmh??extractWindKmh(q.detail||''),c=classificarCiclone(wind);currentPin=pin(q.coords,'AGORA · '+(wind!=null?num(wind)+' km/h':q.place),'cyclone-current-pin',()=>tooltip(q.coords,q.place,'Última posição recebida · '+(time(q.time)||'horário indisponível')));currentPin.getElement().style.setProperty('--cyclone-tone',c.cor);}
 const labelPoints=M.point(q.coords)?[map.project(q.coords)]:[];
 if(p)for(const r of M.rows(p.data).filter(r=>r.hours!==0).slice(0,12)){const px=map.project(r.coords);if(labelPoints.some(a=>Math.hypot(a.x-px.x,a.y-px.y)<65))continue;labelPoints.push(px);pins.push(pin(r.coords,stage(r),'cyclone-forecast-pin',()=>tooltip(r.coords,stage(r),detail(r,p.provider))));}
 const nextLegendKey=[q.id,p?.provider,p?.url,p?.data.issuedAt,h.length].join('|');
 if(!legend){legend=el('section',undefined,'cyclone-map-legend');legend.id='cyclone-map-legend';legend.setAttribute('aria-label','Legenda do percurso do ciclone');document.getElementById('mapWrap')?.append(legend);}
 if(legendKey!==nextLegendKey){legendKey=nextLegendKey;legend.replaceChildren();legend.append(el('strong','Percurso do ciclone'));
 const row=el('div',undefined,'cyclone-legend-items');row.append(el('span',p?.provider==='JMA'?'━ Percorrido · JMA/GDACS':'━ Percorrido','cyclone-observed-key'),el('span','● Atual','cyclone-current-key'));if(p?.data.linhas?.length)row.append(el('span','┄ Previsto · '+p.provider,'cyclone-forecast-key'));if(p?.data.poligonos?.length)row.append(el('span','▱ Incerteza · '+p.provider,'cyclone-forecast-key'));legend.append(row);
 legend.append(el('small',p?.data.poligonos?.length?p.provider==='JMA'?'Círculos de probabilidade JMA; não são a área dos ventos. Histórico JMA sem intensidade por ponto.':'O cone indica a incerteza da posição do centro, não toda a área afetada.':h.length>1?'Percurso formado pelas posições recebidas. Sem cone oficial disponível.':'Aguardando mais posições para desenhar o percurso.'));
 }window.MapOverlayLayout?.schedule();
 if(mapRef!==map){mapRef=map;map.on('moveend',()=>{if(current)mapUI(current,true);});for(const name of ['dragstart','wheel','touchstart','mousedown'])map.on(name,e=>{if(e.originalEvent)touched=true;});map.on('click','cyclone-track-points',e=>{const f=e.features?.find(f=>f.properties?.id===current?.id);if(f)tooltip(f.geometry.coordinates,'Posição recebida',[(time(Number(f.properties.at))||'Horário indisponível'),f.properties.windKmh!=null?'Vento: '+num(Number(f.properties.windKmh))+' km/h':null].filter(Boolean).join(' · '));});}
}
function sync(q){
 const panel=document.getElementById('painel-direito');if(q?.type!=='hurricane'){current=null;clearPins();drawJma(null);if(typeof stopHurricaneOfficialRoute==='function')stopHurricaneOfficialRoute();legendKey=null;legend?.remove();legend=null;section?.remove();section=null;panel?.classList.remove('pd-cyclone');document.body.classList.remove('cyclone-route-active');return;}
 if(current?.id!==q.id){touched=false;if(typeof hurricaneOfficialId!=='undefined'&&hurricaneOfficialId&&hurricaneOfficialId!==q.id)stopHurricaneOfficialRoute();}current=q;if(!panel)return;panel.classList.add('pd-cyclone');
 if(!section){section=el('section',undefined,'cyclone-card');section.id='pd-cyclone-card';}document.getElementById('pd-horario')?.after(section);section.replaceChildren();
 const wind=q.windKmh??extractWindKmh(q.detail||''),c=classificarCiclone(wind),p=product(q);section.style.setProperty('--cyclone-tone',c.cor);
 section.append(el('small','VENTO MÁXIMO REPORTADO'),el('div',wind!=null?num(wind)+' km/h':'Sem dado de vento','cyclone-card-wind'),el('p',q.cycloneLabel||c.cat,'cyclone-classification'));
 const grid=el('div',undefined,'cyclone-data-grid');for(const [label,value]of [['Movimento',q.movementInfo?[q.movementInfo.compass,Number.isFinite(q.movementInfo.speedKmh)?num(q.movementInfo.speedKmh)+' km/h':null].filter(Boolean).join(' · '):'Sem dado'],['Pressão central',q.pressureMb!=null?num(q.pressureMb)+' hPa':'Sem dado']]){const cell=el('div');cell.append(el('small',label),el('strong',value));grid.append(cell);}section.append(grid);
 const actions=el('div',undefined,'cyclone-card-actions');button(actions,'Ver percurso',()=>fit(current));section.append(actions);
 const rows=p?M.rows(p.data):[];section.append(el('h3',rows.length?'Posições publicadas · '+p.provider:'Histórico recebido'));
 const list=el('div',undefined,'cyclone-card-timeline');list.setAttribute('aria-label','Posições do ciclone');
 if(rows.length){for(const r of rows){const b=button(list,stage(r)+' · '+(r.windKmh!==null?num(r.windKmh)+' km/h':r.validAt?time(r.validAt):'Ver posição'),()=>{revealMap();pause();map.flyTo({center:centroCompensado(r.coords[0],r.coords[1],5),zoom:5,padding:{top:0,right:0,bottom:0,left:0},duration:matchMedia('(prefers-reduced-motion:reduce)').matches?0:1200});tooltip(r.coords,stage(r),detail(r,p.provider));});b.title=detail(r,p.provider);}}
 else for(const h of history(q).slice(-6)){button(list,(time(h.t)||'Horário indisponível')+' · '+(h.windKmh!=null?num(h.windKmh)+' km/h':'Vento não informado'),()=>tooltip([h.lng,h.lat],'Posição recebida',time(h.t)||''));}
 if(!list.childElementCount)list.append(el('p','Aguardando novas posições.'));section.append(list);
 section.append(el('p',p?p.provider+' · '+(time(p.data.issuedAt)||'produto oficial carregado')+'. Ventos futuros só aparecem quando publicados.':q.coneUrl?'Previsão oficial ainda não carregada.':'Sem previsão oficial integrada para este evento. Exibindo posições recebidas.','cyclone-card-note'));
 mapUI(q);
 if(!q.coneUrl&&!p)window.CycloneJMA?.load(q).then(data=>{if(data&&item()?.id===q.id&&!item().coneUrl)official(item(),data,'jma');});
}
function official(q,data,url){products.delete(q.id);products.set(q.id,{url,data,provider:data.provider||'NHC',until:Date.now()+20*60000});while(products.size>4)products.delete(products.keys().next().value);if(item()?.id===q.id){sync(item());const c=camera(item());if(c&&!touched){if(window.EventCamera?.owns(q.id))EventCamera.enter(q.id,c);else if(!map.isMoving())map.easeTo({...c,duration:matchMedia('(prefers-reduced-motion:reduce)').matches?0:1200});}}}
window.CycloneRouteCard={sync,official,camera,refresh:()=>{const q=item();if(q?.type==='hurricane')sync(q);},clearProduct:id=>{if(products.get(id)?.provider!=='JMA')products.delete(id);}};
window.EventStore?.subscribe(reason=>{if(reason==='select')requestAnimationFrame(()=>{const q=item();if(q?.type!=='hurricane')sync(q);});});
})();
