import { assetUrl } from './assets';
import { createRoot } from 'react-dom/client';
import { Component, type ReactNode } from 'react';
import App from './App';
import { preference } from './storage';
import './styles.css';
import './v6/ultra.css';
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="recovery">
        <img src={assetUrl('mark.svg')} width="48" alt="" />
        <h1>Let’s reopen your workspace.</h1>
        <p>The interface could not finish loading. Your original documents are unchanged.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload studio
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
document.documentElement.dataset.theme = preference('theme', 'dark');
createRoot(document.getElementById('root')!).render(
  <Boundary>
    {window.isSecureContext &&
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    crypto.subtle ? (
      <App />
    ) : (
      <main className="recovery">
        <img src={assetUrl('mark.svg')} width="48" alt="" />
        <h1>Open a secure workspace</h1>
        <p>
          Use the Android app or open this studio over HTTPS in a current browser. Local processing
          requires secure workers and cryptography. No documents have been opened.
        </p>
      </main>
    )}
  </Boundary>,
);
if (import.meta.env.PROD && 'serviceWorker' in navigator && !window.PdfNative)
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(assetUrl('sw.js')).catch(() => {
      /* Private browsing can disable offline caching. */
    });
  });
