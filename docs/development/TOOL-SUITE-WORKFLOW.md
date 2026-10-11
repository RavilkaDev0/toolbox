# Long-lived tool suite — TBX-005–018

Owner-authorized workflow adopted on 2026-10-11. `main` remains production and `dev` integration. Images to PDF (TBX-004) is already integrated; do not repeat it.

All remaining tools use one branch, `feat/tbx-005-tool-suite`, and one Draft PR to dev titled `feat: implement Toolbox tool suite (TBX-005–018)`. Reuse it across tasks. No per-tool PRs, interim merges, force-push, rebase rewriting, automatic ruleset changes, release or deployment. If dev advances, inspect and merge it into the feature branch without rewriting published commits.

For each explicitly assigned tool: implement it fully, add unit/integration/Chromium/WebKit checks and real-result evidence, run lint/typecheck/test/build, self-review, make a separate Conventional Commit with its ticket ID, push, verify validate, then update the shared PR checklist and link `docs/development/TBX-XXX-REPORT.md`. Preserve decisions, accepted limits, technical debt and all existing tests. Never check off a task until CI passes on its implementation commit. Stop and await the next assignment.

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

Each tool remains draft until its binary/behavior, validation, bounds, errors/cancellation, resource cleanup, responsive accessibility, output/preview, tests, production build, SEO and documentation pass. Publish only the current tool, with minimum justified dependencies and browser-first processing. Existing module boundaries and Neutral Utility design continue to apply.

After all 14 tools, a separate owner assignment authorizes the final PR/security/dependency/UX/SEO/performance audit, all 15 tool regression checks and complete CI. Only then propose Ready for Review. Final merge remains a separate human decision.
