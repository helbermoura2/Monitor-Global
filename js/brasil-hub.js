(function () {
  // Campos como cidade/condição (BrasilAPI) e nome/tempo (XML da CPTEC) vêm
  // de terceiros — escapa antes de ir pro innerHTML.
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const COND = {
    ec:'Encoberto c/ chuvas isoladas', ci:'Chuvas isoladas', c:'Chuva', in:'Instável',
    pp:'Poss. pancadas', cm:'Chuva manhã', cn:'Chuva noite', pt:'Pancadas tarde',
    pm:'Pancadas manhã', np:'Nublado e pancadas', pc:'Pancadas de chuva', pn:'Parcialmente nublado',
    cv:'Chuvisco', ch:'Chuvoso', t:'Tempestade', ps:'Predomínio de sol', e:'Encoberto',
    n:'Nublado', cl:'Céu claro', nv:'Nevoeiro', g:'Geada', nd:'Não definido',
    psc:'Poss. de chuva', pcm:'Poss. chuva manhã', pct:'Poss. chuva tarde', pnt:'Pancadas noite'
  };
  const STORMY = /^(t|pc|ci|c|ch|np|pt|pm|pnt|in|pp|psc|pcm|pct|cm|cn|cv)$/i;
  // Códigos CPTEC de capitais (amostra nacional)
  const CAPS = [
    { nome: 'São Paulo', uf: 'SP', id: 244 },
    { nome: 'Rio de Janeiro', uf: 'RJ', id: 241 },
    { nome: 'Belo Horizonte', uf: 'MG', id: 222 },
    { nome: 'Porto Alegre', uf: 'RS', id: 259 },
    { nome: 'Curitiba', uf: 'PR', id: 232 },
    { nome: 'Brasília', uf: 'DF', id: 224 },
    { nome: 'Salvador', uf: 'BA', id: 242 },
    { nome: 'Recife', uf: 'PE', id: 246 },
    { nome: 'Fortaleza', uf: 'CE', id: 227 },
    { nome: 'Manaus', uf: 'AM', id: 234 },
    { nome: 'Belém', uf: 'PA', id: 221 },
    { nome: 'Goiânia', uf: 'GO', id: 228 }
  ];

  function $(id) { return document.getElementById(id); }

  // BUG CORRIGIDO: o quadro reabria sozinho porque applyFilters() roda a cada
  // atualização de dados (sismos chegam a cada poucos segundos), e o wrapper
  // abaixo chamava showHub(true) toda vez que o chip BR estava ativo — mesmo
  // que o usuário tivesse acabado de fechar o quadro no X. Agora um fechamento
  // manual fica "lembrado" e só é esquecido quando o usuário sai do filtro BR
  // e volta (ou clica no chip de novo), que são ações explícitas dele.
  let hubClosedByUser = false;

  function showHub(on, opts) {
    const hub = $('brasil-hub');
    if (!hub) return;
    if (on && hubClosedByUser && !(opts && opts.force)) return;
    document.body.classList.toggle('geo-br', !!on);
    hub.hidden = !on;
    if (!on) hubClosedByUser = true;
    if (on) refreshBrasilHub();
  }

  function sevClass(label) {
    const s = String(label || '').toLowerCase();
    if (/grande perigo|extrem/.test(s)) return 'sev-4';
    if (/\bperigo\b/.test(s) && !/potencial/.test(s)) return 'sev-3';
    if (/potencial|moderado/.test(s)) return 'sev-2';
    return 'sev-1';
  }

  function refreshInmetSummary() {
    const el = $('bh-inmet-sum');
    const tags = $('bh-inmet-ufs');
    if (!el) return;
    try {
      const list = (typeof globalAlerts !== 'undefined' && globalAlerts)
        ? globalAlerts.filter(a => String(a.id || '').startsWith('inmet-'))
        : [];
      const ativos = list.filter(a => typeof alertVisivelNaLista !== 'function' || alertVisivelNaLista(a));
      if (!ativos.length) {
        el.textContent = 'Nenhum aviso INMET ativo agora no país.';
        if (tags) tags.innerHTML = '';
        return;
      }
      const byUf = {};
      ativos.forEach(a => {
        const place = String(a.place || a.detail || '');
        const ufs = place.match(/\b([A-Z]{2})\b/g) || [];
        // tenta extrair de detail/estados no texto
        const txt = (place + ' ' + (a.detail || '')).toUpperCase();
        const map = {
          'ACRE':'AC','ALAGOAS':'AL','AMAPA':'AP','AMAZONAS':'AM','BAHIA':'BA','CEARA':'CE',
          'DISTRITO FEDERAL':'DF','ESPIRITO SANTO':'ES','GOIAS':'GO','MARANHAO':'MA',
          'MATO GROSSO DO SUL':'MS','MATO GROSSO':'MT','MINAS GERAIS':'MG','PARAIBA':'PB',
          'PARANA':'PR','PERNAMBUCO':'PE','PIAUI':'PI','RIO DE JANEIRO':'RJ',
          'RIO GRANDE DO NORTE':'RN','RIO GRANDE DO SUL':'RS','RONDONIA':'RO','RORAIMA':'RR',
          'SANTA CATARINA':'SC','SAO PAULO':'SP','SERGIPE':'SE','TOCANTINS':'TO','PARA':'PA'
        };
        let found = false;
        Object.keys(map).forEach(k => {
          if (txt.indexOf(k) >= 0) {
            const u = map[k];
            byUf[u] = byUf[u] || { n: 0, sev: a.detail || '', max: 0 };
            byUf[u].n++;
            const sc = /grande perigo/i.test(a.detail||'') ? 4 : /\bperigo\b/i.test(a.detail||'') ? 3 : 2;
            byUf[u].max = Math.max(byUf[u].max, sc);
            found = true;
          }
        });
        if (!found) {
          byUf['BR'] = byUf['BR'] || { n: 0, sev: '', max: 1 };
          byUf['BR'].n++;
        }
      });
      const me = ativos.filter(a => a.meAtinge).length;
      const crit = ativos.filter(a => /grande perigo|\bperigo\b/i.test(a.detail || a.place || '')).length;
      el.textContent = ativos.length + ' aviso(s) ativos no Brasil' +
        (crit ? ' · ' + crit + ' com perigo/grande perigo' : '') +
        (me ? ' · ' + me + ' te atinge (SP/região)' : '') + '.';
      if (tags) {
        tags.innerHTML = Object.keys(byUf).sort().map(u => {
          const x = byUf[u];
          const cls = x.max >= 3 ? 'sev-3' : x.max >= 2 ? 'sev-2' : 'sev-1';
          return '<span class="bh-tag ' + cls + '">' + esc(u) + ' ×' + x.n + '</span>';
        }).join('');
      }
    } catch (e) {
      el.textContent = 'INMET: veja alertas2.inmet.gov.br e a lista filtrada.';
    }
  }

  async function fetchCptecBrasil() {
    const sum = $('bh-cptec-sum');
    const capsEl = $('bh-cptec-caps');
    const days = $('bh-cptec-days');
    let ok = false;
    // 1) Capitais via BrasilAPI (HTTPS)
    try {
      const r = await fetch('https://brasilapi.com.br/api/cptec/v1/clima/capital', { cache: 'no-store' });
      if (r.ok) {
        const arr = await r.json();
        ok = true;
        const stormy = [];
        const rows = (Array.isArray(arr) ? arr : []).slice(0, 20).map(c => {
          const cidade = c.cidade || c.nome || '?';
          const uf = c.estado || c.uf || '';
          const cond = c.condicao_desc || c.condition || c.tempo || '';
          const temp = c.temp != null ? c.temp + '°' : (c.temperatura != null ? c.temperatura + '°' : '');
          const hot = /tempestade|chuva|pancada|instáv|nublado|trovoad/i.test(String(cond));
          if (hot) stormy.push(cidade + (uf ? '/' + uf : ''));
          return '<div class="bh-cap' + (hot ? ' hot' : '') + '"><b>' + esc(cidade) + (uf ? ' · ' + esc(uf) : '') + '</b> ' +
            (temp ? esc(temp) + ' · ' : '') + esc(cond || '—') + '</div>';
        });
        if (capsEl) capsEl.innerHTML = rows.join('') || '<span style="color:#64748b">Sem dados de capitais</span>';
        if (sum) {
          sum.textContent = stormy.length
            ? ('Instabilidade/chuva em: ' + stormy.slice(0, 8).join(', ') + (stormy.length > 8 ? '…' : '') + ' · CPTEC via BrasilAPI')
            : 'Capitais estáveis no momento · CPTEC via BrasilAPI. Mapas de severidade só no portal.';
        }
        try { if (typeof setSource === 'function') setSource('CPTEC', 'ok', 0); } catch (e) {}
      }
    } catch (e) {
      console.warn('BrasilAPI CPTEC capital:', e);
    }

    // 2) Previsão 4 dias SP (contexto local do usuário)
    try {
      const r2 = await fetch('https://brasilapi.com.br/api/cptec/v1/clima/previsao/244/4', { cache: 'no-store' });
      if (r2.ok) {
        const d = await r2.json();
        const clima = d.clima || d.previsao || [];
        if (days) {
          days.innerHTML = '<div style="width:100%;font-size:9px;color:#64748b;margin-bottom:2px">SP — próximos dias</div>' +
            (Array.isArray(clima) ? clima : []).slice(0, 4).map(function (p) {
              const dia = String(p.data || p.dia || '').slice(5, 10) || '--';
              const max = p.max != null ? p.max : (p.maxima != null ? p.maxima : '--');
              const min = p.min != null ? p.min : (p.minima != null ? p.minima : '--');
              const desc = p.condicao_desc || COND[p.condicao] || p.condicao || '';
              return '<div class="bh-day" title="' + esc(desc) + '"><span>' + esc(dia) + '</span><b>' + esc(max) + '°/' + esc(min) + '°</b><span>' + esc(String(desc).slice(0, 14)) + '</span></div>';
            }).join('');
        }
        ok = true;
      }
    } catch (e) {
      console.warn('BrasilAPI previsão SP:', e);
    }

    // 3) Fallback XML — precisa passar pelo proxy do Worker (fetchWithCorsFallback),
    // igual toda outra fonte de governo desta base: um fetch() direto daqui nunca
    // funcionava (servidor não manda cabeçalho CORS pra navegador nenhum), então
    // esse fallback sempre falhava silenciosamente e derrubava o selo pra "off"
    // mesmo quando o XML estava disponível — bastava passar pelo Worker.
    if (!ok) {
      try {
        const r = await fetchWithCorsFallback('https://servicos.cptec.inpe.br/XML/capitais/condicoesAtuais.xml', 15000);
        if (r.ok) {
          const xml = new DOMParser().parseFromString(await r.text(), 'application/xml');
          const metas = [...xml.querySelectorAll('metar')];
          if (capsEl && metas.length) {
            capsEl.innerHTML = metas.slice(0, 12).map(m => {
              const nome = m.querySelector('codigo')?.textContent || '';
              const temp = m.querySelector('temperatura')?.textContent || '';
              const tempo = m.querySelector('tempo')?.textContent || '';
              return '<div class="bh-cap"><b>' + esc(nome) + '</b> ' + esc(temp) + '° · ' + esc(tempo) + '</div>';
            }).join('');
          }
          if (sum) sum.textContent = 'Condições nas capitais (XML CPTEC).';
          ok = true;
          try { if (typeof setSource === 'function') setSource('CPTEC', 'ok', 0); } catch (e) {}
        }
      } catch (e) {}
    }

    if (!ok) {
      if (sum) sum.textContent = 'CPTEC indisponível agora. Use o portal para mapas de severidade em todo o Brasil.';
      if (capsEl) capsEl.innerHTML = '';
      try { if (typeof setSource === 'function') setSource('CPTEC', 'off', 0); } catch (e) {}
    }
  }

  function refreshCgeLocal() {
    const el = $('bh-cge-local');
    if (!el) return;
    try {
      const rain = $('sp-live-rain')?.textContent || '--';
      const gust = $('sp-live-gust')?.textContent || '--';
      const flood = $('flood-risk-label')?.textContent || '--';
      const cem = $('cemaden-max24')?.textContent || '--';
      el.textContent = 'SP agora: chuva ' + rain + ' · rajada ' + gust + ' · alagamento ' + flood + ' · máx.24h modelo ' + cem + ' mm. Confirme no CGE.';
    } catch (e) {
      el.textContent = 'Abra o site do CGE para a operação oficial da capital.';
    }
  }

  function refreshCemadenSum() {
    const el = $('bh-cemaden-sum');
    if (!el) return;
    const st = $('cemaden-status')?.textContent || '';
    const max = $('cemaden-max24')?.textContent || '--';
    el.innerHTML = 'Status: <b>links oficiais ativos</b> · API plena via <b>PED</b> (pedido em andamento em ped@cemaden.gov.br). '
      + 'Enquanto isso: Painel de Alertas + Mapa Interativo. Card SP: ' + max + ' mm/24h (' + st + ').';
  }

  window.refreshBrasilHub = function () {
    refreshInmetSummary();
    refreshCemadenSum();
    refreshCgeLocal();
    fetchCptecBrasil();
  };

  function hookGeoChip() {
    const br = $('chip-geo-br');
    if (!br || br.dataset.bhHooked === '1') return;
    br.dataset.bhHooked = '1';
    br.addEventListener('click', function () {
      setTimeout(function () {
        const on = (typeof geoFilter !== 'undefined' && geoFilter === 'br');
        // Clique explícito no chip = intenção clara do usuário de ver o quadro
        // de novo, mesmo que ele tivesse fechado antes.
        if (on) hubClosedByUser = false;
        showHub(on, { force: true });
        if (on && typeof showToast === 'function') {
          try { showToast('🇧🇷 Central Brasil — tempo severo nacional', 'info'); } catch (e) {}
        }
      }, 30);
    });
    if (typeof geoFilter !== 'undefined' && geoFilter === 'br') showHub(true, { force: true });
  }

  function install() {
    hookGeoChip();
    $('bh-close')?.addEventListener('click', function () { showHub(false); });
    const orig = window.applyFilters;
    if (typeof orig === 'function' && !orig._bhWrapped) {
      window.applyFilters = function () {
        let r;
        try {
          r = orig.apply(this, arguments);
        } catch (e) {
          console.error('[monitor] applyFilters (original) falhou:', e);
          return;
        }
        try {
          const on = (typeof geoFilter !== 'undefined' && geoFilter === 'br');
          showHub(on);
          if (on) {
            refreshInmetSummary();
            refreshCemadenSum();
            refreshCgeLocal();
          }
        } catch (e) { console.error('[monitor] pós-processamento Central Brasil falhou:', e); }
        return r;
      };
      window.applyFilters._bhWrapped = true;
    }
    setInterval(function () {
      if (typeof geoFilter !== 'undefined' && geoFilter === 'br') {
        refreshInmetSummary();
        refreshCgeLocal();
        refreshCemadenSum();
      }
    }, 60000);
    setTimeout(fetchCptecBrasil, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();

