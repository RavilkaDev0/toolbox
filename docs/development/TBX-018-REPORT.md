# TBX-018 — Case Converter report

## Result

The browser-only Case Converter is implemented in feature commit `fa9d74006349e4e88cb5bfbe791f9be65d927e55` and verified in local development preview. Its catalog record remains **draft**; production routing continues to expose published tools only. No dependency or server processing was added.

The actual conversion runs synchronously in the browser from bounded text held in React state. Supported modes are uppercase, lowercase, mechanical title case, mechanical sentence case and toggle case. Locale rules include browser default, English, Turkish, German, Russian and Japanese. The interface provides live output, explicit copy, clear, reset, accessible labels/status, mobile layout, local-only privacy copy and catalog-derived metadata/related links.

## Architecture and constraints

- `packages/core/src/case-converter.ts` owns the pure transformation rules, supported mode/locale lists and input/output bounds. It uses locale-aware Unicode casing, `Intl.Segmenter` where available and a bounded fallback when unavailable.
- `packages/contracts/src/case-converter.ts` defines strict schemas for settings and bounded text.
- `apps/web/app/tools/case-converter/` contains the tool UI. Text stays in tab memory; it is not written to storage, URLs, analytics or a server. Clipboard access happens only after the user activates Copy.
- The existing dynamic route supplies title, description and canonical metadata. A development fixture switch enables preview while published-only production routing remains unchanged.
- `apps/web/e2e/case-converter.spec.ts` verifies actual output, Turkish locale handling, copy, keyboard/mobile interaction, limits and absence of upload/storage leakage in Chromium and WebKit.

Input is limited to 100,000 UTF-16 code units and output to 400,000 UTF-16 code units. Those caps bound synchronous CPU and string allocations. The fallback handles common Unicode letter/mark/number word runs and sentence punctuation; it can differ on complex scripts and abbreviations. Title and sentence modes are mechanical casing rules, not editorial correction. Case expansion is not reversible: for example, German `ß` can uppercase to `SS`. Browser ICU/Unicode data can differ. No heap peak is claimed because a reliable comparable heap measurement is not exposed by both supported browser engines.

## Verification

Final local checks passed:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` — 47 Vitest files / 159 unit and integration tests, plus 133 Playwright Chromium/WebKit tests across the tool suite.
- `pnpm build` — Next.js standalone production build passed.
- Playwright MCP opened the local preview at `/tools/case-converter`; the accessibility snapshot showed the expected page title, labeled mode/locale/editor/output controls, semantic status, related links and no console warnings/errors.
- Desktop (1440×1000) and mobile (390×844) screenshots were captured and visually reviewed: [desktop](../evidence/tbx-018/case-converter-desktop.png), [mobile](../evidence/tbx-018/case-converter-mobile.png).
- The generated standalone production server served `/` and `/tools` with HTTP 200; `/tools/case-converter` returned HTTP 404 as expected for a draft-only tool. A production `/tools` screenshot confirmed styled output and a catalog limited to published tools.

The production build completed before the final test-only expectation correction; the final all-suite run then passed the exact checked-out source. The functional source did not change between that build and the final suite. The standalone smoke check ran against the generated standalone server output, including the static assets copied as required by Next.js standalone deployment instructions.

## Transform benchmark

The compiled core transformation was measured on Node.js v24.19.0 with synthetic mixed-case, Unicode (`ß`) and emoji text, 7 warm runs per sample, reporting the median. This is a **core CPU microbenchmark**, not end-to-end browser input/render latency. Output length is included because Unicode uppercase mappings can expand strings.

| Mode | 1,000 UTF-16 units | 10,000 units | 100,000 units |
| --- | ---: | ---: | ---: |
| Uppercase | 0.006 ms | 0.057 ms | 0.685 ms |
| Lowercase | 0.005 ms | 0.016 ms | 0.163 ms |
| Title | 0.785 ms | 8.860 ms | 83.207 ms |
| Sentence | 0.188 ms | 1.551 ms | 18.518 ms |
| Toggle | 0.428 ms | 3.513 ms | 33.542 ms |

The synthetic 100,000-unit sample produced 102,128 output units in expanding modes and 100,000 in lowercase/sentence mode. Measurements vary with hardware and ICU implementation. All measurements are recorded in [case-converter-benchmark.json](../evidence/tbx-018/case-converter-benchmark.json). The live preview is synchronous; title case is the slowest tested transform and takes about 83 ms at the maximum on this Node runtime. Mobile-browser maximum-size latency is not inferred from that result; the cap remains the safety bound. No browser heap estimate is reported.

## Known limitations and risks

- `Intl.Segmenter` and locale data vary among browsers; the documented fallback is less linguistically complete.
- Title/sentence casing cannot infer editorial style or all sentence abbreviations.
- Casing that expands a character can increase output length; output beyond 400,000 UTF-16 units is rejected.
- The max-size performance figure is Node-only. Chromium and WebKit real-preview behavior and mobile layouts pass E2E, but no cross-browser heap peak was measured.
- The route remains draft and is not production-published by this change.

## Evidence

- [Task acceptance criteria](../../tasks/TASK-018-CASE-CONVERTER.md)
- [Desktop screenshot](../evidence/tbx-018/case-converter-desktop.png)
- [Mobile screenshot](../evidence/tbx-018/case-converter-mobile.png)
- [Core microbenchmark data](../evidence/tbx-018/case-converter-benchmark.json)

References: [MDN — `String.prototype.toLocaleUpperCase()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLocaleUpperCase), [MDN — `String.prototype.toLocaleLowerCase()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLocaleLowerCase), [MDN — `Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter).
