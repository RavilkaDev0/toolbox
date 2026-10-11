# TBX-007 — Rotate PDF report

Rotate PDF is implemented as a local browser tool at `/tools/rotate-pdf`. It changes PDF page rotation metadata without rasterizing pages, then reopens and verifies the generated document before offering it for preview and download.

## Architecture

- `apps/web/app/tools/rotate-pdf/` owns the accessible page, worker lifecycle, cancellation, selection, and output URL. The shared `PdfPreview` renders one bounded page at a time; unmount now aborts the render and terminates its worker immediately.
- `packages/browser-engines/src/rotate-pdf.ts` inspects and rotates PDFs in a dedicated worker through `pdf-lib`. It checks the signature, document structure and resource bounds, combines the selected turn with existing page rotation, saves, reparses and compares each page’s content/resource identity, boxes and expected rotation.
- `packages/core/src/rotate-pdf.ts` holds pure quarter-turn and output-size rules. `packages/contracts/src/rotate-pdf.ts` validates selected page numbers and rotation settings.
- The existing static-PDF validator rejects encrypted documents, active/interactive features and malformed or over-budget structures. All bytes remain in the browser; the application makes no upload request for a selected or generated PDF.

The implementation uses the existing locked `pdf-lib@1.17.1` (MIT) and `pdfjs-dist@6.3.289` dependencies. No project dependency was added or changed.

## Limits and safety behavior

One input PDF is limited to 8 MiB and 100 pages. The output is limited to 8 MiB and processing has a 45-second worker watchdog. Shared static-PDF checks cap a document at 20,000 indirect objects, 100,000 traversal visits, depth 32, 12 MP per image, 24 MP total image pixels, and a 14,400 pt maximum page side. Preview input is separately capped at 64 MiB, 200 pages, and 12 MP per rendered image.

These limits bound the document copies, image decoding and page work needed in mobile browsers. Cancellation terminates the processing worker. Reset and replacement revoke the output Blob URL, clear the prior source/result preview, terminate preview workers and reject stale asynchronous results.

This tool accepts only static PDFs. It refuses encryption, forms, annotations, links, external streams, layers, actions and other active or interactive structures covered by the shared policy. It does not sanitize PDFs and does not promise preservation of signatures, bookmarks, document-level metadata, attachments or interactive behavior.

## Output verification

Fixture `split-pages.pdf` is 6,542 bytes. `independent-verification.json` and `standalone-verification.json` record checks using strict pypdf parsing and PDFium rendering. For every output page they compare page count/order, resulting rotation, page boxes, text and decoded content streams; the output raster hash matches the source raster rendered with the intended additional turn.

| Operation | Output size | Pages |
| --- | ---: | ---: |
| Selected pages, right 90° | 5,103 B | 5 |
| Selected pages, left 90° | 5,100 B | 5 |
| All pages, 180° | 5,113 B | 5 |

The browser tests also parse downloaded outputs with `pdf-lib`, inspect page rotations and boxes, verify unchanged page content, and exercise repeated operations. The outputs remain PDF documents with their original content streams and page geometry; no raster conversion is used.

## Performance evidence

Chromium measurements use real image-backed PDF fixtures. Processing time is measured from the user’s Apply action to a verified downloadable result. Output byte counts are from the downloaded PDF. `mainRealmHeapBytes` is the browser’s reported main JavaScript heap after the operation; it excludes worker heaps, canvas/GPU allocations and native PDF decoder memory, so it is not a peak-memory measurement.

| Fixture / input | Output | Dev processing | Standalone processing | Reported main heap (dev / standalone) |
| --- | ---: | ---: | ---: | ---: |
| 800 px / 291,341 B | 290,958 B | 1,152 ms | 360 ms | 23.1 / 11.2 MB |
| 2,000 px / 1,809,327 B | 1,808,944 B | 500 ms | 436 ms | 23.1 / 11.2 MB |
| 4,000 px / 7,216,658 B | 7,216,276 B | 936 ms | 906 ms | 23.1 / 11.2 MB |

Raw data: [development-performance.json](../evidence/tbx-007/development-performance.json) and [standalone-performance.json](../evidence/tbx-007/standalone-performance.json). The standalone build was exercised separately from `next dev`.

## Tests and visual review

- Unit/contracts/engine coverage includes valid and invalid rotation deltas and pages, existing page rotations, limits, malformed/encrypted/active documents, page identity, cancellation, result page count and real five-page PDF fixtures.
- Chromium and WebKit E2E cover the public route, file picker/drop, selected/all pages, left/right/180° rotation, computed preview, real output preview/download, cancellation/retry/reset, keyboard and mobile widths, repeated operation, and absence of upload requests. Performance sampling runs in isolated Chromium processes; WebKit runs the full functional route coverage.
- The production standalone build passed separate Chromium and WebKit E2E runs (including real output downloads); Playwright MCP verified the rendered route and reported no console errors or warnings.
- Independent pypdf/PDFium output verification is retained in the evidence directory.
- Desktop and mobile screenshots are available as [standalone desktop](../evidence/tbx-007/standalone-desktop.png), [standalone mobile](../evidence/tbx-007/standalone-mobile.png), [development desktop](../evidence/tbx-007/development-desktop.png) and [development mobile](../evidence/tbx-007/development-mobile.png).

Latest command and CI results are recorded below after the final quality-gate run.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed; lockfile unchanged |
| `pnpm lint` | Passed |
| `pnpm typecheck` | Passed |
| `pnpm test` | Passed; 57 unit tests and 68 Playwright tests |
| `pnpm build` | Passed; Next.js production build and standalone output |
| Production standalone Chromium/WebKit E2E | Passed; real output parsed and downloaded |
| GitHub Actions `validate` | Pending push |

## Remaining risks

PDF parser behavior varies across viewers. Structural checks and matching independent renders demonstrate this fixture set; they do not prove that arbitrary PDFs are safe or that every viewer will interpret every allowed PDF identically. Large PDFs can use substantially more memory during browser parsing than their file size suggests. Reported JavaScript heap excludes worker and native allocations. Limits and a cancellable watchdog fail closed when parsing, validation or output verification does not finish in budget.
