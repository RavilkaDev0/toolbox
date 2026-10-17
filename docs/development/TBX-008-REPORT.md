# TBX-008 — PDF to PNG implementation report

## Delivered behavior

`/tools/pdf-to-png` renders checked, static PDFs locally in the browser. It supports all pages or a selected page range, 96/192 DPI, transparent/white backgrounds, a PNG for one page, and an ordered ZIP of PNGs for multiple pages. The UI includes PDF selection/drop, source and output previews, honest page-based progress, cancellation/reset/retry, keyboard operation, mobile layout, and safe result download. The registry publishes this tool; TBX-008 did not change any other tool status.

## Architecture and dependency choices

- `packages/core` contains render settings, page selection/order, and conservative input/page/pixel/output/time limits.
- `packages/contracts` validates untrusted PDF metadata and render options with strict schemas.
- `packages/browser-engines` validates the PDF, loads PDF.js without network access, renders sequentially into a bounded canvas, validates PNG output, and builds a store-only ZIP.
- `apps/web` owns local file selection, previews, worker lifecycle, cancellation and stale-result suppression, download URLs, SEO, and accessible controls. The heavy renderer is dynamically imported only when the tool is used.
- `pdfjs-dist@6.3.289` (Apache-2.0) and `fflate@0.8.3` (MIT) were already pinned in the workspace and were reused. No dependencies or lockfile entries were added. PDF.js was chosen for browser-side parsing/rendering; fflate provides a small browser-capable ZIP path. Existing PDF checks are reused to reject encrypted and unsupported active PDFs. The tool does not sanitize PDFs.

## Resource limits and threat model

PDFs are untrusted. Processing stays in the browser; the E2E network assertions observe no file upload. The engine checks the declared type where present, the `%PDF-` signature/EOF, structure, encryption, page count, and selected pages before rendering. PDF JavaScript is never executed; annotations and XFA are disabled; PDF.js network access is disabled. Unsupported active content is rejected by the shared static-PDF preflight rather than stripped or rewritten.

Initial limits are 8 MiB per input, 1–100 pages, 8 megapixels and 8,192 px per edge per output page, 120 megapixels per operation, 45 seconds per operation, 16 MiB per PNG, and 32 MiB per ZIP. A full 8-megapixel RGBA canvas alone is about 32 MiB; PDF decode structures, canvas encoding, and retained output buffers add to that. Rendering is sequential, tasks/workers are terminated on cancellation, canvases are shrunk, byte references are released, and result object URLs are revoked. Generation identifiers discard stale async results. Limits bound work but cannot guarantee available memory on a particular phone. Peak total process memory was not measured; JavaScript heap alone would omit worker and browser-native canvas allocations.

## Verification evidence

Local final gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed. The test command passed 63 unit/integration tests and 79 Playwright tests, including the PDF-to-PNG Chromium/WebKit cases and regressions for the other published tools. The tool tests exercise actual PDF fixtures, PNG/ZIP signatures and contents, ordered page output, dimensions, transparency/white pixels, malformed/encrypted/unsupported inputs, resource bounds, cancellation, retry, URL/worker cleanup, keyboard interaction, mobile viewport, and the absence of file-upload requests.

Output was independently checked with PDFium (`pypdfium2` 5.14.0), Pillow 12.3.0, and Python `zipfile`; the production standalone outputs were reopened and rendered. The mixed five-page fixture produced a 163,402-byte ZIP from a 6,542-byte PDF. ZIP entries were `page-001.png` through `page-005.png` in source order and measured 794×1123, 794×1123, 816×1056, 987×758, and 816×1056 pixels. Against PDFium, per-page mean absolute pixel error was 0.22–0.32 on a 0–255 scale; the fraction of pixels differing by more than 48 was 0.15–0.25%. A 192-DPI page-4 PNG was 71,710 bytes at 1974×1515, matching PDFium dimensions; MAE was 0.1435 and the >48-difference fraction was 0.000744. This checks output content rather than only PDF/PNG headers.

### Production standalone performance

Measured in a local Next.js standalone production build in Playwright Chromium, 96 DPI, one 794×1123 page, on the recorded fixture set. These are single observed runs, not a cross-device benchmark or latency guarantee.

| PDF input | PNG output | Render time |
| ---: | ---: | ---: |
| 291,341 B | 1,548,941 B | 448 ms |
| 1,809,327 B | 1,497,599 B | 1,198 ms |
| 7,216,658 B | 1,325,843 B | 5,035 ms |

The independently rendered comparisons had MAE 11.70 / 9.29 / 5.24 for the 800 / 2,000 / 4,000-pixel source samples; the 800-pixel comparison is close to the test's MAE threshold of 12 but passed its additional broad-pixel-difference bound. PDF rasterization engines can differ in antialiasing and color handling, so the comparator checks visual agreement within tolerance rather than byte identity. Peak memory was not measured.

Standalone verification used Next's standalone server on loopback. Next does not copy `.next/static` into its standalone output by default, so the production check copied the generated `apps/web/.next/static` files into `apps/web/.next/standalone/apps/web/.next/static` before starting the server. The route then passed 9 targeted Chromium/WebKit PDF-to-PNG scenarios; Playwright MCP showed the published route, and a fresh navigation had zero console errors or warnings. Desktop and 390-pixel mobile screenshots were inspected.

Evidence and actual output samples are under [`docs/evidence/tbx-008`](../evidence/tbx-008/): desktop/mobile development and standalone screenshots, independent PDFium comparison JSON, performance measurements, a real ZIP, and a real 192-DPI PNG. The E2E and independent verifier sources are `apps/web/e2e/pdf-to-png.spec.ts` and `apps/web/e2e/fixtures/verify-pdf-to-png.py`.

## Remaining limitations and risks

- The tool handles bounded static PDFs only; it neither sanitizes documents nor supports password-protected PDFs, XFA, annotations, or unsupported active PDF features.
- Rendering cost and peak native memory vary by browser and device. An input may be rejected by operation bounds even where a desktop could process it; a mobile browser may also terminate a tab under memory pressure below a theoretical limit.
- Canvas output is rasterized by design. Text/vector semantics are not retained in PNG; output resolution follows the chosen DPI and per-page pixel ceilings.
- PDFium and browser output can differ slightly by renderer. The 800-pixel comparison's MAE is near the current tolerance and should be monitored if rendering dependencies change.
- `pnpm build` verifies the app production build; standalone deployment packaging must include `.next/static`, as exercised explicitly here.

## CI and publication

The first GitHub `validate` run exposed a brittle cancellation assertion that depended on observing a brief intermediate progress string after several sequential PDF loads. Its retained WebKit trace showed the other 76 tests passing. The cancellation test now runs in a fresh page, holds the first PNG encoding, requires the real Cancel state, verifies that no page-complete progress is emitted before encoding finishes, and then checks cleanup and retry. The revised WebKit scenario passed five consecutive repeats; the full local suite passed 63 unit/integration and 79 Playwright tests. [GitHub `validate` run 38297151318](https://github.com/RavilkaDev0/toolbox/actions/runs/38297151318) passed on `7f63cd0219b4ef1bc5df09b750b70c6151ced757`, including browser tests and production build. The common Draft PR remains open; no merge, release, or deploy was performed.
