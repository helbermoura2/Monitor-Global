/* Bound tile retention, including MapLibre's separate pool of reusable GPU textures. */
(function(){
 'use strict';let journey=null,bound=null,originalSave=null,wrappedSave=null,destroyed=0;
 const spareLimit=()=> (window.MobileEnergyBudget?.mobile?.()?8:16)*1024*1024;
 function options(){const mobile=window.MobileEnergyBudget?.mobile?.();return {maxTileCacheSize:mobile?96:192,maxTileCacheZoomLevels:mobile?2:3,cancelPendingTileRequestsWhileZooming:true};}
 // RGBA + complete mip chain estimate. This is not a measurement of GPU/process RAM.
 function weight(texture){const s=texture?.size;return Array.isArray(s)&&s.length===2&&s.every(n=>Number.isFinite(n)&&n>0)?Math.ceil(s[0]*s[1]*4*4/3):0;}
 function pool(painter){return Object.values(painter?._tileTextures||{}).filter(Array.isArray);}
 function trim(painter=bound?.painter,limit=spareLimit()){
  const bins=pool(painter);let bytes=0,count=0;for(const bin of bins)for(const t of bin){bytes+=weight(t);count++;}
  // Only spare textures surrendered by MapLibre. Active/cached tile textures are untouched.
  for(const bin of bins)while(bin.length&&(bytes>limit||count>32||limit===0)){
   const texture=bin[0];if(typeof texture?.destroy!=='function')break;bin.shift();bytes-=weight(texture);count--;texture.destroy();destroyed++;
  }
 }
 function detach(){if(bound?.painter?.saveTileTexture===wrappedSave)bound.painter.saveTileTexture=originalSave;bound=null;originalSave=wrappedSave=null;}
 function attach(m){
  if(bound===m)return;detach();const p=m?.painter;
  // Guard the pinned renderer's internal shape; a future incompatible renderer is left intact.
  if(!p||typeof p.saveTileTexture!=='function'||!p._tileTextures)return;
  bound=m;originalSave=p.saveTileTexture;const save=originalSave;
  wrappedSave=function(texture){const result=save.call(this,texture);trim(this);return result;};p.saveTileTexture=wrappedSave;trim(p);
  m.on?.('remove',()=>{if(bound===m){trim(p,0);detach();}});
 }
 function stats(){try{const m=typeof map==='undefined'?bound:map;if(!m?.style)return null;const caches=Object.values(m?.style?.tileManagers||m?.style?.sourceCaches||m?.style?._sourceCaches||{}),spare=pool(m.painter).flat();return {sources:caches.length,activeTiles:caches.reduce((n,c)=>n+Object.keys(c._tiles||{}).length,0),cachedTiles:caches.reduce((n,c)=>n+(c._cache?.order?.length||c._cache?._order?.length||c._cache?._data?.size||0),0),spareTextures:spare.length,estimatedSpareTextureBytes:spare.reduce((n,t)=>n+weight(t),0),maxEstimatedSpareTextureBytes:spareLimit(),disposedSpareTextures:destroyed,sparePoolBound:bound===m};}catch{return null;}}
 function finish(){const previous=journey;journey=null;if(!previous)return;try{if(previous.map.getLayer('esri-boundaries-places'))previous.map.setLayoutProperty('esri-boundaries-places','visibility',previous.visibility);}catch{}}
 function begin(m){finish();if(!m?.getLayer('esri-boundaries-places'))return;const visibility=m.getLayoutProperty('esri-boundaries-places','visibility')||'visible';journey={map:m,visibility};if(visibility!=='none')m.setLayoutProperty('esri-boundaries-places','visibility','none');}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){finish();trim(undefined,0);}});window.addEventListener('pagehide',()=>{finish();trim(undefined,0);});
 window.MapRenderBudget={options,stats,begin,finish,attach,active:()=>!!journey};
})();
