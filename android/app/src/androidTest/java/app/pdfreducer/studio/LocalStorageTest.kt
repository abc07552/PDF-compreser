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
    @Test fun proActivityMigratesWithoutErasingHistory() {
        val name="test-v1-migration.db";context.deleteDatabase(name)
        context.openOrCreateDatabase(name,android.content.Context.MODE_PRIVATE,null).use { db ->
            db.execSQL("CREATE TABLE activity(id TEXT PRIMARY KEY,name TEXT,operation TEXT,input INTEGER,output INTEGER,pages INTEGER,at INTEGER)")
            db.execSQL("INSERT INTO activity VALUES('v1','old.pdf','Compress PDF',10,5,1,1)");db.version=1
        }
        val s=ActivityStore(context,name);try { val row=JSONArray(s.list()).getJSONObject(0);assertEquals("old.pdf",row.getString("name"));assertEquals("success",row.getString("status"));assertEquals(0,JSONArray(s.records()).length()) } finally {s.close();context.deleteDatabase(name)}
    }
    @Test fun privateCopiesAreBoundedAndExplicit() {
        val store=ActivityStore(context,"test-library.db"); val lib=PrivateLibrary(context,store,File(context.cacheDir,"test-library-v6")); val id=java.util.UUID.randomUUID().toString()
        try {
            assertNull(lib.open(id)); assertFalse(lib.begin("invalid")); assertTrue(lib.begin(id)); assertTrue(lib.append(android.util.Base64.encodeToString("data".toByteArray(),android.util.Base64.NO_WRAP)))
            assertTrue(lib.finish("""{"id":"$id","saved":true,"size":4,"name":"test.pdf","pages":1}""")); assertEquals("data",lib.open(id)?.readText()); assertFalse(lib.begin(id)); assertTrue(lib.remove(id)); assertNull(lib.open(id))
            assertTrue(store.setSetting("selected","seed-alpine")); assertEquals("seed-alpine",store.setting("selected"))
        } finally { lib.abort(); lib.remove(id); store.close();context.deleteDatabase("test-library.db") }
    }
    @Test fun appHasNoInternetPermission() { assertEquals(android.content.pm.PackageManager.PERMISSION_DENIED, context.checkSelfPermission(android.Manifest.permission.INTERNET)) }
}
