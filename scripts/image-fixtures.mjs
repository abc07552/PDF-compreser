import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { zlibSync } from 'fflate';
// Deterministic textured pixels exercise real JPEG decoding and PNG Sub predictors.
export async function imageFixtures(save) {
  const w = 1440,
    h = 960,
    c = createCanvas(w, h),
    ctx = c.getContext('2d'),
    im = ctx.createImageData(w, h);
  let seed = 739;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = (seed >>> 26) - 32,
        k = (y * w + x) * 4;
      im.data[k] = 80 + 65 * Math.sin(x / 95) + noise;
      im.data[k + 1] = 120 + 65 * Math.cos(y / 122) + noise;
      im.data[k + 2] = 150 + 70 * Math.sin((x + y) / 86) + noise;
      im.data[k + 3] = 255;
    }
  ctx.putImageData(im, 0, 0);
  const jpeg = await PDFDocument.create(),
    j = await jpeg.embedJpg(c.toBuffer('image/jpeg', 97));
  jpeg.addPage([480, 320]).drawImage(j, { x: 0, y: 0, width: 480, height: 320 });
  await save('jpeg-scan', jpeg);
  const d = await PDFDocument.create(),
    p = d.addPage([480, 320]),
    row = w * 3,
    filtered = new Uint8Array((row + 1) * h);
  for (let y = 0; y < h; y++) {
    const start = (row + 1) * y;
    filtered[start] = 1;
    for (let x = 0; x < w; x++)
      for (let ch = 0; ch < 3; ch++) {
        const i = (y * w + x) * 4 + ch;
        filtered[start + 1 + x * 3 + ch] = im.data[i] - (x ? im.data[i - 4] : 0);
      }
  }
  const s = d.context.register(
    d.context.stream(zlibSync(filtered), {
      Type: 'XObject',
      Subtype: 'Image',
      Width: w,
      Height: h,
      ColorSpace: 'DeviceRGB',
      BitsPerComponent: 8,
      Filter: 'FlateDecode',
      DecodeParms: { Predictor: 15, Colors: 3, Columns: w, BitsPerComponent: 8 },
    }),
  );
  const key = p.node.newXObject('Predictor', s);
  p.node.addContentStream(d.context.register(d.context.stream(`q 480 0 0 320 0 0 cm ${key} Do Q`)));
  await save('png-predictor', d);
  const mask = createCanvas(220, 180),
    mx = mask.getContext('2d');
  mx.fillStyle = 'rgba(28,110,223,0.45)';
  mx.fillRect(20, 15, 145, 100);
  mx.fillStyle = 'rgba(140,77,180,0.7)';
  mx.fillRect(60, 65, 110, 100);
  const m = await PDFDocument.create(),
    a = await m.embedPng(mask.toBuffer('image/png'));
  m.addPage([220, 180]).drawImage(a, { x: 0, y: 0, width: 220, height: 180 });
  await save('alpha-mask', m);
}
