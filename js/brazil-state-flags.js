/* Geographic flags: explicit Brazilian state metadata or a confident spatial match. */
(()=>{'use strict';
 const codes=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
 let parts=[],ready=null;const cache=new Map();
 const inside=(ring,x,y)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
 function near(ring,x,y){const cos=Math.max(.01,Math.cos(y*Math.PI/180));for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i],ax=(a[0]-x)*cos*111.195,ay=(a[1]-y)*111.195,dx=(b[0]-a[0])*cos*111.195,dy=(b[1]-a[1])*111.195,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(ax+t*dx,ay+t*dy)<3)return true;}return false;}
 function isBrazil(item){if(!item)return false;if(item.countryCode)return item.countryCode==='BR';const p=item.coords;if(Array.isArray(p)&&window.CountryBoundaries?.lookup(p[1],p[0]).countryCode==='BR')return true;return /^(?:INMET|CEMADEN|CGE|INPE|ANA)(?:\b|\s|\/)/i.test(item.source||'');}
 function load(){if(ready)return ready;ready=fetch('assets/geography/br-states.json').then(r=>{if(!r.ok)throw Error('Fronteiras estaduais indisponíveis');return r.json();}).then(d=>{parts=[];for(const f of d.features||[]){if(!codes.has(f.properties?.uf))continue;for(const rings of f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates){const xs=rings[0].map(p=>p[0]),ys=rings[0].map(p=>p[1]);parts.push({uf:f.properties.uf,rings,w:Math.min(...xs),e:Math.max(...xs),s:Math.min(...ys),n:Math.max(...ys)});}}cache.clear();if(typeof renderSidebarList==='function'&&typeof lastMerged!=='undefined')renderSidebarList(lastMerged);updateMain();}).catch(e=>console.warn('[bandeiras estaduais]',e.message));return ready;}
 function uf(item){
  if(!isBrazil(item))return null;
  if(item.ufs?.length>1)return null;
  const explicit=item.uf||item.stateCode||(item.ufs?.length===1?item.ufs[0]:null);if(codes.has(explicit))return explicit;
  const [x,y]=item.coords||[];if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  void load();const key=x.toFixed(5)+','+y.toFixed(5);if(cache.has(key))return cache.get(key);if(!parts.length)return null;
  const hits=new Set();let uncertain=false;
  for(const p of parts){if(x<p.w-.04||x>p.e+.04||y<p.s-.04||y>p.n+.04)continue;if(p.rings.some(r=>near(r,x,y))){uncertain=true;break;}if(inside(p.rings[0],x,y)&&!p.rings.slice(1).some(r=>inside(r,x,y)))hits.add(p.uf);}
  const result=!uncertain&&hits.size===1?[...hits][0]:null;cache.set(key,result);if(cache.size>2000)cache.delete(cache.keys().next().value);return result;
 }
 function image(item){const code=uf(item);if(!code)return null;const img=document.createElement('img');img.className='br-state-flag';img.src='assets/flags/br-states/'+code+'.svg';img.alt='Bandeira · '+code;img.width=24;img.height=16;img.decoding='async';img.title='Estado: '+code;return img;}
 function markup(item){return image(item)?.outerHTML||'';}
 function updateMain(){const host=document.getElementById('pd-flag'),item=window.EventStore?.getSelected();if(!host||!item||item.type==='capital-weather')return;if(host.closest('.pd-model-one')&&window.MainCardLayout){window.MainCardLayout.updateFlag(item);return;}const flag=image(item);if(flag)host.replaceChildren(flag);}
 window.BrazilStateFlags={uf,image,markup,isBrazil,load,updateMain};
})();
