# 06 — UX & Design System

## Brand direction (provisional)
Working name `Toolbox`; domain and final name pending. Minimal professional UI: light-first, neutral slate surfaces, restrained indigo primary accent, generous whitespace, accessible contrast; dark theme optional after initial release. Fonts: Geist Sans and Geist Mono with local/static assets; avoid flash and external runtime font dependencies.

## Layout
- Header: brand, catalog, categories, search, theme toggle (optional), language later.
- Home: search hero, featured tools, categories, recent/popular after analytics consent, value proposition.
- Catalog: filterable client-enhanced list with indexable server-rendered links.
- Category: unique copy, tools and cross-links, not thin auto-generated text.
- Tool route: title/H1, one-sentence promise, workspace above fold, guidance/examples, FAQ, related tools and accurate privacy statement.
- Footer: privacy, terms, about, contact, status if appropriate.

## Tokens (proposal)
- Spacing: 4 px system (4/8/12/16/24/32/48).
- Container: <=1200 px; tool body <=960 px.
- Radius: 8/12/16 px; avoid excessive shadows.
- Typography: body 16px, supporting 14px, small labels 12px; responsive hero 32–48px.
- Touch targets: >=44×44 px where appropriate.
- Use semantic tokens (`bg`, `surface`, `border`, `muted`, `primary`, `danger`, `success`), not hardcoded colors per component.
- WCAG 2.2 AA target; keyboard/focus flows, SR labels, `aria-live` for status updates, reduced motion.

## Shared UX components
`AppHeader`, `ToolSearch`, `CategoryGrid`, `ToolCard`, `ToolWorkspace`, `FileDropzone`, `FileList`, `OptionsPanel`, `PreviewPane`, `ProcessingStatus`, `DownloadAction`, `RelatedTools`, `ToolError`.

## Tool workspace state machine
`idle → validating → ready → processing → succeeded/failed/cancelled`. Allow retry without reupload where safe. Never display fabricated percentage progress. Graceful behavior on navigation/unmount clears resources. For text-only tools, no dropzone.

## Copy standards
Use clear verbs ("Merge PDF", "Download images"), actual accepted formats and file size limits, user-facing errors with actionable resolution. Do not label formats "supported" until sample files pass tests.

## Performance target (internal budget, not guarantee)
- Marketing/catalog pages contain minimal client JS; tool-specific heavy bundles load only when needed.
- Target LCP <=2.5s p75 on representative mobile testing, CLS <=0.1, INP <=200ms with production measurements.
- Test representative 5MB images, multi-page PDFs and low-memory mobile; bound work per operation.
- Tool UI remains responsive during conversion; large operations move to workers where feasible.
