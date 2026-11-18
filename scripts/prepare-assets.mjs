import { mkdir, readFile, writeFile, copyFile, cp } from 'node:fs/promises';
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from 'pdf-lib';
const out = 'public/vendor';
await mkdir(out, { recursive: true });
// Expose the factory as ESM and route CLI diagnostics into the worker, not the developer console.
await writeFile(
  `${out}/qpdf.mjs`,
  (await readFile('node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.js', 'utf8')).replace(
    'var oa=console.log.bind(console),r=console.error.bind(console)',
    'var oa=f.print||console.log.bind(console),r=f.printErr||console.error.bind(console)',
  ) + '\nexport default Module;\n',
);
await copyFile('node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm', `${out}/qpdf.wasm`);
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', `${out}/pdf.worker.min.mjs`);
for (const d of ['standard_fonts', 'cmaps', 'wasm', 'iccs'])
  await cp(`node_modules/pdfjs-dist/${d}`, `${out}/${d}`, { recursive: true });
await mkdir(`${out}/licenses`, { recursive: true });
for (const [p, n] of [
  ['pdfjs-dist/LICENSE', 'pdfjs'],
  ['pdf-lib/LICENSE.md', 'pdf-lib'],
  ['@neslinesli93/qpdf-wasm/LICENSE', 'qpdf-wasm'],
  ['fflate/LICENSE', 'fflate'],
  ['@fontsource-variable/manrope/LICENSE', 'manrope'],
  ['@fontsource-variable/inter/LICENSE', 'inter'],
  ['lucide-react/LICENSE', 'lucide'],
  ['react/LICENSE', 'react'],
  ['react-dom/LICENSE', 'react-dom'],
  ['scheduler/LICENSE', 'scheduler'],
  ['@pdf-lib/standard-fonts/LICENSE.md', 'standard-fonts'],
  ['@pdf-lib/upng/LICENSE', 'upng'],
  ['pako/LICENSE', 'pako'],
  ['tslib/LICENSE.txt', 'tslib'],
  ['tslib/CopyrightNotice.txt', 'tslib-copyright'],
])
  await copyFile(`node_modules/${p}`, `${out}/licenses/${n}.txt`);
// A real two-page example: vector text, an uncompressed RGB image, and a link annotation.
const doc = await PDFDocument.create();
doc.setCreationDate(new Date('2025-01-01T00:00:00Z'));
doc.setModificationDate(new Date('2025-01-01T00:00:00Z'));
doc.setTitle('A field guide to lighter documents');
doc.setAuthor('PDF Reducer Studio');
const font = await doc.embedFont(StandardFonts.Helvetica),
  bold = await doc.embedFont(StandardFonts.HelveticaBold);
const width = 1024,
  height = 640,
  data = new Uint8Array(width * height * 3);
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 3;
    const band = Math.floor(
      (y / height + 0.18 * Math.sin((x / width) * 7) + 0.08 * Math.cos((x / width) * 11)) * 8,
    );
    const c = [
      [22, 42, 91],
      [35, 66, 142],
      [41, 82, 178],
      [61, 110, 215],
      [93, 149, 235],
      [139, 190, 245],
      [183, 215, 252],
      [219, 232, 253],
    ][Math.max(0, Math.min(7, band))];
    data.set(c, i);
  }
const img = doc.context.register(
  doc.context.stream(data, {
    Type: 'XObject',
    Subtype: 'Image',
    Width: width,
    Height: height,
    ColorSpace: 'DeviceRGB',
    BitsPerComponent: 8,
  }),
);
const page = doc.addPage([595, 842]);
page.drawText('PAPER NOTES     /     ISSUE 01', {
  x: 42,
  y: 782,
  size: 11,
  font: bold,
  color: rgb(0.17, 0.36, 0.8),
});
page.drawText('A field guide to', { x: 42, y: 704, size: 42, font: bold });
page.drawText('lighter documents.', { x: 42, y: 655, size: 42, font: bold });
const res = page.node.newXObject('Cover', img);
const raw = doc.context.register(doc.context.stream(`q 511 0 0 320 42 278 cm ${res} Do Q\n`));
page.node.addContentStream(raw);
page.drawText('Less weight. More clarity.', { x: 42, y: 220, size: 22, font: bold });
page.drawText(
  'This sample combines a full-color illustration with selectable text.\nCompress it, then compare both copies to see what changed.',
  { x: 42, y: 183, size: 12, font, lineHeight: 20 },
);
const page2 = doc.addPage([595, 842]);
page2.drawText('PAPER NOTES     /     FIELD GUIDE', {
  x: 42,
  y: 782,
  size: 11,
  font: bold,
  color: rgb(0.17, 0.36, 0.8),
});
page2.drawText('Inside your PDF', { x: 42, y: 704, size: 34, font: bold });
page2.drawText(
  '01   Text stays text\n\nThe engine optimizes embedded images instead of flattening pages.\nSearchable text, page geometry and links can stay intact.\n\n02   Match the document\n\nScanned pages and mixed documents need different settings.\nRecommended mode inspects the file before choosing a profile.\n\n03   Targets are estimates\n\nSome PDFs are already optimized. A safe result is always preferred\nto a smaller but unreadable copy.',
  { x: 42, y: 640, size: 12, font, lineHeight: 19 },
);
page2.drawText('Visit the PDF Association', {
  x: 42,
  y: 145,
  size: 12,
  font,
  color: rgb(0.15, 0.35, 0.85),
});
page2.node.set(
  PDFName.of('Annots'),
  doc.context.obj([
    doc.context.register(
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [42, 140, 215, 159],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of('https://pdfa.org') },
      }),
    ),
  ]),
);
await writeFile('public/sample.pdf', await doc.save({ useObjectStreams: false }));
console.log('Local engine, fonts, renderers and sample are ready.');
