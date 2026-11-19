# ULTRA V6 verification

This report covers the V6 application at [`29960a8`](https://github.com/abc07552/PDF-compreser/commit/29960a806eb66053602d51bbceadeb1613651d48) and the API 36 verification configuration at [`2cb0240`](https://github.com/abc07552/PDF-compreser/commit/2cb0240ad2fca8e390bc746b1ba350b09e76e287). Only the CI configuration changed between those commits. The batch regression test checks that the displayed KB/MB value updates immediately and an invalid draft still disables compression after a resize.

| Check | Observed result |
| --- | --- |
| Local `npm run check` / production build | Strict TypeScript and formatting passed. Vite generated the complete production application, PDF worker, archive worker, renderer, sample library and offline cache. |
| Local `npm test` | **50/50 passed**: 29 engine and 21 workspace tests in Chromium 143, using real workers/files and the production web app under `/PDF-compreser/`. [Full output](test-run.txt). |
| Offline and distributions | The 246 production files match byte-for-byte in `dist/`, Pages and the bundled Android workspace. We also extracted that workspace from the source ZIP, served it with Python’s static server, reloaded offline and compressed the Alpine report. The downloaded 163,324-byte output reopened with five pages. No public Pages deployment is claimed. |
| Production npm dependency audit | `npm audit --omit=dev` reported zero vulnerabilities at the time of the check. Not a security certification. |
| Hosted engine and web suite | **50/50 passed** in the [V6 engine CI job](https://github.com/abc07552/PDF-compreser/actions/runs/44451793611/job/135317281627) with the Playwright-pinned Chromium (2.5 minutes for the tests). |
| Android compile and lint | [V6 hosted Android job](https://github.com/abc07552/PDF-compreser/actions/runs/44451793611/job/135317281499) passed `:app:lintRelease`, `:app:assembleDebug`, `:app:assembleRelease` and `:app:assembleDebugAndroidTest`. |
| Installable test artifact | [`PDF-Reducer-ULTRA-V6-debug-APK`](https://github.com/abc07552/PDF-compreser/actions/runs/44451793611/artifacts/14495713438), artifact ID `14495713438`. Extract `app-debug.apk`. Development key, **not** an owner-signed distribution release. |
| Android 36 baseline | **5 passed, 2 skipped** on the [API 36 emulator](https://github.com/abc07552/PDF-compreser/actions/runs/44451793611/job/135317281684). SQLite v1 migration, metadata round-trip, private file storage, stale export cleanup and the no-INTERNET permission check passed. The provider was `com.google.android.webview` **133.0.6943.137**, below the required 143. Both the offline compression/rotation case and the compact→medium→expanded live-window case **skipped**. [Device test reports](https://github.com/abc07552/PDF-compreser/actions/runs/44451793611/artifacts/14496730081). |

The APK **artifact ZIP** is 14,508,337 bytes; the digest reported by the Actions API is `sha256:3a7b54e821010ec536844504e29358c3b1fd3c5830677721f5220c8ccdeba458`. This is not a signature or the checksum of the inner APK.

The [API 37.2 (16 KiB)](https://github.com/abc07552/PDF-compreser/actions/runs/44448573577/job/135306735381) and [API 37.0 (standard Google APIs)](https://github.com/abc07552/PDF-compreser/actions/runs/44450215347/job/135312011820) emulator jobs timed out during boot. **No application test ran on either image**: the rotation and live-window UI cases neither passed nor skipped there. The hosted baseline is pinned to API 36 instead of advancing to an untested image automatically.

### Worked output, not a promise

The shipping **Alpine Field Report** has five pages, vector text and a deliberately uncompressed photographic stream. The default Smart Auto profile with a 500 KB maximum produced **2,372,269 → 163,324 bytes**, saving 2,208,945 bytes (93.1%). The exported PDF reopened with five pages. The inspector found matching text and geometry and a 0.14% mean sampled RGB difference on its cover in this run. This measures that page’s reduced previews, not perceptual readability, universal compression ratios or an OCR score.

### Covered scenarios

- Real text, raster scans, mixed/image-heavy PDFs, a 30 MiB ten-page input, already compact, corrupt, non-PDF, encrypted and detected signed inputs. Worker cancellation and rejection above the 64 MiB input cap. Selectable text, URLs, page sizes and rotations checked on controlled fixtures, with decoded output streams and rendered pixels where appropriate.
- An impossible target reports a miss. Exact retries remain bounded; Clarity First maintains its quality floors. A 1000 MB requested maximum does not inflate the file. Government Form keeps an actual AcroForm field and its value. HD clarity and scan cleanup produce distinct embedded-image digests while preserving text/geometry.
- All twelve PDF operations. Order, per-page rotations, extracted subsets, split ZIP part counts, valid password and authorization requirements, JPEG/PNG/WebP conversions, metadata/watermarks, alpha preservation, grayscale and genuine 1-bit images.
- Browser: actual picker/import and drop; search, sort/filter controls, star/category, durable rename/copy/delete; history migration from v1, theme and opt-out, zero personal file blobs on session-only imports. A success and a refused signed document contribute correctly to separate analytics.
- Real linked before/after page inspection and downloads; reopened downloaded PDF and ZIP members. Personal backup/restore adds new document IDs, deduplicates history and rejects a damaged ZIP. Editor selection survives a layout transition; the separately exported edited copy has the expected rotation and page count.
- Production size classes at **320×640, 412×915, 540×720, 720×960, 768×1024, 915×412, 1024×1366, 1280×800 and 1600×1000** CSS pixels. Tests turn pages, open full-screen preview, use the chooser and toolbox, check horizontal bounds, retain settings and check the intended layout. A 30 MiB worker run continues through desktop→tablet→phone resize and navigation. Search shortcut, keyboard panel resize, a 2× density context, 130% root font sizing and narrow split-window equivalents are included. These represent viewports, **not** certifications for specific fold hinges or physical screen-inch sizes.

### Reproduce

```sh
npm ci
npm run check
npm test
# Or: npm test -- --project=engine
# Or: npm test -- --project=workspace
```

On x64 Linux the local test runner can use its bundled headless Chromium. Otherwise install the matching Playwright Chromium and, if necessary, set `BROWSER_EXECUTABLE`. Fixtures and traces stay under ignored `.artifacts/` and `test-results/`. CI installs the browser pinned by Playwright. Arena branch pushes and a manual **Verify studio and build Android** dispatch request instrumentation on a hosted emulator. The current workflow uses `system-images;android-36;google_apis;x86_64`, reports the installed WebView provider, and publishes case-level results, including skips. A missing instrumentation report fails verification.

## Device release checklist

No physical-device or supported-WebView Android UI pass is claimed. Before distributing a release:

1. Install the debug APK on a current WebView 143+ Android phone and tablet. Run `:app:connectedDebugAndroidTest`. The native suite exercises SQLite migrations, scoped copies, export cleanup, no INTERNET permission and a WebView compression/rotation smoke test. An additional check with `-Pandroid.testInstrumentationRunnerArguments.exerciseWindows=true` runs only on a disposable emulator: it changes the host display to compact, medium and expanded bounds within one activity session and restores the original density/size afterward. Both WebView tests explicitly skip on an older provider; a skip is not runtime verification.
2. Test touch, portrait/landscape, the actual system picker (including cancel, multi-select, images and ZIP), full-screen comparison, back navigation, font and display-size changes, and keyboard/mouse on a wide display. Drag the multi-window divider during a job. On a foldable check both a flat and a folded posture. V6 uses available window space, not a hinge-specific dual-screen API.
3. Test Android Save As cancellation, email/file-share targets, offline first launch, retained copies after restart, forgotten copies and confirmed deletion. Open exports in an independent reader; check business-critical forms, links, non-Latin fonts and rotated pages.
4. Validate behavior under low memory, large near-cap PDFs, app backgrounding and process death. Running jobs and unsaved results do **not** survive process death; consented library copies do. Check WorkManager cleanup of expired temporary exports.
5. Sign with the owner's key, verify the actual release signature, test the minified release on devices, and complete store privacy/distribution requirements. Build success alone is not a production sign-off.
