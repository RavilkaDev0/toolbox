# TBX browser-test stability preflight

Date: 2026-10-12. Shared branch: `feat/tbx-005-tool-suite`; shared Draft PR: #5 to `dev`.

## Failure and diagnosis

GitHub Actions run `38159357800` failed on the same `fe439b73d357766ae3199e6b4ee60f4443620367` commit that had passed in run `38158943075`. It reported two WebKit failures: the Images to PDF reset test did not reach “No images selected”, and the Split PDF limits test did not report the valid five-page fixture ready. The historical run retained no Playwright artifacts, so its trace and screenshots cannot be inspected.

Local traces reproduced the Split startup failure and exposed the same failure mode in the Rotate PDF performance test. Those tests called `setInputFiles()` on a hidden input immediately after navigation. Under a cold or busy browser, the test bypassed the visible React-controlled picker interaction. The failing trace ended with “Checking files…” and “No PDF selected”, with the picker disabled and no result or error. Clicking the visible “Choose files” control, waiting for Playwright’s file-chooser event, then setting the file removed the race and preserved the final readiness and output assertions.

The Images reset test selected a large image and clicked Reset without first observing that asynchronous validation had started. It now waits for the real “Checking files…” state, then resets and continues checking worker termination, URL cleanup, stale-result rejection and retry.

## Changes

- Split limits and Rotate performance tests select files through the visible file picker and wait for the existing browser readiness assertions.
- Images reset test synchronizes on the real validating state before Reset.
- Playwright captures a screenshot only on failure.
- GitHub Actions uploads `apps/web/test-results/` on a failed job for seven days, including traces and screenshots. No user documents are present in these anonymized test artifacts.

## Verification

- Images reset, WebKit: 10/10 repeats after the first correction, then 5/5 in the combined stress run.
- Split limits: Chromium 5/5 and WebKit 5/5 in the combined stress run.
- Rotate performance: Chromium 5/5 in the combined stress run; three actual PDF sizes were reopened and checked on each run.
- A full local run using direct file assignment reproduced Split and Rotate startup failures. After changing those flows, targeted repetitions passed Images reset 10/10, Split 5/5 in both browsers, and Rotate performance 5/5. The combined 20-test stress run passed.
- Final local gates all passed: `pnpm lint`, `pnpm typecheck`, `pnpm test` (57 unit/integration and 68 Playwright tests), and `pnpm build`.
- Commit/push and GitHub Actions `validate` are pending.

## Conclusion and remaining checks

The root cause is a test startup race around native file selection; local repeat runs now exercise the same user interaction and remain stable in Chromium and WebKit. Local validation is complete. Do not start TBX-008 until the corrected commit receives a green GitHub `validate` run.
