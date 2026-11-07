import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../../js/painel-e-lista.js', import.meta.url), 'utf8');
const escapedText = source.match(/^const esc = .*;$/m)?.[0];
const start = source.indexOf('function renderPainelTimeline(item) {');
const end = source.indexOf('\nlet panelPresentationPrevious', start);
assert(escapedText && start >= 0 && end > start, 'Timeline/escape helper must remain testable');

function render(item) {
 const timeline = {innerHTML:'', style:{}};
 const context = {
  document:{getElementById:id=>id==='pd-timeline'?timeline:null},
  window:{EventInsights:{render() {}}},
  activeUpdatedIds:new Set(),
  formatTime:()=> '12:34',
 };
 runInNewContext(escapedText + '\n' + source.slice(start, end) + '\nrenderPainelTimeline(item);', {...context,item});
 return timeline;
}

test('timeline escapes all data-derived text while preserving its structure', () => {
 const malicious = '<svg/onload=alert(1)>';
 const timeline=render({
  id:'test-event',hazardNature:'bulletin',time:Date.now(),
  sourceSummary:malicious,
  _updatedAt:Date.now(),_deltaTxt:malicious,
  _sourceUpdatedAt:Date.now(),_sourceUpdateTxt:malicious,
 });
 assert.equal(timeline.style.display,'flex');
 assert.equal((timeline.innerHTML.match(/&lt;svg/g)||[]).length,3);
 assert.doesNotMatch(timeline.innerHTML, /<svg|<img|onerror\s*=/i);
 assert.match(timeline.innerHTML, /class="pd-tl-step"/);
 assert.match(timeline.innerHTML, /class="pd-tl-v"/);
});

test('timeline still renders legitimate source text and hides when empty',()=>{
 const timeline=render({source:'EMSC · USGS',time:null});
 assert.match(timeline.innerHTML,/EMSC · USGS/);
 assert.match(timeline.innerHTML,/Detectado/);
 const empty=render(null);assert.equal(empty.style.display,'none');
});
