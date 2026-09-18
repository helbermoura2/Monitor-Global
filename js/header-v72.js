(function(){
  var mq = window.matchMedia('(max-width:900px)');
  var mqNarrowPortrait = window.matchMedia('(max-width:700px) and (orientation:portrait)');
  var ro = null;

  /* A partir daqui, este script não mexe mais no celular em pé com largura
     <=700px — esse caso agora tem implementação própria e mais simples em
     js/mobile-portrait-clean.js + css/mobile-portrait-clean.css, sem
     estilo inline forçado brigando com o CSS. Este script continua
     cuidando só da faixa 701-900px (tablets/celular deitado). */
  function ativo(){ return mq.matches && !mqNarrowPortrait.matches; }

  function setImp(el, props){
    if(!el) return;
    Object.keys(props).forEach(function(k){ el.style.setProperty(k, String(props[k]), 'important'); });
  }
  function clearProps(el, keys){
    if(!el) return;
    keys.forEach(function(k){ el.style.removeProperty(k); });
  }

  var LAYOUT_PROPS = ['display','flex-direction','flex-wrap','flex','order','align-items','justify-content',
    'gap','position','top','right','left','bottom','width','height','min-width','max-width','min-height',
    'margin','margin-left','margin-right','padding','overflow','overflow-x','grid-template-rows',
    'white-space','border-left'];

  function els(){
    return {
      app: document.getElementById('app'),
      strip: document.getElementById('top-strip'),
      mainrow: document.querySelector('#top-strip > .ts-mainrow'),
      actions: document.querySelector('#top-strip > .ts-actions'),
      kpis: document.querySelector('#top-strip > .ts-kpis'),
      kpiEventos: document.getElementById('kpibox-eventos'),
      kpiMaior: document.getElementById('kpibox-maior'),
      btnRadarHeader: document.getElementById('btn-radar-header'),
      kpiSp: document.getElementById('kpibox-sp'),
      kpiFeels: document.getElementById('kpi-feels'),
      kpiBrent: document.getElementById('kpibox-brent'),
      clock: document.getElementById('kpi-relogio'),
      btnSom: document.getElementById('btn-som-header'),
      meta: document.querySelector('#top-strip > .ts-meta'),
      mobileWeatherMini: document.querySelector('#mobile-probar .mobile-weather-mini'),
      controlbar: document.getElementById('ux-controlbar'),
      controlsBox: document.getElementById('controls'),
      chipsWrap: document.getElementById('chips-scroll-wrap'),
      freshBar: document.getElementById('freshness-bar'),
      searchWrap: document.getElementById('ux-search-wrap'),
      v70: document.getElementById('v70-header-row'),
      ticker: document.getElementById('latest-event-ticker')
    };
  }

  function syncTickerTop(){
    if(!ativo()) return;
    var strip = document.getElementById('top-strip');
    var ticker = document.getElementById('latest-event-ticker');
    if(!strip || !ticker) return;
    var height = strip.getBoundingClientRect().height;
    if(height > 0) ticker.style.setProperty('top', height + 'px', 'important');
  }

  function apply(){
    var e = els();
    if(ativo()){
      setImp(e.app, {'grid-template-rows':'auto 1fr'});
      setImp(e.strip, {display:'flex','flex-direction':'row','flex-wrap':'wrap','align-items':'center',
        height:'auto','min-height':'auto',padding:'6px 10px',gap:'6px 8px',overflow:'visible'});
      setImp(e.mainrow, {display:'flex',order:'1',flex:'0 0 auto',width:'auto',height:'auto'});
      setImp(e.actions, {display:'none'});
      setImp(e.kpis, {display:'flex',order:'2',flex:'1 1 auto','align-items':'center',
        'justify-content':'flex-end',gap:'8px',position:'static',right:'auto',top:'auto',
        width:'auto',height:'auto',margin:'0',overflow:'visible'});
      setImp(e.kpiEventos, {display:'none'});
      setImp(e.kpiMaior, {display:'none'});
      setImp(e.btnRadarHeader, {display:'none'});
      setImp(e.kpiSp, {order:'1','margin-right':'auto',display:'flex','flex-direction':'row',
        'align-items':'center',gap:'6px',flex:'0 1 auto','min-width':'0',padding:'0','border-left':'none'});
      setImp(e.kpiFeels, {display:'none'});
      setImp(e.kpiBrent, {order:'3',position:'static',width:'auto','min-width':'0','max-width':'none',
        flex:'0 0 auto',margin:'0 4px',padding:'0','border-left':'none'});
      setImp(e.clock, {order:'4',position:'static',width:'auto','max-width':'none',margin:'0 4px'});
      setImp(e.btnSom, {order:'5',flex:'0 0 auto',margin:'0'});
      setImp(e.meta, {display:'none'});
      setImp(e.mobileWeatherMini, {display:'none'});
      setImp(e.controlbar, {display:'flex',order:'8',flex:'1 1 100%',width:'100%',
        'flex-wrap':'nowrap','align-items':'center',gap:'6px','overflow-x':'auto',position:'static',
        left:'auto',right:'auto',bottom:'auto',height:'auto',padding:'4px 2px'});
      setImp(e.controlsBox, {flex:'0 0 92px',width:'92px',padding:'0'});
      setImp(e.chipsWrap, {flex:'1 1 auto','min-width':'0'});
      setImp(e.freshBar, {flex:'0 0 auto',display:'flex',gap:'8px','white-space':'nowrap'});
      setImp(e.searchWrap, {display:'none'});
      setImp(e.v70, {display:'flex',order:'9',flex:'1 1 100%',width:'100%'});
      requestAnimationFrame(syncTickerTop);
      if(e.strip && 'ResizeObserver' in window && !ro){
        ro = new ResizeObserver(syncTickerTop);
        ro.observe(e.strip);
      }
    } else {
      [e.app,e.strip,e.mainrow,e.actions,e.kpis,e.kpiEventos,e.kpiMaior,e.btnRadarHeader,
       e.kpiSp,e.kpiFeels,e.kpiBrent,e.clock,e.btnSom,e.meta,e.mobileWeatherMini,e.controlbar,
       e.controlsBox,e.chipsWrap,e.freshBar,e.searchWrap,e.v70].forEach(function(el){
        clearProps(el, LAYOUT_PROPS);
      });
      if(e.ticker) e.ticker.style.removeProperty('top');
      if(ro){ ro.disconnect(); ro = null; }
    }
  }
  // v73: ordena visualmente as seções empilhadas do cabeçalho mobile,
  // sem depender de "top" calculado (fonte dos sobrepostos).
  function orderStack(){
    var e = els();
    if(!ativo()) return;
    var probarMobile = document.getElementById('mobile-probar');
    var topProbar = document.getElementById('top-probar');
    setImp(topProbar, {display:'none'});
    setImp(probarMobile, {order:'6', flex:'1 1 100%', width:'100%'});
  }
  var _apply = apply;
  apply = function(){ _apply(); orderStack(); };
  if(document.readyState!=='loading') orderStack();

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', apply, {once:true});
  } else { apply(); }
  setTimeout(apply, 1200);
  setTimeout(apply, 3000);
  window.addEventListener('orientationchange', function(){ setTimeout(apply, 250); });
  if(mq.addEventListener) mq.addEventListener('change', apply); else if(mq.addListener) mq.addListener(apply);
  if(mqNarrowPortrait.addEventListener) mqNarrowPortrait.addEventListener('change', apply); else if(mqNarrowPortrait.addListener) mqNarrowPortrait.addListener(apply);
  window.addEventListener('resize', function(){ clearTimeout(window.__hv72rt); window.__hv72rt = setTimeout(apply, 200); });
})();

