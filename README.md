# Toolbox

Local-first toolbox of 15 browser-based PDF, image, QR and text tools. The tools are implemented and published in the shared feature branch and are available for review in [Draft PR #5](https://github.com/RavilkaDev0/toolbox/pull/5), targeting `dev`.

## Requirements

- Node.js `24.21.0` (see `.node-version`)
- pnpm `12.11.2` (pinned in the root `package.json`)

Use Corepack or install the pinned pnpm version:

```sh
npm install --global pnpm@12.11.2
```

Then install and run both local applications:

```sh
pnpm install
pnpm dev
```

The web app runs at `http://localhost:3000`; the API binds to `127.0.0.1:4000`. `pnpm dev` compiles shared packages before starting either app. The API reads `HOST` and `PORT` from its process environment. Copy `apps/api/.env.example` to `apps/api/.env` to set local values; no secrets are required. The web app needs no environment variables.

## Quality gates

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm test` runs unit/integration checks and Playwright Chromium/WebKit scenarios for public routes and browser-local tool workflows. Install both browsers before running tests locally:

```sh
pnpm --filter @toolbox/web exec playwright install chromium webkit
```

GitHub Actions runs the frozen-lockfile install and all four quality gates, including both browser profiles, for PRs targeting `dev` or `main` and pushes to either branch. On Linux, use `playwright install --with-deps chromium webkit` to install system dependencies too.

## Git workflow

`main` represents production; `dev` integrates development. Start `feat/*`, `fix/*`, `refactor/*`, `chore/*` or `docs/*` from `dev`, then open a PR to `dev`. Release via `dev` → `main`; direct PRs to `main` are reserved for critical production hotfixes. See [Git workflow and repository settings](docs/09-GIT-WORKFLOW.md).

## Architecture

- `apps/web`: Next.js App Router, server-rendered catalog and category pages, accessible shared shell, Tailwind CSS and shadcn/ui workspace configuration. Next.js is configured for standalone output with the repository root as its monorepo tracing root.
- `apps/api`: NestJS on Fastify. It has only internal liveness/readiness endpoints, binds to loopback by default, and has no upload route or external service dependency.
- `packages/contracts`: Zod runtime schemas and inferred HTTP response types.
- `packages/core`: typed tool/category metadata and catalog integrity rules; no I/O or framework imports.
- `packages/ui`: small shadcn-style shared UI surface and design tokens.
- `packages/browser-engines`: lazy-loaded browser processing for PDF, image, QR and text tools; user files are not uploaded for processing.
- `packages/config`: shared strict TypeScript configurations.

The catalog currently contains 15 published tools: Images to PDF, Merge PDF, Split PDF, Rotate PDF, PDF to PNG, Image Compressor, Image Resizer, PNG/JPG Converter, WebP Converter, QR Designer, Wi-Fi QR, Contact QR, Password Generator, Word Counter and Case Converter. Tool pages load their processing code on demand; browser-processable files stay in the user's browser. `apps/api` has internal health endpoints only. No file upload endpoint, database, Redis, authentication, payments or production deployment is included in this tool-suite change.

Shared TypeScript packages compile to `dist/` and expose those real build outputs through package `exports`. Root scripts explicitly build workspace packages before app type-checks, tests, dev servers and production builds. This keeps the dependency graph visible without adding a task orchestrator.

## Dependency decisions

Direct dependencies are scoped to the selected frameworks, schema validation, design, browser processing and testing needs. Versions are pinned in `pnpm-workspace.yaml` and `pnpm-lock.yaml`; tool-specific licenses, sizes, alternatives and maintenance risks are summarized in the [final suite report](docs/development/TOOLBOX-15-TOOLS-FINAL-REPORT.md).

| Dependency | Reason and license | Size / maintenance risk | Alternative considered |
| --- | --- | --- | --- |
| Next.js, React, React DOM | Required web stack; MIT | Largest runtime group; active upstream releases require regular upgrades | Other frameworks are outside the accepted architecture |
| Tailwind CSS, PostCSS | Required styling stack; MIT | Small runtime impact; active major-version changes, CSS is built at compile time | Hand-written CSS would be smaller but would not establish the chosen stack |
| NestJS common/core/platform-fastify, Fastify, RxJS, reflect-metadata | Required API framework and adapter; MIT except RxJS (Apache-2.0) and reflect-metadata (Apache-2.0) | Moderate API dependency tree; upstream compatibility must be kept aligned | Raw Fastify would omit the selected NestJS architecture |
| Zod | Runtime schemas for shared contracts and API environment; MIT | About 6.1 MB unpacked; imported only by contracts and API configuration, with normal release review required | Hand-written validators duplicate runtime/type rules |
| dotenv | Loads the API's local `.env`; BSD-2-Clause | Small, mature dependency | Requiring shell-specific environment setup is less portable |
| clsx, tailwind-merge | Standard shadcn-style conditional class composition and Tailwind conflict resolution; both MIT | `clsx` is about 9 KB unpacked; `tailwind-merge` is about 1.1 MB unpacked and is imported only by the shared class helper | Manual string joining cannot safely resolve conflicting utility classes |
| TypeScript, Node/React type packages | Strict static checking; TypeScript Apache-2.0, type packages MIT | Build-time only; low runtime impact | Plain JavaScript does not meet the strict typing requirement |
| Biome | Single lint and formatter tool; MIT | Small toolchain footprint; active releases | ESLint plus Prettier would add a second tool/configuration |
| Vitest | Typed unit and API integration tests; MIT | Build-time only; moderate toolchain tree | Node's built-in runner would need additional TypeScript/decorator setup |
| Playwright Test | Chromium/WebKit browser tests for public routes and actual tool workflows; Apache-2.0 | Browser downloads are large; Chromium and WebKit are installed in CI | Static markup checks cannot verify keyboard focus, file output or rendered behavior |
| Nest CLI | Standard Nest build and watch commands; MIT | Build-time dependency tree; tracks Nest major compatibility | Hand-maintained compiler/watch commands increase configuration |

## References

- [Product scope and tool catalog](docs/01-PRODUCT-SCOPE.md)
- [Architecture](docs/02-ARCHITECTURE.md)
- [API contracts](docs/03-API-CONTRACTS.md)
- [Data model](docs/04-DATA-MODEL.md)
- [Security and deployment boundaries](docs/05-SECURITY-DEPLOYMENT.md)
- [Design system](docs/06-DESIGN-SYSTEM.md)
- [Roadmap](docs/07-ROADMAP.md)
- [Quality gates](docs/08-QUALITY-GATES.md)
- [Git workflow and repository settings](docs/09-GIT-WORKFLOW.md)
- [Enforced GitHub governance](docs/development/GITHUB_WORKFLOW.md)
- [AI development tooling](docs/development/AI_TOOLING.md)
- [Foundation task](tasks/TASK-001-FOUNDATION.md)
- [Foundation decision record](docs/decisions/ADR-0004-foundation.md)
