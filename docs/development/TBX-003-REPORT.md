# TBX-003 — Design system verification report

Date: 2026-10-11. Repository: RavilkaDev0/toolbox. Branch: `feat/tbx-003-design-system`, based on current `dev` after TBX-002 PR #2 was merged (`a2d8b47`).

## Outcome

Selected **Neutral Utility** after comparing neutral/indigo, warm editorial and monochrome precision. Neutral surfaces and restrained indigo continue the agreed foundation; Geist and clear hierarchy make a large future catalog coherent without decorative dashboards. [Direction comparison and full tokens](../06-DESIGN-SYSTEM.md), [ADR-0005](../decisions/ADR-0005-design-system.md).

UI primitives: Button/variants, Card composition, Input, Field composition, Empty composition, Alert composition and Skeleton. Web composition: AppHeader, AppFooter, ToolSearch/SearchForm, CatalogResults, CategoryGrid, ToolCard and CatalogEmpty. Workspace: FileDropzone, FileList, ToolWorkspace, OptionsPanel, ProcessingStatus, PreviewPane and ResultRegion.

Pages: `/`, `/tools`, all five registered `/categories/[slug]`, shared error/not-found UI and the existing unpublished tool shell's semantic colors. `/design-fixtures` is explicitly opt-in during development and always 404 in production. All 15 real catalog tools remain draft; no conversion engine or subscription is implemented.

## Dependencies and performance

- `lucide-react@1.50.0`, ISC: requested consistent Lucide iconography; stable exact version, pinned in lockfile. Full package approximately 34 MiB unpacked, no new runtime dependency beyond existing React. Maintenance risk is upstream icon/export churn; only used named icons are imported. Next.js 16.4.0 already includes Lucide in its optimized package imports (verified installed config source). Alternative: vendored individual SVGs. No supply-chain-policy bypass or release-age exception is retained.
- Existing `@toolbox/contracts` is now a direct web workspace dependency for Zod query/fixture metadata schemas. No new validation library.
- Geist Latin Sans + Mono assets copied unmodified from installed Next.js 16.4.0: 28,356 + 31,288 bytes, SIL OFL 1.1 with license/provenance included. Local `next/font/local`, Sans preload, Mono not preloaded; no external font request.
- Pages/catalog filtering remain Server Components. SearchForm adds only native-submit pending feedback; fields stay server-rendered. No instant-search state synchronization, UI runtime, animation library, tracking or engine bundle.
- `next typegen` now runs before web TypeScript checks, regenerating route contracts rather than relying on stale build output.

## Acceptance coverage

Vitest: existing catalog/health checks plus search schema, publication-aware search/category combinations, safe metadata/limits and token text/control/focus contrast.

Playwright Chromium and WebKit: public/category navigation; draft/unknown 404s; no draft links; bounded URL form/search/category/reset; invalid/repeated URL filters; private published/draft fixture search; real keyboard Tab/Enter and focus; reduced motion; JavaScript-disabled native GET search; actual TXT selection, drop, removal, repeated selection, empty/wrong extension/oversized/too-many files; no uploads; all seven workspace states; cancellation/reset focus; honest static fixture download. Responsive widths: 320, 390, 768, 1440. Console errors, page exceptions and hydration warnings remain failures.

Screenshots preserve the caret to avoid pre-hydration DOM mutation and hide only the Next developer-tools portal for clean evidence. No application state/error is suppressed. Capture artifacts are visual review evidence, not cross-OS pixel-diff baselines.

## Skills and MCP

Applied Ponytail, UI/UX Pro Max, shadcn, React Best Practices, React Composition Patterns and Web Design Guidelines. Used local UI/UX searches and official shadcn CLI 4.21.4 docs with registry MCP (configuration, card/input detail/example and audit checklist). Codebase Memory supplied architecture, catalog/button symbols, callers and coverage; changed-metadata signals were checked against actual source. Playwright MCP used only local `127.0.0.1:3100` in its isolated profile for accessible snapshots and console review. Next API checks used installed **16.4.0** docs (page/searchParams, Server/Client Components, local fonts, errors and typegen), taking precedence over remote/version-generic examples. No agents or global configuration were added.

Review references: [shadcn composition](https://ui.shadcn.com/docs/components/base/card), [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Local skill instructions were read from the installed audited locations in [AI tooling](AI_TOOLING.md).

## Self-review and corrections

Ponytail: reused existing boundaries/native controls; no generic converter controller, engine, additional UI runtime or fake activity. React review: server defaults, explicit direct UI subpath imports, composed children, no effects for derived values and cleanup of the sole pageshow listener. Files stay in browser memory, never read/uploaded/logged; references clear on reset/cancel/unmount. No result object URLs are created by the fixture.

Corrected implicit alert locators to target the application main region rather than also matching Next's route announcer; assertions are unchanged. Corrected screenshot caret mutation that raced hydration. Removed automatic streaming loading: it made draft errors soft-404s in development and hid the completed catalog with JavaScript disabled. Native pending feedback preserves full-response rendering and actual 404s. Corrected old muted text roles, filename wrapping, headings, and focus after disappearing remove/cancel controls. No lint rules, tests, quality gates or branch protections were weakened.

## Limits

This is a UI foundation. Metadata validation in the private TXT example is not content validation and proves no PDF/image/QR processing. Synthetic card links illustrate appearance and are not working processing routes. Future engines still require real binary fixtures, content/resource validation, real progress/cancellation and cleanup before publication. Browser tests are desktop Chromium/WebKit with responsive viewports; real phones, Safari hardware, assistive-technology audits, formal WCAG conformance and field Core Web Vitals have not been measured. Latin-only fonts require audited subsets before localization. No merge, release or deployment.

## Desktop/mobile screenshots

| Surface | Desktop (1440px) | Mobile (390px) |
| --- | --- | --- |
| Homepage | [Desktop](../evidence/tbx-003/home-1440.png) | [Mobile](../evidence/tbx-003/home-390.png) |
| Catalog | [Desktop](../evidence/tbx-003/catalog-1440.png) | [Mobile](../evidence/tbx-003/catalog-390.png) |
| Category | [Desktop](../evidence/tbx-003/category-1440.png) | [Mobile](../evidence/tbx-003/category-390.png) |
| Private workspace | [Desktop](../evidence/tbx-003/workspace-1440.png) | [Mobile](../evidence/tbx-003/workspace-390.png) |

Screenshots were inspected visually after capture. Equivalent WebKit captures remain in ignored Playwright test-results output; the committed evidence is Chromium to avoid duplicating the same surfaces.

## Final local verification

Windows, Node 24.21.0, pnpm 12.11.2. The bundled fallback pnpm 11 was incompatible with the repository engine; the existing package-manager switch/cache was used instead, without changing global configuration or engine constraints.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass, unchanged supply-chain policies |
| `pnpm lint` | Pass, zero warnings/errors |
| `pnpm typecheck` | Pass, including regenerated Next route types |
| `pnpm test` | Pass: 6 Vitest files / 15 tests and 28 Playwright cases, Chromium + WebKit |
| `pnpm build` | Pass: shared packages, Nest API and Next production build |
| `git diff --check` | Pass |
| Playwright MCP | Local catalog/workspace snapshots reviewed; no warning/error messages in stable-session checks |

The long combined navigation test was split into registered pages, category transitions and draft 404 cases so each test has one purpose. The WebKit category-click check waits for the page's network completion and explicit destination before retaining the original URL/empty-state assertions. No timeout limits or assertion requirements were relaxed. Dev tooling emitted NO_COLOR/FORCE_COLOR and occasional slow-filesystem notices; these are separate from application console errors.
Final local production HTTP check with TOOLBOX_UI_FIXTURES=1: homepage/catalog 200, private fixtures and draft merge-pdf 404. The production fixture denial remains effective even with the opt-in flag.

## Changed files

- apps/web/app/_components/catalog-empty.tsx
- apps/web/app/_components/catalog-results.tsx
- apps/web/app/_components/category-grid.tsx
- apps/web/app/_components/search-form.tsx
- apps/web/app/_components/site-footer.tsx
- apps/web/app/_components/site-header.tsx
- apps/web/app/_components/tool-card.tsx
- apps/web/app/_components/tool-search.tsx
- apps/web/app/_components/workspace/file-dropzone.tsx
- apps/web/app/_components/workspace/file-list.tsx
- apps/web/app/_components/workspace/processing-status.tsx
- apps/web/app/_components/workspace/tool-workspace.tsx
- apps/web/app/_fonts/OFL.txt
- apps/web/app/_fonts/README.md
- apps/web/app/_fonts/geist-latin.woff2
- apps/web/app/_fonts/geist-mono-latin.woff2
- apps/web/app/categories/[slug]/page.tsx
- apps/web/app/design-fixtures/page.tsx
- apps/web/app/design-fixtures/workspace-fixture.tsx
- apps/web/app/error.tsx
- apps/web/app/layout.tsx
- apps/web/app/not-found.tsx
- apps/web/app/page.tsx
- apps/web/app/tools/[slug]/page.tsx
- apps/web/app/tools/page.tsx
- apps/web/e2e/design-system.spec.ts
- apps/web/e2e/fixtures/workspace-note.txt
- apps/web/package.json
- apps/web/playwright.config.ts
- docs/02-ARCHITECTURE.md
- docs/06-DESIGN-SYSTEM.md
- docs/08-QUALITY-GATES.md
- docs/decisions/ADR-0005-design-system.md
- docs/development/TBX-003-REPORT.md
- docs/evidence/tbx-003/catalog-1440.png
- docs/evidence/tbx-003/catalog-390.png
- docs/evidence/tbx-003/category-1440.png
- docs/evidence/tbx-003/category-390.png
- docs/evidence/tbx-003/home-1440.png
- docs/evidence/tbx-003/home-390.png
- docs/evidence/tbx-003/workspace-1440.png
- docs/evidence/tbx-003/workspace-390.png
- packages/contracts/src/catalog.test.ts
- packages/contracts/src/catalog.ts
- packages/contracts/src/file-selection.test.ts
- packages/contracts/src/file-selection.ts
- packages/contracts/src/index.ts
- packages/core/src/catalog-search.test.ts
- packages/core/src/catalog-search.ts
- packages/core/src/index.ts
- packages/ui/src/components/alert.tsx
- packages/ui/src/components/button.tsx
- packages/ui/src/components/card.tsx
- packages/ui/src/components/empty.tsx
- packages/ui/src/components/field.tsx
- packages/ui/src/components/input.tsx
- packages/ui/src/components/skeleton.tsx
- packages/ui/src/styles/globals.css
- packages/ui/test/tokens.test.ts
- pnpm-lock.yaml
