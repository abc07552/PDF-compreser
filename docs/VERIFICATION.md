# Verification report

**Executed 18 November 2026.** Linux x86-64, Node.js 22.22.3, TypeScript 5.9.3, headless Chromium 143, Playwright 1.58.2, and qpdf 12.2.0 WebAssembly. The engine tests use real documents and workers; the interface tests use a production build. No compression service or mocked compression response is used.

| Check | Result in this environment |
| --- | --- |
| `npm run check` | Passed strict type checking, unused-import checks and source formatting. |
| `npm run build` | Passed; creates the complete static application and versioned offline asset cache. |
| `npm test` | **35 passed:** 25 engine cases and 10 workspace/integration cases. [Full test run](test-run.txt). |
| Offline reload, sample analysis and compression | Passed under the GitHub Pages project path `/PDF-compreser/` with the browser network disabled after initial installation. The PWA scope, launch URL and cached asset URLs were checked. |
| Responsive layouts | Passed at 320×640, 360×800, 412×915, 768×1024 and 915×412 CSS pixels. These are browser viewport tests, **not physical-device tests**. |
| `npm audit --omit=dev` | No reported production npm dependency advisories at verification time. This is not a security certification. |
| Android compile and lint | [GitHub Actions Android job](https://github.com/abc07552/PDF-compreser/actions/runs/44268047786/job/134677381984) passed `lintRelease`, `assembleDebug`, `assembleRelease` and `assembleDebugAndroidTest`. A development-signed APK was uploaded to the run. |
| Device instrumentation and production signing | **Not executed** in the reported run. The emulator tests and release signing instructions are provided. |

## Measured compression examples

Actual byte counts below were measured with this engine. The corpus is generated test material, including intentionally uncompressed image data. **These ratios are not representative promises about customer documents.** Photographs already encoded as optimized JPEGs, JBIG2 scans and mostly-vector documents can shrink very little.

| Fixture | Pages | Input bytes | Output bytes | Winning strategy |
| --- | ---: | ---: | ---: | --- |
| Bundled field guide: illustration, text and link | 2 | 1,969,629 | 9,105 | Lossless structure |
| Text, different page dimensions, link, rotated page | 3 | 2,504 | 1,354 | Lossless structure |
| Synthetic raster scan | 1 | 2,521,254 | 12,887 | High; one image optimized |
| Image-heavy fixture | 1 | 678,050 | 7,159 | Extreme; four images optimized |
| Large multi-page image document | 10 | 31,463,132 | 150,265 | High; ten images optimized |
| Compact valid PDF | 1 | 324 | 324 | Original retained byte-for-byte |

### What is asserted

- The mixed-document output keeps page count, geometry, rotation, extracted text and link URLs. A rendered-pixel error bound is checked; text-only rendering has zero pixel difference on its comparison page.
- A real DCT/JPEG image is downsampled from 1,440×960 to 480×320 at the Extreme preset. A PNG Sub-predictor image produces an actual 1-bit Flate image in black-and-white mode. A transparent image with a soft mask remains visually identical.
- A deliberately unattainable 100-byte target returns a verified file with `targetMet: false` after three image passes. An already-small input does not grow.
- The 30 MiB fixture completes. An input exceeding 64 MiB is rejected, and explicit cancellation terminates its worker. This is not a peak-RSS benchmark on every Android device.
- Non-PDF bytes, corrupt structure, protected documents and detected signatures do not enter the ordinary compression path as editable PDFs.
- Encryption/decryption round-trips, encrypted object streams, wrong password and absent authorization are tested. Range parsing, merge order, ZIP splits, extraction, rotation, watermark text, metadata erasure, PDF/image conversion and preview are exercised.
- End-to-end tests inspect a result, navigate comparison pages, download a PDF, reload persisted metadata, opt out of history, clear history and compress a batch with a custom target.

## Reproduce

```sh
npm ci
npm run check
npm test
# A focused group, if needed:
npm test -- --project=engine
```

The fixture generator recreates local test files under `.artifacts/fixtures/`. These files and diagnostic traces are not part of the release archive. Tests start temporary servers on ports 4198 and 4199 and close them when finished. `scripts/prepare-assets.mjs` generates the public example without using a customer file.

The full development dependency audit also flags a **build-time** `picomatch` advisory through Vite's glob tooling. It is not a shipped browser/Android runtime dependency. Use only trusted source/build inputs, do not deploy the dev server, and recheck dependencies before distributing a release.

## Device release checklist

These checks require a real Android build environment. They are release gates, not claims of completed device testing.

1. Build the debug and release variants and run Android lint using the pinned Gradle wrapper. Confirm the merged manifest has no INTERNET or broad external-storage permission.
2. Run `:app:connectedDebugAndroidTest` on a current-WebView Android emulator/device. Native tests cover SQLite insertion/erasure, temporary export cleanup, the permission boundary, sample compression and rotation. The engine smoke test skips on an outdated WebView; **a skip is not a passing device smoke test**.
3. On a phone, test portrait/landscape and system light/dark settings, native back navigation, file picker cancellation, multi-select, password entry, save destination cancellation, and read-only sharing to another app.
4. Test airplane-mode first launch, a 30 MiB scan, a file near the input cap, repeated cancellation/retry and behavior under memory pressure. Expect the app to refuse unsuitable files rather than promise universal large-file support.
5. Verify saved files in an independent PDF reader. Inspect text, URLs, non-Latin embedded fonts, crop boxes, rotated pages, photos, scans, masks and any business-critical forms. Exported files should open without repair warnings.
6. Verify unexported documents disappear after process death, filenames/history opt-out works, and expired private staging directories are cleaned on startup and by scheduled work. Ensure deliberately shared/saved files remain where the user chose.
7. Sign with the owner's release key, verify the signature, test the minified release on a device and complete the store's privacy/Data Safety disclosures. Never ship or publish a debug-signed APK as a production release.
