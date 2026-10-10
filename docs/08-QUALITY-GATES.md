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
- Playwright runs the same homepage smoke assertions in Chromium and WebKit's Desktop Safari profile: successful HTTP response, landmarks, keyboard focus on the skip link, catalog navigation and honest unpublished-tool state. Each browser writes its screenshot to a separate test output directory.
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
