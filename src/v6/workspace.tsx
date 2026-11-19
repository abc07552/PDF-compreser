import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { assetUrl } from '../assets';
import { runJob } from '../engine/client';
import {
  MAX_BATCH,
  MAX_FILES,
  stem,
  validateSelection,
  type Output,
  type Settings,
  type ToolId,
  type ToolOptions,
} from '../engine/types';
import {
  clearActivities,
  exportOutput,
  libraryRecords,
  listActivities,
  preference,
  putDocument,
  patchRecord,
  type LibraryEdit,
  removeDocument,
  saveActivity,
  savedFile,
  setPreference,
  type Activity,
} from '../storage';
import type { PreviewRequest } from '../components/Common';
import { archiveJob } from './archive-client';
import {
  classify,
  cleanPrefs,
  initialPrefs,
  MAX_DOCS,
  MAX_LIBRARY_BYTES,
  meta,
  textLayer,
  type DocumentItem,
  type Edition,
  type LibraryMeta,
  type Preferences,
  type Route,
} from './types';
const getPrefs = () => {
  try {
    const raw = preference('ultra-prefs', '');
    return raw
      ? cleanPrefs(JSON.parse(raw))
      : {
          ...structuredClone(initialPrefs),
          theme: preference('theme', 'dark') === 'light' ? ('light' as const) : ('dark' as const),
          remember: preference('remember', 'yes') === 'yes',
        };
  } catch {
    return structuredClone(initialPrefs);
  }
};
const getRoute = (): Route => {
  const h = location.hash.replace(/^#\/?/, '');
  return (
    ({ studio: 'compress', insights: 'analytics', toolbox: 'tools' } as Record<string, Route>)[h] ||
    (['home', 'compress', 'tools', 'history', 'analytics', 'settings'].includes(h)
      ? (h as Route)
      : 'home')
  );
};
const getEdition = (): Edition =>
  matchMedia('(min-width: 74em) and (min-height: 31em)').matches
    ? 'desktop'
    : matchMedia('(min-width: 44em)').matches
      ? 'tablet'
      : 'mobile';
type JobState = {
  label: string;
  n: number;
  name?: string;
  index?: number;
  count?: number;
  original?: number;
  candidate?: number;
};
type ModalName = 'manage' | 'delete' | 'clear' | 'privacy' | 'restore' | 'editor' | null;
function useWorkspaceModel() {
  const [docs, setDocs] = useState<DocumentItem[]>([]),
    [id, setId] = useState('seed-alpine'),
    [ready, setReady] = useState(false),
    [prefs, setPrefs] = useState<Preferences>(getPrefs),
    [acts, setActs] = useState<Activity[]>([]),
    [route, setRoute] = useState<Route>(getRoute),
    [edition, setEdition] = useState<Edition>(getEdition),
    [job, setJob] = useState<JobState | null>(null),
    [toast, setToast] = useState(''),
    [error, setError] = useState(''),
    [modal, setModal] = useState<ModalName>(null),
    [preview, setPreview] = useState<PreviewRequest | null>(null),
    [tool, setTool] = useState<ToolId | null>(null),
    [detail, setDetail] = useState<Activity | null>(null),
    [batch, setBatch] = useState(false),
    [checked, setChecked] = useState<string[]>([]),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(1),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState('Newest first'),
    [filter, setFilter] = useState('All files'),
    [category, setCategory] = useState('All categories'),
    [showFilter, setShowFilter] = useState(false),
    [thumbs, setThumbs] = useState(false),
    [advanced, setAdvanced] = useState(false),
    [panelWidth, setPanelWidth] = useState(0);
  const active = useRef<AbortController | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    ref = useRef(docs),
    pr = useRef(prefs);
  ref.current = docs;
  pr.current = prefs;
  const selected = docs.find((d) => d.id === id),
    notify = useCallback((s: string) => {
      clearTimeout(timer.current);
      setToast(s);
      timer.current = setTimeout(() => setToast(''), 6500);
    }, []);
  const patch = useCallback(
    (key: string, v: Partial<DocumentItem>) =>
      setDocs((ds) => ds.map((d) => (d.id === key ? { ...d, ...v } : d))),
    [],
  );
  useEffect(() => {
    let live = true;
    (async () => {
      let seeds: LibraryMeta[] = [];
      try {
        const r = await fetch(assetUrl('library/catalog.json'));
        if (r.ok) seeds = await r.json();
        else throw Error();
      } catch {
        if (live) notify('Starter collection is unavailable. You can still import PDFs.');
      }
      const [records, history] = await Promise.all([
        libraryRecords().catch(() => {
          if (live) notify('Library storage unavailable. Use session-only imports.');
          return [] as LibraryMeta[];
        }),
        listActivities().catch(() => []),
      ]);
      const all = new Map(seeds.map((s) => [s.id, s]));
      for (const r of records) {
        if (r.removed) all.delete(r.id);
        else if (!r.sample || all.has(r.id))
          all.set(
            r.id,
            r.sample
              ? {
                  ...all.get(r.id)!,
                  name: r.name,
                  category: r.category,
                  favorite: r.favorite,
                  lastRun: r.lastRun,
                  opened: r.opened,
                }
              : r,
          );
      }
      if (!live) return;
      const d = [...all.values()].sort((a, b) => b.created - a.created);
      setDocs(d);
      setActs(history);
      setId(all.has(preference('selected', '')) ? preference('selected', '') : d[0]?.id || '');
      setReady(true);
    })().catch((e) => {
      if (live) {
        setError(e.message);
        setReady(true);
      }
    });
    const update = () => setEdition(getEdition());
    const change = () => {
      setRoute(getRoute());
      window.scrollTo(0, 0);
    };
    const exported = (e: Event) => notify((e as CustomEvent<string>).detail);
    window.addEventListener('resize', update);
    window.addEventListener('hashchange', change);
    window.addEventListener('native-export-message', exported);
    return () => {
      live = false;
      active.current?.abort();
      clearTimeout(timer.current);
      window.removeEventListener('resize', update);
      window.removeEventListener('hashchange', change);
      window.removeEventListener('native-export-message', exported);
    };
  }, [notify]);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    setPreference('ultra-prefs', JSON.stringify(prefs));
  }, [prefs]);
  const pref = (v: Partial<Preferences>) => setPrefs((p) => ({ ...p, ...v }));
  const settings = (v: Partial<Settings>) =>
    setPrefs((p) => ({ ...p, settings: { ...p.settings, ...v } }));
  const go = (r: Route) => {
    location.hash = '/' + r;
    setRoute(r);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const fileOf = useCallback(async (d: DocumentItem) => {
    if (d.file)
      return d.file.name === d.name
        ? d.file
        : new File([d.file], d.name, { type: 'application/pdf' });
    let b: Blob;
    if (d.sample) {
      const res = await fetch(assetUrl(`library/${d.sample}.pdf`));
      if (!res.ok) throw Error('Starter document is unavailable.');
      b = await res.blob();
    } else b = await savedFile(d.id);
    if (b.size !== d.size) throw Error('The saved document size does not match its record.');
    return new File([b], d.name, { type: 'application/pdf' });
  }, []);
  useEffect(() => {
    if (!selected || selected.file) return;
    let live = true;
    fileOf(selected)
      .then((file) => {
        if (live) patch(id, { file });
      })
      .catch((e) => {
        if (live) patch(id, { error: e.message });
      });
    return () => {
      live = false;
    };
  }, [id, selected?.file, ready, fileOf, patch]);
  useEffect(() => {
    if (!advanced || job || !selected?.file || selected.analysis || selected.error) return;
    const a = new AbortController();
    runJob({ type: 'analyze', file: selected.file }, a.signal)
      .then((analysis) => {
        if (!a.signal.aborted) patch(id, { analysis });
      })
      .catch((e) => {
        if (!a.signal.aborted) patch(id, { error: e.message });
      });
    return () => a.abort();
  }, [advanced, !!job, id, selected?.file, selected?.analysis, selected?.error, patch]);
  const select = (d: DocumentItem) => {
    if (id !== d.id) {
      setId(d.id);
      setPage(1);
      setZoom(1);
      setThumbs(false);
    }
    if (d.saved || d.sample) setPreference('selected', d.id);
    const opened = Date.now();
    patch(d.id, { opened });
    if ((d.saved || d.sample) && pr.current.remember)
      void patchRecord(meta(d), { opened }).catch(() => notify('Recent order could not be saved.'));
  };
  const selectBatch = (k: string) =>
    setChecked((ids) =>
      ids.includes(k)
        ? ids.filter((i) => i !== k)
        : ids.length < MAX_FILES
          ? [...ids, k]
          : (notify('Select up to 16 PDFs for a batch.'), ids),
    );
  const record = useCallback(
    (a: Activity) => {
      if (!pr.current.remember) return;
      setActs((all) => [a, ...all.filter((x) => x.id !== a.id)]);
      saveActivity(a).catch(() => notify('Activity could not be saved on this device.'));
    },
    [notify],
  );
  const guard = async (label: string, fn: (a: AbortController) => Promise<void>) => {
    if (active.current) {
      notify('Finish or cancel the current job first.');
      return;
    }
    const a = new AbortController();
    active.current = a;
    setJob({ label, n: 0 });
    setError('');
    try {
      await fn(a);
    } catch (e) {
      if (a.signal.aborted) notify('Cancelled. Your originals are unchanged.');
      else setError((e as Error).message || 'The operation could not finish.');
    } finally {
      active.current = null;
      setJob(null);
    }
  };
  function capacity(files: { size: number }[]) {
    if (
      ref.current.length + files.length > MAX_DOCS ||
      ref.current.reduce((s, d) => s + d.size + (d.out?.blob.size || 0), 0) +
        files.reduce((s, d) => s + d.size, 0) >
        MAX_LIBRARY_BYTES
    )
      throw Error(
        'Library limit reached (64 documents or 256 MB). Remove copies you no longer need.',
      );
  }
  const createDoc = async (file: File, a: AbortController): Promise<DocumentItem> => {
    validateSelection([file]);
    const info = await runJob({ type: 'analyze', file }, a.signal);
    return {
      id: crypto.randomUUID(),
      name: stem(file.name) + '.pdf',
      size: file.size,
      pages: info.pages,
      layer: textLayer(info),
      category: classify(file.name, info),
      favorite: false,
      created: Date.now(),
      saved: pr.current.keep,
      file,
      analysis: info,
    };
  };
  const insert = async (items: DocumentItem[], a: AbortController) => {
    const stored: string[] = [];
    try {
      for (const d of items) {
        a.signal.throwIfAborted();
        if (d.saved) {
          await putDocument(meta(d), d.file);
          stored.push(d.id);
        }
      }
      a.signal.throwIfAborted();
    } catch (e) {
      await Promise.all(stored.map(removeDocument));
      throw e;
    }
    setDocs((all) => [...items, ...all]);
    if (items.length) {
      select(items[0]);
      setQuery('');
      setFilter('All files');
      setCategory('All categories');
      if (items.length > 1 && items.length <= MAX_FILES) {
        setBatch(true);
        setChecked(items.map((x) => x.id));
      } else {
        setBatch(false);
        setChecked([]);
      }
    }
  };
  const importFiles = (files: File[]) =>
    guard('Inspecting documents', async (a) => {
      if (!ready)
        throw Error('The local library is still opening. Try the import again in a moment.');
      validateSelection(files);
      capacity(files);
      const items = [];
      for (const [i, f] of files.entries()) {
        setJob({ n: Math.round((i / files.length) * 100), label: 'Inspecting PDF', name: f.name });
        items.push(await createDoc(f, a));
      }
      await insert(items, a);
      notify(
        `${items.length} ${items.length === 1 ? 'document' : 'documents'} added ${pr.current.keep ? 'to private storage' : 'for this session'}.`,
      );
      if (getEdition() === 'mobile') go('compress');
    });
  const run = () =>
    guard('Preparing compression', async (a) => {
      const list = batch
        ? checked
            .map((k) => ref.current.find((d) => d.id === k))
            .filter((x): x is DocumentItem => !!x)
        : selected
          ? [selected]
          : [];
      if (!list.length) throw Error('Select at least one document.');
      if (list.length > MAX_FILES || list.reduce((s, d) => s + d.size, 0) > MAX_BATCH)
        throw Error('Select up to 16 files and 128 MB per batch.');
      const s = { ...prefs.settings };
      const budget = ref.current.reduce(
        (n, d) => n + d.size + (!list.includes(d) ? d.out?.blob.size || 0 : 0),
        0,
      );
      let resultBytes = 0;
      for (const [i, d] of list.entries()) {
        a.signal.throwIfAborted();
        const progress = (n: number, label: string, candidate?: number) =>
          setJob({
            label,
            n: Math.round((i * 100 + n) / list.length),
            name: d.name,
            index: i + 1,
            count: list.length,
            original: d.size,
            candidate,
          });
        progress(0, 'Reading source PDF');
        patch(d.id, { out: undefined, error: undefined });
        const entry = {
          id: crypto.randomUUID(),
          name: d.name,
          operation: 'Compress PDF',
          input: d.size,
          pages: d.pages,
          profile: s.preset,
        };
        try {
          const f = await fileOf(d);
          const out = await runJob({ type: 'compress', file: f, settings: s }, a.signal, progress);
          if (budget + resultBytes + out.blob.size > MAX_LIBRARY_BYTES)
            throw Error(
              'Not enough session space for this result. Remove unused copies and retry.',
            );
          resultBytes += out.blob.size;
          const at = Date.now();
          patch(d.id, { file: f, out, lastRun: pr.current.remember ? at : d.lastRun });
          if ((d.saved || d.sample) && pr.current.remember)
            await patchRecord(meta(d), { lastRun: at }).catch(() =>
              notify('Result ready; library status could not be saved.'),
            );
          record({ ...entry, at, output: out.blob.size, status: 'success' });
        } catch (e) {
          record({
            ...entry,
            at: Date.now(),
            output: 0,
            status: a.signal.aborted ? 'cancelled' : 'failed',
          });
          if (a.signal.aborted) throw e;
          patch(d.id, { error: (e as Error).message });
          setError(`${d.name}: ${(e as Error).message}`);
        }
      }
    });
  const updateDoc = async (d: DocumentItem, v: LibraryEdit) => {
    try {
      if (d.saved || d.sample) await patchRecord(meta(d), v);
      patch(d.id, v);
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  };
  const manage = (d: DocumentItem) => {
    select(d);
    setModal('manage');
  };
  const erase = () =>
    guard('Removing library copy', async () => {
      if (!selected) return;
      const d = selected;
      if (d.sample) await putDocument({ ...meta(d), removed: true });
      else if (d.saved) await removeDocument(d.id);
      setDocs((all) => all.filter((s) => s.id !== d.id));
      setChecked((c) => c.filter((k) => k !== d.id));
      const next = docs.find((s) => s.id !== d.id);
      if (next) select(next);
      else setId('');
      setModal(null);
      notify('Removed from the library. The source file was not changed.');
    });
  const copy = () =>
    guard('Creating a copy', async (a) => {
      if (!selected) return;
      capacity([selected]);
      const f = await fileOf(selected);
      const d = {
        ...selected,
        id: crypto.randomUUID(),
        name: stem(selected.name) + ' (copy).pdf',
        file: f,
        saved: prefs.keep,
        sample: undefined,
        favorite: false,
        out: undefined,
        lastRun: undefined,
        created: Date.now(),
      };
      await insert([d], a);
      setModal(null);
      notify('Created a separate library copy.');
    });
  const retain = () =>
    guard('Saving private copy', async () => {
      if (!selected || selected.sample) return;
      const d = selected;
      if (d.saved) {
        const file = await fileOf(d);
        await removeDocument(d.id);
        patch(d.id, { file, saved: false });
      } else {
        await putDocument({ ...meta(d), saved: true }, await fileOf(d));
        patch(d.id, { saved: true });
      }
      notify(
        d.saved
          ? 'Removed from private storage; open for this session.'
          : 'Copy saved privately on this device.',
      );
    });
  const deliver = async (out: Output, share = false) => {
    try {
      await exportOutput(out, share);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') notify((e as Error).message);
    }
  };
  const exportZip = () =>
    guard('Packaging completed results', async (a) => {
      const out = docs.filter((d) => checked.includes(d.id) && d.out).map((d) => d.out!);
      await exportOutput(await archiveJob({ type: 'results', outputs: out }, a.signal));
    });
  const makeBackup = () =>
    guard('Preparing personal backup', async (a) => {
      const items = [];
      for (const d of docs.filter((d) => !d.sample)) {
        a.signal.throwIfAborted();
        items.push({ meta: meta(d), data: await fileOf(d) });
      }
      const o = await archiveJob({ type: 'backup', args: [items, prefs, acts] }, a.signal);
      a.signal.throwIfAborted();
      await exportOutput(o);
    });
  const restore = (f: File) =>
    guard('Validating backup', async (a) => {
      const b = await archiveJob({ type: 'restore', file: f }, a.signal);
      capacity(b.items.map((i) => i.file));
      const items = [];
      for (const [n, i] of b.items.entries()) {
        setJob({
          n: Math.round((n / b.items.length) * 95),
          label: 'Validating backup PDF',
          name: i.file.name,
        });
        const d = await createDoc(i.file, a);
        items.push({ ...d, category: i.category, favorite: i.favorite });
      }
      await insert(items, a);
      if (pr.current.remember) {
        const known = new Set(acts.map((x) => x.id));
        for (const row of b.history)
          if (!known.has(row.id)) {
            await saveActivity(row);
            known.add(row.id);
          }
        setActs(await listActivities());
      }
      pref({ ...b.prefs, keep: prefs.keep, remember: prefs.remember });
      setModal(null);
      notify(`Restored ${items.length} new copies. Existing documents were not replaced.`);
    });
  const editPages = (mode: 'extract' | 'organize', options: ToolOptions) =>
    guard('Preparing edited copy', async (a) => {
      if (!selected) return;
      const f = await fileOf(selected);
      const out = await runJob(
        { type: 'tool', tool: mode, files: [f], options },
        a.signal,
        (n, label) => setJob({ n, label }),
      );
      capacity([out.blob]);
      const d = await createDoc(new File([out.blob], out.name, { type: 'application/pdf' }), a);
      d.category = selected.category;
      await insert([d], a);
      record({
        id: crypto.randomUUID(),
        name: d.name,
        operation: mode === 'extract' ? 'Extract pages' : 'Organize pages',
        pages: d.pages,
        input: f.size,
        output: d.size,
        at: Date.now(),
      });
      setModal(null);
      notify('Edited copy added. Your original is unchanged.');
    });
  const openTool = (t: ToolId) => {
    if (active.current) {
      notify('Finish or cancel the current job first.');
      return;
    }
    if (t === 'compress') go('compress');
    else setTool(t);
  };
  const view = async (after = false) => {
    if (!selected) return;
    try {
      setPreview({
        file: await fileOf(selected),
        name: selected.name,
        after: after ? selected.out : undefined,
        page,
      });
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const clear = async () => {
    try {
      await clearActivities();
      setActs([]);
      setModal(null);
      notify('Local activity cleared.');
    } catch (e) {
      notify((e as Error).message);
    }
  };
  useEffect(() => {
    window.studioBack = () => {
      if (preview) setPreview(null);
      else if (tool) setTool(null);
      else if (detail) setDetail(null);
      else if (modal) setModal(null);
      else if (route !== 'home') go('home');
      else return false;
      return true;
    };
    return () => {
      delete window.studioBack;
    };
  }, [preview, tool, detail, modal, route]);
  return {
    ready,
    docs,
    selected,
    select,
    id,
    edition,
    route,
    go,
    prefs,
    pref,
    settings,
    acts,
    record,
    job,
    cancel: () => active.current?.abort(),
    toast,
    notify,
    setToast,
    error,
    setError,
    modal,
    setModal,
    preview,
    setPreview,
    view,
    tool,
    setTool,
    openTool,
    detail,
    setDetail,
    batch,
    setBatch,
    checked,
    setChecked,
    selectBatch,
    page,
    setPage,
    zoom,
    setZoom,
    query,
    setQuery,
    sort,
    setSort,
    filter,
    setFilter,
    category,
    setCategory,
    showFilter,
    setShowFilter,
    thumbs,
    setThumbs,
    advanced,
    setAdvanced,
    panelWidth,
    setPanelWidth,
    importFiles,
    run,
    updateDoc,
    setCover: (key: string, cover: string) => patch(key, { cover }),
    manage,
    erase,
    copy,
    retain,
    fileOf,
    deliver,
    exportZip,
    makeBackup,
    restore,
    editPages,
    clear,
    pick: () => document.getElementById('library-picker')?.click(),
  };
}
const C = createContext<ReturnType<typeof useWorkspaceModel> | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  return <C.Provider value={useWorkspaceModel()}>{children}</C.Provider>;
}
export const useWorkspace = () => useContext(C)!;
