# ADR-0004: Local-only repository foundation

- **Status:** Accepted for TBX-001
- **Context:** The repository starts without application code. The accepted architecture requires a pnpm workspace, Next.js App Router, NestJS/Fastify and shared packages, while TBX-001 explicitly defers tools, persistence and background work.
- **Decision:** Pin the compatible stable baseline to Node 24.21.0, pnpm 12.11.2, Next.js 16.4.0 / React 19.3.0, NestJS 12.1.2 / Fastify 5.12.5 and TypeScript 6.0.3. Keep all agreed tool records in the typed source catalog as drafts. Only published catalog records may be listed or rendered as tool pages.
- **Workspace exports:** Compile TypeScript packages to `dist/` and export those concrete build files. Build scripts make workspace ordering explicit; no task orchestrator is added. `packages/browser-engines` has an intentionally empty module entry until a real engine is implemented.
- **UI setup:** Follow the shadcn/ui workspace layout and component configuration manually. The official monorepo initializer also adds Turborepo, which is disallowed by TBX-001 absent measured need; no initializer-generated task graph is used.
- **API:** Health readiness means the API runtime is ready. There are no external dependencies to probe. Host defaults to loopback, and only liveness/readiness routes are registered.
- **Consequences:** Root scripts explicitly build packages before app scripts. Adding real processing later requires its own implementation, fixtures and publication decision. These choices clarify the documented architecture and introduce no server or persistence deviation.
