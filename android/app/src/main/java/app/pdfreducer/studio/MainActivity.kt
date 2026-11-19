package app.pdfreducer.studio

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.content.res.Configuration
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.*
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewAssetLoader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File

private const val HOST = "appassets.androidplatform.net"
private const val HOME = "https://$HOST/index.html"

/** Compose hosts the shared offline studio. System pickers, SQLite and exports are native. */
class MainActivity : ComponentActivity() {
    private var browser: WebView? = null
    private var crashed by mutableStateOf(false)
    private var pendingSave: Export? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var bridge: StudioBridge
    private lateinit var store: ActivityStore
    private val picker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uris = mutableListOf<Uri>()
        val intent = result.data
        if (result.resultCode == Activity.RESULT_OK && intent != null) {
            intent.clipData?.let { clip -> for (i in 0 until minOf(clip.itemCount, 17)) clip.getItemAt(i).uri?.let(uris::add) }
            if (uris.isEmpty()) intent.data?.let(uris::add)
        }
        val safe = uris.filter { it.scheme == "content" && it.authority != "$packageName.exports" }.distinct().toTypedArray()
        fileCallback?.onReceiveValue(safe.takeIf { it.isNotEmpty() }); fileCallback = null
    }
    private val savePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val item = pendingSave ?: return@registerForActivityResult
        pendingSave = null
        val uri = result.data?.data
        lifecycleScope.launch {
            val message = withContext(Dispatchers.IO) {
                try {
                    if (result.resultCode != Activity.RESULT_OK || uri?.scheme != "content") "Save cancelled."
                    else {
                        val output = contentResolver.openOutputStream(uri, "wt") ?: error("Destination unavailable")
                        output.use { out -> item.file.inputStream().use { it.copyTo(out, 64 * 1024) } }
                        "File saved to your chosen location."
                    }
                } catch (e: Exception) { "Save failed. Check free space and choose a writable destination." }
                finally { item.file.parentFile?.deleteRecursively() }
            }
            notifyWorkspace(message)
        }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        store = ActivityStore(applicationContext)
        bridge = StudioBridge(applicationContext, store) { item -> runOnUiThread { offerExport(item) } }
        savedInstanceState?.getString("stagedExport")?.let { path ->
            val f = File(path).canonicalFile
            if (f.path.startsWith(File(cacheDir, "exports").canonicalPath + File.separator) && f.isFile) pendingSave = Export(f, if (f.extension == "zip") "application/zip" else "application/pdf", false)
        }
        lifecycleScope.launch(Dispatchers.IO) { cleanupExports(applicationContext) }
        val webVersion = WebView.getCurrentWebViewPackage()?.versionName?.substringBefore('.')?.toIntOrNull() ?: 0
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                var exitDialog by remember { mutableStateOf(false) }
                Surface(Modifier.fillMaxSize()) {
                    Box(Modifier.fillMaxSize().safeDrawingPadding()) {
                        if (webVersion < 143 || crashed) {
                            Column(Modifier.align(Alignment.Center).padding(28.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                                Text("PDF MB Reducer AI ULTRA V6", style = MaterialTheme.typography.headlineSmall)
                                Text(if (crashed) "The document workspace closed under memory pressure. Your original files are unchanged. Reopen it and choose a smaller file." else "Update Android System WebView or Chrome to version 143 or later, then reopen the app. The local PDF engine needs a current WebView.")
                                Button(onClick = { if (crashed) crashed = false else finish() }) { Text(if (crashed) "Reopen workspace" else "Close") }
                            }
                        } else AndroidView(factory = { makeStudio() }, modifier = Modifier.fillMaxSize())
                    }
                }
                BackHandler {
                    val view = browser
                    if (view == null) finish() else view.evaluateJavascript("Boolean(window.studioBack && window.studioBack())") { if (it != "true") exitDialog = true }
                }
                if (exitDialog) AlertDialog(onDismissRequest = { exitDialog = false }, title = { Text("Close workspace?") }, text = { Text("Unexported results and running jobs will be discarded. Your original files and saved copies are safe.") }, confirmButton = { TextButton(onClick = { finish() }) { Text("Close workspace") } }, dismissButton = { TextButton(onClick = { exitDialog = false }) { Text("Keep working") } })
            }
        }
    }
    private fun offerExport(item: Export) {
        if (isDestroyed || isFinishing) { item.file.parentFile?.deleteRecursively(); return }
        try {
            if (item.share) {
                val uri = FileProvider.getUriForFile(this, "$packageName.exports", item.file)
                val send = Intent(Intent.ACTION_SEND).setType(item.mime).putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                send.clipData = ClipData.newRawUri("PDF Reducer export", uri)
                startActivity(Intent.createChooser(send, "Share a copy"))
            } else {
                check(pendingSave == null)
                pendingSave = item
                savePicker.launch(Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(item.mime).putExtra(Intent.EXTRA_TITLE, item.file.name))
            }
        } catch (e: Exception) {
            if (pendingSave == item) pendingSave = null
            item.file.parentFile?.deleteRecursively()
            notifyWorkspace("No compatible destination is available. Try saving to another location.")
        }
    }
    private fun notifyWorkspace(message: String) {
        browser?.evaluateJavascript("window.dispatchEvent(new CustomEvent('native-export-message',{detail:${JSONObject.quote(message)}}))", null)
    }
    private fun denied(status: Int = 403) = WebResourceResponse("text/plain", "UTF-8", status, if (status == 404) "Not Found" else "Forbidden", emptyMap(), ByteArrayInputStream(ByteArray(0)))
    @SuppressLint("SetJavaScriptEnabled")
    private fun makeStudio(): WebView {
        val loader = WebViewAssetLoader.Builder().setDomain(HOST).addPathHandler("/owned/") { name ->
            val file = if(name.endsWith(".pdf")) bridge.library.open(name.removeSuffix(".pdf")) else null
            if(file == null) denied(404) else try { WebResourceResponse("application/pdf", null, 200, "OK", mapOf("Cache-Control" to "no-store", "X-Content-Type-Options" to "nosniff"), file.inputStream()) } catch(e: Exception) { denied(404) }
        }.addPathHandler("/") { path ->
            val name = path.ifEmpty { "index.html" }
            if (name.contains("..") || name.startsWith('/') || name.contains('\\')) denied() else try {
                val mime = when (name.substringAfterLast('.')) {
                    "js", "mjs" -> "text/javascript"; "wasm" -> "application/wasm"; "css" -> "text/css"; "html" -> "text/html"; "woff2" -> "font/woff2"; "woff" -> "font/woff"; "webp" -> "image/webp"; "jpg" -> "image/jpeg"; "png" -> "image/png"; "svg" -> "image/svg+xml"; "pdf" -> "application/pdf"; "webmanifest", "json" -> "application/json"; else -> "application/octet-stream"
                }
                WebResourceResponse(mime, if (mime.startsWith("text/")) "UTF-8" else null, 200, "OK", mapOf("X-Content-Type-Options" to "nosniff", "Content-Security-Policy" to "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' blob: data:; connect-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"), assets.open("workspace/$name"))
            } catch (e: Exception) { denied(404) }
        }.build()
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        return WebView(this).apply {
            browser = this
            settings.javaScriptEnabled = true
            settings.textZoom = (resources.configuration.fontScale * 100).toInt()
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = true // Only picker-granted content URIs; never remote navigation.
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.setGeolocationEnabled(false)
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)
            addJavascriptInterface(bridge, "PdfNative")
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = request.url.scheme != "https" || request.url.host != HOST || request.url.path != "/index.html"
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse = if (request.url.scheme == "https" && request.url.host == HOST) loader.shouldInterceptRequest(request.url) ?: denied(404) else denied()
                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    (view.parent as? ViewGroup)?.removeView(view); view.destroy(); browser = null; bridge.abortExport(); bridge.abortLibraryFile(); crashed = true; return true
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) = request.deny()
                override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
                    fileCallback?.onReceiveValue(null); fileCallback = callback
                    val image = params.acceptTypes.any { it.contains("image/") }
                    val zip = params.acceptTypes.any { it.contains("zip") }
                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(if (image) "image/*" else if(zip) "application/zip" else "application/pdf").putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE)
                    if (image) intent.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/png", "image/jpeg", "image/webp"))
                    try { picker.launch(intent) } catch (e: Exception) { fileCallback = null; callback.onReceiveValue(null); notifyWorkspace("No system file picker is available.") }
                    return true
                }
            }
            loadUrl(HOME)
        }
    }
    override fun onConfigurationChanged(newConfig: Configuration) { super.onConfigurationChanged(newConfig); browser?.settings?.textZoom = (newConfig.fontScale*100).toInt() }
    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); pendingSave?.let { outState.putString("stagedExport", it.file.path) } }
    override fun onDestroy() {
        fileCallback?.onReceiveValue(null); fileCallback = null
        browser?.apply { removeJavascriptInterface("PdfNative"); stopLoading(); (parent as? ViewGroup)?.removeView(this); destroy() }; browser = null
        bridge.abortExport(); bridge.abortLibraryFile(); store.close(); super.onDestroy()
    }
}
