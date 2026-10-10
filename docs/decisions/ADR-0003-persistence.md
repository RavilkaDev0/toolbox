# ADR-0003: Delay persistence until required

- **Status:** Accepted
- **Decision:** Type-safe source-controlled tool registry; no PostgreSQL schema at MVP. PostgreSQL + Prisma when server job tracking, accounts or payments becomes necessary. Redis/queue only for asynchronous long-running work.
- **Rationale:** KISS/YAGNI and preservation of shared server headroom; no anonymous unnecessary personal data collection.
- **Revisit when:** a real feature needs persistent state and has acceptance criteria / threat model.
