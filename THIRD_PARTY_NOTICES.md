# Third-party components

Production runtime dependencies are pinned in `package-lock.json` and `android/app/build.gradle.kts`. Runtime license texts are copied into `vendor/licenses/` in both the APK’s bundled workspace and the web distribution.

| Component | Use | License |
| --- | --- | --- |
| qpdf 12.2.0 | Structural packing, page operations, validation, AES-256 | Apache-2.0; see `public/QPDF-NOTICE.txt` |
| @neslinesli93/qpdf-wasm 0.3.1 | Emscripten build of qpdf | ISC wrapper; qpdf retains its original license |
| pdf-lib, @pdf-lib/standard-fonts, @pdf-lib/upng | PDF object editing, resources, font metrics | MIT |
| Mozilla PDF.js | Local preview, per-page text inspection, raster exports | Apache-2.0 |
| PDF.js standard fonts, CMaps, ICC data and codecs | Bundled rendering resources | Respective included notices, including Foxit, Liberation, OpenJPEG, JBIG2 and QCMS |
| fflate | Lossless streams and ZIP archives | MIT |
| pako, tslib | pdf-lib runtime dependencies | MIT / 0BSD; bundled copyright notices included |
| React, React DOM and scheduler | Shared workspace | MIT |
| Lucide | Interface icons | ISC and included icon notices |
| Inter and Manrope | Self-hosted typefaces | SIL Open Font License 1.1 |
| Kotlin, AndroidX / Jetpack Compose, WebKit and WorkManager | Android host and system integration | Apache-2.0 |
| Gradle wrapper | Build bootstrap | See `android/gradle/wrapper/LICENSE` |

The qpdf binary is distributed unmodified. The build adds an ES module export to its JavaScript loader and redirects CLI output to bounded in-memory callbacks. No runtime code is downloaded from a CDN. The project mark, drop-zone vector drawing, generated studio illustration, generated alpine landscape, Northline example documents and sample PDF are project assets.

Playwright, headless Chromium, Vite, TypeScript, Prettier and the Node canvas fixture generator are development tools and are not packaged as Android runtime libraries. See their upstream licenses when redistributing the build toolchain itself.
