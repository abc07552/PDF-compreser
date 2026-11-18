import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, Minus, Plus } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { openForViewing, renderPage } from '../engine/render';
import { formatBytes } from '../engine/types';
import { Modal, Notice, type PreviewRequest } from './Common';
function Sheet({
  blob,
  page,
  zoom,
  onCount,
}: {
  blob: Blob;
  page: number;
  zoom: number;
  onCount: (n: number) => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const a = new AbortController();
    let d: PDFDocumentProxy | undefined;
    setDoc(null);
    setBusy(true);
    setError('');
    openForViewing(blob, a.signal)
      .then((result) => {
        d = result;
        if (a.signal.aborted) void d.destroy();
        else {
          setDoc(d);
          onCount(d.numPages);
        }
      })
      .catch((e) => {
        if (!a.signal.aborted) {
          setError(e.message);
          setBusy(false);
        }
      });
    return () => {
      a.abort();
      if (d) void d.destroy();
    };
  }, [blob, onCount]);
  useEffect(() => {
    if (!doc || !canvas.current) return;
    const a = new AbortController();
    setBusy(true);
    renderPage(
      doc,
      page,
      canvas.current,
      Math.min(2.2, window.devicePixelRatio * 1.1) * zoom,
      a.signal,
    )
      .then(() => {
        if (!a.signal.aborted) setBusy(false);
      })
      .catch((e) => {
        if (!a.signal.aborted) {
          setError(e.message);
          setBusy(false);
        }
      });
    return () => a.abort();
  }, [doc, page, zoom]);
  return (
    <div className="sheet">
      {error ? (
        <Notice tone="error">{error}</Notice>
      ) : (
        <canvas
          ref={canvas}
          style={{ width: `${zoom * 100}%` }}
          aria-label={`Document preview, page ${page}`}
        />
      )}{' '}
      {busy && !error && (
        <span className="render-loading">
          <LoaderCircle className="spin" size={18} /> Rendering
        </span>
      )}
    </div>
  );
}
export default function Preview({ req, onClose }: { req: PreviewRequest; onClose: () => void }) {
  const [page, setPage] = useState(1),
    [count, setCount] = useState(1),
    [zoom, setZoom] = useState(1);
  return (
    <Modal
      title={req.after ? 'Before & after' : 'Document preview'}
      eyebrow={req.name}
      onClose={onClose}
      wide
    >
      <div className="preview-toolbar">
        <div>
          <button
            className="icon-button"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Page <b>{page}</b> of {count}
          </span>
          <button
            className="icon-button"
            aria-label="Next page"
            disabled={page >= count}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div>
          <button
            className="icon-button"
            disabled={zoom <= 0.75}
            aria-label="Zoom out"
            onClick={() => setZoom((v) => v - 0.25)}
          >
            <Minus size={15} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            className="icon-button"
            disabled={zoom >= 2}
            aria-label="Zoom in"
            onClick={() => setZoom((v) => v + 0.25)}
          >
            <Plus size={15} />
          </button>
        </div>
      </div>
      <div className={`preview-grid ${req.after ? 'double' : ''}`}>
        <div>
          <div className="preview-label">
            {req.after ? 'Original' : 'Document'} <b>{formatBytes(req.file.size)}</b>
          </div>
          <Sheet blob={req.file} page={page} zoom={zoom} onCount={setCount} />
        </div>
        {req.after && (
          <div>
            <div className="preview-label">
              Compressed <b>{formatBytes(req.after.blob.size)}</b>
            </div>
            <Sheet blob={req.after.blob} page={page} zoom={zoom} onCount={setCount} />
          </div>
        )}
      </div>
    </Modal>
  );
}
