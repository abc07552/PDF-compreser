export const MB = 1024 * 1024;
export const MAX_FILE = 64 * MB,
  MAX_BATCH = 128 * MB,
  MAX_FILES = 16,
  MAX_PAGES = 1500;
export type Preset = 'Recommended' | 'Balanced' | 'High' | 'Extreme' | 'Custom';
export type DocumentKind =
  | 'Text document'
  | 'Scanned document'
  | 'Image-heavy document'
  | 'Mixed document';
export type ColorMode = 'Color' | 'Grayscale' | 'Black & white';
export interface Settings {
  preset: Preset;
  target: number;
  dpi: number;
  quality: number;
  color: ColorMode;
  retry: boolean;
}
export const defaults: Settings = {
  preset: 'Recommended',
  target: 0,
  dpi: 150,
  quality: 78,
  color: 'Color',
  retry: true,
};
export interface Analysis {
  pages: number;
  images: number;
  kind: DocumentKind;
  recommended: string;
  signed: boolean;
  oversizedImages: boolean;
  imageBudget: { eligible: number; atDpi: Record<number, number> };
}
export interface Report {
  original: number;
  output: number;
  attempts: number;
  unchanged: boolean;
  imagesOptimized: number;
  targetMet: boolean;
  profile: string;
  pages: number;
}
export type ToolId =
  | 'compress'
  | 'merge'
  | 'split'
  | 'extract'
  | 'organize'
  | 'to-images'
  | 'from-images'
  | 'protect'
  | 'unlock'
  | 'watermark'
  | 'metadata'
  | 'preview';
export interface ToolOptions {
  range?: string;
  group?: number;
  rotation?: number;
  rotations?: Record<number, number>;
  password?: string;
  authorized?: boolean;
  text?: string;
  opacity?: number;
  format?: 'png' | 'jpeg' | 'webp';
  dpi?: number;
}
export interface Output {
  blob: Blob;
  name: string;
  pages: number;
  report?: Report;
}
export type Job =
  | { type: 'analyze'; file: File }
  | { type: 'compress'; file: File; settings: Settings }
  | { type: 'tool'; tool: ToolId; files: File[]; options: ToolOptions };
export type Progress = (percent: number, stage: string) => void;
export const formatBytes = (n: number, decimals = 1) =>
  n >= MB
    ? `${Number((n / MB).toFixed(decimals))} MB`
    : n > 0 && n < 1024
      ? `${Math.round(n)} B`
      : `${Number((n / 1024).toFixed(decimals))} KB`;
export const stem = (s: string) =>
  s
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .slice(0, 100) || 'Document';
export function validateSelection(files: File[], images = false) {
  if (!files.length) throw Error('Choose a file first.');
  if (files.length > MAX_FILES) throw Error(`Choose up to ${MAX_FILES} files at a time.`);
  if (files.reduce((a, f) => a + f.size, 0) > MAX_BATCH)
    throw Error('The batch exceeds 128 MB. Process fewer files at once.');
  for (const f of files) {
    if (!f.size) throw Error(`${f.name} is empty.`);
    if (f.size > MAX_FILE)
      throw Error(
        `${f.name} exceeds the 64 MB safety limit. Split it into smaller documents first.`,
      );
    if (
      images
        ? !/\.(png|jpe?g|webp)$/i.test(f.name)
        : !(/\.pdf$/i.test(f.name) || f.type === 'application/pdf')
    )
      throw Error(
        images ? 'Choose JPEG, PNG or WebP images.' : 'Only PDF documents are supported here.',
      );
  }
}
export function pageNumbers(range: string | undefined, count: number): number[] {
  if (!range?.trim()) return Array.from({ length: count }, (_, i) => i + 1);
  const out: number[] = [];
  for (const token of range.split(',')) {
    const m = token.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw Error('Use page numbers or ranges, for example 1, 3-5.');
    const a = +m[1],
      b = +(m[2] || a);
    if (a < 1 || b > count || a > count || b < a)
      throw Error(`Choose pages between 1 and ${count}, with ranges in ascending order.`);
    if (out.length + b - a + 1 > MAX_PAGES) throw Error('Too many pages selected.');
    for (let i = a; i <= b; i++) out.push(i);
  }
  return out;
}
export function profile(s: Settings, a: Analysis) {
  if (s.preset === 'Custom')
    return { dpi: s.dpi, quality: s.quality, label: `Custom · ${s.dpi} DPI` };
  const p =
    s.preset === 'Extreme'
      ? [72, 38]
      : s.preset === 'High'
        ? [120, 60]
        : s.preset === 'Balanced'
          ? [150, 78]
          : a.kind === 'Scanned document'
            ? [150, 70]
            : a.kind === 'Image-heavy document'
              ? [120, 70]
              : [180, 82];
  return { dpi: p[0], quality: p[1], label: s.preset === 'Recommended' ? a.recommended : s.preset };
}
/** A broad heuristic, not a promise: model the editable image streams separately from structure. */
export function estimate(size: number, a: Analysis, s: Settings): [number, number] {
  const p = profile(s, a),
    base = Math.max(0, size - a.imageBudget.eligible),
    img = Math.min(
      a.imageBudget.eligible,
      (a.imageBudget.atDpi[p.dpi] || 0) * (p.quality / 78) ** 1.35,
    );
  return [
    Math.min(size, Math.round(base * 0.52 + img * 0.4)),
    Math.min(size, Math.max(1, Math.round(base * 0.99 + img * 1.95))),
  ];
}
export function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer instanceof ArrayBuffer &&
    bytes.byteOffset === 0 &&
    bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer
    : Uint8Array.from(bytes).buffer;
}
