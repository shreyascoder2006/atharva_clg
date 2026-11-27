// Fresh high-resolution prototype captures for the pitch deck and explainer.
const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const S = (fn, arg) => page.evaluate(fn, arg);
  const shot = async (name, wait = 2500) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot', name); };
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await shot('tower', 9000);
  await S(() => window.__shipment.getState().setLens('carbon'));
  await shot('tower-carbon', 4000);
  await S(() => window.__shipment.getState().setLens('ulip'));
  await shot('tower-ulip', 4000);
  await S(() => window.__shipment.getState().setLens('operations'));
  await S(() => window.__shipment.getState().triggerDisruption('red_sea'));
  await shot('tower-redsea', 8000);
  await S(() => window.__shipment.getState().setXray(true));
  await shot('xray-modal', 3000);
  await S(() => window.__shipment.getState().setXray(false));
  const views = ['shipments', 'documents', 'partners', 'comms', 'financials', 'integrations'];
  for (const v of views) {
    await S((x) => window.__shipment.getState().setView(x), v);
    await shot('page-' + v, 3500);
  }
  // Lower halves of the long dashboards.
  for (const v of ['documents', 'financials', 'integrations']) {
    await S((x) => window.__shipment.getState().setView(x), v);
    await page.waitForTimeout(2000);
    await page.mouse.move(900, 600);
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(80); }
    await shot('page-' + v + '-lower', 1500);
  }
  await browser.close();
})();
