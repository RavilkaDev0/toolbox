# Toolbox 15-tool suite — final local verification

**Checkpoint:** 2026-10-17, branch `feat/tbx-005-tool-suite`, Draft PR [#5](https://github.com/RavilkaDev0/toolbox/pull/5) targeting `dev`.

All 15 tools from TBX-004 through TBX-018 are implemented. The nine tools through WebP Converter are published in the branch catalog; QR Designer, Wi-Fi QR, Contact QR, Password Generator, Word Counter and Case Converter remain draft until the shared-branch CI gate passes. Draft pages are available only to local development/E2E with `TOOLBOX_UI_FIXTURES=1`; production static routing remains published-only.

## Architecture and privacy

`apps/web` owns tool pages, accessible controls, worker orchestration, cancellation, result previews and Blob URL cleanup. Each tool page is a separate lazy client chunk behind a React Suspense boundary, so PDF/image libraries and tool workspaces do not inflate unrelated routes. The route exposes a readiness marker only after the selected tool page mounts; Playwright waits for it before interacting. This also fixes the WebKit startup race recorded below.

Pure limits, page/layout math, ordering and text/QR rules live in `packages/core`; strict Zod schemas live in `packages/contracts`; browser parsing, encoding, PDF/image processing, workers and bounded output checks live in `packages/browser-engines`; shared primitives remain in `packages/ui`. There are no server upload routes, database or remote processing paths. PDF operations preserve page objects and geometry; image conversion uses browser decoders/canvas. PDF inputs with unsupported active features or encryption are refused rather than described as sanitized. Passwords and QR/contact payloads stay in tab memory.

Resource checks cover file counts, bytes, decoded dimensions/page counts, output bytes and operation time. Workers are terminated on cancel/reset/unmount, generation tokens discard stale results, and object URLs and temporary image resources are released. The limits and residual risks are documented in each ticket report. No broad PDF/image fuzzing or physical low-memory-device testing was performed.

The suite reuses `pdf-lib@1.17.1` for non-raster PDF editing and `pdfjs-dist@6.3.289` for local page previews. It adds `fflate@0.8.3` (MIT; package metadata advertises an 8 KB library) for bounded ZIP output because browsers expose compression streams but no ZIP archive API. It has no runtime dependencies and is lazy-loaded for archive operations. TBX-013 adds `nayuki-qr-code-generator@1.8.0` (MIT, about 51 KB unpacked) for QR matrices and `jsqr@1.4.0` (Apache-2.0, about 280 KB unpacked) for independent local scan verification. Both are lazy-loaded with the QR browser engine; their older release cadence is documented in that ticket report. No other dependencies were added.

## Final verification

- `pnpm install --frozen-lockfile` — passed; lockfile and workspace install are current.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — passed: 47 Vitest files, 159 unit/integration tests, and 133 Playwright Chromium/WebKit scenarios across the 15 tools. Real JPEG, PNG, WebP, PDF, SVG, ZIP, vCard and QR output paths are covered by checked-in synthetic fixtures.
- `pnpm build` — passed; Next.js standalone output generated.
- Production standalone route smoke — nine published routes returned HTTP 200 with matching canonical metadata and completed client readiness. At 1440px and 390px they had no horizontal overflow, console errors or non-local/non-GET requests. The six draft routes returned HTTP 404 as intended.
- Production standalone merge smoke — merged real A4 and Letter PDFs, showed the output preview, downloaded a 7,174-byte PDF from 9,148 input bytes, reopened it independently, and verified all three pages and their source page dimensions. No upload or non-local request occurred.
- The [prior remote validate run](https://github.com/RavilkaDev0/toolbox/actions/runs/38771385855) failed in WebKit's split-to-ZIP retry scenario. Its retained trace and screenshot showed the test setting files and clicking while the tool's React handlers were not ready. Fix commit `8787959` adds lazy tool chunks and a mounted-page readiness marker; all tool E2E specs wait for that marker. The formerly failing WebKit scenario passed five consecutive targeted runs with the actual ZIP, cancellation, retry and resource cleanup assertions intact. Exact-head GitHub `validate` for the final pushed commit is the remaining publication gate.
- Desktop and mobile screenshots in `docs/evidence/tbx-013/` through `tbx-018/` were visually reviewed; the final local Playwright run reported no failed tests. Screenshot evidence uses synthetic inputs only.

## Output and performance samples

These are individual synthetic-fixture measurements captured by the existing Playwright performance scenarios or the documented standalone runs. They are not cross-device guarantees. Inputs are shown as input bytes → output bytes; elapsed values are milliseconds. PDF/image figures use Chromium unless WebKit is stated. Measurements from development and standalone builds are kept separate in their linked evidence.

| Tool | Representative measured inputs, output and elapsed time |
| --- | --- |
| Images to PDF | 289,744 → 412,585 B / 902 ms; 1,807,723 → 2,570,888 B / 1,608 ms; 7,215,056 → 10,240,356 B / 2,774 ms. At the largest input WebKit took 5,171 ms. |
| Merge PDF | 295,625 → 293,961 B / 1,133 ms; 1,813,611 → 1,811,947 B / 1,665 ms; 7,220,942 → 7,219,279 B / 3,805 ms. Largest WebKit sample: 5,257 ms. |
| Split PDF | 291,341 → 290,964 B ZIP / 473 ms; 1,809,327 → 1,808,951 B / 936 ms; 7,216,658 → 7,216,282 B / 947 ms. Standalone largest sample: 945 ms. |
| Rotate PDF | 291,341 → 290,958 B / 1,152 ms; 1,809,327 → 1,808,944 B / 500 ms; 7,216,658 → 7,216,276 B / 936 ms. Standalone largest sample: 906 ms. |
| PDF to PNG | 291,341 → 1,548,941 B / 448 ms; 1,809,327 → 1,497,599 B / 1,198 ms; 7,216,658 → 1,325,843 B / 5,035 ms in standalone Chromium. |
| Image Compressor | 2,619 → 1,470 B / 550 ms; 289,744 → 184,333 B / 487 ms; 1,807,723 → 1,148,295 B / 547 ms. |
| Image Resizer | 2,619 → 1,222 B / 832 ms; 289,744 → 6,133 B / 640 ms; 1,807,723 → 6,131 B / 732 ms. |
| PNG/JPG Converter | JPEG→PNG: 2,619 → 7,326 B / 669 ms; 289,744 → 1,637,606 B / 659 ms; 1,807,723 → 10,229,573 B / 1,289 ms. |
| WebP Converter | 2,619 → 1,230 B / 291 ms; 289,744 → 308,846 B / 443 ms; 1,807,723 → 1,945,876 B / 1,469 ms. WebP can be larger than JPEG. |
| QR Designer | Verified 512px preview/export: 11.7 KiB PNG and 3.9 KiB vector SVG. No end-to-end timing benchmark was recorded. |
| Wi-Fi QR / Contact QR | Shared local QR engine generates scan-verified 512px PNG and bounded SVG; dedicated timing and heap measurements were not recorded. |
| Password Generator | Maximum 128-character output; no dedicated timing/heap benchmark. Bounded Web Crypto sampling is covered by tests. |
| Word Counter | Maximum 100,000 UTF-16 code units; no maximum-input browser timing/heap benchmark. |
| Case Converter | Node core microbenchmark at 100,000 input units: uppercase 0.685 ms, lowercase 0.163 ms, title 83.207 ms, sentence 18.518 ms, toggle 33.542 ms. This is not browser input-to-render latency. |

Raw measurements and per-tool qualifications are in `docs/evidence/tbx-004/` through `docs/evidence/tbx-018/` and the corresponding `TBX-*-REPORT.md` files. Available Chromium `performance.memory` values are main-realm heap snapshots, not total peak memory; WebKit heap and browser-native canvas/worker allocations are not comparable or fully exposed. Dense QR generation and maximum-length title casing are synchronous and can briefly occupy the main thread.

## Remaining release gate and risks

The local final suite, standalone build and targeted WebKit recheck pass. The final code/evidence commits still need one push to the existing branch and a successful GitHub `validate` run on that exact SHA. Until that succeeds, the six new tools stay draft. Do not merge, release or deploy as part of this task.

Browser-native image codecs can vary in color management, EXIF interpretation and output size. Upper-bound image processing may exceed memory on older phones despite decoded-pixel limits. QR styling can reduce camera readability; WPA3 QR recognition varies by scanner; vCard values are readable by QR recipients; clipboard contents outlive a page reset. Case conversion is mechanical and its fallback segmentation is approximate for some scripts. These limits are shown in the tool pages and individual reports.
