import type { Output } from './engine/types';
export interface Activity {
  id: string;
  name: string;
  operation: string;
  input: number;
  output: number;
  pages: number;
  at: number;
}
interface NativeBridge {
  activities(): string;
  addActivity(data: string): boolean;
  clearActivities(): void;
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
      const r = indexedDB.open('pdf-reducer-workspace', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('activity', { keyPath: 'id' });
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
    return localStorage.getItem('studio-' + key) ?? fallback;
  } catch {
    return fallback;
  }
}
export function setPreference(key: string, v: string) {
  try {
    localStorage.setItem('studio-' + key, v);
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
