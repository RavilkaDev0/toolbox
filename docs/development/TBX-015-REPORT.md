# TBX-015 — Contact QR report

## Implementation state

Implementation is committed locally on `feat/tbx-005-tool-suite`; the catalog remains **draft** and production routing stays published-only. Its unit/integration and Chromium/WebKit browser scenarios passed in the deferred final suite. Exact-head shared-branch GitHub validation is pending.

## Design

- `packages/core/src/contact-qr.ts` builds and strictly parses the supported vCard 3.0 profile, validates field formats and bounded Unicode, escapes text delimiters/newlines, folds content lines at 75 UTF-8 octets, and caps the vCard before parsing or QR generation.
- `packages/contracts/src/contact-qr.ts` defines the strict Zod input schema and reuses core validation.
- `apps/web/app/tools/contact-qr/` keeps contact values in client state, debounces live generation, checks the vCard round trip, lazily loads the existing QR browser engine, and downloads scan-checked PNG/SVG plus a matching `.vcf` file. Cancellation, stale-result guards, reset, and Blob URL cleanup follow the existing local QR workflow.
- The existing QR matrix, PNG/SVG renderer and independent scan verification are reused. No new dependency, endpoint, upload, storage, or encoder was added.
- The local draft route is available only with `TOOLBOX_UI_FIXTURES=1` outside production; public catalog state remains draft.

## Format and limits

The export uses vCard 3.0 with required `VERSION`, `FN`, and `N`. The display name is placed entirely in the family-name component of `N` to avoid guessing language-specific name order. Text values escape backslash, comma, semicolon and line breaks; lines use CRLF and fold on UTF-8 character boundaries at 75 octets, following [RFC 2426](https://www.rfc-editor.org/rfc/rfc2426.html?format=txt).

Field limits are 160 bytes for name, 120 each for organization/title, 32 for phone, 254 for email, 512 for website, and 200 for address. The complete vCard is capped at the shared 2,048-byte QR payload bound and by actual encoder capacity. Phone accepts 3–15 digits in a bounded international display form; email accepts a common ASCII mailbox form; website requires HTTP(S) and rejects embedded credentials. Limits keep generated payloads and parser work bounded for mobile browsers; peak memory and a dedicated generation-time benchmark have not been measured.

## Privacy and threat notes

Contact values stay in React client state and the short-lived local vCard/QR buffers. They are not stored, placed in URLs, written to server-rendered user content, sent to analytics, or uploaded. UI status/errors are generic and do not contain field values. Reset/edit/cancel invalidate outstanding work and clear output URLs; unmount revokes remaining URLs. The scanner/recipient can read the personal data encoded in either the QR or `.vcf`, which the page makes explicit.

The input schema and core builder reject malformed Unicode, unsupported controls, oversized fields, invalid phone/email values, non-HTTP(S) URLs and URL credentials. Text delimiters and line breaks are escaped, and properties are assembled from a fixed allowlist, preventing user values from injecting vCard properties. The parser accepts only the generated property profile and rejects oversized or malformed vCards. The output is a contact card, not an encrypted or private format.

## Written tests and static checks

Written coverage includes core validation/escape/fold/round-trip and malformed-input cases, strict contract validation, shared-engine QR matrix use, and a Playwright flow for actual PNG/SVG/vCard downloads, parsing, invalid input, reset by keyboard, mobile overflow, console errors and absent upload/URL leakage. The final combined suite passed all 159 unit/integration tests and 133 Playwright Chromium/WebKit scenarios; the real contact QR flow passed in both engines.

Final `pnpm lint`, `pnpm typecheck`, `pnpm test` and standalone production `pnpm build` passed. Dedicated timing/heap benchmarks and physical-device scanner compatibility were not measured. Keep the draft catalog state pending exact-head GitHub validation.

No dependency was added. The shadcn audit checklist was reviewed and focused import/lint/type checks passed. Codebase Memory was attempted for architecture context but returned `Transport closed`; repository docs and source were inspected directly.

## References

- [RFC 2426 — vCard MIME Directory Profile](https://www.rfc-editor.org/rfc/rfc2426.html?format=txt)
