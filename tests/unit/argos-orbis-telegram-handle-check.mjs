// Regression guard: real public channel was renamed in Telegram on 2026-11-15.
// Keep operational channel IDs, bot token, and hosting endpoint unchanged.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const files = [
 'monitor-global-worker-7_7_0.js',
 'daily-summary-renderer.mjs',
 'js/quake-telegram-layout.js',
 'js/quake-telegram-glass.js',
 'js/story-share.js'
];
for (const file of files) {
 const source = readFileSync(new URL('../../'+file,import.meta.url),'utf8');
 assert.ok(source.includes('@argosorbis'),file+' must display the verified public Telegram username');
}
const worker = readFileSync(new URL('../../monitor-global-worker-7_7_0.js',import.meta.url),'utf8');
assert.ok(worker.includes('TELEGRAM_CHAT_ID'), 'keep the same private channel identifier');
assert.ok(worker.includes('t.me/argosorbis'), 'daily summary links to the new public channel');
console.log('Confirmed @argosorbis public-identity references');
