# TBX-009 — Image Compressor implementation report

## Delivered behavior

`/tools/image-compressor` accepts one static JPEG, PNG or WebP image per run, previews the inspected source, and re-encodes it locally to JPEG, PNG or WebP. It reports actual input/output bytes and previews the actual encoded result before download. JPEG/WebP quality is adjustable from 10–95; PNG has no quality slider. PNG/WebP retain alpha and JPEG flattens it onto white. A new selection replaces the current file. The tool supports picker and drop input, cancellation, reset, retry, keyboard operation and a stacked mobile layout. Only `image-compressor` was published; the other nine draft tools remained drafts.

## Architecture and dependency decision

- `packages/core` owns the one-file contract, input/dimension/output limits and format labels. JPEG/PNG/WebP signature and structural checks moved from the Images-to-PDF module into shared `core/image-input`; both tools now consume the same parser without depending on each other.
- `packages/contracts` validates file metadata and strict output format/quality settings.
- `packages/browser-engines` checks source bytes, decodes with orientation, performs Canvas encoding, and verifies the encoder’s real MIME, signature, dimensions and byte size before returning output. Temporary byte-array copies are overwritten immediately after synchronous signature parsing.
- `apps/web` owns the route, SEO, UI, worker lifecycle, page-canvas fallback, previews, cancellation and Blob URL cleanup. The engine is dynamically loaded from the route worker when used; files never go through an API.
- No application dependency or lockfile entry was added. Native `createImageBitmap`, `OffscreenCanvas`, HTML Canvas and browser encoders avoid shipping another codec runtime and its bundle, license and maintenance costs. Unsupported native encoders fail clearly; no guessed MIME relabeling or codec polyfill is used.

## Security, privacy and resource bounds

Images are untrusted. The tool rejects empty, malformed, animated, unsupported or MIME-mismatched files and validates signatures/structure rather than trusting the extension. Limits are one file, 16 MiB compressed input, 8 megapixels, 8,192 pixels per edge, 24 MiB output and a 30-second operation watchdog. The existing shared signature parser checks PNG chunk CRCs and internal WebP/JPEG structure. Input names are only shown locally; downloads use `toolbox-image.<extension>`. E2E tests observed no non-GET upload requests, and no names or image data are added to analytics.

One 8 MP RGBA surface occupies about 32 MiB. The decoded bitmap and full-size output canvas may coexist, so their pixel backing alone can approach 64 MiB before browser codec allocations, compressed input, the encoded result and previews. This cap is a conservative mobile-oriented ceiling, not a promise that every mobile browser has sufficient memory. Peak native/browser memory was not measured. The operation is cancelled by worker termination; the sequential HTML Canvas fallback checks cancellation after each asynchronous browser operation, discards stale generations and releases the bitmap/canvas when the operation settles. A native encode already dispatched in the fallback cannot be synchronously stopped.

Re-encoding applies orientation to output pixels and drops source EXIF/ICC metadata. Browser color management may change color handling; this is not an archival color-conversion workflow. PNG is lossless for the decoded canvas pixels and can be larger than its source. Animated inputs and images beyond the resource bounds are intentionally unsupported.

## Verification

The required local gates passed: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Vitest passed 77 unit/integration tests in 23 files. The full Playwright suite passed 88 Chromium/WebKit scenarios. Compressor coverage uses real JPEG, PNG, WebP, EXIF-oriented, transparent, malformed, animated and over-limit fixtures; it checks output signatures and decoded dimensions, transparent pixels, white JPEG flattening, byte comparisons, retry/cancel/reset, keyboard operation, mobile overflow/touch size, and absence of upload requests. A dedicated reset assertion observed two live preview/result object URLs after successful compression and zero after reset in both browser engines. The shared Images-to-PDF regression scenarios passed in both browsers after parser extraction. A pre-existing Split PDF performance test assigned its hidden picker immediately after navigation; it now uses the actual file-chooser interaction to avoid a hydration startup race, and both the isolated scenario and full browser suite passed.

The nine compressor scenarios were then rerun against Next’s production standalone server on loopback with `.next/static` copied into the standalone output. All nine passed in Chromium and WebKit, including real downloads and output decoding. The production route is statically generated. Playwright MCP inspected only `http://127.0.0.1:3100/tools/image-compressor`; its accessibility snapshot showed the route landmarks, file selection, settings and guidance, with zero console errors or warnings. The MCP page and local dev server were closed afterward.

The production standalone performance samples below are single end-to-end UI-to-saved-download observations in Chromium on the development workstation at JPEG quality 50. Time starts after source inspection and option selection, and includes conversion, completion UI, download and saving the actual output. This is not a percentile, mobile benchmark, or latency guarantee.

| Input fixture | Input bytes | JPEG output bytes | Elapsed |
| --- | ---: | ---: | ---: |
| `landscape.jpg` | 2,619 | 1,470 | 550 ms |
| `noise-800.jpg` | 289,744 | 184,333 | 487 ms |
| `noise-2000.jpg` | 1,807,723 | 1,148,295 | 547 ms |

The real JPEG/PNG/WebP output samples (859 B / 1,320 B / 800 B), production benchmark JSON, and inspected desktop/mobile screenshots are in [`docs/evidence/tbx-009/`](../evidence/tbx-009/). The three performance inputs are all within the published bounds. The separate 7.2 MiB `noise-4000.jpg` fixture is rejected because its decoded dimensions exceed the 8 MP ceiling; it was not used to claim a supported-size measurement.

## Remaining limitations and risks

- Browser-native output codecs and peak memory vary by browser, OS and device. Chromium and WebKit passed; physical low-memory Android/iOS devices were not benchmarked.
- Browser re-encoding does not preserve source metadata or guarantee archival color fidelity.
- PNG may increase file size, and any chosen lossy quality is a browser-codec quality setting rather than a byte-size target.
- Canvas fallback cancellation is cooperative after an asynchronous native encode callback; hard worker termination is used where worker processing is available.

## CI and publication

The feature and report are prepared for the shared Draft PR #5 (`feat/tbx-005-tool-suite` → `dev`). GitHub `validate` for the TBX-009 commit is pending until the implementation is committed and pushed; publication stays on this branch only. No merge, release or deploy was performed.
