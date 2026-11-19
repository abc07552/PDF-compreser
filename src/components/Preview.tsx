import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, Minus, Plus } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { openForViewing, renderPage } from '../engine/render';
import { formatBytes } from '../engine/types';
import { Modal, Notice, type PreviewRequest } from './Common';
interface Sample {
  page: number;
  pixels: Uint8ClampedArray;
  text: string;
  width: number;
  height: number;
}
async function sampleSheet(
  doc: PDFDocumentProxy,
  page: number,
  canvas: HTMLCanvasElement,
): Promise<Sample> {
  const p = await doc.getPage(page),
    v = p.getViewport({ scale: 1 });
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = Math.max(1, Math.min(192, Math.round((128 * v.height) / v.width)));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  const txt = await p.getTextContent();
  const data = txt.items
    .map((t) => ('str' in t ? t.str : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    page,
    width: v.width,
    height: v.height,
    pixels: ctx.getImageData(0, 0, c.width, c.height).data,
    text: data,
  };
}
function quality(a: Sample, b: Sample) {
  if (a.width !== b.width || a.height !== b.height || a.pixels.length !== b.pixels.length)
    return 'Page geometry differs.';
  let delta = 0;
  for (let i = 0; i < a.pixels.length; i += 4) {
    for (let j = 0; j < 3; j++) delta += Math.abs(a.pixels[i + j] - b.pixels[i + j]);
  }
  return `Geometry matches · ${a.text === b.text ? (a.text ? 'Selectable text matches' : 'No selectable text on this page') : 'Selectable text differs'} · Mean pixel difference ${((delta / (a.pixels.length * 0.75 * 255)) * 100).toFixed(2)}%`;
}
function Sheet({
  blob,
  page,
  zoom,
  onCount,
  onSample,
}: {
  blob: Blob;
  page: number;
  zoom: number;
  onCount: (n: number) => void;
  onSample?: (s: Sample) => void;
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
      .then(async () => {
        if (!a.signal.aborted) {
          setBusy(false);
          if (onSample && canvas.current) {
            const shot = await sampleSheet(doc, page, canvas.current);
            if (!a.signal.aborted) onSample(shot);
          }
        }
      })
      .catch((e) => {
        if (!a.signal.aborted) {
          setError(e.message);
          setBusy(false);
        }
      });
    return () => a.abort();
  }, [doc, page, zoom, onSample]);
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
  const [page, setPage] = useState(req.page || 1),
    [count, setCount] = useState(1),
    [zoom, setZoom] = useState(1);
  const [a, setA] = useState<Sample | null>(null),
    [b, setB] = useState<Sample | null>(null);
  const left = useCallback((s: Sample) => setA(s), []),
    right = useCallback((s: Sample) => setB(s), []);
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
          <Sheet
            blob={req.file}
            page={page}
            zoom={zoom}
            onCount={setCount}
            onSample={req.after ? left : undefined}
          />
        </div>
        {req.after && (
          <div>
            <div className="preview-label">
              Compressed <b>{formatBytes(req.after.blob.size)}</b>
            </div>
            <Sheet
              blob={req.after.blob}
              page={page}
              zoom={zoom}
              onCount={setCount}
              onSample={right}
            />
          </div>
        )}
      </div>
      {req.after && (
        <div className="v-quality" aria-live="polite">
          <b>Page {page} inspection</b>
          <p>
            {a?.page === page && b?.page === page ? quality(a, b) : 'Inspecting rendered pages…'}
          </p>
          <small>
            Pixel difference compares reduced previews, not readability. Zoom in to inspect fine
            print.
          </small>
        </div>
      )}
    </Modal>
  );
}
