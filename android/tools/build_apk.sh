#!/usr/bin/env bash
# Builds dist/BOARDVERSE.apk without the Android SDK:
#   web bundle -> javac (API stubs) -> dx -> apkpack.py (AXML manifest + arsc) -> apksig (v2)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$ROOT/android/tools"
OUT="$ROOT/android/build"
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0.0}"
M=https://repo1.maven.org/maven2
fetch() { [ -f "$T/$2" ] || curl -sSfL "$M/$1" -o "$T/$2"; }
fetch com/google/android/android/4.1.1.4/android-4.1.1.4.jar android-4.1.1.4.jar
fetch com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar dalvik-dx-16.0.1.jar
fetch com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar apksig-2.3.0.jar

rm -rf "$OUT" && mkdir -p "$OUT/classes" "$OUT/stubs" "$OUT/www"
if [ "${SKIP_WEB:-0}" != "1" ]; then (cd "$ROOT/web" && npm run build --silent); fi
cp -r "$ROOT/web/dist/." "$OUT/www/"

javac -nowarn --release 8 -d "$OUT/stubs" $(find "$ROOT/android/stubs" -name '*.java') 2>&1 | grep -v -e JAVA_TOOL -e 'warning' || true
javac -nowarn --release 8 -cp "$T/android-4.1.1.4.jar:$OUT/stubs" -d "$OUT/classes" \
  $(find "$ROOT/android/src" -name '*.java') 2>&1 | grep -v -e JAVA_TOOL -e '^warning' -e '^[0-9]* warning' || true
java -cp "$T/dalvik-dx-16.0.1.jar" com.android.dx.command.Main --dex --min-sdk-version=24 --output="$OUT/classes.dex" "$OUT/classes" 2>&1 | grep -v JAVA_TOOL || true

python3 "$T/apkpack.py" "$OUT/unsigned.apk" "$OUT/classes.dex" "$ROOT/android/res/icon.png" "$OUT/www" "$VERSION_CODE" "$VERSION_NAME"

KS="$ROOT/android/keystore/boardverse.p12"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storetype PKCS12 -storepass boardverse -alias boardverse \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=BOARDVERSE, O=BOARDVERSE" 2>&1 | grep -v JAVA_TOOL || true
fi
javac -nowarn -cp "$T/apksig-2.3.0.jar" -d "$OUT" "$T/Sign.java" 2>&1 | grep -v JAVA_TOOL || true
mkdir -p "$ROOT/dist"
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED -cp "$T/apksig-2.3.0.jar:$OUT" Sign "$OUT/unsigned.apk" "$ROOT/dist/BOARDVERSE.apk" "$KS" boardverse boardverse 2>&1 | grep -v JAVA_TOOL
ls -la "$ROOT/dist/BOARDVERSE.apk"
