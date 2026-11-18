import { test, expect } from '@playwright/test';
const site = 'http://localhost:4199';
test.beforeEach(async ({ page }) => {
  await page.goto(site);
});
test('complete workflow: analyze, compress, compare, download, history and insights', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Try a sample' }).click();
  await expect(page.locator('.analysis-line')).toContainText('Mixed document');
  await page.getByRole('button', { name: 'Compress PDFs', exact: true }).click();
  await expect(page.locator('.output-title')).toContainText('Compression complete');
  await page.getByRole('button', { name: 'Compare', exact: true }).click();
  await expect(page.locator('.sheet canvas')).toHaveCount(2);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.locator('.preview-toolbar')).toContainText('Page 2 of 2');
  await expect(page.locator('.render-loading')).toHaveCount(0);
  await expect(page.locator('.sheet .notice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  const down = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  expect((await down).suggestedFilename()).toContain('-compressed.pdf');
  await page.getByRole('button', { name: 'View history' }).click();
  await expect(page.locator('main:visible table:visible tbody tr')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('table:visible tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Usage insights', exact: true }).click();
  await expect(page.locator('.insight-cards')).toContainText('Documents today1');
});
test('all toolbox entries, search, merge interaction and local errors', async ({ page }) => {
  await page.getByRole('button', { name: /PDF toolbox/ }).click();
  await expect(page.locator('.tool-card')).toHaveCount(12);
  await page.getByRole('textbox', { name: 'Find a tool' }).fill('merge');
  await expect(page.locator('.tool-card')).toHaveCount(1);
  await page.locator('.tool-card').click();
  await page
    .locator('#tool-picker')
    .setInputFiles(['.artifacts/fixtures/text.pdf', 'public/sample.pdf']);
  await page.locator('.tool-run').click();
  await expect(page.locator('.output-card')).toContainText('Your file is ready');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Compression studio', exact: true }).click();
  await page.locator('#studio-picker').setInputFiles('.artifacts/fixtures/corrupt.pdf');
  await expect(page.locator('.notice.error')).toBeVisible();
});
test('does not persist file bytes, remembers theme and honors history opt-out', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.reload();
  expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');
  await page.getByRole('button', { name: 'Local engine ready' }).click();
  await page.getByRole('checkbox', { name: /Remember file activity/ }).uncheck();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Try a sample' }).click();
  await expect(page.locator('.analysis-line')).toBeVisible();
  await page.getByRole('button', { name: 'Compress PDFs', exact: true }).click();
  await expect(page.locator('.output-card')).toBeVisible();
  await page.reload();
  await expect(page.locator('.queue-item')).toHaveCount(0);
  await expect(page.locator('.recent-empty')).toContainText('A fresh workspace');
});
test.describe('offline installation', () => {
  test.use({ serviceWorkers: 'allow' });
  test('installed workspace processes documents completely offline', async ({ page, context }) => {
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole('button', { name: 'Try a sample' }).click();
    await expect(page.locator('.analysis-line')).toBeVisible();
    await page.getByRole('button', { name: 'Compress PDFs', exact: true }).click();
    await expect(page.locator('.output-card')).toContainText('Compression complete');
  });
});
for (const [w, h] of [
  [320, 640],
  [360, 800],
  [412, 915],
  [768, 1024],
  [915, 412],
])
  test(`responsive workspace at ${w}×${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('button', { name: 'Browse files', exact: true })).toBeVisible();
    if (w <= 760) {
      await page.getByRole('button', { name: 'Open workspace menu' }).click();
      await page.locator('.drawer').getByRole('button', { name: 'Dark', exact: true }).click();
      await page.getByRole('button', { name: 'Close menu' }).click();
      await page.locator('.mobile-nav').getByRole('button', { name: 'Toolbox' }).click();
      await expect(page.locator('.tool-card')).toHaveCount(12);
    }
  });
test('batch compression, custom targets, and deleting recorded activity', async ({ page }) => {
  await page
    .locator('#studio-picker')
    .setInputFiles(['public/sample.pdf', '.artifacts/fixtures/text.pdf']);
  await expect(page.locator('.analysis-line')).toHaveCount(2);
  await page.getByLabel('More target sizes').selectOption('custom');
  await page.getByRole('spinbutton', { name: 'Custom target in KB' }).fill('200');
  await page.getByRole('button', { name: 'Compress 2 PDFs', exact: true }).click();
  await expect(page.locator('.output-card')).toHaveCount(2);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'View history' }).click();
  await page.getByRole('button', { name: 'Clear history', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Clear history', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'No activity yet' })).toBeVisible();
});
