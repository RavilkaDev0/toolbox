# TBX-018 — Case Converter

## State and release gate

Implemented in feature commit `fa9d74006349e4e88cb5bfbe791f9be65d927e55` on the shared `feat/tbx-005-tool-suite` branch. The test-last checkpoint passed and the catalog entry is published after the exact-head gate. The current publication-follow-up CI result is recorded in Draft PR #5. See [TBX-018 report](../docs/development/TBX-018-REPORT.md) for benchmark, screenshots and limitations. Do not merge, release or deploy.

## Acceptance criteria

- Convert Unicode text to UPPERCASE, lowercase, Title Case, Sentence case and toggle case.
- Use locale-sensitive casing, including Turkish dotted/dotless I and German ß expansion, with a browser-default option and selectable English, Turkish, German, Russian and Japanese rules.
- Preserve punctuation, whitespace, line breaks, combining marks, emoji and uncased symbols.
- Show input and actual output preview, copy the result on explicit request, clear and reset.
- Use keyboard-accessible controls, semantic labels/status/errors and a mobile layout.
- Bound input and generated output; reject oversized changes without truncating the previous input.
- Keep text in client memory only. Do not upload, store, place in URLs, log, or send text to analytics. Disable browser spelling/correction UI on the editor.
- Keep the catalog entry draft until the release gate passes, then publish the production route.
- Add page metadata through the existing catalog route, accurate instructions/limitations and related links.

## Defined conversion behavior

- Upper/lower case use `String.toLocaleUpperCase()` and `String.toLocaleLowerCase()` with the selected locale. Unicode mappings may change length: German `ß` can uppercase to `SS`; Turkish uses dotted/dotless I rules.
- Title Case lowercases each `Intl.Segmenter` word-like segment and uppercases its first cased grapheme. The fallback uses Unicode letter/mark/number runs with internal apostrophes. This is a simple mechanical title rule, not language-specific editorial style.
- Sentence case lowercases each sentence segment and uppercases its first cased grapheme. The fallback recognizes common sentence-ending punctuation and does not resolve abbreviations reliably.
- Toggle case flips each grapheme where upper/lower forms differ; uncased characters are preserved. Unicode expansions mean toggling twice may not reconstruct the original spelling.
- Segmenter fallback iterates code points for grapheme capitalization/toggling; complex scripts and sentence boundaries may differ.
- Input is limited to 100,000 UTF-16 code units. Converted output is capped at 400,000 UTF-16 code units to bound casing expansion and temporary output storage. The synchronous algorithm is linear in bounded input, with segmentation iterators and chunked output.

## Verification completed in final suite phase

- Core and contract tests: all five modes; spaces and line endings; emoji and combining marks; Turkish `I/İ`; German `ß`; word and sentence rules; fallback without `Intl.Segmenter`; invalid mode/locale/runtime input and input bounds.
- Playwright Chromium/WebKit: actual live output and copy; Turkish selection; settings; reset; keyboard use; oversized input; mobile overflow; no upload/network/storage leakage; no console or page errors.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (159 unit/integration tests and 133 Chromium/WebKit Playwright scenarios) and `pnpm build` passed. Playwright MCP preview/navigation and console check passed; desktop and mobile screenshots are captured and visually reviewed in `docs/evidence/tbx-018/`.
- Core transform measurements at 1k, 10k and 100k UTF-16 units are in the report. They are Node microbenchmarks; do not present them as browser latency or heap measurements.
- Run the production standalone smoke test and exact-head GitHub `validate` before publication. This gate is now satisfied; the tool is published in the shared branch catalog.

## Resource and compatibility notes

No dependency, Worker, backend or persistence layer is needed. The 100,000-unit limit bounds synchronous work and holds source input to at most about 200 KiB of UTF-16 data. The output bound is at most about 800 KiB of UTF-16 data. Browser ICU/Unicode versions can vary; maximum-length mobile latency and heap use are not measured until final verification. `.txt` export is omitted because Copy meets the requirement without creating object URLs or duplicate output files.
