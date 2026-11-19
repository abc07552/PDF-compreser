import type { LibraryMeta } from './v6/types';
import { assetUrl } from './assets';
import type { Output } from './engine/types';
export interface Activity {
  id: string;
  name: string;
  operation: string;
  input: number;
  output: number;
  pages: number;
  at: number;
  status?: 'success' | 'failed' | 'cancelled';
  profile?: string;
}
interface NativeBridge {
  libraryRecords(): string;
  patchLibraryRecord(base: string, delta: string): boolean;
  saveLibraryRecord(json: string): boolean;
  removeLibraryRecord(id: string): boolean;
  beginLibraryFile(id: string): boolean;
  appendLibraryChunk(data: string): boolean;
  finishLibraryFile(meta: string): boolean;
  abortLibraryFile(): void;
  setting(key: string): string;
  setSetting(key: string, value: string): boolean;
  activities(): string;
  addActivity(data: string): boolean;
  clearActivities(): void;
  canShareFile(mime: string): boolean;
  beginExport(name: string, type: string, share: boolean): boolean;
  appendChunk(base64: string): boolean;
  finishExport(): void;
  abortExport(): void;
}
declare global {
  interface Window {
    PdfNative?: NativeBridge;
    studioBack?: () => boolean;
  }
}
let database: Promise<IDBDatabase> | undefined;
function db() {
  if (!database)
    database = new Promise((resolve, reject) => {
      const r = indexedDB.open('pdf-reducer-workspace', 2);
      r.onupgradeneeded = () => {
        for (const name of ['activity', 'library'])
          if (!r.result.objectStoreNames.contains(name))
            r.result.createObjectStore(name, { keyPath: 'id' });
        if (!r.result.objectStoreNames.contains('files')) r.result.createObjectStore('files');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(Error('Activity storage is unavailable.'));
    });
  return database;
}
async function op<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = d.transaction('activity', mode);
    const req = fn(tx.objectStore('activity'));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = tx.onabort = () => reject(Error('Local activity storage could not be updated.'));
  });
}
export async function listActivities(): Promise<Activity[]> {
  const arr = window.PdfNative
    ? (JSON.parse(window.PdfNative.activities()) as Activity[])
    : await op<Activity[]>('readonly', (s) => s.getAll());
  return arr.sort((a, b) => b.at - a.at);
}
export async function saveActivity(a: Activity) {
  if (window.PdfNative) {
    if (!window.PdfNative.addActivity(JSON.stringify(a))) throw Error('Activity storage is full.');
  } else await op('readwrite', (s) => s.put(a));
}
export async function clearActivities() {
  if (window.PdfNative) window.PdfNative.clearActivities();
  else await op('readwrite', (s) => s.clear());
}
export function preference(key: string, fallback: string) {
  try {
    return window.PdfNative?.setting?.(key) || localStorage.getItem('studio-' + key) || fallback;
  } catch {
    return fallback;
  }
}
export function setPreference(key: string, v: string) {
  try {
    if (window.PdfNative?.setSetting) {
      if (!window.PdfNative.setSetting(key, v)) throw Error('Settings unavailable');
    } else localStorage.setItem('studio-' + key, v);
  } catch {
    /* Private browsing may disable preferences. */
  }
}
export async function exportOutput(out: Output, share = false) {
  const native = window.PdfNative;
  if (native) {
    if (!native.beginExport(out.name, out.blob.type, share))
      throw Error('Finish the current export before starting another.');
    try {
      for (let i = 0; i < out.blob.size; i += 48 * 1024) {
        const bytes = new Uint8Array(await out.blob.slice(i, i + 48 * 1024).arrayBuffer());
        if (!native.appendChunk(btoa(String.fromCharCode(...bytes))))
          throw Error('Not enough temporary storage for this export.');
      }
      native.finishExport();
    } catch (e) {
      native.abortExport();
      throw e;
    }
    return;
  }
  if (share) {
    const f = new File([out.blob], out.name, { type: out.blob.type });
    if (!navigator.canShare?.({ files: [f] }))
      throw Error(
        'File sharing is not supported by this browser. Download the file and share it from your device.',
      );
    await navigator.share({ files: [f], title: out.name });
    return;
  }
  const url = URL.createObjectURL(out.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = out.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export async function libraryRecords(): Promise<LibraryMeta[]> {
  if (window.PdfNative?.libraryRecords) return JSON.parse(window.PdfNative.libraryRecords());
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction('library').objectStore('library').getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function putDocument(record: LibraryMeta, bytes?: Blob) {
  const n = window.PdfNative;
  if (n?.saveLibraryRecord) {
    if (bytes) {
      if (!n.beginLibraryFile(record.id)) throw Error('Could not reserve private storage.');
      try {
        for (let i = 0; i < bytes.size; i += 49152) {
          const b = new Uint8Array(await bytes.slice(i, i + 49152).arrayBuffer());
          if (!n.appendLibraryChunk(btoa(String.fromCharCode(...b))))
            throw Error('Private storage is full.');
        }
        if (!n.finishLibraryFile(JSON.stringify(record)))
          throw Error('Could not save the library document.');
      } catch (e) {
        n.abortLibraryFile();
        throw e;
      }
    } else if (!n.saveLibraryRecord(JSON.stringify(record)))
      throw Error('Could not update the library.');
    return;
  }
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const t = d.transaction(['library', 'files'], 'readwrite');
    t.objectStore('library').put(record);
    if (bytes) t.objectStore('files').put(bytes, record.id);
    t.oncomplete = () => resolve();
    t.onabort = t.onerror = () => reject(Error('Private storage is unavailable or full.'));
  });
}
export async function removeDocument(id: string) {
  if (window.PdfNative?.removeLibraryRecord) {
    if (!window.PdfNative.removeLibraryRecord(id)) throw Error('Could not remove the saved copy.');
    return;
  }
  const d = await db();
  await new Promise<void>((res, rej) => {
    const t = d.transaction(['library', 'files'], 'readwrite');
    t.objectStore('library').delete(id);
    t.objectStore('files').delete(id);
    t.oncomplete = () => res();
    t.onerror = t.onabort = () => rej(t.error);
  });
}
export async function savedFile(id: string): Promise<Blob> {
  if (window.PdfNative?.libraryRecords) {
    const res = await fetch(assetUrl('owned/' + encodeURIComponent(id) + '.pdf'));
    if (!res.ok) throw Error('Saved copy is missing. Import the original again.');
    return res.blob();
  }
  const d = await db();
  return new Promise((res, rej) => {
    const r = d.transaction('files').objectStore('files').get(id);
    r.onsuccess = () =>
      r.result instanceof Blob ? res(r.result) : rej(Error('Saved copy is missing.'));
    r.onerror = () => rej(r.error);
  });
}
export const canDeliverShare = (o: Output) =>
  window.PdfNative
    ? window.PdfNative.canShareFile(o.blob.type)
    : !!navigator.canShare?.({ files: [new File([o.blob], o.name, { type: o.blob.type })] });

// Read-modify-write individual fields so an opening timestamp or job receipt cannot undo a rename.
export type LibraryEdit = Partial<
  Pick<LibraryMeta, 'name' | 'category' | 'favorite' | 'lastRun' | 'opened'>
>;
export async function patchRecord(base: LibraryMeta, delta: LibraryEdit) {
  if (window.PdfNative) {
    if (!window.PdfNative.patchLibraryRecord(JSON.stringify(base), JSON.stringify(delta)))
      throw Error('Library record could not be updated.');
    return;
  }
  const d = await db();
  await new Promise<void>((res, rej) => {
    const t = d.transaction('library', 'readwrite'),
      store = t.objectStore('library'),
      r = store.get(base.id);
    r.onsuccess = () => {
      if (r.result?.removed || (!r.result && !base.sample)) {
        t.abort();
        return;
      }
      store.put({ ...(r.result ?? base), ...delta });
    };
    t.oncomplete = () => res();
    t.onerror = t.onabort = () => rej(Error('Library record could not be updated.'));
  });
}
