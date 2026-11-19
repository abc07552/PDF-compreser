import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { exactBuffer, MAX_BATCH, MAX_FILE, stem, type Output } from '../engine/types';
import { categories, MAX_DOCS, cleanPrefs, type LibraryMeta, type Preferences } from './types';
import type { Activity } from '../storage';
export async function zipResults(outputs: Output[]): Promise<Output> {
  if (!outputs.length) throw Error('Choose at least one completed result.');
  if (outputs.reduce((n, o) => n + o.blob.size, 0) > MAX_BATCH)
    throw Error('Export at most 128 MB at a time.');
  const entries: Record<string, Uint8Array> = {};
  for (const [i, o] of outputs.entries())
    entries[`${String(i + 1).padStart(2, '0')}-${stem(o.name)}.pdf`] = new Uint8Array(
      await o.blob.arrayBuffer(),
    );
  return {
    name: 'Ultra-compressed-documents.zip',
    pages: outputs.reduce((n, o) => n + o.pages, 0),
    blob: new Blob([exactBuffer(zipSync(entries, { level: 0 }))], { type: 'application/zip' }),
  };
}
export async function backup(
  docs: { meta: LibraryMeta; data: Blob }[],
  prefs: Preferences,
  history: Activity[],
): Promise<Output> {
  if (docs.reduce((n, d) => n + d.data.size, 0) > MAX_BATCH - 2 * 1024 * 1024)
    throw Error('Backup supports 126 MB of documents. Export larger selections separately.');
  if (history.length > 6000) throw Error('Too many activity records for a single backup.');
  const entries: Record<string, Uint8Array> = {},
    items = [];
  for (const [i, d] of docs.entries()) {
    const path = `documents/${i}.pdf`;
    entries[path] = new Uint8Array(await d.data.arrayBuffer());
    items.push({ name: d.meta.name, category: d.meta.category, favorite: d.meta.favorite, path });
  }
  entries['manifest.json'] = strToU8(
    JSON.stringify({ format: 'pdf-reducer/6', items, prefs, history }),
  );
  if (entries['manifest.json'].length > 2 * 1024 * 1024)
    throw Error('Backup metadata exceeds 2 MB.');
  return {
    name: 'PDF-Reducer-V6-backup.zip',
    pages: docs.reduce((n, d) => n + d.meta.pages, 0),
    blob: new Blob([exactBuffer(zipSync(entries, { level: 0 }))], { type: 'application/zip' }),
  };
}
export async function readBackup(file: File) {
  if (file.size > MAX_BATCH) throw Error('The backup exceeds 128 MB.');
  let total = 0,
    count = 0;
  const z = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter(e) {
      count++;
      if (
        e.compression !== 0 ||
        count > MAX_DOCS + 1 ||
        e.originalSize !== e.size ||
        (total += e.originalSize) > MAX_BATCH ||
        e.originalSize > MAX_FILE ||
        !(e.name === 'manifest.json' || /^documents\/\d+\.pdf$/.test(e.name))
      )
        throw Error('Unsupported backup structure. Choose an unmodified V6 backup.');
      return true;
    },
  });
  if (!z['manifest.json'] || z['manifest.json'].length > 2 * 1024 * 1024)
    throw Error('Invalid backup manifest.');
  const m = JSON.parse(strFromU8(z['manifest.json']));
  if (
    m.format !== 'pdf-reducer/6' ||
    !Array.isArray(m.items) ||
    m.items.length > MAX_DOCS ||
    !Array.isArray(m.history) ||
    m.history.length > 6000
  )
    throw Error('Not a V6 workspace backup.');
  const items = m.items.map(
    (
      i: { path: string; name: string; category: LibraryMeta['category']; favorite: boolean },
      n: number,
    ) => {
      if (
        i.path !== `documents/${n}.pdf` ||
        !z[i.path] ||
        typeof i.name !== 'string' ||
        i.name.length > 200 ||
        !categories.includes(i.category)
      )
        throw Error('Invalid document in backup.');
      return {
        file: new File([exactBuffer(z[i.path])], stem(i.name) + '.pdf', {
          type: 'application/pdf',
        }),
        category: i.category,
        favorite: i.favorite === true,
      };
    },
  ) as { file: File; category: LibraryMeta['category']; favorite: boolean }[];
  const history: Activity[] = m.history.map((a: Activity) => {
    if (
      !a ||
      typeof a.id !== 'string' ||
      a.id.length > 80 ||
      typeof a.name !== 'string' ||
      typeof a.operation !== 'string' ||
      ![a.input, a.output, a.pages, a.at].every((n) => Number.isSafeInteger(n) && n >= 0)
    )
      throw Error('Invalid activity record.');
    return {
      id: a.id,
      name: a.name.slice(0, 200),
      operation: a.operation.slice(0, 60),
      profile: String(a.profile || '').slice(0, 80),
      status: ['failed', 'cancelled'].includes(a.status || '') ? a.status : 'success',
      input: a.input,
      output: a.output,
      pages: a.pages,
      at: a.at,
    };
  });
  return { items, history, prefs: cleanPrefs(m.prefs) };
}
