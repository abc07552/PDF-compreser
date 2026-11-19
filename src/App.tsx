import { lazy, Suspense, useEffect } from 'react';
import {
  Activity,
  BarChart3,
  Check,
  CircleAlert,
  Clock3,
  Grid2X2,
  House,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react';
import { assetUrl } from './assets';
import { ActivityDetail, HistoryPage, Insights } from './components/activity';
import { Toolkit, ToolDialog } from './components/Toolkit';
import { WorkspaceProvider, useWorkspace } from './v6/workspace';
import { DesktopDashboard, Kicker, MobileDashboard, TabletDashboard } from './v6/Dashboards';
import { SettingsPage } from './v6/Settings';
import { Dialogs } from './v6/Dialogs';
const Preview = lazy(() => import('./components/Preview'));
const nav = [
  { id: 'home', label: 'Workspace', icon: LayoutDashboard },
  { id: 'tools', label: 'PDF tools', icon: Grid2X2 },
  { id: 'history', label: 'History', icon: Clock3 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
] as const;
const phone = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'compress', label: 'Compress', icon: Zap },
  { id: 'tools', label: 'PDF Tools', icon: Grid2X2 },
  { id: 'history', label: 'History', icon: Clock3 },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;
function Header() {
  const w = useWorkspace();
  return (
    <header className="v-header">
      <div className="header-wrap">
        <button className="v-brand" aria-label="PDF Reducer workspace" onClick={() => w.go('home')}>
          <img src={assetUrl('mark.svg')} alt="" />
          <span>PDF Reducer</span>
          <b>ULTRA V6</b>
        </button>
        {w.edition !== 'mobile' && (
          <nav className="top-nav" aria-label="Primary navigation">
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => w.go(id)}
                aria-current={
                  w.route === id || (w.route === 'compress' && id === 'home') ? 'page' : undefined
                }
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </nav>
        )}
        <div className="header-right">
          <button
            className="local-status"
            aria-label="Local engine privacy information"
            onClick={() => w.setModal('privacy')}
          >
            <i className="live-dot" />
            <span>Local engine</span>
          </button>
          <i />
          <button
            className={'settings-button ' + (w.route === 'settings' ? 'on' : '')}
            aria-label="Workspace settings"
            onClick={() => w.go('settings')}
          >
            <Settings size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
function Shell() {
  const w = useWorkspace();
  const desk = w.route === 'home' || w.route === 'compress';
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'o' &&
        !w.job &&
        !document.querySelector('[aria-modal=true]')
      ) {
        e.preventDefault();
        w.pick();
      } else if (
        e.key === '/' &&
        desk &&
        !['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName) &&
        !document.querySelector('[aria-modal=true]')
      ) {
        const input = document.querySelector<HTMLInputElement>('[aria-label="Search library"]');
        if (input) {
          e.preventDefault();
          input.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [w, desk]);
  return (
    <div className={`ultra edition-${w.edition}`} data-layout={w.edition}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to workspace
      </a>
      <Header />
      <input
        id="library-picker"
        hidden
        type="file"
        multiple
        accept="application/pdf,.pdf"
        aria-label="Import PDF files"
        onChange={(e) => {
          if (e.target.files?.length) void w.importFiles([...e.target.files]);
          e.target.value = '';
        }}
      />
      <main id="main-content" tabIndex={-1} className="v-main">
        {w.error && (
          <div role="alert" className="v-error">
            <CircleAlert size={16} />
            <span>{w.error}</span>
            <button aria-label="Dismiss error" onClick={() => w.setError('')}>
              <X size={15} />
            </button>
          </div>
        )}
        {w.job && (!desk || (w.edition === 'mobile' && w.route === 'home')) && (
          <div role="status" className="global-job">
            <Activity size={16} />
            {w.job.label} · {w.job.n}% <button onClick={w.cancel}>Cancel job</button>
          </div>
        )}
        {desk ? (
          w.edition === 'desktop' ? (
            <DesktopDashboard />
          ) : w.edition === 'tablet' ? (
            <TabletDashboard />
          ) : (
            <MobileDashboard />
          )
        ) : w.route === 'settings' ? (
          <SettingsPage />
        ) : (
          <div className="aux-page">
            <Kicker
              text={
                w.route === 'tools'
                  ? 'TOOL COLLECTION'
                  : w.route === 'history'
                    ? 'LOCAL RECORDS'
                    : 'WORKSPACE TELEMETRY'
              }
            />
            {w.route === 'tools' ? (
              <Toolkit onTool={w.openTool} />
            ) : w.route === 'history' ? (
              <HistoryPage
                activities={w.acts}
                onClear={() => w.setModal('clear')}
                onDetail={w.setDetail}
                onStudio={() => w.go('compress')}
              />
            ) : (
              <Insights activities={w.acts} />
            )}
          </div>
        )}
      </main>
      <footer className="v-footer">
        <span>
          <ShieldCheck size={13} /> On-device processing <i /> No uploads
        </span>
        <span>
          PDF REDUCER <b>/</b> UNIVERSAL EDITION <b>/</b> V6.0
        </span>
      </footer>
      {w.edition === 'mobile' && (
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {phone.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={w.route === id ? 'page' : undefined}
              onClick={() => w.go(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      )}
      {w.prefs.floating && w.job && (
        <button
          className="floating-job"
          aria-label={`Return to job at ${w.job.n}%`}
          onClick={() => w.go('compress')}
          style={{ background: `conic-gradient(var(--accent) ${w.job.n}%,var(--line) 0)` }}
        >
          <b>{w.job.n}%</b>
        </button>
      )}
      {w.toast && (
        <div className="v-toast" role="status">
          <Check size={15} />
          <span>{w.toast}</span>
          <button aria-label="Dismiss message" onClick={() => w.setToast('')}>
            <X size={14} />
          </button>
        </div>
      )}
      <Dialogs />
      {w.tool && (
        <ToolDialog
          key={w.tool}
          id={w.tool}
          onClose={() => w.setTool(null)}
          onPreview={w.setPreview}
          record={w.record}
          notify={w.notify}
          library={w.docs}
          getFile={w.fileOf}
          selectedId={w.id}
        />
      )}{' '}
      {w.detail && <ActivityDetail record={w.detail} onClose={() => w.setDetail(null)} />}{' '}
      {w.preview && (
        <Suspense fallback={<div className="v-toast">Opening preview…</div>}>
          <Preview req={w.preview} onClose={() => w.setPreview(null)} />
        </Suspense>
      )}
    </div>
  );
}
export default function App() {
  return (
    <WorkspaceProvider>
      <Shell />
    </WorkspaceProvider>
  );
}
