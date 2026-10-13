# TBX-017 — Word Counter report

## Implementation state

Implementation is committed locally as `c5690b988b5cada8eed7cb0e8ba9557b84800f38` on the shared `feat/tbx-005-tool-suite` branch; the catalog entry remains **draft** and production routing remains published-only. Behavioral verification and screenshots are deferred until TBX-018. No unit, Playwright or full build/test command has been run for this tool.

## Design and counting rules

- `packages/core/src/word-counter.ts` performs bounded, local analysis. It walks input for Unicode code points and line/paragraph boundaries, and consumes `Intl.Segmenter` iterators without materializing segment arrays.
- `packages/contracts/src/word-counter.ts` defines a bounded string schema. The page rejects changes over 100,000 UTF-16 code units before storing or analyzing them.
- `apps/web/app/tools/word-counter/` keeps text in client state and shows live counts, copy, clear and reset. It reports when segmentation fallback is active and includes the detailed counter definitions on the page.
- `Intl.Segmenter` counts `isWordLike` segments, non-whitespace sentence segments and user-perceived grapheme clusters. When unavailable, the fallback counts Unicode letter/number runs and sentence-ending punctuation groups; code points stand in for grapheme clusters. The page identifies fallback word and sentence counts as approximate, especially for CJK languages.
- Lines count LF, CRLF or CR boundaries plus a final logical line (empty input is zero). Paragraphs are runs of non-empty lines separated by blank/whitespace-only lines. Character counts include all grapheme whitespace or exclude graphemes consisting solely of Unicode whitespace; code units and code points are shown separately.
- Reading time is omitted because a useful rate is language- and reader-dependent.

## Bounds and privacy

The 100,000 UTF-16 code-unit cap allows up to roughly 200 KiB of UTF-16 text and bounds synchronous local segmentation for mobile devices. Iterators avoid retaining large arrays; peak memory and maximum-length latency have not been measured yet. No external dependency, worker, backend endpoint or upload was added.

Input remains in React client state. It is not stored, logged, put in a URL, sent to analytics or uploaded. Copy is a user-triggered Clipboard API operation. A clipboard permission failure shows a generic message and keeps text local. Clear removes text; Reset clears it and returns focus to the editor. No progress indicator is shown for synchronous analysis.

## Written tests and checks

Written core tests cover empty input; English, Russian and Japanese word/sentence segmentation; emoji and combining marks; CRLF/LF/CR lines; blank-line paragraphs; Unicode whitespace; fallback behavior; and the input limit. Contract tests cover Unicode and oversized values. Playwright scenarios cover real local counts/copy/clear/reset, keyboard interaction, oversized input rejection, desktop/mobile layout and no network/storage leakage.

These behavioral tests are **not run yet**. Focused checks passed: `pnpm run build:packages`, `pnpm --filter @toolbox/web run typecheck`, targeted `pnpm exec biome check`, and `git diff --check`. Full lint, unit/integration tests, Playwright Chromium/WebKit, standalone and production builds, and timing/memory measurements are queued for after TBX-018.

No dependency was added. Codebase Memory confirmed the existing catalog/published-route and shared-workspace boundaries. The shadcn audit checklist and React Best Practices guidance were applied. Context7's MDN documentation confirms locale-sensitive word-like segments, grapheme segmentation and sentence segmentation; no private source was sent.

## References

- [MDN — Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)
- [MDN — Internationalization and text segmentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Internationalization)
