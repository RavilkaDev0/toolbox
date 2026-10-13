# TBX-010 — Image Resizer

Status on the feature branch: implemented and published in the branch catalog. Implementation commit `33bc61968623fa6ca2a22db8b2bcb8f160520d95` passed exact-head GitHub Actions [`validate` run 38428863488](https://github.com/RavilkaDev0/toolbox/actions/runs/38428863488). A later full-suite run on docs checkpoint `2657a6e` found an under-bounded WebKit wait in the existing PDF-to-PNG E2E. Stabilization commit `22c9904aba64cc3d72d5c7da8f99f3d094677997` aligns that wait with the worker watchdog and passed exact-head [`validate` run 38433269822](https://github.com/RavilkaDev0/toolbox/actions/runs/38433269822).

## Implementation

`/tools/image-resizer` accepts one static JPEG, PNG or WebP file. The user can enter width/height with a locked ratio, deliberately unlock it to stretch, or resize by an integer percentage from 1 to 400. It keeps the detected source format by default, offers JPEG/PNG/WebP output, and only applies the quality slider to lossy output. The page displays an EXIF-oriented source preview and enables the result preview/download only after the encoded file passes browser decode and dimension checks.

`packages/core` owns common image MIME/format helpers, per-operation bounds, selection validation and pure geometry. `packages/contracts` owns strict metadata and discriminated settings schemas. `packages/browser-engines/src/image-processing.ts` validates signatures and dimensions before decode, normalizes EXIF orientation, encodes through browser Canvas APIs, checks output signature/MIME/size and independently decodes the Blob. The resizer engine applies geometry. The route-owned worker prefers OffscreenCanvas; if worker 2D canvas is unavailable, it asks the page to perform one cancellable canvas operation. Source bitmap and canvas resources are released before output verification. The React workspace owns worker termination/watchdog, stale-result guard, Blob URL cleanup and download state.

No dependency was added. Native browser APIs avoid shipping another image codec. PNG and WebP retain alpha; JPEG paints onto white before drawing. Browser decode/encode discards source metadata and color profiles. Output is the browser's resampling and codec result, not an archival color workflow.

## Bounds and security

- One static file, at most 16 MiB; actual bytes must match a supported image structure and its declared MIME when present.
- At most 8 megapixels and 8,192 px per side, checked from the image header before bitmap decode and before canvas allocation.
- Output at most 24 MiB; the worker operation watchdog is 30 seconds.
- Upscaling is supported only within these bounds. Invalid, corrupt, animated and MIME-spoofed files fail before output is available.
- No file or filename is uploaded or sent to analytics. The E2E network monitor observed no non-GET requests during conversion. Download names are generic.
- Every `ImageBitmap` is closed, canvases are reset to zero dimensions, and object URLs are revoked on reset, replacement or unmount. Worker termination cancels an active job; stale messages are ignored.

An 8 MP RGBA bitmap and same-size output canvas can coexist at roughly 64 MiB of pixel backing before compressed input, encoded output and codec allocations. Output verification runs after the source bitmap and canvas are released. Limits reduce memory pressure but cannot guarantee that every low-memory phone can process the maximum file. If a browser lacks worker OffscreenCanvas, the page-side canvas fallback can briefly occupy the main thread. Physical iOS/Android peak memory was not measured.

## Verification

Addressed unit/contract/browser-engine tests: **15 passed** across core geometry/limits, strict option schemas, real JPEG/PNG/WebP inspection, malformed and animated rejection, output validation, cancellation, repeat operations and resource cleanup. Existing compressor engine tests passed alongside these to cover the shared image-engine refactor. The full workspace unit/integration suite passed **87 tests**.

The resizer Playwright feature suite passed **9 tests** across Chromium and WebKit (five Chromium including its performance case; four WebKit). It exercises real fixture files, actual downloaded image bytes and HTML image decoding, JPEG/PNG/WebP output, EXIF orientation, locked ratio/percentage, intentional stretching, alpha pixels, white JPEG background, picker/drop, empty/corrupt/spoofed/animated/oversized refusal, worker cancellation/retry/reset, keyboard activation, Blob URL cleanup, 320/390/768/1440 px widths, and absence of non-GET requests. The complete browser suite passed **97 scenarios** across Chromium and WebKit. One pre-existing Rotate PDF E2E readiness assertion used a 30-second timeout while that tool's worker watchdog allows 45 seconds; its wait now reflects the operation bound. A later validation run on docs checkpoint `2657a6e` exposed the same kind of bound mismatch in an existing PDF-to-PNG error assertion: WebKit took 32.1 seconds for the oversized-page scenario while the test expected the visible error within 30 seconds. That assertion now waits 60 seconds so the 45-second engine watchdog can report its limit; the focused WebKit scenario passed 5/5 repeats, the full local suite passed again (87 unit/integration, 97 Playwright), and stabilization commit `22c9904` passed full GitHub `validate`. The production standalone image-domain run remains scheduled after TBX-012 per the long-lived plan.

The local Chromium performance fixture measured end-to-download elapsed time and output sizes:

| Input fixture | Input bytes | Output bytes | Elapsed |
| --- | ---: | ---: | ---: |
| `landscape.jpg` (240 × 120) | 2,619 | 1,222 | 605 ms |
| `noise-800.jpg` (800 × 600) | 289,744 | 6,133 | 504 ms |
| `noise-2000.jpg` (2,000 × 1,500) | 1,807,723 | 6,131 | 512 ms |

The test scales each image to 120 px wide, so output sizes are not a claim about same-size JPEG compression. These measurements came from a local desktop Chromium/Next dev run and are not physical-device or production-build performance figures.

Desktop/mobile screenshots, sample downloads and machine-readable timings are in [TBX-010 evidence](../evidence/tbx-010/). `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (87 unit/integration and 97 Playwright tests), and `pnpm build` all passed locally after the timeout adjustment. The route and canonical metadata were also checked through Playwright MCP against the local app. GitHub Actions `validate` passed all required steps on implementation commit `33bc619` and stabilization commit `22c9904`.

## Known risks

Canvas resampling kernels, color handling, output encoder support and memory peaks vary by browser/device. The browser APIs strip source metadata; nonstandard, animated and high-bit-depth workflows are out of scope. E2E emulates mobile widths but does not replace physical-device testing or broad fuzzing.
