/* Bound tile retention and skip the labels overlay during scripted journeys. */
(function(){
 'use strict';let journey=null;
 function options(){return {maxTileCacheSize:192,maxTileCacheZoomLevels:3,cancelPendingTileRequestsWhileZooming:true};}
 function finish(){const previous=journey;journey=null;if(!previous)return;try{if(previous.map.getLayer('esri-boundaries-places'))previous.map.setLayoutProperty('esri-boundaries-places','visibility',previous.visibility);}catch{}}
 function begin(m){finish();if(!m?.getLayer('esri-boundaries-places'))return;const visibility=m.getLayoutProperty('esri-boundaries-places','visibility')||'visible';journey={map:m,visibility};if(visibility!=='none')m.setLayoutProperty('esri-boundaries-places','visibility','none');}
 document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});window.addEventListener('pagehide',finish);
 window.MapRenderBudget={options,begin,finish,active:()=>!!journey};
})();
