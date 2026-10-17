# TBX-012 — WebP Converter

**State:** published in the shared branch catalog after the deferred local suite and exact-head GitHub validation passed. The publication follow-up and its current exact-head CI result are recorded in Draft PR #5.

The `/tools/webp-converter` route accepts JPEG and PNG and encodes them locally using the shared browser Canvas/OffscreenCanvas image engine. It checks input signatures, MIME, extension, dimensions and decode; prepares bounded previews; processes output sequentially in a worker; verifies the resulting `image/webp`, RIFF/WEBP structure, dimensions and browser decode; and displays the actual first WebP result. One output downloads directly; a batch becomes an ordered ZIP. The UI compares actual input/output bytes and does not promise size reduction.

The tool reuses shared image signature/dimension/extension rules, `ImageBitmap` decoding, orientation handling, Canvas encoding, output verification and a bounded ZIP writer. `fflate@0.8.3` (MIT) was already a direct browser-engine dependency and remains dynamically imported only for batch output; no dependency was added. No source bytes, file names or output bytes are sent to a server.

The browser Canvas APIs expose format and quality parameters but no explicit WebP lossless switch, so the UI offers a bounded lossy quality range only. The worker probes whether OffscreenCanvas really returns `image/webp`; when it does not, processing falls back to the main-thread HTML canvas and still validates the returned MIME/signature. If neither encoder honors the requested format, the UI reports an explicit conversion error. The output verification tests are written to exercise Chromium and WebKit.

Limits are 1–10 files, 16 MiB each, 32 MiB input total, 8 megapixels and 8,192 pixels per edge, 24 MiB per output, 32 MiB combined batch output, a 33 MiB ZIP and a 60-second watchdog. One 8-megapixel RGBA surface requires about 32 MiB before codec, worker transfer and Blob copies; mobile browsers can still run short of memory near the upper bounds.

## Verification state

- Unit/integration tests cover pure limits, content/type/extension mismatch, damaged/animated/oversized inputs, actual JPEG/PNG fixtures, ZIP order/content, cancellation and output verification.
- Playwright tests cover real single/batch downloads, WebP signatures and dimensions, PNG alpha, keyboard quality control, mobile cancellation/retry/reset, failure handling and request privacy in Chromium and WebKit projects. A separate isolated Chromium performance project records three input sizes once.
- The final combined test run passed all 159 unit/integration tests and 133 Playwright Chromium/WebKit scenarios, including real WebP output verification, batch ordering, alpha, malformed/oversized inputs, mobile retry/cancel and absence of uploads. Standalone image/ZIP and performance evidence is in `docs/evidence/tbx-012/`.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` and standalone production `pnpm build` passed. The pre-publication standalone smoke confirmed draft routes remained unavailable in production before the final catalog gate.
- No physical mobile device testing or broad image-decoder fuzz testing has been performed.

## Chromium performance sample

The isolated Chromium E2E run processed synthetic local fixtures once each. These elapsed times cover the browser tool operation in the test environment, not a physical-device or cross-browser guarantee. WebP output can be larger than JPEG input, which is why the UI reports actual size changes rather than promising reduction.

| Input | Input bytes | WebP output bytes | Elapsed |
| --- | ---: | ---: | ---: |
| `landscape.jpg` | 2,619 | 1,230 | 291 ms |
| `noise-800.jpg` | 289,744 | 308,846 | 443 ms |
| `noise-2000.jpg` | 1,807,723 | 1,945,876 | 1,469 ms |

Raw measurements: `docs/evidence/tbx-012/webp-converter-performance.json`.

Canvas documentation: [HTMLCanvasElement.toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob) and [OffscreenCanvas.convertToBlob](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob).
