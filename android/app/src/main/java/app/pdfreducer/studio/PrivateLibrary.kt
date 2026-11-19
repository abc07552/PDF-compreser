package app.pdfreducer.studio

import android.content.Context
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/** IDs, never caller-supplied paths. Streams are bounded and copies become visible only after verification. */
internal class PrivateLibrary(context: Context, private val store: ActivityStore, directory: File = File(context.noBackupFilesDir, "library-v6")) {
    private val dir = directory.apply { mkdirs() }
    private var pending: File? = null
    private var stream: FileOutputStream? = null
    private var bytes = 0L
    init { dir.listFiles()?.filter { it.extension == "part" || (it.extension == "pdf" && !store.has(it.nameWithoutExtension)) }?.forEach { it.delete() } }
    @Synchronized fun open(id: String): File? = if(ownedId.matches(id) && store.has(id)) File(dir, "$id.pdf").takeIf { it.isFile } else null
    @Synchronized fun begin(id: String): Boolean {
        if(stream!=null || !ownedId.matches(id) || store.has(id) || File(dir,"$id.pdf").exists()) return false
        return runCatching { require((dir.listFiles()?.size ?: 0)<64); pending=File(dir,"$id.part"); stream=FileOutputStream(pending!!); bytes=0; true }.getOrElse { abort(); false }
    }
    @Synchronized fun append(data: String): Boolean = runCatching {
        require(data.length<=65536); val chunk=Base64.decode(data,Base64.DEFAULT); bytes+=chunk.size; require(bytes<=64L*1024*1024); (stream?:error("No private copy")).write(chunk); true
    }.getOrElse { abort(); false }
    @Synchronized fun finish(json: String): Boolean = runCatching {
        val temp=pending?:error("Missing private copy"); val doc=JSONObject(json); val id=doc.getString("id"); require(id==temp.nameWithoutExtension && doc.getBoolean("saved") && doc.getLong("size")==bytes)
        require((dir.listFiles()?.sumOf { it.length() } ?: 0L)<=256L*1024*1024); stream?.close(); stream=null
        val dest=File(dir,"$id.pdf"); check(!dest.exists() && temp.renameTo(dest)); pending=null
        if(!store.putRecord(json)){dest.delete();error("Record not saved")}; true
    }.getOrElse { abort(); false }
    @Synchronized fun abort() { runCatching { stream?.close() }; stream=null; pending?.delete(); pending=null; bytes=0 }
    @Synchronized fun remove(id: String): Boolean = runCatching { require(ownedId.matches(id)); val file=File(dir,"$id.pdf"); check(!file.exists() || file.delete()); store.removeRecord(id); true }.getOrDefault(false)
}
