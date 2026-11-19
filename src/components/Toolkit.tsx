import { exportImages } from '../engine/render';
import type { DocumentItem } from '../v6/types';
import { useRef, useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  FileText,
  LoaderCircle,
  RotateCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { getTool, tools } from '../catalog';
import {
  formatBytes,
  validateSelection,
  type Output,
  type ToolId,
  type ToolOptions,
} from '../engine/types';
import { runJob } from '../engine/client';
import type { Activity } from '../storage';
import {
  DropArea,
  EmptyState,
  IconBox,
  Modal,
  Notice,
  OutputCard,
  PageHead,
  PrivateLine,
  ProgressBar,
  type PreviewRequest,
} from './Common';
export function Toolkit({ onTool }: { onTool: (t: ToolId) => void }) {
  const [group, setGroup] = useState('All tools'),
    [query, setQuery] = useState('');
  const matching = tools.filter(
    (t) =>
      (group === 'All tools' || t.group === group) &&
      `${t.label} ${t.desc}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="PDF toolbox"
        desc="Everything you need to work with PDFs, all on your device."
      />
      <div className="toolbox-controls">
        <div className="filter-tabs">
          {['All tools', 'Optimize', 'Organize', 'Convert', 'Security'].map((g) => (
            <button key={g} className={group === g ? 'active' : ''} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
        <label className="search-box">
          <Search size={15} />
          <input
            placeholder="Find a tool…"
            aria-label="Find a tool"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="tool-grid">
        {matching.map((t) => (
          <button className="tool-card" key={t.id} onClick={() => onTool(t.id)}>
            <div className="tool-top">
              <IconBox icon={t.icon} tone={t.color} />
              <ArrowRight size={16} />
            </div>
            <span className="tool-group">{t.group}</span>
            <h3>{t.label}</h3>
            <p>{t.desc}</p>
          </button>
        ))}
      </div>
      {!matching.length && (
        <EmptyState icon={Search} title="No tools found" desc="Try another search or category." />
      )}
    </>
  );
}
export function ToolDialog({
  id,
  onClose,
  onPreview,
  record,
  notify,
  library,
  getFile,
  selectedId,
}: {
  library: DocumentItem[];
  getFile: (d: DocumentItem) => Promise<File>;
  selectedId: string;
  id: ToolId;
  onClose: () => void;
  onPreview: (p: PreviewRequest) => void;
  record: (a: Activity) => void;
  notify: (s: string) => void;
}) {
  const t = getTool(id),
    multi = ['merge', 'from-images'].includes(id),
    images = id === 'from-images';
  const [files, setFiles] = useState<File[]>([]),
    [pages, setPages] = useState(0),
    [o, setO] = useState<ToolOptions>({
      group: 1,
      format: 'png',
      dpi: 150,
      opacity: 0.22,
      rotation: 0,
    }),
    [out, setOut] = useState<Output>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [prog, setProg] = useState({ n: 0, label: '' }),
    [order, setOrder] = useState<number[]>([]);
  const [libraryId, setLibraryId] = useState(selectedId || library[0]?.id || '');
  const ac = useRef<AbortController | null>(null);
  useEffect(() => () => ac.current?.abort(), []);
  const change = (v: Partial<ToolOptions>) => {
    setO((p) => ({ ...p, ...v }));
    setOut(undefined);
  };
  const select = async (added: File[]) => {
    if (ac.current || !added.length) return;
    setError('');
    const next = multi ? [...files, ...added] : added;
    try {
      if (!multi && added.length > 1) throw Error('Choose a single PDF for this tool.');
      validateSelection(next, images);
      setFiles(next);
      setOut(undefined);
      setPages(0);
      setOrder([]);
      if (!multi && id !== 'unlock') {
        const a = new AbortController();
        ac.current = a;
        setBusy(true);
        setProg({ n: 10, label: 'Reading page structure' });
        try {
          const info = await runJob({ type: 'analyze', file: next[0] }, a.signal);
          if (info.signed && !['preview', 'to-images'].includes(id))
            throw Error('Editing would invalidate this digital signature. Choose an unsigned PDF.');
          setPages(info.pages);
          setOrder(Array.from({ length: Math.min(info.pages, 60) }, (_, i) => i + 1));
          change({ range: '', rotations: {} });
        } finally {
          setBusy(false);
          ac.current = null;
        }
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const run = async () => {
    if (ac.current) return;
    if (!files.length) {
      document.getElementById('tool-picker')?.click();
      return;
    }
    setError('');
    if (id === 'preview') {
      onPreview({ file: files[0], name: files[0].name });
      return;
    }
    const a = new AbortController();
    ac.current = a;
    setBusy(true);
    setOut(undefined);
    const progress = (n: number, label: string) => setProg({ n, label });
    progress(1, 'Starting local worker');
    try {
      if (id === 'organize' && pages <= 60 && !order.length) throw Error('Keep at least one page.');
      const options = { ...o, range: id === 'organize' && pages <= 60 ? order.join(',') : o.range };
      const output =
        id === 'to-images'
          ? await exportImages(files[0], options, progress, a.signal)
          : await runJob({ type: 'tool', tool: id, files, options }, a.signal, progress);
      if (a.signal.aborted) return;
      setOut(output);
      record({
        id: crypto.randomUUID(),
        name: files.length > 1 ? `${files[0].name} +${files.length - 1}` : files[0].name,
        operation: t.label,
        input: files.reduce((n, f) => n + f.size, 0),
        output: output.blob.size,
        pages: output.pages,
        at: Date.now(),
      });
      setO((old) => ({ ...old, password: '' }));
    } catch (e) {
      record({
        id: crypto.randomUUID(),
        name: files[0]?.name || 'Document',
        operation: t.label,
        input: files.reduce((n, f) => n + f.size, 0),
        output: 0,
        pages,
        at: Date.now(),
        status: a.signal.aborted ? 'cancelled' : 'failed',
      });
      if (!a.signal.aborted) setError((e as Error).message);
      else setError('Processing cancelled. Your original is unchanged.');
    } finally {
      ac.current = null;
      setBusy(false);
    }
  };
  const move = <T,>(arr: T[], i: number, d: number) => {
    const n = [...arr];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    return n;
  };
  return (
    <Modal title={t.label} eyebrow="PDF TOOLBOX" onClose={onClose}>
      <div className="modal-body tool-dialog">
        <p className="dialog-desc">{t.desc}</p>
        <fieldset disabled={busy}>
          <DropArea
            onFiles={select}
            disabled={busy}
            images={images}
            compact={files.length > 0}
            inputId="tool-picker"
            multiple={multi}
          />
          {!images && library.length > 0 && (
            <div className="tool-library">
              <label className="v-label">
                From document library
                <select value={libraryId} onChange={(e) => setLibraryId(e.target.value)}>
                  {library.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="v-btn"
                onClick={async () => {
                  try {
                    const d = library.find((i) => i.id === libraryId);
                    if (d) await select([await getFile(d)]);
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Use document
              </button>
            </div>
          )}
          {files.length > 0 && (
            <div className="tool-files">
              {files.map((f, i) => (
                <div className="file-row" key={`${f.name}-${i}`}>
                  <span className="file-stamp">
                    <FileText size={17} />
                  </span>
                  <div className="file-name">
                    <b>{f.name}</b>
                    <small>
                      {formatBytes(f.size)}
                      {pages > 0 ? ` · ${pages} pages` : ''}
                    </small>
                  </div>
                  {multi && (
                    <>
                      <button
                        className="icon-button"
                        aria-label={`Move file ${i + 1} up`}
                        disabled={!i}
                        onClick={() => {
                          setFiles(move(files, i, -1));
                          setOut(undefined);
                        }}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Move file ${i + 1} down`}
                        disabled={i === files.length - 1}
                        onClick={() => {
                          setFiles(move(files, i, 1));
                          setOut(undefined);
                        }}
                      >
                        <ArrowDown size={14} />
                      </button>
                    </>
                  )}
                  <button
                    className="icon-button"
                    aria-label={`Remove file ${i + 1}`}
                    onClick={() => {
                      setFiles(files.filter((_, k) => k !== i));
                      setOut(undefined);
                      setPages(0);
                      setError('');
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {id === 'merge' && (
            <p className="field-hint">
              Choose at least two PDFs. Use the arrows to set their order.
            </p>
          )}
          {id === 'split' && (
            <label className="field">
              Pages per part
              <input
                type="number"
                min="1"
                max={pages || 1500}
                value={o.group ?? ''}
                onChange={(e) => change({ group: +e.target.value })}
              />
              <small>Each part is a separate PDF, bundled in a ZIP.</small>
            </label>
          )}
          {(id === 'extract' || id === 'to-images' || (id === 'organize' && pages > 60)) && (
            <label className="field">
              {id === 'organize' ? 'Page order' : 'Page range'}
              <input
                placeholder="All pages, or e.g. 1, 3-5"
                value={o.range || ''}
                onChange={(e) => change({ range: e.target.value })}
              />
              <small>Page numbers start at 1. A blank range includes every page.</small>
            </label>
          )}
          {id === 'organize' && pages > 0 && (
            <>
              <label className="field">
                Rotate all pages
                <select value={o.rotation} onChange={(e) => change({ rotation: +e.target.value })}>
                  {[0, 90, 180, 270].map((v) => (
                    <option key={v} value={v}>
                      {v === 0 ? 'Keep original orientation' : `${v}° clockwise`}
                    </option>
                  ))}
                </select>
              </label>
              {pages <= 60 && (
                <div className="organizer">
                  {order.map((n, i) => (
                    <div key={n}>
                      <b>Page {n}</b>
                      <span>{o.rotations?.[n] || 0}°</span>
                      <button
                        className="icon-button"
                        aria-label={`Move page ${n} earlier`}
                        disabled={!i}
                        onClick={() => {
                          setOrder(move(order, i, -1));
                          setOut(undefined);
                        }}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Move page ${n} later`}
                        disabled={i === order.length - 1}
                        onClick={() => {
                          setOrder(move(order, i, 1));
                          setOut(undefined);
                        }}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Rotate page ${n}`}
                        onClick={() =>
                          change({
                            rotations: {
                              ...o.rotations,
                              [n]: ((o.rotations?.[n] || 0) + 90) % 360,
                            },
                          })
                        }
                      >
                        <RotateCw size={14} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Exclude page ${n}`}
                        onClick={() => {
                          setOrder(order.filter((p) => p !== n));
                          setOut(undefined);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {id === 'to-images' && (
            <div className="two-fields">
              <label className="field">
                Image format
                <select
                  value={o.format}
                  onChange={(e) => change({ format: e.target.value as ToolOptions['format'] })}
                >
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="webp">WebP</option>
                </select>
              </label>
              <label className="field">
                Resolution
                <select value={o.dpi} onChange={(e) => change({ dpi: +e.target.value })}>
                  {[72, 96, 120, 150, 200, 300].map((n) => (
                    <option key={n} value={n}>
                      {n} DPI
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {(id === 'protect' || id === 'unlock') && (
            <>
              <label className="field">
                {id === 'protect' ? 'New password' : 'Document password'}
                <input
                  type="password"
                  autoComplete={id === 'protect' ? 'new-password' : 'off'}
                  maxLength={100}
                  placeholder={
                    id === 'protect' ? 'At least 8 characters' : 'Enter the correct password'
                  }
                  value={o.password || ''}
                  onChange={(e) => change({ password: e.target.value })}
                />
                <small>
                  {id === 'protect'
                    ? 'Store it safely. There is no password recovery.'
                    : 'Cannot recover forgotten passwords or bypass authorization.'}
                </small>
              </label>
              {id === 'unlock' && (
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={!!o.authorized}
                    onChange={(e) => change({ authorized: e.target.checked })}
                  />
                  I am authorized to remove this document’s protection.
                </label>
              )}
            </>
          )}
          {id === 'watermark' && (
            <>
              <label className="field">
                Watermark text
                <input
                  maxLength={80}
                  placeholder="e.g. CONFIDENTIAL"
                  value={o.text || ''}
                  onChange={(e) => change({ text: e.target.value })}
                />
              </label>
              <label className="field">
                Opacity <b>{Math.round((o.opacity || 0.22) * 100)}%</b>
                <input
                  type="range"
                  min="5"
                  max="90"
                  value={Math.round((o.opacity || 0.22) * 100)}
                  onChange={(e) => change({ opacity: +e.target.value / 100 })}
                />
              </label>
            </>
          )}
          {id === 'metadata' && (
            <Notice>
              Removes document properties and XMP metadata. This is not redaction: visible text,
              comments and attachments are not removed.
            </Notice>
          )}
          {id === 'from-images' && (
            <p className="field-hint">
              One image per A4 page, with automatic orientation and white margins. Maximum 16
              megapixels per image.
            </p>
          )}
        </fieldset>
        {error && <Notice tone="error">{error}</Notice>}
        {busy && (
          <ProgressBar value={prog.n} label={prog.label} onCancel={() => ac.current?.abort()} />
        )}{' '}
        {out && <OutputCard out={out} onPreview={onPreview} notify={notify} />}
        <button className="button primary tool-run" onClick={run} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <t.icon size={16} />} {t.action}
          <ArrowRight size={15} />
        </button>
        <div className="tool-privacy">
          <PrivateLine />
        </div>
      </div>
    </Modal>
  );
}
