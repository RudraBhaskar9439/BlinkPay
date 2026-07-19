# BlinkPay Spark demo video

This Remotion project contains two reproducible BlinkPay submission cuts:

- `BlinkPayStory` is the primary 2:55 merchant-to-payment story. It follows a
  1 USDC request from signed QR through mobile checkout, constrained AI policy,
  deterministic route selection, wallet confirmation, and real onchain proof.
- `BlinkPayDemo` is the earlier 2:45 product overview.

The primary visuals are timed to `docs/VIDEO_STORY_NARRATION.md`. Final
narration is supplied by the project owner and intentionally kept out of Git.

## Prepare

```bash
pnpm install --frozen-lockfile
pnpm --filter @blinkpay/video music
pnpm --filter @blinkpay/video narration
```

Place the eight owner recordings in `video-output/audio`, then run the
`narration` command. It performs restrained cleanup, scene alignment and
mastering, and writes `apps/video/public/story-narration.wav`.
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
pnpm --filter @blinkpay/video render:story
pnpm --filter @blinkpay/video render:story:final
```

The music-only story cut is written to
`video-output/blinkpay-story-cut.mp4`. After `story-narration.wav` is present,
the narrated export is written to `video-output/blinkpay-story-final.mp4`.
