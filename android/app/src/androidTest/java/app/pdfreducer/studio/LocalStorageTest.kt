package app.pdfreducer.studio

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class LocalStorageTest {
    private val context get() = InstrumentationRegistry.getInstrumentation().targetContext
    @Test fun metadataRoundTripAndErase() {
        val s=ActivityStore(context,"test-activity.db")
        try { s.clear(); assertTrue(s.add("""{"id":"row","name":"guide.pdf","operation":"Compress PDF","input":4000,"output":1000,"pages":2,"at":1}""")); assertEquals(1000,JSONArray(s.list()).getJSONObject(0).getInt("output")); assertFalse(s.add("invalid")); s.clear(); assertEquals(0,JSONArray(s.list()).length()) } finally { s.close(); context.deleteDatabase("test-activity.db") }
    }
    @Test fun staleExportCleanupDoesNotTouchFreshExports() {
        val root=File(context.cacheDir,"exports"); val old=File(root,"test-old");val fresh=File(root,"test-new")
        try { old.mkdirs(); fresh.mkdirs(); File(old,"doc.pdf").writeText("test"); old.setLastModified(System.currentTimeMillis()-EXPORT_TTL-2000); cleanupExports(context); assertFalse(old.exists()); assertTrue(fresh.exists()) } finally { old.deleteRecursively();fresh.deleteRecursively() }
    }
    @Test fun appHasNoInternetPermission() { assertEquals(android.content.pm.PackageManager.PERMISSION_DENIED, context.checkSelfPermission(android.Manifest.permission.INTERNET)) }
}
