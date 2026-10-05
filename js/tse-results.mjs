// The same signed public files used by resultados.tse.jus.br. No API key.
export const ELECTION_2026 = Object.freeze({
  cycle: 'ele2026',
  secondTurnAt: Date.parse('2026-10-25T00:00:00-03:00'),
  // Temporary election feature; a final second-turn result retires it sooner.
  retireAt: Date.parse('2026-11-01T00:00:00-03:00'),
  interval: 30000
});
const BASE = 'https://resultados.tse.jus.br/oficial';
const PUBLIC_KEY = Object.freeze({
  kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA', use: 'sig', key_ops: ['verify'],
  kid: 'sNbt9Q_fLS65zE1_ZLNV-XRRwPY',
  x: 'kWlpNHjuws1csyQZwzn3Fhzbi3RD435RbpThtSr4hMc'
});
let keyPromise;
function bytes(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw Error('Arquivo TSE inválido');
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
export async function verifyTseJws(text) {
  const parts = text.trim().split('.');
  if (parts.length !== 3 || text.length > 3000000) throw Error('Arquivo TSE inválido');
  const header = JSON.parse(new TextDecoder().decode(bytes(parts[0])));
  if (header.alg !== 'EdDSA' || header.kid !== PUBLIC_KEY.kid || header.crit?.length) throw Error('Assinatura TSE desconhecida');
  if (!globalThis.crypto?.subtle) throw Error('Navegador sem verificação de assinatura');
  keyPromise ||= crypto.subtle.importKey('jwk', PUBLIC_KEY, {name: 'Ed25519'}, false, ['verify']);
  const valid = await crypto.subtle.verify('Ed25519', await keyPromise, bytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!valid) throw Error('Assinatura TSE inválida');
  return JSON.parse(new TextDecoder().decode(bytes(parts[1])));
}
function identifier(value) {
  const id = String(value || '');
  if (!/^\d{1,8}$/.test(id)) throw Error('Eleição TSE inválida');
  return id;
}
export function resolvePresidentialElections(config) {
  if (config.f !== 'o' || !Array.isArray(config.pl)) throw Error('Configuração TSE inválida');
  const elections = new Map();
  for (const pleito of config.pl) {
    if (pleito.c !== ELECTION_2026.cycle) continue;
    for (const election of pleito.e || []) {
      const president = election.abr?.some(a => a.cd === 'br' && a.cp?.some(c => String(c.cd) === '1'));
      const turn = Number(election.t);
      if (!president || ![1, 2].includes(turn)) continue;
      elections.set(turn, {id: identifier(election.cd), turn, cycle: pleito.c});
      if (turn === 1 && election.cdt2 && !elections.has(2)) elections.set(2, {id: identifier(election.cdt2), turn: 2, cycle: pleito.c});
    }
  }
  if (!elections.has(1)) throw Error('Eleição presidencial não encontrada');
  return elections;
}
function count(value) {
  if (!/^\d+$/.test(String(value))) throw Error('Contagem TSE inválida');
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw Error('Contagem TSE inválida');
  return n;
}
function percent(value) {
  if (!/^\d+(?:[,.]\d+)?$/.test(String(value))) throw Error('Percentual TSE inválido');
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100) throw Error('Percentual TSE inválido');
  return n;
}
export function tseTimestamp(date, time) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date || '') || !/^\d{2}:\d{2}:\d{2}$/.test(time || '')) throw Error('Horário TSE inválido');
  const [day, month, year] = date.split('/');
  const n = Date.parse(`${year}-${month}-${day}T${time}-03:00`);
  if (!Number.isFinite(n)) throw Error('Horário TSE inválido');
  return n;
}
export function normalizePresidentialResults(raw, election) {
  if (String(raw.ele) !== election.id || Number(raw.t) !== election.turn || raw.f !== 'o' || raw.tpabr !== 'br' || raw.cdabr !== 'br') throw Error('Resultado fora da eleição nacional');
  const cargo = raw.carg?.find(c => String(c.cd) === '1');
  if (!cargo || !Array.isArray(cargo.agr)) throw Error('Resultado presidencial inválido');
  const candidates = [], ids = new Set();
  for (const group of cargo.agr) for (const party of group.par || []) for (const candidate of party.cand || []) {
    const id = String(candidate.sqcand || candidate.n || '');
    if (!id || ids.has(id) || typeof candidate.nmu !== 'string' || !candidate.nmu.trim()) throw Error('Candidato TSE inválido');
    ids.add(id);
    candidates.push({id, number: String(candidate.n), name: candidate.nmu.trim(), party: String(party.sg || ''), votes: count(candidate.vap), percentage: percent(candidate.pvap)});
  }
  const totalSections = count(raw.s?.ts), countedSections = count(raw.s?.st);
  if (!totalSections || countedSections > totalSections || !candidates.length) throw Error('Totalização TSE inválida');
  candidates.sort((a, b) => b.votes - a.votes || a.number.localeCompare(b.number, 'pt-BR', {numeric: true}));
  return {
    status: 'results', turn: election.turn, election: election.id,
    source: 'TSE', sourceUrl: `${BASE}/app/index.html#/eleicao/${election.id}/uf/br/cargo/1/vis/nominal/resultados`,
    candidates, countedSections, totalSections, percentageCounted: percent(raw.s.pst),
    updatedAt: tseTimestamp(raw.dt, raw.ht), generatedAt: tseTimestamp(raw.dg, raw.hg),
    finished: raw.tf === 's'
  };
}
export class TseResultsClient {
  constructor(fetcher = globalThis.fetch.bind(globalThis), now = Date.now) {
    this.fetcher = fetcher;
    this.now = now;
    this.elections = null;
    this.configAt = 0;
    this.lastGood = new Map();
  }
  async signed(path, signal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, {once: true});
    const timer = setTimeout(abort, 12000);
    try {
      // Match the official application's cache-busting request scheme.
      const response = await this.fetcher(`${BASE}/${path}?nocache=${this.now()}`, {signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer'});
      if (response.status === 404) return null;
      if (!response.ok) throw Error('TSE indisponível');
      return await verifyTseJws(await response.text());
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  async load(turn, {signal} = {}) {
    if (![1, 2].includes(turn)) throw Error('Turno inválido');
    if (!this.elections || this.now() - this.configAt >= 600000) {
      try {
        const config = await this.signed('comum/config/ele-c.jws', signal);
        this.elections = resolvePresidentialElections(config || {});
        this.configAt = this.now();
      } catch (error) {
        if (!this.elections || signal?.aborted) throw error;
        // A cached, verified configuration still identifies both elections.
      }
    }
    const election = this.elections.get(turn);
    if (!election) return {status: 'pending', turn};
    const code = election.id.padStart(6, '0');
    const raw = await this.signed(`${election.cycle}/${election.id}/dados/br/br-c0001-e${code}-u.jws`, signal);
    if (!raw) {
      if (this.lastGood.has(turn)) throw Error('TSE indisponível');
      return {status: 'pending', turn};
    }
    const result = normalizePresidentialResults(raw, election), previous = this.lastGood.get(turn);
    if (previous && (result.updatedAt < previous.updatedAt || result.generatedAt < previous.generatedAt)) throw Error('Resposta anterior à última apuração');
    result.checkedAt = this.now();
    this.lastGood.set(turn, result);
    return result;
  }
}
