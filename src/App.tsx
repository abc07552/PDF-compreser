import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cpu,
  Grid2X2,
  HardDrive,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Moon,
  PanelLeft,
  ShieldCheck,
  Sun,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { getTool } from './catalog';
import type { ToolId } from './engine/types';
import {
  clearActivities,
  listActivities,
  preference,
  saveActivity,
  setPreference,
  type Activity,
} from './storage';
import Studio from './components/Studio';
import { ActivityDetail, HistoryPage, Insights } from './components/activity';
import { Toolkit, ToolDialog } from './components/Toolkit';
import { Brand, IconBox, Modal, Notice, type PreviewRequest } from './components/Common';
const Preview = lazy(() => import('./components/Preview'));
const nav = [
  { id: 'studio', label: 'Compression studio', small: 'Studio', icon: LayoutDashboard },
  { id: 'toolbox', label: 'PDF toolbox', small: 'Toolbox', icon: Grid2X2 },
  { id: 'history', label: 'File history', small: 'History', icon: Clock3 },
  { id: 'insights', label: 'Usage insights', small: 'Insights', icon: BarChart3 },
] as const;
type Route = (typeof nav)[number]['id'];
const getRoute = (): Route =>
  nav.find((n) => n.id === location.hash.replace(/^#\/?/, ''))?.id || 'studio';
export default function App() {
  const [route, setRoute] = useState<Route>(getRoute),
    [theme, setTheme] = useState(() => preference('theme', 'light')),
    [drawer, setDrawer] = useState(false),
    [dialog, setDialog] = useState<'guide' | 'privacy' | 'clear' | null>(null),
    [activeTool, setTool] = useState<ToolId | null>(null),
    [preview, setPreview] = useState<PreviewRequest | null>(null),
    [detail, setDetail] = useState<Activity | null>(null),
    [activities, setActivities] = useState<Activity[]>([]),
    [remember, setRemember] = useState(() => preference('remember', 'yes') === 'yes'),
    [toast, setToast] = useState(''),
    [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((s: string) => {
    clearTimeout(toastTimer.current);
    setToast(s);
    toastTimer.current = setTimeout(() => setToast(''), 8500);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    setPreference('theme', theme);
  }, [theme]);
  useEffect(() => {
    listActivities()
      .then(setActivities)
      .catch((e) => notify(e.message));
    const handler = () => {
      setRoute(getRoute());
      setDrawer(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, [notify]);
  useEffect(() => {
    if (!drawer) return;
    const previous = document.activeElement as HTMLElement | null;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = document.querySelector<HTMLElement>('.drawer');
    root?.querySelector<HTMLElement>('.mobile-close')?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false);
      if (e.key === 'Tab') {
        const buttons = root?.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener('keydown', handle);
      previous?.focus();
    };
  }, [drawer]);
  const go = (r: Route) => {
    location.hash = '/' + r;
    setRoute(r);
    setDrawer(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const openTool = (t: ToolId) => {
    if (busy && t !== 'compress') {
      notify('Finish or cancel the current compression job before starting another tool.');
      return;
    }
    setDrawer(false);
    if (t === 'compress') go('studio');
    else setTool(t);
  };
  const record = useCallback(
    (a: Activity) => {
      if (!remember) return;
      setActivities((old) => [a, ...old]);
      saveActivity(a).catch(() =>
        notify('The file is ready, but its activity record could not be saved.'),
      );
    },
    [remember, notify],
  );
  useEffect(() => {
    window.studioBack = () => {
      if (preview) setPreview(null);
      else if (detail) setDetail(null);
      else if (activeTool) setTool(null);
      else if (dialog) setDialog(null);
      else if (drawer) setDrawer(false);
      else if (route !== 'studio') go('studio');
      else return false;
      return true;
    };
    return () => {
      delete window.studioBack;
    };
  }, [preview, detail, activeTool, dialog, drawer, route]);
  useEffect(() => {
    const f = (e: Event) => notify((e as CustomEvent<string>).detail);
    window.addEventListener('native-export-message', f);
    return () => window.removeEventListener('native-export-message', f);
  }, [notify]);
  const routeLabel = nav.find((n) => n.id === route)!.label;
  const side = (
    <>
      <div className="brand-row">
        <Brand />
        <button
          className="icon-button mobile-close"
          aria-label="Close menu"
          onClick={() => setDrawer(false)}
        >
          <X size={17} />
        </button>
      </div>
      <div className="sidebar-inner">
        <div className="nav-group-label">WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${id === route ? 'active' : ''}`}
              aria-current={id === route ? 'page' : undefined}
              onClick={() => go(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'toolbox' && <b className="nav-count">12</b>}
              {id === 'studio' && busy && <span className="working-dot" />}
            </button>
          ))}
        </nav>
        <div className="side-rule" />
        <div className="nav-group-label quick-label">QUICK TOOLS</div>
        <nav aria-label="Quick PDF tools">
          {(['merge', 'split', 'from-images', 'protect'] as ToolId[]).map((id) => {
            const t = getTool(id);
            return (
              <button className="nav-item quick-item" key={id} onClick={() => openTool(id)}>
                <span className={`quick-icon ${t.color}`}>
                  <t.icon size={16} />
                </span>
                {t.label}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="privacy-card"
            onClick={() => {
              setDialog('privacy');
              setDrawer(false);
            }}
          >
            <span className="privacy-card-title">
              <ShieldCheck size={16} />
              Private workspace
            </span>
            <span>Local processing. No uploads.</span>
            <i className="privacy-watermark">
              <ShieldCheck size={59} />
            </i>
          </button>
          <div className="theme-switch" role="group" aria-label="Color theme">
            <button
              aria-pressed={theme === 'light'}
              onClick={() => setTheme('light')}
              className={theme === 'light' ? 'active' : ''}
            >
              <Sun size={15} />
              Light
            </button>
            <button
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme('dark')}
              className={theme === 'dark' ? 'active' : ''}
            >
              <Moon size={14} />
              Dark
            </button>
          </div>
          <div className="sidebar-version">
            <span>PDF MB REDUCER</span>
            <span>v1.0</span>
          </div>
        </div>
      </div>
    </>
  );
  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">{side}</aside>
      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace menu"
            onClick={(e) => e.stopPropagation()}
          >
            {side}
          </aside>
        </div>
      )}
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <PanelLeft size={17} />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <b>{routeLabel}</b>
          </div>
          <div className="mobile-brand">
            <button
              className="icon-button"
              aria-label="Open workspace menu"
              onClick={() => setDrawer(true)}
            >
              <Menu size={19} />
            </button>
            <Brand />
          </div>
          <div className="topbar-right">
            <button className="engine-status" onClick={() => setDialog('privacy')}>
              <i />
              Local engine ready
            </button>
            <span className="top-divider" />
            <button
              className="help-button"
              aria-label="Help and instructions"
              onClick={() => setDialog('guide')}
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div hidden={route !== 'studio'}>
            <Studio
              activities={activities}
              record={record}
              onGuide={() => setDialog('guide')}
              onHistory={() => go('history')}
              onDetail={setDetail}
              onPreview={setPreview}
              notify={notify}
              onBusy={setBusy}
            />
          </div>
          {route === 'toolbox' && <Toolkit onTool={openTool} />}{' '}
          {route === 'history' && (
            <HistoryPage
              activities={activities}
              onDetail={setDetail}
              onClear={() => setDialog('clear')}
              onStudio={() => go('studio')}
            />
          )}{' '}
          {route === 'insights' && <Insights activities={activities} />}
          <footer className="main-footer">
            <span>
              <Layers3 size={13} />
              PDF MB Reducer AI PRO
            </span>
            <span>
              <LockKeyhole size={12} />
              Offline-first workspace
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile workspace navigation">
        {nav.map(({ id, small, icon: Icon }) => (
          <button
            key={id}
            className={route === id ? 'active' : ''}
            aria-current={route === id ? 'page' : undefined}
            onClick={() => go(id)}
          >
            <Icon size={18} />
            {small}
          </button>
        ))}
      </nav>
      {dialog === 'guide' && (
        <Modal
          title="Your compression guide"
          eyebrow="STUDIO HANDBOOK"
          onClose={() => setDialog(null)}
        >
          <div className="modal-body">
            <p className="dialog-desc">From a large document to a lighter copy in three steps.</p>
            <div className="guide-steps">
              {[
                [
                  '01',
                  'Choose your PDFs',
                  'Browse, drop files, or try the bundled sample. The local engine inspects text and images and recommends a profile.',
                ],
                [
                  '02',
                  'Set your balance',
                  'Use Recommended for an adaptive profile, or Custom for DPI, image quality and color. A size target can trigger up to two smaller retries.',
                ],
                [
                  '03',
                  'Compare and save',
                  'Compare pages and verified file sizes, then download or share. Your originals are never overwritten.',
                ],
              ].map(([n, t, d]) => (
                <div key={n}>
                  <b>{n}</b>
                  <div>
                    <h3>{t}</h3>
                    <p>{d}</p>
                  </div>
                </div>
              ))}
            </div>
            <Notice>
              Targets are estimates, not guarantees. Already-optimized files may not shrink. Text
              and complex images are not rasterized just to hit a target.
            </Notice>
            <details className="guide-details">
              <summary>Limits and protected documents</summary>
              <p>
                Up to 64 MB per file, 128 MB per batch, 16 files and 1,500 pages per PDF. Keep the
                app open while processing. Unsupported image encodings are preserved. Signed
                documents are not edited. Unlock protected PDFs only with permission and the correct
                password.
              </p>
            </details>
            <button className="button primary full" onClick={() => setDialog(null)}>
              Got it
              <Check size={15} />
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'privacy' && (
        <Modal title="Private by design" eyebrow="LOCAL WORKSPACE" onClose={() => setDialog(null)}>
          <div className="modal-body">
            <div className="privacy-hero">
              <IconBox icon={ShieldCheck} tone="teal" />
              <div>
                <h3>Your documents stay yours.</h3>
                <p>No accounts, uploads or cloud AI.</p>
              </div>
            </div>
            <div className="privacy-points">
              <p>
                <Cpu size={18} />
                <span>
                  <b>On-device intelligence</b>A rule-based analyzer selects profiles from the PDF’s
                  structure. No document content is sent to an AI service.
                </span>
              </p>
              <p>
                <HardDrive size={18} />
                <span>
                  <b>Temporary by default</b>Documents stay in working memory. Android discards
                  private export files after saving or on a timed cleanup after sharing.
                </span>
              </p>
              <p>
                <WifiOff size={18} />
                <span>
                  <b>Offline capable</b>The Android app bundles every engine and font. The installed
                  web app also works offline after its first full cache.
                </span>
              </p>
            </div>
            <label className="remember-setting">
              <span>
                <b>Remember file activity</b>
                <small>Store only names, sizes, page counts and dates.</small>
              </span>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => {
                  setRemember(e.target.checked);
                  setPreference('remember', e.target.checked ? 'yes' : 'no');
                }}
              />
            </label>
            <button
              className="small-link"
              onClick={() => {
                setDialog(null);
                go('history');
              }}
            >
              Manage local history
              <ArrowRight size={14} />
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'clear' && (
        <Modal title="Clear local history?" onClose={() => setDialog(null)}>
          <div className="modal-body">
            <p className="dialog-desc">
              This removes all activity records and resets usage statistics. Your downloaded files
              are not affected. This cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="button ghost" onClick={() => setDialog(null)}>
                Keep history
              </button>
              <button
                className="button danger"
                onClick={async () => {
                  try {
                    await clearActivities();
                    setActivities([]);
                    setDialog(null);
                    notify('Local history cleared.');
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                <Trash2 size={15} />
                Clear history
              </button>
            </div>
          </div>
        </Modal>
      )}
      {detail && <ActivityDetail record={detail} onClose={() => setDetail(null)} />}{' '}
      {activeTool && (
        <ToolDialog
          id={activeTool}
          key={activeTool}
          onClose={() => setTool(null)}
          onPreview={setPreview}
          record={record}
          notify={notify}
        />
      )}{' '}
      {preview && (
        <Suspense
          fallback={
            <Modal title="Opening preview…" onClose={() => setPreview(null)}>
              <div className="modal-body">Loading the local renderer.</div>
            </Modal>
          }
        >
          <Preview req={preview} onClose={() => setPreview(null)} />
        </Suspense>
      )}
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
