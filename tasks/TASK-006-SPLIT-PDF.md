# TBX-006 — Production-Quality Split PDF

Owner-supplied acceptance criteria on 2026-10-11. Implement only Split PDF in the existing `feat/tbx-005-tool-suite` branch and Draft PR #5 targeting `dev`. Do not create another branch/PR or merge/release/deploy. Preserve all previous history and tests; stop after TBX-006.

## Behavior

- Process one local PDF in either Extract pages (one PDF in original ascending page order) or Split into separate PDFs (one single-page PDF per chosen page in one ZIP download).
- Accept one-based page expressions: `1`, `1,3,5`, `1-5`, `1-3,5,8-10`, and `all`. Deduplicate deterministically; reject empty, malformed, zero and out-of-range entries. Bound parsing before range expansion.
- Show file name/size/page count, source-page preview, selected count and estimated output count. Provide picker/drop, accessible settings, truthful state/errors, cancel, reset/retry, result preview/download and responsive keyboard/touch UI.
- Preserve original page content/resources, page order, geometry and rotation. No rendering/rasterization for output pages.

## Boundaries and privacy

Pure parsing/order/limits in core; strict settings contracts; static PDF inspection, page extraction/serialization and ZIP generation/verification in browser-engines; UI, dedicated Worker and resources in web. Reuse the Merge static-PDF validation policy/engine and PDF.js viewer without copying the Merge workspace or validator. No API, upload, storage or document-content network traffic.

Treat files as hostile. Refuse encryption, malformed PDFs and active/interactive features per ADR-0007 (including forms, annotations, actions, signatures, layers and attachments). Use bounded safe ZIP entry names (`page-001.pdf` etc.). Bound source bytes/pages, per-page output, archive output and job time. Terminate workers on cancellation and prevent stale updates; revoke result Blob URLs. Verify each PDF and the generated ZIP before exposing it.

## Evidence required

Unit tests cover bounded page syntax, deduplication/order, limits and strict settings. Binary tests cover one-page and noncontiguous extraction, all/selected ZIPs, visual/resource fidelity, corrupt/encrypted/unsupported inputs, bounds, abort, retry and repeated runs. Chromium and WebKit cover picker/drop, modes, keyboard, actual output parsing/download, preview, no uploads, cancel/reset/retry, responsive layout and console/hydration cleanliness. Retain standalone-build PDF/ZIP evidence and desktop/mobile screenshots. Independently inspect PDFs and ZIP with pypdf/PDFium/stdlib ZIP tools.

Required gates: frozen install, lint, typecheck, test, build, standalone Playwright and GitHub Actions `validate`. Publish only `split-pdf` after evidence/gates, keeping Images to PDF and Merge PDF published and every other unassigned tool draft. Update metadata, canonical/instructions/limits/related links. Record the tool in `docs/development/TBX-006-REPORT.md` and the shared PR checklist only after CI succeeds; add an ADR if the architecture materially changes.
