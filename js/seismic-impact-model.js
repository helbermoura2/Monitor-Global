/* Shared GlobalQuake Gen2 model (MIT), Natural Earth land (public domain).
   Geodesic clipping runs on/off the UI thread with identical physical inputs. */
(function(root){
'use strict';
const SCALE=[[.5,'I',[170,170,170]],[1,'II',[200,190,240]],[2.1,'III',[132,162,232]],[5,'IV',[130,214,255]],[11,'V',[85,242,15]],[26,'VI',[255,255,0]],[60,'VII',[255,200,0]],[140,'VIII',[255,120,0]],[321.8,'IX',[255,0,0]],[740,'X',[190,0,0]],[1702,'XI',[130,0,0]],[3000,'XII',[65,0,0]]];
function pga(mag,depth,km){
 const h=Math.max(0,Number(depth)||0),correction=Math.log10(h+160)-Math.log10(160);
 const adjusted=mag+.4*correction,distance=Math.sqrt(h*h+4*6379*(6379-h)*Math.sin(km/(2*6379))**2)/(1+.75*correction);
 return Math.pow(10,adjusted*.575)/(.36*Math.pow(distance,1.25+adjusted/22)+10);
}
function extent(mag,depth){let lo=0,hi=12000;for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(pga(mag,depth,mid)>=.5)lo=mid;else hi=mid;}return lo;}
function color(value){let i=0;while(i<SCALE.length-1&&value>=SCALE[i+1][0])i++;const a=SCALE[i],b=SCALE[Math.min(i+1,SCALE.length-1)];const t=a===b?0:Math.max(0,Math.min(1,Math.log(value/a[0])/Math.log(b[0]/a[0])));return 'rgb('+a[2].map((v,j)=>Math.round(v+(b[2][j]-v)*t)).join(',')+')';}
function destinoGeodesico(lat, lng, distanciaKm, azimuteGraus, earthRadius = 6371) {
    const R = earthRadius; // km; as frentes usam o mesmo raio do GlobalQuake
    const delta = Math.max(0, distanciaKm) / R;
    const theta = azimuteGraus * Math.PI / 180;
    const phi1 = lat * Math.PI / 180;
    const lambda1 = lng * Math.PI / 180;
    const senPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
    const phi2 = Math.asin(Math.max(-1, Math.min(1, senPhi2)));
    const y = Math.sin(theta) * Math.sin(delta) * Math.cos(phi1);
    const x = Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2);
    const lambda2 = lambda1 + Math.atan2(y, x);
    const lngNorm = ((lambda2 * 180 / Math.PI + 540) % 360) - 180;
    return [lngNorm, phi2 * 180 / Math.PI];
}
function anelGeodesico(lng, lat, raioKm, pontos = 128, earthRadius = 6371) {
    const coords = [];
    let ajuste = 0;
    let lngAnterior = null;
    for (let i = 0; i <= pontos; i++) {
        const [lngBruto, latPonto] = destinoGeodesico(lat, lng, raioKm, (360 * i) / pontos, earthRadius);
        if (lngAnterior !== null) {
            const salto = lngBruto + ajuste - lngAnterior;
            if (salto > 180) ajuste -= 360;
            else if (salto < -180) ajuste += 360;
        }
        const lngContinuo = lngBruto + ajuste;
        coords.push([lngContinuo, latPonto]);
        lngAnterior = lngContinuo;
    }
    return coords;
}

const landBounds=new WeakMap();
function shiftedLand(polygons,minLng,maxLng){
 let bounds=landBounds.get(polygons);if(!bounds){bounds=polygons.map(p=>{let lo=Infinity,hi=-Infinity;for(const [x] of p[0]){lo=Math.min(lo,x);hi=Math.max(hi,x);}return {p,lo,hi};});landBounds.set(polygons,bounds);}
 return bounds.flatMap(({p,lo,hi})=>[-360,0,360].filter(s=>hi+s>=minLng&&lo+s<=maxLng).map(s=>p.map(r=>r.map(([x,y])=>[x+s,y]))));
}
function* bands(c,land){
 const outer=extent(c.mag,c.depth);if(outer<1)return;
 const ring=r=>{
  const points=anelGeodesico(c.lng,c.lat,r,160),first=points[0],last=points[points.length-1];
  // Rings crossing a pole wind through 360° of longitude. Close along the
  // pole rather than drawing a chord across the other side of the map.
  if(Math.abs(last[0]-first[0])>180){const pole=c.lat>=0?90:-90;points.push([last[0],pole],[first[0],pole],first);}
  return points;
 };
 const domain=[ring(outer)];
 // Clip once to the region before intersecting the 48 smooth intensity bands.
 const xs=domain[0].map(p=>p[0]);
 const clipped=polygonClipping.intersection(shiftedLand(land,Math.min(...xs),Math.max(...xs)),domain);
 for(let i=0;i<48;i++){
  const inner=outer*i/48,r=outer*(i+1)/48,mid=(inner+r)/2;
  const band=[ring(r)];if(inner>0)band.push(ring(inner).reverse());
  const coordinates=polygonClipping.intersection(clipped,band);
  yield coordinates.length?{type:'Feature',properties:{distanceKm:r,pga:pga(c.mag,c.depth,mid),color:color(pga(c.mag,c.depth,mid))},geometry:{type:'MultiPolygon',coordinates}}:null;
 }
 return;
}

function geometry(c,land){return {type:'FeatureCollection',features:Array.from(bands(c,land)).filter(Boolean)};}
function vertices(data){let count=0;for(const f of data.features)for(const p of f.geometry.coordinates)for(const ring of p)count+=ring.length;return count;}
root.SeismicImpactModel={pga,extent,color,bands,geometry,vertices};
})(globalThis);
