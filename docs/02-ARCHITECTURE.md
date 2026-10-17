# 02 — System Architecture

## Style
**Modular monolith, client-side first.** Next.js handles SSR/static/SEO and browser tools. NestJS owns optional external HTTP APIs. Shared packages expose pure core logic, contracts and browser/server engines. Postgres/Redis/worker are conditional additions, not requirements for a working catalog.

```mermaid
flowchart TD
    U[User browser] --> N[Existing reverse proxy]
    N --> W[Next.js Web]
    N --> A[NestJS API - later server jobs]
    W --> B[Browser engine workers]
    A --> Q[Queue - later]
    Q --> J[Isolated processing worker]
    A --> D[(PostgreSQL - later)]
    J --> S[(Ephemeral private storage)]
```

## Workspace layout
```
apps/web             Next.js App Router, SEO and interactive workspace
apps/api             NestJS + Fastify (initially internal health endpoints)
apps/worker          Placeholder concept; create only when needed
packages/ui          Shared design system components
packages/contracts   Zod contracts and public DTOs
packages/core        Pure rules/types/algorithms
packages/browser-engines  PDF, canvas, QR, text engines
packages/server-engines   Server conversion adapters, later
packages/config      Shared lint / TS rules only
infra/               Docker, nginx snippets, deployment docs
```

## Dependency rules
`web → ui/contracts/core/browser-engines`, `api → contracts/core/server-engines`, `worker → contracts/core/server-engines`. Shared packages must never point back to apps. Browser bundles must not import Node/native executables or Prisma.

## Server rendering / client boundaries
- Default Server Components for SEO/catalog. Keep page layout and metadata server-rendered/prerendered where possible.
- Client components for interactive workspace and framework-required error boundaries; GET catalog search stays server-rendered.
- `dynamic(() => import(...))` selectively loads per-tool UI/engine on demand; verify emitted chunks and mobile performance.
- Tool catalog is typed source control metadata, NOT Postgres rows in MVP.
- `generateStaticParams` / metadata generation only for published tools; no mass thin content.
- Self-host Next.js using standalone output; verify monorepo output tracing of workspace dependencies.

## Current tool suite (2026-10-17)

The catalog currently has 15 published tools (TBX-004–018) on the shared `feat/tbx-005-tool-suite` branch and Draft PR #5 to `dev`. This branch is awaiting review; the publication status describes catalog behavior in the branch, not a production deployment. `apps/web` owns routes, metadata, accessible workspaces, worker orchestration and local results. `packages/core` owns pure tool rules and bounded settings, `packages/contracts` owns strict input schemas, `packages/browser-engines` owns browser-only parsing and processing, and `packages/ui` owns reusable presentation. Heavy per-tool UI and engine code is loaded on demand. No browser-processable user file is sent to the API.

PDF merge/split/rotate use static PDFs and preserve page content rather than rasterizing; encrypted PDFs and unsupported active features are refused. PDF rendering and image codecs have explicit input, page/pixel, output and time bounds. Cancellation, stale-result guards and resource cleanup are implemented in the owning tool adapters. The per-tool reports and [final suite report](development/TOOLBOX-15-TOOLS-FINAL-REPORT.md) contain implementation details and measured limits.

## Typed catalog contract
```ts
type EngineKind = "pdf" | "pdf-render" | "image" | "qr" | "utility";
type ToolExecution = "browser" | "server";
type ToolStatus = "draft" | "published";
type ToolDefinition = {
  readonly id: string;
  readonly slug: string;
  readonly category: ToolCategoryId;
  readonly title: string;
  readonly description: string;
  readonly engine: EngineKind;
  readonly execution: ToolExecution;
  readonly acceptedMimeTypes: readonly string[];
  readonly maxInputBytes?: number;
  readonly maxInputFiles?: number;
  readonly status: ToolStatus;
  readonly relatedSlugs: readonly string[];
};
```
The implementation lives in `packages/core/src/catalog.ts`; static checks enforce unique IDs/slugs, known categories and related links. Tool UI and engines are lazy-loaded from the route so catalog generation never bundles heavy processing code.

## Domain design

### Implemented UI foundation (TBX-003)

`packages/ui` owns tokens and dependency-light shadcn primitives. `apps/web/app/_components` composes route/catalog-aware presentation; workspace controls live in its `workspace` directory and receive callbacks/content from the tool-owned controller. No generic processing orchestrator is introduced. Bounded catalog query schemas live in `packages/contracts`; publication-aware search is pure `packages/core` logic. `/design-fixtures` is explicitly opt-in in development/test and always 404 in production. At the TBX-003 checkpoint all 15 definitions were draft; the catalog status has since advanced as the tools passed their individual release gates. See [ADR-0005](decisions/ADR-0005-design-system.md) and [design system](06-DESIGN-SYSTEM.md).

### Images to PDF (TBX-004)

At TBX-004 only `images-to-pdf` was published; 14 planned tools remained draft. `core` owns image signature/dimension inspection (including PNG CRC integrity and WebP internal/container agreement), memory limits, ordering and page geometry. `contracts` owns strict option/file metadata schemas and depends on these pure core definitions. Packages therefore build topologically. `browser-engines` owns decoding/normalization, pdf-lib generation and serialized-output checks, plus PDF.js rendering of actual result pages. Web owns presentation and two browser worker entry adapters. No API/worker service is involved.

Conversion terminates its worker on cancellation/reset/unmount. WebKit's missing OffscreenCanvas uses a sequential main-thread canvas adapter with AbortSignal and stale-result protection. Preview renders a single generated PDF page in a bounded canvas and releases its PDF document/worker afterward. Source metadata is stripped; JPEG is re-encoded, alpha is retained for PNG/WebP. See [ADR-0006](decisions/ADR-0006-images-to-pdf.md) for limits, dependency decisions and browser tradeoffs, and [verification report](development/TBX-004-REPORT.md).
Common domain types: `ToolId`, `ToolConfig`, `ProcessingResult`, `ToolErrorCode`. Favor pure functions for transformations; interface-based adapters only around external state/IO/variants. In NestJS use controllers (HTTP), use cases/services (application), domain policies (core), adapters (external libs/storage).

## Error codes
`INVALID_INPUT`, `UNSUPPORTED_FORMAT`, `FILE_TOO_LARGE`, `TOO_MANY_FILES`, `DOCUMENT_PROTECTED`, `RESOURCE_LIMIT`, `CANCELLED`, `CONVERSION_FAILED`, `RATE_LIMITED`, `RESULT_EXPIRED`, `INTERNAL_ERROR`.
User messages must explain remediation; log structured non-sensitive technical code and request ID, not data payloads.

## Browser worker protocol (example)
- In: `{ jobId, toolId, action: 'run', options, files }` using transferable data where possible.
- Out: `{ jobId, type: 'progress'|'result'|'error', ... }`.
- Cancellation: send cancel or terminate/replace worker; revoke object URLs and release bitmaps and buffers.
- One active heavy job per tab by default until benchmarked.

## Do not build before demanded
Persistent tool execution history, user roles, multi-tenancy, Kafka, Kubernetes, event sourcing, distributed caching, generic plugin marketplace or global rule engine.

### Merge PDF (TBX-005)

`merge-pdf` joined Images to PDF after binary/browser gates. Core owns PDF limits and immutable ordering, contracts strict metadata validation, browser-engines static-PDF inspection/non-rasterizing page copies/fidelity checks, and web dedicated worker cancellation/watchdog plus accessible UI. The PDF.js viewer is shared workspace presentation. See [ADR-0007](decisions/ADR-0007-merge-pdf.md) and [TBX-005 report](development/TBX-005-REPORT.md).

### Split PDF (TBX-006)

`split-pdf` shares the concrete static-PDF validation and page identity checker with Merge PDF. `core` owns a bounded 1-based page-range parser and input/output limits; `contracts` owns strict file/settings schemas; `browser-engines` extracts without rasterization, reparses and verifies outputs, then writes one verified PDF per ZIP entry with page-only names. The web workspace has its own hard-cancel worker, input preview, output preview for extraction, and one-download ZIP flow. Only static PDFs are accepted; processing stays in the tab. This adds no universal job framework or server route. See [ADR-0008](decisions/ADR-0008-shared-static-pdf-policy.md), [acceptance criteria](../tasks/TASK-006-SPLIT-PDF.md), and [report](development/TBX-006-REPORT.md).

### Rotate PDF (TBX-007)

`rotate-pdf` reuses the static-PDF validator, bounded page-range parser and PDF.js preview. Core normalizes relative quarter-turns; the browser engine updates only each selected page's `/Rotate` value with pdf-lib, then reopens the file and compares every page's content/resources/boxes while excluding only the expected angle. The route uses one cancellable worker, bounded source/output previews and downloads the verified output bytes. This is metadata rotation, not content rasterization or sanitization. See [acceptance criteria](../tasks/TASK-007-ROTATE-PDF.md) and [verification report](development/TBX-007-REPORT.md).

### Image Compressor (TBX-009)

The image tools share signature and structural inspection in `core/image-input`; per-tool pixel/file/output ceilings and settings stay in their own core modules. The compressor processes one JPEG, PNG or WebP at a time. Contracts validate file metadata and output format/quality, while browser-engines decodes with EXIF orientation, re-encodes using native Canvas APIs, and verifies the actual output signature and dimensions. A route-owned worker is terminated for cancellation; WebKit without worker OffscreenCanvas delegates a single canvas encode to the page with an AbortSignal and generation guard. No image codec dependency or server path is added. PNG is lossless for decoded canvas pixels but may grow; JPEG flattens alpha onto white, and PNG/WebP preserve it. Limits are 16 MiB input, 8 MP/8192 px, and 24 MiB output. See [acceptance criteria](../tasks/TASK-009-IMAGE-COMPRESSOR.md), [ADR-0009](decisions/ADR-0009-image-compressor.md), and [verification report](development/TBX-009-REPORT.md).

### Image Resizer (TBX-010)

Image-specific pure formats, pixel ceilings, signature checks and dimension helpers now sit below the individual compressor/resizer modules. `browser-engines/image-processing` handles bounded static-file inspection, EXIF-normalized `ImageBitmap` decoding, Canvas encoding, encoded-signature checks and an independent `createImageBitmap` decode of the output. The source bitmap and canvas are released before that output decode. The resizer core owns pixel/percentage geometry, ratio rounding and output bounds; contracts use strict discriminated settings. One route worker prefers worker `OffscreenCanvas`; when worker 2D canvas is unavailable it requests one cancellable page-side canvas operation. No server route or image codec dependency is involved. Limits are 16 MiB input, 8 MP/8192 px, 24 MiB output and 30 seconds. Resizing preserves alpha for PNG/WebP, flattens to white for JPEG, and strips source metadata through browser decode/encode. See [acceptance criteria](../tasks/TASK-010-IMAGE-RESIZER.md), [ADR-0010](decisions/ADR-0010-shared-browser-image-processing.md), and [verification report](development/TBX-010-REPORT.md).
