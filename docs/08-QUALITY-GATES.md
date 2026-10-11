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

Chromium and WebKit tests exercise the public `/tools/images-to-pdf` route: mixed JPEG/PNG/WebP conversion, lossy/lossless/alpha WebP, EXIF orientation, keyboard and drag reorder, picker/drop/removal/repeated selections, settings, damaged/empty/wrong-type/oversized/animated rejection, true worker cancellation/reset, URL revocation on reset/navigation, real download parsing, actual PDF.js preview pixels/page selection, and graceful preview worker failure. Responsive screenshots cover 390/1440px; the existing shell suite covers 320/390/768/1440px and native GET without JavaScript. At TBX-004 only Images to PDF was published; drafts remain real HTTP 404s. Network monitoring requires no non-GET requests during conversion. Two test workers bound concurrent large fixtures without relaxing assertions/timeouts. [TBX-004 report](development/TBX-004-REPORT.md) records actual command results, PDF output sizes, measurements and review evidence.

## Merge PDF automation (TBX-005)

Core/contracts enforce file/page/output bounds and immutable order. Engine tests cover real text/vector/image PDFs, mixed page geometry, rotations, corruption, encryption, active features, external streams, image bounds and generated PNG alpha masks. Chromium/WebKit exercise ordering, download parsing, preview, keyboard/touch, failure, hard worker cancellation, reset/retry, stale results, resource cleanup and watchdog expiry. Publication checks now require exactly Images to PDF and Merge PDF, with the other 13 tools draft. Two global test workers remain available, but WebKit uses one: large fixture previews otherwise compete for CPU/memory and codec/canvas resources. Assertions/timeouts are unchanged. Separate standalone production tests and independent pypdf/PDFium comparisons are recorded in [TBX-005 report](development/TBX-005-REPORT.md).
