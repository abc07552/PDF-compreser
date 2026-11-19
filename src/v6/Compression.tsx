import { useEffect, useId, useState } from 'react';
import {
  History,
  Inbox,
  ArrowDownRight,
  ArrowRight,
  CheckCheck,
  ChevronDown,
  CircleGauge,
  Crosshair,
  Download,
  FileArchive,
  Focus,
  LoaderCircle,
  LockKeyhole,
  ScanEye,
  Settings2,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import { estimate, formatBytes, MB, type Settings } from '../engine/types';
import { canDeliverShare } from '../storage';
import { presets } from './types';
import { useWorkspace } from './workspace';
import { Head, Switch } from './ui';
export function Gauge({ val, label, working }: { val: number; label: string; working: boolean }) {
  const id = useId().replace(/:/g, '');
  const point = (angle: number, r: number) => [
    125 + Math.cos((angle * Math.PI) / 180) * r,
    112 + Math.sin((angle * Math.PI) / 180) * r,
  ];
  const start = point(162, 85),
    end = point(378, 85);
  const path = `M${start.join(' ')} A85 85 0 1 1 ${end.join(' ')}`;
  const frac = Math.min(1, Math.max(0, val / 100));
  const tip = point(162 + 216 * frac, 85);
  return (
    <div className={'v-gauge ' + (working ? 'working' : '')}>
      <svg viewBox="0 0 250 150" role="img" aria-label={`${label}: ${Math.round(val)} percent`}>
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="#22d5eb" />
            <stop offset=".48" stopColor="#4f9eff" />
            <stop offset="1" stopColor="#ae73fb" />
          </linearGradient>
        </defs>
        {Array.from({ length: 41 }, (_, i) => {
          const a = 162 + (216 * i) / 40;
          return (
            <line
              key={i}
              x1={point(a, 97)[0]}
              y1={point(a, 97)[1]}
              x2={point(a, i % 5 === 0 ? 104 : 100)[0]}
              y2={point(a, i % 5 === 0 ? 104 : 100)[1]}
              stroke="currentColor"
              opacity={i / 40 <= frac ? 0.85 : 0.29}
              strokeWidth="1.2"
            />
          );
        })}
        <path d={path} fill="none" className="gauge-track" strokeWidth="8" strokeLinecap="round" />
        <path
          d={path}
          fill="none"
          pathLength="100"
          stroke={`url(#${id})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${frac * 100} 101`}
          className="gauge-value"
        />
        {frac > 0 && <circle cx={tip[0]} cy={tip[1]} r="3" fill="#e9e2ff" />}
      </svg>
      <div className="gauge-readout">
        <span>
          {working ? <LoaderCircle size={15} className="spin" /> : <ArrowDownRight size={16} />}
        </span>
        <b>
          {Math.round(val)}
          <small>%</small>
        </b>
        <em>{label}</em>
      </div>
    </div>
  );
}
function Advanced() {
  const w = useWorkspace(),
    s = w.prefs.settings;
  return (
    <div className="advanced-body">
      <label className="v-label">
        Quick targets
        <select
          aria-label="Quick target sizes"
          value={
            [0, 100, 200, 300, 500, 1024, 2048].includes(s.target / 1024)
              ? String(s.target / 1024)
              : 'custom'
          }
          onChange={(e) => w.settings({ target: +e.target.value * 1024 })}
        >
          <option value="custom" disabled>
            Custom value
          </option>
          {[0, 100, 200, 300, 500, 1024, 2048].map((n) => (
            <option value={n} key={n}>
              {n ? formatBytes(n * 1024) : 'Auto (no target)'}
            </option>
          ))}
        </select>
      </label>
      <label className="v-label">
        Enhancement
        <select
          value={s.enhancement || 'Off'}
          onChange={(e) => w.settings({ enhancement: e.target.value as Settings['enhancement'] })}
        >
          {['Off', 'HD clarity', 'Scan cleanup'].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      <label className="v-label">
        Color mode
        <select
          value={s.color}
          onChange={(e) => w.settings({ color: e.target.value as Settings['color'] })}
        >
          {['Color', 'Grayscale', 'Black & white'].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      {s.preset === 'Custom' && (
        <>
          <label className="v-label">
            Resolution
            <select value={s.dpi} onChange={(e) => w.settings({ dpi: +e.target.value })}>
              {[72, 96, 120, 150, 200, 300].map((n) => (
                <option value={n} key={n}>
                  {n} DPI
                </option>
              ))}
            </select>
          </label>
          <label className="v-label">
            JPEG quality · {s.quality}
            <input
              type="range"
              min="10"
              max="100"
              value={s.quality}
              onChange={(e) => w.settings({ quality: +e.target.value })}
            />
          </label>
        </>
      )}
      <div className="switch-line">
        <span>
          <Crosshair size={14} /> Exact Target Mode
        </span>
        <Switch
          on={!!s.exact}
          label="Exact Target Mode"
          onChange={() => w.settings({ exact: !s.exact })}
        />
      </div>
      <div className="switch-line">
        <span>
          <CircleGauge size={14} /> Automatic retry
        </span>
        <Switch
          on={s.retry}
          label="Automatic retry"
          onChange={() => w.settings({ retry: !s.retry })}
        />
      </div>
      <p className="v-muted">
        Exact Target tries up to five profiles with retry enabled. Protected clarity and original
        safety take priority.
      </p>
    </div>
  );
}
export function Compression() {
  const w = useWorkspace(),
    s = w.prefs.settings,
    d = w.selected,
    r = d?.out?.report,
    unit = w.prefs.unit,
    u = unit === 'MB' ? MB : 1024;
  const [draft, setDraft] = useState('');
  useEffect(() => {
    setDraft(s.target ? String(Number((s.target / u).toFixed(10))) : '');
  }, [s.target, u]);
  const valid =
    draft === '' ||
    (Number.isFinite(+draft) &&
      Math.round(+draft * u) >= 1024 &&
      Math.round(+draft * u) <= 1000 * MB);
  const gauge = w.job
    ? w.job.n
    : r
      ? (1 - r.output / r.original) * 100
      : d && s.target
        ? Math.max(0, (1 - s.target / d.size) * 100)
        : 0;
  const forced = ['Clarity First', 'Government Form'].includes(s.preset);
  const estimates = d?.analysis ? estimate(d.size, d.analysis, s) : null;
  const completed = w.docs.filter((d) => w.checked.includes(d.id) && d.out).length;
  return (
    <div className="compress-column">
      <section className="v-panel compression-panel" aria-label="Compression controls">
        <Head
          icon={SlidersHorizontal}
          title="Compression"
          tone="purple"
          end={<span className="engine-chip">ENGINE V6</span>}
        />
        <div className="meter-wrap">
          <Gauge
            val={gauge}
            label={w.job ? 'Processing' : r ? 'Space saved' : 'Target reduction'}
            working={!!w.job}
          />
          <div className="meter-facts">
            <span>
              Original size
              <b>{w.job?.original ? formatBytes(w.job.original) : d ? formatBytes(d.size) : '—'}</b>
            </span>
            <i />
            <ArrowRight size={13} />
            <i />
            <span>
              {w.job?.candidate ? 'Candidate size' : r ? 'Output size' : 'Target size'}
              <b>
                {w.job?.candidate
                  ? formatBytes(w.job.candidate)
                  : r
                    ? formatBytes(r.output)
                    : s.target
                      ? formatBytes(s.target, 2)
                      : 'Auto'}
              </b>
            </span>
          </div>
        </div>
        <div className="compression-body">
          <fieldset disabled={!!w.job}>
            <label className="v-label" htmlFor="target-size">
              Target file size
            </label>
            <div className="size-field">
              <input
                id="target-size"
                aria-invalid={!valid}
                aria-label={`Target file size in ${unit}`}
                type="number"
                step="any"
                min={1024 / u}
                max={(1000 * MB) / u}
                value={draft}
                placeholder="Auto"
                onChange={(e) => {
                  setDraft(e.target.value);
                  const b = Math.round(+e.target.value * u);
                  if (!e.target.value || (b >= 1024 && b <= 1000 * MB)) w.settings({ target: b });
                }}
              />
              <div className="unit-toggle">
                {(['KB', 'MB'] as const).map((k) => (
                  <button key={k} aria-pressed={unit === k} onClick={() => w.pref({ unit: k })}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
            {!valid && (
              <small role="alert" className="field-error">
                Choose 1 KB–1000 MB, or clear for Auto.
              </small>
            )}
            <label className="v-label preset-label" htmlFor="compression-profile">
              Compression profile
            </label>
            <div className="profile-field">
              <Sparkles size={15} />
              <select
                id="compression-profile"
                value={s.preset}
                onChange={(e) => {
                  const preset = e.target.value as Settings['preset'];
                  w.settings({ preset });
                  if (preset === 'Custom') w.setAdvanced(true);
                }}
              >
                {presets.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
            <div className="clarity-line">
              <span className="clarity-symbol">
                <Focus size={18} />
              </span>
              <span>
                <b>Clarity First</b>
                <small>Protect text & fine details</small>
              </span>
              <Switch
                label="Clarity First"
                on={forced || !!s.clarity}
                disabled={forced}
                onChange={() => w.settings({ clarity: !s.clarity })}
              />
            </div>
            <button
              className="advanced-toggle"
              aria-expanded={w.advanced}
              onClick={() => w.setAdvanced(!w.advanced)}
            >
              <Settings2 size={13} />
              Advanced settings
              <ChevronDown size={13} style={{ transform: w.advanced ? 'rotate(180deg)' : '' }} />
            </button>
            {w.advanced && <Advanced />}
          </fieldset>
          {w.job ? (
            <div className="active-job" role="status">
              <b>
                <LoaderCircle size={14} className="spin" />
                {w.job.label}
              </b>
              <small>
                {w.job.name}{' '}
                {w.job.count && w.job.count > 1 ? `(${w.job.index}/${w.job.count})` : ''}
              </small>
              <progress value={w.job.n} max="100" aria-label="Job progress" />
              <button onClick={w.cancel}>Cancel job</button>
            </div>
          ) : (
            <button
              className="compress-cta"
              onClick={() => void w.run()}
              disabled={!d || !valid || (w.batch && !w.checked.length)}
            >
              <Zap size={16} fill="currentColor" />
              {w.batch ? `Compress ${w.checked.length} PDFs` : 'Compress PDF'}
              <ArrowRight size={15} />
            </button>
          )}
          <div className="v-assurance">
            <LockKeyhole size={11} />
            Private, on-device processing
          </div>
        </div>
        {d?.out && r && (
          <div className="delivery-card">
            <b className="delivery-title">
              <CheckCheck size={16} />
              {r.unchanged ? 'Already optimized' : 'Compression complete'}
            </b>
            <p>
              {formatBytes(r.original)} → <strong>{formatBytes(r.output)}</strong> · Saved{' '}
              {formatBytes(r.original - r.output)}
            </p>
            <p>
              {r.requestedProfile} ·{' '}
              {r.requestedTarget
                ? `${formatBytes(r.requestedTarget, 2)} target: `
                : 'Auto target: '}
              {r.targetMet ? (r.requestedTarget ? 'met' : 'optimized') : 'Target not reached'} ·{' '}
              {r.attempts} {r.attempts === 1 ? 'pass' : 'passes'}.{' '}
              {r.unchanged ? 'Original retained.' : ''}
            </p>
            <p>
              {r.pages} pages verified ·{' '}
              {r.imagesOptimized
                ? `${r.color === 'Black & white' ? '1-bit' : `${r.quality}% JPEG`} / ${r.dpi} DPI profile`
                : 'No image resampling'}
              {r.enhanced ? ` · ${r.enhanced} enhanced` : ''}
              {r.formProtected ? ' · Form fields protected' : ''}
            </p>
            <div className="v-actions">
              <button className="v-btn" onClick={() => void w.deliver(d.out!)}>
                <Download size={14} />
                Save copy
              </button>
              <button className="v-btn" onClick={() => void w.view(true)}>
                <ScanEye size={14} />
                Compare
              </button>
              {canDeliverShare(d.out) && (
                <button className="v-btn" onClick={() => void w.deliver(d.out!, true)}>
                  <Share2 size={14} />
                  Share
                </button>
              )}
            </div>
          </div>
        )}
        {w.batch && completed > 0 && (
          <button className="zip-btn" disabled={!!w.job} onClick={() => void w.exportZip()}>
            <FileArchive size={15} />
            Export {completed} results as ZIP
          </button>
        )}
        {w.advanced && d && (
          <div className="v-diagnostics">
            <b>
              <ShieldCheck size={13} /> Source inspection
            </b>
            <p>
              {d.analysis?.kind || d.layer} · {d.pages} pages
            </p>
            {d.analysis && (
              <details className="profile-comparison">
                <summary>Compare compression profiles</summary>
                <p>Estimated ranges; Clarity First and the image safety limits still apply.</p>
                <dl>
                  {presets.map((p) => {
                    const [lo, hi] = estimate(d.size, d.analysis!, { ...s, preset: p });
                    return (
                      <div key={p}>
                        <dt>{p}</dt>
                        <dd>
                          {formatBytes(lo)}–{formatBytes(hi)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </details>
            )}
            {d.analysis?.oversizedImages && (
              <p>
                Some images exceed the preview pixel budget. Inspect the exported PDF in a full
                reader.
              </p>
            )}
            {estimates && (
              <p>
                Estimated output: {formatBytes(estimates[0])}–{formatBytes(estimates[1])}. Not a
                guarantee.
              </p>
            )}
          </div>
        )}
      </section>
      <aside className="v-delivery-summary">
        <span className="delivery-icon">
          <Inbox size={18} />
        </span>
        <div>
          <b>Result history</b>
          <small>
            {w.acts.some((a) => a.name === d?.name)
              ? `${w.acts.filter((a) => a.name === d?.name).length} recorded jobs with this filename`
              : 'No recorded jobs with this filename'}
          </small>
        </div>
        <button
          aria-label="View file history"
          title="View file history"
          onClick={() => w.go('history')}
        >
          <History size={16} />
        </button>
      </aside>
    </div>
  );
}
