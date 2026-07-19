#!/usr/bin/env bash
set -euo pipefail

input_dir="${1:-../../video-output/audio}"
output="${2:-public/story-narration.wav}"

recordings=(
  Recording_37.m4a
  Recording_40.m4a
  Recording_41.m4a
  Recording_43.m4a
  Recording_44.m4a
  Recording_49.m4a
  Recording_51.m4a
  Recording_54.m4a
)

for recording in "${recordings[@]}"; do
  if [[ ! -f "$input_dir/$recording" ]]; then
    echo "Missing narration recording: $input_dir/$recording" >&2
    exit 1
  fi
done

mkdir -p "$(dirname "$output")"

voice_filter="highpass=f=70,lowpass=f=7600,afftdn=nr=5:nf=-42:tn=1,acompressor=threshold=0.125:ratio=2:attack=20:release=180:makeup=1.2,loudnorm=I=-16:TP=-2:LRA=7,aresample=48000"

ffmpeg -y \
  -i "$input_dir/${recordings[0]}" \
  -i "$input_dir/${recordings[1]}" \
  -i "$input_dir/${recordings[2]}" \
  -i "$input_dir/${recordings[3]}" \
  -i "$input_dir/${recordings[4]}" \
  -i "$input_dir/${recordings[5]}" \
  -i "$input_dir/${recordings[6]}" \
  -i "$input_dir/${recordings[7]}" \
  -filter_complex "\
    [0:a]${voice_filter},adelay=0:all=1[v0];\
    [1:a]atempo=1.02,${voice_filter},adelay=9000:all=1[v1];\
    [2:a]${voice_filter},adelay=35000:all=1[v2];\
    [3:a]atempo=1.04,${voice_filter},adelay=50000:all=1[v3];\
    [4:a]${voice_filter},adelay=80000:all=1[v4];\
    [5:a]${voice_filter},adelay=115000:all=1[v5];\
    [6:a]${voice_filter},adelay=140000:all=1[v6];\
    [7:a]${voice_filter},adelay=161000:all=1[v7];\
    [v0][v1][v2][v3][v4][v5][v6][v7]amix=inputs=8:duration=longest:normalize=0,alimiter=limit=0.89,apad=pad_dur=175,atrim=0:175[out]" \
  -map "[out]" -ar 48000 -ac 1 -c:a pcm_s24le "$output"

echo "Mastered narration written to $output"
