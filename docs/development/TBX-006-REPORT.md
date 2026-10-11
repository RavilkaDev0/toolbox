# TBX-006 — Split PDF verification report

Date: 2026-10-11
Route: `/tools/split-pdf`
Branch: `feat/tbx-005-tool-suite` → shared Draft PR #5 (`dev`)

## Result

Split PDF is implemented as a local browser tool. One static PDF (up to 8 MiB / 100 pages) can be reduced to one PDF containing selected pages, or selected pages can be exported as one PDF per page in a single ZIP. One-based ranges support `all`, comma-separated pages and ranges; duplicates are removed and output stays in source-page order. The catalog publishes only `split-pdf` for TBX-006; Images to PDF and Merge PDF remain published, and the other twelve tools remain draft.

## Architecture and privacy

Pure range parsing, ordering, and bounds live in `packages/core`; strict worker settings are in `packages/contracts`. `packages/browser-engines` reuses the concrete static-PDF inspection and page-fingerprint policy extracted from Merge PDF, copies pages with `pdf-lib`, reopens and compares output, and writes/opens/verifies a streaming ZIP with safe names such as `page-004.pdf`. No output page is rasterized. `apps/web` provides the public route, local PDF.js source/result preview, accessible range/mode controls, picker/drop, a dedicated worker, hard worker termination on Cancel/watchdog, stale-result guards, reset/retry, and Blob URL cleanup.

Processing runs in the browser. The browser E2E tests observe no non-GET request during inspection, conversion, preview or download; no source filename or file contents are sent to analytics or a service. Output filenames derive from page numbers, never the input filename.

The existing `pdf-lib@1.17.1` (MIT) is reused. Pinned `fflate@0.8.3` (MIT) was added for streaming ZIP output; its store mode avoids recompressing already-compressed PDF streams and avoids a custom ZIP implementation. Its production use is dynamically imported by the Split worker. The app's existing PDF.js viewer remains lazy-loaded for preview. No server, upload API, database or storage dependency was introduced.

## Security and limits

The policy checks the PDF signature and parses the actual document. It refuses encrypted, corrupt, malformed, active or interactive documents, including forms, annotations/links, actions/JavaScript, layers, signatures, attachments and external streams. It bounds indirect objects, traversal work/depth and image dimensions before exposing preview or processing. ZIP names are generated from bounded page numbers; every entry is reopened and checked against the expected count, length and content identity before the archive is returned. This is a conservative static-PDF policy, **not PDF sanitization**, and it does not claim that an output is safe to open in every other PDF reader.

| Resource | Limit |
| --- | ---: |
| Input | 8 MiB, one PDF, at most 100 pages |
| Indirect objects / traversal | 20,000 / 100,000 visits / depth 32 |
| Image dimension budget | 12 MP per image, 24 MP total |
| Page side | 14,400 pt |
| Extracted PDF | 8 MiB |
| Split output | 8 MiB total ZIP and at most 100 entries; each page PDF at most 8 MiB |
| Job time | 45 seconds, enforced by terminating the worker |

These bounds are intentionally conservative for mobile tabs. They cannot impose a browser heap ceiling or eliminate every parser/decompression memory spike; there is no portable browser API for measuring or capping a worker's peak native/JS memory. A multi-page split can duplicate shared source resources into each single-page PDF and exceed the aggregate output cap even when the source is under its input cap. A real five-page shared-image fixture exercises that refusal, then confirms a one-page retry succeeds.

Bookmarks, document-level metadata, accessibility structures, digital signatures, interactive forms and attachments are not promised; files using refused active features are rejected. Physical low-memory mobile devices and PDF fuzzing remain untested risks.

## Verification evidence

The browser output was independently checked with pypdf 6.10.0, Python's standard `zipfile`, and PDFium (`pypdfium2`). The extracted file has 4 pages in normalized source order `[1, 2, 4, 5]`; text, decoded page content streams, media/crop/bleed/trim/art boxes and rotations matched the source fixture. PDFium's raster dimensions and SHA-256 matched source pages for extracted and per-page ZIP outputs. Selected ZIP contains exactly `page-001.pdf` and `page-004.pdf`; all-pages ZIP contains exactly five page-number entries. The standalone production downloads were checked independently as well.

Synthetic PDFs include portrait and landscape pages, non-default crop boxes, 90°/270° rotations, text, vector content and an image. Negative fixtures cover damaged, encrypted, active/interactive, excessive page/input size and an output whose expanded split exceeds the ZIP cap. Browser tests also cover ranges, deduplication, source ordering, preview, keyboard use, picker/drop, cancellation, stale results, retry/reset, Blob URL/worker cleanup, mobile widths and no-upload network observations.

## Commands and results

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed |
| `pnpm lint` | Passed; 127 files checked |
| `pnpm typecheck` | Passed across workspace packages, API and web |
| `pnpm test` | Passed: 48 unit/integration tests; 65 Playwright tests passed, 1 intentional Chromium-only performance case skipped in WebKit |
| `pnpm build` | Passed; production route `/tools/split-pdf` emitted |
| Standalone production: `playwright test e2e/split-pdf.spec.ts --project=chromium --workers=1` | Passed: 4/4, real PDF/ZIP downloads, limits, retry/cancel, three-size benchmark |
| Playwright MCP on standalone `/tools/split-pdf` | Public page/landmarks and limits visible; 0 console errors or warnings |
| Independent pypdf / ZIP / PDFium verification | Passed for extracted PDF, selected ZIP and all-page ZIP |

The full Chromium/WebKit E2E suite ran with one worker because the memory-bound PDF fixture cases should not compete for browser decoder resources. Assertions, test timeouts and production limits were not relaxed. Standalone production was exercised in Chromium; WebKit exercised the same public flows against the local development server.

## Production performance sample

Measured from the production standalone route using Chromium on this development workstation. Each input is a one-page PDF containing an embedded image. The timer covers the user-triggered split, worker processing and displayed completion; output byte counts are the downloaded and parsed artifacts. These are one local sample, not a cross-device benchmark.

| Input PDF | Input bytes | Per-page PDF bytes | ZIP bytes | Processing ms | Main-page JS heap after completion |
| --- | ---: | ---: | ---: | ---: | ---: |
| `image-800.pdf` | 291,341 | 290,826 | 290,964 | 308 | 11,200,000 B |
| `image-2000.pdf` | 1,809,327 | 1,808,813 | 1,808,951 | 411 | 11,200,000 B |
| `image-4000.pdf` | 7,216,658 | 7,216,144 | 7,216,282 | 945 | 11,200,000 B |

The heap number is `performance.memory.usedJSHeapSize` from the page after each completed operation. It excludes worker memory, browser-native PDF/parser buffers, decoded images and peak allocation, so it must not be read as total or peak memory. Detailed timing output and the actual standalone PDFs/ZIPs are retained below.

## Remaining risks

- A browser/OS can still terminate a tab for memory pressure; the application cannot guarantee a peak heap ceiling.
- Limits are static-analysis safeguards, not a substitute for a sandboxed server parser or proof against all hostile PDF parser inputs.
- Refusing active PDF features intentionally excludes some documents; no metadata/bookmark preservation is promised.
- Performance data is one local Chromium workstation sample. Low-memory physical phones/tablets and broad parser fuzzing have not been measured.
- WebKit passed the full development-server suite but was not run against the standalone bundle.

## Retained artifacts

- Acceptance criteria: [`tasks/TASK-006-SPLIT-PDF.md`](../../tasks/TASK-006-SPLIT-PDF.md)
- Shared policy decision: [`ADR-0008`](../decisions/ADR-0008-shared-static-pdf-policy.md)
- Independent verifier and synthetic binary fixtures: `apps/web/e2e/fixtures/`
- Downloaded output PDFs/ZIPs, independent parser/render JSON and Chromium performance JSON: [`docs/evidence/tbx-006/`](../evidence/tbx-006/)
- Production standalone screenshots after real processing: [`standalone-split-1440.png`](../evidence/tbx-006/standalone-split-1440.png), [`standalone-split-390.png`](../evidence/tbx-006/standalone-split-390.png)
