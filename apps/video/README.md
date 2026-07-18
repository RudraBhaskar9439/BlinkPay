# BlinkPay Spark demo video

This Remotion project renders the professional 2:45 BlinkPay submission video.
The visuals are timed to `docs/VIDEO_NARRATION.md`; final narration is supplied
by the project owner and intentionally kept out of Git.

## Prepare

```bash
pnpm install --frozen-lockfile
pnpm --filter @blinkpay/video music
```

Copy the final narration to `apps/video/public/narration.wav` after recording.
The narration file, generated music and transition sound effects, browser
captures, and rendered MP4 are ignored by Git. The motion system itself—camera
pushes, parallax, staggered reveals, route scans and scene sweeps—remains fully
reproducible in source control.

## Preview and render

```bash
pnpm --filter @blinkpay/video studio
pnpm --filter @blinkpay/video render:frame
pnpm --filter @blinkpay/video render
pnpm --filter @blinkpay/video render:final
```

The music-only draft is written to `video-output/blinkpay-demo-draft.mp4`.
After `narration.wav` is present, the narrated export is written to
`video-output/blinkpay-demo-final.mp4`.
