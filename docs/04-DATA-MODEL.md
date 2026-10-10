# 04 — Persistence & Data Lifecycle

## MVP decision
Tool metadata comes from versioned source code (`ToolDefinition[]`). No user accounts, session tracking DB, persistent file records, public user document storage or audit logs for anonymous browser tools. PostgreSQL + Prisma are reserved for the first persistent feature.

This avoids empty tables for hypothetical memberships, plans, entitlements and subscriptions.

## Phase 2 — minimal job model (concept, migration required later)
`ProcessingJob`:
- `id: UUID (PK)` — opaque random public identifier.
- `toolId: VARCHAR` — allowlisted identifier, not dynamic executor path.
- `status: ENUM(queued,processing,succeeded,failed,cancelled,expired)`.
- `tokenHash: BYTEA/VARCHAR` — salted or keyed hash of high-entropy bearer capability.
- `inputBytes: BIGINT` — aggregate size only, never document content.
- `outputBytes: BIGINT?`.
- `errorCode: VARCHAR?` — safe code only.
- `storageKey: VARCHAR?` — internal ephemeral object key; never user filename.
- `createdAt, startedAt?, completedAt?, expiresAt`.

Indexes on `status/createdAt`, `expiresAt`. TTL cleanup job removes results AND database metadata. No need for `Tool`, `User` or `Payment` DB tables at this stage.

## Files
- Files reside only in browser memory or a restricted temporary directory/volume when server processing is introduced.
- Server upload is streamed, content-validated, random-name, no public mount, never stored in PostgreSQL.
- Delete inputs on completion or failure and ensure a fallback reaper for interrupted jobs.
- Default proposal: server result TTL <=30 min (confirm via UX/load testing); nightly orphan sweeper as defense in depth.
- Client-created Blob URLs must be revoked on reset/unmount.

## Later paid model (non-MVP)
`Account`, `Organization?`, `Subscription`, `Entitlement`, `PaymentEvent` are introduced after actual monetization design. External payment provider remains source of truth for charges; webhook idempotency and signatures mandatory. Do not fake auth or payment data now.

## Prisma policy
Choose an explicitly supported stable Prisma release compatible with selected Node/NestJS, pin it. Follow that exact version's `prisma.config.ts`, generated-client and driver adapter instructions (these changed in newer majors). Production migrations are reviewed and backed up; no `db push` or reset against production.
