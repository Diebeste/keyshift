import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const PKG_VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { renderProgression, C_MAJOR_PROG } from '../src/audio/synth';
import { encodeWav, encodeMp3 } from '../src/audio/encode';

const FIX = 'e2e/.fixtures';
mkdirSync(FIX, { recursive: true });
const wavPath = `${FIX}/c-major.wav`;
const prog = renderProgression(C_MAJOR_PROG, 1.5, 44100, 2);
writeFileSync(wavPath, encodeWav([prog], 44100));
// generated test MP3 (no third-party audio needed)
const mp3Path = `${FIX}/c-major.mp3`;
writeFileSync(mp3Path, encodeMp3([prog, prog], 44100, 192));

test('app loads, shows version, all tabs work, audio round-trip', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = (n: string) => page.screenshot({ path: `screenshots/${info.project.name}-${n}.png`, fullPage: true });

  await page.goto('./');
  await expect(page.getByTestId('version')).toContainText(`Key Shift v${PKG_VERSION}+`);
  // Key tab: text detection of the sample sheet (G major)
  await expect(page.getByTestId('key-results').first().locator('li').first()).toContainText('G major');
  // Audio key detection
  await page.getByTestId('key-file').setInputFiles(wavPath);
  await expect(page.getByTestId('key-results').first().locator('li').first()).toContainText(/C major|A minor/, { timeout: 60000 });
  await expect(page.getByText(/Engine: Essentia/)).toBeVisible();
  await shot('1-key');

  // Transpose tab: G → A (+2)
  await page.getByTestId('tab-transpose').click();
  await page.locator('#target-key').selectOption({ label: 'A major' });
  await expect(page.getByTestId('shift-value')).toHaveText('+2');
  await expect(page.getByTestId('transpose-summary')).toContainText('major 2nd up');
  await expect(page.getByTestId('capo-table').locator('tbody tr')).toHaveCount(3);
  await shot('2-transpose');

  // Chords tab
  await page.getByTestId('tab-chords').click();
  await expect(page.getByTestId('transposed')).toContainText('E/G#');
  await expect(page.getByTestId('transposed')).toContainText('Amazing grace');
  await page.getByTestId('nashville').check();
  await expect(page.getByTestId('nashville-pane')).toContainText('5/7');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export .pro' }).click();
  expect((await dl).suggestedFilename().replace(/_/g, ' ')).toMatch(/\(A\)\.pro$/);
  await shot('3-chords');

  // Audio tab: render +2, verify key moved, export MP3
  await page.getByTestId('tab-audio').click();
  await page.getByTestId('audio-file').setInputFiles(mp3Path);
  await expect(page.getByTestId('audio-info')).toContainText(/\d+ Hz/);
  await expect(page.getByTestId('render')).toBeEnabled({ timeout: 60000 });
  await page.getByTestId('render').click();
  await expect(page.getByTestId('verify')).toContainText('✓ Expected D major, detected D major', { timeout: 120000 });
  await page.getByTestId('play').click();
  await page.waitForTimeout(400);
  await page.getByTestId('play').click();
  const mp3 = page.waitForEvent('download');
  await page.getByTestId('export-mp3').click();
  const d = await mp3;
  expect(d.suggestedFilename().replace(/_/g, ' ')).toBe('c-major (+2).mp3');
  const p = `${FIX}/${info.project.name}-out.mp3`;
  await d.saveAs(p);
  expect(statSync(p).size).toBeGreaterThan(20000);
  await shot('4-audio');

  // service worker registers (offline support)
  const sw = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
  expect(sw).toBe(true);
  expect(errors.filter((e) => !/favicon|AudioContext was not allowed/.test(e))).toEqual([]);
});

test('works offline after first visit (service worker)', async ({ page, context }) => {
  await page.goto('./');
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe(new URL('./', page.url()).href);
  // manifest start_url/scope resolve to the app folder (e.g. /keyshift/ on Pages)
  const m = await page.evaluate(async () => {
    const href = (document.querySelector('link[rel=manifest]') as HTMLLinkElement).href;
    const j = await (await fetch(href)).json();
    return { start: new URL(j.start_url, href).href, scope: new URL(j.scope, href).href };
  });
  expect(m.start).toBe(scope);
  expect(m.scope).toBe(scope);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('version')).toContainText('Key Shift v');
  await page.getByTestId('tab-chords').click();
  await expect(page.getByTestId('transposed')).toContainText('Amazing grace');
  // the audio engines (workers, Essentia, Rubber Band wasm) also come from the cache
  await page.getByTestId('tab-audio').click();
  await page.getByTestId('audio-file').setInputFiles(mp3Path);
  await expect(page.getByTestId('render')).toBeEnabled({ timeout: 60000 });
  await page.getByTestId('render').click();
  await expect(page.getByTestId('verify')).toContainText('✓ Expected D major, detected D major', { timeout: 60000 });
  await context.setOffline(false);
});

test('empty audio files show an error and do not hang', async ({ page }) => {
  const empty = `${FIX}/empty.mp3`;
  writeFileSync(empty, '');
  await page.goto('./');
  await page.getByTestId('tab-audio').click();
  await page.getByTestId('audio-file').setInputFiles(empty);
  await expect(page.getByTestId('error')).toContainText(/empty/i, { timeout: 15000 });
  await expect(page.getByTestId('render')).toHaveCount(0);
});
