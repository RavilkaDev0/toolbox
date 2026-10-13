# TBX-017 — Word Counter

## State

Implement on the shared `feat/tbx-005-tool-suite` branch as one local Conventional Commit. Keep the catalog entry `draft` until final suite verification; allow development preview only with `TOOLBOX_UI_FIXTURES=1` outside production. Write behavioral tests now and run only after TBX-018 under the workflow override.

## Acceptance criteria

- Live counts for words, characters with and without whitespace, paragraphs, logical lines, and sentences.
- Use locale-aware `Intl.Segmenter` word-like segments and sentence/grapheme granularity when supported; honestly label code-point and approximate-token fallback behavior.
- Display UTF-16 code units and Unicode code points separately from grapheme counts, and explain the exact definitions on the page.
- Accept English, Cyrillic, CJK, emoji, combining marks, punctuation, Unicode whitespace, CRLF/LF/CR, empty input and bounded long text.
- Support Copy, Clear, Reset, keyboard accessibility and mobile layout.
- Bound input at 100,000 UTF-16 code units and reject oversized changes without truncating or analyzing them.
- Keep text in client memory only; do not store it, upload it, or send it to analytics/logs.
- Keep the catalog draft with local-only preview in development and published-only production routing.

## Definitions and limits

- Words: `Intl.Segmenter` segments marked `isWordLike` using the runtime's default locale. Fallback counts Unicode letter/number runs with combining marks and internal apostrophes; it is approximate for some scripts, including CJK.
- Characters with whitespace: grapheme clusters, including all Unicode whitespace. Without whitespace: grapheme clusters consisting of non-whitespace. If `Intl.Segmenter` is unavailable, both counts use Unicode code points.
- Lines: empty text has zero lines; otherwise logical LF, CRLF or CR line endings produce `breaks + 1` lines, including a trailing empty line.
- Paragraphs: consecutive non-empty lines form a paragraph; blank or whitespace-only lines split paragraphs.
- Sentences: non-whitespace sentence segments; fallback groups sentence-ending punctuation and counts remaining trailing text as one segment.
- Input is capped at 100,000 UTF-16 code units (at most about 200 KiB for UTF-16 text) to bound synchronous segmentation work on mobile devices. Reading-time estimates are omitted because they vary substantially by language and reader.

## Test coverage to queue for final suite phase

- Core and contract: empty/large input, definitions, locale-sensitive English/Russian/Japanese, emoji, combining marks, punctuation and line/paragraph boundaries, plus fallback when `Intl.Segmenter` is unavailable.
- Playwright Chromium/WebKit: live counts, real copy, clear/reset, keyboard operation, oversized input rejection, mobile overflow and no upload/storage/network leakage.
