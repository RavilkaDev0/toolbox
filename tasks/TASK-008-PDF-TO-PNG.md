# TBX-008 — PDF to PNG

## Goal

Publish `/tools/pdf-to-png` as a browser-only renderer that turns one checked PDF into one PNG per selected page. One selected page downloads as PNG; multiple pages download as a ZIP of numbered PNGs.

## Boundaries and decisions

- `packages/core` owns render options, page/pixel/output/time ceilings, and page-selection checks.
- `packages/contracts` owns strict schemas for PDF metadata and render settings.
- `packages/browser-engines` owns PDF.js loading, sequential page rendering, cancellation checks, PNG validation, and ZIP assembly.
- `apps/web` owns upload, preview, settings, worker lifecycle, download, and result presentation.
- Reuse locked `pdfjs-dist@6.3.289` (Apache-2.0) and `fflate@0.8.3` (already in the workspace); no dependency or lockfile change is expected.
- Render one page at a time with the existing PDF.js parser worker. Disable annotations/XFA and network loading. Do not execute PDF JavaScript.
- Reuse `loadStaticPdf` to reject encrypted and unsupported active PDF features before PDF.js rendering; this tool accepts bounded static PDFs and does not sanitize them.
- Offer 96 DPI (screen) and 192 DPI (high resolution); PDF points map to pixels by `dpi / 72`, including page rotation.
- Transparent is the default canvas background; White explicitly paints opaque white. One selected page produces a PNG; multiple pages produce a store-only ZIP containing `page-NNN.png` entries in source order.

## Initial resource limits

- PDF input: 8 MiB; 1–100 pages.
- Per rendered page: at most 8 megapixels and 8,192 px on either edge.
- Per operation: at most 120 megapixels total, one active render task, and 45 seconds.
- Each PNG: at most 16 MiB. Multi-page ZIP: at most 32 MiB.
- At the per-page ceiling, the canvas backing store alone may occupy about 32 MiB (RGBA); PDF decoding, canvas encoding, and output buffers add memory. Sequential rendering avoids keeping several canvases alive. The aggregate limit bounds cumulative work, and output caps bound retained results. These are conservative browser-side limits, not a guarantee about a particular device's available memory.

## Acceptance criteria

- Verify MIME metadata where present, `%PDF-` signature/EOF, successful PDF.js structural parsing, nonempty page count, page limit, and selected pages.
- Provide source first-page preview, page count, All/Selected mode using the existing page-range parser, DPI, and background controls.
- Provide real drag/drop and file picker, cancel/reset/retry, status/errors, actual output preview, and a safe download name. Every non-submit action has `type="button"`.
- Preserve page order, rotation, mixed page geometry, and aspect ratio at the chosen scale without annotation interaction or rescaling.
- Reject encrypted, malformed, unsupported, page/pixel/time/output-limit inputs with actionable messages; no upload requests or sensitive telemetry.
- Abort render tasks, destroy loading tasks/workers, shrink canvases, drop byte references, and revoke result object URLs on cancel/reset/unmount. Generation IDs suppress stale async results.
- Unit-test pure limits/settings/page selection; browser integration-test actual PDF fixtures, PNG signatures/dimensions/pixels, ZIP entries/order/integrity, backgrounds, cancellation, retry, and cleanup.
- Independently compare browser PNG output against PDFium renders (allow antialiasing differences); run E2E in Chromium and WebKit at desktop/mobile viewports, with keyboard operation and no upload requests.
- Add unique SEO/canonical copy, catalog links/metadata, task report, and anonymized screenshots/evidence. Keep unrelated draft tools draft.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; inspect a standalone production build. Publish only after local binary/browser checks; commit and push in the shared TBX branch, then require green GitHub `validate` on that commit before marking complete.

## Risks to verify

- Canvas painting is browser-managed even though PDF parsing runs in the PDF.js worker. Benchmark responsiveness and cancellation in Chromium and WebKit; render sequentially and enforce wall-clock/pixel bounds.
- Canvas PNG encoding and memory vary by browser/device. Validate output caps and cleanup; Playwright cannot establish physical-device peak memory.
- Renderers can differ in glyph hinting, color management, and antialiasing. Compare geometry and broad pixel agreement, not byte/pixel identity.

## Completion record

- Implementation report: [`docs/development/TBX-008-REPORT.md`](../docs/development/TBX-008-REPORT.md).
- Production standalone outputs were reopened and compared to independent PDFium renders; see the report and `docs/evidence/tbx-008/` for measurements and screenshots.
- Local quality gates passed: 63 unit/integration and 79 Playwright tests, plus lint, typecheck and production build. GitHub Actions [`validate` run 38297151318](https://github.com/RavilkaDev0/toolbox/actions/runs/38297151318) passed on the pushed task commit.
