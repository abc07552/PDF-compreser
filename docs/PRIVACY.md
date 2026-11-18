# Privacy and local data lifecycle

**No account, telemetry, advertising SDK, document upload endpoint, cloud AI or backend is part of this application.** “AI” refers to deterministic, on-device analysis and adaptive profile selection, not sending PDF text or images to a model.

### Input and computation

Only files the user chooses or drops are opened. The bundled example is a generated, non-personal document. The Android app has no INTERNET or broad external-storage permission. Its WebView serves APK assets from the private HTTPS app-assets origin, denies remote navigation and iframe content, disallows file URLs/mixed content, disables remote debugging in release builds, and exposes the native bridge only to that bundled workspace. Screen capture and recent-app snapshots are blocked on Android.

Selected documents, passwords, candidate PDFs and preview data live in the processing session. Short-lived workers are terminated, WASM files unlinked, render tasks destroyed, bitmaps closed and object URLs revoked. Removing a file or closing the workspace releases its references. Garbage-collected memory and OS-managed caches are not a promise of forensic secure erasure.

### What is remembered

Activity records contain a document name, operation, byte counts, page count and timestamp. **No PDF bytes, paths or passwords** are stored in activity history. Records use SQLite on Android and IndexedDB in a browser. Theme and the activity preference are local settings. Savings and charts are computed from retained compression records, not synthetic sample metrics.

Select **Private workspace** or **Local engine ready → Remember file activity** to disable future recording. Existing records are not silently erased by this switch. **File history → Clear history** explicitly erases records and resets their statistics. Uninstalling the Android app or clearing the site’s data also removes local records. Do not rely on clearing history to delete copies you exported.

### Save and share

Android stages explicit exports under a unique directory in the app-private cache. Input filenames are sanitized. Save uses the system document picker and bounded streaming, not unrestricted storage access. Save completion/cancellation removes the staged copy. Sharing grants a read-only content URI for the exported file; temporary copies are eligible for deletion after one hour. WorkManager schedules cleanup, and the next app start also sweeps stale files. Android can defer scheduled work.

A saved document belongs to the destination the user chose. Sharing hands a copy to the recipient application. Cloud document providers and share destinations have their own retention and network policies; this app cannot revoke copies they have already made.

Browser downloads and Web Share use local Blob/File objects. If file sharing is unavailable, the UI explains how to download and share through the device instead. The PWA service worker caches a build-time allowlist of **application assets only**, not arbitrary requests or user files. Opening a hosted web workspace naturally requests its application assets from that host.

### Protected documents

Unlocking requires the user to confirm authorization and provide a valid password. There is no password recovery, guessing or cracking tool. Editing a digitally signed PDF invalidates its signature, so detected signed documents are refused for modification. Removing metadata does not remove visible or hidden personal information in all document content.
