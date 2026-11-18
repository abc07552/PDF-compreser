import { zlibSync } from 'fflate';
import { PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';
import { N, num, inflateBounded } from './document';
import { exactBuffer, type ColorMode, type Progress } from './types';
const MAX_PIXELS = 12_000_000;
const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
async function rawPixels(s: PDFRawStream, w: number, h: number, ch: number) {
  const row = w * ch,
    filter = s.dict.get(N('Filter'))?.toString();
  let bytes =
    filter === '/FlateDecode' ? await inflateBounded(s.contents, (row + 1) * h) : s.contents;
  const params = s.dict.lookup(N('DecodeParms'));
  if (params && !(params instanceof PDFDict)) return;
  const predictor = params instanceof PDFDict ? num(params, 'Predictor') || 1 : 1;
  if (
    params instanceof PDFDict &&
    predictor > 1 &&
    ((num(params, 'Columns') || 1) !== w ||
      (num(params, 'Colors') || 1) !== ch ||
      (num(params, 'BitsPerComponent') || 8) !== 8)
  )
    return;
  if (predictor >= 10 && predictor <= 15) {
    if (bytes.length !== (row + 1) * h) return;
    const unpack = new Uint8Array(row * h);
    for (let y = 0; y < h; y++) {
      const start = y * (row + 1),
        type = bytes[start];
      if (type > 4) return;
      for (let x = 0; x < row; x++) {
        const i = y * row + x,
          a = x >= ch ? unpack[i - ch] : 0,
          b = y > 0 ? unpack[i - row] : 0,
          c = x >= ch && y > 0 ? unpack[i - row - ch] : 0;
        unpack[i] =
          bytes[start + 1 + x] +
          (type === 0
            ? 0
            : type === 1
              ? a
              : type === 2
                ? b
                : type === 3
                  ? Math.floor((a + b) / 2)
                  : paeth(a, b, c));
      }
    }
    bytes = unpack;
  } else if (predictor !== 1) return;
  if (bytes.length !== row * h) return;
  const canvas = new OffscreenCanvas(w, h),
    c = canvas.getContext('2d');
  if (!c) return;
  const image = c.createImageData(w, h);
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    image.data[j] = bytes[i * ch];
    image.data[j + 1] = bytes[i * ch + (ch === 3 ? 1 : 0)];
    image.data[j + 2] = bytes[i * ch + (ch === 3 ? 2 : 0)];
    image.data[j + 3] = 255;
  }
  c.putImageData(image, 0, 0);
  return canvas;
}
export async function optimizeImages(
  doc: PDFDocument,
  dpi: number,
  quality: number,
  color: ColorMode,
  progress: Progress,
) {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return 0;
  const pages = doc.getPages();
  const maxSide = Math.min(
    5000,
    Math.ceil(
      (Math.max(
        ...pages.map((p) => Math.max(p.getWidth(), p.getHeight()) * (num(p.node, 'UserUnit') || 1)),
      ) *
        dpi) /
        72,
    ),
  );
  const streams = doc.context
    .enumerateIndirectObjects()
    .filter(
      (x): x is [PDFRef, PDFRawStream] =>
        x[1] instanceof PDFRawStream && x[1].dict.get(N('Subtype')) === N('Image'),
    );
  const masks = new Set<string>();
  for (const [, s] of streams)
    for (const k of ['SMask', 'Mask']) {
      const r = s.dict.get(N(k));
      if (r instanceof PDFRef) masks.add(r.toString());
    }
  let optimized = 0;
  for (let i = 0; i < streams.length; i++) {
    const [ref, s] = streams[i],
      d = s.dict;
    progress(
      10 + (i / Math.max(1, streams.length)) * 55,
      `Optimizing image ${i + 1} of ${streams.length}`,
    );
    const w = num(d, 'Width'),
      h = num(d, 'Height'),
      cs = d.lookup(N('ColorSpace'))?.toString(),
      filter = d.get(N('Filter'))?.toString();
    if (
      !w ||
      !h ||
      w * h > MAX_PIXELS ||
      w > 32767 ||
      h > 32767 ||
      num(d, 'BitsPerComponent') !== 8 ||
      masks.has(ref.toString()) ||
      ['Mask', 'SMask', 'ImageMask', 'Decode', 'Alternates', 'F'].some((k) => d.has(N(k))) ||
      !['/DeviceRGB', '/DeviceGray'].includes(cs || '') ||
      !['/DCTDecode', '/FlateDecode', undefined].includes(filter)
    )
      continue;
    if (filter === '/DCTDecode' && d.has(N('DecodeParms'))) continue;
    let source: ImageBitmap | OffscreenCanvas | undefined, canvas: OffscreenCanvas | undefined;
    try {
      if (filter === '/DCTDecode') {
        const [jpegW, jpegH] = imageDimensions(s.contents);
        if (jpegW !== w || jpegH !== h) continue;
        source = await createImageBitmap(
          new Blob([exactBuffer(s.contents)], { type: 'image/jpeg' }),
          { imageOrientation: 'none', colorSpaceConversion: 'none' },
        );
        if (source.width !== w || source.height !== h) continue;
      } else source = await rawPixels(s, w, h, cs === '/DeviceRGB' ? 3 : 1);
      if (!source) continue;
      const scale = Math.min(1, maxSide / Math.max(w, h), Math.sqrt(4_000_000 / (w * h)));
      const width = Math.max(1, Math.round(w * scale)),
        height = Math.max(1, Math.round(h * scale));
      canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d', { willReadFrequently: color !== 'Color' });
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, width, height);
      let binary: Uint8Array | undefined;
      if (color !== 'Color') {
        const im = ctx.getImageData(0, 0, width, height);
        for (let k = 0; k < im.data.length; k += 4) {
          let y = Math.round(
            0.2126 * im.data[k] + 0.7152 * im.data[k + 1] + 0.0722 * im.data[k + 2],
          );
          if (color === 'Black & white') y = y >= 158 ? 255 : 0;
          im.data[k] = im.data[k + 1] = im.data[k + 2] = y;
        }
        if (color === 'Black & white') {
          const stride = Math.ceil(width / 8);
          const packed = new Uint8Array(stride * height);
          for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++)
              if (im.data[(y * width + x) * 4]) packed[y * stride + (x >> 3)] |= 1 << (7 - (x & 7));
          binary = zlibSync(packed, { level: 9 });
        } else ctx.putImageData(im, 0, 0);
      }
      const encoded =
        binary ||
        new Uint8Array(
          await (
            await canvas.convertToBlob({ type: 'image/jpeg', quality: quality / 100 })
          ).arrayBuffer(),
        );
      if (encoded.length >= s.contents.length && color === 'Color') continue;
      const dict = d.clone(doc.context);
      dict.set(N('Width'), doc.context.obj(width));
      dict.set(N('Height'), doc.context.obj(height));
      dict.set(N('ColorSpace'), PDFName.of(binary ? 'DeviceGray' : 'DeviceRGB'));
      dict.set(N('BitsPerComponent'), doc.context.obj(binary ? 1 : 8));
      dict.set(N('Filter'), N(binary ? 'FlateDecode' : 'DCTDecode'));
      dict.delete(N('DecodeParms'));
      dict.set(N('Length'), doc.context.obj(encoded.length));
      doc.context.assign(ref, PDFRawStream.of(dict, encoded));
      optimized++;
    } catch {
      /* Unsupported images are kept byte-for-byte; do not rasterize the page. */
    } finally {
      if (source instanceof ImageBitmap) source.close();
      else if (source) {
        source.width = source.height = 1;
      }
      if (canvas) canvas.width = canvas.height = 1;
    }
  }
  return optimized;
}
/** Inspect common image headers before decoding to guard against oversized pixel buffers. */
export function imageDimensions(b: Uint8Array): [number, number] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b[0] === 137 && b[1] === 80 && b.length > 24) return [v.getUint32(16), v.getUint32(20)];
  if (b[0] === 255 && b[1] === 216) {
    let p = 2;
    while (p + 8 < b.length) {
      while (b[p] === 255) p++;
      const m = b[p++];
      if (m === 0xda || m === 0xd9) break;
      const len = v.getUint16(p);
      if (len < 2) break;
      if ([0xc0, 0xc1, 0xc2].includes(m)) return [v.getUint16(p + 5), v.getUint16(p + 3)];
      p += len;
    }
  }
  if (String.fromCharCode(...b.slice(8, 12)) === 'WEBP' && b.length >= 30) {
    const type = String.fromCharCode(...b.slice(12, 16));
    if (type === 'VP8X')
      return [1 + b[24] + (b[25] << 8) + (b[26] << 16), 1 + b[27] + (b[28] << 8) + (b[29] << 16)];
    if (type === 'VP8 ') return [v.getUint16(26, true) & 16383, v.getUint16(28, true) & 16383];
    if (type === 'VP8L') {
      const n = v.getUint32(21, true);
      return [(n & 16383) + 1, ((n >>> 14) & 16383) + 1];
    }
  }
  throw Error('This image encoding is unsupported. Try a standard PNG, JPEG or WebP file.');
}
