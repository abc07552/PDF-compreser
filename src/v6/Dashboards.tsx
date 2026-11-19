import { useState, type CSSProperties } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  FileStack,
  FileText,
  Focus,
  Grid2X2,
  HardDrive,
  Layers,
  ListChecks,
  Plus,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { getTool } from '../catalog';
import { metrics } from '../components/activity';
import { formatBytes, type ToolId } from '../engine/types';
import { useWorkspace } from './workspace';
import { Compression } from './Compression';
import { DocumentView } from './DocumentView';
import { Cover, Library } from './Library';
import { Glyph } from './ui';
export function Kicker({ text = 'CONTROL CENTER' }: { text?: string }) {
  return (
    <div className="v-kicker">
      <i />
      <span>{text}</span>
    </div>
  );
}
export function Intro() {
  const w = useWorkspace();
  return (
    <div className="workspace-intro">
      <div>
        <Kicker />
        <h1>
          Compression workspace<span>.</span>
        </h1>
        <p>Your documents, preview, and compression controls in one place.</p>
      </div>
      <div className="intro-actions">
        <button
          className={'v-btn ' + (w.batch ? 'selected' : '')}
          aria-pressed={w.batch}
          disabled={!!w.job}
          onClick={() => {
            w.setBatch(!w.batch);
            if (!w.batch && w.selected) w.setChecked([w.id]);
          }}
        >
          <ListChecks size={16} />
          Batch select
        </button>
        <button className="v-btn solid" disabled={!!w.job} onClick={w.pick}>
          <Plus size={17} />
          Import PDFs
        </button>
      </div>
    </div>
  );
}
export function Stats() {
  const w = useWorkspace(),
    m = metrics(w.acts);
  const volume = w.docs.reduce((a, d) => a + d.size, 0);
  const items = [
    {
      label: 'Library files',
      val: String(w.docs.length).padStart(2, '0'),
      unit: 'PDFs',
      hint: 'In your workspace',
      icon: FileStack,
      tone: 'cyan',
    },
    {
      label: 'Source volume',
      val: formatBytes(volume, 2).split(' ')[0],
      unit: formatBytes(volume).split(' ')[1],
      hint: 'Combined file size',
      icon: Database,
      tone: 'purple',
    },
    {
      label: 'Storage saved',
      val: formatBytes(m.saved, 1).split(' ')[0],
      unit: formatBytes(m.saved).split(' ')[1],
      hint: 'Across all compressions',
      icon: HardDrive,
      tone: 'mint',
    },
    {
      label: 'Avg. reduction',
      val: String(m.percent),
      unit: '%',
      hint: 'Per processed PDF',
      icon: TrendingDown,
      tone: 'blue',
    },
  ];
  return (
    <div className="v-stats">
      {items.map((x) => (
        <div className={'v-stat tone-' + x.tone} key={x.label}>
          <div>
            <Glyph icon={x.icon} tone={x.tone} size={17} />
            <span>{x.label}</span>
          </div>
          <p>
            <strong>{x.val}</strong>
            <b>{x.unit}</b>
          </p>
          <small>{x.hint}</small>
          <i className="stat-etch" aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}
export function QuickTools() {
  const w = useWorkspace();
  return (
    <section className="quick-shelf">
      <div className="shelf-heading">
        <h2>
          <Grid2X2 size={15} /> Quick tools
        </h2>
        <button onClick={() => w.go('tools')}>
          All PDF tools <ArrowRight size={13} />
        </button>
      </div>
      <div className="shelf-grid">
        {[
          ['merge', 'Merge PDFs', 'Combine documents', 'purple'],
          ['split', 'Split PDF', 'Separate pages', 'blue'],
          ['from-images', 'Images to PDF', 'Convert image files', 'cyan'],
          ['protect', 'Protect PDF', 'Encrypt a copy', 'mint'],
        ].map(([id, title, sub, tone]) => {
          const T = getTool(id as ToolId);
          return (
            <button key={id} disabled={!!w.job} onClick={() => w.openTool(T.id)}>
              <Glyph icon={T.icon} tone={tone} />
              <span>
                <b>{title}</b>
                <small>{sub}</small>
              </span>
              <ChevronRight size={14} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
function Resizer() {
  const w = useWorkspace();
  const resize = (x: number) =>
    w.setPanelWidth(
      Math.min(
        w.edition === 'tablet' ? 300 : 356,
        Math.max(w.edition === 'tablet' ? 192 : 228, Math.round(x)),
      ),
    );
  return (
    <div
      className="lib-resizer"
      role="separator"
      aria-label="Resize library panel"
      aria-orientation="vertical"
      aria-valuenow={w.panelWidth || 248}
      aria-valuemin={w.edition === 'tablet' ? 192 : 228}
      aria-valuemax={w.edition === 'tablet' ? 300 : 356}
      tabIndex={0}
      onKeyDown={(e) => {
        if (['ArrowRight', 'ArrowLeft'].includes(e.key)) {
          e.preventDefault();
          resize(
            (e.currentTarget.parentElement?.getBoundingClientRect().width || 248) +
              (e.key === 'ArrowRight' ? 12 : -12),
          );
        }
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId) && e.buttons)
          resize(e.clientX - (e.currentTarget.parentElement?.getBoundingClientRect().left || 0));
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
    />
  );
}
export function DesktopDashboard() {
  const w = useWorkspace();
  return (
    <>
      <Intro />
      <Stats />
      <div
        className="work-grid desktop-grid"
        style={
          w.panelWidth
            ? ({ '--library-w': `${Math.max(228, w.panelWidth)}px` } as CSSProperties)
            : undefined
        }
      >
        <div className="lib-column">
          <Library />
          <Resizer />
        </div>
        <DocumentView />
        <Compression />
      </div>
      <QuickTools />
    </>
  );
}
export function TabletDashboard() {
  const w = useWorkspace();
  return (
    <>
      <Intro />
      <Stats />
      <div
        className="work-grid tablet-grid"
        style={
          w.panelWidth
            ? ({ '--library-w': `${Math.min(300, w.panelWidth)}px` } as CSSProperties)
            : undefined
        }
      >
        <div className="lib-column">
          <Library />
          <Resizer />
        </div>
        <div className="tablet-desk">
          <DocumentView />
          <Compression />
        </div>
      </div>
      <QuickTools />
    </>
  );
}
export function MobileDashboard() {
  const w = useWorkspace(),
    [lib, setLib] = useState(false);
  if (w.route === 'compress')
    return (
      <>
        <Kicker text="ON-DEVICE STUDIO" />
        <h1 className="phone-title">
          Compress PDF<span>.</span>
        </h1>
        <div className="mobile-picker">
          <button onClick={() => setLib(!lib)}>
            <FileText size={17} />
            <span>{w.selected?.name || 'Choose from library'}</span>
            <ChevronDown size={14} />
          </button>
          <button aria-label="Import PDFs" disabled={!!w.job} onClick={w.pick}>
            <Plus size={18} />
          </button>
        </div>
        {(lib || w.batch) && <Library />}
        <Compression />
        <details className="phone-collapse">
          <summary>
            <ScanIcon />
            Document preview <ChevronDown size={15} />
          </summary>
          <DocumentView />
        </details>
        <QuickTools />
      </>
    );
  return (
    <>
      <Kicker text="PERSONAL WORKSPACE" />
      <h1 className="phone-title">
        Your workspace<span>.</span>
      </h1>
      <p className="mobile-welcome">Welcome back to your private PDF studio.</p>
      <div className="mobile-quick">
        <span className="quick-bolt">
          <Zap size={23} />
        </span>
        <span className="micro-pill">QUICK START</span>
        <h2>Quick compression</h2>
        <p>Choose a PDF. Set a target. Keep the detail.</p>
        <button className="v-btn solid" disabled={!!w.job} onClick={w.pick}>
          <Plus size={16} />
          Import PDFs
        </button>
        <button className="resume-btn" onClick={() => w.go('compress')}>
          Open studio <ArrowRight size={13} />
        </button>
      </div>
      <Stats />
      <div className="phone-actions">
        <button
          onClick={() => {
            w.settings({ clarity: true, preset: 'Clarity First' });
            w.go('compress');
          }}
        >
          <Focus size={17} />
          Clarity First
        </button>
        <button
          onClick={() => {
            w.setBatch(true);
            w.setChecked(w.id ? [w.id] : []);
            w.go('compress');
          }}
        >
          <ListChecks size={17} />
          Batch processing
        </button>
      </div>
      <div className="shelf-heading">
        <h2>
          <Clock3 size={15} />
          Recent PDFs
        </h2>
        <button onClick={() => setLib(!lib)}>
          {lib ? 'Collapse' : 'Library'}
          <ChevronDown size={13} />
        </button>
      </div>
      {lib ? (
        <Library />
      ) : (
        <div className="mobile-recents">
          {[...w.docs]
            .sort((a, b) => (b.opened || b.created) - (a.opened || a.created))
            .slice(0, 3)
            .map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  w.select(d);
                  w.go('compress');
                }}
              >
                <Cover d={d} />
                <span>
                  <b>{d.name}</b>
                  <small>
                    {formatBytes(d.size)} · {d.pages} pages
                  </small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          {!w.docs.length && <p>Import a PDF to get started.</p>}
        </div>
      )}
      <details className="phone-collapse">
        <summary>
          <Activity size={15} />
          Recent activity <ChevronDown size={15} />
        </summary>
        <div className="phone-activity">
          {w.acts.length ? (
            w.acts.slice(0, 3).map((a) => (
              <button key={a.id} onClick={() => w.setDetail(a)}>
                {a.name} · {a.operation}
              </button>
            ))
          ) : (
            <p>Completed jobs will appear here.</p>
          )}
          <button className="v-btn" onClick={() => w.go('analytics')}>
            View analytics <ArrowUpRight size={14} />
          </button>
        </div>
      </details>
      <QuickTools />
    </>
  );
}
function ScanIcon() {
  return <Layers size={16} />;
}
