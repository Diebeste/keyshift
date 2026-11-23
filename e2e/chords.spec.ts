import { test, expect } from '@playwright/test';
import { FIX, makeFixtures } from './fixtures';

makeFixtures();

test('chord detection: timeline, shifted chords, edit, send to Chords tab, export', async ({ page }, info) => {
  await page.goto('./');
  await page.getByTestId('tab-audio').click();
  await page.getByTestId('audio-file').setInputFiles(`${FIX}/song.mp3`);
  const chart = page.getByTestId('chart');
  await expect(chart).toContainText('| C        | Am       | F        | G        |', { timeout: 60000 });
  await expect(chart).toContainText('| Dm       | Em       | G        | C        |');
  await expect(page.getByTestId('chord-timeline').locator('.seg')).toHaveCount(9);
  // play: the "now" chord follows playback
  await page.getByTestId('play').click();
  await expect(page.getByTestId('now-chord')).toBeVisible();
  await page.getByTestId('play').click();
  // render +2: side B shows shifted chords
  await page.getByTestId('render').click();
  await expect(page.getByTestId('verify')).toContainText('✓ Expected D major, detected D major', { timeout: 120000 });
  await expect(chart).toContainText('| D        | Bm       | G        | A        |');
  await page.screenshot({ path: `screenshots/${info.project.name}-5-chords-audio.png`, fullPage: true });
  // edit the first chord (in the shifted key) → stored in the original key
  await page.getByTestId('chord-timeline').locator('.seg').first().click();
  await page.getByTestId('chord-edit').fill('Dsus4');
  await page.getByTestId('chord-save').click();
  await expect(chart).toContainText('| Dsus4    | Bm');
  await page.getByTestId('chord-edit').fill('H7');
  await page.getByTestId('chord-save').click();
  await expect(page.getByText(/isn't a chord symbol/)).toBeVisible();
  const dl = page.waitForEvent('download');
  await page.getByTestId('chords-pro').click();
  expect((await dl).suggestedFilename().replace(/_/g, ' ')).toBe('song chords (+2).pro'); // WebKit uses _ for spaces
  // into the Chords tab: original Csus4, transposed Dsus4
  await page.getByTestId('send-chords').click();
  await expect(page.getByTestId('shift-value')).toHaveText('+2');
  await expect(page.getByTestId('transposed')).toContainText('Dsus4');
  await expect(page.getByTestId('transposed')).toContainText('D major');
  await expect(page.locator('.pane').first()).toContainText('Csus4');
});
