# Privacy and local data lifecycle

**No account, telemetry, advertising SDK, document upload endpoint, cloud AI or backend is part of this application.** “AI” refers to deterministic, on-device analysis and adaptive profile selection, not sending PDF text or images to a model.

### Input and computation

Only files the user chooses or drops are opened. The six Northline starter files (and the legacy sample) are generated, non-personal documents. The Android app has no INTERNET or broad external-storage permission. Its WebView serves APK assets from the private HTTPS app-assets origin, denies remote navigation and iframe content, disallows file URLs/mixed content, disables remote debugging in release builds, and exposes the native bridge only to that bundled workspace. Screen capture and recent-app snapshots are blocked on Android.

Session-only imports, passwords, candidate PDFs and private preview images live in the processing session. An imported original is copied to durable app storage **only** when explicitly retained. Short-lived workers are terminated, WASM files unlinked, render tasks destroyed, bitmaps closed and object URLs revoked. Removing a file or closing the workspace releases its references. Garbage-collected memory and OS-managed caches are not a promise of forensic secure erasure.

### What is remembered

- **Library:** by default personal imports live only until the session closes. **Settings → Keep imported PDFs** opts in for future imports (including restored or edited copies). A single document can also be kept or forgotten in **Document actions**. Turning off future retention does not erase already-saved copies. Confirmed removal deletes that library copy and temporary result, not the original outside the app.
- **Storage:** Android v2 SQLite contains library metadata, preferences and job receipts; explicitly retained input files are written in bounded chunks under random IDs in `noBackupFilesDir`. No customer-supplied path is used. The Android app disables OS backup and serves owned bytes only through its restricted local PDF handler. The browser has versioned IndexedDB `activity`, `library` and `files` stores. Browser storage can be evicted by the browser; export your own backups. App-private storage is **not a separate encrypted vault**.
- **History:** records contain names, operations, status, profile, page count, timestamps and byte counts—not file contents or passwords. **Settings → Remember file activity** stops future recording. **History → Clear history** erases receipts and resets receipt-based analytics, not the library. Opening/modification state on retained library records is separate from job history. No seeded user analytics.
- **Backups:** exporting a V6 backup deliberately includes personal library bytes (including session files), preferences and existing history in an **unencrypted ZIP**. Temporary compressed outputs and bundled samples are excluded. Restore accepts the bounded V6 archive format, validates PDFs before import, uses fresh IDs, merges nonduplicate history only if enabled, and never silently enables retention. Backups and exported PDFs remain in the destination you chose.

### Save and share

Android stages explicit exports under a unique directory in the app-private cache. Input filenames are sanitized. Save uses the system document picker and bounded streaming, not unrestricted storage access. Save completion/cancellation removes the staged copy. Sharing grants a read-only content URI for the exported file; temporary copies are eligible for deletion after one hour. WorkManager schedules cleanup, and the next app start also sweeps stale files. Android can defer scheduled work.

A saved document belongs to the destination the user chose. Sharing hands a copy to the recipient application. Cloud document providers and share destinations have their own retention and network policies; this app cannot revoke copies they have already made.

Browser downloads and Web Share use local Blob/File objects. File-share controls are offered only when supported. If none is shown, save a copy and attach it using the device’s email/file application. The PWA service worker caches a build-time allowlist of **application assets only**, not arbitrary requests or user files. Opening a hosted web workspace naturally requests its application assets from that host.

### Protected documents

Unlocking requires the user to confirm authorization and provide a valid password. There is no password recovery, guessing or cracking tool. Editing a digitally signed PDF invalidates its signature, so detected signed documents are refused for modification. Removing metadata does not remove visible or hidden personal information in all document content.
