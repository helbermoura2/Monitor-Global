(function(){
  function removeFloatingHud(){
    ['mg70-hud','mg-global-hud','radar-legend-pro','replay-panel-pro'].forEach(function(id){
      var el=document.getElementById(id);
      if(el) el.remove();
    });
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', removeFloatingHud, {once:true});
  } else {
    removeFloatingHud();
  }
  setTimeout(removeFloatingHud, 1200);
})();

