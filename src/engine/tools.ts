import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { zipSync } from 'fflate';
import { loadPDF, requireEditable, stripMetadata } from './document';
import { imageDimensions } from './images';
import { qpdf, optimizeArgs, encryptedState, authenticatedPageCount } from './qpdf';
import {
  MAX_FILE,
  MAX_PAGES,
  exactBuffer,
  pageNumbers,
  stem,
  validateSelection,
  type ToolId,
  type ToolOptions,
  type Progress,
  type Output,
} from './types';
export async function transform(
  tool: ToolId,
  files: File[],
  o: ToolOptions,
  progress: Progress,
): Promise<Output> {
  validateSelection(files, tool === 'from-images');
  if (!['from-images', 'merge'].includes(tool) && files.length !== 1)
    throw Error('Choose exactly one document for this tool.');
  const base = stem(files[0].name);
  let bytes: Uint8Array,
    pages = 0;
  let name = `${base}-${tool}.pdf`;
  progress(3, 'Reading your files');
  if (tool === 'from-images') {
    const doc = await PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      progress(5 + (i / files.length) * 80, `Placing image ${i + 1} of ${files.length}`);
      const data = new Uint8Array(await files[i].arrayBuffer());
      const [w, h] = imageDimensions(data);
      if (!w || !h || w * h > 16_000_000)
        throw Error('Images must be at most 16 megapixels. Resize this image first.');
      const bitmap = await createImageBitmap(files[i]);
      const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const canvas = new OffscreenCanvas(
        Math.max(1, Math.round(bitmap.width * scale)),
        Math.max(1, Math.round(bitmap.height * scale)),
      );
      try {
        const c = canvas.getContext('2d')!;
        c.fillStyle = '#fff';
        c.fillRect(0, 0, canvas.width, canvas.height);
        c.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const img = await doc.embedJpg(
          await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer(),
        );
        const page = doc.addPage(img.width > img.height ? [842, 595] : [595, 842]);
        const fit = img.scaleToFit(page.getWidth() - 48, page.getHeight() - 48);
        page.drawImage(img, {
          x: (page.getWidth() - fit.width) / 2,
          y: (page.getHeight() - fit.height) / 2,
          ...fit,
        });
      } finally {
        bitmap.close();
        canvas.width = canvas.height = 1;
      }
    }
    bytes = await doc.save();
    pages = files.length;
    name = `${base}-images.pdf`;
  } else if (tool === 'unlock') {
    if (!o.authorized || !o.password)
      throw Error('Confirm authorization and enter the correct password.');
    const data = new Uint8Array(await files[0].arrayBuffer());
    if (!(await encryptedState(data)))
      throw Error('This PDF is not password-protected or is unreadable.');
    bytes = await qpdf([data], [`--password=${o.password}`, '--decrypt', '/in0.pdf', '/out.pdf']);
    const unlocked = await loadPDF(bytes);
    requireEditable(unlocked);
    pages = unlocked.getPageCount();
    name = `${base}-unlocked.pdf`;
  } else {
    const inputs: Uint8Array[] = [];
    for (let i = 0; i < files.length; i++) {
      const b = new Uint8Array(await files[i].arrayBuffer());
      const d = await loadPDF(b);
      requireEditable(d);
      pages += d.getPageCount();
      inputs.push(b);
      if (pages > MAX_PAGES) throw Error(`The result would exceed ${MAX_PAGES} pages.`);
    }
    const data = inputs[0];
    progress(24, 'Preparing document');
    switch (tool) {
      case 'merge': {
        if (files.length < 2) throw Error('Choose at least two PDFs to merge.');
        bytes = await qpdf(inputs, [
          '/in0.pdf',
          '--pages',
          ...inputs.flatMap((_, i) => [`/in${i}.pdf`, '1-z']),
          '--',
          '--object-streams=generate',
          '/out.pdf',
        ]);
        name = `${base}-merged.pdf`;
        break;
      }
      case 'split': {
        const group = o.group ?? 1;
        if (!Number.isInteger(group) || group < 1 || group > pages)
          throw Error(`Choose a group size between 1 and ${pages}.`);
        if (Math.ceil(pages / group) > 200)
          throw Error('Use larger groups: a ZIP can contain up to 200 parts.');
        const parts: Record<string, Uint8Array> = {};
        let total = 0;
        for (let start = 1; start <= pages; start += group) {
          const end = Math.min(pages, start + group - 1);
          progress(25 + (start / pages) * 65, `Splitting pages ${start}–${end}`);
          const part = await qpdf(
            [data],
            ['/in0.pdf', '--pages', '.', `${start}-${end}`, '--', '/out.pdf'],
          );
          if ((await loadPDF(part)).getPageCount() !== end - start + 1)
            throw Error('Split validation failed.');
          total += part.length;
          if (total > MAX_FILE)
            throw Error('The output ZIP exceeds 64 MB. Split a smaller document.');
          parts[`${base}-${start}-${end}.pdf`] = part;
        }
        return {
          blob: new Blob([exactBuffer(zipSync(parts, { level: 0 }))], { type: 'application/zip' }),
          name: `${base}-parts.zip`,
          pages,
        };
      }
      case 'extract':
      case 'organize': {
        const order = pageNumbers(o.range, pages);
        if (!order.length) throw Error('Select at least one page.');
        const rotate: string[] = [];
        for (const angle of [90, 180, 270]) {
          const selected = order
            .map((p, i) =>
              ((o.rotations?.[p] || 0) + (o.rotation || 0)) % 360 === angle ? i + 1 : 0,
            )
            .filter(Boolean);
          if (selected.length) rotate.push(`--rotate=+${angle}:${selected.join(',')}`);
        }
        bytes = await qpdf(
          [data],
          ['/in0.pdf', '--pages', '.', order.join(','), '--', ...rotate, '/out.pdf'],
        );
        pages = order.length;
        break;
      }
      case 'protect': {
        if (!o.password || o.password.length < 8)
          throw Error('Use a password of at least 8 characters.');
        if (new TextEncoder().encode(o.password).length > 127)
          throw Error('The password must fit within 127 UTF-8 bytes.');
        bytes = await qpdf(
          [data],
          ['--encrypt', o.password, o.password, '256', '--', '/in0.pdf', '/out.pdf'],
        );
        name = `${base}-protected.pdf`;
        break;
      }
      case 'watermark':
      case 'metadata': {
        const d = await loadPDF(data);
        if (tool === 'metadata') stripMetadata(d);
        else {
          const text = o.text?.trim();
          if (!text || text.length > 80)
            throw Error('Enter watermark text between 1 and 80 characters.');
          const font = await d.embedFont(StandardFonts.HelveticaBold);
          try {
            font.encodeText(text);
          } catch {
            throw Error('Use Latin characters for this watermark font.');
          }
          for (const p of d.getPages()) {
            const box = p.getCropBox(),
              size = Math.min(56, (box.width * 0.8) / font.widthOfTextAtSize(text, 1)),
              angle = Math.PI / 6,
              width = font.widthOfTextAtSize(text, size);
            p.drawText(text, {
              x: box.x + box.width / 2 - (width * Math.cos(angle)) / 2,
              y: box.y + box.height / 2 - (width * Math.sin(angle)) / 2,
              size,
              font,
              color: rgb(0.23, 0.31, 0.46),
              opacity: Math.max(0.05, Math.min(1, o.opacity ?? 0.22)),
              rotate: degrees(30),
            });
          }
        }
        const out = await d.save({ updateFieldAppearances: false });
        bytes = await qpdf(
          [out],
          [
            ...(tool === 'metadata' ? optimizeArgs : ['--object-streams=generate']),
            '/in0.pdf',
            '/out.pdf',
          ],
        );
        name = `${base}-${tool === 'metadata' ? 'clean' : 'watermarked'}.pdf`;
        break;
      }
      default:
        throw Error('Choose a supported PDF tool.');
    }
  }
  progress(94, 'Checking the output PDF');
  const counted =
    tool === 'protect'
      ? await authenticatedPageCount(bytes, o.password!)
      : (await loadPDF(bytes)).getPageCount();
  if (counted !== pages || (tool === 'protect' && !(await encryptedState(bytes, o.password))))
    throw Error('Output verification failed. The original is unchanged.');
  await qpdf(
    [bytes],
    [...(tool === 'protect' ? [`--password=${o.password}`] : []), '--check', '/in0.pdf'],
    false,
  );
  progress(100, 'Ready to save');
  return { name, blob: new Blob([exactBuffer(bytes)], { type: 'application/pdf' }), pages };
}
