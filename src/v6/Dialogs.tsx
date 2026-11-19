import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Check,
  Copy,
  Download,
  FileOutput,
  FolderPlus,
  GripVertical,
  RotateCw,
  Save,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
} from 'lucide-react';
import { Modal, Notice } from '../components/Common';
import { formatBytes, stem } from '../engine/types';
import { canDeliverShare } from '../storage';
import { categories, type Category } from './types';
import { useWorkspace } from './workspace';
import { PageCanvas, usePdf } from './DocumentView';
function Manage() {
  const w = useWorkspace(),
    d = w.selected!,
    [name, setName] = useState(d.name),
    [cat, setCat] = useState(d.category),
    [saving, setSaving] = useState(false);
  const out = d.file ? { blob: d.file, name: d.name, pages: d.pages } : null;
  return (
    <Modal title="Document actions" eyebrow="LIBRARY RECORD" onClose={() => w.setModal(null)}>
      <div className="modal-body management">
        <div className="document-facts">
          <b>
            {formatBytes(d.size)} · {d.pages} pages
          </b>
          <span>
            {d.layer} ·{' '}
            {d.sample ? 'Bundled example' : d.saved ? 'Saved on this device' : 'Session only'}
          </span>
          <span>
            {d.out
              ? 'Result ready for delivery'
              : d.lastRun
                ? `Last compressed ${new Date(d.lastRun).toLocaleDateString()}`
                : 'Not compressed yet'}
          </span>
        </div>
        <fieldset disabled={!!w.job || saving}>
          <label className="v-label">
            Document name
            <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="v-label">
            Category
            <select value={cat} onChange={(e) => setCat(e.target.value as Category)}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <button
            className="v-btn solid"
            disabled={!name.trim()}
            onClick={async () => {
              setSaving(true);
              const success = await w.updateDoc(d, {
                name: stem(name.trim()) + '.pdf',
                category: cat,
              });
              setSaving(false);
              if (success) w.setModal(null);
            }}
          >
            <Check size={15} />
            Apply changes
          </button>
          <div className="manage-links">
            <button onClick={() => void w.updateDoc(d, { favorite: !d.favorite })}>
              <Star size={16} fill={d.favorite ? 'currentColor' : 'none'} />
              {d.favorite ? 'Remove star' : 'Star document'}
            </button>
            <button onClick={() => void w.copy()}>
              <Copy size={16} />
              Make a copy
            </button>
            {out && (
              <button onClick={() => void w.deliver(out)}>
                <Download size={16} />
                Export original
              </button>
            )}
            {out && canDeliverShare(out) && (
              <button onClick={() => void w.deliver(out, true)}>
                <Share2 size={16} />
                Share original
              </button>
            )}
            {!d.sample && (
              <button onClick={() => void w.retain()}>
                <Save size={16} />
                {d.saved ? 'Forget saved copy' : 'Keep on this device'}
              </button>
            )}
            <button className="danger-text" onClick={() => w.setModal('delete')}>
              <Trash2 size={16} />
              Remove from library
            </button>
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
function Editor() {
  const w = useWorkspace(),
    d = w.selected!,
    { doc, error } = usePdf(d.file),
    [order, setOrder] = useState(() => Array.from({ length: d.pages }, (_, i) => i + 1)),
    [sel, setSel] = useState<number[]>([]),
    [rots, setRots] = useState<Record<number, number>>({}),
    [offset, setOffset] = useState(0);
  const move = (n: number, to: number) => {
    if (w.job) return;
    const at = order.indexOf(n);
    if (at < 0 || to < 0 || to >= order.length || to === at) return;
    const next = [...order];
    next.splice(at, 1);
    next.splice(to, 0, n);
    setOrder(next);
  };
  const shown = Math.min(offset, Math.floor((order.length - 1) / 12) * 12);
  return (
    <Modal title="Organize pages" eyebrow={d.name} wide onClose={() => w.setModal(null)}>
      <div className="modal-body v-editor">
        <p>
          Choose pages to rotate, remove or extract. Drag a thumbnail or use the arrows to change
          order. Edits create a new PDF.
        </p>
        <fieldset disabled={!!w.job}>
          <div className="editor-toolbar">
            <b>{sel.length} selected</b>
            <button
              className="v-btn"
              onClick={() => setSel(sel.length === order.length ? [] : [...order])}
            >
              {sel.length === order.length ? 'Clear selection' : 'Select all'}
            </button>
            <button
              className="v-btn"
              disabled={!sel.length}
              onClick={() =>
                setRots((r) =>
                  Object.fromEntries(
                    order.map((n) => [n, ((r[n] || 0) + (sel.includes(n) ? 90 : 0)) % 360]),
                  ),
                )
              }
            >
              <RotateCw size={14} />
              Rotate
            </button>
            <button
              className="v-btn"
              disabled={!sel.length || order.length === sel.length}
              onClick={() => {
                setOrder(order.filter((n) => !sel.includes(n)));
                setSel([]);
              }}
            >
              <Trash2 size={14} />
              Remove pages
            </button>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="editor-grid">
            {order.slice(shown, shown + 12).map((n, i) => (
              <div
                key={n}
                className={sel.includes(n) ? 'selected' : ''}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  move(Number(e.dataTransfer.getData('text/page')), shown + i);
                }}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/page', String(n))}
              >
                <label>
                  <input
                    type="checkbox"
                    checked={sel.includes(n)}
                    aria-label={`Select page ${n}`}
                    onChange={() =>
                      setSel((s) => (s.includes(n) ? s.filter((v) => v !== n) : [...s, n]))
                    }
                  />
                  <span style={{ transform: `rotate(${rots[n] || 0}deg)` }}>
                    {doc && <PageCanvas doc={doc} page={n} small />}
                  </span>
                </label>
                <div>
                  <GripVertical size={12} />
                  <b>Page {n}</b>
                  <small>{rots[n] || 0}°</small>
                </div>
                <footer>
                  <button
                    disabled={shown + i === 0}
                    aria-label={`Move page ${n} earlier`}
                    onClick={() => move(n, shown + i - 1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    disabled={shown + i === order.length - 1}
                    aria-label={`Move page ${n} later`}
                    onClick={() => move(n, shown + i + 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                </footer>
              </div>
            ))}
          </div>
          {order.length > 12 && (
            <div className="pagination">
              <button disabled={!shown} onClick={() => setOffset(shown - 12)}>
                Previous 12
              </button>
              <b>
                {shown + 1}–{Math.min(shown + 12, order.length)} of {order.length}
              </b>
              <button disabled={shown + 12 >= order.length} onClick={() => setOffset(shown + 12)}>
                Next 12
              </button>
            </div>
          )}
          <div className="v-actions">
            <button
              className="v-btn solid"
              onClick={() =>
                void w.editPages('organize', { range: order.join(','), rotations: rots })
              }
            >
              <Save size={15} />
              Save edited copy
            </button>
            <button
              className="v-btn"
              disabled={!sel.length}
              onClick={() =>
                void w.editPages('extract', {
                  range: order.filter((n) => sel.includes(n)).join(','),
                  rotations: rots,
                })
              }
            >
              <FileOutput size={15} />
              Extract selected
            </button>
          </div>
        </fieldset>
        {w.job && (
          <p role="status">
            {w.job.label} · {w.job.n}% <button onClick={w.cancel}>Cancel job</button>
          </p>
        )}
        {w.error && <Notice tone="error">{w.error}</Notice>}
      </div>
    </Modal>
  );
}
export function Dialogs() {
  const w = useWorkspace();
  if (w.modal === 'manage' && w.selected) return <Manage key={w.id} />;
  if (w.modal === 'editor' && w.selected) return <Editor key={w.id} />;
  if (w.modal === 'delete' || w.modal === 'clear')
    return (
      <Modal
        title={w.modal === 'delete' ? 'Remove document?' : 'Clear history?'}
        eyebrow="CONFIRM ACTION"
        onClose={() => w.setModal(null)}
      >
        <div className="modal-body v-dialog">
          <p>
            {w.modal === 'delete'
              ? `Remove “${w.selected?.name}” and its workspace copies? The original file outside this app is untouched.`
              : 'This permanently removes local activity and resets its analytics. Your library and original documents are not affected.'}
          </p>
          <div className="v-actions">
            <button className="v-btn" onClick={() => w.setModal(null)}>
              Cancel
            </button>
            <button
              className="v-btn danger"
              disabled={!!w.job}
              onClick={() => void (w.modal === 'clear' ? w.clear() : w.erase())}
            >
              <Trash2 size={15} />
              {w.modal === 'clear' ? 'Clear history' : 'Confirm remove'}
            </button>
          </div>
        </div>
      </Modal>
    );
  if (w.modal === 'restore')
    return (
      <Modal
        title="Restore a workspace backup"
        eyebrow="LOCAL FILES ONLY"
        onClose={() => w.setModal(null)}
      >
        <div className="modal-body v-dialog">
          <p>
            Choose a V6 backup ZIP. Personal PDFs will be validated and added as new copies.
            Compression settings are imported, but your current storage and history permissions stay
            in effect.
          </p>
          <p>
            {w.prefs.keep
              ? 'Restored copies will be kept on this device.'
              : 'Restored files are session-only unless you explicitly keep them.'}
          </p>
          <label className="v-btn solid file-restore">
            <FolderPlus size={16} />
            Choose backup ZIP
            <input
              type="file"
              aria-label="Choose backup ZIP"
              accept="application/zip,.zip"
              disabled={!!w.job}
              onChange={(e) => {
                if (e.target.files?.[0]) void w.restore(e.target.files[0]);
                e.target.value = '';
              }}
            />
          </label>
          {w.job && (
            <p>
              {w.job.label} <button onClick={w.cancel}>Cancel</button>
            </p>
          )}
          {w.error && <Notice tone="error">{w.error}</Notice>}
        </div>
      </Modal>
    );
  if (w.modal === 'privacy')
    return (
      <Modal title="Private by design" eyebrow="LOCAL ENGINE" onClose={() => w.setModal(null)}>
        <div className="modal-body v-dialog">
          <ShieldCheck className="ink-cyan" size={27} />
          <p>
            PDFs are inspected, rendered and optimized on this device. No account, remote AI or
            document upload is required. The six Northline documents are bundled examples, not your
            private files.
          </p>
          <p>
            Imported PDFs stay in this session unless you enable private storage. Results must be
            exported before closing. Local history records names and size statistics, not file
            contents.
          </p>
          <button
            className="v-btn"
            onClick={() => {
              w.setModal(null);
              w.go('settings');
            }}
          >
            Privacy settings <ArrowRight size={14} />
          </button>
        </div>
      </Modal>
    );
  return null;
}
