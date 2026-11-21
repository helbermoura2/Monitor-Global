import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';

const root = new URL('../../', import.meta.url);
const policy = readFileSync(new URL('.assetsignore', root), 'utf8');
const headers = readFileSync(new URL('_headers', root), 'utf8');

function ignored(path, dir) {
 const result = spawnSync('git', ['check-ignore', '-q', '--no-index', path], {cwd:dir});
 assert([0,1].includes(result.status), `git check-ignore failed for ${path}: ${result.stderr?.toString()}`);
 return result.status === 0;
}

test('static upload excludes backend, tooling, app sources, configuration and secrets', () => {
 const dir = mkdtempSync(join(tmpdir(), 'mg-static-policy-'));
 try {
  assert.equal(spawnSync('git', ['init', '-q'], {cwd:dir}).status, 0);
  writeFileSync(join(dir, '.gitignore'), policy);
  for (const path of [
   '.git/config', '.github/workflows/smoke-test.yml', '.gitignore', '.assetsignore',
   '.env', '.env.production', 'js/service-account.pem',
   'README.md', 'GUIA_DO_DONO.md', 'MAPA_DOS_ARQUIVOS.md',
   'wrangler.toml', 'wrangler-monitor.toml', 'wrangler-mobile-push.toml',
   'package.json', 'package-lock.json', 'playwright.config.js',
   'tsunami-official-worker.mjs', 'kv-operation-metrics.mjs',
   'monitor-global-worker-7_7_0.js', 'worker/proxy-security.mjs',
   'tools/cloudflare-worker-maintenance.py', 'tests/unit/admin-security.test.mjs',
   'android-mobile/app/build.gradle', 'android-tv/app/build.gradle',
   'android-tv/README.md', 'docs/revisao-seguranca-20261024.md',
   'node_modules/esbuild/index.js', 'test-results/trace.zip',
   'audit-results/cloudflare-free-quota.json', 'playwright-report/index.html',
   'downloads/monitor-global-worker-otimizado.zip',
   'downloads/monitor-global-worker-sem-pesquisas.zip',
  ]) assert.equal(ignored(path, dir), true, `${path} must not be published`);
  for (const path of [
   'index.html', '_headers', 'sw-monitor.js', 'manifest.webmanifest',
   'js/ui-wiring-final.js', 'css/mobile-late-patches.css',
   'vendor/maplibre-gl.css', 'data/cemaden-alerts.json',
   'img/og-preview.png', 'assets/flags/BR-SP.svg',
   'media/card-fx/flood-current.mp4', 'mobile/index.html',
   'satellite/index.html', 'population-exposure.css',
   'mg-volcano-flood-fetch.js',
   'android-tv/distribution/stable.json',
   'downloads/monitor-global-tv-1.0.54.apk',
   'downloads/monitor-global-tv-1.0.54.apk.sha256',
  ]) assert.equal(ignored(path, dir), false, `${path} must remain accessible`);
 } finally {rmSync(dir, {recursive:true, force:true});}
});

test('static headers harden documents without restricting map or live data origins', () => {
 assert.match(headers, /^\/\*$/m);
 assert.match(headers, /^\s+X-Content-Type-Options:\s*nosniff\s*$/m);
 assert.match(headers, /^\s+Referrer-Policy:\s*strict-origin-when-cross-origin\s*$/m);
 assert.match(headers, /^\s+X-Frame-Options:\s*SAMEORIGIN\s*$/m);
 assert.match(headers, /^\s+Content-Security-Policy:.*frame-ancestors 'self'.*object-src 'none'.*base-uri 'self'\s*$/m);
 assert.doesNotMatch(headers, /(?:script-src|connect-src|img-src|style-src|font-src|default-src)/);
});
