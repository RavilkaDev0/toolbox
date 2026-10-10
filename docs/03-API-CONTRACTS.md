# 03 — HTTP API Contracts

## Routing and ownership
Same-origin public paths under `/api/v1/*` are reverse-proxied to NestJS; Next.js must not also implement overlapping routes. Actual proxy layout decided after examining the existing server. JSON API uses request IDs and typed error responses; do not store arbitrary client data.

## Active in foundation (internal health only)
- `GET /api/v1/health/live` → `200 { "status": "ok" }`; runtime running. Prefer internal check, not publicly detailed.
- `GET /api/v1/health/ready` → `200 { "status": "ready" }` or `503 { "status": "unavailable" }`; dependencies only if enabled. Never return credentials or infra metadata.

**No upload endpoint in Phase 1.** All first-release file processing is local. Tools discover metadata from bundled typed registry rather than a network endpoint.

## Phase 2 design — NOT implemented in MVP
Server-side processing is deliberately asynchronous for heavy transformations.

### `POST /api/v1/jobs`
`multipart/form-data`: `toolId` (allowlisted), `options` (validated JSON schema), `files[]` (bounded streamed uploads). Must accept only enabled server-side tool IDs. Apply source throttling and per-job limits.

Successful `202 Accepted`:
```json
{
  "jobId": "opaque-uuid",
  "accessToken": "opaque-high-entropy-secret",
  "status": "queued",
  "expiresAt": "2026-10-11T12:30:00Z"
}
```
The client keeps `accessToken` in memory during the session. Server stores **only a hash**. Do not put token in query string, analytics or logs. Token is a guest capability, not an account.

### `GET /api/v1/jobs/{id}`
Header: `Authorization: Bearer <accessToken>`. `200`:
```json
{
  "jobId": "opaque-uuid",
  "status": "processing",
  "progress": null,
  "resultAvailable": false,
  "expiresAt": "2026-10-11T12:30:00Z"
}
```
Statuses: `queued`, `processing`, `succeeded`, `failed`, `cancelled`, `expired`. `progress` is null unless genuinely measured.

### `GET /api/v1/jobs/{id}/result`
Header: same Bearer token. Requires `succeeded` and non-expired result; `200` file stream with safe `Content-Disposition`, `Cache-Control: no-store` and content-type restrictions; `410` when expired.

### `DELETE /api/v1/jobs/{id}`
Cancel if possible and queue secure deletion of temporary files. `202` if accepted. Must be idempotent.

### Error envelope
```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "Maximum allowed size exceeded",
    "requestId": "non-sensitive-request-id"
  }
}
```
Use semantic status codes (`400/401/403/404/410/413/415/422/429/500/503`). Failure messages must not leak local paths, input content, filenames or stack traces. Rate-limits must include unauthenticated API abuse protection.

## HTTP contract process
- Version path `/api/v1`.
- DTOs from `packages/contracts` (Zod) validated at API boundaries; do not rely on TS types at runtime.
- Generate or check OpenAPI from actual NestJS route semantics; avoid maintaining two contradictory contract sources.
- HTTP-only and processing engine have isolated tests; future queue job acceptance has integration tests for retry, TTL and cancellation.
