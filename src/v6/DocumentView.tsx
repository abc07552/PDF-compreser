import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowDownToLine,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Grid2X2,
  Layers,
  Maximize2,
  Minus,
  MoreHorizontal,
  PanelLeftOpen,
  Plus,
  ScanText,
  SquareDashed,
} from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { openForViewing, renderPage } from '../engine/render';
import { formatBytes } from '../engine/types';
import { assetUrl } from '../assets';
import { useWorkspace } from './workspace';
import { Head, IconButton } from './ui';
export function usePdf(file?: Blob) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    setDoc(null);
    setError('');
    if (!file) return;
    const a = new AbortController();
    let pdf: PDFDocumentProxy | undefined;
    openForViewing(file, a.signal)
      .then((d) => {
        pdf = d;
        if (a.signal.aborted) void d.destroy();
        else setDoc(d);
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => {
      a.abort();
      if (pdf) void pdf.destroy();
    };
  }, [file]);
  return { doc, error };
}
export function PageCanvas({
  doc,
  page,
  small = false,
  onReady,
}: {
  doc: PDFDocumentProxy;
  page: number;
  small?: boolean;
  onReady?: (c: HTMLCanvasElement) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    cb = useRef(onReady),
    [error, setError] = useState('');
  cb.current = onReady;
  useEffect(() => {
    if (!ref.current) return;
    const a = new AbortController();
    setError('');
    renderPage(doc, page, ref.current, small ? 0.28 : 1.65, a.signal)
      .then(() => {
        if (!a.signal.aborted && ref.current) cb.current?.(ref.current);
      })
      .catch((e) => {
        if (!a.signal.aborted) setError(e.message);
      });
    return () => a.abort();
  }, [doc, page, small]);
  return error ? (
    <small role="alert">{error}</small>
  ) : (
    <canvas
      className={small ? 'mini-page' : 'main-page'}
      ref={ref}
      aria-label={`Page ${page} ${small ? 'thumbnail' : 'preview'}`}
    />
  );
}
export function DocumentView() {
  const w = useWorkspace(),
    d = w.selected,
    { doc, error } = usePdf(d?.file),
    [drag, setDrag] = useState(false);
  const prev = () => w.setPage(Math.max(1, w.page - 1)),
    next = () => w.setPage(Math.min(d?.pages || 1, w.page + 1));
  return (
    <section className="v-panel preview-panel" aria-label="Document preview panel">
      <Head
        icon={Eye}
        title="Document preview"
        end={
          <span className="micro-pill">
            <span className="live-dot" />
            {doc ? 'LIVE PREVIEW' : 'SOURCE VIEW'}
          </span>
        }
      />
      {d ? (
        <>
          <div className="preview-file">
            <span className="file-badge">
              <FileText size={18} />
            </span>
            <div>
              <b>{d.name}</b>
              <small>
                {d.sample ? 'Bundled example' : 'Original document'} <i /> {formatBytes(d.size)}
              </small>
            </div>
            <IconButton
              icon={MoreHorizontal}
              label="Document actions"
              onClick={() => w.manage(d)}
            />
          </div>
          <div
            className={'paper-stage ' + (drag ? 'dragging' : '')}
            tabIndex={0}
            aria-label="Preview canvas. Use left and right arrows to turn pages."
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                next();
              }
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prev();
              }
            }}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes('Files')) {
                e.preventDefault();
                setDrag(true);
              }
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void w.importFiles([...e.dataTransfer.files]);
            }}
          >
            <span className="stage-index">FIG. {String(w.page).padStart(2, '0')}</span>
            <div className="stage-scroll">
              <div className="paper-holder" style={{ '--zoom': w.zoom } as CSSProperties}>
                {error || (d.error && !d.file) ? (
                  <span role="alert">{error || d.error}</span>
                ) : doc ? (
                  <PageCanvas
                    key={`${d.id}:${w.page}`}
                    doc={doc}
                    page={w.page}
                    onReady={(c) => {
                      if (!d.sample && !d.cover && w.page === 1) {
                        const t = document.createElement('canvas');
                        t.height = 104;
                        t.width = Math.max(1, Math.round((104 * c.width) / c.height));
                        if (t.width <= 240) {
                          t.getContext('2d')?.drawImage(c, 0, 0, t.width, t.height);
                          w.setCover(d.id, t.toDataURL('image/webp', 0.7));
                        }
                      }
                    }}
                  />
                ) : d.sample && w.page === 1 ? (
                  <img
                    className="loading-cover"
                    src={assetUrl(`library/${d.sample}.webp`)}
                    alt="Loading document cover"
                  />
                ) : (
                  <span className="v-muted">Rendering page…</span>
                )}
              </div>
            </div>
            {drag && (
              <div className="drop-overlay">
                <ArrowDownToLine /> Drop to import
              </div>
            )}
          </div>
          <div className="page-controls">
            <div>
              <IconButton
                icon={ChevronLeft}
                label="Previous source page"
                disabled={w.page <= 1}
                onClick={prev}
              />
              <span>
                <b>{w.page}</b>
                <i>/</i>
                {d.pages}
              </span>
              <IconButton
                icon={ChevronRight}
                label="Next source page"
                disabled={w.page >= d.pages}
                onClick={next}
              />
            </div>
            <div>
              <IconButton
                icon={Minus}
                label="Reduce preview zoom"
                disabled={w.zoom <= 0.5}
                onClick={() => w.setZoom(w.zoom - 0.25)}
              />
              <span>{Math.round(w.zoom * 100)}%</span>
              <IconButton
                icon={Plus}
                label="Increase preview zoom"
                disabled={w.zoom >= 2.5}
                onClick={() => w.setZoom(w.zoom + 0.25)}
              />
              <em />
              <IconButton
                icon={Maximize2}
                label="Full-screen preview"
                onClick={() => void w.view()}
              />
            </div>
          </div>
          <div className="preview-tools">
            <button onClick={() => w.setThumbs(!w.thumbs)} aria-expanded={w.thumbs}>
              <PanelLeftOpen size={14} />
              Thumbnails
            </button>
            <button onClick={() => w.setModal('editor')} disabled={!d.file || !!w.job}>
              <Grid2X2 size={14} />
              Organize pages
            </button>
          </div>
          {w.thumbs && doc && (
            <div className="thumbnail-strip">
              {Array.from(
                { length: Math.min(d.pages, 7) },
                (_, i) => Math.min(Math.max(1, w.page - 3), Math.max(1, d.pages - 6)) + i,
              ).map((n) => (
                <button key={n} className={n === w.page ? 'on' : ''} onClick={() => w.setPage(n)}>
                  <PageCanvas small doc={doc} page={n} />
                  <span>{n}</span>
                </button>
              ))}
            </div>
          )}
          <div className="preview-meta">
            <span>
              <Layers size={13} />
              {d.pages} pages
            </span>
            <span>
              <ScanText size={13} />
              {d.layer}
            </span>
            <span>
              <Check size={12} />
              {d.out ? 'Compressed' : 'Original PDF'}
            </span>
          </div>
        </>
      ) : (
        <div className="v-empty">
          <SquareDashed size={30} />
          <b>Select a document</b>
          <small>Import a PDF to preview its pages.</small>
        </div>
      )}
    </section>
  );
}
