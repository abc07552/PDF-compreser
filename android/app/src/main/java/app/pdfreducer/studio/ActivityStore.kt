package app.pdfreducer.studio

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject

/** Metadata only. The schema deliberately has no blob, document path or password column. */
class ActivityStore(context: Context, name: String = "studio-activity.db") : SQLiteOpenHelper(context, name, null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE activity (id TEXT PRIMARY KEY, name TEXT NOT NULL, operation TEXT NOT NULL, input INTEGER NOT NULL, output INTEGER NOT NULL, pages INTEGER NOT NULL, at INTEGER NOT NULL)")
        db.execSQL("CREATE INDEX activity_date ON activity(at DESC)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit // First schema version.
    fun add(json: String): Boolean = runCatching {
        require(json.length <= 4096)
        val a = JSONObject(json)
        val values = ContentValues().apply {
            for (key in listOf("id", "name", "operation")) put(key, a.getString(key).take(300))
            for (key in listOf("input", "output", "pages", "at")) put(key, a.getLong(key).also { require(it >= 0) })
        }
        writableDatabase.insertWithOnConflict("activity", null, values, SQLiteDatabase.CONFLICT_REPLACE) >= 0
    }.getOrDefault(false)
    fun list(): String {
        val result = JSONArray()
        readableDatabase.query("activity", null, null, null, null, null, "at DESC").use { c ->
            while (c.moveToNext()) {
                val row = JSONObject()
                for (key in listOf("id", "name", "operation")) row.put(key, c.getString(c.getColumnIndexOrThrow(key)))
                for (key in listOf("input", "output", "pages", "at")) row.put(key, c.getLong(c.getColumnIndexOrThrow(key)))
                result.put(row)
            }
        }
        return result.toString()
    }
    fun clear() { writableDatabase.delete("activity", null, null) }
}
