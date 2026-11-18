import { assetUrl } from '../assets';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  CloudUpload,
  Cpu,
  FileText,
  Files,
  HardDriveDownload,
  Layers3,
  ListFilter,
  ScanEye,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingDown,
  X,
  Zap,
} from 'lucide-react';
import {
  defaults,
  estimate,
  profile,
  formatBytes,
  validateSelection,
  type Analysis,
  type ColorMode,
  type Output,
  type Preset,
  type Settings,
} from '../engine/types';
import { runJob } from '../engine/client';
import type { Activity } from '../storage';
import {
  DropArea,
  IconBox,
  Notice,
  OutputCard,
  PageHead,
  PanelHead,
  PrivateLine,
  ProgressBar,
  type PreviewRequest,
} from './Common';
import { RecentActivity, metrics } from './activity';
interface Entry {
  id: string;
  file: File;
  analysis?: Analysis;
  out?: Output;
  error?: string;
}
interface Props {
  activities: Activity[];
  record: (v: Activity) => void;
  onGuide: () => void;
  onHistory: () => void;
  onDetail: (a: Activity) => void;
  onPreview: (p: PreviewRequest) => void;
  notify: (s: string) => void;
  onBusy: (b: boolean) => void;
}
function EngineBanner() {
  return (
    <section className="engine-banner" aria-label="Intelligent local compression">
      <div className="banner-grid" />
      <div className="banner-text">
        <span className="engine-pill">
          <Sparkles size={12} /> INTELLIGENT COMPRESSION
        </span>
        <h2>
          Less weight. <span>More clarity.</span>
        </h2>
        <p>Smart PDF optimization, built around your document.</p>
        <div className="banner-specs">
          <span>
            <Cpu size={13} />
            On-device engine
          </span>
          <i />
          <span>
            <ShieldCheck size={13} />
            Privacy first
          </span>
        </div>
      </div>
      <div className="banner-art">
        <img
          src={assetUrl('art/compression-engine.webp')}
          alt="An exploded stack of luminous blue PDF layers"
        />
      </div>
      <span className="figure-mark">
        FIG. 01 <i /> PDF ENGINE
      </span>
      <i className="hero-cross a" />
      <i className="hero-cross b" />
    </section>
  );
}
export function MetricCards({ activities }: { activities: Activity[] }) {
  const m = metrics(activities);
  return (
    <div className="metric-grid">
      {[
        {
          icon: HardDriveDownload,
          tone: 'blue',
          label: 'Total storage saved',
          value: formatBytes(m.saved),
        },
        { icon: Files, tone: 'violet', label: 'PDFs compressed', value: String(m.files) },
        { icon: TrendingDown, tone: 'teal', label: 'Average reduction', value: `${m.percent}%` },
      ].map(({ icon, tone, label, value }) => (
        <div className="metric" key={label}>
          <IconBox icon={icon} tone={tone} />
          <div>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}
function SettingsPanel({
  s,
  set,
  advanced,
  setAdvanced,
  disabled,
  onStart,
  count,
  again,
}: {
  s: Settings;
  set: (s: Settings) => void;
  advanced: boolean;
  setAdvanced: (b: boolean) => void;
  disabled: boolean;
  onStart: () => void;
  count: number;
  again: boolean;
}) {
  const [custom, setCustom] = useState(false),
    [targetText, setTargetText] = useState('250');
  const targetInvalid =
    custom && (!Number.isFinite(+targetText) || +targetText <= 0 || +targetText > 65536);
  const change = (v: Partial<Settings>) => set({ ...s, ...v });
  const desc: Record<Preset, string> = {
    Recommended: 'Adapts to your document automatically.',
    Balanced: 'Prioritizes clarity with moderate savings.',
    High: 'Smaller images for a lighter document.',
    Extreme: 'Maximum savings for image-heavy files.',
    Custom: 'Your own resolution, quality and color settings.',
  };
  return (
    <section className="panel settings-panel">
      <PanelHead icon={SlidersHorizontal} title="Compression settings" />
      <fieldset disabled={disabled} className="settings-content">
        <label className="field-label" htmlFor="preset">
          Compression preset
        </label>
        <div className="preset-select">
          <Sparkles size={16} />
          <select
            id="preset"
            value={s.preset}
            onChange={(e) => {
              change({ preset: e.target.value as Preset });
              if (e.target.value === 'Custom') setAdvanced(true);
            }}
          >
            {['Recommended', 'Balanced', 'High', 'Extreme', 'Custom'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          {s.preset === 'Recommended' && <span>AI</span>}
          <ChevronDown size={15} />
        </div>
        <p className="field-hint">{desc[s.preset]}</p>
        <div className="target-heading">
          <span className="field-label">Target file size</span>
          <span>Optional</span>
        </div>
        <div className="target-pills" role="group" aria-label="Target file size">
          {[
            [0, 'Auto'],
            [100, '100 KB'],
            [500, '500 KB'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={!custom && s.target === Number(value) * 1024 ? 'selected' : ''}
              aria-pressed={!custom && s.target === Number(value) * 1024}
              onClick={() => {
                setCustom(false);
                change({ target: Number(value) * 1024 });
              }}
            >
              {label}
            </button>
          ))}
          <div
            className={`more-target ${custom || ![0, 102400, 512000].includes(s.target) ? 'selected' : ''}`}
          >
            <select
              aria-label="More target sizes"
              value={
                custom ? 'custom' : [0, 102400, 512000].includes(s.target) ? '' : s.target / 1024
              }
              onChange={(e) => {
                const c = e.target.value === 'custom';
                setCustom(c);
                change({
                  target: c ? Math.round(Number(targetText) * 1024) : Number(e.target.value) * 1024,
                });
              }}
            >
              <option value="" disabled>
                More
              </option>
              {[
                [200, '200 KB'],
                [300, '300 KB'],
                [1024, '1 MB'],
                [2048, '2 MB'],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
              <option value="custom">Custom</option>
            </select>
            <ChevronDown size={12} />
          </div>
        </div>
        {custom && (
          <label className="field custom-target">
            Maximum size (KB)
            <input
              aria-label="Custom target in KB"
              inputMode="decimal"
              type="number"
              min="0.1"
              max="65536"
              value={targetText}
              onChange={(e) => {
                setTargetText(e.target.value);
                change({ target: Math.round(+e.target.value * 1024) });
              }}
            />
            {targetInvalid && <small>Enter a target above 0 and at most 65,536 KB.</small>}
          </label>
        )}
        <button
          className="advanced-toggle"
          aria-expanded={advanced}
          onClick={() => setAdvanced(!advanced)}
        >
          <ListFilter size={15} />
          Advanced options
          <ChevronDown size={15} className={advanced ? 'rotated' : ''} />
        </button>
        {advanced && (
          <div className="advanced-fields">
            <label className="field">
              Image resolution
              <select
                value={s.dpi}
                onChange={(e) => change({ dpi: +e.target.value, preset: 'Custom' })}
              >
                {[72, 96, 120, 150, 200, 300].map((n) => (
                  <option value={n} key={n}>
                    {n} DPI
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Image quality <b>{s.quality}%</b>
              <input
                type="range"
                min="10"
                max="100"
                value={s.quality}
                onChange={(e) => change({ quality: +e.target.value, preset: 'Custom' })}
              />
            </label>
            <label className="field">
              Document color mode
              <select
                value={s.color}
                onChange={(e) => change({ color: e.target.value as ColorMode, preset: 'Custom' })}
              >
                {['Color', 'Grayscale', 'Black & white'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={s.retry}
                onChange={(e) => change({ retry: e.target.checked })}
              />
              Retry if the target is not reached
            </label>
            <p className="field-hint">
              Targets are approximate. Color modes convert supported images and page paint colors.
              Specialty colors and masks are preserved.
            </p>
          </div>
        )}
        <button
          className="button primary compress-button"
          disabled={disabled || targetInvalid}
          onClick={onStart}
        >
          <Zap size={16} fill="currentColor" />
          {disabled
            ? 'Working locally…'
            : again
              ? 'Compress again'
              : count > 1
                ? `Compress ${count} PDFs`
                : 'Compress PDFs'}
          <ArrowRight size={17} />
        </button>
      </fieldset>
    </section>
  );
}
export default function Studio({
  activities,
  record,
  onGuide,
  onHistory,
  onDetail,
  onPreview,
  notify,
  onBusy,
}: Props) {
  const [items, setItems] = useState<Entry[]>([]),
    [s, set] = useState<Settings>(defaults),
    [advanced, setAdvanced] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState({ n: 0, label: '' });
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
  const working = (b: boolean) => {
    setBusy(b);
    onBusy(b);
  };
  const patch = (id: string, value: Partial<Entry>) =>
    setItems((all) => all.map((i) => (i.id === id ? { ...i, ...value } : i)));
  const add = async (files: File[]) => {
    if (current.current || !files.length) return;
    setError('');
    try {
      validateSelection([...items.map((i) => i.file), ...files]);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const added = files.map((file) => ({ id: crypto.randomUUID(), file }));
    setItems((old) => [...old, ...added]);
    const ac = new AbortController();
    current.current = ac;
    working(true);
    try {
      for (let k = 0; k < added.length; k++) {
        const item = added[k];
        if (ac.signal.aborted) break;
        setProgress({ n: (k / added.length) * 100, label: `Analyzing ${item.file.name}` });
        try {
          const a = await runJob({ type: 'analyze', file: item.file }, ac.signal);
          patch(item.id, {
            analysis: a,
            error: a.signed ? 'Signed PDF: choose an unsigned copy to compress.' : undefined,
          });
        } catch (e) {
          patch(item.id, { error: (e as Error).message });
        }
      }
    } finally {
      if (ac.signal.aborted) {
        setItems((all) =>
          all.filter((i) => i.analysis || i.error || !added.some((x) => x.id === i.id)),
        );
      }
      current.current = null;
      working(false);
    }
  };
  const sample = async () => {
    if (busy) return;
    try {
      const res = await fetch(assetUrl('sample.pdf'));
      if (!res.ok) throw Error('The bundled sample could not be opened.');
      await add([
        new File([await res.blob()], 'Paper notes - field guide.pdf', { type: 'application/pdf' }),
      ]);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const start = async () => {
    if (current.current) return;
    const ready = items.filter((i) => i.analysis && !i.analysis.signed);
    if (!ready.length) {
      document.getElementById('studio-picker')?.click();
      return;
    }
    const pending = ready.filter((i) => !i.out);
    const batch = pending.length ? pending : ready;
    setError('');
    working(true);
    const ac = new AbortController();
    current.current = ac;
    try {
      for (let k = 0; k < batch.length; k++) {
        const item = batch[k];
        if (ac.signal.aborted) break;
        patch(item.id, { out: undefined, error: undefined });
        setProgress({ n: (k / batch.length) * 100, label: `Preparing ${item.file.name}` });
        try {
          const out = await runJob(
            { type: 'compress', file: item.file, settings: s },
            ac.signal,
            (n, label) =>
              setProgress({
                n: ((k + n / 100) / batch.length) * 100,
                label: batch.length > 1 ? `${k + 1}/${batch.length} · ${label}` : label,
              }),
          );
          patch(item.id, { out });
          record({
            id: crypto.randomUUID(),
            name: item.file.name,
            operation: 'Compress PDF',
            input: item.file.size,
            output: out.blob.size,
            pages: out.pages,
            at: Date.now(),
          });
        } catch (e) {
          patch(item.id, { error: (e as Error).message });
        }
      }
    } finally {
      current.current = null;
      working(false);
    }
  };
  return (
    <>
      <PageHead title="Compression studio" desc="Your private workspace for lighter, sharper PDFs.">
        <button className="button ghost guide-button" onClick={onGuide}>
          <BookOpen size={15} />
          Quick guide
        </button>
      </PageHead>
      <EngineBanner />
      <MetricCards activities={activities} />
      <div className="studio-grid">
        <section className="panel upload-panel">
          <PanelHead icon={CloudUpload} title="File workspace">
            <span className="batch-label">
              <Layers3 size={12} />
              Batch supported
            </span>
          </PanelHead>
          <div className="upload-content">
            {items.length > 0 && (
              <div className="queue">
                {items.map((i) => (
                  <div className="queue-item" key={i.id}>
                    <div className="file-row">
                      <span className="file-stamp">
                        <FileText size={20} />
                      </span>
                      <div className="file-name">
                        <b title={i.file.name}>{i.file.name}</b>
                        <small>
                          {formatBytes(i.file.size)}
                          {i.analysis && (
                            <>
                              {' '}
                              <i>·</i> {i.analysis.pages}{' '}
                              {i.analysis.pages === 1 ? 'page' : 'pages'}
                            </>
                          )}
                        </small>
                      </div>
                      {i.analysis && (
                        <button
                          className="icon-button"
                          aria-label={`Preview ${i.file.name}`}
                          onClick={() => onPreview({ file: i.file, name: i.file.name })}
                        >
                          <ScanEye size={16} />
                        </button>
                      )}
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={`Remove ${i.file.name}`}
                        onClick={() => setItems((old) => old.filter((x) => x.id !== i.id))}
                      >
                        <X size={15} />
                      </button>
                    </div>
                    {i.error && <Notice tone="error">{i.error}</Notice>}
                    {i.analysis && !i.out && (
                      <>
                        <div className="analysis-line">
                          <span>
                            <Sparkles size={12} />
                            {i.analysis.kind}
                          </span>
                          <small>{i.analysis.recommended}</small>
                        </div>
                        <p className="estimate">
                          Estimated output{' '}
                          <b>
                            {estimate(i.file.size, i.analysis, s)
                              .map((n) => formatBytes(n))
                              .join(' – ')}
                          </b>
                        </p>
                        <details className="profile-compare">
                          <summary>Compare compression profiles</summary>
                          <dl>
                            {(['Balanced', 'High', 'Extreme'] as Preset[]).map((preset) => {
                              const settings = { ...s, preset };
                              const p = profile(settings, i.analysis!);
                              return (
                                <div key={preset}>
                                  <dt>
                                    {preset}
                                    <small>
                                      {p.dpi} DPI · {p.quality}% image quality
                                    </small>
                                  </dt>
                                  <dd>
                                    {estimate(i.file.size, i.analysis!, settings)
                                      .map((n) => formatBytes(n))
                                      .join(' – ')}
                                  </dd>
                                </div>
                              );
                            })}
                          </dl>
                          <p className="field-hint">Estimated ranges, not guaranteed sizes.</p>
                        </details>
                      </>
                    )}
                    {i.out && (
                      <OutputCard
                        out={i.out}
                        original={i.file}
                        onPreview={onPreview}
                        notify={notify}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            <DropArea compact={!!items.length} disabled={busy} onFiles={add} />
            {busy && (
              <ProgressBar
                value={progress.n}
                label={progress.label}
                onCancel={() => current.current?.abort()}
              />
            )}{' '}
            {error && <Notice tone="error">{error}</Notice>}
          </div>
          <div className="upload-footer">
            <PrivateLine />
            <button className="small-link" onClick={sample} disabled={busy}>
              Try a sample
              <ArrowRight size={13} />
            </button>
          </div>
        </section>
        <SettingsPanel
          s={s}
          set={set}
          advanced={advanced}
          setAdvanced={setAdvanced}
          disabled={busy}
          onStart={start}
          count={items.length}
          again={items.length > 0 && items.every((i) => i.out)}
        />
      </div>
      <RecentActivity activities={activities} onHistory={onHistory} onDetail={onDetail} />
    </>
  );
}
