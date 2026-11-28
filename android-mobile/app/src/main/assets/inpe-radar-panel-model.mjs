export function regionBounds(center){
 if(!center||!Number.isFinite(center.lon)||!Number.isFinite(center.lat)||center.lon< -75||center.lon> -33||center.lat< -34||center.lat>6)return null;
 const lon=Math.round(center.lon),lat=Math.round(center.lat);
 return [Math.max(-80,lon-3),Math.max(-36,lat-3),Math.min(-30,lon+3),Math.min(7,lat+3)];
}
export function describeRadar(radar){
 const f=radar?.frames?.at(-1);if(!f||!Number.isFinite(f.time))return null;
 const products=[];
 if(f.products.thumbnail)products.push('Imagem PNG');
 if(f.products.cappi3km)products.push('CAPPI 3 km');
 if(f.products.cappi15l)products.push('CAPPI 15 níveis');
 return {name:radar.radar,owner:radar.owner,time:f.time,products,count:radar.frames.length};
}
