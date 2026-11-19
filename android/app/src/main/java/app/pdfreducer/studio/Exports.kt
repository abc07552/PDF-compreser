package app.pdfreducer.studio

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Base64
import android.webkit.JavascriptInterface
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.TimeUnit

internal const val EXPORT_TTL = 60 * 60 * 1000L
internal data class Export(val file: File, val mime: String, val share: Boolean)
internal fun cleanupExports(context: Context, now: Long = System.currentTimeMillis()) {
    File(context.cacheDir, "exports").listFiles()?.filter { now - it.lastModified() >= EXPORT_TTL }?.forEach { it.deleteRecursively() }
}
class ExportCleanupWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result = runCatching { cleanupExports(applicationContext); Result.success() }.getOrElse { Result.retry() }
}
internal class StudioBridge(private val context: Context, private val store: ActivityStore, private val export: (Export) -> Unit) {
    internal val library = PrivateLibrary(context, store)
    @JavascriptInterface fun canShareFile(mime: String): Boolean = mime in setOf("application/pdf", "application/zip") && context.packageManager.queryIntentActivities(Intent(Intent.ACTION_SEND).setType(mime), PackageManager.MATCH_DEFAULT_ONLY).isNotEmpty()
    @JavascriptInterface fun libraryRecords(): String = store.records()
    @JavascriptInterface fun patchLibraryRecord(base: String, delta: String): Boolean = store.patchRecord(base,delta)
    @JavascriptInterface fun saveLibraryRecord(json: String): Boolean = store.putRecord(json)
    @JavascriptInterface fun removeLibraryRecord(id: String): Boolean = library.remove(id)
    @JavascriptInterface fun beginLibraryFile(id: String): Boolean = library.begin(id)
    @JavascriptInterface fun appendLibraryChunk(data: String): Boolean = library.append(data)
    @JavascriptInterface fun finishLibraryFile(meta: String): Boolean = library.finish(meta)
    @JavascriptInterface fun abortLibraryFile() = library.abort()
    @JavascriptInterface fun setting(key: String): String = store.setting(key)
    @JavascriptInterface fun setSetting(key: String, value: String): Boolean = store.setSetting(key, value)
    private var stream: FileOutputStream? = null
    private var staged: Export? = null
    private var size = 0L
    @JavascriptInterface fun activities(): String = store.list()
    @JavascriptInterface fun addActivity(data: String): Boolean = store.add(data)
    @JavascriptInterface fun clearActivities() = store.clear()
    @Synchronized @JavascriptInterface fun beginExport(name: String, type: String, share: Boolean): Boolean {
        if (staged != null || type !in setOf("application/pdf", "application/zip")) return false
        return runCatching {
            val ext = if (type == "application/pdf") "pdf" else "zip"
            val clean = name.substringBeforeLast('.').replace(Regex("[^\\p{L}\\p{N} ._()-]"), "_").take(100).trim('.',' ').ifBlank { "Document" }
            val dir = File(File(context.cacheDir, "exports"), UUID.randomUUID().toString())
            check(dir.mkdirs())
            val file = File(dir, "$clean.$ext")
            staged = Export(file, type, share)
            stream = FileOutputStream(file)
            size = 0
            WorkManager.getInstance(context).enqueue(OneTimeWorkRequestBuilder<ExportCleanupWorker>().setInitialDelay(65, TimeUnit.MINUTES).build())
            true
        }.getOrElse { abortExport(); false }
    }
    @Synchronized @JavascriptInterface fun appendChunk(data: String): Boolean = runCatching {
        require(data.length <= 65536)
        val bytes = Base64.decode(data, Base64.DEFAULT)
        size += bytes.size
        require(size <= 128L * 1024 * 1024)
        (stream ?: error("No export")).write(bytes)
        true
    }.getOrElse { abortExport(); false }
    @Synchronized @JavascriptInterface fun finishExport() {
        val ready = staged ?: return
        try { stream?.close(); stream = null; staged = null; export(ready) }
        catch (e: Exception) { ready.file.parentFile?.deleteRecursively(); throw e }
    }
    @Synchronized @JavascriptInterface fun abortExport() { runCatching { stream?.close() }; stream = null; staged?.file?.parentFile?.deleteRecursively(); staged = null }
}
