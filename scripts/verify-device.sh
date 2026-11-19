#!/usr/bin/env bash
# The hosted emulator action uses JDK 21 for SDK tools; the app uses JDK 17.
set -eu
cd android
export JAVA_HOME="${STUDIO_BUILD_JAVA:?Specify the configured Gradle JDK}"
provider="$(adb shell dumpsys webviewupdate | grep -m 1 'Current WebView package' || true)"
printf '::notice::Emulator %s\n' "$provider"
log="${RUNNER_TEMP:-/tmp}/studio-instrumentation.log"
if ./gradlew --no-daemon --console=plain :app:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.exerciseWindows=true >"$log" 2>&1; then
  tail -30 "$log"
else
  rc=$?
  tail -70 "$log"
  # Surface actionable Gradle failures even when the XML runner could not start.
  python3 - "$log" <<'PY'
import pathlib,sys
text=pathlib.Path(sys.argv[1]).read_text(errors='replace');at=text.rfind('* What went wrong:');msg=text[at:at+900] if at>=0 else text[-450:]
print('::error::'+msg.replace('%','%25').replace('\r','%0D').replace('\n','%0A'))
PY
  exit "$rc"
fi
