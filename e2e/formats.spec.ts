import { test, expect } from '@playwright/test';
import { statSync, appendFileSync } from 'node:fs';
import { FIX, FORMATS, makeFixtures } from './fixtures';

makeFixtures();
test.describe.configure({ mode: 'parallel' });

for (const f of FORMATS) {
  test(`decodes ${f.name}`, async ({ page }, info) => {
    test.skip(info.project.name === 'mobile-390x844', 'format matrix runs on desktop Chromium and WebKit');
    const t0 = Date.now();
    await page.goto('./');
    await page.getByTestId('tab-audio').click();
    await page.getByTestId('audio-file').setInputFiles(`${FIX}/${f.file}`);
    const info2 = page.getByTestId('audio-info'), err = page.getByTestId('error');
    await expect(info2.or(err)).toBeVisible({ timeout: 120000 });
    const failed = await err.isVisible();
    const via = failed ? 'FAILED' : await page.getByTestId('decoded-via').innerText();
    let key = '', chords = '';
    if (!failed) {
      key = await page.getByTestId('key-results').first().locator('li').first().locator('.kname').innerText({ timeout: 60000 });
      await expect(page.getByTestId('chart')).toBeVisible({ timeout: 60000 });
      chords = (await page.getByTestId('chart').innerText()).replace(/\s+/g, ' ').trim();
    }
    const line = `${info.project.name}\t${f.name}\t${via}\t${key}\t${((Date.now() - t0) / 1000).toFixed(1)}s\t${chords}`;
    appendFileSync(`${FIX}/matrix.tsv`, line + '\n');
    console.log('[matrix] ' + line);
    expect(failed, failed ? await err.innerText() : '').toBe(false);
    expect(['C major', 'A minor']).toContain(key);
    // export in the original container's audio format for one lossless and one video case
    if (!/\.(mp3|wav)$/.test(f.file)) {
      await page.getByTestId('render').click();
      await expect(page.getByTestId('verify')).toContainText('✓', { timeout: 120000 });
      const dl = page.waitForEvent('download', { timeout: 180000 });
      await page.getByTestId('export-orig').click();
      const d = await dl;
      const p = `${FIX}/${info.project.name}-${d.suggestedFilename()}`;
      await d.saveAs(p);
      expect(d.suggestedFilename()).toMatch(/\(\+2\)\.(flac|mka|webm|opus|ogg|m4a|aiff)$/);
      expect(statSync(p).size).toBeGreaterThan(10000);
      console.log(`[matrix] ${info.project.name}\t${f.name}\texport-orig\t${d.suggestedFilename()}\t${statSync(p).size} bytes`);
    }
  });
}

for (const file of ['video.mkv', 'song.flac', 'song.opus']) {
  test(`ffmpeg.wasm fallback decodes ${file} (native decoder skipped)`, async ({ page }, info) => {
    test.skip(info.project.name === 'mobile-390x844', 'desktop browsers only');
    await page.goto('./?decoder=ffmpeg&warnFileMB=0.01');
    await page.getByTestId('tab-audio').click();
    await page.getByTestId('audio-file').setInputFiles(`${FIX}/${file}`);
    await expect(page.getByTestId('decoded-via')).toHaveText('ffmpeg.wasm', { timeout: 120000 });
    await expect(page.getByTestId('warning').first()).toContainText('Large file');
    const key = await page.getByTestId('key-results').first().locator('li').first().locator('.kname').innerText();
    expect(['C major', 'A minor']).toContain(key);
    console.log(`[matrix] ${info.project.name}\t${file}\tforced ffmpeg.wasm\t${key}`);
  });
}
