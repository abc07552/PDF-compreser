# Engine and architecture

## Why a hybrid Android application?

The native Android application is written in Kotlin with a Jetpack Compose lifecycle and recovery/exit UI. A same-origin, **APK-bundled** workspace provides the editing surface through `AndroidView` and `WebViewAssetLoader`. The same implementation can run in a browser without using a remote service. Native SAF picking/saving, FileProvider sharing, SQLite, WorkManager cleanup and Android back navigation are not simulated web buttons.

PDF processing is a shared TypeScript + WebAssembly engine: **qpdf 12.2.0**, **pdf-lib**, **Mozilla PDF.js** and **fflate**. The preview is the actual processing application, not a visual replica of another product. Native APKs do not start a localhost server or load a remote website.

## Pipeline

1. **Preflight.** Check supported extensions, file count, byte limits, header, parser validity and page count. Reject encrypted inputs for editing and reject detected signed PDFs rather than silently invalidating a signature. No password guessing.
2. **Analyze.** Inspect image streams, page geometry and bounded samples of page content for text operators. Estimate likely text, scanned, image-heavy or mixed content. Estimate image cost separately from non-image structure, considering source encoding, image dimensions, sample contrast for raw images, DPI and quality. These are broad estimates and not a trained-model confidence score, OCR result or guarantee.
3. **Try lossless first.** Compare a qpdf structural candidate for color image documents. If it already meets the requested maximum, stop without degrading images. Otherwise retain it as a candidate while testing the configured profile. Text-only documents do not get rasterized.
4. **Optimize eligible images.** Read ordinary 8-bit RGB/gray JPEG, unfiltered and Flate image XObjects. Supported PNG row predictors are decoded. Use bounded canvases, high-quality downsampling, JPEG encoding and explicit cleanup. JPEG dimensions are checked before decoding. Do not enlarge images. The DPI long-edge budget is based on the largest physical page, not an exact measurement of every nested image transform.
5. **Color options.** Grayscale uses luminance. Black-and-white thresholds eligible raster images into packed, 1-bit DeviceGray Flate streams. Basic page RGB, CMYK and gray paint operators are neutralized without rewriting text strings, glyph positions or the active color-space family. Comments, names, string literals and inline images are not interpreted as paint commands. Specialty color spaces, shadings, appearance streams and masks are preserved, not guessed at. This is not a certified color-managed prepress converter.
6. **Remove redundancy.** Share identical image/font programs only when both their SHA-256 content hash and stream dictionary match. Remove document metadata references; qpdf prunes unreachable objects and unused page resources, repacks object streams and recompresses eligible Flate streams. Font programs are preserved rather than blindly re-subsetted.
7. **Retry and choose.** For an unmet target with eligible image content, a maximum of two additional progressively smaller DPI/quality attempts can run. Each reads the original, avoiding compounded JPEG degradation. Keep the smallest valid candidate without exceeding the original size. The original wins if no improvement exists. A requested color transformation can therefore be declined in favor of an unchanged original; that state is explicitly labeled.
8. **Validate and export.** Reopen output, compare page count, dimensions and rotation, then use qpdf’s structural/stream validation. No partially written candidate is offered. Locked outputs are checked using their supplied password. Display measured bytes and achieved savings, not an estimate disguised as a result.

All heavy compression/mutation happens in a **dedicated worker** with an isolated WASM filesystem. Job completion, cancellation, errors and timeout terminate the worker. Input buffers and intermediate paths are never server-side files. A batch processes sequentially. PDF.js has its own parsing worker; page previews and image exports render one requested page at a time, with cancellation and bounded canvas sizes.

## Presets

| Profile | Image resolution ceiling | JPEG quality |
| --- | --- | --- |
| Recommended | Scans: 150 DPI; image-heavy: 120 DPI; mixed: 180 DPI; text: structural optimization | 70% for scan/image profiles, 82% for mixed |
| Balanced | 150 DPI | 78% |
| High | 120 DPI | 60% |
| Extreme | 72 DPI | 38% |
| Custom | 72, 96, 120, 150, 200 or 300 DPI | 10–100% |

A target retry can go below the initial settings (not below 72 DPI / 10% quality). Disable retries to keep the initial profile. JPEG quality does not apply to 1-bit Flate output. The UI reports the selected result strategy; **lossless** can beat a lossy candidate on flat graphics.

## Tool behavior

- **Merge:** selected file order, with the first PDF as the primary document. **Split:** sequential page groups, each reopened to verify its page count before packaging into a ZIP. **Extract:** explicit ordered page/range list.
- **Organize:** move, exclude and rotate pages; larger documents use an ordered range editor and global rotation. Page selection/merging is not a promise to combine every secondary document’s outlines, accessibility tree or AcroForm namespace. Inspect complex interactive forms after edits.
- **PDF to images:** PNG, JPEG or WebP; selected page range, DPI ceiling and ZIP export. **Images to PDF:** JPEG/PNG/WebP, one image per A4 page with orientation-aware sizing, white background and margins.
- **Protect:** AES-256 encryption with a user-supplied password (at least eight characters; maximum 127 UTF-8 bytes). **Unlock:** explicit authorization plus the correct password. Checks occur before attempting decryption. Passwords are never persisted.
- **Watermark:** diagonal text on all pages, configurable opacity, automatically fitted width. The embedded standard font supports WinAnsi/Latin text; unsupported glyphs produce an actionable error rather than missing characters.
- **Remove metadata:** clears Info properties and common XMP/PieceInfo references and rewrites reachable objects. Not anonymization or redaction; comments, attachments, visible identifiers and application-specific payloads can remain.
- **Preview/compare:** render locally with linked before/after page navigation, zoom and actual sizes. Documents are not stored in history for later reopening.

WebP is used for image export/input, **not** embedded as a nonstandard PDF image codec. PDF image optimization uses interoperable JPEG or Flate streams.

## Deliberate safety limits

| Resource | Limit |
| --- | --- |
| Single input | 64 MiB |
| Batch | 16 files, 128 MiB total |
| Pages per PDF/result | 1,500 |
| Mutating worker time | 3 minutes per file/tool job |
| Decoding an embedded image for optimization | 12 megapixels; larger ones are retained |
| Individual input photo for PDF creation | 16 megapixels |
| Render/resample output canvas | 4 megapixels; maximum dimension 5,000 px |
| Image ZIP export | 120 pages, 64 MiB of encoded images |
| Split ZIP export | 200 parts, 64 MiB total parts |
| Android export staging | 48 KiB per bridge chunk; 128 MiB maximum |

The UI’s KB and MB labels use 1,024-based units. Unsupported JPEG2000, JBIG2, ICC/CMYK, transparent/masked and unusual image encodings are not forcibly replaced. Some are viewable through the bundled PDF.js decoders. Preview is not a full PDF/A, XFA, 3D, embedded-JavaScript, signature or accessibility conformance validator. Oversized images can be omitted by the safety-limited preview renderer; always inspect specialty documents in their intended reader.

Keep the workspace open until a job completes. Workers avoid blocking the interface; they are **not** durable, OS-resumable compression jobs. Android may reclaim the renderer. The recovery screen lets the user reopen the studio; originals remain safe. This intentionally avoids retaining sensitive input PDFs on disk for job recovery. Safety limits reduce memory pressure but cannot guarantee that arbitrary malicious or enormous PDFs will fit on every device.
