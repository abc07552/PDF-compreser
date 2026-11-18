import { PDFArray, PDFDocument, PDFRawStream, PDFRef } from 'pdf-lib';
import { inflateBounded, N } from './document';
import type { ColorMode } from './types';
/** Recolor ordinary page paint operators without rewriting strings, fonts, inline images,
 * masks or color-space state. Complex/pattern colors are deliberately not interpreted. */
function neutralize(b: Uint8Array, mode: ColorMode): Uint8Array | undefined {
  const ws = (c: number) => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
  const delimiter = (c: number) => ws(c) || [40, 41, 60, 62, 91, 93, 123, 125, 47, 37].includes(c);
  const parts: Uint8Array[] = [];
  const enc = new TextEncoder();
  let at = 0,
    copied = 0,
    depth = 0;
  let args: { v: number; at: number }[] = [];
  while (at < b.length) {
    const start = at,
      c = b[at++];
    if (ws(c)) continue;
    if (c === 37) {
      while (at < b.length && b[at] !== 10 && b[at] !== 13) at++;
      continue;
    }
    if (c === 40) {
      let nesting = 1;
      while (at < b.length && nesting) {
        const t = b[at++];
        if (t === 92) at++;
        else if (t === 40) nesting++;
        else if (t === 41) nesting--;
      }
      if (nesting) return;
      args = [];
      continue;
    }
    if (c === 60 && b[at] !== 60) {
      while (at < b.length && b[at++] !== 62) {}
      args = [];
      continue;
    }
    if (c === 91 || (c === 60 && b[at] === 60)) {
      if (c === 60) at++;
      depth++;
      args = [];
      continue;
    }
    if (c === 93 || (c === 62 && b[at] === 62)) {
      if (c === 62) at++;
      depth--;
      if (depth < 0) return;
      args = [];
      continue;
    }
    if (c === 47) {
      while (at < b.length && !delimiter(b[at])) at++;
      args = [];
      continue;
    }
    if (delimiter(c)) {
      args = [];
      continue;
    }
    while (at < b.length && !delimiter(b[at])) at++;
    if (depth || at - start > 32) {
      args = [];
      continue;
    }
    const word = String.fromCharCode(...b.subarray(start, at));
    if (word === 'BI') return; // Never parse inline pixel data as operators.
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(word)) {
      args.push({ v: Number(word), at: start });
      if (args.length > 6) args.shift();
      continue;
    }
    const op = word.toLowerCase(),
      need = op === 'rg' ? 3 : op === 'k' ? 4 : op === 'g' ? 1 : 0;
    if (need && args.length === need) {
      const vals = args.map((x) => Math.min(1, Math.max(0, x.v)));
      let [r, g, blue] = vals;
      if (op === 'k') {
        const [c, m, y, k] = vals;
        r = 1 - Math.min(1, c + k);
        g = 1 - Math.min(1, m + k);
        blue = 1 - Math.min(1, y + k);
      }
      let l = op === 'g' ? vals[0] : 0.2126 * r + 0.7152 * g + 0.0722 * blue;
      if (mode === 'Black & white') l = l >= 0.62 ? 1 : 0;
      const val = String(+l.toFixed(4)),
        replacement =
          op === 'k'
            ? `0 0 0 ${+(1 - l).toFixed(4)} ${word}`
            : op === 'rg'
              ? `${val} ${val} ${val} ${word}`
              : `${val} ${word}`;
      parts.push(b.subarray(copied, args[0].at), enc.encode(replacement));
      copied = at;
    }
    args = [];
  }
  if (!parts.length || depth) return;
  parts.push(b.subarray(copied));
  const output = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const p of parts) {
    output.set(p, i);
    i += p.length;
  }
  return output;
}
export async function recolorPages(doc: PDFDocument, mode: ColorMode) {
  if (mode === 'Color') return 0;
  const seen = new Set<string>();
  let changed = 0;
  for (const page of doc.getPages()) {
    const contents = page.node.get(N('Contents')),
      array = doc.context.lookup(contents);
    const refs = array instanceof PDFArray ? array.asArray() : [contents];
    for (const ref of refs) {
      if (!(ref instanceof PDFRef) || seen.has(ref.toString())) continue;
      seen.add(ref.toString());
      const stream = doc.context.lookup(ref);
      if (
        !(stream instanceof PDFRawStream) ||
        stream.contents.length > 2 * 1024 * 1024 ||
        stream.dict.has(N('DecodeParms'))
      )
        continue;
      const f = stream.dict.get(N('Filter'))?.toString();
      if (f && f !== '/FlateDecode') continue;
      try {
        const bytes = f ? await inflateBounded(stream.contents, 3 * 1024 * 1024) : stream.contents;
        const neutral = neutralize(bytes, mode);
        if (neutral) {
          doc.context.assign(ref, doc.context.flateStream(neutral));
          changed++;
        }
      } catch {
        /* Keep complex content streams intact. */
      }
    }
  }
  return changed;
}
