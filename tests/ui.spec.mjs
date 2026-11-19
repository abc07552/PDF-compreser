import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
const site = 'http://localhost:4199/PDF-compreser/';
const nav = (p, t) =>
  p
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('button', { name: t, exact: true });
const phoneNav = (p, t) =>
  p
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: t, exact: true });
const btn = (p, t) => p.getByRole('button', { name: t, exact: true });
const overflow = (p) => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
const input = (p) => p.locator('#library-picker');
const settings = (p) => btn(p, 'Workspace settings').click();
const run = (p) => btn(p, 'Compress PDF').click();
const docName = (p, n) => p.locator('.doc-select').filter({ hasText: n });
const actions = (p) => btn(p, 'Document actions').click();
const close = (p) => btn(p, 'Close dialog').click();
const fixture = (n) => `.artifacts/fixtures/${n}.pdf`;
test.beforeEach(async ({ page }) => {
  await page.goto(site);
  await expect(page.locator('.doc-select')).toHaveCount(6);
});
test('complete local workflow, real per-page quality inspection, output and analytics', async ({
  page: p,
}) => {
  await expect(p.locator('.main-page')).toBeVisible();
  await run(p);
  await expect(p.locator('.delivery-title')).toContainText('Compression complete');
  await btn(p, 'Compare').click();
  await expect(p.locator('.sheet canvas')).toHaveCount(2);
  await expect(p.locator('.v-quality')).toContainText('Geometry matches');
  await btn(p, 'Next page').click();
  await expect(p.locator('.v-quality')).toContainText('Page 2 inspection');
  await expect(p.locator('.v-quality')).toContainText('Selectable text matches');
  await close(p);
  const dl = p.waitForEvent('download');
  await btn(p, 'Save copy').click();
  const file = await dl;
  expect(file.suggestedFilename()).toBe('Alpine Field Report-compressed.pdf');
  const pdf = await PDFDocument.load(await readFile(await file.path()));
  expect(pdf.getPageCount()).toBe(5);
  await btn(p, 'View file history').click();
  await expect(p.locator('tbody tr')).toHaveCount(1);
  await p.reload();
  await expect(p.locator('tbody tr')).toHaveCount(1);
  await nav(p, 'Analytics').click();
  await expect(p.locator('.insight-summary')).toContainText([
    'PDFs compressed1',
    'Successful jobs1',
  ]);
});
test('all 12 tools, search, merge library and imported PDF, and corrupt file error', async ({
  page: p,
}) => {
  await nav(p, 'PDF tools').click();
  await expect(p.locator('.tool-card')).toHaveCount(12);
  await p.getByRole('textbox', { name: 'Find a tool' }).fill('merge');
  await expect(p.locator('.tool-card')).toHaveCount(1);
  await p.locator('.tool-card').click();
  await btn(p, 'Use document').click();
  await p.locator('#tool-picker').setInputFiles(fixture('text'));
  await p.locator('.tool-run').click();
  await expect(p.locator('.output-card')).toContainText('Your file is ready');
  await close(p);
  await nav(p, 'Workspace').click();
  await input(p).setInputFiles(fixture('corrupt'));
  await expect(p.locator('.v-error')).toContainText(/damaged|invalid|readable|PDF/i);
  await expect(p.locator('.doc-select')).toHaveCount(6);
});
test('theme and metadata opt-out survive reload; default leaves no personal file data', async ({
  page: p,
}) => {
  await settings(p);
  await p.getByRole('switch', { name: 'Remember file activity' }).click();
  await p.getByRole('switch', { name: 'Dark appearance' }).click();
  await nav(p, 'Workspace').click();
  await input(p).setInputFiles(fixture('text'));
  await expect(p.locator('.preview-file b')).toHaveText('text.pdf');
  await run(p);
  await expect(p.locator('.delivery-card')).toBeVisible();
  await p.reload();
  await expect(p.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(p.locator('.doc-select')).toHaveCount(6);
  const counts = await p.evaluate(
    () =>
      new Promise((resolve) => {
        const r = indexedDB.open('pdf-reducer-workspace');
        r.onsuccess = () => {
          const t = r.result.transaction(['files', 'library', 'activity']);
          const a = ['files', 'library', 'activity'].map((k) => t.objectStore(k).count());
          t.oncomplete = () => resolve(a.map((r) => r.result));
        };
      }),
  );
  expect(counts).toEqual([0, 0, 0]);
});
test('opt-in local library: durable import, search/category/star, rename, copy, confirmed deletion', async ({
  page: p,
}) => {
  await settings(p);
  await p.getByRole('switch', { name: 'Keep imported PDFs' }).click();
  await nav(p, 'Workspace').click();
  await input(p).setInputFiles(fixture('text'));
  await expect(p.locator('.preview-file')).toContainText('text.pdf');
  await actions(p);
  await p.getByLabel('Document name').fill('Review notes.pdf');
  await p.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Certificates');
  await btn(p, 'Star document').click();
  await btn(p, 'Apply changes').click();
  await expect(p.getByRole('dialog')).toHaveCount(0);
  await expect(p.locator('.preview-file b')).toHaveText('Review notes.pdf');
  await p.reload();
  await expect(p.locator('.preview-file')).toContainText('Review notes.pdf');
  await expect(p.locator('.main-page')).toBeVisible();
  await btn(p, 'Starred').click();
  await btn(p, 'Filter and sort library').click();
  await p.getByRole('combobox', { name: 'Category', exact: true }).selectOption('Certificates');
  await p.getByLabel('Search library').fill('review');
  await expect(p.locator('.doc-select')).toHaveCount(1);
  await actions(p);
  await btn(p, 'Make a copy').click();
  await expect(p.locator('.preview-file')).toContainText('Review notes (copy).pdf');
  await actions(p);
  await btn(p, 'Remove from library').click();
  await btn(p, 'Cancel').click();
  await expect(p.locator('.doc-select')).toHaveCount(8);
  await actions(p);
  await btn(p, 'Remove from library').click();
  await btn(p, 'Confirm remove').click();
  await expect(p.locator('.doc-select')).toHaveCount(7);
  await p.reload();
  await expect(docName(p, 'Review notes.pdf')).toHaveCount(1);
  await expect(docName(p, '(copy)')).toHaveCount(0);
});
test('batch selection, unit conversion and universal target validation; exports real PDF ZIP', async ({
  page: p,
}) => {
  await input(p).setInputFiles([fixture('text'), 'public/sample.pdf']);
  await expect(btn(p, 'Compress 2 PDFs')).toBeEnabled();
  const t = p.locator('#target-size');
  await t.fill('1');
  await btn(p, 'MB').click();
  expect(+(await t.inputValue())).toBe(1 / 1024);
  await t.fill('1001');
  await expect(btn(p, 'Compress 2 PDFs')).toBeDisabled();
  await t.fill('1000');
  await expect(btn(p, 'Compress 2 PDFs')).toBeEnabled();
  await btn(p, 'KB').click();
  expect(+(await t.inputValue())).toBe(1024000);
  await t.fill('200');
  await btn(p, 'Advanced settings').click();
  await p.getByRole('switch', { name: 'Exact Target Mode' }).click();
  await p.getByLabel('Compression profile').selectOption('Custom');
  await p.getByRole('combobox', { name: 'Resolution', exact: true }).selectOption('120');
  await btn(p, 'Compress 2 PDFs').click();
  await expect(btn(p, 'Export 2 results as ZIP')).toBeVisible();
  const dl = p.waitForEvent('download');
  await btn(p, 'Export 2 results as ZIP').click();
  const z = unzipSync(await readFile(await (await dl).path()));
  expect(Object.keys(z)).toHaveLength(2);
  for (const b of Object.values(z))
    expect((await PDFDocument.load(b)).getPageCount()).toBeGreaterThan(0);
  await p.setViewportSize({ width: 360, height: 800 });
  await phoneNav(p, 'History').click();
  await btn(p, 'Clear history').click();
  await p.getByRole('dialog').getByRole('button', { name: 'Clear history' }).click();
  await expect(p.getByRole('heading', { name: 'No activity yet' })).toBeVisible();
});
test('page editor saves a separate rotated/reordered/extracted copy across size classes', async ({
  page: p,
}) => {
  await btn(p, 'Thumbnails').click();
  await expect(p.locator('.thumbnail-strip .mini-page')).toHaveCount(5);
  await btn(p, 'Organize pages').click();
  await p.getByLabel('Select page 3', { exact: true }).check();
  await btn(p, 'Move page 3 earlier').click();
  await btn(p, 'Rotate').click();
  await p.setViewportSize({ width: 768, height: 1024 });
  await expect(p.getByLabel('Select page 3', { exact: true })).toBeChecked();
  await btn(p, 'Extract selected').click();
  await expect(p.locator('.preview-file')).toContainText(/extract/i);
  expect(await overflow(p)).toBe(true);
  await actions(p);
  const dl = p.waitForEvent('download');
  await btn(p, 'Export original').click();
  const pdf = await PDFDocument.load(await readFile(await (await dl).path()));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getRotation().angle).toBe(90);
  await close(p);
  await expect(docName(p, 'Alpine Field Report.pdf')).toContainText('5 pages');
});
test('backup round trip adds new personal copies, restores settings and rejects damaged archive', async ({
  page: p,
}) => {
  await input(p).setInputFiles(fixture('text'));
  await expect(p.locator('.preview-file')).toContainText('text.pdf');
  await p.getByLabel('Compression profile').selectOption('Clarity First');
  await run(p);
  await expect(p.locator('.delivery-card')).toBeVisible();
  await settings(p);
  const dl = p.waitForEvent('download');
  await btn(p, 'Export backup').click();
  const path = await (await dl).path();
  await nav(p, 'Workspace').click();
  await p.getByLabel('Compression profile').selectOption('Extreme');
  await settings(p);
  await btn(p, 'Restore backup').click();
  await p.getByLabel('Choose backup ZIP', { exact: true }).setInputFiles({
    name: 'corrupt.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('not a zip'),
  });
  await expect(p.getByRole('dialog').getByRole('alert')).toBeVisible();
  await p.getByLabel('Choose backup ZIP', { exact: true }).setInputFiles(path);
  await expect(p.getByRole('dialog')).toHaveCount(0);
  await nav(p, 'Workspace').click();
  await expect(docName(p, 'text.pdf')).toHaveCount(2);
  await expect(p.getByLabel('Compression profile')).toHaveValue('Clarity First');
  await nav(p, 'History').click();
  await expect(p.locator('tbody tr')).toHaveCount(1);
});
test('genuine running worker survives navigation and desktop/tablet/phone resizing', async ({
  page: p,
}) => {
  await input(p).setInputFiles(fixture('large'));
  await expect(p.locator('.preview-file')).toContainText('large.pdf');
  await p.getByLabel('Compression profile').selectOption('High');
  await p.locator('#target-size').fill('1');
  await run(p);
  await expect(p.locator('.active-job')).toBeVisible();
  await p.setViewportSize({ width: 768, height: 1024 });
  await p.setViewportSize({ width: 390, height: 844 });
  await phoneNav(p, 'Compress').click();
  await expect(p.locator('.mobile-picker')).toContainText('large.pdf');
  await phoneNav(p, 'Settings').click();
  await phoneNav(p, 'Compress').click();
  await expect(p.locator('.delivery-title')).toBeVisible({ timeout: 45000 });
  await p.setViewportSize({ width: 1380, height: 890 });
  await expect(p.locator('.preview-file')).toContainText('large.pdf');
  await expect(p.locator('#target-size')).toHaveValue('1');
  await expect(p.getByLabel('Compression profile')).toHaveValue('High');
  await expect(p.locator('.delivery-card')).toContainText('Target not reached');
});
test('signed file failure is recorded, never counted as space saved, and can be inspected', async ({
  page: p,
}) => {
  await input(p).setInputFiles(fixture('signed'));
  await expect(p.locator('.preview-file')).toContainText('signed.pdf');
  await run(p);
  await expect(p.locator('.v-error')).toContainText('signature');
  await nav(p, 'Analytics').click();
  await expect(p.locator('.insight-summary')).toContainText(['PDFs compressed0', 'Failed jobs1']);
  await nav(p, 'History').click();
  await p.getByRole('button', { name: 'Details for signed.pdf' }).click();
  await expect(p.getByRole('dialog')).toContainText('failed');
});
test('private storage upgrade preserves PRO history and previous privacy preference', async ({
  page: p,
}) => {
  await p.goto('about:blank');
  await p.context().clearCookies();
  await p.addInitScript(() => {
    if (sessionStorage.getItem('migrated-fixture')) return;
    sessionStorage.setItem('migrated-fixture', 'yes');
    localStorage.setItem('studio-remember', 'no');
    localStorage.removeItem('studio-ultra-prefs');
  });
  await p.route(site, async (r) => {
    await r.fulfill({ contentType: 'text/html', body: '<body>Database migration fixture</body>' });
  });
  await p.goto(site);
  await p.evaluate(async () => {
    await new Promise((res, rej) => {
      const q = indexedDB.deleteDatabase('pdf-reducer-workspace');
      q.onsuccess = res;
      q.onerror = rej;
    });
    await new Promise((res) => {
      const q = indexedDB.open('pdf-reducer-workspace', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('activity', { keyPath: 'id' });
      q.onsuccess = () => {
        const t = q.result.transaction('activity', 'readwrite');
        t.objectStore('activity').put({
          id: 'pro-1',
          name: 'legacy.pdf',
          operation: 'Compress PDF',
          input: 1000,
          output: 200,
          pages: 1,
          at: 1000,
        });
        t.oncomplete = () => {
          q.result.close();
          res();
        };
      };
    });
  });
  await p.unroute(site);
  await p.goto('about:blank');
  await p.goto(site + '#/history');
  await expect(p.locator('tbody')).toContainText('legacy.pdf');
  await settings(p);
  await expect(p.getByRole('switch', { name: 'Remember file activity' })).not.toBeChecked();
});
test.describe('offline installation', () => {
  test.use({ serviceWorkers: 'allow' });
  test('installed subpath workspace runs the real engine and starter library offline', async ({
    page: p,
    context,
  }) => {
    await p.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await p.reload();
    await p.waitForFunction(() => !!navigator.serviceWorker.controller);
    const installation = await p.evaluate(async () => {
      const scope = (await navigator.serviceWorker.ready).scope;
      const manifestUrl = document.querySelector('link[rel="manifest"]').href;
      const manifest = await (await fetch(manifestUrl)).json();
      const key = (await caches.keys()).find((k) =>
        k.startsWith('pdf-studio:' + new URL(scope).pathname + ':'),
      );
      const cached = await (await caches.open(key)).keys();
      return {
        scope,
        start: new URL(manifest.start_url, manifestUrl).href,
        scoped: cached.length > 0 && cached.every((r) => r.url.startsWith(scope)),
        seed: cached.some((r) => r.url.endsWith('library/alpine.pdf')),
      };
    });
    expect(installation).toEqual({ scope: site, start: site, scoped: true, seed: true });
    await context.setOffline(true);
    await p.reload();
    await expect(p.locator('.main-page')).toBeVisible();
    await run(p);
    await expect(p.locator('.delivery-title')).toContainText('Compression complete');
  });
});
for (const [w, h, layout] of [
  [320, 640, 'mobile'],
  [412, 915, 'mobile'],
  [540, 720, 'mobile'],
  [720, 960, 'tablet'],
  [768, 1024, 'tablet'],
  [915, 412, 'tablet'],
  [1024, 1366, 'tablet'],
  [1280, 800, 'desktop'],
  [1600, 1000, 'desktop'],
])
  test(`responsive ${layout} ${w}×${h}: preview, picker, navigation and state`, async ({
    page: p,
  }) => {
    await btn(p, 'Next source page').click();
    await p.getByLabel('Compression profile').selectOption('Balanced');
    await p.setViewportSize({ width: w, height: h });
    await expect(p.locator('.ultra')).toHaveAttribute('data-layout', layout);
    expect(await overflow(p)).toBe(true);
    if (layout === 'mobile') {
      await phoneNav(p, 'Compress').click();
      await p.locator('.phone-collapse summary').first().click();
    }
    await expect(p.getByLabel('Compression profile')).toHaveValue('Balanced');
    await expect(p.locator('.page-controls b')).toHaveText('2');
    await btn(p, 'Full-screen preview').click();
    await expect(p.locator('.preview-toolbar')).toContainText('Page 2 of 5');
    await expect
      .poll(() =>
        p
          .getByRole('dialog')
          .evaluate((e) => e.clientWidth >= innerWidth - 2 && e.clientHeight >= innerHeight - 2),
      )
      .toBe(true);
    await expect(p.locator('.render-loading')).toHaveCount(0);
    expect(await overflow(p)).toBe(true);
    await close(p);
    const picker = p.waitForEvent('filechooser');
    await btn(p, 'Import PDFs').click();
    await (await picker).setFiles(fixture('text'));
    await expect(p.locator(layout === 'mobile' ? '.mobile-picker' : '.preview-file')).toContainText(
      'text.pdf',
    );
    if (layout === 'mobile') await phoneNav(p, 'PDF Tools').click();
    else await nav(p, 'PDF tools').click();
    await expect(p.locator('.tool-card')).toHaveCount(12);
    expect(await overflow(p)).toBe(true);
  });
test('keyboard search, resizable panel, drag import and larger fonts at 2× density', async ({
  browser,
}) => {
  const c = await browser.newContext({
    viewport: { width: 1050, height: 850 },
    deviceScaleFactor: 2,
  });
  const p = await c.newPage();
  await p.goto(site);
  await expect(p.locator('.main-page')).toBeVisible();
  await p.keyboard.press('/');
  await expect(p.getByLabel('Search library')).toBeFocused();
  await p.getByLabel('Search library').fill('Invoice');
  await expect(p.locator('.doc-select')).toHaveCount(1);
  await btn(p, 'Clear search').click();
  const width = await p.locator('.lib-column').evaluate((e) => e.offsetWidth);
  await p.getByRole('separator').focus();
  await p.keyboard.press('ArrowRight');
  expect(await p.locator('.lib-column').evaluate((e) => e.offsetWidth)).not.toBe(width);
  await p.evaluate(() => (document.documentElement.style.fontSize = '130%'));
  expect(await overflow(p)).toBe(true);
  await p.evaluate(async () => {
    const data = await (await fetch('./sample.pdf')).blob();
    const dt = new DataTransfer();
    dt.items.add(new File([data], 'Dropped report.pdf', { type: 'application/pdf' }));
    document
      .querySelector('.paper-stage')
      .dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(p.locator('.preview-file')).toContainText('Dropped report.pdf');
  await p.setViewportSize({ width: 375, height: 700 });
  await phoneNav(p, 'Compress').click();
  expect(await overflow(p)).toBe(true);
  await c.close();
});
