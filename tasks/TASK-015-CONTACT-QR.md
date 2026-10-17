# TASK-015 — Contact QR

## State

Implementation is committed to the shared `feat/tbx-005-tool-suite` branch. The final local suite passed contact QR tests in Chromium and WebKit; the catalog entry is published after the exact-head gate passed. The current publication-follow-up CI result is recorded in Draft PR #5.

## Acceptance criteria

- Create a contact vCard 3.0 and shared-engine QR from a required full name plus optional organization, title, phone, email, HTTP(S) website and postal address.
- Validate bounded UTF-8 field sizes, phone/email/website shapes, Unicode and controls. Escape text separators, backslash and newlines so values cannot inject properties.
- Correctly fold long UTF-8 content lines, cap total QR payload, and independently parse the generated vCard back before QR rendering.
- Provide a live QR preview, verified PNG/SVG and `.vcf` downloads, reset, errors and narrow/mobile accessibility.
- Keep contact information in client state only. Do not log it, send it to analytics/server, put it in the URL, or render user values into server-generated HTML.
- Add core/contract/shared-QR integration tests and Playwright coverage of Unicode, special characters, newlines, long values, invalid fields, real exports, reset, mobile and no uploads. These passed in the final suite after TBX-018.

## Format and limits

Use the vCard 3.0 required VERSION/FN/N properties. The whole display name is used as the first N component instead of guessing name parts. Free-text values escape backslash, comma, semicolon and line breaks; content lines fold at 75 UTF-8 octets and use CRLF. The generated vCard and QR both stay local. Limits are defined in the shared core module; the complete payload is also bounded by QR Designer's 2,048 UTF-8-byte limit and actual QR encoder capacity.

The website accepts complete HTTP(S) URLs only and rejects credentials in the URL. Phone accepts a bounded international display form with 3–15 digits. Email is validated as a common ASCII mailbox form. These rules favor dependable QR import on phones over exotic URI/address variants.
