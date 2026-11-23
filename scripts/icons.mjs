import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/favicon.svg', 'utf8');
const b = await chromium.launch();
for (const s of [192, 512]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(`<html><body style="margin:0;background:#14161f">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`);
  await p.screenshot({ path: `public/icon-${s}.png` });
}
await b.close();
