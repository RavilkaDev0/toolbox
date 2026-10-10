# 08 — Quality Gates & Definition of Done

## Every PR
- Clear scope; independent of unrelated changes.
- `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` succeed.
- E2E smoke tests for affected flows; automated browser tests on Chromium and one WebKit profile at minimum, with real-device smoke where feasible.
- No untyped public API, unreviewed binary dependency or ignored failing tests.
- Appropriate docs/ADR changes.
- Review security/privacy and performance impact.

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
