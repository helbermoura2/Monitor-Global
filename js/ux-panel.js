(() => {
  const $ = id => document.getElementById(id);
  const panel = $('ux-panel'), title = $('ux-panel-title'), content = $('ux-panel-content');
  let previousIds = new Set();
  let alertConfig = JSON.parse(localStorage.getItem('monitor-alert-config') || '{"min":4.5,"region":"","sound":true}');
  const getItems = () => { try { const source = (typeof lastMerged !== 'undefined' && Array.isArray(lastMerged) && lastMerged.length) ? lastMerged : ((typeof globalEvents !== 'undefined' && Array.isArray(globalEvents)) ? globalEvents : []); return source.filter(Boolean); } catch(e) { return []; } };
  const open = (name, html) => { title.textContent = name; content.innerHTML = html; panel.classList.add('open'); };
  $('ux-panel-close')?.addEventListener('click', () => panel.classList.remove('open'));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDur = ms => { ms = Math.max(0, ms); if (ms < 60000) return 'menos de 1 min'; const h = Math.floor(ms / 3600000), m = Math.round((ms % 3600000) / 60000); return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`; };
  const sourceRows = () => {
    const src = window.PRO?.sourceState || {};
    const keys = Object.keys(src);
    if (!keys.length) return '<p class="ux-note">Os status serão preenchidos conforme as fontes responderem.</p>';
    const now = Date.now();
    const fallback = window.REGIONAL_SEISMIC_FALLBACK || {};
    return keys.map(k => {
      const x = src[k] || {};
      const h = (window.SourceHealth && window.SourceHealth.get) ? window.SourceHealth.get(k) : {};
      const status = x.status === 'ok' ? 'ONLINE' : x.status === 'warn' ? 'ATENÇÃO' : x.status === 'off' ? 'OFFLINE' : 'AGUARDANDO';
      const cls = x.status === 'ok' ? 'ux-ok' : x.status === 'warn' ? 'ux-warn' : x.status === 'off' ? 'ux-off' : '';
      const failTimes = Array.isArray(h.failTimes) ? h.failTimes : [];
      const recentFails = failTimes.filter(t => now - t < 3600000).length;
      const lastFailAt = failTimes.length ? failTimes[failTimes.length - 1] : 0;
      const sessionAge = now - (h.firstSeenAt || now);
      let story;
      if (x.status === 'off') {
        const downMs = h.lastOk ? now - h.lastOk : sessionAge;
        story = `Fora do ar há ${fmtDur(downMs)}`;
        if (fallback[k]) story += ` · ${fallback[k]}`;
      } else if (x.status === 'warn') {
        story = recentFails ? `Instável — caiu ${recentFails}× na última hora` : 'Latência elevada no último ciclo';
        if (lastFailAt) story += ` · última queda há ${fmtDur(now - lastFailAt)}`;
      } else if (x.status === 'ok') {
        if (recentFails) story = `Estabilizou — última queda há ${fmtDur(now - lastFailAt)}`;
        else if (sessionAge < 120000) story = 'Estável desde que entrou na sessão · sem incidentes';
        else story = `Estável há ${fmtDur(sessionAge)} · nenhuma falha nesta sessão`;
      } else {
        story = 'Aguardando primeira checagem…';
      }
      const okC = Number(h.okCount) || 0, failC = Number(h.failCount) || 0, total = okC + failC;
      const okPct = total ? Math.round(okC / total * 100) : 100;
      const barColor = x.status === 'off' ? '#f87171' : '#facc15';
      const bar = total
        ? `<span class="ux-stability">${okPct > 0 ? `<i style="width:${okPct}%;background:#4ade80"></i>` : ''}${okPct < 100 ? `<i style="width:${100 - okPct}%;background:${barColor}"></i>` : ''}</span>`
        : `<span class="ux-stability"><i style="width:100%;background:#334155"></i></span>`;
      return `<div class="ux-source-row"><span>${esc(k)}</span><b class="${cls}">${status}</b><span class="ux-story">${esc(story)}</span>${bar}</div>`;
    }).join('');
  };
  const timeline = () => { const items=getItems(), now=Date.now(), buckets=Array(12).fill(0); items.forEach(x=>{const age=(now-(x.time||now))/36e5;const i=Math.min(11,Math.max(0,Math.floor(age/2)));buckets[11-i]++}); const max=Math.max(1,...buckets); return `<div class="ux-timeline">${buckets.map((n,i)=>`<div class="ux-bar" style="height:${Math.max(5,Math.round(n/max*68))}px" title="${n} evento(s)"><span>${i%2===0?(24-i*2)+'h':''}</span></div>`).join('')}</div><p class="ux-note">Distribuição aproximada dos eventos nas últimas 24 horas, em blocos de duas horas.</p>`; };
  const summary = () => { const items=getItems(), eq=items.filter(x=>x.type==='earthquake'), max=eq.reduce((m,x)=>Math.max(m,Number(x.mag)||0),0), br=items.filter(x=>String(x.place||'').toLowerCase().includes('brazil')||String(x.pais||'').toLowerCase().includes('brasil')).length; return `Há <strong>${items.length}</strong> evento(s) nas últimas 24 horas; <strong>${eq.length}</strong> sismo(s); maior magnitude <strong>${max?`M${max.toFixed(1)}`:'--'}</strong>; <strong>${br}</strong> associado(s) ao Brasil. ${items.length?'Os dados estão sendo filtrados conforme os controles da lista.':'Nenhum evento carregado no momento.'}`; };
  const changes = () => { const ids=new Set(getItems().map(x=>x.id)); const added=[...ids].filter(x=>!previousIds.has(x)); const removed=[...previousIds].filter(x=>!ids.has(x)); previousIds=ids; return `<div class="ux-change-row"><span>Novos eventos</span><b class="ux-ok">${added.length}</b><small>desde a última leitura</small></div><div class="ux-change-row"><span>Removidos</span><b class="ux-warn">${removed.length}</b><small>desde a última leitura</small></div><p class="ux-note">A comparação passa a valer a partir da primeira atualização desta sessão.</p>`; };
  const exportCsv = () => { const items=getItems(); const rows=[['id','tipo','local','magnitude','profundidade_km','data','fonte'],...items.map(x=>[x.id,x.type,x.place,x.mag??'',x.depth??'',new Date(x.time||Date.now()).toISOString(),x.source||''])]; const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n'); const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='monitor-global-eventos.csv';a.click();URL.revokeObjectURL(a.href); };
  const settings = () => { open('Alertas configuráveis', `<div class="ux-field"><label for="ux-alert-min">Magnitude mínima</label><input id="ux-alert-min" type="number" min="0" max="9" step="0.1" value="${alertConfig.min}"></div><div class="ux-field"><label for="ux-alert-region">Região ou país</label><input id="ux-alert-region" type="text" value="${esc(alertConfig.region)}" placeholder="Ex.: Brasil"></div><div class="ux-field"><label for="ux-alert-sound">Som habilitado</label><input id="ux-alert-sound" type="checkbox" ${alertConfig.sound?'checked':''}></div><div class="ux-inline-actions"><button class="ux-btn" id="ux-save-alerts">Salvar alertas</button></div><p class="ux-note">As configurações ficam salvas apenas neste navegador. Elas servem como preferência local para a próxima camada de notificação.</p>`); $('ux-save-alerts')?.addEventListener('click',()=>{alertConfig={min:Number($('ux-alert-min').value)||0,region:$('ux-alert-region').value,sound:$('ux-alert-sound').checked};localStorage.setItem('monitor-alert-config',JSON.stringify(alertConfig));open('Alertas configuráveis','<p class="ux-note">Preferências salvas neste navegador.</p>');}); };
  const show = kind => { if(kind==='summary') open('Resumo executivo',`<p>${summary()}</p><div class="ux-inline-actions"><button class="ux-btn" id="ux-export">Exportar CSV</button><button class="ux-btn" id="ux-share">Compartilhar estado</button></div>`); if(kind==='timeline') open('Linha do tempo',timeline()); if(kind==='sources') open('Status por fonte',sourceRows()+`<div class="ux-inline-actions"><button class="ux-btn" id="ux-export">Exportar CSV</button></div>`); if(kind==='legend') open('Legenda completa','<div class="ux-legend-row"><i class="ux-dot" style="background:#4ade80"></i>Baixa severidade / situação normal</div><div class="ux-legend-row"><i class="ux-dot" style="background:#facc15"></i>Atenção / dado que requer observação</div><div class="ux-legend-row"><i class="ux-dot" style="background:#ef4444"></i>Alta severidade / possível impacto</div><div class="ux-legend-row">🌧️ Radar: precipitação observada, fonte RainViewer.</div><div class="ux-legend-row">📍 Marcadores: eventos georreferenciados.</div><p class="ux-note">Cores e estimativas devem ser interpretadas junto da fonte oficial e do horário de atualização.</p>'); if(kind==='changes') open('O que mudou desde a última atualização',changes()); if(kind==='settings') settings(); $('ux-export')?.addEventListener('click',exportCsv); $('ux-share')?.addEventListener('click',()=>{const u=new URL(location.href);u.hash='monitor-state';navigator.clipboard?.writeText(u.href);open('Compartilhamento','<p class="ux-note">O link do estado atual foi copiado quando o navegador permitiu.</p>');}); };
  $('ux-btn-summary')?.addEventListener('click',()=>show('summary')); $('ux-btn-timeline')?.addEventListener('click',()=>show('timeline')); $('ux-btn-sources')?.addEventListener('click',()=>show('sources')); $('ux-btn-legend')?.addEventListener('click',()=>show('legend')); $('ux-btn-changes')?.addEventListener('click',()=>show('changes')); $('ux-btn-settings')?.addEventListener('click',()=>show('settings'));
  // Expõe para o menu ☰ chamar direto (DeX/desktop)
  window.__uxShow = show;
  $('ux-search')?.addEventListener('input', e => { const q=e.target.value.trim().toLowerCase(); document.querySelectorAll('#events .event').forEach(card=>card.hidden=q && !card.textContent.toLowerCase().includes(q)); });
  const refreshSummary=()=>{ if($('ux-summary-text')) $('ux-summary-text').innerHTML=summary(); }; setTimeout(refreshSummary,2500); setInterval(refreshSummary,15000);
})();

