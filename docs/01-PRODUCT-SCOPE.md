# 01 — Product, Scope & Tool Catalog

## Product promise
**Toolbox:** Useful online tools with minimal friction. Open a tool → provide input → set options → preview → download. No account needed for phase 1; privacy-first local processing whenever feasible.

## Audience
Office workers, freelancers, small teams, students and occasional document/visual tasks. English UI at launch; localization only after usage data.

## Main routes
`/`, `/tools`, `/categories/[slug]`, `/tools/[slug]`, `/about`, `/privacy`, `/terms`, `/contact`; static sitemap, robots, canonical metadata.

## Tool catalog v1 (15 target; 6–8 essential launch gate)

The table records the initial product scope. As of 2026-10-17, all 15 entries are implemented and published on the shared feature branch for review in Draft PR #5; see the [final verification report](development/TOOLBOX-15-TOOLS-FINAL-REPORT.md). This is branch status, not a production release.

| ID/Slug | Engine | Input → Output | Key settings | Processing |
|---|---|---|---|---|
| images-to-pdf | pdf | JPEG/PNG/WebP → PDF | A4/Letter/Auto, margin, order, fit | Browser |
| merge-pdf | pdf | 2–10 PDFs → PDF | file order | Browser |
| split-pdf | pdf | PDF → PDFs/ZIP | ranges, page selection | Browser |
| rotate-pdf | pdf | PDF → PDF | selected pages, 90° increments | Browser |
| pdf-to-png | pdf-render | PDF → PNGs/ZIP | pages, scale cap | Browser; performance-gated |
| image-compressor | image | JPG/PNG/WebP → compressed image | quality, target format | Browser; warn if output bigger |
| image-resizer | image | image → image | pixels, aspect ratio, contain/cover | Browser |
| png-jpg-converter | image | PNG ↔ JPEG | background, quality | Browser |
| webp-converter | image | JPG/PNG → WebP | quality | Browser |
| qr-designer | qr | text/URL → SVG/PNG | dots, colors, quiet zone, optional logo | Browser |
| wifi-qr | qr | SSID + security + password → QR | WPA/WPA2/open, escaping | Browser |
| contact-qr | qr | contact fields → vCard QR | fields, version | Browser |
| password-generator | utility | options → random password | length, symbol sets, exclusions | Browser Web Crypto |
| word-counter | utility | text → counts | words, characters, reading time estimate | Browser |
| case-converter | utility | text → transformed text | lower, upper, title, sentence | Browser |

## Tool-specific quality criteria
- QR: minimum quiet zone, high contrast checks, real-world scan testing on multiple phones; never claim perfect scanning for arbitrary logo/colors.
- Password: `crypto.getRandomValues`, rejection sampling to avoid modulo bias where needed, no tracking/logging of generated values; optional local clipboard copy.
- PDF: no OCR, edits of encrypted documents or promises of fidelity beyond tested features. Preserve page order. Handle malformed files without crashes.
- Images: browser support matrix, alpha on PNG→JPEG requires configurable opaque background; preserve aspect ratio by default; pixel/memory ceilings.
- Large files: distinguish compressed size from decompressed pixels/pages; prevent memory exhaustion.

## Common workspace behavior
The `ToolWorkspace` uses states `idle`, `validating`, `ready`, `processing`, `succeeded`, `failed`, `cancelled`. It provides upload/dropzone where applicable, reorder, options, progress (only genuine), error messages, retry, preview if feasible, download, and clear/reset.

## What first release should NOT include
Accounts, subscriptions, cloud files, mobile apps, browser extension, OCR, advanced PDF→DOCX, dynamic QR with editable redirects, template marketplace, AI endpoints. These can be future experiments.

## Metrics (privacy-preserving)
Tool page impressions, run_started / run_succeeded / run_failed with **tool ID + non-sensitive error category only**, result-download clicks, repeat visit aggregated metrics. Never include filenames, file bytes, QR payload, form content or passwords. If analytics requires consent in a target region, honor it.

## Launch validation
- 6–8 tools complete production gate, 15 if time permits.
- Indexable and unique content for every released tool.
- No dead links or placeholder functionality marked as released.
- Track real usage, top tools and user feedback before implementing next 85.
