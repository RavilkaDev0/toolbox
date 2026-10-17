# TBX-005 — Production-Quality Merge PDF

Mandatory acceptance criteria supplied by the owner on 2026-10-11. Implement only TBX-005; do not start TBX-006 automatically.

## Functionality

- Select at least two PDFs; add more to the existing selection.
- Show filename, bytes, page count and total pages.
- Safely preview the first page of each document where supported.
- Reorder documents with drag/drop and keyboard-accessible Move up/down buttons.
- Remove individual documents.
- Merge in document/page order, preserving page geometry/rotation, text, vectors and source images without rasterization.
- Preview the actual merged PDF, download it, cancel, reset and retry.
- Provide honest loading/error states and an accessible mobile interface.

## Architecture

Use core for pure rules/limits/order, contracts for strict schemas, browser-engines for processing, and web for UI/worker/result management. Reuse installed pdf-lib, pdfjs-dist, workspace UI and Neutral Utility tokens. No new dependency, backend, uploads, database, Redis or speculative PDF framework. Follow SOLID/KISS/DRY/YAGNI, strict TypeScript and existing module boundaries.

## Security

Treat PDFs as untrusted. Validate type and actual structure; bound file count/bytes, pages, output size and memory/resource use. Reject corrupt and encrypted/password-protected PDFs without bypassing encryption. Reject unsupported active features or document safe behavior. Never execute embedded JavaScript or issue external requests. No source uploads or confidential filenames/content in logs. Terminate workers on cancellation; release URLs/buffers/resources and discard stale callbacks. Document a threat model and mobile resource rationale.

Do not claim sanitization, or preservation of signatures, interactive forms, bookmarks or attachments without evidence.

## Result verification

Reparse the saved PDF. Check page count equals the sum, page order, dimensions and rotations, preservation of text/vector/image elements, and output size. Use real binary fixtures and an independent parser/renderer as appropriate.

## Tests

Unit/integration: two or more PDFs, differing page counts, A4/Letter, landscape/portrait, rotations, text/vectors/images, corrupt/encrypted input, resource ceilings, cancellation/retry/reset and cleanup.

Chromium/WebKit: picker/drop, sorting/removal, keyboard operation, actual merge/download/output parsing/preview, no upload or external requests, desktop/mobile, no console/hydration errors. Separately test production standalone. Preserve every previously implemented tool's checks.

## Publication and documentation

Publish only merge-pdf after successful checks; leave all other draft statuses unchanged and keep Images to PDF working. Add unique SEO metadata/canonical, instructions and actual limits. Deliver this task file, `docs/development/TBX-005-REPORT.md`, an ADR for substantial decisions, synthetic PDF fixtures and screenshots. Report tests, performance, memory/limits, dependency use and remaining risks.

## Workflow and completion

Use the single long-lived `feat/tbx-005-tool-suite` branch and Draft PR to dev for TBX-005–018. Reuse an existing branch/PR; no per-tool PR, history rewriting, force-push, merge/release/deploy or ruleset changes. Synchronize advancing dev via a reviewed merge commit. Commit TBX-005 separately with its ID, push, inspect CI and update the same checklist/report. Mark completion only after validate succeeds on the implementation commit.

Required gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, GitHub Actions `validate`. Use requested skills/MCP purposefully, self-review, and stop after reporting functionality, results, changed files, SHA, CI, shared PR and remaining risks.
