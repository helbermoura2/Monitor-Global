/* Entradas principais do celular. Reutiliza lista, detalhes e áudio existentes. */
(() => {
  const portrait = window.matchMedia('(max-width:700px) and (orientation:portrait)');
  const $ = id => document.getElementById(id);
  let active = 'map';
  function mark(view) {
    active = view;
    document.querySelectorAll('#mobile-primary-nav [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  }
  function close() {
    const panel = $('menu-float-panel');
    if (panel) { panel.classList.remove('open'); panel.style.display = 'none'; }
    $('fab-menu')?.setAttribute('aria-expanded', 'false');
    mark(document.body.classList.contains('mobile-events-open') ? 'events' : 'map');
  }
  function shell(title) {
    let panel = $('menu-float-panel');
    if (!panel) { panel = document.createElement('div'); panel.id = 'menu-float-panel'; document.body.appendChild(panel); }
    panel.classList.add('open', 'mg-mobile-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', title);
    panel.replaceChildren();
    panel.style.display = 'block';
    const dismiss = document.createElement('button');
    dismiss.className = 'close-x'; dismiss.type = 'button'; dismiss.textContent = '×'; dismiss.setAttribute('aria-label', 'Fechar'); dismiss.onclick = close;
    const heading = document.createElement('h3'); heading.textContent = title;
    panel.append(dismiss, heading);
    return panel;
  }
  function heading(panel, title) { const h = document.createElement('h4'); h.textContent = title; panel.appendChild(h); }
  function button(panel, text, action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = action; panel.appendChild(b); return b;
  }
  function secondary(action) { return () => { close(); action(); }; }
  function audio(panel) {
    heading(panel, 'Áudio dos alertas');
    const group = document.createElement('div'); group.className = 'mg-audio-controls'; panel.appendChild(group);
    const enabled = () => typeof somAtivo !== 'undefined' ? somAtivo : localStorage.getItem('somAtivo') !== '0';
    const sound = button(group, enabled() ? 'Som ligado · desligar' : 'Som desligado · ligar', () => {
      if (typeof window.toggleSomAtivo === 'function') window.toggleSomAtivo({speak:true});
      sound.textContent = enabled() ? 'Som ligado · desligar' : 'Som desligado · ligar';
      sound.setAttribute('aria-pressed', String(enabled()));
    });
    sound.setAttribute('aria-pressed', String(enabled()));
    button(group, 'Testar som', () => $('btn-teste')?.click());
    const label = document.createElement('label'); label.textContent = 'Volume';
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '5'; slider.setAttribute('aria-label', 'Volume dos alertas');
    slider.value = String(typeof somVolume !== 'undefined' ? Math.round(somVolume * 100) : 70);
    slider.oninput = () => { if (typeof setSomVolume === 'function') setSomVolume(slider.value); };
    label.appendChild(slider); panel.appendChild(label);
    button(panel, 'Preferências de alertas', secondary(() => window.__uxShow?.('settings')));
  }
  function alerts() {
    if (typeof toggleMobileEventsModal === 'function') toggleMobileEventsModal(false);
    const panel = shell('Alertas'); mark('alerts');
    audio(panel);
    heading(panel, 'Alertas em monitoramento');
    const items = (typeof globalAlerts !== 'undefined' ? globalAlerts : []).filter(Boolean).slice().sort((a,b) => (Number(b.time)||0) - (Number(a.time)||0));
    if (!items.length) { const empty = document.createElement('p'); empty.textContent = 'Nenhum alerta carregado nesta sessão.'; panel.appendChild(empty); }
    items.slice(0,40).forEach(item => {
      const b = button(panel, '', secondary(() => { if (typeof showAlertDetails === 'function') showAlertDetails(item, false); }));
      b.className = 'mg-alert-row';
      const title = document.createElement('strong'); title.textContent = item.place || item.title || item.type || 'Alerta';
      const meta = document.createElement('small'); meta.textContent = [item.source, typeof formatTime === 'function' && item.time ? formatTime(item.time) : ''].filter(Boolean).join(' · ');
      b.append(title,meta);
    });
  }
  function menu() {
    const panel = shell('Menu'); $('fab-menu')?.setAttribute('aria-expanded','true');
    heading(panel, 'Análises');
    button(panel, 'Resumo do dia', secondary(() => window.shareResumoDiarioStory?.()));
    for (const [label,kind] of [['Linha do tempo','timeline'],['Mudanças recentes','changes'],['Status das fontes','sources'],['Legenda do mapa','legend']]) button(panel,label,secondary(() => window.__uxShow?.(kind)));
    for (const [label,kind] of [['Radar de chuva','radar'],['Reproduzir eventos','replay'],['Acompanhar eventos','follow']]) button(panel,label,secondary(() => window.menuAcao?.(kind)));
    heading(panel, 'Configurações');
    button(panel, 'Alertas e áudio', alerts);
    button(panel, 'Filtros de eventos', secondary(() => {
      const open = document.body.classList.toggle('mg-mobile-filters');
      $('mobile-primary-nav')?.setAttribute('data-filters',String(open));
    }));
    button(panel, 'Visual: vidro / escuro', secondary(() => window.mgToggleTheme?.()));
    button(panel, 'Clima global', secondary(() => $('chip-clima-global')?.click()));
    button(panel, 'Recarregar dados', secondary(() => window.menuAcao?.('reload')));
    if (typeof window.toggleTvMode === 'function') button(panel, 'Modo TV', secondary(() => window.toggleTvMode()));
    if (window.TelegramAdmin?.isAuthenticated()) button(panel, 'Histórico do Telegram', secondary(() => window.TelegramAdmin.open()));
  }
  function install() {
    const parent = $('ux-controlbar');
    if (!parent) return;
    const nav = document.createElement('nav'); nav.id = 'mobile-primary-nav'; nav.setAttribute('aria-label','Navegação principal');
    for (const [view,label] of [['map','Mapa'],['events','Eventos'],['alerts','Alertas']]) {
      const b = button(nav,label,() => {
        if (view === 'alerts') { alerts(); return; }
        close(); document.body.classList.remove('mg-mobile-filters');
        if (view === 'map') {
          if (typeof toggleMobileEventsModal === 'function') toggleMobileEventsModal(false);
          if (typeof fecharPainelDetalhesMobile === 'function') fecharPainelDetalhesMobile();
          $('ux-panel')?.classList.remove('open');
        } else if (typeof toggleMobileEventsModal === 'function') toggleMobileEventsModal(true);
        mark(view);
      });
      b.dataset.view = view;
    }
    parent.prepend(nav);
    function sync() {
      document.body.classList.toggle('mg-mobile-primary',portrait.matches);
      if (!portrait.matches) { document.body.classList.remove('mg-mobile-filters'); const panel = $('menu-float-panel'); if (panel?.classList.contains('mg-mobile-panel')) {close();panel.classList.remove('mg-mobile-panel');} }
      mark(active);
    }
    portrait.addEventListener('change',sync); sync();
    new MutationObserver(() => {
      if ($('menu-float-panel')?.classList.contains('open') && active === 'alerts') return;
      mark(document.body.classList.contains('mobile-events-open') ? 'events' : 'map');
    }).observe(document.body,{attributes:true,attributeFilter:['class']});
    document.addEventListener('keydown',e => {if(e.key === 'Escape' && portrait.matches) close();});
  }
  function revisions(items) {
    const panel = shell('Revisões recebidas');
    for (const item of items.slice().reverse()) {
      const b = button(panel, '', secondary(() => {
        const index = (typeof globalEvents !== 'undefined' ? globalEvents : []).findIndex(e => e.id === item.id);
        if (index >= 0 && typeof showEventDetails === 'function') showEventDetails(index, false);
      }));
      const title = document.createElement('strong'); title.textContent = item.place;
      const delta = document.createElement('small'); delta.textContent = item._deltaTxt || 'Dados revisados';
      b.className = 'mg-alert-row'; b.append(title,delta);
    }
  }
  window.MobilePortraitUI = {menu,alerts,revisions,isPortrait:() => portrait.matches};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
})();
