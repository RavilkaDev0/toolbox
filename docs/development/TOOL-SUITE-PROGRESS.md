# Toolbox tool suite progress checkpoint

Last verified: 2026-10-12. Repository: `D:\Pet`; branch: `feat/tbx-005-tool-suite`; Draft PR: [#5](https://github.com/RavilkaDev0/toolbox/pull/5) → `dev`. The preflight began from `fe439b73d357766ae3199e6b4ee60f4443620367` with `dev` as an ancestor and no uncommitted implementation changes; CI status is tracked below.

The owner authorized autonomous, sequential implementation of TBX-008–018 on 2026-10-12. This supersedes only the workflow's former stop-after-each-tool rule. The current mandatory preflight is to diagnose and fix the same-head WebKit CI instability before TBX-008.

| Ticket | Status | Commit / CI | Tests and implementation | Risks / next step |
| --- | --- | --- | --- | --- |
| TBX-004 Images to PDF | Integrated into `dev` | PR #4 | Browser-only image-to-PDF tool; see TBX-004 report | Do not reimplement. |
| TBX-005 Merge PDF | Complete on shared branch | `fe0ac20`, `853fafd`; existing CI evidence in PR #5 | Local browser engine, worker UI, Chromium/WebKit and independent PDF checks | Preserve existing behavior. |
| TBX-006 Split PDF | Complete on shared branch | `9133f3c`; validate run `38145280380` | Local page extraction/ZIP, Chromium/WebKit, standalone and independent output checks | Preserve existing behavior. |
| TBX-007 Rotate PDF | Implemented and published on branch | Feature `e5f8c6b`; docs `fe439b7`; validate `38158943075` passed, subsequent run `38159357800` failed on the same head | 57 unit/integration and 68 Playwright tests passed on a green run; a later same-SHA run had two WebKit E2E failures | Reestablish stable full CI before advancing. |
| CI stability preflight | Local gates complete; GitHub validation pending | Historical failed run `38159357800`, head `fe439b73d357766ae3199e6b4ee60f4443620367` | Root cause was a Playwright startup race: direct `setInputFiles()` immediately after navigation can run before the file-picker interaction is hydrated. Two additional local tests reproduced a permanently pending “Checking files…” state with no selected PDF. The actual file chooser fixed those paths. Reset test now waits until image validation has actually started. | Targeted local stress: Images WebKit 10/10 then 5/5; Split Chromium 5/5 and WebKit 5/5; Rotate Chromium performance 5/5. Final local gates passed: lint, typecheck, 57 unit/integration, 68 Chromium/WebKit E2E, build. Stability commit/push and green GitHub `validate` are still required before TBX-008. Historical run had no artifacts; new workflow uploads failure diagnostics for 7 days. |
| TBX-008 PDF to PNG | Not started | — | Must use existing PDF.js and bounded local rendering | Start only after the CI stability preflight is green. |
| TBX-009 Image Compressor | Not started | — | — | Follow TBX-008. |
| TBX-010 Image Resizer | Not started | — | — | Follow TBX-009. |
| TBX-011 PNG/JPG Converter | Not started | — | — | Follow TBX-010. |
| TBX-012 WebP Converter | Not started | — | — | Follow TBX-011; shared image engine is built across TBX-009–012. |
| TBX-013 Advanced QR Designer | Not started | — | — | Follow TBX-012. |
| TBX-014 Wi-Fi QR | Not started | — | — | Follow TBX-013; share QR core. |
| TBX-015 Contact QR | Not started | — | — | Follow TBX-014; share QR core. |
| TBX-016 Password Generator | Not started | — | — | Follow TBX-015. |
| TBX-017 Word Counter | Not started | — | — | Follow TBX-016. |
| TBX-018 Case Converter | Not started | — | — | Follow TBX-017. |

## CI stability investigation log

- `38158943075` completed successfully on `fe439b73d357766ae3199e6b4ee60f4443620367`.
- `38159357800` then failed on that exact same SHA. Install, lint and typecheck passed; `pnpm test` had 66 passing tests and two failures, causing build to be skipped.
- Failed cases: `[webkit-images-to-pdf] cancel and reset terminate jobs, revoke URLs, discard stale results and allow retry` (reset-empty heading absent after immediately resetting a newly selected 4,000 px JPEG) and `[webkit-split-limits] rejects malformed and oversized documents and remains keyboard accessible on mobile` (initial 5-page PDF readiness status absent after selecting the small valid fixture).
- GitHub Actions returned no artifacts for the failed run. Its console log contains Playwright's local runner paths for `trace.zip` and `error-context.md`, but the workflow did not upload these files. Do not claim to have inspected those CI traces/screenshots; generate and inspect local reproductions.
- The original failures exposed an asynchronous browser-startup race rather than a PDF parsing or conversion defect. The affected tests programmatically attached files directly to a hidden input immediately after `page.goto()`, while React's client handler was not yet reliably ready. A local full run reproduced the same stuck state on Split and on the Rotate performance fixture: Playwright traces show `Checking files…`, no selected source PDF, and no error. The image reset test also acted immediately after `setInputFiles()` without proving the validating worker had started.
- Fixed the Split limits and Rotate performance flows to click the visible “Choose files” button, wait for the browser file chooser, then set files. This exercises the same hydrated interaction a user uses and keeps the final success assertions intact. The Images reset test now waits for “Checking files…” before Reset so the cancellation path is exercised after validation starts.
- Enabled failure screenshots and a 7-day `apps/web/test-results/` artifact upload in `.github/workflows/quality.yml`; these provide traces/screenshots if GitHub CI fails again. Historical run `38159357800` did not retain artifacts, so its CI trace itself remains unavailable.
- Local evidence after the fix: targeted post-correction repeats passed Images WebKit 10/10 plus 5/5, Split Chromium 5/5 and WebKit 5/5, Rotate performance Chromium 5/5. Final local checks passed `pnpm lint`, `pnpm typecheck`, `pnpm test` (57 unit/integration and 68 Playwright), and `pnpm build`. GitHub validation remains pending.

## Resume procedure

1. Re-read this file, the task attachment for the current assignment, and `git status`/PR head.
2. Commit and push the locally verified stability fix and await a green GitHub `validate` run.
3. Only then begin TBX-008 and continue sequentially.
4. Only after green full validation, create `tasks/TASK-008-PDF-TO-PNG.md` and begin TBX-008.
5. Keep one Conventional Commit per tool, update this checkpoint/report/PR after each green implementation commit, and continue sequentially through TBX-018.
6. After TBX-018, perform the mandated all-15 audit/report. Leave PR #5 Draft; never merge, release or deploy.
