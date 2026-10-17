# TBX-011 — PNG/JPG Converter

## Goal

Publish `/tools/png-jpg-converter` as a browser-local PNG → JPEG and JPEG → PNG converter. Actual content selects conversion direction. The page accepts individual or mixed batches, previews selected files, lets users choose JPEG quality and the color used to flatten PNG transparency, and downloads one image or a ZIP archive.

## Ownership and boundaries

- `packages/core`: strict file/resource rules, actual-format mapping, bounded output names and limits.
- `packages/contracts`: Zod schemas for file metadata, batch size and conversion settings.
- `packages/browser-engines`: signature/dimension inspection, browser decode/encode verification, sequential processing and ZIP output.
- `apps/web`: picker/drop, selection and preview state, worker lifecycle, cancellation, accessibility, result and SEO page.
- No API, upload route, database, or new dependency. The existing `fflate@0.8.3` (MIT) is lazy-loaded only for batch conversion; `pdf-lib` is not used.

## Resource limits

- 1–10 files; each at most 16 MiB; selection at most 32 MiB total.
- Each decoded image at most 8 megapixels and 8,192 pixels on either edge.
- One encoded image at most 24 MiB; combined uncompressed batch output at most 32 MiB; archive at most 33 MiB.
- One operation has a 60-second watchdog. Images are inspected, decoded, encoded and released sequentially. Previews are bounded to 360 pixels on the longest edge.

The limits bound retained input and output data and keep only one full image decode/canvas active at a time. One 8-megapixel RGBA surface needs about 32 MiB before browser codec, canvas and Blob copies. Browser implementations do not expose reliable peak decoder memory and mobile devices may still fail at the upper limit; the UI reports a retry-with-smaller-images path.

## Acceptance

- [x] Detect and validate actual PNG/JPEG signatures, MIME, filename extension, dimensions and decodability.
- [x] PNG → JPEG with explicit white default, editable six-digit background and quality.
- [x] JPEG → PNG without claims of restored detail or reduced file size.
- [x] Add/drop multiple files, per-file preview/removal, exact count/size limits, sequential processing, batch ZIP and direct single-image download.
- [x] Verify output type, signature, dimensions and decode; reset image/canvas buffers, object URLs and worker state.
- [x] Preserve local-only privacy copy, loading/error/cancel/retry/reset states and keyboard/mobile use.
- [x] Add unit/integration and Chromium/WebKit E2E tests with real synthetic fixtures; capture desktop screenshot and real outputs.
- [x] Final local regression after TBX-018: workspace lint, typecheck, tests (159 unit/integration and 133 total Chromium/WebKit E2E), standalone build, production smoke and desktop/mobile review passed.
- [ ] Push all accumulated task commits once final regression passes, verify GitHub `validate` on exact HEAD, update shared Draft PR #5.

Implementation and deferred local verification are complete. The catalog entry is published after the earlier exact-head gate passed; current publication-follow-up CI is tracked in Draft PR #5.

## Test evidence

The engine, core rules and contracts have focused Vitest coverage. E2E coverage uses synthetic, non-personal JPEG/PNG fixtures and independently parses downloaded image bytes and ZIP entries. Current implementation evidence and the exact pre-final test state are recorded in `docs/development/TBX-011-REPORT.md` and `docs/evidence/tbx-011/`.
