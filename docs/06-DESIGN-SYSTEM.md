# 06 — Toolbox Design System & Website Experience

## Direction decision — TBX-003

Reviewed three directions before implementation:

| Direction | Strength | Tradeoff | Decision |
| --- | --- | --- | --- |
| Neutral Utility: white/neutral surfaces, restrained indigo, Geist, structured spacing | Clear actions and states across a large catalog; continues the foundation | Requires strong typography and copy to avoid generic cards | **Selected** |
| Warm Editorial: warm paper, ink, serif headings | Distinctive and approachable | Serif/file-workspace combination adds visual tension; departs from the agreed font direction | Not selected |
| Monochrome Precision: white/black, tight geometry, mono labels | Strong technical identity | Less approachable for occasional users; primary actions need more distinction | Mono kept only for supporting numeric data |

The visual principle is **Premium Utility SaaS**: content first, light first, a single accent, readable hierarchy and measured whitespace. No glass, gradient hero, decorative dashboard, fake popularity, invented testimonials or user statistics. UI/UX Pro Max initially suggested glassmorphism; a narrower local style search verified Minimalism & Swiss Style, which fits the product and takes precedence. The original slate/indigo proposal becomes neutral/indigo with the same primary hue.

## Token source

All visual roles live in `packages/ui/src/styles/globals.css`. CSS variables expose roles through Tailwind 4 `@theme` / `@theme inline`; components never introduce their own palette. Local font variables come from `next/font/local` in the root layout.

| Role | Value | Usage |
| --- | --- | --- |
| background | `#fafafa` | Page canvas |
| surface | `#ffffff` | Cards, header, inputs |
| foreground | `#18181b` | Body and headings |
| muted | `#f1f1f4` | Supporting surface, skeleton |
| muted-foreground | `#52525b` | Supporting text |
| border | `#dedee5` | Decorative separators and cards |
| input | `#71717a` | Essential control and dropzone boundary |
| primary / ring | `#4338ca` | Primary action, links, focus |
| primary-hover | `#3730a3` | Hover emphasis |
| primary-foreground | `#ffffff` | Action label |
| accent | `#eeedff` | Icon tile background |
| danger / danger-surface | `#b42318` / `#fff4f2` | Errors with text and remediation |
| success / success-surface | `#166534` / `#f0fdf4` | Available semantic roles; do not invent successful jobs |

Normal text targets at least 4.5:1; essential controls/focus target at least 3:1 against their adjacent surface. Decorative card borders are not used as the sole signal of an interactive control. Link text and button labels remain explicit. Status never depends on color alone.

| System | Scale / rule |
| --- | --- |
| Typography | Geist Sans, local variable Latin font, 100–900; body 16px/1.6; supporting 14px; labels 12px; section 24/32px; hero `clamp(36px, 5vw, 64px)` with balanced wrapping |
| Mono | Local Geist Mono, numeric supporting data only; not preloaded |
| Spacing | 4px base; common 4/8/12/16/20/24/32/40/48/64/80; use Tailwind scale, no arbitrary component measurements |
| Radii | small 6px, medium 8px, large 12px, extra large 16px, panel 24px |
| Elevation | Small `0 1px 2px #18181b08`; medium `0 4px 16px #18181b08`; hover only where useful |
| Containers | Site 1200px, workspace 960px, copy 640px; 20px minimum horizontal inset |
| Breakpoints | 640 / 768 / 1024 / 1280px; base layout works at 320px |
| Targets | Inputs/buttons at least 44px tall; inline navigation gets 44px touch height |
| Motion | Fast 160ms, normal budget 240ms; only purposeful feedback; no entrances or loops; reduced motion removes transitions/animation |
| Focus | 3px solid ring, 4px offset; visible at keyboard focus; no sticky obstruction |

The simple component classes in the same CSS file (`button`, `input`, `card`, `empty`, `dropzone`, `container-site`, `tool-grid`, etc.) provide repeated behavior. Layout uses Tailwind utilities. Search buttons reserve enough width for the pending label. Auto-fit grids collapse without JS measurement; content wraps at 320px instead of hiding overflow.

## Components and ownership

`packages/ui` owns the reusable, dependency-light shadcn composition: Button/buttonVariants, Card/Header/Title/Description/Content/Footer, Input, Field/FieldGroup/FieldLabel, Empty/Header/Title/Description/Content, Alert/Title/Description and Skeleton. Sources are adapted from the official shadcn composition/registry docs to the established Toolbox boundary. Native inputs and native select are used; no Base UI/Radix runtime or variant library is needed for these controls. Actual heading elements retain semantic structure. Labels require `htmlFor`.

`apps/web/app/_components` owns AppHeader, AppFooter, ToolSearch/SearchForm, CatalogResults, CategoryGrid, ToolCard and CatalogEmpty. These components understand routing/catalog metadata and remain outside the generic UI package. Icons use Lucide with decorative instances hidden from assistive technology. Text labels always explain actions.

Workspace surfaces live under `apps/web/app/_components/workspace`:

- ToolWorkspace is a layout accepting children, not a universal state/controller abstraction.
- FileDropzone offers file-picker and drop alternatives. It reports File objects to its caller; it does not read, upload or validate content.
- FileList reports removal by index and wraps hostile long filenames as text.
- OptionsPanel is a fieldset accepting actual tool settings.
- ProcessingStatus accepts one explicit state and uses a polite status region, without invented percentages.
- PreviewPane and ResultRegion accept engine-owned content/actions through composition.

The sample controller in `design-fixtures/workspace-fixture.tsx` owns selected File references, bounded metadata validation and the example state selector. It never calls an engine. No timers, fake conversion, generated progress, object URLs, or file contents in logs. Reset/cancel release references; file-input values clear after selection, allowing repeated selection. Validation rejects an empty file, wrong fixture extension, excessive size/count and overly long name, and preserves earlier valid files on error. Limits: 10 TXT files, 1 MiB each. **Metadata validation is not content/type validation and is not a completed processing feature.**

## Pages and server/client boundaries

- `/`: header, search hero, category navigation, published tool section, privacy principles and footer. The current catalog contains 15 browser-based tools; empty states remain available for catalogs without published entries.
- `/tools`: Server Component, GET form with search/category, URL-preserved fields and clear-filter link. Query Zod schema in contracts rejects repeated parameters, more than 100 characters and unknown categories. Invalid filters show actionable errors and use safe defaults. Search matches published title/description, case insensitive; pure filtering lives in core.
- `/categories/[slug]`: static registered categories, breadcrumb, unique existing category copy, published-only grid or empty state, related categories. Unknown categories are 404.
- `/tools/[slug]`: production publication gate remains published-only. The local development/test flag `TOOLBOX_UI_FIXTURES=1` can expose only the TBX-013 QR Designer draft route for pre-publication verification; no draft is listed or linked publicly, and production ignores the preview flag. Other draft routes remain inaccessible and absent from production static params. The TBX-003 route began as a presentation fixture; current published routes lazy-load their tool UI and browser engine.
- `/design-fixtures`: opt-in development/test UI only (`TOOLBOX_UI_FIXTURES=1`), no public links, `noindex,nofollow`. The production environment always returns 404, even if the flag is set. Independent synthetic published/draft objects exercise the same search/card pipeline without changing the real catalog. Fixture card destinations are illustrative and have no processing route. The download is labeled **Download fixture** and contains static example text, not selected file output.
- `SearchForm`, `error.tsx`, `not-found.tsx`: meaningful pending/error/fallback UI, status text, main landmarks, retry and navigation. The installed Next.js 16.4.0 error API uses `retry`, verified locally. Automatic streaming loading boundaries are deliberately absent: they would commit HTTP 200 before invalid tool/category lookup and hide late HTML from JavaScript-disabled browsers. SearchForm is a small client boundary around server-rendered fields: native GET remains the behavior, submission shows a real pending label/status and disables only the submit button. The fields remain enabled for native form serialization; pageshow clears pending state after history restoration.

Layouts, homepage, category cards, searches and results use Server Components. Client JS is limited to search pending feedback, the required error boundary and lazy-loaded tool workspaces. GET search works without client JS and uses browser history naturally. No tracking, signup, theme toggle or links to unfinished policy pages are added.

## Rules for future tools

1. Use the documented tokens and existing primitives; compose tool-owned workspace/settings/preview. Do not create a catch-all tool controller.
2. Keep metadata outside engine bundles. Publish only after actual sample-file tests and route semantics are complete.
3. Present accepted formats, actual limits and local/server privacy beside file selection; validate content, dimensions/pages and decompressed resource bounds in the engine/adapter.
4. Real lifecycle: `idle → validating → ready → processing → succeeded / failed / cancelled`. Every transition comes from actual work. Unknown progress is indeterminate text; percentages require real measured work.
5. Cancellation must abort work, free buffers/bitmaps/File references and revoke result URLs. Reset clears errors/options/results as appropriate. Stale results must never replace a newer run.
6. Preview and download must be based on real engine results; safe downloads and recovery must work with keyboard/touch. Restore focus when controls disappear.
7. Test success, corrupt/empty/oversized input, cancellation and repeated runs; include binary fixtures for nontrivial file processing. TBX-003's metadata-only TXT fixture is not that gate.

## Verification and evidence

At the TBX-003 checkpoint, Vitest covered bounded catalog queries and pure publication-aware filtering with synthetic examples. Playwright covered shell navigation, fixture search/category states, keyboard focus and metadata-only workspace states in Chromium and WebKit. This foundation baseline is supplemented by the per-tool binary and interaction coverage in the [final suite report](development/TOOLBOX-15-TOOLS-FINAL-REPORT.md). The original shell suite uses 320, 390, 768 and 1440px viewports and checks page/console errors and hydration warnings.

The suite-level verification is recorded in the [final tool suite report](development/TOOLBOX-15-TOOLS-FINAL-REPORT.md); the initial shell-only verification remains in the [TBX-003 report](development/TBX-003-REPORT.md). Automated coverage supports a WCAG 2.2 AA target; it does not establish formal conformance or replace real-device/screen-reader checks. Field Core Web Vitals are not measured or advertised.
