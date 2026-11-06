#!/usr/bin/env bash
# Regenerates all game audio into web/assets/audio (needs: python venv with numpy+mido, fluidsynth, fluid-soundfont-gm, ffmpeg).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; A="$ROOT/web/assets/audio"; T=$(mktemp -d)
PY=${PY:-python3}
mkdir -p "$T/mid" "$T/fx" "$A/music" "$A/fx"
$PY "$ROOT/tools/audio/compose.py" "$T/mid"
for f in "$T"/mid/*.mid; do n=$(basename "$f" .mid)
  fluidsynth -ni -q -g 0.55 -r 44100 -F "$T/$n.wav" /usr/share/sounds/sf2/FluidR3_GM.sf2 "$f" >/dev/null 2>&1
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$T/$n.wav")
  ffmpeg -y -loglevel error -i "$T/$n.wav" -af "loudnorm=I=-20:TP=-2:LRA=11,afade=t=in:d=1.5,afade=t=out:st=$(python3 -c "print(max(0,$d-3))"):d=3" -ac 2 -b:a 80k "$A/music/$n.mp3"
done
$PY "$ROOT/tools/audio/foley.py" "$T/fx"
for f in "$T"/fx/*.wav; do ffmpeg -y -loglevel error -i "$f" -ac 1 -b:a 80k "$A/fx/$(basename "$f" .wav).mp3"; done
echo "audio rebuilt in $A"
