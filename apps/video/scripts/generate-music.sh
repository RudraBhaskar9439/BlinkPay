#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$(dirname "$0")/../public"

ffmpeg -y \
  -f lavfi -i "sine=frequency=110:sample_rate=48000:duration=175" \
  -f lavfi -i "sine=frequency=164.81:sample_rate=48000:duration=175" \
  -f lavfi -i "sine=frequency=220:sample_rate=48000:duration=175" \
  -f lavfi -i "anoisesrc=color=pink:sample_rate=48000:duration=175:amplitude=0.025" \
  -filter_complex "[0:a]volume=0.045,tremolo=f=0.12:d=0.35[a0];[1:a]volume=0.025,tremolo=f=0.15:d=0.25[a1];[2:a]volume=0.012,tremolo=f=0.19:d=0.3[a2];[3:a]lowpass=f=900,volume=0.22[a3];[a0][a1][a2][a3]amix=inputs=4:normalize=0,afade=t=in:st=0:d=3,afade=t=out:st=170:d=5,loudnorm=I=-26:TP=-2:LRA=7[out]" \
  -map "[out]" -c:a libmp3lame -b:a 192k "$(dirname "$0")/../public/blinkpay-bed.mp3"

ffmpeg -y \
  -f lavfi -i "anoisesrc=color=white:sample_rate=48000:duration=0.7:amplitude=0.16" \
  -af "highpass=f=320,lowpass=f=5200,afade=t=in:st=0:d=0.05,afade=t=out:st=0.18:d=0.5,loudnorm=I=-22:TP=-4:LRA=4" \
  -c:a libmp3lame -b:a 160k "$(dirname "$0")/../public/blinkpay-whoosh.mp3"

ffmpeg -y \
  -f lavfi -i "sine=frequency=1050:sample_rate=48000:duration=0.16" \
  -af "volume=0.22,afade=t=in:st=0:d=0.01,afade=t=out:st=0.035:d=0.12" \
  -c:a libmp3lame -b:a 128k "$(dirname "$0")/../public/blinkpay-tick.mp3"
