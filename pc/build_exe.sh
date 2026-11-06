#!/usr/bin/env bash
# Builds dist/BOARDVERSE.exe (Windows 10/11 x64) with mingw-w64: the single-file game is embedded as a resource.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; B="$ROOT/pc/build"; mkdir -p "$B"
[ "${SKIP_WEB:-0}" = "1" ] || (cd "$ROOT/web" && npm run build --silent)
cp "$ROOT/web/dist/boardverse-single.html" "$B/game.html"
python3 - "$ROOT/android/res/icon.png" "$B/icon.ico" <<'PY'
import sys
from PIL import Image
Image.open(sys.argv[1]).convert('RGBA').resize((256, 256), Image.LANCZOS).save(sys.argv[2], sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
PY
VER=${VERSION_NAME:-1.1.0}
cat > "$B/res.rc" <<RC
1 ICON "icon.ico"
101 RCDATA "game.html"
1 VERSIONINFO
FILEVERSION 1,1,0,0
PRODUCTVERSION 1,1,0,0
BEGIN
  BLOCK "StringFileInfo"
  BEGIN
    BLOCK "040904B0"
    BEGIN
      VALUE "ProductName", "BOARDVERSE"
      VALUE "FileDescription", "BOARDVERSE - board & card games universe"
      VALUE "ProductVersion", "$VER"
      VALUE "FileVersion", "$VER"
    END
  END
  BLOCK "VarFileInfo"
  BEGIN
    VALUE "Translation", 0x409, 1200
  END
END
RC
(cd "$B" && x86_64-w64-mingw32-windres res.rc -O coff -o res.o)
x86_64-w64-mingw32-gcc -O2 -municode -mwindows -o "$ROOT/dist/BOARDVERSE.exe" "$ROOT/pc/launcher.c" "$B/res.o" -lshell32 -lole32 -lws2_32
x86_64-w64-mingw32-strip "$ROOT/dist/BOARDVERSE.exe"
ls -la "$ROOT/dist/BOARDVERSE.exe"
