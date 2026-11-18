package app.pdfreducer.studio

import android.content.pm.ActivityInfo
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class StudioSmokeTest {
    private fun findWebView(v: View): WebView? {
        if (v is WebView) return v
        if (v is ViewGroup) for (i in 0 until v.childCount) findWebView(v.getChildAt(i))?.let { return it }
        return null
    }
    private fun js(scenario: ActivityScenario<MainActivity>, code: String): String {
        var value = "null"; val latch = CountDownLatch(1)
        scenario.onActivity { a ->
            val w = findWebView(a.window.decorView)
            if (w == null) latch.countDown() else w.evaluateJavascript(code) { v -> value = v; latch.countDown() }
        }
        assertTrue(latch.await(8, TimeUnit.SECONDS)); return value
    }
    private fun awaitDom(scenario: ActivityScenario<MainActivity>, expression: String) {
        val until = SystemClock.elapsedRealtime() + 60_000
        do { if (js(scenario, "Boolean($expression)") == "true") return; SystemClock.sleep(150) } while (SystemClock.elapsedRealtime() < until)
        fail("The offline workspace did not reach: $expression")
    }
    @Test fun bundledSampleCompressesWithoutNetworkAndSurvivesRotation() {
        assumeTrue("Update the emulator WebView before running the engine smoke test", (WebView.getCurrentWebViewPackage()?.versionName?.substringBefore('.')?.toIntOrNull() ?: 0) >= 143)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            awaitDom(scenario, "document.querySelector('.upload-footer button')")
            js(scenario, "document.querySelector('.upload-footer button').click()")
            awaitDom(scenario, "document.querySelector('.analysis-line')")
            js(scenario, "document.querySelector('.compress-button').click()")
            awaitDom(scenario, "document.querySelector('.output-card')")
            scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
            awaitDom(scenario, "innerWidth > innerHeight && document.querySelector('.output-card')")
            assertTrue(js(scenario,"document.documentElement.scrollWidth <= innerWidth") == "true")
        }
    }
}
