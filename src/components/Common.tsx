import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  FileText,
  FolderOpen,
  Info,
  LoaderCircle,
  RotateCcw,
  ScanEye,
  Share2,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react';
import { formatBytes, type Output } from '../engine/types';
import { exportOutput } from '../storage';
export function Brand() {
  return (
    <div className="brand">
      <img src="/mark.svg" alt="" />
      <span>
        PDF Reducer
        <small>
          AI <b>PRO</b>
        </small>
      </span>
    </div>
  );
}
export function IconBox({
  icon: Icon,
  tone = 'blue',
  small = false,
}: {
  icon: LucideIcon;
  tone?: string;
  small?: boolean;
}) {
  return (
    <span className={`iconbox ${tone} ${small ? 'small' : ''}`}>
      <Icon size={small ? 17 : 21} strokeWidth={1.8} />
    </span>
  );
}
export function PageHead({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {children}
    </div>
  );
}
export function PanelHead({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <div className="panel-title">
        <Icon size={19} />
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  eyebrow,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  eyebrow?: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    close = useRef(onClose),
    id = useId();
  close.current = onClose;
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    const root = ref.current!;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.focus();
    const handler = (e: KeyboardEvent) => {
      if (Array.from(document.querySelectorAll('[aria-modal="true"]')).at(-1) !== root) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close.current();
      }
      if (e.key === 'Tab') {
        const items = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        ).filter((x) => x.offsetParent !== null);
        if (!items.length) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (!items.includes(document.activeElement as HTMLElement) ||
            document.activeElement === items[0])
        ) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (
          !e.shiftKey &&
          (!items.includes(document.activeElement as HTMLElement) ||
            document.activeElement === items.at(-1))
        ) {
          e.preventDefault();
          items[0].focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handler);
      old?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <header className="modal-head">
          <div>
            {eyebrow && <div className="overline">{eyebrow}</div>}
            <h2 id={id}>{title}</h2>
          </div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export function PaperArt() {
  return (
    <svg className="paper-art" viewBox="0 0 94 81" fill="none" aria-hidden="true">
      <ellipse cx="47" cy="71" rx="36" ry="5" fill="#dbe6ff" opacity=".65" />
      <g transform="rotate(-14 39 40)">
        <rect
          x="16"
          y="13"
          width="41"
          height="54"
          rx="6"
          fill="#dbe7ff"
          stroke="#89abf5"
          strokeWidth="1.4"
        />
        <path d="M23 29h22m-22 7h16" stroke="#a2bbf3" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <g transform="rotate(7 53 40)">
        <path
          d="M36 6h24l13 13v41a6 6 0 0 1-6 6H36a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6Z"
          fill="white"
          stroke="#5083ed"
          strokeWidth="1.7"
        />
        <path d="M60 7v10a3 3 0 0 0 3 3h9" fill="#d5e5ff" stroke="#5083ed" strokeWidth="1.6" />
        <path
          d="M39 30h23m-23 6h18m-18 6h23"
          stroke="#b0c7f7"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect x="43" y="47" width="33" height="16" rx="3.5" fill="#3469ea" />
        <text
          x="59.5"
          y="58.5"
          fill="white"
          fontSize="10"
          fontWeight="700"
          fontFamily="Arial,sans-serif"
          textAnchor="middle"
          letterSpacing="1"
        >
          PDF
        </text>
      </g>
      <path d="m80 15 1.1 3.2 3.4 1-3.4 1.1-1.1 3.2-1.1-3.2-3.3-1.1 3.3-1Z" fill="#85a9f9" />
    </svg>
  );
}
export function DropArea({
  onFiles,
  images = false,
  disabled = false,
  compact = false,
  inputId = 'studio-picker',
  multiple = true,
}: {
  onFiles: (f: File[]) => void;
  images?: boolean;
  disabled?: boolean;
  compact?: boolean;
  inputId?: string;
  multiple?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const choose = () => {
    if (!disabled) input.current?.click();
  };
  return (
    <div
      className={`drop-area ${drag ? 'dragging' : ''} ${compact ? 'compact' : ''} ${disabled ? 'unavailable' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (!disabled) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        type="file"
        id={inputId}
        ref={input}
        multiple={multiple}
        accept={
          images ? 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp' : 'application/pdf,.pdf'
        }
        disabled={disabled}
        aria-label={images ? 'Choose images' : 'Choose PDF files'}
        onChange={(e) => {
          if (e.target.files) onFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
        hidden
      />
      {!compact ? (
        <>
          <PaperArt />
          <h3>
            {drag
              ? 'Drop to add your files'
              : images
                ? 'Drop your images here'
                : 'Drag & drop your PDFs here'}
          </h3>
          <p>
            {images ? 'PNG, JPEG or WebP' : 'PDF documents'} <span>·</span> Up to 64 MB per file
          </p>
        </>
      ) : (
        <span className="compact-hint">
          <FileText size={16} />
          {images ? 'Add more images' : 'Add more PDFs'}
        </span>
      )}
      <button
        type="button"
        className={compact ? 'small-link' : 'button primary browse'}
        onClick={choose}
        disabled={disabled}
      >
        <FolderOpen size={16} />
        {compact ? 'Browse' : 'Browse files'}
      </button>
    </div>
  );
}
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: string }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`notice ${tone}`}>
      <Info size={16} />
      <span>{children}</span>
    </div>
  );
}
export function ProgressBar({
  value,
  label,
  onCancel,
}: {
  value: number;
  label: string;
  onCancel: () => void;
}) {
  return (
    <div className="job-progress">
      <div>
        <span>
          <LoaderCircle size={14} className="spin" />
          {label}
        </span>
        <button className="text-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <progress max={100} value={value} aria-label={label} />
    </div>
  );
}
export type PreviewRequest = { file: Blob; name: string; after?: Output };
export function OutputCard({
  out,
  onPreview,
  original,
  notify,
}: {
  out: Output;
  onPreview: (r: PreviewRequest) => void;
  original?: File;
  notify: (s: string) => void;
}) {
  const [exporting, setExporting] = useState(false);
  const save = async (share = false) => {
    setExporting(true);
    try {
      await exportOutput(out, share);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') notify((e as Error).message);
    } finally {
      setExporting(false);
    }
  };
  const r = out.report;
  return (
    <div className="output-card">
      <div className="output-title">
        <span className="success-dot">
          <Check size={13} />
        </span>
        <strong>
          {r ? (r.unchanged ? 'Already optimized' : 'Compression complete') : 'Your file is ready'}
        </strong>
        {r && <span className="saved-chip">−{Math.round((1 - r.output / r.original) * 100)}%</span>}
      </div>
      <div className="output-size">
        {r ? (
          <>
            <span>{formatBytes(r.original)}</span>
            <ArrowRight size={13} />
            <b>{formatBytes(r.output)}</b>
            <small>Saved {formatBytes(r.original - r.output)}</small>
          </>
        ) : (
          <>
            <b>{out.name}</b>
            <small>{formatBytes(out.blob.size)}</small>
          </>
        )}
      </div>
      {r && (!r.targetMet || r.unchanged) && (
        <p className="field-hint">
          {r.unchanged ? 'Original retained: no smaller safe result. ' : ''}
          {!r.targetMet
            ? `Target not reached after ${r.attempts} ${r.attempts === 1 ? 'pass' : 'passes'}.`
            : ''}
        </p>
      )}
      {r && (
        <p className="field-hint">
          {r.profile} · {r.pages} {r.pages === 1 ? 'page' : 'pages'} verified
        </p>
      )}
      <div className="output-actions">
        <button className="button primary tiny" disabled={exporting} onClick={() => save()}>
          <ArrowDownToLine size={15} />
          Download
        </button>
        {out.blob.type === 'application/pdf' && !out.name.endsWith('-protected.pdf') && (
          <button
            className="button ghost tiny"
            onClick={() =>
              onPreview({
                file: original || out.blob,
                name: original?.name || out.name,
                after: original ? out : undefined,
              })
            }
          >
            <ScanEye size={15} />
            {original ? 'Compare' : 'Preview'}
          </button>
        )}
        <button
          className="icon-button"
          disabled={exporting}
          title="Share file"
          aria-label="Share file"
          onClick={() => save(true)}
        >
          <Share2 size={15} />
        </button>
      </div>
    </div>
  );
}
export function PrivateLine() {
  return (
    <span className="private-line">
      <ShieldCheck size={14} /> Files stay on your device
    </span>
  );
}
export function EmptyState({
  icon: Icon = RotateCcw,
  title,
  desc,
  action,
  onAction,
}: {
  icon?: LucideIcon;
  title: string;
  desc: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={23} />
      </span>
      <h3>{title}</h3>
      <p>{desc}</p>
      {action && (
        <button className="small-link" onClick={onAction}>
          {action}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
