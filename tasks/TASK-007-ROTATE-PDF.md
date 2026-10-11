# TBX-007 — Rotate PDF acceptance criteria

Implement and verify `/tools/rotate-pdf` as a browser-only tool on the shared `feat/tbx-005-tool-suite` branch and Draft PR #5. Do not merge, release, deploy, or start TBX-008 as part of this task.

## Behavior

- [x] Select one static PDF, inspect its structure locally, and show its filename, byte size, page count, and a source page preview.
- [x] Rotate all pages or a bounded selected-page list/range using the shared `parsePageRanges` parser.
- [x] Offer left 90°, right 90°, and 180°; show current-to-result rotation angles before applying.
- [x] Apply rotations relative to each page's existing 0/90/180/270° value; retain page order, boxes, content streams, and resources without rasterization.
- [x] Reopen and verify the output, preview its actual bytes one page at a time, and keep download available when preview fails.
- [x] Cancel by terminating the worker; reset, retry, revoke output Blob URLs, and ignore stale results.
- [x] Keep processing local and disclose static-PDF limitations and resource bounds.

## Safety limits

- [x] One PDF, 8 MiB input, 100 pages, and 8 MiB verified output.
- [x] Existing ADR-0008 static-PDF checks: signature/structure, 20,000 indirect objects, 100,000 traversal visits, depth 32, 12 MP per image / 24 MP total, and a 14,400 pt maximum page side.
- [x] 45-second hard watchdog; worker termination on cancellation and timeout.
- [x] Reject encrypted, malformed, active, or interactive files; do not claim sanitization or preserve signatures, forms, bookmarks, metadata, or attachments.

## Verification evidence

- [x] Unit/contracts and browser-engine tests with real multi-page PDF fixtures.
- [x] Chromium and WebKit route tests for picker/drop, selected/all pages, all rotation choices, preview, download, cancellation/retry/reset, keyboard use, mobile widths, and no upload requests.
- [x] Independently compare output using pypdf and PDFium, including page rotations, page boxes, text/content streams, and transformed render output.
- [x] Exercise the production standalone build; retain download, performance, screenshot, and verification evidence in `docs/evidence/tbx-007/`.
- [x] Run `pnpm install --frozen-lockfile`, lint, typecheck, tests, and production build; obtain a green GitHub Actions `validate` on the pushed task commit before checking the shared Draft PR item. GitHub Actions `validate` passed on `e5f8c6b1502f91f1d63151fd0a52c2a6626509e8`.
