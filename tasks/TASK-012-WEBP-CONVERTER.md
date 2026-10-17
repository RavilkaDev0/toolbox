# TBX-012 — WebP Converter

## Goal

Implement `/tools/webp-converter` for browser-local JPEG/PNG→WebP conversion with true output verification, size comparison, transparency support, a bounded batch ZIP, cancellation and reset.

## Behavior and safety

- Detect actual input signature, dimensions, MIME and extension; reject mismatch, corruption, animation, empty input and unsupported formats.
- Accept 1–10 files, max 16 MiB per file and 32 MiB total. Bound each decoded image to 8 megapixels and 8,192 pixels per edge; each output to 24 MiB, batch output to 32 MiB, ZIP to 33 MiB; operation watchdog 60 seconds.
- Process images sequentially in a worker with worker termination on cancel/reset, generation guards, bounded preview and explicit bitmap/canvas cleanup.
- Keep PNG alpha; verify WebP MIME, RIFF/WEBP signature, dimensions and decoded result before preview/download.
- Offer only the browser Canvas lossy quality control. Canvas `toBlob()` and `OffscreenCanvas.convertToBlob()` accept format and quality but expose no explicit WebP lossless option, so no lossless switch is shown.
- Report actual per-file input/output sizes without promising WebP will be smaller. Download a single WebP directly or selected-order ZIP for batches.
- Do not upload inputs; do not add a backend or dependency.

## Acceptance

- [x] Pure resource limits, common image extension/name rules, strict schemas and catalog metadata.
- [x] Browser worker engine, verified WebP encoder output, ZIP batch, local UI, SEO route, loading/error/cancel/reset and mobile layout.
- [x] Unit/integration and Chromium/WebKit E2E tests using real JPEG, PNG and WebP fixtures, including transparency, batch order, corruption, limits, cancellation, downloads and no uploads.
- [x] Final suite after TBX-018 passed Chromium and WebKit converter scenarios with real WebP output signature/dimension/alpha checks. The combined suite passed 159 unit/integration and 133 Chromium/WebKit E2E tests; standalone production smoke passed.
- [ ] Inspect desktop/mobile screenshots and record performance and output sizes in `docs/development/TBX-012-REPORT.md`.
- [ ] Final all-tool gates and exact-head GitHub `validate`; only then treat the suite checkpoint as verified.

Implementation and tests are committed locally before the final checks per the active workflow override. Do not treat this as fully verified until the final phase succeeds.
