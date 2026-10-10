# TBX-001 — Repository Foundation (Cursor / Codex assignment)

## Goal
Create the initial local-only Toolbox monorepo according to `README.md`, `AGENTS.md` and `docs/02-ARCHITECTURE.md`. **Do not deploy to the shared server.** Do not build all 15 tools yet.

## Required work
1. Set up `pnpm-workspace.yaml` at repo root, `package.json` scripts (`dev`, `lint`, `typecheck`, `test`, `build`), pinned Node and pnpm toolchain via Corepack or an explicit documented method.
2. Scaffold `apps/web`: stable compatible Next.js App Router + TypeScript strict + Tailwind + shadcn/ui. Route placeholders for `/`, `/tools`, `/categories/[slug]`, `/tools/[slug]` with real semantic structure; do not publish non-working tools as functional.
3. Scaffold `apps/api`: NestJS + Fastify. Implement internal liveness/readiness health with no DB dependency. Configure typed env parsing and safe error handling.
4. Create workspace packages `@toolbox/contracts`, `@toolbox/core`, `@toolbox/ui`, `@toolbox/browser-engines`, `@toolbox/config` with true package exports. Add `server-engines` only once used.
5. Define typed `ToolDefinition` source code with uniqueness validation, category and related-tool validation, and published/draft distinction. Seed only catalog metadata for agreed tools; no functional claims until implemented.
6. Install basic lint/formatter/test tooling, setup CI validation workflow. Add at least one simple, meaningful typed unit test and an accessible smoke test for homepage.
7. Add `.env.example` for each app with **no secrets**. Add Next.js standalone build output config and review monorepo tracing.
8. Add README with one-command local development instructions after prerequisites, plus architecture and known limitations.

## Restrictions
- No production SSH, server configuration, DNS, proxy, actual payments, Redis, PostgreSQL, storage services, or upload API routes.
- Do not add `turbo` unless measurements or build graph complexity justify it.
- Do not add placeholders that pretend to process PDF/image files.
- Keep dependency list minimal and compatible with current stable releases. Verify latest official version docs; do not assume historical Prisma patterns.
- Tests must run on the repository's actual installed toolchain, not hypothetical scripts.

## Acceptance
- Fresh clone, documented install, `pnpm dev` starts web and API locally without manual hidden setup.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass.
- Homepage/catalog accessible; two unpublished tool placeholders do NOT appear as ready-to-use tools.
- API health endpoint works; no public file upload yet.
- No write actions to shared server or existing projects.

## Delivery report
Return: exact file changes, versions pinned, commands with actual exit status, screenshot or Playwright evidence for UI, known risks, and next task proposal (TBX-002). Leave PR open; no merge/deploy without approval.
