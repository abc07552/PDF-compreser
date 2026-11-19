import {
  Database,
  Download,
  HardDrive,
  History,
  MonitorSmartphone,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useWorkspace } from './workspace';
import { Head, Switch } from './ui';
import { Kicker } from './Dashboards';
export function SettingsPage() {
  const w = useWorkspace();
  return (
    <>
      <Kicker text="PREFERENCES" />
      <div className="page-head">
        <div>
          <h1>
            Workspace settings<span>.</span>
          </h1>
          <p>Control what stays on this device and how your studio works.</p>
        </div>
      </div>
      <div className="v-setting-grid">
        <section className="v-panel">
          <Head title="Privacy & storage" icon={ShieldCheck} />
          <div className="setting-body">
            <div>
              <span>
                <b>Keep imported PDFs</b>
                <small>
                  Off by default. When enabled, new imports are copied to this device’s private
                  library until you remove them. Turning this off does not delete existing copies.
                </small>
              </span>
              <Switch
                label="Keep imported PDFs"
                on={w.prefs.keep}
                onChange={() => w.pref({ keep: !w.prefs.keep })}
                disabled={!!w.job}
              />
            </div>
            <div>
              <span>
                <b>Remember file activity</b>
                <small>
                  Save file names, operation status and size statistics locally. Turn off to stop
                  new history and analytics records.
                </small>
              </span>
              <Switch
                label="Remember file activity"
                on={w.prefs.remember}
                onChange={() => w.pref({ remember: !w.prefs.remember })}
              />
            </div>
            <button
              className="v-btn"
              disabled={!w.acts.length || !!w.job}
              onClick={() => w.setModal('clear')}
            >
              <History size={15} />
              Clear history
            </button>
          </div>
        </section>
        <section className="v-panel">
          <Head title="Appearance" icon={MonitorSmartphone} tone="purple" />
          <div className="setting-body">
            <div>
              <span>
                <b>Dark appearance</b>
                <small>Switch between the midnight and daylight themes.</small>
              </span>
              <Switch
                label="Dark appearance"
                on={w.prefs.theme === 'dark'}
                onChange={() => w.pref({ theme: w.prefs.theme === 'dark' ? 'light' : 'dark' })}
              />
            </div>
            <div>
              <span>
                <b>Floating job indicator</b>
                <small>
                  Show live progress while navigating or scrolling. Tap it to return to compression.
                </small>
              </span>
              <Switch
                label="Floating job indicator"
                on={w.prefs.floating}
                onChange={() => w.pref({ floating: !w.prefs.floating })}
              />
            </div>
          </div>
        </section>
        <section className="v-panel">
          <Head title="Backup & restore" icon={Database} tone="blue" />
          <div className="setting-body">
            <p>
              Export your personal library (including session files), settings and history to an{' '}
              <b>unencrypted ZIP</b>. Store it somewhere safe. Bundled samples and temporary outputs
              are not included.
            </p>
            <div className="v-actions">
              <button className="v-btn" disabled={!!w.job} onClick={() => void w.makeBackup()}>
                <Download size={15} />
                Export backup
              </button>
              <button className="v-btn" disabled={!!w.job} onClick={() => w.setModal('restore')}>
                <Upload size={15} />
                Restore backup
              </button>
            </div>
          </div>
        </section>
        <section className="v-panel">
          <Head title="Engine information" icon={HardDrive} tone="mint" />
          <div className="setting-body">
            <b>PDF MB Reducer AI ULTRA V6</b>
            <p>
              Universal Responsive Edition · Local PDF processing. Up to 64 MB per input, 16 files /
              128 MB per batch. Keep this workspace open until the job finishes.
            </p>
            <p>
              Text-layer detection is not OCR. HD clarity sharpens supported images; it does not
              reconstruct missing information.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
