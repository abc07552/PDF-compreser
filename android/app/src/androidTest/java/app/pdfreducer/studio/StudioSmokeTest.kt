package app.pdfreducer.studio

import android.content.pm.ActivityInfo
import android.os.SystemClock
import android.os.ParcelFileDescriptor
import android.os.Build
import androidx.test.platform.app.InstrumentationRegistry
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
    /** Opt-in emulator-only check. Never change the display of a developer's physical device. */
    @Test fun realSessionRetainsResultAcrossCompactMediumAndExpandedWindows() {
        val args = InstrumentationRegistry.getArguments()
        assumeTrue("Enable exerciseWindows on a disposable emulator", args.getString("exerciseWindows") == "true" && (Build.FINGERPRINT.contains("generic") || Build.MODEL.contains("sdk_gphone")))
        assumeTrue("A current WebView is required for the PDF workspace", (WebView.getCurrentWebViewPackage()?.versionName?.substringBefore('.')?.toIntOrNull() ?: 0) >= 143)
        fun shell(command: String): String = ParcelFileDescriptor.AutoCloseInputStream(InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand(command)).bufferedReader().use { it.readText() }
        val previousSize = Regex("Override size: ([0-9]+x[0-9]+)").find(shell("wm size"))?.groupValues?.get(1) ?: "reset"
        val previousDensity = Regex("Override density: ([0-9]+)").find(shell("wm density"))?.groupValues?.get(1) ?: "reset"
        try {
            shell("wm density 160"); shell("wm size 400x800")
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                awaitDom(scenario, "document.querySelector('[data-layout=mobile]')")
                js(scenario,"location.hash='/compress'");awaitDom(scenario,"document.querySelector('.compress-cta:not(:disabled)')")
                val name=js(scenario,"document.querySelector('.mobile-picker span').textContent")
                js(scenario,"document.querySelector('.compress-cta').click()");awaitDom(scenario,"document.querySelector('.delivery-card')")
                for((size,layout) in listOf("800x1100" to "tablet","1400x960" to "desktop","400x800" to "mobile")) {
                    shell("wm size $size")
                    awaitDom(scenario,"document.querySelector('[data-layout=$layout] .delivery-card') && document.documentElement.scrollWidth<=innerWidth")
                    val selector=if(layout=="mobile") ".mobile-picker span" else ".preview-file b"
                    assertEquals(name,js(scenario,"document.querySelector('$selector').textContent"))
                }
            }
        } finally { shell("wm size $previousSize");shell("wm density $previousDensity") }
    }
    @Test fun bundledSampleCompressesWithoutNetworkAndSurvivesRotation() {
        assumeTrue("Update the emulator WebView before running the engine smoke test", (WebView.getCurrentWebViewPackage()?.versionName?.substringBefore('.')?.toIntOrNull() ?: 0) >= 143)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            awaitDom(scenario, "document.querySelector('.ultra')")
            js(scenario, "location.hash='/compress'")
            awaitDom(scenario, "document.querySelector('.compress-cta:not(:disabled)')")
            js(scenario, "document.querySelector('.compress-cta').click()")
            awaitDom(scenario, "document.querySelector('.delivery-card')")
            scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
            awaitDom(scenario, "innerWidth > innerHeight && document.querySelector('.delivery-card')")
            assertTrue(js(scenario,"document.documentElement.scrollWidth <= innerWidth") == "true")
        }
    }
}
