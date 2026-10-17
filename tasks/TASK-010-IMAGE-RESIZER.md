# TBX-010 — Image Resizer

## Goal

Publish `/tools/image-resizer` as a local browser resizer for static JPEG, PNG and WebP images. Keep source pixels when possible, apply EXIF orientation, allow intentional aspect-ratio changes only when unlocked, and validate the actual encoded output before download.

## Boundaries and shared image processing

- `packages/core` owns the shared image-resource ceiling and pure resize geometry.
- `packages/contracts` owns strict input metadata and resize settings schemas.
- `packages/browser-engines` owns shared static-image signature inspection, oriented decoding, canvas encoding/output validation and resizer orchestration.
- `apps/web` owns the route, responsive workspace, worker lifecycle, fallback, preview, cancellation and Blob URLs.
- Reuse the image processing operations established by TBX-009; do not build a generic image-job framework or introduce a dependency.

## Behavior and limits

- Process one static JPEG, PNG or WebP per run; adding a new valid input replaces the prior one.
- Support pixel width/height, a lockable ratio, and integer percentage scaling. Keep the original aspect ratio locked by default. With it unlocked, show that output will be stretched.
- Reopen and verify actual encoded output format and exact dimensions before enabling download. Keep the source format by default; JPEG/WebP quality applies only to lossy encoders. JPEG uses an explicit white background; PNG/WebP retain alpha.
- Match the conservative mobile bounds established for TBX-009: 16 MiB input, 8 MP and 8,192 px per side, 24 MiB output, and a 30-second processing watchdog. Output may be upscaled but cannot exceed those dimension/pixel ceilings. A decoded 8 MP bitmap and same-size canvas can coexist (~64 MiB pixel backing before input/output/codecs), so this is not a low-memory-device guarantee.
- Do not add size presets in this task: arbitrary pixel and percentage controls cover the required use cases without imposing an opinionated target catalog.
- Files remain local. No batch/ZIP, accounts, persistence, analytics payloads, backend, or new dependency.

## Acceptance checks

- Real JPEG/PNG/WebP picker and drop inputs, dimensions and previews; resize by pixels and percentage; keyboard-editable dimensions; locked/unlocked ratio; portrait, landscape and EXIF-oriented images.
- Output retains requested dimensions and selected format; independent browser decode validates the downloaded bytes. Test alpha retention and explicit white flattening when output is JPEG.
- Reject zero, fractional, invalid, over-edge, over-pixel, malformed, spoofed, animated and oversized inputs before allocating an oversized canvas.
- Cancel/retry/reset, stale-result protection, worker termination, bitmap/canvas cleanup and URL revocation.
- Chromium/WebKit: real downloads, output decode/dimensions, no non-GET uploads, 320/390/768/1440 widths, keyboard, no console/hydration errors, and real timing/size samples.
- Only `image-resizer` changes to `published`; all other statuses stay as they are. Update related links, SEO copy and catalog/search regression expectations.
- Run frozen install, lint, typecheck, unit/integration, full E2E and build; commit separately, push to the shared Draft PR and wait for validate on the exact commit.

## Risks

Browser scaling filters, color management, output codecs and native memory vary. Browser encoding may discard metadata; this tool is not an archival color workflow. Playwright does not replace physical iOS/Android peak-memory testing.
