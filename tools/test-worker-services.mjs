/* Isolated processes keep mocked fetch, clocks and service state independent. */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const groups=[
 ['--test','tests/unit/tv-rain.test.mjs','tests/unit/tv-target-areas.test.mjs','tests/unit/global-seismic-data.test.mjs','tests/unit/population-reuse.test.mjs','tests/unit/admin-security.test.mjs','tests/unit/proxy-security.test.mjs','tests/unit/tv-alerts.test.mjs','tests/unit/tv-map.test.mjs','tests/unit/tsunami-lifecycle.test.mjs','tests/unit/tv-seismic-catalog.test.mjs','tests/unit/tv-history.test.mjs','tests/unit/tsunami-priority-policy.test.cjs','tests/unit/presentation-limits.test.cjs','tests/unit/tv-context.test.mjs','tests/unit/telegram-tsunami-delivery.test.mjs','tests/unit/tsunami-regional-model.test.cjs','tests/unit/image-tsunami-status.test.mjs','tests/unit/tsunami-image-patch.test.mjs','tests/unit/quake-card-layout.test.mjs','tests/unit/public-source-runtime.test.mjs','tests/unit/durable-alarm-guard.test.mjs','tests/unit/durable-demand.test.mjs','tests/unit/worker-modules.test.mjs','tests/unit/worker-image-parity.test.mjs','tests/unit/source-edge-cache.test.mjs','tests/unit/source-writeback-cache.test.mjs','tests/unit/shared-source-cache.test.mjs','tests/unit/shared-source-delivery.test.cjs','tests/unit/shared-kv-optimization.test.mjs','tests/unit/telegram-history-storage.test.mjs','tests/unit/brazil-epicenter-location.test.mjs','tests/unit/portuguese-translation-worker.test.mjs'],
 ...['telegram-history-check.mjs','telegram-global-check.mjs','telegram-brazil-check.mjs','telegram-revision-check.mjs','telegram-solution-priority-check.mjs','daily-summary-brazil-check.mjs','daily-summary-brazil-revision-check.mjs','daily-summary-design-check.mjs','source-proxy-check.mjs','tsunami-correlation-check.mjs'].map(name=>['tests/unit/'+name])
];
for(const args of groups){
 console.log('\nChecking Worker:',args.join(' '));
 const run=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit'});
 if(run.error)throw run.error;if(run.status!==0)process.exit(run.status||1);
}
