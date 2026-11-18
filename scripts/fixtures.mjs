import { imageFixtures } from './image-fixtures.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { PDFDocument, PDFName, PDFString, StandardFonts, degrees, rgb } from 'pdf-lib';
import { createRequire } from 'node:module';
import { createCanvas } from '@napi-rs/canvas';
export const directory = '.artifacts/fixtures';
export async function fixtures() {
  await mkdir(directory, { recursive: true });
  const save = async (n, d) =>
    writeFile(`${directory}/${n}.pdf`, await d.save({ useObjectStreams: false }));
  await imageFixtures(save);
  const text = await PDFDocument.create();
  text.setTitle('Private test title');
  text.setAuthor('Local author');
  const font = await text.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) {
    const p = text.addPage([400 + i * 12, 600 + i * 3]);
    p.setRotation(degrees(i === 1 ? 90 : 0));
    p.drawText(`Selectable text on page ${i + 1}`, {
      font,
      size: 16,
      x: 20,
      y: 500,
      color: rgb(0.8, 0.15, 0.3),
    });
  }
  text.getPage(0).node.set(
    PDFName.of('Annots'),
    text.context.obj([
      text.context.register(
        text.context.obj({
          Subtype: 'Link',
          Type: 'Annot',
          Rect: [20, 490, 200, 520],
          A: { S: 'URI', URI: PDFString.of('https://pdfa.org') },
        }),
      ),
    ]),
  );
  await save('text', text);
  for (const [name, count, w, h, images] of [
    ['scan', 1, 800, 1050, 1],
    ['image-heavy', 1, 256, 220, 4],
    ['large', 10, 1024, 1024, 1],
  ]) {
    const d = await PDFDocument.create();
    for (let n = 0; n < count; n++) {
      const p = d.addPage([480, 640]);
      for (let k = 0; k < images; k++) {
        const pixels = new Uint8Array(w * h * 3);
        for (let i = 0; i < pixels.length; i += 3) {
          const x = (i / 3) % w,
            y = Math.floor(i / 3 / w);
          pixels[i] = x / 8 + 25 + n * 8;
          pixels[i + 1] = y / 9 + 45 + k * 15;
          pixels[i + 2] = 100 + (Math.floor(x / 80 + y / 75) % 3) * 24;
        }
        const ref = d.context.register(
          d.context.stream(pixels, {
            Type: 'XObject',
            Subtype: 'Image',
            Width: w,
            Height: h,
            ColorSpace: 'DeviceRGB',
            BitsPerComponent: 8,
          }),
        );
        const image = p.node.newXObject('Scan', ref);
        p.node.addContentStream(
          d.context.register(
            d.context.stream(
              `q 480 0 0 ${640 / images} 0 ${(k * 640) / images} cm ${image} Do Q\n`,
            ),
          ),
        );
      }
    }
    await save(name, d);
  }
  let minimal = '%PDF-1.4\n';
  const offsets = [0];
  for (const [idx, obj] of [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Count 1/Kids[3 0 R]>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 100 100]/Resources<<>>>>',
  ].entries()) {
    offsets.push(minimal.length);
    minimal += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  }
  const xref = minimal.length;
  minimal +=
    'xref\n0 4\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((x) => String(x).padStart(10, '0') + ' 00000 n \n')
      .join('') +
    `trailer\n<</Size 4/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  await writeFile(`${directory}/minimal.pdf`, minimal);
  const unsignedBytes = await readFile(`${directory}/text.pdf`);
  const m = await createRequire(import.meta.url)('@neslinesli93/qpdf-wasm')({
    wasmBinary: await readFile('node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm'),
  });
  m.FS.writeFile('/in.pdf', unsignedBytes);
  if (
    m.callMain([
      '--encrypt',
      'test-reader',
      'test-owner',
      '256',
      '--',
      '--object-streams=generate',
      '/in.pdf',
      '/locked.pdf',
    ]) !== 0
  )
    throw Error('Could not create encryption fixture');
  await writeFile(`${directory}/locked.pdf`, m.FS.readFile('/locked.pdf'));
  const signed = await PDFDocument.load(unsignedBytes, { updateMetadata: false });
  signed.catalog.set(
    PDFName.of('Perms'),
    signed.context.obj({
      DocMDP: signed.context.register(
        signed.context.obj({ Type: 'Sig', ByteRange: [0, 100, 200, 300] }),
      ),
    }),
  );
  await save('signed', signed);
  await writeFile(`${directory}/corrupt.pdf`, '%PDF-1.7\nA truncated and invalid document');
  await writeFile(`${directory}/not-a-pdf.pdf`, 'Not a PDF document');
  const c = createCanvas(90, 140);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2348a5';
  ctx.fillRect(0, 0, 90, 140);
  ctx.fillStyle = 'white';
  ctx.fillRect(10, 10, 70, 35);
  for (const ext of ['png', 'jpeg', 'webp'])
    await writeFile(`${directory}/photo.${ext}`, c.toBuffer(`image/${ext}`));
  console.log('Generated PDF fixtures (including 30 MB, encrypted and signed files).');
}
