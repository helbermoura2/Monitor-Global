/* Bound tile retention and skip the labels overlay during scripted journeys. */
(function(){
 'use strict';let journey=null;
 function options(){const mobile=window.MobileEnergyBudget?.mobile?.();return {maxTileCacheSize:mobile?96:192,maxTileCacheZoomLevels:mobile?2:3,cancelPendingTileRequestsWhileZooming:true};}
 function stats(){try{const m=typeof map==='undefined'?null:map;if(!m?.style)return null;const caches=Object.values(m?.style?.tileManagers||m?.style?.sourceCaches||m?.style?._sourceCaches||{});return {sources:caches.length,activeTiles:caches.reduce((n,c)=>n+Object.keys(c._tiles||{}).length,0),cachedTiles:caches.reduce((n,c)=>n+(c._cache?.order?.length||c._cache?._order?.length||c._cache?._data?.size||0),0)};}catch{return null;}}
 function finish(){const previous=journey;journey=null;if(!previous)return;try{if(previous.map.getLayer('esri-boundaries-places'))previous.map.setLayoutProperty('esri-boundaries-places','visibility',previous.visibility);}catch{}}
 function begin(m){finish();if(!m?.getLayer('esri-boundaries-places'))return;const visibility=m.getLayoutProperty('esri-boundaries-places','visibility')||'visible';journey={map:m,visibility};if(visibility!=='none')m.setLayoutProperty('esri-boundaries-places','visibility','none');}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});window.addEventListener('pagehide',finish);
 window.MapRenderBudget={options,stats,begin,finish,active:()=>!!journey};
})();
