import {ELECTION_2026, TseResultsClient} from './tse-results.mjs?v=20261005-election';

// A non-modal, desktop-only scoreboard. It never participates in map filters.
const desktop = matchMedia('(min-width: 1101px)');
const client = new TseResultsClient(window.OptionalFeatures?.fetch);
const number = new Intl.NumberFormat('pt-BR');
const percentage = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const dateTime = new Intl.DateTimeFormat('pt-BR', {timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'});
const dayMonth = new Intl.DateTimeFormat('pt-BR', {timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit'});
const ballot = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12h16v8H4zM7 12l-2-3h4m7 0h3l2 3M10 3l7 4-4 7-7-4z"/><path d="m10 8 1 2 3-1M8 17h8"/></svg>';
let chip, panel, announcement, opened = false, timer, expiryTimer, request, revision = 0;
let turn = Date.now() >= ELECTION_2026.secondTurnAt ? 2 : 1;
const seenArrivals = new Set(window.ElectionPanel?.arrivalIds || []);
// Descreve só o que o TSE já apurou desde que o placar foi aberto -- nunca
// uma projeção do resultado final (sem base histórica de 2022, sem modelo).
const trendPoints = new Map();
// Aba separada: média de pesquisas (Wikipedia) pro 2º turno, nunca comparada
// com o apurado oficial do TSE -- só a aba "projeção final" mostra o TSE.
let activeTab = 'final', pollsCache = null, pollsLoading = false;

function expired() {
  const final = client.lastGood.get(2);
  return Date.now() >= ELECTION_2026.retireAt || !!(final?.finished && Date.now() >= final.generatedAt + 86400000);
}
function text(id, value) {panel.querySelector('#' + id).textContent = value;}
function stop() {
  clearTimeout(timer);
  timer = null;
  revision++;
  request?.abort();
  request = null;
}
function close(reason = '') {
  const focused = panel?.contains(document.activeElement);
  opened = false;
  stop();
  if (panel) panel.hidden = true;
  chip?.setAttribute('aria-expanded', 'false');
  chip?.classList.remove('on');
  if (reason) announcement.textContent = reason;
  if (focused && !chip.hidden) chip.focus({preventScroll: true});
}
function visibility() {
  const available = desktop.matches && !expired();
  chip.hidden = !available;
  if (!available) close();
  clearTimeout(expiryTimer);
  if (available) {
    const final = client.lastGood.get(2);
    const deadline = Math.min(ELECTION_2026.retireAt, final?.finished ? final.generatedAt + 86400000 : Infinity);
    // Timers are capped to avoid the browser's 32-bit timeout overflow.
    expiryTimer = setTimeout(visibility, Math.min(3600000, Math.max(1, deadline - Date.now())));
  }
}
function position() {
  if (!opened) return;
  const header = document.getElementById('top-strip').getBoundingClientRect();
  const list = document.getElementById('sidebar-left')?.getBoundingClientRect();
  const card = document.getElementById('painel-direito')?.getBoundingClientRect();
  const left = list?.width ? list.right + 14 : innerWidth * .23;
  const right = card?.width ? card.left - 14 : innerWidth * .74;
  const width = Math.max(280, Math.min(590, right - left));
  panel.classList.toggle('election-compact', width < 460);
  panel.style.width = width + 'px';
  panel.style.left = Math.max(12, Math.min(innerWidth - width - 12, left + (right - left - width) / 2)) + 'px';
  panel.style.top = Math.max(12, header.bottom + 12) + 'px';
  panel.style.maxHeight = Math.max(140, innerHeight - header.bottom - 26) + 'px';
}
function candidateNode(candidate, index) {
  const article = document.createElement('article');
  article.className = 'election-candidate';
  article.dataset.candidateId = candidate.id;
  const avatar = document.createElement('span');
  avatar.className = 'election-avatar' + (index === 1 ? ' election-avatar-secondary' : '');
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = candidate.number;
  const details = document.createElement('div');
  details.className = 'election-candidate-data';
  const name = document.createElement('strong');
  name.className = 'election-candidate-name';
  name.textContent = candidate.name;
  const party = document.createElement('span');
  party.className = 'election-candidate-party';
  party.textContent = candidate.party;
  const percent = document.createElement('b');
  percent.className = 'election-candidate-percentage';
  percent.textContent = percentage.format(candidate.percentage) + '%';
  const votes = document.createElement('span');
  votes.className = 'election-candidate-votes';
  votes.textContent = number.format(candidate.votes) + ' votos';
  details.append(name, party, percent, votes);
  article.append(avatar, details);
  return article;
}
function updateTrend(result) {
  const section = panel.querySelector('#election-trend');
  if (!result || result.status !== 'results' || result.turn !== turn || result.candidates.length < 2) {
    section.hidden = true;
    return;
  }
  const [a, b] = result.candidates;
  if (!trendPoints.has(turn)) trendPoints.set(turn, []);
  const points = trendPoints.get(turn);
  const last = points[points.length - 1];
  if (!last || result.percentageCounted > last.counted) {
    points.push({counted: result.percentageCounted, margin: a.percentage - b.percentage, leaderId: a.id});
    if (points.length > 500) points.shift();
  }
  if (points.length < 2) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  const first = points[0], current = points[points.length - 1], delta = current.margin - first.margin;
  text('election-trend-note', first.leaderId !== current.leaderId
    ? 'A liderança mudou de mãos desde que este placar foi aberto.'
    : Math.abs(delta) < .05
      ? 'Margem de ' + a.name + ' segue estável desde a abertura (' + percentage.format(current.margin) + ' p.p.).'
      : 'Margem de ' + a.name + (delta > 0 ? ' ampliou ' : ' diminuiu ') + percentage.format(Math.abs(delta)) + ' p.p. desde a abertura (' + percentage.format(first.margin) + ' → ' + percentage.format(current.margin) + ' p.p.).');
  const width = 100, height = 32, span = Math.max(.1, current.counted - first.counted), maxMargin = Math.max(1, ...points.map(p => p.margin));
  const path = points.map(p => ((p.counted - first.counted) / span * width).toFixed(1) + ',' + (height - p.margin / maxMargin * height).toFixed(1)).join(' ');
  panel.querySelector('#election-trend-line').setAttribute('points', path);
}
function initials(name) {
  return String(name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function renderPolls() {
  const box = panel.querySelector('#election-polls-body');
  if (!box) return;
  if (turn !== 2) {
    box.innerHTML = '<p id="election-polls-empty">A projeção de pesquisas só está disponível no 2º turno.</p>';
    return;
  }
  if (pollsLoading && !pollsCache) {
    box.innerHTML = '<p id="election-polls-empty">Carregando pesquisas…</p>';
    return;
  }
  if (!pollsCache) {
    box.innerHTML = '<p id="election-polls-empty">Ainda sem pesquisas calculadas.</p>';
    return;
  }
  const [a, b] = [...pollsCache.candidates].sort((x, y) => y.percentage - x.percentage);
  const updated = dateTime.format(new Date(pollsCache.updatedAt));
  box.innerHTML = `<div id="election-polls-candidates">${[a, b].map((c, i) => `<div class="election-poll-candidate"${i === 0 ? ' data-leader' : ''}>
      <span class="election-poll-avatar">${initials(c.name)}</span>
      <strong class="election-poll-name">${c.name}</strong>
      <span class="election-poll-party">${c.party}</span>
      <b class="election-poll-pct">${percentage.format(c.percentage)}%</b>
    </div>`).join('')}</div>
    <p id="election-polls-foot">Média de ${pollsCache.sources} agregadores de pesquisas (Wikipedia) · atualizado ${updated} BRT · não é o apurado oficial do TSE.</p>`;
}
async function loadPolls() {
  if (pollsCache || pollsLoading) return;
  pollsLoading = true;
  if (activeTab === 'polls') renderPolls();
  try {
    const fetcher = window.OptionalFeatures?.fetch || window.fetch;
    const res = await fetcher('/polls-average');
    const data = await res.json();
    if (data.ok) pollsCache = data;
  } catch (error) {
    console.warn('[Eleição] Consulta às pesquisas:', error.message);
  } finally {
    pollsLoading = false;
    if (activeTab === 'polls') renderPolls();
  }
}
function setTab(next) {
  if (activeTab === next) return;
  activeTab = next;
  panel.querySelectorAll('[data-election-tab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.electionTab === next)));
  panel.querySelector('#election-tab-final').hidden = next !== 'final';
  panel.querySelector('#election-tab-polls').hidden = next !== 'polls';
  if (next === 'polls') { renderPolls(); loadPolls(); }
}
function render(result = client.lastGood.get(turn), failed = false, loading = false) {
  panel.querySelectorAll('[data-election-turn]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.electionTurn) === turn)));
  text('election-scope', turn === 1 ? 'DOIS PRIMEIROS' : '2º TURNO');
  const candidates = panel.querySelector('#election-candidates');
  const empty = panel.querySelector('#election-empty');
  const footer = panel.querySelector('#election-totalization');
  const hasResults = result?.status === 'results' && result.turn === turn;
  candidates.hidden = !hasResults;
  empty.hidden = hasResults;
  footer.hidden = !hasResults;
  panel.dataset.state = failed ? 'unavailable' : hasResults ? 'results' : loading ? 'loading' : 'pending';
  panel.querySelector('#election-source').href = hasResults ? result.sourceUrl : 'https://resultados.tse.jus.br/oficial/app/index.html';
  if (hasResults) {
    candidates.replaceChildren(...result.candidates.slice(0, 2).map(candidateNode));
    text('election-counted', percentage.format(result.percentageCounted) + '% apurado');
    const progress = panel.querySelector('#election-progress');
    progress.setAttribute('aria-valuenow', String(result.percentageCounted));
    progress.setAttribute('aria-valuetext', percentage.format(result.percentageCounted) + '% das seções totalizadas');
    progress.querySelector('span').style.width = result.percentageCounted + '%';
    text('election-tse-time', dateTime.format(result.updatedAt) + ' BRT');
    panel.querySelector('#election-tse-time').dateTime = new Date(result.updatedAt).toISOString();
    panel.querySelector('#election-tse-time').title = 'Horário da apuração informado pelo TSE';
    text('election-result-status', result.finished ? 'TOTALIZADO' : 'PARCIAL');
    panel.querySelector('#election-result-status').title = result.finished ? 'Totalização encerrada pelo TSE' : 'Apuração ainda em andamento';
    updateTrend(result);
  } else {
    updateTrend(null);
    candidates.replaceChildren();
    text('election-empty', failed
      ? 'Não foi possível consultar o TSE. Tentaremos novamente em 30 s.'
      : loading
        ? 'Consultando a apuração oficial…'
        : turn === 2 && Date.now() < ELECTION_2026.secondTurnAt
          ? `O 2º turno começa em ${dayMonth.format(ELECTION_2026.secondTurnAt)} — ainda não há dados oficiais do TSE.`
          : `Aguardando dados oficiais do ${turn}º turno.`);
  }
  const feedback = panel.querySelector('#election-feedback');
  feedback.hidden = !failed || !hasResults;
  feedback.textContent = failed && hasResults ? 'Consulta ao TSE indisponível · últimos números válidos preservados.' : '';
  text('election-refresh-info', 'Consulta a cada 30 s · percentuais dos votos válidos');
  position();
}
async function refresh() {
  if (!opened || !desktop.matches || expired() || document.hidden) return;
  stop();
  const currentRevision = revision, currentTurn = turn, startedAt = Date.now();
  request = new AbortController();
  const signal = request.signal;
  render(client.lastGood.get(turn), false, true);
  try {
    const result = await client.load(currentTurn, {signal});
    if (signal.aborted || currentRevision !== revision || !opened || currentTurn !== turn) return;
    render(result);
    visibility();
  } catch (error) {
    if (signal.aborted || currentRevision !== revision || !opened) return;
    render(client.lastGood.get(currentTurn), true);
    console.warn('[Eleição] Consulta ao TSE:', error.message);
  } finally {
    if (currentRevision === revision) {
      request = null;
      if (opened && !document.hidden && !expired()) timer = setTimeout(refresh, Math.max(1000, ELECTION_2026.interval - (Date.now() - startedAt)));
    }
  }
}
function open() {
  visibility();
  if (chip.hidden) return;
  opened = true;
  panel.hidden = false;
  chip.setAttribute('aria-expanded', 'true');
  chip.classList.add('on');
  render(client.lastGood.get(turn), false, true);
  panel.querySelector('#election-close').focus({preventScroll: true});
  refresh();
}
function newQuakes(items) {
  // Called only by the new-arrival queue, never by initial catalogs or rotation.
  let strongest = null;
  for (const quake of items || []) {
    if (!quake || quake.id == null || seenArrivals.has(quake.id)) continue;
    seenArrivals.add(quake.id);
    if (Number(quake.mag) > 6 && (!strongest || Number(quake.mag) > Number(strongest.mag))) strongest = quake;
  }
  if (seenArrivals.size > 1000) {
    const recent = [...seenArrivals].slice(-500);
    seenArrivals.clear();
    recent.forEach(id => seenArrivals.add(id));
  }
  if (opened && strongest) close(`Placar fechado: chegou um novo sismo M${Number(strongest.mag).toFixed(1).replace('.', ',')}. Reabra pelo chip Eleição quando quiser.`);
}
function init() {
  const brazil = document.getElementById('chip-geo-br');
  if (!brazil) return;
  chip = document.getElementById('chip-election') || document.createElement('button');
  chip.id = 'chip-election';
  chip.className = 'chip chip-toggle';
  chip.type = 'button';
  chip.hidden = true;
  chip.setAttribute('aria-controls', 'election-panel');
  chip.setAttribute('aria-expanded', 'false');
  chip.setAttribute('data-tt', 'Apuração presidencial · TSE');
  chip.innerHTML = ballot + '<span>Eleição</span>';
  brazil.after(chip);
  panel = document.createElement('section');
  panel.id = 'election-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'election-title');
  panel.innerHTML = `<div class="election-head"><div class="election-heading">${ballot}<h2 id="election-title">PRESIDENTE</h2><span id="election-scope"></span></div><div class="election-actions"><div class="election-turns" aria-label="Turno da eleição"><button type="button" data-election-turn="1">1º turno</button><button type="button" data-election-turn="2">2º turno</button></div><button id="election-close" type="button" aria-label="Fechar placar da eleição">×</button></div></div>
    <div class="election-tabs" aria-label="Visão da eleição"><button type="button" data-election-tab="final" aria-pressed="true">Projeção final (TSE)</button><button type="button" data-election-tab="polls" aria-pressed="false">Pesquisa projetada</button></div>
    <div id="election-tab-final">
    <div id="election-candidates"></div><p id="election-empty" role="status"></p>
    <div id="election-totalization"><div class="election-total-row"><strong id="election-counted"></strong><div id="election-progress" role="progressbar" aria-label="Seções totalizadas" aria-valuemin="0" aria-valuemax="100"><span></span></div><span id="election-result-status"></span></div><div class="election-time-row"><a id="election-source" href="https://resultados.tse.jus.br/oficial/app/index.html" target="_blank" rel="noopener noreferrer">Fonte: TSE ↗</a><time id="election-tse-time"></time></div></div>
    <div id="election-trend" hidden role="status"><div class="election-trend-head"><span>Tendência desta sessão</span></div><svg id="election-trend-chart" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polyline id="election-trend-line" fill="none"></polyline></svg><p id="election-trend-note"></p><p id="election-trend-disclaimer">Mostra só como o apurado oficial mudou desde que este placar foi aberto, sem comparação com eleições anteriores — não é uma projeção do resultado final.</p></div>
    <p id="election-feedback" role="status" hidden></p><div id="election-refresh-info"></div>
    </div>
    <div id="election-tab-polls" hidden role="status"><div id="election-polls-body"></div></div>`;
  announcement = document.createElement('div');
  announcement.className = 'election-announcement';
  announcement.setAttribute('role', 'status');
  document.body.append(panel, announcement);
  chip.addEventListener('click', () => opened ? close() : open());
  panel.querySelector('#election-close').addEventListener('click', () => close());
  panel.querySelectorAll('[data-election-turn]').forEach(button => button.addEventListener('click', () => {
    const next = Number(button.dataset.electionTurn);
    if (turn === next) return;
    turn = next;
    render(client.lastGood.get(turn), false, true);
    refresh();
    if (activeTab === 'polls') renderPolls();
  }));
  panel.querySelectorAll('[data-election-tab]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.electionTab)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && opened) {event.preventDefault(); close();}
  });
  document.addEventListener('visibilitychange', () => {
    visibility();
    if (document.hidden) stop();
    else if (opened) refresh();
  });
  desktop.addEventListener('change', visibility);
  window.addEventListener('resize', position, {passive: true});
  const observer = new ResizeObserver(position);
  ['top-strip', 'sidebar-left', 'painel-direito'].forEach(id => {const element = document.getElementById(id); if (element) observer.observe(element);});
  window.ElectionPanel = Object.freeze({newQuakes,open,close});
  visibility();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
else init();
