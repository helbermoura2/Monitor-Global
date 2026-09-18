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
    'border-top','border-left','padding-left','text-overflow','white-space'];

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
    setImp(e.strip, {display:'flex','flex-direction':'column','flex-wrap':'nowrap',
      flex:'0 0 auto',height:'auto','min-height':'0','max-height':'none',overflow:'visible',
      padding:'8px 14px 6px',gap:'0'});
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
       cheia, com divisores finos entre os grupos (igual ao desktop). */
    setImp(e.kpis, {display:'flex','flex-direction':'row','flex-wrap':'nowrap','align-items':'center',
      'justify-content':'space-between',gap:'10px',margin:'6px 0 0',width:'100%','min-width':'0',
      flex:'0 0 34px',order:'2',overflow:'hidden','height':'34px','min-height':'34px','max-height':'34px',
      padding:'0','border-top':'1px solid rgba(72,216,255,.14)'});
    var kpiChildren = e.kpis ? Array.prototype.slice.call(e.kpis.children) : [];
    kpiChildren.forEach(function(el){ setImp(el, {opacity:'1',visibility:'visible'}); });
    setImp(e.kpiSp, {order:'1',display:'flex','flex-direction':'row','align-items':'center',gap:'6px',
      flex:'1 1 auto','min-width':'0',margin:'0',padding:'0','border-left':'none',overflow:'hidden'});
    /* Nome da cidade trunca com reticências; ícone/temperatura ficam fixos.
       Vento e sensação térmica somem no retrato — não cabem com folga
       e a temperatura já é a informação essencial aqui. */
    var spLabel = document.querySelector('#kpibox-sp .ts-kpi-label');
    var spRow = document.querySelector('#kpibox-sp .ts-kpi-row');
    var spWind = document.getElementById('kpi-wind');
    var spFeels = document.getElementById('kpi-feels');
    var spIcon = document.getElementById('kpi-wx-icon');
    setImp(spLabel, {flex:'1 1 auto','min-width':'0',overflow:'hidden','text-overflow':'ellipsis','white-space':'nowrap'});
    setImp(spRow, {flex:'0 0 auto',display:'flex'});
    setImp(spIcon, {flex:'0 0 auto',display:'inline-block'});
    setImp(spWind, {display:'none'});
    setImp(spFeels, {display:'none'});
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

    /* margin-top negativo (não zero) de propósito: garante que o card
       sobreponha o rodapé do cabeçalho em vez de só encostar nele. Com
       margin:0 sobrava, em alguns aparelhos (telas de densidade não
       inteira, tipo 2.625x), uma frestinha de menos de 1px por
       arredondamento sub-pixel — some quando os dois se sobrepõem de
       propósito, já que os dois têm fundo escuro opaco. */
    setImp(e.ticker, {display:'flex',position:'static',top:'auto',left:'auto',right:'auto',bottom:'auto',
      width:'auto',height:'auto','min-height':'40px',margin:'-3px 14px 0',padding:'6px 10px'});

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

    setImp(e.mapWrap, {flex:'1 1 auto','min-height':'0',height:'auto',position:'relative',overflow:'hidden'});
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

  /* === PROBE TEMPORÁRIO DE DIAGNÓSTICO (pedido do Helber) ===
     Só aparece se a URL tiver ?debug=1 no final, e só no retrato
     mobile. Sem isso, nunca aparece pra ninguém — nem no desktop,
     nem por engano. Pra ativar: monitorglobal.top/?debug=1
     Remover depois de resolvido — procurar "PROBE TEMPORÁRIO". */
  if(!/[?&]debug=1\b/.test(location.search)) return;
  function probe(){
    var el = document.getElementById('mg-debug-probe');
    if(!el){
      el = document.createElement('div');
      el.id = 'mg-debug-probe';
      el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:999999;background:#000;color:#0f0;font:10px monospace;padding:6px 8px;border:1px solid #0f0;border-radius:6px;max-width:96vw;white-space:pre-wrap;pointer-events:none;';
      document.body.appendChild(el);
    }
    var cb = document.getElementById('ux-controlbar');
    var ctr = document.getElementById('controls');
    var cw = document.getElementById('chips-scroll-wrap');
    var cr = document.getElementById('chips-row');
    var ts = document.getElementById('top-strip');
    var mr = document.querySelector('#top-strip > .ts-mainrow, #top-strip .ts-mainrow');
    var kp = document.querySelector('.ts-kpis');
    var tk = document.getElementById('latest-event-ticker');
    var lines = [];
    lines.push('classe body: ' + (document.body.classList.contains('mg-clean-portrait') ? 'SIM' : 'NAO'));
    lines.push('largura janela: ' + window.innerWidth);
    if(ts){ var ct = getComputedStyle(ts); lines.push('top-strip: h=' + ct.height + ' bottom=' + (ts.offsetTop+ts.offsetHeight)); lines.push('top-strip style=' + ts.getAttribute('style')); }
    if(mr){ var cm = getComputedStyle(mr); lines.push('mainrow: w=' + cm.width + ' top=' + mr.offsetTop); }
    if(kp){
      var ck = getComputedStyle(kp);
      var rkp = kp.getBoundingClientRect();
      lines.push('kpis: w=' + ck.width + ' top=' + kp.offsetTop + ' offW=' + kp.offsetWidth + ' offH=' + kp.offsetHeight +
        ' disp=' + ck.display + ' op=' + ck.opacity + ' vis=' + ck.visibility + ' filhos=' + kp.children.length + ' pai=' + (kp.parentElement ? kp.parentElement.id : '?'));
      lines.push('kpis rect: x=' + Math.round(rkp.x) + ' y=' + Math.round(rkp.y) + ' w=' + Math.round(rkp.width) + ' h=' + Math.round(rkp.height));
      var br = document.getElementById('kpibox-brent');
      var sp = document.getElementById('kpibox-sp');
      if(br){ var cbr = getComputedStyle(br); var rbr = br.getBoundingClientRect(); lines.push('brent rect: x=' + Math.round(rbr.x) + ' y=' + Math.round(rbr.y) + ' w=' + Math.round(rbr.width) + ' clr=' + cbr.color); }
      if(sp){ var csp = getComputedStyle(sp); var rsp = sp.getBoundingClientRect(); lines.push('sp rect: x=' + Math.round(rsp.x) + ' y=' + Math.round(rsp.y) + ' w=' + Math.round(rsp.width) + ' clr=' + csp.color); }
      if(cb){ var rcb = cb.getBoundingClientRect(); lines.push('controlbar rect: x=' + Math.round(rcb.x) + ' y=' + Math.round(rcb.y) + ' w=' + Math.round(rcb.width) + ' h=' + Math.round(rcb.height)); }
    }
    if(window.__mgReparentErr) lines.push('ERRO reparent: ' + window.__mgReparentErr);
    if(cb){ var c = getComputedStyle(cb); lines.push('controlbar: h=' + c.height + ' top=' + cb.offsetTop + ' bottom=' + (cb.offsetTop+cb.offsetHeight) + ' pos=' + c.position + ' wrap=' + c.flexWrap); }
    var ctrEl = document.getElementById('controls');
    if(ctrEl){ var cctr = getComputedStyle(ctrEl); lines.push('controls real: w=' + cctr.width + ' order=' + cctr.order); }
    if(tk){ var ctk = getComputedStyle(tk); lines.push('ticker: top=' + tk.offsetTop + ' pos=' + ctk.position + ' z=' + ctk.zIndex); }
    if(ctr){ var c2 = getComputedStyle(ctr); lines.push('controls: w=' + c2.width + ' h=' + c2.height); }
    if(cw){ var c3 = getComputedStyle(cw); lines.push('chipsWrap: h=' + c3.height); }
    if(cr){ var c4 = getComputedStyle(cr); lines.push('chipsRow: h=' + c4.height); }
    el.textContent = lines.join('\n');
  }
  setTimeout(probe, 1100);
  setTimeout(probe, 2600);
  window.addEventListener('resize', function(){ setTimeout(probe, 300); });
})();
