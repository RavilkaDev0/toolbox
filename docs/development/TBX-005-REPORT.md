# TBX-005 — Merge PDF verification report

Implemented from dev `4ef7159a957274bfa98635f810eea06b9447d5b6` on the shared `feat/tbx-005-tool-suite` branch. Acceptance criteria are in [TASK-005](../../tasks/TASK-005-MERGE-PDF.md); the one long-lived [Draft PR #5](https://github.com/RavilkaDev0/toolbox/pull/5) targets dev. Verification date: 2026-10-11. No merge, release or deployment. TBX-006 awaits a separate assignment.

## Architecture and behavior

Core owns file/page/output/time/object/pixel limits and immutable document ordering. The existing image ordering export uses the same pure operation. Contracts owns strict Zod metadata validation. Browser engines inspect actual PDF structures, copy original pages, save and reparse results. Web owns the dedicated conversion worker, cancellation/watchdog, selection, generation guards, Blob URL lifecycle and accessible UI. The PDF.js canvas viewer was moved to shared workspace presentation and is also used by Images to PDF. No generic PDF framework or backend changes were introduced.

Select at least two PDFs; add more atomically, inspect counts, optionally preview each document's first page, drag or use Move up/down, remove documents and merge. Output is downloadable only after serialized validation. The real output viewer selects any merged page. Cancel terminates the active conversion worker and leaves selection for retry; Reset clears everything. Reset/navigation invalidate stale callbacks and release URLs and workers. States describe actual work without percentages or simulated progress. Keyboard controls have explicit button types; touch targets are at least 44 px.

`copyPages` preserves page content/resources without rasterization or JPEG re-encoding. Runtime result checks compare count, ordered Media/Crop/Bleed/Trim/Art boxes, rotation, UserUnit, raw content-stream fingerprints and recursive font/image/resource fingerprints after reparsing. Per-document memoization avoids repeatedly hashing shared resources. These fingerprints detect accidental copy/order changes, not cryptographic authenticity.

## Threat model and limits

See [ADR-0007](../decisions/ADR-0007-merge-pdf.md) for the complete policy. Hostile files can contain malformed trees/references, encrypted data, active features, external streams, deeply nested objects, decompression bombs and excessive pixel/page declarations. Validate MIME (empty or application/pdf), exact header/version/EOF and parser structure. Inspect every parsed indirect object, including unused objects, with reference/cycle handling and traversal bounds. Encryption is refused without password bypass. Fixed error categories avoid confidential filenames, content and raw library messages in logs.

| Limit | Value |
| --- | --- |
| Selected PDFs | 2–10 for merging; one may be inspected first |
| Compressed bytes per file / selection | 8 MiB / 24 MiB |
| Pages per document / selection | 100 / 200 |
| Serialized output | 48 MiB |
| Indirect objects / traversal visits / depth | 20,000 / 100,000 / 32 per document |
| Page side | 14,400 pt |
| Image pixels per resource / document | 12 MP / 24 MP |
| Conversion/inspection watchdog | 45 seconds |
| Shared preview | 64 MiB, 200 pages, 12 MP images, maximum 640 × 800 canvas |

PDFs with forms/XFA, nonempty annotations (including hyperlinks), actions/JavaScript, attachments/associated files, portfolios/rich media, external streams or digital signatures are refused. Empty annotation arrays are accepted, including generated Toolbox PDFs. Parser warnings are converted into invalid-input errors within the dedicated worker; a hostile large-number fixture verifies no content-bearing console warning. PDF.js verbosity is zero; failures still reach UI errors. Rendering uses bytes, no URL/CDN, no annotation/action layer and XFA disabled. There is no upload route, source transfer or document analytics.

A decoded 12 MP image costs about 48 MB for one RGBA buffer, before decoder/renderer copies. Inspection is sequential; conversion retains copied resources rather than all source documents. Only one explicitly requested input preview is mounted, and preview renders one page at a time. Buffers are released with worker termination; actual garbage collection is controlled by the browser. Compressed file/object limits are best effort: parsing/decompression can allocate before post-parse bounds. Workers have no enforceable heap quota. Physical low-memory phone behavior and malicious parser fuzzing remain unverified.

No sanitization or external-reader safety is claimed. Bookmarks, metadata and accessibility structure are not preserved. Signed/interactive PDFs must first be exported as authorized plain static documents; there is no silent flattening or rasterization fallback.

Optional-content layers are also refused. A synthetic default-OFF layer rendered with SHA-256 `9170178160d67231af65c4f74863b0f7a4c4670b0ca7b402f40bd3c45646a00f`; naive page copying without its document-level visibility configuration rendered `1813545f2d58432e1bf9caf69e7ed633e22b71119d12f6cd0a7f82bd4510e559`. The new real layers.pdf fixture verifies refusal in engine and browser checks instead of silently changing visible content. Export a plain static PDF in an authorized editor first.

## Dependencies and tooling

No package or lockfile changes. Reuse pinned pdf-lib 1.17.1 (MIT) for non-rasterizing page copying and pdfjs-dist 6.3.289 (Apache-2.0) for actual local previews. The writer loads on inspection/conversion; the viewer loads on preview. Both are hosted locally. Existing installed sizes/alternatives are recorded in [TBX-004](TBX-004-REPORT.md); pdf-lib's older release and the substantial PDF.js preview download remain maintenance/transfer risks. Native viewer-only previews are inconsistent across tested profiles, while rasterization would destroy required fidelity.

Ponytail, React best practices, shadcn and UI/UX guidance informed the focused implementation. Context7 was queried for public pdf-lib documentation; Codebase Memory's foundation index was supplemented with source searches for newer engine files. Playwright MCP inspected the local development public route and reported zero console warnings/errors. Production processing checks use CLI Playwright separately, within the same loopback app.

Independent verification uses the already bundled Python pypdf/PDFium tools, not runtime dependencies. Synthetic fixture generation is in [create-pdfs.py](../../apps/web/e2e/fixtures/create-pdfs.py); fixture PDFs contain no personal information. The semantic fixtures are reproducible; encryption initialization can vary binary bytes. Independent comparison can be rerun with `python apps/web/e2e/fixtures/verify-merge.py <ordered-merge-download.pdf>`.

## Verification results

| Command | Final local result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; lockfile unchanged, supply-chain policy check passed |
| `pnpm lint` | Passed; final 112 source/test/evidence files |
| `pnpm typecheck` | Passed; six workspaces, including Next route type generation |
| `pnpm test` | Passed; 39 unit/integration tests in 12 files, 58 Chromium/WebKit scenarios in 3.9 minutes |
| `pnpm build` | Passed; API and optimized Next build with both real public tool pages |
| Standalone production converter suite | Passed; all 30 Images/Merge Chromium/WebKit scenarios in 2.1 minutes |
| Independent pypdf/PDFium verification | Passed; all three original/output page bitmap hashes match |

The public-route gates were rerun after correcting preview of validated PDFs with empty MIME. Production ran the built standalone server with copied local static assets, not `next dev`. Its converter suite includes all 16 existing Images to PDF scenarios and 14 new Merge PDF scenarios. No tests, lint rules or type checks were disabled. GitHub `validate` on the pushed verification head is linked in the shared PR's completion entry.

The initial implementation CI passed. An automatic second run after editing the PR exposed one Chromium clock-test failure (57/58): after a single virtual-time jump, the test did not observe the watchdog UI. The deadline test now waits for initial page loading, pauses the clock before selection, observes worker dispatch, runs every timer callback, asserts no termination at 44,999 ms and termination at exactly 45,000 ms, then advances one rendering frame before checking the error UI. This follows [Playwright Clock guidance](https://playwright.dev/docs/clock). The stronger assertions use the original timeouts and no retries. Processing/runtime code did not change. Repeated Chromium/WebKit checks and the final full gates verify the correction.

The retained Chromium ordered download is 7,191 bytes and three pages: rotated Letter MediaBox 612 × 792 pt / CropBox (12,20)–(580,760), rotation 90°; A4 portrait 595.2756 × 841.8898 pt; A4 landscape 841.8898 × 595.2756 pt. Its SHA-256 and independent bitmap hashes are in the comparison JSON.

Core/contracts cover signatures, strict metadata, wrong formats, exact byte/count/page/output boundaries and immutable ordering. Engine integration covers actual two/multiple-document merges, A4/Letter portrait/landscape, rotation/crop, repeated runs, text/vector/image resources, corruption, encryption, empty/too-many pages, cumulative pages, oversized image/page declarations, external streams and cancellation during reads. A real Images to PDF output merges successfully with its PNG alpha mask unchanged.

Chromium/WebKit exercise upload controls, real file drop and document drag, keyboard ordering, additions/removals, minimum selection, optional input preview (including empty MIME), actual output preview/download parsing, every refusal category, mobile/desktop overflow and touch targets, hard worker cancellation, retry/reset/navigation, stale results, URL/worker cleanup and deterministic hung-worker fault injection. Network assertions observe no non-GET or external requests during the actual merged-file workflow. Console/hydration errors are asserted absent, including malformed-input rejection. Existing Images to PDF tests remain intact and exercise the shared viewer.

Independent pypdf checks exact text, content operators, boxes and rotation of the three-page ordered result. PDFium independently renders every merged page and corresponding original: dimensions and bitmap SHA-256 must match. These checks cover preservation of synthetic text, vector rectangles and source JPEG images. See [raw comparisons](../evidence/tbx-005/independent-verification.json), [page 1](../evidence/tbx-005/pdfium-page-1.png), [page 2](../evidence/tbx-005/pdfium-page-2.png), [page 3](../evidence/tbx-005/pdfium-page-3.png) and [actual download](../evidence/tbx-005/chromium-ordered-merge.pdf).

Screenshots: [Chromium desktop](../evidence/tbx-005/chromium-merge-1440.png), [Chromium mobile](../evidence/tbx-005/chromium-merge-390.png), [WebKit desktop](../evidence/tbx-005/webkit-merge-1440.png), [WebKit mobile](../evidence/tbx-005/webkit-merge-390.png). All were visually reviewed. The [production audit](../evidence/tbx-005/production-assets.json) verifies canonicals, both published tools, draft/private 404s and no PDF library download on the homepage.

The strengthened deadline test passed 20 diagnostic repeats (10 per browser). A later full local run exposed two five-second preview waits on large WebKit retry PDFs; the trace showed verified downloads, with one preview completing immediately after the assertion expired. To bound test CPU/memory pressure, the WebKit project now uses one worker while Chromium retains two. No assertion, fixture size, timeout or retry was relaxed. These are isolated browser fixture jobs, not a claim that two simultaneous large-document tabs meet a five-second preview budget. The final required gates and standalone checks were repeated after this resource setting.

A separate WebKit pointer action stalled after the drag/add/preview sequence before conversion started. The merge-output test helper now explicitly focuses the button before its real pointer click; visibility/stability checks and download assertions remain unchanged. That sequence passed ten WebKit diagnostic repeats. This restores explicit focus after the programmatic file-picker sequence without a forced click or synthetic processing delay.

## Performance and memory

| Embedded JPEG + Letter PDF | Total input bytes | Output bytes Chromium / WebKit | Chromium elapsed | WebKit elapsed |
| --- | --- | --- | --- | --- |
| 800 × 600, 0.48 MP | 295,625 | 293,961 / 293,961 | 1,133 ms | 1,084 ms |
| 2000 × 1500, 3 MP | 1,813,611 | 1,811,947 / 1,811,946 | 1,665 ms | 2,311 ms |
| 4000 × 3000, 12 MP | 7,220,942 | 7,219,279 / 7,219,279 | 3,805 ms | 5,257 ms |

Chromium reported 10,600,000 bytes of main-realm JS heap after each run; the coarse identical readings cannot establish peak usage or absence of leaks. WebKit recorded null. The output reductions here are small document serialization differences, not image recompression. The preserved source image streams are checked directly.

Windows machine, pinned Playwright 1.64.0, standalone production, two global test workers with WebKit limited to one. Each datum is one run without CPU throttling; not a percentile or physical-mobile benchmark. Inputs are existing deterministic noisy JPEGs embedded in actual PDFs, plus Letter text/vector/image PDF. Timing begins after selection/inspection and includes merge, serialized verification, first-page rendering, download and parsing. Original image streams remain unchanged; PDF compression is not promised. Repeat operations preserve semantics, but timestamps may vary binary hashes.

The reported Chromium `performance.memory.usedJSHeapSize` is main-realm heap after completion; it excludes conversion/preview workers, native codecs/canvases and peak allocations. WebKit exposes no corresponding value and records null. Resource lifecycle tests assert zero outstanding tracked Blob URLs and native workers after reset/navigation/cancellation; they do not establish a mobile memory peak. Raw [Chromium](../evidence/tbx-005/chromium-performance.json) and [WebKit](../evidence/tbx-005/webkit-performance.json) measurements retain these limitations.

## Publication and self-review

Only merge-pdf changes draft→published. Images to PDF remains published; the other 13 tools stay draft and return real 404s. Catalog counts/search, homepage copy, metadata/canonical, instructions, limits and related public links are updated. The temporary private merge route used before publication was removed.

Changed areas: core limits/order/catalog/tests, strict contracts, browser merge/preview engines and binary integration tests; shared viewer and existing image adapter; merge worker/UI/route/SEO; real fixtures and browser tests; architecture/quality docs, ADR and report/evidence. PDF binary attributes preserve byte offsets across Git checkouts (including ASCII-only PDF fixtures). AGENTS.md, backend services, dependency manifests/lockfile and GitHub settings are unchanged.

Self-review checked dependency direction, lazy imports, worker/timer/URL cleanup, stale-result guards, immutable ordering, error privacy, input bounds, keyboard/touch controls, no fake progress and retained regression tests. Remaining risks: post-parse memory allocation on malicious compressed objects; unmeasured physical devices/worker/native peak memory; conservative refusal of some harmless custom PDF dictionaries; missing archival font/color/accessibility guarantees; preview failure for unsupported visual features, with verified output still downloadable. Keep PR Draft and await the owner's next task.
