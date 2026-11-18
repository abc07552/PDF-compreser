import { assetUrl } from '../assets';
import { runJob } from './client';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { zipSync } from 'fflate';
import {
  MAX_FILE,
  MAX_PAGES,
  exactBuffer,
  pageNumbers,
  stem,
  validateSelection,
  type Output,
  type Progress,
  type ToolOptions,
} from './types';
export async function openForViewing(blob: Blob, signal?: AbortSignal): Promise<PDFDocumentProxy> {
  if (blob.size > MAX_FILE) throw Error('Preview supports files up to 64 MB.');
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = assetUrl('vendor/pdf.worker.min.mjs');
  signal?.throwIfAborted();
  const bytes = await blob.arrayBuffer();
  signal?.throwIfAborted();
  const task = pdfjs.getDocument({
    data: bytes,
    cMapUrl: assetUrl('vendor/cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: assetUrl('vendor/standard_fonts/'),
    wasmUrl: assetUrl('vendor/wasm/'),
    iccUrl: assetUrl('vendor/iccs/'),
    isEvalSupported: false,
    enableXfa: false,
    useSystemFonts: false,
    stopAtErrors: true,
    maxImageSize: 16_000_000,
    canvasMaxAreaInBytes: 48_000_000,
  });
  const abort = () => {
    void task.destroy();
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const doc = await task.promise;
    if (doc.numPages > MAX_PAGES) {
      await doc.destroy();
      throw Error('Too many pages for local preview.');
    }
    return doc;
  } catch (e) {
    await task.destroy().catch(() => {});
    if ((e as Error).name === 'PasswordException')
      throw Error('Unlock this PDF with the correct password before previewing.');
    throw e;
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const page = await doc.getPage(pageNumber);
  signal?.throwIfAborted();
  const base = page.getViewport({ scale: 1 });
  scale = Math.min(
    scale,
    Math.sqrt(4_000_000 / (base.width * base.height)),
    5000 / Math.max(base.width, base.height),
  );
  const viewport = page.getViewport({ scale });
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const task = page.render({ canvas, viewport, background: '#ffffff' });
  const cancel = () => task.cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await task.promise;
  } finally {
    signal?.removeEventListener('abort', cancel);
    page.cleanup();
  }
}
export async function exportImages(
  file: File,
  o: ToolOptions,
  progress: Progress,
  signal: AbortSignal,
): Promise<Output> {
  validateSelection([file]);
  progress(1, 'Checking safe rendering limits');
  const analysis = await runJob({ type: 'analyze', file }, signal);
  if (analysis.oversizedImages)
    throw Error(
      'This document contains an image above the 16-megapixel rendering limit. Export was stopped to avoid missing image content.',
    );
  const doc = await openForViewing(file, signal),
    canvas = document.createElement('canvas');
  try {
    const pages = pageNumbers(o.range, doc.numPages);
    if (pages.length > 120) throw Error('Export up to 120 pages at a time. Enter a smaller range.');
    const parts: Record<string, Uint8Array> = {};
    let total = 0;
    const format = o.format || 'png';
    for (let i = 0; i < pages.length; i++) {
      signal.throwIfAborted();
      progress(
        5 + (i / pages.length) * 85,
        `Rendering page ${pages[i]} (${i + 1} of ${pages.length})`,
      );
      await renderPage(doc, pages[i], canvas, (o.dpi || 150) / 72, signal);
      const img = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(Error('Image encoding failed.'))),
          `image/${format}`,
          0.86,
        ),
      );
      if (img.type !== `image/${format}`)
        throw Error('This image format is not supported by your browser. Choose PNG instead.');
      total += img.size;
      if (total > MAX_FILE)
        throw Error('The images exceed 64 MB. Use a smaller page range or a lower DPI.');
      parts[
        `${String(i + 1).padStart(3, '0')}-page-${pages[i]}.${format === 'jpeg' ? 'jpg' : format}`
      ] = new Uint8Array(await img.arrayBuffer());
    }
    signal.throwIfAborted();
    progress(94, 'Packaging images');
    return {
      name: `${stem(file.name)}-images.zip`,
      blob: new Blob([exactBuffer(zipSync(parts, { level: 0 }))], { type: 'application/zip' }),
      pages: pages.length,
    };
  } finally {
    canvas.width = canvas.height = 1;
    await doc.destroy();
  }
}
