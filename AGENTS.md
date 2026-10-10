# AGENTS.md — Toolbox Engineering Contract

Applies to all AI coding agents (Cursor, Codex, etc.) and human contributors. Changes to this document require explicit review.

## Mission & scope
Maintain a privacy-first, fast, accessible collection of independent tools. Follow the agreed stack: Next.js App Router + NestJS/Fastify + TypeScript strict + pnpm workspaces. Development starts with architecture/foundation, not 100 generated pages.

## Core principles
- **KISS + YAGNI:** implement the smallest correct solution. No speculative microservices, repositories, factories, CQRS, queues, or abstractions.
- **SOLID / SRP:** UI, domain/processing, transport, persistence and runtime concerns are separate.
- **DRY:** share genuine algorithms and repeated behavior, not unrelated code forced into a generic abstraction.
- **OOP where justified:** NestJS services/adapters may use DI and classes. Prefer pure functions and hooks for React and small algorithms.
- **Composition over inheritance**, dependency direction from adapters inward, small focused modules.
- **Security / privacy by default:** never upload a browser-processable file to the server; never log contents, filenames, passwords, raw URLs encoded in QR, or unredacted request bodies.

## Hard constraints
1. Do not modify, restart, prune, deploy, or inspect secrets of unrelated server projects. No remote production actions without explicit authorization.
2. Do not introduce new dependency without stating reason, license, size/maintenance risk, and alternatives.
3. No `any`, `@ts-ignore`, disabled lint rules or swallowed errors without written justification and approval.
4. All inputs must have typed schemas and safe upper bounds. Treat file metadata and user input as hostile.
5. No server file upload route without a threat model, rate limits, file validation, quotas, expiry, and isolation.
6. No tight coupling between one tool and another. Shared operations live in engines.
7. No production-facing route without meaningful semantics, loading/error states, keyboard accessibility, and test coverage.
8. Do not claim a feature is functional until it passes tests on actual sample files.
9. Pin dependency versions in `pnpm-lock.yaml`, avoid preview releases unless justified. Check version-specific docs, especially NestJS multipart/Prisma.
10. Never make green CI by deleting tests or weakening checks. Report blockers explicitly.

## Module boundaries
- `apps/web`: presentation, SEO, client-side tool surfaces, client-side adapters. No Prisma, Node filesystem or server conversion binaries.
- `apps/api`: transport, rate limit, validation, health, future job orchestration. No presentation components.
- `apps/worker`: future isolated background conversion executors, not a dependency of web.
- `packages/contracts`: Zod schemas + DTO typing, no framework references.
- `packages/core`: pure business rules and tool semantics, no I/O or framework references.
- `packages/browser-engines`: browser-native processing, lazy-loaded; no Node-only code.
- `packages/server-engines`: native and server processing; never imported by the web workspace.
- `packages/ui`: reusable shadcn-based components, no tool-specific business logic.

## Required workflow per change
1. Read affected docs and map ownership/boundaries.
2. State the smallest deliverable and acceptance tests.
3. Implement focused code; use descriptive names.
4. Add/update tests and docs as appropriate.
5. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; run impacted Playwright tests where available.
6. Self-review for unused dependencies, leaks, race conditions, accessibility and resource usage.
7. Report changed files, commands/results, risks, unresolved items. Do not merge/deploy automatically.

## Tool completion checklist
- Validates file type by content where possible, size, count, and options.
- Can process success, invalid/corrupt, empty, oversized and cancellation flows.
- Provides accurate local-vs-server privacy copy and shows no fake progress.
- Has unit tests and at least one real binary fixture test for nontrivial file processing.
- Works with mouse, keyboard, touch and at minimum the supported browser matrix.
- Updates catalog metadata, route, related tools and canonical/SEO text.

## Commit / PR naming
Conventional commits (`feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`). Small PRs; include behavior change and evidence. Keep production migration changes backward compatible.
