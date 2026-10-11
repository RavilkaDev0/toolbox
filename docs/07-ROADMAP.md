# 07 — Milestones, Tickets & Delivery Gates

These are planning estimates, not guarantees. Solo evenings/weekends, with AI assistance. The release gate prioritizes correctness over the number of tools.

## Current tool delivery plan

TBX-004 Images to PDF is integrated. The owner has reassigned the remaining tool IDs to TBX-005–018 and selected one long-lived branch/Draft PR. The authoritative mapping and sequential completion rules are in [Tool suite workflow](development/TOOL-SUITE-WORKFLOW.md); [Merge PDF acceptance criteria](../tasks/TASK-005-MERGE-PDF.md) define the current task. The earlier milestone numbering below is retained as historical planning, not the active task mapping.

## Week 1 — foundation and vertical slice
The current TBX-004 specification combines workspace/file handling with the real Images to PDF reference tool. It supersedes the original 004/005 split below; the original TBX-005 acceptance scope is covered by TBX-004. Subsequent ticket numbers are unchanged.
- **TBX-001** [P0] Repository scaffold (Next.js + NestJS Fastify + pnpm workspaces + packages; no DB, no worker). Acceptance: clean install/lint/typecheck/build and local dev.
- **TBX-002** [P0] Engineering conventions and CI. Acceptance: enforced quality gates, deterministic lockfile, PR checklist, one passing test.
- **TBX-003** [P0] Design tokens, header, home, catalog, categories, tool route. Acceptance: mobile-first accessible responsive pages, static SEO metadata and typed catalog validation.
- **TBX-004** [P0] Workspace state machine / file handling. Acceptance: transitions, cancellation, cleanup, size/format handling, accessibility tests.
- **TBX-005** [P0] Reference tool `images-to-pdf`. Acceptance: actual binary output correct on fixtures, drag/drop, reorder, A4 settings, downloadable result and error cases.

## Week 2 — shared engines
- **TBX-006** [P0] PDF core (merge/split/rotate). Acceptance: golden fixtures, malformed/protected PDF errors, memory bounds.
- **TBX-007** [P0] Image core (resize/compress/PNG-JPEG/WebP). Acceptance: alpha behavior, EXIF orientation decisions, dimension guard, output verification.
- **TBX-008** [P1] PDF rasterization. Acceptance: PDF.js worker, multi-page images/ZIP, mobile memory benchmark; defer if unstable.

## Week 3 — QR and text
- **TBX-009** [P0] QR engine: designer/Wi-Fi/contact. Acceptance: QR payload escaping, scanability on two devices, SVG/PNG, logo restrictions.
- **TBX-010** [P0] Utility engine: passwords, word counter, case converter. Acceptance: crypto-safe entropy, Unicode test cases, no secret logging.

## Week 4 — release
- **TBX-011** [P0] SEO, legal pages and telemetry. Acceptance: unique metadata, sitemap, correct privacy policy, no raw file-content analytics.
- **TBX-012** [P0] Hosting and launch gate. Acceptance: read-only infrastructure audit, scoped Docker deployment, backups/rollback documented, smoke + browser tests, observability, security checks.

## Dependency order
001 → 002/003 → 004 → 005 → 006/007 → 008/009/010 → 011 → 012.

## MVP decision gate
- **Must launch:** 6–8 production-grade tools, catalog, reliable downloads, correct privacy statement, mobile QA, analytics/SEO, controlled hosting.
- **Stretch:** 15 full tools.
- **Defer:** tool whose file fidelity or memory/safety testing fails. Mark as draft, do not expose broken routes.

## Phase 2 trigger
Only add a queue/database/server conversion when a concrete feature cannot be implemented safely in the browser and has demonstrated usefulness; before implementation write an ADR and a shared-server capacity budget.

## Success measurements (first 30 days post-launch)
Measure search impressions, organic landings, tool starts/finishes, failed conversion categories, referrals, return visits, user feedback, first paid willingness. These are metrics to observe, not forecasted traffic or revenue.
