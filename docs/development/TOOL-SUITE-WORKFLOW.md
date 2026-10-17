# Long-lived tool suite — TBX-005–018

Owner-authorized workflow adopted on 2026-10-11 and updated by the 2026-10-17 immediate workflow override and final-audit assignment. `main` remains production and `dev` integration. Images to PDF (TBX-004) is already implemented; the shared suite branch contains TBX-004–018.

The owner explicitly authorized autonomous sequential implementation of TBX-008 through TBX-018, with tests written during development but broad verification deferred until TBX-018. This superseded per-tool full test/build/CI and push requirements for that implementation sequence; narrow focused checks were allowed when needed. After TBX-018, the owner separately assigned the final cross-suite audit and quality gates. Both assignments permit updates to the existing Draft PR, but not merge, release, deployment or changes to `dev`/`main`.

All remaining tools use one branch, `feat/tbx-005-tool-suite`, and one Draft PR to dev titled `feat: implement Toolbox tool suite (TBX-005–018)`. Reuse it across tasks. No per-tool PRs, interim merges, force-push, rebase rewriting, automatic ruleset changes, release or deployment. If dev advances, inspect and merge it into the feature branch without rewriting published commits.

For each tool, write focused unit/integration/Chromium/WebKit coverage, retain real-result evidence, self-review, record the commit and known risks in `TOOL-SUITE-PROGRESS.md`, then continue without an automatic full-suite run. Once TBX-018 is implemented, run the consolidated local gates, fix failures with targeted retests, run production standalone verification, and perform one final regression. Push the validated work and wait for exact-head GitHub `validate` before marking completion. Preserve decisions, accepted limits, technical debt and all existing tests.

| Ticket | Tool |
| --- | --- |
| TBX-005 | Merge PDF |
| TBX-006 | Split PDF |
| TBX-007 | Rotate PDF |
| TBX-008 | PDF to PNG |
| TBX-009 | Image Compressor |
| TBX-010 | Image Resizer |
| TBX-011 | PNG/JPG Converter |
| TBX-012 | WebP Converter |
| TBX-013 | Advanced QR Designer |
| TBX-014 | Wi-Fi QR |
| TBX-015 | Contact QR |
| TBX-016 | Password Generator |
| TBX-017 | Word Counter |
| TBX-018 | Case Converter |

During implementation, each tool remained draft until its binary/behavior, validation, bounds, errors/cancellation, resource cleanup, responsive accessibility, output/preview, tests, production build, SEO and documentation passed. The branch now publishes all 15 tools, with minimum justified dependencies and browser-first processing. Existing module boundaries and Neutral Utility design continue to apply.

The 2026-10-17 owner assignment authorizes the final PR/security/dependency/UX/SEO/performance audit and all 15 tool route/behavior checks. Keep the PR Draft until the user decides otherwise. Final merge remains a separate human decision.
