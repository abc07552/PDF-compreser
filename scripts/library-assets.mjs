import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { PDFDocument, PDFName, StandardFonts, rgb } from 'pdf-lib';
import { createCanvas, loadImage, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
// Every starter card opens a real, original PDF. Thumbnails are rendered from those bytes.
for (const [k, v] of Object.entries({ DOMMatrix, ImageData, Path2D }))
  if (!globalThis[k]) globalThis[k] = v;
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const path = 'public/library';
await mkdir(path, { recursive: true });
const docs = [
  ['alpine', 'Alpine Field Report', 'Reports', 5, 'A field study of high-altitude landscapes.'],
  [
    'quarterly',
    'Quarterly Review',
    'Quarterly reports',
    4,
    'Performance, perspectives and the quarter ahead.',
  ],
  [
    'agreement',
    'Service Agreement',
    'Contracts',
    3,
    'Professional services and terms of engagement.',
  ],
  ['invoices', 'Invoice Summary', 'Invoices', 2, 'An itemized statement of studio operations.'],
  ['survey', 'Site Survey Notes', 'Scanned documents', 3, 'A record of observations in the field.'],
  [
    'permit',
    'Permit Application',
    'Government forms',
    2,
    'An example application for a site visit.',
  ],
];
const ink = rgb(0.055, 0.097, 0.135),
  muted = rgb(0.32, 0.37, 0.39),
  cyan = rgb(0.02, 0.54, 0.55),
  white = rgb(1, 1, 1);
const manifest = [];
for (const [id, title, category, count, desc] of docs) {
  const d = await PDFDocument.create();
  d.setTitle(title);
  d.setAuthor('Northline Research · Example collection');
  d.setCreationDate(new Date('2026-01-01T00:00:00Z'));
  d.setModificationDate(new Date('2026-01-01T00:00:00Z'));
  const font = await d.embedFont(StandardFonts.Helvetica),
    bold = await d.embedFont(StandardFonts.HelveticaBold),
    mono = await d.embedFont(StandardFonts.Courier);
  const W = 440,
    H = 568;
  for (let i = 0; i < count; i++) {
    const p = d.addPage([W, H]);
    const text = (t, x, top, size = 10, f = font, c = ink) =>
      p.drawText(t, { x, y: H - top - size, size, font: f, color: c });
    const line = (x1, y1, x2, y2, c = ink, th = 0.7) =>
      p.drawLine({
        start: { x: x1, y: H - y1 },
        end: { x: x2, y: H - y2 },
        color: c,
        thickness: th,
      });
    const rect = (x, y, w, h, c) =>
      p.drawRectangle({ x, y: H - y - h, width: w, height: h, color: c });
    if (id === 'survey') {
      const c = createCanvas(640, 826),
        g = c.getContext('2d');
      g.fillStyle = '#eeeae3';
      g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#49555a';
      g.font = 'bold 16px sans-serif';
      g.fillText('NORTHLINE  /  FIELD ARCHIVE', 40, 50);
      g.font = 'bold 39px serif';
      g.fillText('Site survey notes', 40, 140);
      g.font = '18px sans-serif';
      g.fillText(`Observation sheet 0${i + 1}`, 40, 180);
      g.strokeStyle = '#b8bcb6';
      for (let n = 0; n < 15; n++) {
        g.beginPath();
        g.moveTo(40, 245 + n * 30);
        g.lineTo(595, 245 + n * 30);
        g.stroke();
      }
      g.font = '17px serif';
      [
        'Survey region: North Ridge',
        'Elevation transect, station ' + (i + 1),
        'Clear conditions and good visibility.',
        'Mark the soil and slope observations.',
      ].forEach((t, j) => g.fillText(t, 48, 266 + j * 60));
      const im = await d.embedJpg(c.toBuffer('image/jpeg', 86));
      p.drawImage(im, { x: 0, y: 0, width: W, height: H });
      continue;
    }
    const dark = id === 'quarterly' && i === 0;
    if (dark) rect(0, 0, W, H, rgb(0.075, 0.13, 0.19));
    const fg = dark ? white : ink;
    const l = dark ? rgb(0.45, 0.57, 0.65) : rgb(0.65, 0.7, 0.69);
    // Original editorial grid, selectable headings, rules and page furniture.
    line(27, 34, 33, 23, dark ? white : ink, 2);
    line(33, 23, 40, 34, dark ? white : ink, 2);
    line(36, 27, 40, 21, dark ? white : ink, 1.4);
    line(40, 21, 48, 34, dark ? white : ink, 1.4);
    text('NORTHLINE', 54, 23, 10, bold, fg);
    text('RESEARCH DIVISION', 307, 25, 8, mono, dark ? white : muted);
    line(26, 47, 414, 47, l);
    if (!i && id === 'alpine') {
      text('ENVIRONMENTAL STUDIES     /     VOL. 01', 27, 66, 8, mono, cyan);
      text('Alpine Field', 25, 88, 50, bold);
      text('Report', 25, 139, 50, bold);
      text('High-altitude landscapes & ecosystem research', 28, 213, 12, font, muted);
      const photo = await loadImage(await readFile('public/art/alpine-survey.jpg'));
      const c = createCanvas(1120, 704),
        g = c.getContext('2d');
      g.drawImage(photo, 0, 0, c.width, c.height);
      const rgba = g.getImageData(0, 0, c.width, c.height).data,
        buffer = new Uint8Array(c.width * c.height * 3);
      for (let k = 0; k < c.width * c.height; k++) {
        buffer[k * 3] = rgba[k * 4];
        buffer[k * 3 + 1] = rgba[k * 4 + 1];
        buffer[k * 3 + 2] = rgba[k * 4 + 2];
      }
      const r = d.context.register(
        d.context.stream(buffer, {
          Type: 'XObject',
          Subtype: 'Image',
          Width: c.width,
          Height: c.height,
          ColorSpace: 'DeviceRGB',
          BitsPerComponent: 8,
        }),
      );
      const image = p.node.newXObject('Landscape', r);
      p.node.addContentStream(
        d.context.register(d.context.stream(`q 440 0 0 246 0 73 cm ${image} Do Q\n`)),
      );
      text('FIELD RESEARCH SERIES', 27, 509, 8, mono, cyan);
      text('Northern Alps, Switzerland', 27, 525, 13, bold);
      text('EDITION  /  2026', 335, 525, 8, mono, muted);
    } else if (!i && id === 'quarterly') {
      text('BUSINESS REVIEW     /     Q3', 28, 76, 9, mono, rgb(0.49, 0.87, 0.72));
      text('Quarterly', 25, 109, 49, bold, fg);
      text('Review', 25, 162, 49, bold, fg);
      text('A review of the quarter in numbers.', 28, 246, 12, font, fg);
      for (let n = 0; n < 8; n++)
        rect(28 + n * 48, 421 - 14 * n, 32, 67 + 14 * n, rgb(0.38, 0.65 + n * 0.024, 0.62));
      text('NORTHLINE   /   FINANCE', 28, 517, 9, mono, fg);
    } else {
      const topic =
        i === 0
          ? title
          : ['', 'Executive summary', 'Field observations', 'Methods & sources', 'Conclusions'][
              i % 5
            ];
      text(`${category.toUpperCase()}   /   SECTION 0${i + 1}`, 27, 76, 9, mono, cyan);
      const words = topic.split(' ');
      text(words.slice(0, -1).join(' ') || topic, 25, 109, 38, bold);
      if (words.length > 1) text(words.at(-1), 25, 150, 38, bold);
      text(desc, 28, 215, 10, font, muted);
      line(28, 246, 412, 246, l);
      for (let k = 0; k < 4; k++) {
        const y = 264 + k * 55;
        text(`0${k + 1}`, 28, y, 10, mono, cyan);
        text(
          ['Scope and purpose', 'Recorded observations', 'Review and documentation', 'Next steps'][
            k
          ],
          65,
          y,
          13,
          bold,
        );
        text(
          [
            'This sample outlines the purpose and limits of the review.',
            'The field team records findings for each survey station.',
            'Each observation is checked against the source record.',
            'Retain this report with the associated project materials.',
          ][k],
          65,
          y + 19,
          8.4,
          font,
          muted,
        );
        line(65, y + 40, 413, y + 40, rgb(0.84, 0.87, 0.87), 0.5);
      }
    }
    line(27, 548, 413, 548, l, 0.5);
    text('NORTHLINE    /    DOCUMENT COLLECTION', 27, 553, 6.8, mono, dark ? white : muted);
    text(
      `${String(i + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`,
      377,
      553,
      7,
      mono,
      dark ? white : muted,
    );
  }
  if (id === 'permit') {
    const f = d.getForm().createTextField('Applicant');
    f.setText('Example applicant');
    f.addToPage(d.getPage(0), { x: 60, y: 38, width: 215, height: 18, borderWidth: 0.5 });
  }
  const bytes = await d.save();
  await writeFile(`${path}/${id}.pdf`, bytes);
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/',
    isEvalSupported: false,
  }).promise;
  const p = await pdf.getPage(1),
    vp = p.getViewport({ scale: 0.48 }),
    cv = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  await p.render({ canvas: cv, canvasContext: cv.getContext('2d'), viewport: vp }).promise;
  await writeFile(`${path}/${id}.webp`, cv.toBuffer('image/webp', 86));
  await pdf.destroy();
  manifest.push({
    id: 'seed-' + id,
    name: title + '.pdf',
    size: bytes.length,
    pages: count,
    category,
    sample: id,
    layer: id === 'survey' ? 'Image only' : 'Text layer',
    created: Date.UTC(2026, 0, 1) - manifest.length * 86400000,
    favorite: id === 'alpine' || id === 'quarterly',
  });
}
await writeFile(`${path}/catalog.json`, JSON.stringify(manifest));
console.log('Six real sample PDFs and their rendered covers are ready.');
