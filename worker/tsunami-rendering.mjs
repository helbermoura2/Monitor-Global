import {bulletinSurface} from './image-rendering.mjs';
import {coastalMap} from './tsunami-bulletin.mjs';
let coastPromise;
async function coastalReferences(){if(!coastPromise){coastPromise=(async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),5000);try{const r=await fetch('https://monitorglobal.top/assets/tsunami/ne-50m-coastal-regions.geojson',{signal:c.signal});if(!r.ok)throw Error('Coastal references unavailable');return await r.json();}finally{clearTimeout(timer);}})().catch(()=>{coastPromise=null;return {features:[]};});}return coastPromise;}
const white='#edf6fa',muted='#b4c9ce',panel='#142a33',date=t=>Number.isFinite(t)?new Date(t).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+' BRT':'Horário não informado';
export async function renderTsunamiImage(model,{regions}={}){
 const surface=await bulletinSurface(),p=surface.p,box=(x,y,w,h,c=panel)=>p.roundRect(x,y,w,h,c);
 const fit=(s,z,max,bold=false)=>{s=String(s||'');while(p.measure(s,z,bold)>max&&s.length>3)s=s.slice(0,-4)+'...';return s;};
 const text=(s,x,y,z=14,c=white,b=false,max=724)=>p.text(fit(s,z,max,b),x,y,z,c,b);
 const lines=(s,x,y,z,max,count=2,c=white)=>{let current='',out=[];for(const word of String(s).split(/\s+/)){if(p.measure((current+' '+word).trim(),z)>max&&current){out.push(current);current=word;}else current=(current+' '+word).trim();}if(current)out.push(current);out.slice(0,count).forEach((s,i)=>text(i===count-1&&out.length>count?out.slice(i).join(' '):s,x,y+i*(z+4),z,c,false,max));};
 globalThis.QuakeCardLayout.drawBrand(p,'BOLETIM REGIONAL');
 text('TSUNAMI',28,66,34,white,true);text(model.label,28,110,22,white,true);
 const color=model.state==='unknown'?'#94a3b8':model.primary?.color||'#94a3b8';box(24,148,752,38);p.rect(24,148,4,38,color);text(model.title,38,158,17,color,true);
 const map=coastalMap(model,regions||await coastalReferences()),rect={x:24,y:198,width:752,height:412};let available=false;
 const stroke=(a,b,c,r=1.5)=>{ // Liang–Barsky clip prevents long/offscreen strokes or painting outside the map.
  let [x,y]=a,[dx,dy]=[b[0]-x,b[1]-y],lo=0,hi=1;const q=[x-rect.x,rect.x+rect.width-x,y-rect.y,rect.y+rect.height-y],d=[-dx,dx,-dy,dy];for(let i=0;i<4;i++){if(!d[i]){if(q[i]<0)return;}else{const t=q[i]/d[i];if(d[i]<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return;}}
  const length=Math.hypot(dx,dy)*(hi-lo),steps=Math.ceil(length);for(let i=0;i<=steps;i++){const t=lo+(hi-lo)*i/Math.max(1,steps);p.dot(x+dx*t,y+dy*t,r,c);}
 };
 if(map.frame){available=await surface.map(map.frame,rect,{labels:true});const f=map.frame,project=([lon,lat])=>{lon+=360*Math.round(((f.minLon+f.maxLon)/2-lon)/360);return [rect.x+(lon-f.minLon)/(f.maxLon-f.minLon)*rect.width,rect.y+(f.maxLat-lat)/(f.maxLat-f.minLat)*rect.height];};
  for(const l of map.lines)for(let i=1;i<l.points.length;i++)stroke(project(l.points[i-1]),project(l.points[i]),l.color,1.8);
  if(map.origin){const [x,y]=project(map.origin);p.dot(x,y,6,white);p.dot(x,y,4,'#e79788');box(Math.min(610,Math.max(32,x-74)),Math.min(575,Math.max(222,y+12)),156,25);text('Origem do sismo',Math.min(610,Math.max(32,x-74))+8,Math.min(575,Math.max(222,y+12))+6,12);}
  const mid=(f.minLat+f.maxLat)/2,kmSpan=(f.maxLon-f.minLon)*111.32*Math.max(.05,Math.cos(mid*Math.PI/180)),target=kmSpan*.17,unit=10**Math.floor(Math.log10(target)),km=[1,2,5,10].map(n=>n*unit).filter(n=>n<=target).at(-1)||unit,w=km/kmSpan*rect.width;
  box(550,560,208,39);p.rect(562,587,w,2,white);text('0',562,567,12);text(km+' km',562+w-30,567,12);
  if(map.origin){const lon=map.origin[0],lat=Math.max(-65,Math.min(65,map.origin[1])),span=22.5,frame={minLon:lon-span,maxLon:lon+span,minLat:lat-span*116/174,maxLat:lat+span*116/174,zoom:3};box(34,451,188,148);text('CONTEXTO REGIONAL',42,460,11);if(await surface.map(frame,{x:40,y:482,width:176,height:110})){p.dot(128,537,5,white);p.dot(128,537,3,'#e79788');}}
 }
 if(!available)text('Base cartográfica indisponível',38,211,14,muted);
 if(!map.lines.length)lines('Sem trechos costeiros identificáveis neste boletim. Consulte a fonte oficial.',38,292,19,700,2,muted);
 text('Referências das costas citadas; não representam inundação ou alcance em terra.',28,622,12,muted);
 text(map.unmapped.length?'Parte das regiões não possui referência cartográfica: consulte o boletim.':'Situação na emissão de cada boletim; outras costas podem ter situação diferente.',28,643,11,muted);
 text('SITUAÇÃO POR REGIÃO',28,675,19,white,true);
 for(const [i,g]of model.groups.slice(0,3).entries()){const y=707+i*78;box(24,y,752,71);p.dot(40,y+13,4,g.stale?'#94a3b8':g.color);text(g.label+(g.stale?' · última informação':''),53,y+4,15,g.stale?muted:g.color,true,704);text(g.regions.join(' · '),38,y+25,14,white,false,724);text(g.source+' · '+date(g.issuedAt)+(g.stale?' · atualização indisponível':''),38,y+47,12,muted,false,380);
  const heights=g.rows.map(r=>r.category).filter(v=>/\d.*(?:meters|metres|metros)/i.test(v));if(heights.length)text('Previsão: '+[...new Set(heights)].join(' · ').replace(/LESS THAN/gi,'menor que').replace(/GREATER THAN|MORE THAN/gi,'maior que').replace(/TO/gi,'a').replace(/METERS|METRES/gi,'m').replace(/(\d)\.(\d)/g,'$1,$2'),432,y+47,11,muted,false,328);
 }
 const scopeY=707+Math.min(3,model.groups.length)*78+6,timelineY=scopeY+31;
 text(model.groups.length>3?'Outras regiões e detalhes: consulte o boletim oficial.':'Cada situação vale apenas para as costas citadas.',28,scopeY,12,muted);
 text('ÚLTIMAS ATUALIZAÇÕES',28,timelineY,18,white,true);
 if(!model.history.length)text('Histórico ainda não disponível.',38,timelineY+33,14,muted);
 for(const [i,h]of model.history.slice(-2).entries()){const y=timelineY+31+i*57;p.dot(41,y+8,4,'#b4c9ce');if(!i&&model.history.length>1)p.rect(40,y+17,2,36,'#304950');text(date(h.time)+' · '+h.source,56,y,13,muted);text(h.label+': '+h.regions.join(' · '),56,y+20,14,white,false,710);}
 const depth=Number.isFinite(model.host?.originDepth)?' · '+model.host.originDepth.toLocaleString('pt-BR')+' km':'';
 const cols=[['ALTURA PREVISTA',model.primary?.rows.some(r=>/\d.*(?:meters|metres|metros)/i.test(r.category))?'Por região no boletim':'Não informada'],['CHEGADA PREVISTA','Não informada'],['SISMO ASSOCIADO',Number.isFinite(model.host?.originMag)?'M'+model.host.originMag.toFixed(1).replace('.',',')+depth:'Não informado']];
 cols.forEach(([label,value],i)=>{const x=24+i*254;box(x,1140,244,86);text(label,x+10,1153,11,muted,false,224);text(value,x+10,1180,16,white,true,224);});
 text('A magnitude do sismo, sozinha, não define a ameaça de tsunami.',28,1240,13,muted);
 box(24,1270,752,76);p.rect(24,1270,4,76,color);lines(model.state==='ended'?'Aviso encerrado apenas para as regiões indicadas. Siga as orientações finais da autoridade.':'Nas áreas sob aviso, siga as orientações das autoridades locais.',38,1285,18,716,2,white);
 text('Consulte a fonte oficial para regiões, horários e recomendações completas.',28,1370,12,muted);
 globalThis.QuakeCardLayout.drawFooter(p);
 return surface.png();
}
