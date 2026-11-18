// Development fixture only. This page is not included in the application bundle or APK.
import { runJob } from '../src/engine/client';
import { defaults } from '../src/engine/types';
import { openForViewing, exportImages, renderPage } from '../src/engine/render';
import { unzipSync } from 'fflate';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
const files = () => Array.from(document.getElementById('files').files);
let output;
const progress = [];
window.lab = {
  files,
  analyze: () => runJob({ type: 'analyze', file: files()[0] }),
  async compress(settings = {}) {
    progress.length = 0;
    output = await runJob(
      { type: 'compress', file: files()[0], settings: { ...defaults, ...settings } },
      undefined,
      (n, label) => progress.push({ n, label }),
    );
    return { ...output.report, progress };
  },
  async tool(tool, options = {}, fromOutput = false) {
    const input = fromOutput
      ? [new File([output.blob], output.name, { type: output.blob.type })]
      : files();
    output =
      tool === 'to-images'
        ? await exportImages(input[0], options, () => {}, new AbortController().signal)
        : await runJob({ type: 'tool', tool, files: input, options });
    return { size: output.blob.size, pages: output.pages, name: output.name };
  },
  async inspect(original = false) {
    const blob = original ? files()[0] : output.blob;
    const doc = await openForViewing(blob);
    try {
      const result = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const p = await doc.getPage(n);
        result.push({
          size: p.view,
          rotation: p.rotate,
          text: (await p.getTextContent()).items
            .map((i) => i.str)
            .filter(Boolean)
            .join(' '),
          links: (await p.getAnnotations()).map((a) => a.url).filter(Boolean),
        });
      }
      return result;
    } finally {
      await doc.destroy();
    }
  },
  async imageInfo() {
    const doc = await PDFDocument.load(await output.blob.arrayBuffer(), { updateMetadata: false });
    return doc.context
      .enumerateIndirectObjects()
      .filter(
        ([, o]) =>
          o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype')) === PDFName.of('Image'),
      )
      .map(([, o]) => ({
        width: o.dict.get(PDFName.of('Width')).asNumber(),
        height: o.dict.get(PDFName.of('Height')).asNumber(),
        bits: o.dict.get(PDFName.of('BitsPerComponent')).asNumber(),
        filter: o.dict.get(PDFName.of('Filter')).toString(),
      }));
  },
  async meta() {
    const d = await PDFDocument.load(await output.blob.arrayBuffer(), { updateMetadata: false });
    return {
      title: d.getTitle() || '',
      author: d.getAuthor() || '',
      metadata: d.catalog.has(PDFName.of('Metadata')),
    };
  },
  async zip() {
    const z = unzipSync(new Uint8Array(await output.blob.arrayBuffer()));
    return Promise.all(
      Object.entries(z).map(async ([name, bytes]) => ({
        name,
        bytes: bytes.length,
        pages: name.endsWith('.pdf') ? (await PDFDocument.load(bytes)).getPageCount() : 0,
        magic: Array.from(bytes.slice(0, 4)),
      })),
    );
  },
  async cancel() {
    const ac = new AbortController();
    const p = runJob({ type: 'compress', file: files()[0], settings: defaults }, ac.signal);
    ac.abort();
    return p;
  },
  async oversized() {
    return runJob({
      type: 'analyze',
      file: new File([new Uint8Array(64 * 1024 * 1024 + 1)], 'large.pdf'),
    });
  },
  async imageError() {
    return runJob({
      type: 'tool',
      tool: 'from-images',
      files: [new File(['bad image'], 'image.png')],
      options: {},
    });
  },
  async hasColor(original) {
    const d = await openForViewing(original ? files()[0] : output.blob),
      c = document.createElement('canvas');
    await renderPage(d, 1, c, 1);
    try {
      const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < px.length; i += 4)
        if (Math.max(px[i], px[i + 1], px[i + 2]) - Math.min(px[i], px[i + 1], px[i + 2]) > 4)
          return true;
      return false;
    } finally {
      await d.destroy();
    }
  },
  async verifiedPixelDiff() {
    let prev;
    for (const blob of [files()[0], output.blob]) {
      const d = await openForViewing(blob),
        c = document.createElement('canvas');
      await renderPage(d, 1, c, 0.5);
      const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      await d.destroy();
      if (prev) {
        let sum = 0;
        for (let i = 0; i < pixels.length; i++) sum += (prev[i] - pixels[i]) ** 2;
        return sum / pixels.length;
      }
      prev = pixels;
    }
  },
};
