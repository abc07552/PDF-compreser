import { test, expect } from '@playwright/test';
const path = (n) =>
  n === 'sample' ? 'public/sample.pdf' : `.artifacts/fixtures/${n}${n.includes('.') ? '' : '.pdf'}`;
const select = (p, ...n) => p.locator('#files').setInputFiles(n.map(path));
test.beforeEach(async ({ page }) => {
  await page.goto('/tests/harness.html');
  await page.waitForFunction(() => !!window.lab);
});
for (const [file, kind] of [
  ['text', 'Text document'],
  ['scan', 'Scanned document'],
  ['image-heavy', 'Image-heavy document'],
  ['sample', 'Mixed document'],
])
  test(`detects ${kind.toLowerCase()}`, async ({ page }) => {
    await select(page, file);
    expect((await page.evaluate(() => lab.analyze())).kind).toBe(kind);
  });
test('compresses a mixed PDF, preserves text, links, geometry and readability', async ({
  page,
}) => {
  await select(page, 'sample');
  const before = await page.evaluate(() => lab.inspect(true));
  const r = await page.evaluate(() => lab.compress({ target: 100 * 1024 }));
  expect(r.output).toBeLessThan(100 * 1024);
  expect(r.imagesOptimized > 0 || r.profile === 'Lossless structure').toBe(true);
  expect(r.targetMet).toBe(true);
  expect(await page.evaluate(() => lab.inspect())).toEqual(before);
  expect(await page.evaluate(() => lab.verifiedPixelDiff())).toBeLessThan(90);
  expect(r.progress.at(-1).n).toBe(100);
});
test('text-only output preserves selectable text, page rotations and links', async ({ page }) => {
  await select(page, 'text');
  const before = await page.evaluate(() => lab.inspect(true));
  const r = await page.evaluate(() => lab.compress({ preset: 'Extreme' }));
  expect(r.output).toBeLessThanOrEqual(r.original);
  expect(await page.evaluate(() => lab.inspect())).toEqual(before);
  expect(await page.evaluate(() => lab.verifiedPixelDiff())).toBe(0);
});
test('unreachable target retries safely and reports a miss', async ({ page }) => {
  await select(page, 'scan');
  const r = await page.evaluate(() => lab.compress({ target: 100 }));
  expect(r.attempts).toBe(3);
  expect(r.targetMet).toBe(false);
  expect(r.output).toBeLessThan(r.original);
});
test('custom quality, DPI and monochrome processing', async ({ page }) => {
  await select(page, 'image-heavy');
  const r = await page.evaluate(() =>
    lab.compress({ preset: 'Custom', dpi: 96, quality: 22, color: 'Black & white', retry: false }),
  );
  expect(r.imagesOptimized).toBeGreaterThan(0);
  expect(r.output).toBeLessThan(r.original);
});
test('processes a 30 MB image document with bounded page count', async ({ page }) => {
  await select(page, 'large');
  const r = await page.evaluate(() => lab.compress({ preset: 'High' }));
  expect(r.pages).toBe(10);
  expect(r.original).toBeGreaterThan(30 * 1024 * 1024);
  expect(r.output).toBeLessThan(r.original);
});
test('rejects oversized inputs and cancels an active worker', async ({ page }) => {
  await expect(page.evaluate(() => lab.oversized())).rejects.toThrow('64 MB');
  await select(page, 'large');
  await expect(page.evaluate(() => lab.cancel())).rejects.toThrow(/cancel/i);
});
for (const name of ['not-a-pdf', 'corrupt', 'locked', 'signed'])
  test(`does not modify ${name} input`, async ({ page }) => {
    await select(page, name);
    await expect(page.evaluate(() => lab.compress())).rejects.toThrow(
      name === 'locked'
        ? /password-protected/
        : name === 'signed'
          ? /signature/
          : /PDF|document|page/i,
    );
  });
test('merges in input order and extracts an explicit range', async ({ page }) => {
  await select(page, 'text', 'sample');
  const m = await page.evaluate(() => lab.tool('merge'));
  expect(m.pages).toBe(5);
  const r = await page.evaluate(() => lab.tool('extract', { range: '5,1' }, true));
  expect(r.pages).toBe(2);
  const p = await page.evaluate(() => lab.inspect());
  expect(p[0].text).toContain('Inside your PDF');
  expect(p[1].text).toContain('page 1');
});
test('splits ZIP parts and validates range input', async ({ page }) => {
  await select(page, 'text');
  await page.evaluate(() => lab.tool('split', { group: 2 }));
  expect((await page.evaluate(() => lab.zip())).map((p) => p.pages)).toEqual([2, 1]);
  await expect(page.evaluate(() => lab.tool('extract', { range: '1,99' }))).rejects.toThrow(
    /between 1 and 3/,
  );
});
test('organizes, excludes and rotates pages', async ({ page }) => {
  await select(page, 'text');
  await page.evaluate(() => lab.tool('organize', { range: '3,1', rotations: { 3: 90 } }));
  const p = await page.evaluate(() => lab.inspect());
  expect(p).toHaveLength(2);
  expect(p[0].rotation).toBe(90);
  expect(p[0].text).toContain('page 3');
});
test('protects with AES-256 and unlocks only with consent and a valid password', async ({
  page,
}) => {
  await select(page, 'text');
  await page.evaluate(() => lab.tool('protect', { password: 'safe-test-key' }));
  await expect(page.evaluate(() => lab.inspect())).rejects.toThrow(/password/i);
  await page.evaluate(() =>
    lab.tool('unlock', { password: 'safe-test-key', authorized: true }, true),
  );
  expect(await page.evaluate(() => lab.inspect())).toHaveLength(3);
  await select(page, 'locked');
  await expect(
    page.evaluate(() => lab.tool('unlock', { password: 'test-reader' })),
  ).rejects.toThrow(/authorization/i);
  await expect(
    page.evaluate(() => lab.tool('unlock', { password: 'wrong', authorized: true })),
  ).rejects.toThrow();
  await page.evaluate(() => lab.tool('unlock', { password: 'test-owner', authorized: true }));
  expect(await page.evaluate(() => lab.inspect())).toHaveLength(3);
});
test('applies a watermark to every page and scrubs document properties', async ({ page }) => {
  await select(page, 'text');
  await page.evaluate(() => lab.tool('watermark', { text: 'REVIEW', opacity: 0.35 }));
  expect((await page.evaluate(() => lab.inspect())).every((x) => x.text.includes('REVIEW'))).toBe(
    true,
  );
  await page.evaluate(() => lab.tool('metadata'));
  expect(await page.evaluate(() => lab.meta())).toEqual({ author: '', title: '', metadata: false });
});
test('converts PNG, JPEG and WebP to PDF and exports page images', async ({ page }) => {
  await select(page, 'photo.png', 'photo.jpeg', 'photo.webp');
  expect((await page.evaluate(() => lab.tool('from-images'))).pages).toBe(3);
  await page.evaluate(() => lab.tool('to-images', { range: '1,3', format: 'webp', dpi: 96 }, true));
  const images = await page.evaluate(() => lab.zip());
  expect(images).toHaveLength(2);
  expect(images[0].magic).toEqual([82, 73, 70, 70]);
  await expect(page.evaluate(() => lab.imageError())).rejects.toThrow(/image encoding/i);
});
test('an already-small PDF is never replaced by a larger output', async ({ page }) => {
  await select(page, 'minimal');
  const r = await page.evaluate(() => lab.compress());
  expect(r.output).toBe(r.original);
  expect(r.unchanged).toBe(true);
});
test('monochrome converts basic vector colors without flattening text', async ({ page }) => {
  await select(page, 'text');
  const before = await page.evaluate(() => lab.inspect(true));
  await page.evaluate(() => lab.compress({ preset: 'Custom', color: 'Grayscale' }));
  expect(await page.evaluate(() => lab.inspect())).toEqual(before);
  expect(await page.evaluate(() => lab.fixtureTextFills(true))).toEqual(
    Array(3).fill([0.8, 0.15, 0.3]),
  );
  expect(await page.evaluate(() => lab.fixtureTextFills(false))).toEqual(
    Array(3).fill([0.299, 0.299, 0.299]),
  );
});
test('resamples an actual DCT-encoded image to the requested DPI budget', async ({ page }) => {
  await select(page, 'jpeg-scan');
  const r = await page.evaluate(() => lab.compress({ preset: 'Extreme' }));
  expect(r.imagesOptimized).toBe(1);
  expect(r.output).toBeLessThan(r.original);
  expect(await page.evaluate(() => lab.imageInfo())).toEqual([
    { width: 480, height: 320, bits: 8, filter: '/DCTDecode' },
  ]);
});
test('decodes PNG Sub row predictors and writes a genuine one-bit document', async ({ page }) => {
  await select(page, 'png-predictor');
  await page.evaluate(() => lab.compress({ preset: 'Custom', color: 'Black & white', dpi: 96 }));
  expect((await page.evaluate(() => lab.imageInfo()))[0]).toMatchObject({
    bits: 1,
    filter: '/FlateDecode',
  });
  expect(await page.evaluate(() => lab.hasColor(false))).toBe(false);
});
test('preserves transparent images and their soft masks', async ({ page }) => {
  await select(page, 'alpha-mask');
  const r = await page.evaluate(() => lab.compress({ preset: 'Extreme' }));
  expect(r.imagesOptimized).toBe(0);
  expect(await page.evaluate(() => lab.verifiedPixelDiff())).toBe(0);
});
test('exact target uses bounded retries and never pads or sacrifices clarity to claim success', async ({
  page,
}) => {
  await select(page, 'jpeg-scan');
  const r = await page.evaluate(() =>
    lab.compress({ preset: 'Smart Auto', exact: true, clarity: false, target: 1024 }),
  );
  expect(r.attempts).toBeGreaterThanOrEqual(3);
  expect(r.attempts).toBeLessThanOrEqual(5);
  expect(r.targetMet).toBe(false);
  const protectedResult = await page.evaluate(() =>
    lab.compress({ preset: 'Clarity First', exact: true, target: 1024 }),
  );
  expect(protectedResult.clarityProtected).toBe(true);
  if (protectedResult.imagesOptimized) {
    expect(protectedResult.dpi).toBeGreaterThanOrEqual(150);
    expect(protectedResult.quality).toBeGreaterThanOrEqual(78);
  }
  expect(protectedResult.output).toBeLessThanOrEqual(protectedResult.original);
});
test('government profile preserves actual fillable form and field value', async ({ page }) => {
  await page.locator('#files').setInputFiles('public/library/permit.pdf');
  const r = await page.evaluate(() =>
    lab.compress({ preset: 'Government Form', color: 'Black & white', exact: true, target: 1024 }),
  );
  expect(r.formProtected).toBe(true);
  expect(r.imagesOptimized).toBe(0);
  expect(await page.evaluate(() => lab.field('Applicant'))).toBe('Example applicant');
});
test('HD and scan cleanup transform supported image pixels, not page text', async ({ page }) => {
  await page.locator('#files').setInputFiles('public/library/alpine.pdf');
  const before = await page.evaluate(() => lab.inspect(true));
  const output = [];
  for (const enhancement of ['Off', 'HD clarity', 'Scan cleanup']) {
    const r = await page.evaluate(
      (enhancement) =>
        lab.compress({ preset: 'Custom', target: 0, dpi: 150, quality: 80, enhancement }),
      enhancement,
    );
    expect(r.imagesOptimized).toBeGreaterThan(0);
    expect(r.enhanced).toBe(enhancement === 'Off' ? 0 : 1);
    output.push(await page.evaluate(() => lab.imageDigest()));
  }
  expect(new Set(output).size).toBe(3);
  expect(await page.evaluate(() => lab.inspect())).toEqual(before);
});
test('1000 MB is a target bound, not a request to inflate or admit huge files', async ({
  page,
}) => {
  await select(page, 'minimal');
  const r = await page.evaluate(() =>
    lab.compress({ preset: 'Smart Auto', target: 1000 * 1024 * 1024 }),
  );
  expect(r.unchanged).toBe(true);
  expect(r.targetMet).toBe(true);
  await expect(page.evaluate(() => lab.compress({ target: 1001 * 1024 * 1024 }))).rejects.toThrow(
    'valid compression profile',
  );
});
