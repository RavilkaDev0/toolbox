# Toolbox 15-tool suite — final local verification

**Checkpoint:** 2026-10-17, branch `feat/tbx-005-tool-suite`, Draft PR [#5](https://github.com/RavilkaDev0/toolbox/pull/5) targeting `dev`.

The final cross-suite audit also checked the 15 published tool routes and titles in local Playwright MCP, reviewed desktop/mobile workflow screenshots, and corrected stale foundation-era publication and privacy copy in the README, architecture/design/roadmap/quality/workflow docs, homepage and root SEO description. Fresh homepage screenshots after the copy update: [desktop, 1440px](../evidence/tbx-final-audit/home-1440.png) and [mobile, 390px](../evidence/tbx-final-audit/home-390.png). The homepage Chromium shell scenario passed after the copy update. The first audit CI caught one formatting issue in the homepage category description; it was corrected. In line with the owner's testing cadence override, the full local suite was not repeated for these documentation and copy-only refinements; the exact-head Actions result for the pushed audit commit is linked in PR #5.

All 15 tools from TBX-004 through TBX-018 are implemented and published in the shared branch catalog. The six late catalog entries were switched after the deferred feature suite and exact-head GitHub validate on `3e5226a` passed. The publication follow-up updates catalog/search/route expectations and confirms all 15 production routes in Chromium and WebKit; its current exact-head CI result is recorded in Draft PR #5. No merge, release or deployment occurred.

## Architecture and privacy

`apps/web` owns tool pages, accessible controls, worker orchestration, cancellation, result previews and Blob URL cleanup. Each tool page is a separate lazy client chunk behind a React Suspense boundary, so PDF/image libraries and tool workspaces do not inflate unrelated routes. The route exposes a readiness marker only after the selected tool page mounts; Playwright waits for it before interacting. This also fixes the WebKit startup race recorded below.

Pure limits, page/layout math, ordering and text/QR rules live in `packages/core`; strict Zod schemas live in `packages/contracts`; browser parsing, encoding, PDF/image processing, workers and bounded output checks live in `packages/browser-engines`; shared primitives remain in `packages/ui`. There are no server upload routes, database or remote processing paths. PDF operations preserve page objects and geometry; image conversion uses browser decoders/canvas. PDF inputs with unsupported active features or encryption are refused rather than described as sanitized. Passwords and QR/contact payloads stay in tab memory.

Resource checks cover file counts, bytes, decoded dimensions/page counts, output bytes and operation time. Workers are terminated on cancel/reset/unmount, generation tokens discard stale results, and object URLs and temporary image resources are released. The limits and residual risks are documented in each ticket report. No broad PDF/image fuzzing or physical low-memory-device testing was performed.

The suite reuses `pdf-lib@1.17.1` for non-raster PDF editing and `pdfjs-dist@6.3.289` for local page previews. It adds `fflate@0.8.3` (MIT; package metadata advertises an 8 KB library) for bounded ZIP output because browsers expose compression streams but no ZIP archive API. It has no runtime dependencies and is lazy-loaded for archive operations. TBX-013 adds `nayuki-qr-code-generator@1.8.0` (MIT, about 51 KB unpacked) for QR matrices and `jsqr@1.4.0` (Apache-2.0, about 280 KB unpacked) for independent local scan verification. Both are lazy-loaded with the QR browser engine; their older release cadence is documented in that ticket report. No other dependencies were added.

## Final verification

- `pnpm install --frozen-lockfile` — passed; lockfile and workspace install are current.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- The deferred local suite passed 47 Vitest files (159 unit/integration tests) and 133 Playwright Chromium/WebKit scenarios on the completed tool implementations. After publishing the final six catalog entries, all 159 unit/integration tests passed; the first browser rerun exposed four stale catalog-search expectations plus one timing-sensitive WebKit cancellation click. The catalog assertions now reflect actual published search results, and the cancellation scenario holds one real worker response deterministically. Focused affected scenarios passed in both engines, with the WebKit cancel/retry case passing three consecutive repeats. The current exact-head GitHub `validate` result is recorded in PR #5.
- `pnpm build` — passed; Next.js standalone output generated.
- Production standalone smoke — all 15 published tool routes returned HTTP 200, each had its expected heading and canonical path, and no published route emitted console/hydration errors or non-read requests. Unknown tool/category paths returned 404. The 22 QR and utility feature E2E scenarios passed against the standalone server in Chromium and WebKit, including real exports, keyboard/mobile interactions and local-only processing. The static assets were copied from `.next/static` into the standalone app directory as required by Next.js standalone packaging; this repository does not currently automate that packaging step.
- Route/catalog checks passed in Chromium and WebKit. Existing desktop/mobile screenshots in `docs/evidence/tbx-013/` through `tbx-018/` were visually reviewed; after the targeted fixes, the affected Playwright scenarios passed.
- Production standalone merge smoke — merged real A4 and Letter PDFs, showed the output preview, downloaded a 7,174-byte PDF from 9,148 input bytes, reopened it independently, and verified all three pages and their source page dimensions. No upload or non-local request occurred.
- The [prior remote validate run](https://github.com/RavilkaDev0/toolbox/actions/runs/38771385855) failed in WebKit's split-to-ZIP retry scenario. Its retained trace and screenshot showed the test setting files and clicking while the tool's React handlers were not ready. Fix commit `8787959` adds lazy tool chunks and a mounted-page readiness marker; all tool E2E specs wait for that marker. The formerly failing WebKit scenario passed five consecutive targeted runs with the actual ZIP, cancellation, retry and resource cleanup assertions intact. The earlier implementation checkpoint also passed exact-head GitHub `validate`; the latest publication follow-up is tracked by PR #5.
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

The six new catalog entries are published only in the shared feature branch, and the PR remains Draft. Standalone packaging must include `.next/static` alongside the generated server; the local smoke staged those assets explicitly. The current exact-head CI outcome is linked in PR #5. Do not merge, release or deploy as part of this task.

Browser-native image codecs can vary in color management, EXIF interpretation and output size. Upper-bound image processing may exceed memory on older phones despite decoded-pixel limits. QR styling can reduce camera readability; WPA3 QR recognition varies by scanner; vCard values are readable by QR recipients; clipboard contents outlive a page reset. Case conversion is mechanical and its fallback segmentation is approximate for some scripts. These limits are shown in the tool pages and individual reports.
