/* ===================================================================
   Retrato mobile ≤700px — layout final via JavaScript (pedido do
   Helber, depois de 3 tentativas em CSS perdendo empate de
   especificidade contra regras antigas de até 3 IDs encadeados,
   ex: #top-strip>#ux-controlbar #controls{width:205px!important}).
   Estilo inline sempre vence QUALQUER regra de folha de estilo,
   então aqui a geometria (tamanho/posição) é decidida aqui, uma
   única vez, sem concorrência possível. Cor/fonte continuam vindo
   do CSS (body.mg-clean-portrait em css/mobile-late-patches.css),
   já que isso não estava sendo disputado.
   =================================================================== */
(function(){
  var mq = window.matchMedia('(max-width:700px) and (orientation:portrait)');
  var originalKpiParent = null, originalKpiNext = null;
  var originalFabParent = null, originalFabNext = null;

  function setImp(el, props){
    if(!el) return;
    Object.keys(props).forEach(function(k){ el.style.setProperty(k, String(props[k]), 'important'); });
  }
  function clearProps(el, keys){
    if(!el) return;
    keys.forEach(function(k){ el.style.removeProperty(k); });
  }
  var GEOM = ['display','flex-direction','flex-wrap','flex','width','min-width','max-width',
    'height','min-height','max-height','padding','margin','position','top','left','right','bottom',
    'overflow','overflow-x','overflow-y','gap','align-items','justify-content','grid-template-columns','order',
    'border-top','border-left','border-bottom','padding-left','text-overflow','white-space'];

  function els(){
    return {
      app: document.getElementById('app'),
      strip: document.getElementById('top-strip'),
      mainrow: document.querySelector('#top-strip > .ts-mainrow'),
      actions: document.querySelector('#top-strip > .ts-actions'),
      kpis: document.querySelector('#top-strip > .ts-kpis'),
      kpiEventos: document.getElementById('kpibox-eventos'),
      kpiMaior: document.getElementById('kpibox-maior'),
      kpiSp: document.getElementById('kpibox-sp'),
      kpiBrent: document.getElementById('kpibox-brent'),
      clock: document.getElementById('kpi-relogio'),
      btnSom: document.getElementById('btn-som-header'),
      btnRadar: document.getElementById('btn-radar-header'),
      probar: document.getElementById('mobile-probar'),
      v70: document.getElementById('v70-header-row'),
      topProbar: document.getElementById('top-probar'),
      ticker: document.getElementById('latest-event-ticker'),
      controlbar: document.getElementById('ux-controlbar'),
      controls: document.getElementById('controls'),
      chipsScrollLeft: document.getElementById('chips-scroll-left'),
      chipsScrollRight: document.getElementById('chips-scroll-right'),
      chipsWrap: document.getElementById('chips-scroll-wrap'),
      chipsRow: document.getElementById('chips-row'),
      mapWrap: document.getElementById('mapWrap')
    };
  }

  function rememberOriginalParents(e){
    if(e.kpis && !originalKpiParent){
      originalKpiParent = e.kpis.parentElement;
      originalKpiNext = e.kpis.nextElementSibling;
    }
    var fab = document.getElementById('mobile-fab-bar');
    if(fab && !originalFabParent){
      originalFabParent = fab.parentElement;
      originalFabNext = fab.nextElementSibling;
    }
  }

  function restoreOriginalParents(e){
    try {
      if(e.kpis && originalKpiParent && e.kpis.parentElement !== originalKpiParent){
        if(originalKpiNext && originalKpiNext.parentElement === originalKpiParent){
          originalKpiParent.insertBefore(e.kpis, originalKpiNext);
        } else {
          originalKpiParent.appendChild(e.kpis);
        }
      }
      var fab = document.getElementById('mobile-fab-bar');
      if(fab && originalFabParent && fab.parentElement !== originalFabParent){
        if(originalFabNext && originalFabNext.parentElement === originalFabParent){
          originalFabParent.insertBefore(fab, originalFabNext);
        } else {
          originalFabParent.appendChild(fab);
        }
      }
      if(fab){
        ['display','flex-direction','flex-wrap','flex','width','min-width','max-width',
         'height','min-height','max-height','padding','margin','position','top','left',
         'right','bottom','overflow','overflow-x','gap','align-items','justify-content',
         'order','z-index','box-sizing'].forEach(function(k){ fab.style.removeProperty(k); });
        ['fab-menu','fab-events','fab-audio'].forEach(function(id){
          var b=document.getElementById(id);
          if(b){
            ['display','flex','width','min-width','max-width','height','min-height',
             'max-height','padding','margin','position','top','left','right','bottom',
             'z-index','order'].forEach(function(k){ b.style.removeProperty(k); });
          }
        });
      }
    } catch(err){ window.__mgRestoreErr = String(err); }
  }

  var OWNER_TAG = 'phone';

  function apply(){
    /* js/mobile-portrait-clean-toggle.js (≤700px retrato) e js/header-v72.js
       (701-900px) mexem nos MESMOS elementos do cabeçalho, cada um com sua
       própria fila de setTimeout independente. Sem essa marcação de "dono
       atual" (body.dataset.mgHeaderOwner), uma reaplicação atrasada de um
       script podia limpar o que o outro tinha acabado de montar — o
       cabeçalho "piscava" pro estado errado por 1-2s até o próximo
       setTimeout corrigir de novo. Se o outro script é o dono e este aqui
       está inativo, não mexe em nada. */
    if(!mq.matches){
      var owner = document.body.dataset.mgHeaderOwner;
      if(owner && owner !== OWNER_TAG) return;
    }
    var e = els();
    rememberOriginalParents(e);
    document.body.classList.toggle('mg-clean-portrait', mq.matches);
    if(!mq.matches){
      restoreOriginalParents(e);
      [e.app,e.strip,e.mainrow,e.kpis,e.kpiSp,e.kpiBrent,e.clock,e.ticker,e.controlbar,e.controls,
       e.chipsWrap,e.chipsRow,e.chipsScrollLeft,e.chipsScrollRight,e.mapWrap].forEach(function(el){
        clearProps(el, GEOM);
      });
      var titleEl = document.querySelector('#top-strip .ts-title');
      var liveEl = document.querySelector('#top-strip .live-indicator');
      var spLabelEl = document.querySelector('#kpibox-sp .ts-kpi-label');
      var spRowEl = document.querySelector('#kpibox-sp .ts-kpi-row');
      var spIconEl = document.getElementById('kpi-wx-icon');
      var magLabelEl = document.querySelector('.mag-slider-row span:first-child');
      [titleEl,liveEl,spLabelEl,spRowEl,spIconEl,magLabelEl].forEach(function(el){ clearProps(el, GEOM); });
      [e.actions,e.topProbar,e.v70,e.probar,e.btnSom,e.btnRadar,e.kpiEventos,e.kpiMaior,e.clock,
       e.chipsScrollLeft,e.chipsScrollRight,
       document.getElementById('kpi-wind'),document.getElementById('kpi-feels')].forEach(function(el){
        if(el) el.style.removeProperty('display');
      });
      if(document.body.dataset.mgHeaderOwner === OWNER_TAG) delete document.body.dataset.mgHeaderOwner;
      return;
    }
    document.body.dataset.mgHeaderOwner = OWNER_TAG;
    setImp(e.app, {display:'flex','flex-direction':'column',height:'100dvh',width:'100vw'});
    /* v28.3 — cabeçalho retrato reorganizado em 3 faixas coesas (título,
       KPIs, filtros), com o mesmo espaçamento horizontal e divisores
       sutis que o cabeçalho desktop usa entre seus grupos de informação.
       flex-wrap:nowrap é essencial aqui: sem ele, css/mobile-late-patches.css
       ainda tem #top-strip{flex-wrap:wrap!important} de uma versão antiga,
       e a combinação column+wrap fazia os itens "vazarem" para uma coluna
       fantasma fora da tela (o vão vazio visto entre as linhas do header). */
    /* Sem border-bottom aqui: o card AO VIVO agora sobrepõe o rodapé do
       cabeçalho de propósito (margin-top negativo, mais abaixo). Com a
       borda ligada, ela ficava "escapando" bem no canto arredondado do
       card, onde a curva não cobre o suficiente pra tapar a linha. */
    setImp(e.strip, {display:'flex','flex-direction':'column','flex-wrap':'nowrap',
      flex:'0 0 auto',height:'auto','min-height':'0','max-height':'none',overflow:'visible',
      padding:'8px 14px 6px',gap:'0','border-bottom':'none'});
    try {
      /* KPIs e filtros ficam abaixo do título; o botão de menu (FAB)
         entra na mesma linha do título, à direita, como no desktop. */
      if(e.kpis && e.strip && e.kpis.parentElement !== e.strip){
        e.strip.appendChild(e.kpis);
      }
      var fab = document.getElementById('mobile-fab-bar');
      if(fab && e.mainrow && fab.parentElement !== e.mainrow){
        e.mainrow.appendChild(fab);
      }
    } catch(err){ window.__mgReparentErr = String(err); }

    /* Linha 1 — logo/título + AO VIVO + menu, todos numa faixa só. */
    setImp(e.mainrow, {display:'flex','align-items':'center','justify-content':'flex-start',gap:'8px',
      width:'100%',height:'44px','min-height':'44px',flex:'0 0 44px','min-width':'0',
      'box-sizing':'border-box',padding:'0','border-top':'none'});
    var title = document.querySelector('#top-strip .ts-title');
    setImp(title, {flex:'1 1 auto','min-width':'0',overflow:'hidden','text-overflow':'ellipsis','white-space':'nowrap','max-width':'none'});
    var live = document.querySelector('#top-strip .live-indicator');
    setImp(live, {flex:'0 0 auto'});
    setImp(e.actions, {display:'none'});
    setImp(e.topProbar, {display:'none'});
    setImp(e.v70, {display:'none'});
    setImp(e.probar, {display:'none'});
    setImp(e.btnSom, {display:'none'});
    setImp(e.btnRadar, {display:'none'});
    setImp(e.kpiEventos, {display:'none'});
    setImp(e.kpiMaior, {display:'none'});

    /* Linha 2 — 📍 clima · 🛢️ Brent · relógio, uma faixa só, largura
       cheia, com divisores finos entre os grupos (igual ao desktop).
       Mais fina que antes (24px, era 34px) e discreta de propósito —
       vira "legenda" do título, não mais uma barra de pílulas do
       mesmo peso visual dos chips de filtro logo abaixo. */
    setImp(e.kpis, {display:'flex','flex-direction':'row','flex-wrap':'nowrap','align-items':'center',
      'justify-content':'space-between',gap:'10px',margin:'4px 0 0',width:'100%','min-width':'0',
      flex:'0 0 24px',order:'2',overflow:'hidden','height':'24px','min-height':'24px','max-height':'24px',
      padding:'0','border-top':'1px solid rgba(72,216,255,.14)'});
    var kpiChildren = e.kpis ? Array.prototype.slice.call(e.kpis.children) : [];
    kpiChildren.forEach(function(el){ setImp(el, {opacity:'1',visibility:'visible'}); });
    setImp(e.kpiSp, {order:'1',display:'flex','flex-direction':'row','align-items':'center',gap:'6px',
      flex:'1 1 auto','min-width':'0',margin:'0',padding:'0','border-left':'none',overflow:'hidden'});
    /* Nome da cidade trunca com reticências; ícone/temperatura ficam fixos.
       Vento continua saindo (não cabe nem compacto), mas a sensação
       térmica volta a aparecer — pedido do Helber, a temperatura sozinha
       não bastava. O nome da cidade absorve o aperto extra truncando
       mais cedo (já era o elemento "sacrificável" aqui). */
    var spLabel = document.querySelector('#kpibox-sp .ts-kpi-label');
    var spRow = document.querySelector('#kpibox-sp .ts-kpi-row');
    var spWind = document.getElementById('kpi-wind');
    var spFeels = document.getElementById('kpi-feels');
    var spIcon = document.getElementById('kpi-wx-icon');
    setImp(spLabel, {flex:'1 1 auto','min-width':'0',overflow:'hidden','text-overflow':'ellipsis','white-space':'nowrap'});
    setImp(spRow, {flex:'0 0 auto',display:'flex','align-items':'baseline',gap:'3px'});
    setImp(spFeels, {display:'inline-block','flex':'0 0 auto'});
    setImp(spIcon, {flex:'0 0 auto',display:'inline-block'});
    setImp(spWind, {display:'none'});
    setImp(e.kpiBrent, {order:'2',display:'flex','flex-direction':'row','align-items':'center',gap:'4px',
      position:'static',width:'auto','min-width':'0','max-width':'none',flex:'0 0 auto',margin:'0',
      'padding-left':'10px','border-left':'1px solid rgba(72,216,255,.14)','white-space':'nowrap'});
    setImp(e.clock, {order:'3',display:'flex','align-items':'center',position:'static',width:'auto','max-width':'none',
      flex:'0 0 auto',margin:'0','padding-left':'10px','border-left':'1px solid rgba(72,216,255,.14)','white-space':'nowrap'});

    var fab = document.getElementById('mobile-fab-bar');
    var fabMenu = document.getElementById('fab-menu');
    var fabEvents = document.getElementById('fab-events');
    var fabAudio = document.getElementById('fab-audio');
    setImp(fab, {display:'flex',position:'static',top:'auto',right:'auto',left:'auto',
      bottom:'auto',width:'40px',height:'40px','min-width':'40px','min-height':'40px',
      flex:'0 0 40px',order:'3',gap:'0',margin:'0',padding:'0',zIndex:'500000'});
    setImp(fabMenu, {display:'flex',width:'40px',height:'40px','min-width':'40px','min-height':'40px',
      position:'static',margin:'0'});
    setImp(fabEvents, {display:'none'});
    setImp(fabAudio, {display:'none'});

    /* margin-top negativo (não zero) de propósito: garante que a faixa
       sobreponha o rodapé do cabeçalho em vez de só encostar nele. Com
       margin:0 sobrava, em alguns aparelhos (telas de densidade não
       inteira, tipo 2.625x), uma frestinha de menos de 1px por
       arredondamento sub-pixel — some quando os dois se sobrepõem de
       propósito, já que os dois têm fundo escuro opaco.
       margin lateral NEGATIVO (-14px, cancelando o padding horizontal
       do #top-strip) faz a faixa sangrar de ponta a ponta — ela deixa
       de ser "mais uma pílula igual às de cima" e vira uma faixa de
       largura cheia, como pediu o Helber. O padding interno compensa
       pra o ícone/texto ficarem alinhados com o título, não colados
       na borda da tela. Cantos (topo reto, embaixo arredondado) e
       sombra ficam em css/ui-motion.css — aqui só a geometria.
       width explícito (não 'auto'): dentro de um flex-column, um item
       com margin lateral negativa e width:auto NÃO estica simétrico
       (o Chromium ignora a margem negativa no cálculo do "stretch"),
       sobrando ~14px descoberto de um lado. calc(100vw + 28px) força
       a largura certa; o excesso é cortado pelo overflow:hidden que
       #app já tem (css/base.css), sem precisar de scroll horizontal.
       max-width:'none' também é necessário — css/mobile-early.css tem
       #latest-event-ticker{max-width:100vw!important} de uma versão
       antiga, que sem esse override anulava toda a largura extra. */
    /* position:absolute (era static) — o cabeçalho e o mapa agora usam o
       mesmo esquema "mapa em tela cheia por baixo, cabeçalho/ticker
       flutuando por cima" do desktop (ver css/mobile-layout-lock.css),
       pra o vidro translúcido ter mapa de verdade atrás pra revelar, em
       vez do fundo escuro chapado do body. "top" fica de fora de
       propósito — quem cuida dele é js/clima-local.js
       (__posicionarTickerAbaixoDoHeader, com ResizeObserver, já
       observando a altura real do cabeçalho). Sem a negativa de margem
       pra "sangrar" full-bleed: como o ticker não fica mais dentro do
       fluxo do #top-strip, ancorar em left:0/right:0 (relativo ao #app)
       já dá largura cheia direto, sem precisar de calc()/margem
       negativa. */
    setImp(e.ticker, {display:'flex',position:'absolute',left:'0',right:'0',bottom:'auto',
      width:'auto','max-width':'none',height:'auto','min-height':'40px',margin:'6px 0 0',padding:'8px 14px','z-index':'25'});

    /* Linha 3 — magnitude + chips na MESMA linha, como pediu o Helber:
       o slider fica compacto (só "M 0.0", sem o rótulo "Magnitude
       mínima", que não cabe mais aqui) e os chips rolam na horizontal
       ao lado, com as setinhas ‹ › (já existem em js/ui-wiring-final.js,
       só precisavam ficar visíveis) mostrando quando dá pra rolar mais. */
    setImp(e.controlbar, {display:'flex',position:'static',top:'auto',left:'auto',right:'auto',bottom:'auto',
      'flex-direction':'row','flex-wrap':'nowrap','align-items':'center',flex:'0 0 auto',width:'100%',height:'auto',
      'min-height':'0','max-height':'40px',overflow:'hidden',margin:'6px 0 0',padding:'6px 0 0',gap:'8px',
      'border-top':'1px solid rgba(72,216,255,.14)'});
    setImp(e.controls, {display:'flex','flex-direction':'row','align-items':'center',gap:'5px',
      flex:'0 0 86px',width:'86px','min-width':'86px','max-width':'86px',padding:'0',height:'auto',order:'1'});
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

    /* position:absolute (era relative) + inset:0 — mapa preenche a tela
       toda por baixo do cabeçalho/ticker, em vez de só o espaço que
       sobrava depois deles no fluxo normal (ver comentário equivalente
       no setImp do e.ticker, acima). */
    setImp(e.mapWrap, {position:'absolute',inset:'0','min-height':'0',height:'auto',overflow:'hidden'});
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', apply, {once:true});
  } else { apply(); }
  if(mq.addEventListener) mq.addEventListener('change', apply); else if(mq.addListener) mq.addListener(apply);
  window.addEventListener('orientationchange', function(){ setTimeout(apply, 150); });
  window.addEventListener('resize', function(){ clearTimeout(window.__mgcpt); window.__mgcpt = setTimeout(apply, 150); });
  setTimeout(apply, 1000);
  setTimeout(apply, 2500);
  setTimeout(function(){
    if(!mq.matches) return;
    var cb = document.getElementById('ux-controlbar');
    if(cb){
      cb.style.setProperty('display','flex','important');
      cb.style.setProperty('visibility','visible','important');
      cb.style.setProperty('opacity','1','important');
    }
  }, 3000);

  /* Vigia: se qualquer outro script (ex. header-v72.js, numa corrida de
     tempo com seus próprios timers) tentar mudar o flex-direction do
     #top-strip de volta pra 'row', corrige na hora. Mesmo princípio do
     mobile-v77.js pro #ux-controlbar. */
  if('MutationObserver' in window){
    var setupWatchdog = function(){
      var strip = document.getElementById('top-strip');
      if(!strip) return;
      new MutationObserver(function(){
        if(mq.matches && strip.style.flexDirection !== 'column'){
          clearTimeout(window.__mgWatch);
          window.__mgWatch = setTimeout(apply, 30);
        }
      }).observe(strip, {attributes:true, attributeFilter:['style']});
    };
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded', setupWatchdog, {once:true});
    } else { setupWatchdog(); }
  }
  var __mgPollCount = 0;
  var __mgPoll = setInterval(function(){
    __mgPollCount++;
    if(__mgPollCount > 15){ clearInterval(__mgPoll); return; }
    if(mq.matches){
      var strip = document.getElementById('top-strip');
      if(strip && strip.style.flexDirection !== 'column') apply();
    }
  }, 400);
})();
