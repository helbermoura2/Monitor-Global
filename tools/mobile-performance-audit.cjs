// Local startup audit, not a physical-device or real-network benchmark.
// Run `npx serve -l 4173 .`, then `node tools/mobile-performance-audit.cjs`.
const { chromium } = require('playwright');
const origin = 'http://127.0.0.1:4173';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  const results = [];
  try {
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        serviceWorkers: 'block',
      });
      try {
        const page = await context.newPage();
        await page.route('**/*', route =>
          new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await page.addInitScript(() => {
          window.__long = [];
          new PerformanceObserver(list => {
            __long.push(...list.getEntries().map(entry => entry.duration));
          }).observe({ type: 'longtask', buffered: true });
        });
        await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.__mgMapReady && window.MobileEnergyBudget);
        await page.waitForTimeout(3000);
        results.push(await page.evaluate(() => {
          const resources = performance.getEntriesByType('resource')
            .filter(entry => entry.initiatorType === 'script' || entry.initiatorType === 'link');
          return {
            dcl: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
            resources: resources.length,
            bytes: resources.reduce((sum, entry) => sum + entry.decodedBodySize, 0),
            longTasks: __long.length,
            blockingMs: __long.reduce((sum, duration) => sum + Math.max(0, duration - 50), 0),
            heap: performance.memory?.usedJSHeapSize,
            optional: resources.filter(entry => /telegram-history|card-effect-demo|seismic-scenario-demo|solar-system/.test(entry.name))
              .map(entry => ({ url: entry.name.split('/').pop(), bytes: entry.decodedBodySize })),
            pixelRatio: map.getPixelRatio(),
          };
        }));
      } finally {
        await context.close();
      }
    }
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
