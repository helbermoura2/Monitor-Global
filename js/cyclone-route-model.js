/* Official point metadata only; no forecast hours or winds inferred from geometry. */
(function(root){'use strict';
const finite=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(v)),point=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
function metadata(fields,name=''){
 const values={};for(const [k,v]of Object.entries(fields||{}))values[k.toLowerCase().replace(/[^a-z0-9]/g,'')]=String(v).trim().slice(0,160);
 const read=keys=>keys.map(k=>values[k]).find(v=>v!==undefined),number=keys=>{const v=read(keys);return finite(v)?Number(v):null;};
 const hours=number(['tau','fcstpd','forecasthour','forecastperiod']),windKt=number(['maxwind','maxwindkt','windkt','vmax','maxwindknots','maximumwindkt','maximumwindknots']),windKmh=number(['windkmh','maxwindkmh']);
 const time=read(['validtime','validtimeutc','validat','validdatetime']);const at=time&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(time)?Date.parse(time):NaN;
 return {name:String(name||'Posição publicada').slice(0,100),hours:hours!==null&&hours>=0&&hours<=240?hours:null,windKmh:windKmh!==null&&windKmh>=0&&windKmh<=500?windKmh:windKt!==null&&windKt>=0&&windKt<=270?Math.round(windKt*1.852):null,validAt:Number.isFinite(at)?at:null};
}
function rows(data){return (data?.pontos||[]).filter(f=>point(f.geometry?.coordinates)).slice(0,24).map((f,i)=>({id:i,coords:f.geometry.coordinates.slice(0,2),...metadata(f.properties?.fields,f.properties?.name)}));}
function line(coords){
 const segments=[];let current=[];for(const p of coords.filter(point)){const next=p.slice(0,2),last=current.at(-1);if(last&&Math.abs(next[0]-last[0])>180){const adjusted=next[0]+(next[0]>last[0]?-360:360),edge=adjusted>last[0]?180:-180,t=(edge-last[0])/(adjusted-last[0]),lat=last[1]+t*(next[1]-last[1]);current.push([edge,lat]);if(current.length>1)segments.push(current);current=[[-edge,lat]];}current.push(next);}if(current.length>1)segments.push(current);
 return segments.length===1?{type:'LineString',coordinates:segments[0]}:{type:'MultiLineString',coordinates:segments};
}

function unwrapRing(ring){const out=[];for(const p of ring){let x=p[0];const previous=out.at(-1);if(previous){while(x-previous[0]>180)x-=360;while(x-previous[0]<-180)x+=360;}out.push([x,p[1]]);}return out;}
function jma(data,q,now=Date.now()){
 if(!Array.isArray(data)||!q?.coords)return null;
 const title=data.find(r=>r.part==='title'),analysis=data.find(r=>r.advancedHours===0),issued=Date.parse(title?.issue?.UTC||'');
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^(typhoon|tufao|cyclone|ciclone|hurricane|furacao)\s+/,'').replace(/-\d{2}$/,'').replace(/[^a-z0-9]/g,'');
 if(!title?.name?.en||normalize(title.name.en)!==normalize(q.place)||!Number.isFinite(issued)||now-issued>12*3600000||issued-now>600000)return null;
 const swap=p=>Array.isArray(p)?[p[1],p[0]]:null,c=swap(analysis?.center);if(!point(c))return null;
 const rad=x=>x*Math.PI/180,a=rad(c[1]-q.coords[1]),b=rad(c[0]-q.coords[0]),h=Math.sin(a/2)**2+Math.cos(rad(c[1]))*Math.cos(rad(q.coords[1]))*Math.sin(b/2)**2;
 if(6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)))>600)return null;
 const future=data.filter(r=>finite(r.advancedHours)&&r.advancedHours>0&&r.advancedHours<=240&&point(swap(r.center))&&Number.isFinite(Date.parse(r.validtime?.UTC||''))).sort((a,b)=>a.advancedHours-b.advancedHours).slice(0,12);
 if(!future.length)return null;
 const feature=(geometry,properties={})=>({type:'Feature',geometry,properties}),poligonos=[],pontos=[analysis,...future].map(r=>feature({type:'Point',coordinates:swap(r.center)},{name:r.advancedHours===0?'Análise JMA':'+'+r.advancedHours+' h',fields:{TAU:String(r.advancedHours),validtime:r.validtime.UTC}}));
 // Published probability radii in metres, not wind radii. Geodesic circles only.
 for(const r of future){const center=swap(r.center),radius=r.probabilityCircle?.radius;if(!finite(radius)||radius<=0||radius>3000000)continue;
  const ring=[],d=Number(radius)/6371000,lat=rad(center[1]),lng=rad(center[0]);for(let i=0;i<=64;i++){const brg=i/64*2*Math.PI,y=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(brg)),x=lng+Math.atan2(Math.sin(brg)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(y));ring.push([x*180/Math.PI,y*180/Math.PI]);}poligonos.push(feature({type:'Polygon',coordinates:[ring]},{kind:'probability',hours:r.advancedHours}));
  const tangents=r.probabilityCircle.tangent;if(Array.isArray(tangents)&&tangents.length===2&&tangents.every(l=>Array.isArray(l)&&l.length===2&&l.every(p=>point(swap(p))))){const quad=[swap(tangents[0][0]),swap(tangents[0][1]),swap(tangents[1][0]),swap(tangents[1][1]),swap(tangents[0][0])];poligonos.push(feature({type:'Polygon',coordinates:[unwrapRing(quad)]},{kind:'probability-tangent',hours:r.advancedHours}));}
 }
 return {provider:'JMA',issuedAt:issued,linhas:[feature(line([c,...future.map(r=>swap(r.center))]))],pontos,poligonos,history:(analysis.track?.typhoon||[]).map(swap).filter(point).slice(-200)};
}
const api={metadata,rows,line,point,jma};root.CycloneRouteModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
