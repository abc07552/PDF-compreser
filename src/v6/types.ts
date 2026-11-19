import { defaults, MB, type Analysis, type Output, type Settings } from '../engine/types';
export const categories = [
  'Reports',
  'Quarterly reports',
  'Contracts',
  'Invoices',
  'Government forms',
  'Certificates',
  'Exam documents',
  'Scanned documents',
  'Uncategorized',
] as const;
export type Category = (typeof categories)[number];
export type Edition = 'mobile' | 'tablet' | 'desktop';
export type Route = 'home' | 'compress' | 'tools' | 'history' | 'analytics' | 'settings';
export interface LibraryMeta {
  id: string;
  name: string;
  size: number;
  pages: number;
  category: Category;
  favorite: boolean;
  created: number;
  sample?: string;
  saved?: boolean;
  removed?: boolean;
  layer: string;
  lastRun?: number;
  opened?: number;
  cover?: string;
}
export interface DocumentItem extends LibraryMeta {
  file?: File;
  analysis?: Analysis;
  out?: Output;
  error?: string;
}
export interface Preferences {
  settings: Settings;
  unit: 'KB' | 'MB';
  keep: boolean;
  remember: boolean;
  floating: boolean;
  theme: 'dark' | 'light';
}
export const initialPrefs: Preferences = {
  settings: {
    ...defaults,
    preset: 'Smart Auto',
    target: 500 * 1024,
    clarity: true,
    exact: false,
    enhancement: 'Off',
  },
  unit: 'KB',
  keep: false,
  remember: true,
  floating: false,
  theme: 'dark',
};
export const presets = [
  'Smart Auto',
  'Clarity First',
  'Government Form',
  'Recommended',
  'Balanced',
  'High',
  'Extreme',
  'Custom',
] as const;
export function cleanPrefs(value: unknown): Preferences {
  const d = initialPrefs;
  if (!value || typeof value !== 'object') return structuredClone(d);
  const v = value as Partial<Preferences>,
    s = v.settings;
  return {
    theme: v.theme === 'light' ? 'light' : 'dark',
    unit: v.unit === 'MB' ? 'MB' : 'KB',
    keep: v.keep === true,
    remember: v.remember !== false,
    floating: v.floating === true,
    settings: {
      ...d.settings,
      preset: s && presets.includes(s.preset) ? s.preset : d.settings.preset,
      dpi: s && [72, 96, 120, 150, 200, 300].includes(s.dpi) ? s.dpi : 150,
      quality: s && Number.isFinite(s.quality) ? Math.min(100, Math.max(10, s.quality)) : 78,
      target:
        s && (s.target === 0 || (s.target >= 1024 && s.target <= 1000 * MB))
          ? Math.round(s.target)
          : d.settings.target,
      color: s && ['Color', 'Grayscale', 'Black & white'].includes(s.color) ? s.color : 'Color',
      exact: s?.exact === true,
      clarity: s?.clarity !== false,
      retry: s?.retry !== false,
      enhancement:
        s?.enhancement === 'HD clarity' || s?.enhancement === 'Scan cleanup'
          ? s.enhancement
          : 'Off',
    },
  };
}
export const MAX_DOCS = 64,
  MAX_LIBRARY_BYTES = 256 * MB;
export function meta(d: DocumentItem): LibraryMeta {
  const {
    id,
    name,
    size,
    pages,
    category,
    favorite,
    created,
    sample,
    saved,
    removed,
    layer,
    lastRun,
    opened,
  } = d;
  return {
    id,
    name,
    size,
    pages,
    category,
    favorite,
    created,
    sample,
    saved,
    removed,
    layer,
    lastRun,
    opened,
  };
}
export function classify(name: string, a: Analysis): Category {
  return /contract|agreement/i.test(name)
    ? 'Contracts'
    : /invoice/i.test(name)
      ? 'Invoices'
      : /permit|application|form/i.test(name)
        ? 'Government forms'
        : /certificat/i.test(name)
          ? 'Certificates'
          : /exam/i.test(name)
            ? 'Exam documents'
            : /quarter/i.test(name)
              ? 'Quarterly reports'
              : /report/i.test(name)
                ? 'Reports'
                : a.kind === 'Scanned document'
                  ? 'Scanned documents'
                  : 'Uncategorized';
}
export function textLayer(a: Analysis) {
  return a.sampledText ? 'Text layer' : 'No text detected';
}
