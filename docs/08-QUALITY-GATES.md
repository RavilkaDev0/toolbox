# 08 — Quality Gates & Definition of Done

## Every PR
- Clear scope; independent of unrelated changes.
- `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` succeed.
- E2E smoke tests for affected flows; automated browser tests on Chromium and one WebKit profile at minimum, with real-device smoke where feasible.
- No untyped public API, unreviewed binary dependency or ignored failing tests.
- Appropriate docs/ADR changes.
- Review security/privacy and performance impact.

## Foundation automation
- The `Quality` workflow runs on PRs targeting `dev` and `main` (including base edits and transition out of Draft), and on pushes to either branch.
- Its `validate` job installs from the frozen lockfile, then runs Biome (`pnpm lint`), strict TypeScript (`pnpm typecheck`), Vitest and Playwright (`pnpm test`), and production builds (`pnpm build`).
- Playwright runs the same homepage smoke assertions in Chromium and WebKit's Desktop Safari profile: successful HTTP response, landmarks, keyboard focus on the skip link, catalog navigation and accurate publication state. Each browser writes its screenshot to a separate test output directory.
- The Windows WebKit build skips implicit link focus with `Tab`; a minimal browser reproduction confirmed that an explicit `tabIndex={0}` makes the skip link participate in normal document order. The shell includes that attribute, and both profiles must pass real `Tab` focus and `Enter` activation into the main region; no assertion is skipped or replaced with scripted focus.
- Install local browser binaries with `pnpm --filter @toolbox/web exec playwright install chromium webkit`; Linux CI includes `--with-deps`. This smoke coverage does not replace real Safari/device checks or future processing-fixture tests.
- Follow [Git workflow](09-GIT-WORKFLOW.md) for PR targets, release review and proposed required-check settings. A successful run is evidence; checks are not enforced until repository protection is configured.

## Engine tests
- Input: empty, boundary size, wrong MIME, damaged/truncated, protected (PDF), excessive dimension/page count, filenames with special chars.
- Processing: cancellation, repeated runs, concurrency, cleanup, abort on navigation, resource/time bounds.
- Output: integrity/fidelity, expected page count, order, metadata handling, format and download name.
- Feature-specific: alpha PNG→JPEG, Unicode, QR scanning, cryptographically secure password generation.
- Prefer stable fixtures, golden outcomes, explicit assertions; do not only snapshot markup.

## API tests (when uploads enabled)
- 202 state transitions; 401 without token; 410 expired result; 413 oversized; 429 rate limit; retry/cancel idempotence; no path leakage; no orphan temporary files; worker kill behavior.

## Performance / observability
- Core Web Vitals budgets: LCP 2.5s p75, CLS 0.1, INP 200ms target on field data when sufficient volume.
- Tool error category metrics only; no content, URL payloads or user filenames.
- Track heap growth and file cleanup on repeated conversions.
- Alerting on API downtime, increased errors, high disk use and failed cleanup, after server-side features launch.

## Definition of Done
A tool is done ONLY if published route works on real fixtures, standard states work on touch/keyboard, tests pass, limits are honest, SEO copy is unique, and privacy claims reflect implementation.

## UI foundation automation (TBX-003)

The suite now covers registered route semantics, real unpublished/unknown HTTP 404s, publication-aware search/category/reset with synthetic private fixtures, query errors, keyboard focus, reduced motion, native GET with JavaScript disabled, metadata-only file selection bounds/removal/drop/repeated selection, workspace UI states and fixture download. Responsive coverage uses 320/390/768/1440px in Chromium and WebKit and fails on runtime/console/hydration errors. Desktop/mobile screenshots are retained as [review evidence](development/TBX-003-REPORT.md). Unit checks cover token contrast, typed query bounds and pure published filtering. Web typecheck runs the installed Next.js `typegen` before strict TypeScript; generated route validators are regenerated, not ignored or removed from checks. The UI foundation does not satisfy any converter's binary-fixture publication gate.

## Images to PDF automation (TBX-004)

Core/contracts tests exercise real image headers, strict settings, A4/Letter/Auto dimensions, proportional Fit/Fill, immutable ordering, PNG CRC corruption, duplicate JPEG frame headers, WebP container/bitstream disagreement, and exact resource boundaries. Browser-engine lifecycle tests use real binary inputs with isolated native API doubles to verify cancellation, bitmap close/canvas release, retry and serialized PDF page count.

Chromium and WebKit tests exercise the public `/tools/images-to-pdf` route: mixed JPEG/PNG/WebP conversion, lossy/lossless/alpha WebP, EXIF orientation, keyboard and drag reorder, picker/drop/removal/repeated selections, settings, damaged/empty/wrong-type/oversized/animated rejection, true worker cancellation/reset, URL revocation on reset/navigation, real download parsing, actual PDF.js preview pixels/page selection, and graceful preview worker failure. Responsive screenshots cover 390/1440px; the existing shell suite covers 320/390/768/1440px and native GET without JavaScript. At TBX-004 only Images to PDF was published; drafts were real HTTP 404s. Network monitoring requires no non-GET requests during conversion. Two test workers bound concurrent large fixtures without relaxing assertions/timeouts. [TBX-004 report](development/TBX-004-REPORT.md) records actual command results, PDF output sizes, measurements and review evidence.

## Merge PDF automation (TBX-005)

Core/contracts enforce file/page/output bounds and immutable order. Engine tests cover real text/vector/image PDFs, mixed page geometry, rotations, corruption, encryption, active features, external streams, image bounds and generated PNG alpha masks. Chromium/WebKit exercise ordering, download parsing, preview, keyboard/touch, failure, hard worker cancellation, reset/retry, stale results, resource cleanup and watchdog expiry. The Merge-specific evidence is in [TBX-005 report](development/TBX-005-REPORT.md).

## Split PDF automation (TBX-006)

Split shares the bounded static-PDF validator with Merge and keeps a bounded pure page-range parser. Unit/integration fixtures cover valid page extraction, single-page PDFs in ZIP, all/selected pages, page geometry/rotations/text/vectors/images, empty/corrupt/encrypted/active PDFs, page limits, cancellation, repeated runs and output integrity. Chromium/WebKit exercise the public route, picker/drop, range validation, extract/download/preview, safe ZIP download, no file upload, worker cancellation, retry/reset, URL cleanup, touch/keyboard and 320/390/1440 px viewports. A Chromium test measures outputs at three real input sizes. The global browser runner stays single-worker and starts a fresh browser process per tool suite, per Split scenario and per large Chromium benchmark, preventing local PDF worker/canvas memory from accumulating across unrelated fixtures. An independent pypdf parser, standard ZIP reader and PDFium renderer compare output pages to source fixture pages; standalone production evidence and resource caveats are in [TBX-006 report](development/TBX-006-REPORT.md).

## Rotate PDF automation (TBX-007)

Rotate reuses the bounded static-PDF policy and page-range parser. Core/contracts cover relative quarter-turns, current angles, invalid settings and shared resource bounds; engine fixtures verify selected/unselected pages, 0/90/180/270° rotations, page boxes, text/vector/image streams, corruption/encryption/active-feature rejection, repeatability and cancellation. Chromium/WebKit exercise picker/drop, selected/all pages, left/right/180° operations, computed angle preview, actual output preview/download, cancellation/retry/reset, keyboard operation, mobile sizes and no upload requests. Three real image-backed PDFs feed a Chromium performance sample. Independent pypdf checks page order/count/angles/boxes/text/content streams, and PDFium compares output rasters against independently rotated source renders. Production standalone, screenshots and measurements are retained in [TBX-007 report](development/TBX-007-REPORT.md). Images to PDF, Merge PDF, Split PDF, Rotate PDF and PDF to PNG are published; the ten not-yet-implemented tools remain draft.

## PDF to PNG (TBX-008)

PDF.js renders a bounded static PDF locally in a dedicated worker. Core/contracts enforce selected page order, DPI, canvas pixel/edge, aggregate-pixel, PNG and ZIP limits; the engine renders one page at a time, preserves transparency when selected and stores ordered multi-page PNGs in a ZIP. Chromium/WebKit cover real download/preview output, page range and 192 DPI, transparent/white backgrounds, corruption/encryption/active-feature rejection, cancellation/retry, cleanup, mobile keyboard interaction and no uploads. Three embedded-image PDFs feed a Chromium benchmark; independent PDFium/Pillow checks dimensions and renderer output for single PNG and multi-page ZIP fixtures. Detailed standalone, performance and memory evidence is in [TBX-008 report](development/TBX-008-REPORT.md).

## Image Compressor automation (TBX-009)

Shared core image inspection validates JPEG, PNG and WebP signatures/structure before browser decode, including PNG CRCs and animated-image rejection. Compressor unit/contract tests cover strict formats/quality, metadata/content mismatch, corrupt and animated inputs, and file/decoded/output limits. Engine integration tests use actual fixtures, verify result signatures/dimensions, repeat work and assert bitmap/canvas cleanup on cancellation and encoder errors. Chromium/WebKit exercise actual JPEG/PNG/WebP input and output, EXIF orientation, alpha retention and JPEG white flattening, quality-by-keyboard, corrupt/spoofed/oversized refusal, worker cancel/retry/reset, mobile touch layout, download bytes, and zero non-GET requests. Chromium also records real output sizes and elapsed conversion time for three bounded input sizes. Browser codecs do not promise color-profile/high-bit-depth preservation, and Playwright cannot measure physical-device peak memory. See [TBX-009 report](development/TBX-009-REPORT.md).

## Image Resizer automation (TBX-010)

Core/contracts cover pixel and percentage geometry, locked-ratio rounding, intentional unlocked dimensions, strict settings and resource bounds. Browser-engine tests inspect real JPEG/PNG/WebP fixtures, reject malformed/animated/oversized content, validate actual output, repeat runs, and assert cancellation plus bitmap/canvas cleanup. Chromium and WebKit exercise the published route, actual downloads and independent output decoding, EXIF orientation, alpha preservation and JPEG white flattening, picker/drop, stretch warning, corrupt/empty/spoofed/oversized refusal, keyboard activation, worker cancellation/retry/reset, URL cleanup and no non-GET requests. The route is checked at 320/390/768/1440 px; Chromium records real output bytes and end-to-download time for three bounded inputs. Screenshots and sample outputs are retained in [TBX-010 evidence](evidence/tbx-010/); measurements and browser/device limitations are in [the report](development/TBX-010-REPORT.md).
