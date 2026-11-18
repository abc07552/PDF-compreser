# Publish the browser studio on GitHub Pages

The web app is static. Its PDF engine runs in the visitor’s browser, not on GitHub’s servers. The checked-in `docs/index.html` and its assets are the production build, so first-time publication does not require Node, an Android SDK, a token or a custom workflow.

1. Open [this repository’s Pages settings](https://github.com/abc07552/PDF-compreser/settings/pages) as a repository administrator.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose **main** and **/docs**, then **Save**.
4. Wait for **pages build and deployment** in the repository’s **Actions** tab to finish. **Visit site** in Pages settings is the authoritative live URL. For this repository the default address is **https://abc07552.github.io/PDF-compreser/**.
5. Open **Try a sample → Compress PDFs → Compare** to check the deployed engine and renderer. Once the offline cache has finished installing, reload offline and repeat.

The site will not be online until Pages is enabled and the first deployment succeeds. Do not use the repository root or GitHub’s source-file viewer as the publishing source.

## Updating the published build

After changing the workspace or engine, use Node.js 22.12+ and run `npm ci`, `npm test`, then `npm run pages:build`. Commit the source and the regenerated `docs/` files together. An update to the selected publishing branch will then deploy automatically. `docs/.nojekyll` tells Pages to serve the build as static files.

The build is relocatable: asset URLs, WASM, PDF.js resources, the PWA manifest and the offline cache resolve under the app’s installation directory. The service worker uses only its own scope and allowlisted app assets. Documents are not included in the offline cache. Browser storage is origin-based; use a separately trusted origin if you operate other, untrusted sites on the same Pages account.

Pages hosts the **web application**, not an APK installer. See [ANDROID.md](ANDROID.md) for the native Android build.
