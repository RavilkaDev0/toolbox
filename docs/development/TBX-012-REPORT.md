# TBX-012 — WebP Converter

**State:** implementation and test coverage added; final browser verification is pending. This report intentionally does not claim production readiness. The active workflow override schedules broad tests after TBX-018.

The `/tools/webp-converter` route accepts JPEG and PNG and encodes them locally using the shared browser Canvas/OffscreenCanvas image engine. It checks input signatures, MIME, extension, dimensions and decode; prepares bounded previews; processes output sequentially in a worker; verifies the resulting `image/webp`, RIFF/WEBP structure, dimensions and browser decode; and displays the actual first WebP result. One output downloads directly; a batch becomes an ordered ZIP. The UI compares actual input/output bytes and does not promise size reduction.

The tool reuses shared image signature/dimension/extension rules, `ImageBitmap` decoding, orientation handling, Canvas encoding, output verification and a bounded ZIP writer. `fflate@0.8.3` (MIT) was already a direct browser-engine dependency and remains dynamically imported only for batch output; no dependency was added. No source bytes, file names or output bytes are sent to a server.

The browser Canvas APIs expose format and quality parameters but no explicit WebP lossless switch, so the UI offers a bounded lossy quality range only. The worker probes whether OffscreenCanvas really returns `image/webp`; when it does not, processing falls back to the main-thread HTML canvas and still validates the returned MIME/signature. If neither encoder honors the requested format, the UI reports an explicit conversion error. The output verification tests are written to exercise Chromium and WebKit.

Limits are 1–10 files, 16 MiB each, 32 MiB input total, 8 megapixels and 8,192 pixels per edge, 24 MiB per output, 32 MiB combined batch output, a 33 MiB ZIP and a 60-second watchdog. One 8-megapixel RGBA surface requires about 32 MiB before codec, worker transfer and Blob copies; mobile browsers can still run short of memory near the upper bounds.

## Verification state

- Unit/integration tests cover pure limits, content/type/extension mismatch, damaged/animated/oversized inputs, actual JPEG/PNG fixtures, ZIP order/content, cancellation and output verification.
- Playwright tests cover real single/batch downloads, WebP signatures and dimensions, PNG alpha, keyboard quality control, mobile cancellation/retry/reset, failure handling and request privacy in Chromium and WebKit projects. A separate isolated Chromium performance project records three input sizes once.
- These new tests are written but have not been run, as required by the active implementation-first workflow. Screenshots, cross-browser encoder evidence, output byte counts, performance measurements, and standalone-route checks remain pending until the final test phase.
- Two compile-only follow-ups were recorded separately as `f6c8a65` and `17c7f08`: they align the UI with the workspace component props and make the E2E fixture lookup strict-null-safe. `pnpm --filter @toolbox/web run typecheck` then passed; no T012 behavioral tests were run.
- No physical mobile device testing or broad image-decoder fuzz testing has been performed.

Canvas documentation: [HTMLCanvasElement.toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) and [OffscreenCanvas.convertToBlob](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob).
