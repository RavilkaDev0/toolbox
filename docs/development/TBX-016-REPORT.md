# TBX-016 — Password Generator report

## Implementation state

Implementation is committed locally on `feat/tbx-005-tool-suite` as feature commit `9e9ca27` and batched-random-draw optimization `ba35dc6`. The catalog remains **draft** and production routing remains published-only. Final password-generator unit/integration and Chromium/WebKit scenarios passed in the deferred suite; exact-head shared-branch GitHub validation is pending.

## Design and algorithm

- `packages/core/src/password-generator.ts` owns validated options, explicit ASCII character classes, cryptographic selection and output-space calculations.
- `packages/contracts/src/password-generator.ts` supplies a strict Zod schema with the same impossible-options check as the core module.
- `apps/web/app/tools/password-generator/` keeps the result only in client state, masks it until explicit reveal, and provides Generate/Regenerate, clipboard copy and Reset. All controls are keyboard-operable. The SEO page explains clipboard retention and that the entropy display is not a password audit.
- Generate uses `crypto.getRandomValues` with `Uint32Array` batches of at most 128 words (512 bytes). Integer reduction rejects values outside the largest complete multiple of the alphabet size, avoiding modulo bias. It then rejects whole candidates missing any selected character class; conditional rejection keeps accepted passwords uniform over the valid output set. Both loops have upper bounds. Missing or failing Web Crypto produces an error and never falls back to `Math.random`.
- The displayed search-space bits are computed from the exact count of valid passwords using inclusion-exclusion and `BigInt`, then rounded for display. Length, enabled classes and ambiguity exclusion all change the calculated space. This is a combinatorial estimate, not a security audit.
- Optional passphrase mode is omitted because no reviewed wordlist/algorithm was necessary to meet the core goal; no dependency was added.

## Limits and privacy

Length is limited to 8–128 characters. The maximum CSPRNG batch is 512 bytes, comfortably below the Web Crypto API's 65,536-byte per-call limit. Each candidate normally uses one crypto call. No dedicated numeric performance or memory benchmark was run; generated output is at most 128 ASCII characters and the bounded BigInt space calculation uses at most 16 subsets.

The password exists in client memory only. It is not put in a URL, web storage, cookies, server props, analytics, requests or logs. Copy requires a user click and uses the browser Clipboard API; if denied or unavailable, the tool reports a generic error and keeps the local result. Reset clears page state but cannot clear an operating-system clipboard. The E2E scenario disables traces and failure screenshots while a generated secret is on the page and uses boolean-only comparisons so test output does not print password values.

## Written tests and checks

Written core tests cover crypto API usage, no `Math.random` call, bounded lengths, allowed characters, required classes, ambiguous-character handling, invalid options, bounds, and search-space calculations. Contract tests cover limits and strict keys. The Playwright scenario covers local generation, actual clipboard content, regeneration, keyboard settings/reset, no extra requests/storage/cookie leaks, mobile overflow and console/page errors. Password values are not included in assertion output.

The final combined suite passed all 159 unit/integration tests and 133 Playwright Chromium/WebKit scenarios, including local generation, clipboard, reset, keyboard settings, mobile layout and absence of request/storage leakage. Generated secrets were not included in traces/screenshots. Final `pnpm lint`, `pnpm typecheck`, `pnpm test` and standalone production `pnpm build` passed. No dedicated max-size performance/heap measurement was made; limits and bounded loop work are documented above.

No dependency was added. The shadcn audit checklist was reviewed. Context7's MDN documentation confirms `getRandomValues` supplies cryptographically strong values for integer typed arrays and documents the 65,536-byte call ceiling. Codebase Memory returned `Transport closed` on the earlier architecture request; repository sources and ownership boundaries were reviewed directly.

## References

- [MDN — Crypto.getRandomValues()](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)
- [MDN — Crypto](https://developer.mozilla.org/en-US/docs/Web/API/Crypto)
