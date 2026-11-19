package app.pdfreducer.studio

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

internal val ownedId = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
private val starterIds = setOf("alpine", "quarterly", "agreement", "invoices", "survey", "permit")
/** Version 2 keeps all PRO activity. Only metadata is stored here; explicitly retained PDFs live in noBackupFilesDir. */
class ActivityStore(context: Context, name: String = "studio-activity.db") : SQLiteOpenHelper(context, name, null, 2) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE activity (id TEXT PRIMARY KEY, name TEXT NOT NULL, operation TEXT NOT NULL, input INTEGER NOT NULL, output INTEGER NOT NULL, pages INTEGER NOT NULL, at INTEGER NOT NULL)")
        db.execSQL("CREATE INDEX activity_date ON activity(at DESC)")
        installV2(db)
    }
    private fun installV2(db: SQLiteDatabase) {
        db.execSQL("ALTER TABLE activity ADD COLUMN status TEXT NOT NULL DEFAULT 'success'")
        db.execSQL("ALTER TABLE activity ADD COLUMN profile TEXT NOT NULL DEFAULT ''")
        db.execSQL("CREATE TABLE library (id TEXT PRIMARY KEY NOT NULL, record TEXT NOT NULL)")
        db.execSQL("CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) { if (oldVersion < 2) installV2(db) }
    fun add(json: String): Boolean = runCatching {
        require(json.length <= 4096)
        val a = JSONObject(json)
        val values = ContentValues().apply {
            for (key in listOf("id", "name", "operation")) put(key, a.getString(key).take(300))
            for (key in listOf("input", "output", "pages", "at")) put(key, a.getLong(key).also { require(it >= 0) })
            put("profile", a.optString("profile", "").take(100)); put("status", a.optString("status", "success").also { require(it in setOf("success", "failed", "cancelled")) })
        }
        writableDatabase.insertWithOnConflict("activity", null, values, SQLiteDatabase.CONFLICT_REPLACE) >= 0
    }.getOrDefault(false)
    fun list(): String {
        val result = JSONArray()
        readableDatabase.query("activity", null, null, null, null, null, "at DESC").use { c ->
            while (c.moveToNext()) {
                val row = JSONObject()
                for (key in listOf("id", "name", "operation", "status", "profile")) row.put(key, c.getString(c.getColumnIndexOrThrow(key)))
                for (key in listOf("input", "output", "pages", "at")) row.put(key, c.getLong(c.getColumnIndexOrThrow(key)))
                result.put(row)
            }
        }
        return result.toString()
    }
    fun clear() { writableDatabase.delete("activity", null, null) }
    fun records(): String = JSONArray().also { rows -> readableDatabase.rawQuery("SELECT record FROM library", null).use { c -> while(c.moveToNext()) rows.put(JSONObject(c.getString(0))) } }.toString()
    fun has(id: String): Boolean = readableDatabase.rawQuery("SELECT 1 FROM library WHERE id=?", arrayOf(id)).use { it.moveToFirst() }
    fun putRecord(json: String): Boolean = runCatching {
        require(json.length <= 4096)
        val obj = JSONObject(json); val id = obj.getString("id")
        val sample = obj.optString("sample", "")
        require((sample in starterIds && id == "seed-$sample") || (sample.isEmpty() && ownedId.matches(id) && obj.getBoolean("saved")))
        require(obj.getLong("size") in 1..64L*1024*1024 && obj.getInt("pages") in 1..1500 && obj.getString("name").length in 1..200)
        val values = ContentValues().apply { put("id", id); put("record", obj.toString()) }
        writableDatabase.insertWithOnConflict("library", null, values, SQLiteDatabase.CONFLICT_REPLACE) >= 0
    }.getOrDefault(false)
    fun patchRecord(base: String, delta: String): Boolean = runCatching {
        require(base.length <= 4096 && delta.length <= 1024)
        val fallback=JSONObject(base); val changes=JSONObject(delta); val id=fallback.getString("id"); val db=writableDatabase;db.beginTransaction()
        try {
            val row=db.rawQuery("SELECT record FROM library WHERE id=?",arrayOf(id)).use { if(it.moveToFirst()) JSONObject(it.getString(0)) else fallback.also { require(it.has("sample")) } }
            require(!row.optBoolean("removed")); changes.keys().forEach { key-> require(key in setOf("name","favorite","category","lastRun","opened"));row.put(key,changes.get(key)) }
            check(putRecord(row.toString()));db.setTransactionSuccessful();true
        } finally {db.endTransaction()}
    }.getOrDefault(false)
    fun removeRecord(id: String) { writableDatabase.delete("library", "id=?", arrayOf(id)) }
    fun setting(key: String): String = readableDatabase.rawQuery("SELECT value FROM settings WHERE key=?",arrayOf(key)).use { if(it.moveToFirst()) it.getString(0) else "" }
    fun setSetting(key: String, value: String): Boolean = runCatching {
        require(key in setOf("ultra-prefs", "selected", "theme", "remember") && value.length<=8192)
        val v=ContentValues().apply { put("key", key); put("value", value) }
        writableDatabase.insertWithOnConflict("settings", null, v, SQLiteDatabase.CONFLICT_REPLACE)>=0
    }.getOrDefault(false)
}
