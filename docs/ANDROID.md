# Install PDF MB Reducer AI ULTRA V6 on Android

**Fastest test install:** download the [V6 debug APK artifact](https://github.com/abc07552/PDF-compreser/actions/runs/44451793611/artifacts/14495713438), extract the artifact ZIP, copy `app-debug.apk` to the phone, and open it using Files. This route does not require Android Studio. See step 4 below for the Android install prompt. The source ZIP is for building or inspecting the app, not installing it.

## What you need

**To install the APK:** an **Android 10 (API 29) or newer** phone or tablet with **Chromium WebView 143+**. Update the selected Android System WebView or Chrome provider through your normal app store if necessary. You do not need a computer if you download and extract the build artifact on the device.

**Only if building from source:** a computer with Android Studio Narwhal Feature Drop (2025.1.2) or newer, JDK 17, space for the Android SDK, and the project folder (extract `PDF-MB-Reducer-AI-ULTRA-V6-source.zip` or use a Git checkout).

The project uses Gradle 8.13 (wrapper included), Android Gradle Plugin 8.11.1, Kotlin/Compose compiler 2.2.10, compile/target SDK 36, and AndroidX. No server or AI key is needed.

## 1. Prepare the folder

**If you downloaded the source ZIP:** extract the entire ZIP first. Check for `android/app/src/main/assets/workspace/index.html`. If it exists, the PDF engine and interface are already packaged; move on to step 2.

**If you have a Git checkout or changed the interface/engine:** install Node.js 22.12 or newer. Open a terminal in the folder containing `package.json`, then run:

```sh
npm ci
npm run android:sync
```

This builds the interface, worker, WASM engine, preview renderer, fonts, sample and licenses locally. Rerun the second command after source changes. There is a Gradle check that stops the build instead of producing an APK with missing assets.

## 2. Open Android Studio

1. Choose **Open**, select the **`android` subfolder** (the folder containing `settings.gradle.kts`) and wait for Gradle synchronization.
2. In **SDK Manager → SDK Platforms**, install Android 16 / API 36. In **SDK Tools**, install Android SDK Platform-Tools and **Build Tools 35.0.0**. Accept their license terms.
3. In **Settings → Build, Execution, Deployment → Build Tools → Gradle**, select JDK 17 for Gradle. Alternatively set `JAVA_HOME` to JDK 17 when using a terminal. Studio normally creates `local.properties` with your SDK path automatically.
4. The first dependency download needs internet access on the **build computer**. That does not give the installed application internet permission.

## 3. Run on your phone

1. Enable **Developer options** (tap **Build number** seven times in the phone’s settings), then enable **USB debugging**.
2. Connect the phone with a data-capable cable. Unlock it and accept its USB debugging prompt.
3. Select the phone in Android Studio’s device menu, then press **Run**. The studio opens on the phone.
4. Test **Compress → Alpine Field Report.pdf → Compress PDF → Compare → Save copy**. Choose a destination in the Android **Save as** picker. **Share** opens the Android share sheet with read-only access to a temporary copy.

No broad storage permission is needed. A PDF can be selected from Downloads, Documents or another installed document provider. An external cloud provider may use its own network connection if you explicitly select it; this app does not upload the file.

## 4. Build an APK without a connected phone

From `android/`:

```sh
./gradlew :app:assembleDebug
```

Windows: `gradlew.bat :app:assembleDebug`. The result is **`app/build/outputs/apk/debug/app-debug.apk`**. A debug APK is automatically signed with the computer’s development key; it is for testing, not a store release.

To install over USB:

```sh
adb devices
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Alternatively, copy that APK to the phone and open it in the Files app. If Android asks, temporarily allow that Files app to install unknown apps. Disable that permission again after installation. Only install builds from a source you trust.

## 5. Test, sign and distribute a release

1. Run `npm test` and `npm run android:sync` in the repository root. With an emulator or device connected, run `./gradlew :app:connectedDebugAndroidTest :app:lintRelease` from `android/`.
2. Use **Build → Generate Signed App Bundle or APK** in Android Studio. Select **APK** for direct distribution or **Android App Bundle** for a store. Create or choose **your own** signing key. Back it up securely: future updates must be signed with the appropriate key.
3. Choose the `release` build variant. Release shrinking, resource shrinking and R8 bridge rules are configured.
4. For command-line release signing, create a private `android/keystore.properties` file with the real `storeFile`, `storePassword`, `keyAlias` and `keyPassword` values for your key. `storeFile` is an absolute path or a path relative to `android/`. Do not commit this file, disclose secrets in chat, or put a keystore in the source bundle.
5. Build with `./gradlew :app:assembleRelease :app:bundleRelease`. APKs are under `app/build/outputs/apk/release/`; the AAB is under `app/build/outputs/bundle/release/`. **Without a signing configuration, release output is unsigned**, not ready to install.
6. Verify with your installed Build Tools’ `apksigner verify --verbose` against the actual release APK. Install the signed build, switch to airplane mode and complete the [device release checklist](VERIFICATION.md#device-release-checklist).

The [verified Android CI build](https://github.com/abc07552/PDF-compreser/actions/runs/44451793611/job/135317281499) compiled debug and unsigned release variants and uploaded the debug APK. To download a test APK, sign in to GitHub, open a successful run on the [Actions page](https://github.com/abc07552/PDF-compreser/actions/workflows/verify.yml), select **PDF-Reducer-ULTRA-V6-debug-APK** under **Artifacts**, and extract the ZIP. Use the phone installation instructions in step 4. Artifacts expire; subsequent successful builds provide new downloads. The `device` job runs connected instrumentation on the pinned API 36 emulator for Arena branch pushes and manual dispatches. The separate Android compilation job alone is not a device test. Read [the verification report](VERIFICATION.md) for exactly what ran or was skipped.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| “Missing offline engine” | Run `npm ci` and `npm run android:sync` from the repository root. |
| “SDK location not found” | Open `android/` in Android Studio and configure the SDK, or set `ANDROID_HOME`. |
| Gradle cannot download dependencies | Check the build computer’s network/proxy for the official Gradle, Google Maven and Maven Central repositories. |
| WebView update message | Update the selected system WebView provider, then fully reopen the app. |
| Installation reports conflicting signatures | Use the same signing key as the installed app. Uninstalling removes private library copies, preferences and history. Export a V6 backup and all needed results first; never uninstall casually. |
| Target cannot be reached | Inspect the result. Reduce image DPI/quality if acceptable; vector/text PDFs may have little room to shrink. |
| Protected PDF | Use **Unlock PDF** only with authorization and the correct password. Forgotten passwords cannot be recovered. |
| Memory/time limit | Use a smaller document or fewer files. The app does not silently upload large jobs to a server. |
