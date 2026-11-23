import { test, expect } from '@playwright/test';
import { existsSync, statSync } from 'node:fs';

// Manual check with a real MP3: Erik Satie "Gymnopédie No. 1" performed by Kevin MacLeod (incompetech.com, CC BY 4.0).
const MP3 = 'manual/gymnopedie1.mp3';
test.skip(!existsSync(MP3), 'real MP3 not downloaded');

test('real MP3: detect key, render +2, verify, export MP3', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-1366x900', 'run once');
  test.setTimeout(600000);
  await page.goto('./');
  await page.getByTestId('tab-audio').click();
  await page.getByTestId('audio-file').setInputFiles(MP3);
  await expect(page.getByTestId('render')).toBeEnabled({ timeout: 120000 });
  const t0 = Date.now();
  await page.getByTestId('render').click();
  await expect(page.getByTestId('verify')).toBeVisible({ timeout: 540000 });
  const secs = (Date.now() - t0) / 1000;
  const verdict = await page.getByTestId('verify').innerText();
  const before = await page.locator('[data-testid=key-results]').nth(0).innerText();
  const after = await page.locator('[data-testid=key-results]').nth(1).innerText();
  console.log(`RENDER+VERIFY ${secs.toFixed(1)}s\nBEFORE:\n${before}\nAFTER:\n${after}\nVERDICT: ${verdict}`);
  await page.screenshot({ path: 'screenshots/real-mp3-gymnopedie.png', fullPage: true });
  const dl = page.waitForEvent('download');
  await page.getByTestId('export-mp3').click();
  const d = await dl;
  await d.saveAs('manual/gymnopedie1-plus2.mp3');
  console.log('EXPORT', d.suggestedFilename(), statSync('manual/gymnopedie1-plus2.mp3').size);
  expect(verdict).toMatch(/^[✓≈]/);
});
