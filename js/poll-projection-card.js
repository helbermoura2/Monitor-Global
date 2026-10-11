/* Takeover de ~30s no cartão principal com a média de pesquisas do 2º turno
 * (ver monitor-global-worker-7_7_0.js: /polls-average, atualizado 1x/noite).
 * Só entra na rotação normal (runAutoCycle), nunca interrompe um evento ativo
 * nem M6+/alta prioridade -- essas checagens já acontecem antes de chamar due(). */
(function(){
 'use strict';
 const SECOND_TURN_AT = Date.parse('2026-10-25T00:00:00-03:00');
 const RETIRE_AT = Date.parse('2026-11-01T00:00:00-03:00');
 const MIN_GAP_MS = 25 * 60000;
 const STALE_MS = 36 * 3600000;
 const SHOW_MS = 30000;
 const percentage = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1});
 let cache = null, cacheAt = 0, lastShown = 0, active = false;

 function initials(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
 }
 async function load() {
  if (cache && Date.now() - cacheAt < 10 * 60000) return cache;
  const fetcher = window.OptionalFeatures?.fetch || window.fetch;
  const res = await fetcher('/polls-average');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'sem dados');
  cache = data;
  cacheAt = Date.now();
  return data;
 }
 function due() {
  if (active) return false;
  const now = Date.now();
  if (now < SECOND_TURN_AT || now >= RETIRE_AT) return false;
  if (now - lastShown < MIN_GAP_MS) return false;
  if (!cache || now - cacheAt >= 10 * 60000) load().catch(() => {});
  if (!cache) return false;
  if (now - new Date(cache.updatedAt).getTime() >= STALE_MS) return false;
  return true;
 }
 function build(data) {
  const panel = document.getElementById('painel-direito');
  if (!panel) return null;
  const [a, b] = [...data.candidates].sort((x, y) => y.percentage - x.percentage);
  const host = document.createElement('div');
  host.className = 'pd-poll-projection';
  host.setAttribute('aria-hidden', 'true');
  const updated = new Intl.DateTimeFormat('pt-BR', {timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}).format(new Date(data.updatedAt));
  host.innerHTML = `<div class="pd-poll-head"><strong>Pesquisas · 2º turno</strong><br>Média de ${data.sources} agregadores</div>
   <div class="pd-poll-candidates">
    ${[a, b].map((c, i) => `<div class="pd-poll-candidate"${i === 0 ? ' data-leader' : ''}>
      <div class="pd-poll-avatar">${initials(c.name)}</div>
      <div class="pd-poll-name">${c.name.split(' ')[0]}</div>
      <div class="pd-poll-party">${c.party}</div>
      <div class="pd-poll-pct">${percentage.format(c.percentage)}%</div>
      <div class="pd-poll-bar"><span style="width:${c.percentage}%"></span></div>
     </div>`).join('')}
   </div>
   <div class="pd-poll-foot">Média de pesquisas eleitorais (não é o apurado oficial) · atualizado ${updated} BRT</div>`;
  return host;
 }
 function show(onDone) {
  const panel = document.getElementById('painel-direito');
  const data = cache;
  if (!panel || !data || active) return false;
  const host = build(data);
  if (!host) return false;
  active = true;
  lastShown = Date.now();
  panel.append(host);
  const finish = () => {
   if (!active) return;
   active = false;
   host.setAttribute('data-leaving', '');
   host.addEventListener('animationend', () => host.remove(), {once: true});
   setTimeout(() => host.remove(), 600);
   onDone?.();
  };
  const timer = setTimeout(finish, SHOW_MS);
  window.PollProjectionCard._abort = () => { clearTimeout(timer); finish(); };
  return true;
 }
 window.PollProjectionCard = {due, show, isActive: () => active, _abort: null};
})();
