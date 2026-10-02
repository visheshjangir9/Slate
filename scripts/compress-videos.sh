#!/usr/bin/env bash
# Re-encode the muted showcase clips in public/media/videos for the web.
#
# Usage: bash scripts/compress-videos.sh
#
# Every clip listed here only ever plays muted (hero rotation and homepage
# tiles), so the audio track is dropped. H.264 High at CRF 26, yuv420p for
# every browser, and +faststart so playback can begin before the whole file
# arrives. intro.mp4 is left alone: it plays with sound on /contact.
set -euo pipefail
cd "$(dirname "$0")/../public/media/videos"

CLIPS=(slate-hero hero-02 hero-03 hero-04 video-city camera-motion-landscape red-ferrari)

for name in "${CLIPS[@]}"; do
  src="$name.mp4"
  tmp="$(mktemp --suffix=.mp4)"
  ffmpeg -nostdin -loglevel error -y -i "$src" \
    -map 0:v:0 -an \
    -c:v libx264 -preset slow -crf 26 -profile:v high -pix_fmt yuv420p \
    -vf "scale='min(1920,iw)':-2" \
    -movflags +faststart \
    "$tmp"
  old=$(stat -c %s "$src"); new=$(stat -c %s "$tmp")
  if (( new < old * 95 / 100 )); then
    mv "$tmp" "$src"
    printf '%-28s %6s KB -> %6s KB\n' "$src" $((old / 1024)) $((new / 1024))
  else
    rm -f "$tmp"
    printf '%-28s kept (%s KB)\n' "$src" $((old / 1024))
  fi
done
