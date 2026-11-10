/* Bandeiras locais oficiais para a arte do SITE (não muda o Telegram).
   País: fronteiras cartográficas; UF: polígonos estaduais + rótulos verificados.
   SVGs já disponíveis em assets/flags, sem dependências externas. */
(function(root){
 'use strict';
 const UFS=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
 const valid=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180;
 const norm=s=>String(s||'').trim().toUpperCase();
 function inRing(ring,lon,lat){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const a=ring[i],b=ring[j];
   if((a[1]>lat)!==(b[1]>lat)&&lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
 }
 function inFeature(feature,lon,lat){
  const geometry=feature.geometry||{},polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
  return polygons.some(rings=>rings?.[0]&&inRing(rings[0],lon,lat)&&!rings.slice(1).some(hole=>inRing(hole,lon,lat)));
 }
 let statesPromise;
 function states(){
  if(!statesPromise)statesPromise=fetch('assets/geography/br-states.json').then(r=>{if(!r.ok)throw Error('UF indisponível');return r.json();}).then(data=>data.features||[]).catch(e=>{statesPromise=null;throw e;});
  return statesPromise;
 }
 function emojiCountry(flag){
  const chars=[...String(flag||'')].map(x=>x.codePointAt(0));
  return chars.length===2&&chars.every(n=>n>=127462&&n<=127487)?String.fromCharCode(...chars.map(n=>n-127462+65)):null;
 }
 function stateFromLabel(item){
  for(const v of [item.uf,item.stateUf,item.stateCode,...(Array.isArray(item.ufs)?item.ufs:[])]){
   const match=norm(v).match(/^(?:BR-)?([A-Z]{2})$/);
   if(match&&UFS.has(match[1]))return match[1];
  }
  const match=String(item.place||'').match(/(?:\/|,\s*)(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)(?:\b|$)/i);
  return match?match[1].toUpperCase():null;
 }
 async function resolve(item){
  const lat=Number(item?.coords?.[1]),lon=Number(item?.coords?.[0]),hasCoords=valid(lat,lon);
  if(root.CountryBoundaries?.ready)try{await Promise.race([root.CountryBoundaries.ready,new Promise(resolve=>setTimeout(resolve,2500))]);}catch{}
  const geo=hasCoords?root.CountryBoundaries?.lookup(lat,lon):null;
  let country=norm(geo?.countryCode||item?.countryCode||emojiCountry(item?.bandeira));
  if(!/^[A-Z]{2}$/.test(country))country='';
  let uf=null;
  if(hasCoords&&country==='BR')try{
   const features=await states();
   const candidates=features.filter(f=>UFS.has(norm(f.properties?.uf))&&inFeature(f,lon,lat));
   if(candidates.length===1)uf=norm(candidates[0].properties.uf);
  }catch{}
  if(country==='BR'&&!uf)uf=stateFromLabel(item);
  // A bandeira estadual só aparece com identidade brasileira confirmada.
  return {countryCode:country||null,stateCode:country==='BR'?uf:null,brazil:country==='BR'};
 }
 const cached=new Map();
 function load(kind,code){
  if(!code)return Promise.resolve(null);
  if(!/^[A-Z]{2}$/.test(code))return Promise.resolve(null);
  const url=kind==='state'?'assets/flags/br-states/'+code+'.svg':'assets/flags/countries/'+code.toLowerCase()+'.svg';
  if(cached.has(url))return cached.get(url);
  const promise=new Promise(resolve=>{
   const img=new Image();const timer=setTimeout(()=>resolve(null),3500);
   img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);resolve(null);};img.src=url;
  });
  cached.set(url,promise);if(cached.size>70)cached.delete(cached.keys().next().value);
  return promise;
 }
 async function images(meta){const [country,state]=await Promise.all([load('country',meta.countryCode),load('state',meta.stateCode)]);return {country,state};}
 function isBrazil(item){
  if(item?.countryCode==='BR'||item?.bandeira==='🇧🇷')return true;
  const lat=Number(item?.coords?.[1]),lon=Number(item?.coords?.[0]);
  if(valid(lat,lon)&&root.CountryBoundaries?.lookup(lat,lon)?.countryCode==='BR')return true;
  return false;
 }
 root.QuakeSiteFlags={resolve,images,isBrazil,emojiCountry,stateFromLabel};
})(window);
