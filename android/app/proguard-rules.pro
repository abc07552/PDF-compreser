# Bridges are invoked by name by the bundled, same-origin workspace only.
-keepclassmembers class app.pdfreducer.studio.StudioBridge { @android.webkit.JavascriptInterface <methods>; }
-keep class app.pdfreducer.studio.ExportCleanupWorker { public <init>(android.content.Context, androidx.work.WorkerParameters); }
