# TBX-009 — Image Compressor

## Goal

Publish `/tools/image-compressor` as a browser-only image re-encoder with honest byte-size comparison, a real input/output preview, and a downloadable result. One image is processed per run; a new selection replaces it.

## Boundaries

- `packages/core` owns image-compression formats/settings, conservative byte/dimension/output limits, and the existing shared JPEG/PNG/WebP signature and structural checks.
- `packages/contracts` owns strict schemas for untrusted file metadata and settings.
- `packages/browser-engines` owns signature validation, browser decoding, canvas re-encoding, and output signature/dimension checks.
- `apps/web` owns the accessible workspace, dedicated worker lifecycle, fallback canvas adapter, previews, cancellation, URLs, and safe downloads.
- Processing stays local. No backend, file upload route, dependency, or persistent storage is introduced.

## Behavior and limits

- Accept one static JPEG, PNG, or WebP; reject animated PNG/WebP, malformed data, mismatched declared MIME, empty files, and unsupported formats.
- Offer JPEG, PNG, and WebP output. Keep the input format by default. A quality slider (10–95, default 80) applies only to lossy JPEG/WebP encoders. PNG uses the browser's lossless PNG encoder and may grow; the UI must state this. JPEG uses an explicit white background when flattening alpha. PNG/WebP preserve alpha.
- Preserve decoded pixel dimensions and apply source orientation while encoding. Strip source metadata as a consequence of browser decode/re-encode; browser color conversion is not archival color management.
- Limits: one image per run, 16 MiB compressed input, 8,192 px per side, 8 megapixels decoded, and 24 MiB output. Eight megapixels require about 32 MiB for one RGBA pixel buffer; the bitmap and canvas may coexist, so this keeps the main pixel buffers near 64 MiB before codec/input/output overhead. These are conservative ceilings, not a guarantee against device/browser memory pressure.
- Compare real input and output bytes; never claim a size reduction when output is not smaller.
- Validate the encoded output's actual MIME/signature/dimensions and size before showing success.
- Do not upload files or send filenames, bytes, or content to analytics. Use generic download names.
- Use a dedicated worker where available, with the existing sequential HTML-canvas fallback pattern where OffscreenCanvas is missing. Cancellation terminates worker work, aborts/ignores fallback responses, drops stale results, closes bitmaps, shrinks canvases, and revokes URLs.

## Acceptance criteria

- Picker and drag/drop; source preview/name/type/size/dimensions; replace, compress, cancel, reset, retry, and output preview/download.
- Strict options validation, content signatures/structure, file/dimension/output limits, and actionable malformed/unsupported/canvas-encoder errors.
- Re-encoded image opens and has the expected format and dimensions. Alpha survives PNG/WebP; JPEG alpha is flattened to white. Orientation and aspect ratio are preserved.
- Actual Chromium and WebKit interaction tests cover JPEG/PNG/WebP input and output where supported, quality settings, transparent pixels, changed dimensions/settings, invalid inputs, cancellation/retry/reset, no upload requests, mobile overflow/touch layout, keyboard controls, and no console/hydration errors.
- Unit/integration tests cover settings, limits, signature/MIME checks, malformed/animated/oversized files, encoder errors, output verification, repeatability, cancellation, and resource cleanup with real fixtures.
- Inspect desktop/mobile screenshots and the local route with Playwright MCP. Check a production standalone route and output.
- Update only image-compressor publication state; leave other drafts unchanged. Add canonical metadata, user instructions/limits, catalog links and truthful SEO copy.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; record exact outcomes, output sizes, performance samples, memory limitations, risks, dependency/license/size decisions, and CI run in `docs/development/TBX-009-REPORT.md`.

## Threat model and known limits

The selected file is untrusted. Signature/structure and declared metadata are checked before decode; dimensions and output size bound ordinary memory/work. Browser codecs remain native attack surface; the feature does not sanitize files, guarantee a browser cannot exhaust memory below its limits, or preserve ICC/EXIF metadata. Cancellation can terminate worker code; a browser-native encoder already dispatched by the main-thread fallback may finish asynchronously, but generation checks discard it and cleanup runs when it settles. No input bytes leave the tab.
