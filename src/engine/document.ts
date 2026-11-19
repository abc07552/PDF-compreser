import { encryptedState } from './qpdf';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
} from 'pdf-lib';
import { MAX_PAGES, exactBuffer, type Analysis } from './types';
export const N = PDFName.of;
export const num = (d: PDFDict, key: string) => d.lookupMaybe(N(key), PDFNumber)?.asNumber() ?? 0;
export async function loadPDF(bytes: Uint8Array) {
  if (!new TextDecoder('latin1').decode(bytes.subarray(0, 1024)).includes('%PDF-'))
    throw Error('This file is not a valid PDF. Choose a different document.');
  let doc: PDFDocument;
  let count: number;
  try {
    doc = await PDFDocument.load(bytes, {
      updateMetadata: false,
      ignoreEncryption: false,
      throwOnInvalidObject: true,
    });
    count = doc.getPageCount();
  } catch (e) {
    if (/encrypt|password/i.test(String(e)) || (await encryptedState(bytes)))
      throw Error(
        'This PDF is password-protected. Use Unlock PDF with the correct password and permission first.',
      );
    throw Error('This PDF is damaged or unreadable. Try opening and re-saving the original.');
  }
  if (!count || count > MAX_PAGES)
    throw Error(`Choose a PDF with 1–${MAX_PAGES.toLocaleString()} pages.`);
  return doc;
}
// Size-bounded inflation avoids allocating arbitrarily large decoded image/content streams.
export async function inflateBounded(bytes: Uint8Array, limit: number) {
  const reader = new Blob([exactBuffer(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'))
    .getReader();
  const chunks: Uint8Array[] = [];
  let sum = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      sum += value.length;
      if (sum > limit) {
        await reader.cancel();
        throw Error('Stream exceeds the local decoding budget.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(sum);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}
export function isSigned(doc: PDFDocument) {
  return doc.context
    .enumerateIndirectObjects()
    .some(
      ([, obj]) =>
        obj instanceof PDFDict &&
        (obj.get(N('Type')) === N('Sig') || (obj.get(N('FT')) === N('Sig') && obj.has(N('V')))),
    );
}
export function requireEditable(doc: PDFDocument) {
  if (isSigned(doc))
    throw Error(
      'This PDF has a digital signature. Editing would invalidate it; choose an unsigned copy.',
    );
}
export async function inspect(doc: PDFDocument): Promise<Analysis> {
  let images = 0,
    large = 0;
  let oversizedImages = false;
  for (const [, o] of doc.context.enumerateIndirectObjects())
    if (
      o instanceof PDFRawStream &&
      o.dict.get(N('Subtype')) === N('Image') &&
      !o.dict.has(N('ImageMask'))
    ) {
      images++;
      const pixels = num(o.dict, 'Width') * num(o.dict, 'Height');
      if (pixels > 180000) large++;
      if (pixels > 16_000_000) oversizedImages = true;
    }
  let text = false;
  const pages = doc.getPages();
  const sample = Array.from(new Set([0, Math.floor(pages.length / 2), pages.length - 1]));
  for (const i of sample) {
    const page = pages[i];
    const raw = page.node.Contents();
    const refs = raw instanceof PDFArray ? raw.asArray() : [raw];
    for (const ref of refs.slice(0, 16)) {
      const s = doc.context.lookup(ref);
      if (!(s instanceof PDFRawStream) || s.contents.length > 1024 * 1024) continue;
      try {
        const filter = s.dict.get(N('Filter'))?.toString();
        const bytes =
          filter === '/FlateDecode'
            ? await inflateBounded(s.contents, 2 * 1024 * 1024)
            : !filter
              ? s.contents
              : new Uint8Array();
        if (/(?:^|\s)BT(?:\s|$)/.test(new TextDecoder('latin1').decode(bytes))) {
          text = true;
          break;
        }
      } catch {
        /* Complex or oversized content is left untouched. */
      }
    }
    if (text) break;
  }
  const imageBudget: Analysis['imageBudget'] = { eligible: 0, atDpi: {} };
  const edge = Math.max(
    ...pages.map((p) => Math.max(p.getWidth(), p.getHeight()) * (num(p.node, 'UserUnit') || 1)),
  );
  for (const [, o] of doc.context.enumerateIndirectObjects()) {
    if (!(o instanceof PDFRawStream) || o.dict.get(N('Subtype')) !== N('Image')) continue;
    const d = o.dict,
      w = num(d, 'Width'),
      h = num(d, 'Height'),
      f = d.get(N('Filter'))?.toString(),
      cs = d.get(N('ColorSpace'))?.toString();
    if (
      !w ||
      !h ||
      w * h > 12_000_000 ||
      num(d, 'BitsPerComponent') !== 8 ||
      !['/DeviceRGB', '/DeviceGray'].includes(cs || '') ||
      ['Mask', 'SMask', 'Decode', 'ImageMask'].some((k) => d.has(N(k))) ||
      !['/DCTDecode', '/FlateDecode', undefined].includes(f)
    )
      continue;
    let predicted = f === '/DCTDecode' ? o.contents.length * 0.83 : w * h * 0.31;
    if (!f) {
      const ch = cs === '/DeviceRGB' ? 3 : 1;
      let difference = 0,
        count = 0;
      for (let k = ch; k < o.contents.length; k += ch * Math.max(1, Math.floor((w * h) / 2048))) {
        difference += Math.abs(o.contents[k] - o.contents[k - ch]);
        count++;
      }
      predicted = w * h * (0.047 + Math.min(1, difference / Math.max(1, count) / 65) * 0.72);
    }
    imageBudget.eligible += o.contents.length;
    for (const dpi of [72, 96, 120, 150, 180, 200, 300]) {
      const scale = Math.min(1, (edge * dpi) / 72 / Math.max(w, h), Math.sqrt(4_000_000 / (w * h)));
      imageBudget.atDpi[dpi] =
        (imageBudget.atDpi[dpi] || 0) + Math.min(o.contents.length, predicted * scale * scale);
    }
  }
  const kind = !images
    ? 'Text document'
    : text
      ? 'Mixed document'
      : large > 0 && images <= pages.length * 1.3
        ? 'Scanned document'
        : 'Image-heavy document';
  return {
    pages: pages.length,
    images,
    kind,
    imageBudget,
    oversizedImages,
    sampledText: text,
    signed: isSigned(doc),
    recommended:
      kind === 'Text document'
        ? 'Lossless structure'
        : kind === 'Scanned document'
          ? 'Scan clarity'
          : kind === 'Image-heavy document'
            ? 'Image optimization'
            : 'Adaptive balance',
  };
}
export function stripMetadata(doc: PDFDocument) {
  delete doc.context.trailerInfo.Info;
  for (const [, o] of doc.context.enumerateIndirectObjects()) {
    const d = o instanceof PDFStream ? o.dict : o instanceof PDFDict ? o : null;
    d?.delete(N('Metadata'));
    d?.delete(N('PieceInfo'));
  }
}
// Identical image/font programs may be shared; differing dictionaries or encodings are never merged.
export async function deduplicate(doc: PDFDocument) {
  const objects = doc.context.enumerateIndirectObjects();
  const fonts = new Set<string>();
  for (const [, o] of objects)
    if (o instanceof PDFDict)
      for (const key of ['FontFile', 'FontFile2', 'FontFile3']) {
        const ref = o.get(N(key));
        if (ref instanceof PDFRef) fonts.add(ref.toString());
      }
  const known = new Map<string, PDFRef>(),
    replacements = new Map<string, PDFRef>();
  for (const [ref, o] of objects) {
    if (
      !(o instanceof PDFRawStream) ||
      (o.dict.get(N('Subtype')) !== N('Image') && !fonts.has(ref.toString()))
    )
      continue;
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', exactBuffer(o.contents)));
    const key = Array.from(hash).join('.') + o.dict.toString();
    const first = known.get(key);
    if (first) replacements.set(ref.toString(), first);
    else known.set(key, ref);
  }
  if (!replacements.size) return;
  const seen = new WeakSet<object>();
  function walk(o: unknown, depth = 0) {
    if (!o || typeof o !== 'object' || seen.has(o) || depth > 64) return;
    seen.add(o);
    if (o instanceof PDFStream) walk(o.dict, depth + 1);
    else if (o instanceof PDFDict) {
      for (const [key, v] of o.entries()) {
        const r = v instanceof PDFRef && replacements.get(v.toString());
        if (r) o.set(key, r);
        else if (!(v instanceof PDFRef)) walk(v, depth + 1);
      }
    } else if (o instanceof PDFArray) {
      for (let i = 0; i < o.size(); i++) {
        const v = o.get(i),
          r = v instanceof PDFRef && replacements.get(v.toString());
        if (r) o.set(i, r);
        else if (!(v instanceof PDFRef)) walk(v, depth + 1);
      }
    }
  }
  for (const [, o] of objects) walk(o);
}
