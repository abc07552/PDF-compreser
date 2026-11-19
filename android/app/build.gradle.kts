import java.util.Properties
plugins { id("com.android.application"); id("org.jetbrains.kotlin.android"); id("org.jetbrains.kotlin.plugin.compose") }
val signingProps = Properties()
val signingFile = rootProject.file("keystore.properties")
if (signingFile.isFile) signingFile.inputStream().use { signingProps.load(it) }
android {
    namespace = "app.pdfreducer.studio"
    compileSdk = 36
    defaultConfig { applicationId = "app.pdfreducer.studio"; minSdk = 29; targetSdk = 36; versionCode = 6; versionName = "6.0.0"; testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner" }
    signingConfigs { if(signingFile.isFile) create("production") { storeFile = rootProject.file(signingProps.getProperty("storeFile")); storePassword = signingProps.getProperty("storePassword"); keyAlias = signingProps.getProperty("keyAlias"); keyPassword = signingProps.getProperty("keyPassword") } }
    buildTypes { release { isMinifyEnabled = true; isShrinkResources = true; proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro"); if(signingFile.isFile) signingConfig = signingConfigs.getByName("production") } }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    androidResources { noCompress += listOf("wasm", "woff2", "bcmap", "webp", "pdf") }
}
kotlin { jvmToolchain(17) }
val verifyAssets = tasks.register("verifyOfflineWorkspace") {
    doLast { check(file("src/main/assets/workspace/index.html").isFile && file("src/main/assets/workspace/vendor/qpdf.wasm").isFile) { "Missing offline engine. Run npm ci && npm run android:sync from the repository root first." } }
}
tasks.named("preBuild") { dependsOn(verifyAssets) }
dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.08.01"))
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.work:work-runtime-ktx:2.10.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.2")
    androidTestImplementation("androidx.test:core-ktx:1.6.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
