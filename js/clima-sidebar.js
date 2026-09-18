(function(){
  'use strict';
  var $ = function(id){ return document.getElementById(id); };
  var esc = function(v){ return String(v==null?'':v).replace(/[&<>"']/g, function(m){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]; }); };
  var state = { ext:null, anom:null, cyc:null, busy:false, open:false, timer:null };

  function workerBase(){
    try {
      if (typeof WORKER_PROXY === 'function') {
        return WORKER_PROXY('').split('?')[0].replace(/\/$/,'');
      }
    } catch(e){}
    return '';
  }

  async function getJson(path, timeout){
    var base = workerBase();
    if (!base) throw new Error('Worker não encontrado');
    var c = new AbortController();
    var t = setTimeout(function(){ c.abort(); }, timeout || 30000);
    try {
      var r = await fetch(base + path, { cache:'no-store', signal:c.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  function classify(c){
    var x = c && c.classification;
    return x==='HU' ? 'FURACÃO' : x==='TS' ? 'TEMPESTADE TROPICAL' : x==='TD' ? 'DEPRESSÃO TROPICAL' : (x || 'SISTEMA TROPICAL');
  }

  function renderExt(){
    var box = document.querySelector('#cgp-ext .cgp-body');
    if (!box) return;
    var h = (state.ext && state.ext.hottest) || [];
    var c = (state.ext && state.ext.coldest) || [];
    if (!h.length && !c.length) {
      box.innerHTML = '<div class="cgp-note">Dados indisponíveis no momento.</div>';
      return;
    }
    var html = '';
    h.slice(0,4).forEach(function(x){
      html += '<div class="cgp-row cgp-hot"><span>🔥 ' + esc(x.city) + '</span><b>' + Number(x.current!=null?x.current:x.max).toFixed(1) + ' °C</b></div>';
    });
    c.slice(0,4).forEach(function(x){
      html += '<div class="cgp-row cgp-cold"><span>❄️ ' + esc(x.city) + '</span><b>' + Number(x.current!=null?x.current:x.min).toFixed(1) + ' °C</b></div>';
    });
    box.innerHTML = html;
  }

  function renderAnom(){
    var box = document.querySelector('#cgp-anom .cgp-body');
    if (!box) return;
    var rows = ((state.anom && state.anom.rows) || []).slice().sort(function(a,b){ return Math.abs(b.anomaly)-Math.abs(a.anomaly); });
    if (!rows.length) {
      box.innerHTML = '<div class="cgp-note">Anomalia indisponível.</div>';
      return;
    }
    box.innerHTML = rows.slice(0,6).map(function(x){
      var cls = Number(x.anomaly) >= 0 ? 'cgp-pos' : 'cgp-neg';
      var sign = Number(x.anomaly) >= 0 ? '+' : '';
      return '<div class="cgp-row ' + cls + '"><span>' + esc(x.name) + '</span><b>' + sign + Number(x.anomaly).toFixed(1) + '°</b></div>';
    }).join('') + '<div class="cgp-note">' + esc((state.anom && state.anom.disclaimer) || 'Comparado à climatologia histórica.') + '</div>';
  }

  function renderCyc(){
    var box = document.querySelector('#cgp-cyc .cgp-body');
    if (!box) return;
    var storms = (state.cyc && state.cyc.storms) || [];
    if (!storms.length) {
      box.innerHTML = '<div class="cgp-note">Nenhum ciclone ativo retornado pelo NHC.</div>';
      return;
    }
    box.innerHTML = storms.slice(0,6).map(function(x){
      return '<div class="cgp-storm"><strong>🌀 ' + esc(x.name) + '</strong> · ' + esc(classify(x)) +
        '<div class="cgp-row"><span>Vento / pressão</span><b>' + (Number(x.intensity)||0) + ' km/h · ' + (Number(x.pressure)||0) + ' hPa</b></div></div>';
    }).join('');
  }

  function renderAll(){
    renderExt(); renderAnom(); renderCyc();
    var u = $('cgp-updated');
    if (u) u.textContent = 'atualizado ' + new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  }

  async function loadAll(force){
    if (state.busy) return;
    state.busy = true;
    try {
      var results = await Promise.allSettled([
        getJson('/v70-extremes', 22000),
        getJson('/v70-anomaly', 50000),
        getJson('/v70-cyclones', 22000)
      ]);
      if (results[0].status === 'fulfilled') state.ext = results[0].value;
      if (results[1].status === 'fulfilled') state.anom = results[1].value;
      if (results[2].status === 'fulfilled') state.cyc = results[2].value;
      renderAll();
    } catch(e) {
      var u = $('cgp-updated');
      if (u) u.textContent = 'falha ao atualizar';
    } finally {
      state.busy = false;
    }
  }

  function openPanel(open){
    var panel = $('clima-global-panel');
    var chip = $('chip-clima-global');
    if (!panel) return;
    state.open = open !== false;
    if (open === false) state.open = false;
    panel.classList.toggle('open', state.open);
    if (chip) chip.classList.toggle('active', state.open);
    if (state.open) {
      // mobile: abrir lista de eventos se estiver fechada
      try {
        if (window.matchMedia('(max-width:900px)').matches && typeof toggleMobileEventsModal === 'function') {
          if (!document.body.classList.contains('mobile-events-open')) toggleMobileEventsModal(true);
        }
      } catch(e){}
      panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
      if (!state.ext && !state.anom && !state.cyc) loadAll(true);
    }
  }

  function togglePanel(){
    openPanel(!state.open);
  }

  function boot(){
    var chip = $('chip-clima-global');
    var close = $('cgp-close');
    var refresh = $('cgp-refresh');
    if (chip) chip.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });
    if (close) close.addEventListener('click', function(){ openPanel(false); });
    if (refresh) refresh.addEventListener('click', function(){ loadAll(true); });

    // pré-carrega em background; refresh a cada 6h
    setTimeout(function(){ loadAll(false); }, 4000);
    state.timer = setInterval(function(){ loadAll(false); }, 6 * 60 * 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else setTimeout(boot, 80);

  window.climaGlobalToggle = togglePanel;
  window.climaGlobalReload = function(){ return loadAll(true); };
})();

