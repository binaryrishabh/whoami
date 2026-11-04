// node render.mjs [names,comma] — render toys to out/*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const want = process.argv[2] ? process.argv[2].split(',') : null;
const N = Number(process.env.N || 170);
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1100, height: 1100 } });
p.on('pageerror', e => console.log('pageerror', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('console', m.text()); });
await p.goto('http://localhost:5599/');
await p.waitForFunction(() => window.ready, null, { timeout: 30000 });
const names = want || await p.evaluate(() => window.TOYS);
for (const n of names) {
  const r = await p.evaluate(([n, N]) => window.renderToy(n, N), [n, N]);
  fs.writeFileSync(`out/${n}.png`, Buffer.from(r.url.split(',')[1], 'base64'));
  console.log(n, r.tris, 'tris', r.ms, 'ms');
}
await b.close();
