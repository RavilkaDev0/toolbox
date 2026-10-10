# ADR-0001: Next.js + NestJS Modular Monolith

- **Status:** Accepted for v1 architecture
- **Context:** 100+ potential tools, solo AI-assisted development, cost-conscious hosting on a server shared with existing applications.
- **Decision:** Next.js App Router + TypeScript frontend, NestJS Fastify API, pnpm workspace monorepo, modular monolith, shared pure contracts. Browser-first processing; server jobs only when required.
- **Rationale:** SEO-friendly fast pages; consistent TypeScript; clean independent tool modules without network/service overhead.
- **Consequences:** Must enforce browser/server import boundaries; self-hosted Next.js Node container; monitor shared-server resources; API may be mostly idle initially.
- **Rejected:** microservices, Kubernetes, per-tool backend service; Astro, because product owner explicitly selected Next.js.
