const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const panel = fs.readFileSync('js/painel-e-lista.js', 'utf8');
function fn(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const quake = (id) => ({ id, time: Date.now(), mag: 3, coords: [10, 20] });
const alert = (id, type = 'storm') => ({ id, type, time: Date.now(), coords: [30, 40] });
function camera(events, selected, feed) {
  const timers = [];
  const shown = [];
  const c = vm.createContext({ globalEvents: events, eventoSelecionadoId: selected,
    window: {}, map: { isMoving: () => false }, cycleTimeout: null,
    setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout() {},
    console, buildUnifiedFeed: () => feed,
    showEventDetails: (i) => shown.push(events[i].id),
    showAlertDetails: (e) => shown.push(e.id) });
  vm.runInContext(['isWithinAutoCycleAge','getPriorityCameraEarthquakes','autoCycleRandomInt','autoCycleDraw','getAutoCycleProtectionRemaining','selectNextAutoCycleItem','showNextAutoCycleItem','scheduleNextAutoCycle','runAutoCycle'].map(name=>fn(panel,name)).join('\n'), c);
  c.scheduleNextAutoCycle(5000);
  timers.shift()();
  return { c, shown };
}
test('primeiro slot sísmico não é tomado por mais de 50 alertas', () => {
  const q = quake('q');
  const feed = [...Array.from({ length: 60 }, (_, i) => alert(`a${i}`)), q];
  assert.deepEqual(camera([q], 'q', feed).shown, ['q']);
});
test('ciclo mantém alternância entre sismos e fallback sem sismos', () => {
  assert.deepEqual(camera([quake('q1'), quake('q2')], 'q1', []).shown, ['q2']);
  assert.deepEqual(camera([], null, [alert('a')]).shown, ['a']);
  assert.deepEqual(camera([], null, []).shown, []);
});
test('todos os tipos são barrados antes de modificar painel/hold; manual e refresh passam', () => {
  const c = vm.createContext({ globalEvents: [quake('q')], eventoSelecionadoId:'q', window: { __mgHoldMag: 6, __mgRevisionProtectedId:'q', __mgRevisionProtectedUntil:Date.now()+90000 },
    fecharViradaCardAlcance() { throw new Error('passou pela barreira'); } });
  vm.runInContext(fn(panel, 'getAutoCycleProtectionRemaining') + '\n' + fn(panel, 'showAlertDetails'), c);
  // Um acesso ao DOM identifica que a chamada passou pelo guard central.
  for (const type of ['tornado', 'hurricane', 'storm', 'flood', 'volcano', 'tsunami', 'civil', 'future-type']) {
    c.showAlertDetails(alert('a', type), true);
    assert.equal(c.window.__mgHoldMag, 6);
    c.window.__mgSoftCycle = true;
    c.showAlertDetails(alert('a', type), false);
    assert.equal(c.window.__mgSoftCycle, false);
  }
  assert.throws(() => c.showAlertDetails(alert('a'), false), /not defined/);
  assert.throws(() => c.showAlertDetails(alert('a'), false, true), /not defined/);
  c.globalEvents = [];
  c.window.__mgRevisionProtectedUntil=0;
  assert.throws(() => c.showAlertDetails(alert('a'), true), /not defined/);
});
function audio({ allowed = true, muted = false, ready = 'complete' } = {}) {
  const listeners = {};
  const counters = { resume: 0, flush: 0, banner: 0, voices: 0 };
  class Context {
    constructor() { this.state = 'suspended'; }
    resume() {
      counters.resume++;
      if (!allowed) return Promise.reject(new Error('autoplay bloqueado'));
      this.state = 'running';
      return Promise.resolve();
    }
  }
  const c = vm.createContext({ window: { AudioContext: Context, addEventListener() {},
    speechSynthesis: { getVoices() { counters.voices++; return []; } } },
    document: { readyState: ready, visibilityState: 'visible',
      getElementById() { return null; },
      createElement() { counters.banner++; },
      addEventListener(name, f) { listeners[name] = f; } },
    location: { search: '' }, audioContext: null, isAudioUnlocked: false,
    somAtivo: !muted, localStorage: { setItem() {} }, somMutedTypes: new Set(),
    carregarVozesDisponiveis() { counters.voices++; },
    console: { warn() {} }, pendingSounds: [], vozesDisponiveis: [],
    flushPendingSounds() { counters.flush++; }, playUnlockChime() {},
    pedirPermissaoNotificacao() { throw Error('pedido automático indevido'); } });
  const source = fs.readFileSync('js/audio.js', 'utf8');
  // Executa a inicialização real, com os sintetizadores isolados da política.
  vm.runInContext(source.slice(source.indexOf('function atualizarBotaoSomHeader()'), source.indexOf('/*\n * ALARME SÍSMICO')),
    c);
  c.carregarVozesDisponiveis = () => counters.voices++;
  return { c, counters, listeners, allow() { allowed = true; } };
}
test('autoplay permitido libera imediatamente e não cria banner', async () => {
  // carregarVozesDisponiveis é necessário durante a inicialização.
  const a = audio();
  await Promise.resolve();
  assert.equal(a.c.isAudioUnlocked, true);
  assert.equal(a.counters.banner, 0);
  assert.ok(a.counters.flush > 0);
});
test('autoplay bloqueado fica pendente e um gesto posterior libera', async () => {
  const a = audio({ allowed: false, ready: 'loading' });
  a.listeners.DOMContentLoaded();
  await new Promise(setImmediate);
  assert.equal(a.c.isAudioUnlocked, false);
  assert.equal(a.counters.banner, 0);
  a.allow();
  a.listeners.pointerdown();
  await new Promise(setImmediate);
  assert.equal(a.c.isAudioUnlocked, true);
  assert.ok(a.counters.flush > 0);
});
test('estado running libera fila sem gesto e respeita preferência de mudo', async () => {
  const a = audio({ allowed: false, ready: 'loading' });
  a.listeners.DOMContentLoaded();
  await new Promise(setImmediate);
  a.c.audioContext.state = 'running';
  a.c.audioContext.onstatechange();
  assert.equal(a.c.isAudioUnlocked, true);
  assert.ok(a.counters.flush > 0);
  const m = audio({ muted: true, ready: 'loading' });
  m.listeners.DOMContentLoaded();
  assert.equal(m.counters.resume, 0);
  m.listeners.click();
  assert.equal(m.counters.resume, 0);
});
