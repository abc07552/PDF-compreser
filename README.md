# PDF MB Reducer AI ULTRA V6 — Universal Responsive Edition

A local PDF workspace for **Android 10+** (Kotlin / Jetpack Compose host) and **desktop, tablet or phone browsers** (an installable web app). Opening a file does not upload it. The six Northline starter documents are real, bundled example PDFs; the preview, processing results, analytics and exports are live.

![V6 desktop workspace rendering the Alpine Field Report with library and compression controls](docs/studio.webp)

## Get started

- **Android test APK:** [Download the V6 build artifact](https://github.com/abc07552/PDF-compreser/actions/runs/44451793611/artifacts/14495713438) from the [successful Android build](https://github.com/abc07552/PDF-compreser/actions/runs/44451793611/job/135317281499). Sign in to GitHub if requested, extract the artifact ZIP and install `app-debug.apk`. It is development-signed, not a store release. See [beginner install, build and signing instructions](docs/ANDROID.md).
- **V6 source and prebuilt desktop site:** [Download the V6 source ZIP](deliverables/PDF-MB-Reducer-AI-ULTRA-V6-source.zip). It contains the project, Android Gradle wrapper, tests, guides and the ready-to-serve offline workspace. It is **not** an APK. The [SHA-256 checksum](deliverables/SHA256SUMS.txt) is for this source ZIP, not the Android build.
- **Desktop/tablet browser:** with Node 22.12+ installed, run `npm ci`, `npm run build`, then `npm run preview`. Open the printed address in current Chromium. In Chrome, use **Install app** when offered. The PWA is the desktop platform; there is no native Windows/macOS executable. [Static hosting and Pages instructions](docs/PAGES.md).

**Desktop without rebuilding:** the V6 source ZIP already contains a static site. Extract it, open a terminal in `android/app/src/main/assets/workspace/`, run `python -m http.server 8080 --bind 127.0.0.1` with Python 3, and open `http://localhost:8080/` in Chromium. No APK, Android emulator or account is needed. Open the app over localhost/HTTPS, not by double-clicking `index.html`.

**First compression:** on a phone tap **Compress**; on a wider window use the open workspace. Select *Alpine Field Report.pdf* or import your own PDF. Enter a maximum size (KB or MB), choose **Smart Auto**, then **Compress PDF**. **Compare** renders both copies and checks the selected page. Choose **Save copy**, or **Share** where file sharing is supported. Save results before closing the app.

## One model, three layouts

| Available space | Presentation |
| --- | --- |
| Compact | Home dashboard with recent PDFs, savings, quick compression, Clarity First and batch entry; bottom navigation for Home, Compress, PDF Tools, History and Settings. Compression and full-screen preview are one tap away. |
| Medium / short landscape | Resizable library beside a selected-document column containing preview, editing, compression and delivery. |
| Expanded | Three simultaneous panels: library, PDF workspace and compression/delivery. Keyboard search, page navigation, drag/drop, zoom and visual page editing. |

Layout is selected from **window space**, not user-agent or device name. The provider holding files, results, batch selection, page/zoom, settings, library filters and running workers lives above all three presentations. Android orientation and multi-window changes resize the same WebView. Device/OS process death is different from resizing: unsaved session data is lost. Libraries are local to a browser profile or Android install, not automatically synchronized between devices.

## What V6 does

- **Document library:** import, drop, search, sort, category filters, starred files, recent selections, rendered covers, size/page count, text-layer detection and processed status. Document actions include rename, copy, save/forget a private copy, export, supported share and confirmed removal. Originals are not overwritten.
- **Compression:** 1 KB–1000 MB targets (1,024-based units), Auto, unit conversion and legacy quick sizes. Smart Auto classifies the PDF; Clarity First protects resolution and JPEG quality. Government Form uses structural-only packing on AcroForms. Balanced, High, Extreme, Recommended and Custom DPI/quality/color remain available. Compare profile estimates under Advanced settings.
- **Enhancement:** bounded HD sharpening or scan contrast cleanup on eligible opaque images; no page flattening or remote AI. Exact Target adds bounded retry profiles. It does **not** pad files to a byte count or guarantee a target. A result that cannot safely beat the original retains its bytes.
- **Editing:** thumbnails, multi-select, drag or keyboard reorder, rotate, remove and extract into **new copies**. The 12-tool collection also includes merge, ZIP split, PDF↔images, authorized unlock, AES-256 protection, watermark and metadata removal. PDF tools can use library documents or new picker files.
- **Delivery and inspection:** real worker progress and measured candidate sizes; original/output bytes, saved bytes/percentage and target outcome; linked before/after rendering and page-level geometry, selectable-text and sampled pixel comparison. Sequential batches can export completed PDFs together as a ZIP. Android uses SAF Save As and the system share sheet (including compatible email apps); supported browsers use download/Web Share. There is no unconfigured cloud or SMTP button.
- **Local records and backup:** daily/monthly activity, successful/failed/cancelled jobs, profile counts and mean reduction. Savings exclude failed jobs. Backup/restore personal PDFs, settings and history using an explicitly exported, **unencrypted** V6 ZIP. Restore adds new copies and retains the current privacy permissions.

## Privacy and limits

File-byte retention is **off by default**. Use **Settings → Keep imported PDFs**, or **Document actions → Keep on this device**, to opt in. Android uses SQLite and app-private, non-backed-up files; the browser uses IndexedDB. Existing PRO history migrates without deleting records. Activity metadata has its own opt-out and confirmed clear action. See [data lifecycle and export permissions](docs/PRIVACY.md).

**Input limits:** 64 MiB per PDF; 16 files / 128 MiB per batch; 1,500 pages; bounded image sizes; three-minute worker timeout. The 1000 MB target selector is not 1 GB input support. Keep the app open for processing: WorkManager cleans temporary exports, not resumable compression jobs. Text-layer detection is not OCR, HD is not a generative super-resolution model, and the app cannot recover passwords, verify digital signatures or guarantee accessibility/PDF-A compliance. Inspect important forms in their intended reader. [Engine design and limits](docs/ENGINE.md).

## Build and verify

```sh
npm ci                     # Node.js 22.12+
npm run dev                # development, no service worker
npm run check              # strict TypeScript + formatting
npm test                   # real engine + production responsive UI; ports 4198/4199
npm run pages:build        # static build in dist/ and relocatable copy in docs/
npm run android:sync       # stage the same offline build into the APK project
cd android
./gradlew :app:assembleDebug  # Windows: gradlew.bat :app:assembleDebug
```

The debug APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Android build prerequisites: JDK 17, SDK platform 36, Build Tools 35.0.0, Gradle wrapper 8.13. The first build needs network access; the **installed Android app has no INTERNET permission** and works offline from first launch. The web app needs an initial HTTPS/localhost visit to cache its runtime. `npm run package:source` rebuilds the source delivery. [Verification results and remaining device release checks](docs/VERIFICATION.md).

## Source map

| Path | Responsibility |
| --- | --- |
| `src/v6/workspace.tsx`, `types.ts` | Shared application model, document lifecycle, navigation, selection, job orchestration and preferences |
| `src/v6/Dashboards.tsx`, `Library.tsx`, `DocumentView.tsx`, `Compression.tsx` | Phone, tablet and desktop presentations built from shared interactive panels |
| `src/v6/Dialogs.tsx`, `Settings.tsx`, `ui.tsx`, `ultra.css` | Page editor and file actions, privacy controls, accessible UI primitives and themes |
| `src/engine/` | Worker lifecycle, local analysis, selective image optimization/enhancement, qpdf validation, transforms and PDF.js rendering |
| `src/storage.ts`, `src/v6/archive*` | SQLite/native or IndexedDB/browser adapters, export and bounded cancellable backup/ZIP workers |
| `src/components/`, `src/catalog.ts` | Toolbox, comparison viewer, history and analytics |
| `android/app/src/main/` | Compose host, native pickers, SQLite v1→v2, scoped private library, share grants and cleanup |
| `scripts/`, `public/` | Reproducible local PDF examples, real rendered covers, vendor assets, offline build and packaging |
| `tests/`, `android/app/src/androidTest/` | Generated PDF fixtures, engine/production UI integration and native instrumentation |

The upgrade is based on the **AI PRO** code actually present in this repository. It reuses its engine and tools; no separate V5 source tree or proprietary V5 model was available. See [third-party notices](THIRD_PARTY_NOTICES.md).
