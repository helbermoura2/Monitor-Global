(function(){
  var mq = window.matchMedia('(max-width:900px)');
  var mqNarrowPortrait = window.matchMedia('(max-width:700px) and (orientation:portrait)');
  var mqPortrait = window.matchMedia('(orientation:portrait)');
  var ro = null;

  /* A partir daqui, este script não mexe mais no celular em pé com largura
     <=700px — esse caso agora tem implementação própria e mais simples em
     js/mobile-portrait-clean-toggle.js, sem estilo inline forçado brigando
     com o CSS. Este script continua cuidando da faixa 701-900px (tablets
     em pé ou celular deitado). v28.3 — em retrato (701-900px) o cabeçalho
     agora usa o mesmo desenho de 3 faixas do celular (título, KPIs,
     filtros), em vez do fluxo "linha que quebra" antigo; só o celular/
     tablet deitado continua com o layout anterior. */
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
    'gap','position','top','right','left','bottom','width','height','min-width','max-width','min-height','max-height',
    'margin','margin-left','margin-right','padding','padding-left','overflow','overflow-x','overflow-y','grid-template-rows',
    'white-space','text-overflow','border-left','border-top','border-bottom','box-sizing'];

  var origFabParent = null, origFabNext = null;
  function rememberFabParent(fab){
    if(fab && !origFabParent){ origFabParent = fab.parentElement; origFabNext = fab.nextElementSibling; }
  }
  function restoreFabParent(fab){
    if(!fab || !origFabParent || fab.parentElement === origFabParent) return;
    if(origFabNext && origFabNext.parentElement === origFabParent) origFabParent.insertBefore(fab, origFabNext);
    else origFabParent.appendChild(fab);
  }

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
      chipsRow: document.getElementById('chips-row'),
      chipsScrollLeft: document.getElementById('chips-scroll-left'),
      chipsScrollRight: document.getElementById('chips-scroll-right'),
      freshBar: document.getElementById('freshness-bar'),
      searchWrap: document.getElementById('ux-search-wrap'),
      v70: document.getElementById('v70-header-row'),
      ticker: document.getElementById('latest-event-ticker'),
      mapWrap: document.getElementById('mapWrap'),
      title: document.querySelector('#top-strip .ts-title'),
      live: document.querySelector('#top-strip .live-indicator'),
      fab: document.getElementById('mobile-fab-bar'),
      fabMenu: document.getElementById('fab-menu'),
      fabEvents: document.getElementById('fab-events'),
      fabAudio: document.getElementById('fab-audio')
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

  function applyPortrait(e){
    /* Mesmo desenho de 3 faixas do celular (js/mobile-portrait-clean-toggle.js):
       título+AO VIVO+menu / 📍clima·🛢️Brent·relógio / filtros — para que o
       cabeçalho não mude de estrutura ao cruzar os 700px em retrato.
       #app vira flex-column (não grid): o #latest-event-ticker é filho
       direto de #app mas não tem grid-area — num grid só com "top"/"map"
       ele caía numa 3ª linha implícita depois do mapa (quase 900px mais
       embaixo!). Em flex, ele simplesmente segue a ordem do HTML, logo
       depois do cabeçalho — igual já funciona no celular. */
    setImp(e.app, {display:'flex','flex-direction':'column',height:'100dvh',width:'100vw'});
    setImp(e.mapWrap, {flex:'1 1 auto','min-height':'0',height:'auto',position:'relative',overflow:'hidden'});
    /* Sem border-bottom — ver comentário equivalente em
       js/mobile-portrait-clean-toggle.js. */
    setImp(e.strip, {display:'flex','flex-direction':'column','flex-wrap':'nowrap',
      height:'auto','min-height':'0',padding:'8px 14px 6px',gap:'0',overflow:'visible','border-bottom':'none'});
    try {
      rememberFabParent(e.fab);
      if(e.fab && e.mainrow && e.fab.parentElement !== e.mainrow){
        e.mainrow.appendChild(e.fab);
      }
    } catch(err){ window.__hv72ReparentErr = String(err); }
    setImp(e.mainrow, {display:'flex',order:'1','align-items':'center','justify-content':'flex-start',
      gap:'8px',flex:'0 0 44px',width:'100%',height:'44px','min-height':'44px','min-width':'0',
      'box-sizing':'border-box',padding:'0'});
    setImp(e.title, {flex:'1 1 auto','min-width':'0','max-width':'none',width:'auto',overflow:'hidden','text-overflow':'ellipsis','white-space':'nowrap'});
    setImp(e.live, {flex:'0 0 auto'});
    setImp(e.actions, {display:'none'});
    setImp(e.kpiEventos, {display:'none'});
    setImp(e.kpiMaior, {display:'none'});
    setImp(e.btnRadarHeader, {display:'none'});
    setImp(e.btnSom, {display:'none'});
    /* Faixa de KPIs mais fina (24px, era 34px) — vira "legenda" do
       título, ver comentário equivalente em
       js/mobile-portrait-clean-toggle.js. */
    setImp(e.kpis, {display:'flex',order:'2','flex-direction':'row','flex-wrap':'nowrap','align-items':'center',
      'justify-content':'space-between',gap:'10px',margin:'4px 0 0',width:'100%','min-width':'0',
      flex:'0 0 24px',height:'24px','min-height':'24px','max-height':'24px',overflow:'hidden',
      padding:'0','border-top':'1px solid rgba(72,216,255,.14)'});
    setImp(e.kpiSp, {order:'1',display:'flex','flex-direction':'row','align-items':'center',gap:'6px',
      flex:'1 1 auto','min-width':'0',margin:'0',padding:'0','border-left':'none',overflow:'hidden'});
    /* Nome da cidade trunca com reticências; vento continua saindo, mas a
       sensação térmica volta a aparecer — igual ao celular
       (js/mobile-portrait-clean-toggle.js). */
    var spLabel = document.querySelector('#kpibox-sp .ts-kpi-label');
    var spRow = document.querySelector('#kpibox-sp .ts-kpi-row');
    var spIcon = document.getElementById('kpi-wx-icon');
    setImp(spLabel, {flex:'1 1 auto','min-width':'0',overflow:'hidden','text-overflow':'ellipsis','white-space':'nowrap'});
    setImp(spRow, {flex:'0 0 auto',display:'flex','align-items':'baseline',gap:'3px'});
    setImp(e.kpiFeels, {display:'inline-block','flex':'0 0 auto'});
    setImp(spIcon, {flex:'0 0 auto'});
    setImp(document.getElementById('kpi-wind'), {display:'none'});
    setImp(e.kpiBrent, {order:'2',display:'flex','flex-direction':'row','align-items':'center',gap:'4px',
      position:'static',width:'auto','min-width':'0','max-width':'none',flex:'0 0 auto',margin:'0',
      'padding-left':'10px','border-left':'1px solid rgba(72,216,255,.14)','white-space':'nowrap'});
    setImp(e.clock, {order:'3',display:'flex','align-items':'center',position:'static',width:'auto',
      'max-width':'none',flex:'0 0 auto',margin:'0','padding-left':'10px',
      'border-left':'1px solid rgba(72,216,255,.14)','white-space':'nowrap'});
    setImp(e.fab, {display:'flex',position:'static',top:'auto',right:'auto',left:'auto',bottom:'auto',
      width:'40px',height:'40px','min-width':'40px','min-height':'40px',flex:'0 0 40px',order:'3',
      gap:'0',margin:'0',padding:'0'});
    setImp(e.fabMenu, {display:'flex',width:'40px',height:'40px','min-width':'40px','min-height':'40px',
      position:'static',margin:'0'});
    setImp(e.fabEvents, {display:'none'});
    setImp(e.fabAudio, {display:'none'});
    setImp(e.meta, {display:'none'});
    setImp(e.mobileWeatherMini, {display:'none'});
    /* Faixa full-bleed (margin lateral -14px cancela o padding do
       #top-strip; width explícito por causa do stretch assimétrico
       do flexbox com margem negativa) — ver comentário equivalente em
       js/mobile-portrait-clean-toggle.js. */
    setImp(e.ticker, {display:'flex',position:'static',top:'auto',left:'auto',right:'auto',bottom:'auto',
      width:'calc(100vw + 28px)','max-width':'none',height:'auto',margin:'-3px -14px 0',padding:'8px 14px'});
    /* Magnitude + chips na mesma linha, com os chips rolando na
       horizontal (setinhas ‹ › visíveis) — mesmo esquema do celular
       (js/mobile-portrait-clean-toggle.js). */
    setImp(e.controlbar, {display:'flex',order:'8',position:'static',top:'auto',left:'auto',right:'auto',
      bottom:'auto','flex-direction':'row','flex-wrap':'nowrap','align-items':'center',flex:'0 0 auto',
      width:'100%',height:'auto','max-height':'40px',overflow:'hidden',margin:'6px 0 0',padding:'6px 0 0',gap:'8px',
      'border-top':'1px solid rgba(72,216,255,.14)'});
    setImp(e.controlsBox, {display:'flex','flex-direction':'row','align-items':'center',gap:'5px',
      flex:'0 0 86px',width:'86px','min-width':'86px','max-width':'86px',padding:'0',order:'1'});
    var magLabel = document.querySelector('.mag-slider-row span:first-child');
    setImp(magLabel, {display:'none'});
    setImp(e.chipsWrap, {display:'flex','align-items':'center',flex:'1 1 auto','min-width':'0',
      width:'auto',height:'30px','max-height':'30px','overflow-y':'hidden','overflow-x':'hidden',order:'2'});
    setImp(e.chipsRow, {display:'flex','flex-wrap':'nowrap','overflow-x':'auto',height:'30px','max-height':'30px',
      width:'auto','min-width':'0','max-width':'none',flex:'1 1 auto',
      padding:'0',margin:'0',gap:'6px','align-items':'center'});
    setImp(e.chipsScrollLeft, {display:'flex',flex:'0 0 22px',width:'22px',height:'26px',
      position:'static',top:'auto',bottom:'auto',margin:'0'});
    setImp(e.chipsScrollRight, {display:'flex',flex:'0 0 22px',width:'22px',height:'26px',
      position:'static',top:'auto',bottom:'auto',margin:'0'});
    /* Sismos/Alertas/Rede e o card de commodities do v70 são extras de
       desktop sem lugar no cabeçalho enxuto de retrato — ficam escondidos
       aqui igual ao celular (js/mobile-portrait-clean-toggle.js). */
    setImp(e.freshBar, {display:'none'});
    setImp(e.searchWrap, {display:'none'});
    setImp(e.v70, {display:'none'});
    if(ro){ ro.disconnect(); ro = null; }
    if(e.ticker && !document.body.classList.contains('mg-clean-portrait')) e.ticker.style.removeProperty('top');
  }

  function applyLandscape(e){
    restoreFabParent(e.fab);
    clearProps(e.fab, LAYOUT_PROPS);
    clearProps(e.fabMenu, LAYOUT_PROPS);
    /* Limpa o esquema de grade do retrato para não sobrar flex-wrap/
       overflow-y presos ao virar o tablet de retrato pra paisagem. */
    [e.chipsRow, e.chipsScrollLeft, e.chipsScrollRight, e.mapWrap, e.app,
     document.querySelector('.mag-slider-row span:first-child')].forEach(function(el){
      clearProps(el, LAYOUT_PROPS);
    });
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
  }

  var OWNER_TAG = 'tablet';

  function apply(){
    /* Mesma marcação de "dono atual" usada em
       js/mobile-portrait-clean-toggle.js — os dois scripts mexem nos
       mesmos elementos do cabeçalho em larguras vizinhas, cada um com
       sua própria fila de setTimeout; sem isso, uma reaplicação atrasada
       de um script podia apagar o que o outro tinha acabado de montar. */
    if(!ativo()){
      var owner = document.body.dataset.mgHeaderOwner;
      if(owner && owner !== OWNER_TAG) return;
    }
    var e = els();
    if(ativo()){
      document.body.dataset.mgHeaderOwner = OWNER_TAG;
      if(mqPortrait.matches){ applyPortrait(e); } else { applyLandscape(e); }
    } else {
      restoreFabParent(e.fab);
      [e.app,e.strip,e.mainrow,e.actions,e.kpis,e.kpiEventos,e.kpiMaior,e.btnRadarHeader,
       e.kpiSp,e.kpiFeels,e.kpiBrent,e.clock,e.btnSom,e.meta,e.mobileWeatherMini,e.controlbar,
       e.controlsBox,e.chipsWrap,e.chipsRow,e.chipsScrollLeft,e.chipsScrollRight,
       e.freshBar,e.searchWrap,e.v70,e.title,e.live,e.fab,e.fabMenu,e.mapWrap,
       document.getElementById('mobile-probar'),document.querySelector('#kpibox-sp .ts-kpi-label'),
       document.querySelector('#kpibox-sp .ts-kpi-row'),document.getElementById('kpi-wx-icon'),
       document.getElementById('kpi-wind'),document.querySelector('.mag-slider-row span:first-child')
      ].forEach(function(el){
        clearProps(el, LAYOUT_PROPS);
      });
      /* Em retrato estreito (body.mg-clean-portrait), o "top" do ticker
         não é sobra deste script — é setado ativamente por
         js/clima-local.js (__posicionarTickerAbaixoDoHeader), que exige
         position:absolute pra funcionar (ver
         js/mobile-portrait-clean-toggle.js). Limpar aqui desfaria esse
         sincronismo toda vez que este apply() rodar (resize, mudança de
         media query etc.), mesmo sem este script ter sido o dono. */
      if(e.ticker && !document.body.classList.contains('mg-clean-portrait')) e.ticker.style.removeProperty('top');
      if(ro){ ro.disconnect(); ro = null; }
      if(document.body.dataset.mgHeaderOwner === OWNER_TAG) delete document.body.dataset.mgHeaderOwner;
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
    if(mqPortrait.matches){
      /* No retrato (3 faixas), o card antigo de risco/clima grande não
         tem lugar no cabeçalho enxuto — fica escondido, igual ao celular. */
      setImp(probarMobile, {display:'none'});
    } else {
      if(probarMobile) probarMobile.style.removeProperty('display');
      setImp(probarMobile, {order:'6', flex:'1 1 100%', width:'100%'});
    }
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
  if(mqPortrait.addEventListener) mqPortrait.addEventListener('change', apply); else if(mqPortrait.addListener) mqPortrait.addListener(apply);
  window.addEventListener('resize', function(){ clearTimeout(window.__hv72rt); window.__hv72rt = setTimeout(apply, 200); });
})();

