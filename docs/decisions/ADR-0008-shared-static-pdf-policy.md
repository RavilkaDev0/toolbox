# ADR-0008 — Shared static-PDF processing policy

Status: accepted for TBX-006. Reuses the installed MIT pdf-lib 1.17.1 and introduces pinned MIT fflate 0.8.3 for browser ZIP output. Processing remains entirely local.

## Context

Merge PDF already validates static documents, rejects encrypted or active features, bounds parsing, and checks copied page fingerprints. Split PDF needs the same threat policy and preservation guarantees. Copying the checks would let the two tools drift; a universal document framework would add indirection for only two callers.

## Decision

Extract the existing PDF inspection policy and page identity checks into `packages/browser-engines/src/static-pdf.ts`. Keep pure byte/page/time limits and `parsePageRanges` in `packages/core`, with strict file/option shapes in `packages/contracts`. Both Merge and Split call this concrete shared PDF policy. The existing Merge error exports and engine API stay compatible.

Split uses `pdf-lib` `copyPages` to extract selected pages without rasterizing or recompressing their content. It reopens and compares page boxes, rotation, content-stream and resource fingerprints. The one-file-per-page mode uses fflate's streaming ZIP writer in store mode; PDF streams are already compressed. It verifies entry count/names/bytes after writing the archive. Names are page numbers, never user filenames.

Keep the two product operations and their UI/worker protocols independent. Do not introduce a generic PDF job framework. Hard cancellation terminates each tool's dedicated Web Worker; URL lifetime, stale-result guards and presentation remain in each tool workspace.

## Bounds and tradeoffs

Split accepts one PDF up to 8 MiB and 100 pages, with existing parser bounds of 20,000 indirect objects, 100,000 traversal visits, depth 32, 12 MP per image, 24 MP total pixels and 14,400 pt per page side. A single extracted PDF or the complete ZIP is limited to 8 MiB and each job has a 45-second hard worker deadline. These deliberately conservative bounds reduce mobile tab pressure but cannot impose a browser heap ceiling or guarantee survival of every decompression attack.

Only static PDFs are accepted. Encryption, forms, annotations/links, actions/JavaScript, optional-content layers, signatures, embedded files and external streams are refused. This is not sanitization. Bookmarks, document metadata and accessibility structures are not promised. Physical low-memory-device testing and parser fuzzing remain risks.

fflate is an additional small, dependency-light ZIP package instead of adding a second PDF-writing dependency or implementing ZIP/CRC/data descriptors locally. Context7 documentation and upstream package metadata confirmed streaming APIs and the MIT license. Its direct test-only web dependency lets Playwright parse the actual downloaded ZIP.

## Consequences

The shared check reduces duplicated security and fidelity policy while keeping the product engine APIs simple. Full-page copies preserve text, vector drawing, images, page geometry and rotation; output fingerprints and independent pypdf/PDFium checks detect page-order/fidelity regressions. ZIP stores safe page-only filenames and makes one download for split-all. Per-page PDF sizes and archive overhead count against the output cap.

See [TBX-006 acceptance criteria](../../tasks/TASK-006-SPLIT-PDF.md), [architecture](../02-ARCHITECTURE.md), and [verification report](../development/TBX-006-REPORT.md).
