# 05 — Security, Shared Server & Deployment Plan

## Deployment invariants
The Linux host already runs other projects. Toolbox must not take ownership of global Nginx, Docker, firewall, users, networks or certificates before review. No `docker system prune`, no global `down`, no broad `chmod`, no host apt upgrades, and no mass container restarts as part of Toolbox deploy.

## Read-only infrastructure preflight (run only after access is authorized)
```bash
uname -a
free -h
df -h
ss -lntp
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker network ls
docker system df
systemctl is-active nginx || true
```
Also inspect available quotas, existing reverse proxy configuration, backups, current CPU load, Docker logging driver and server release pipeline. Do not expose secrets or env values in reports.

## Composition
- Compose project name: `toolbox`; explicit image references using immutable digests; labels and dedicated names.
- Independent internal network and volumes. Do not attach existing projects' application networks, except a reviewed proxy network if needed.
- Database/Redis without published ports; restrict access to internal services.
- Expose web/API either as loopback-bound host ports to existing host Nginx OR via a dedicated shared proxy network if reverse proxy is containerized. Choose after audit, not both by guesswork.
- No root process where possible, drop Linux capabilities, `no-new-privileges`, read-only root filesystem where compatible, dedicated `tmpfs` with quotas.
- CPU/memory/PID/ulimit constraints and logging rotation; select actual values only AFTER measuring free headroom of host and other workloads.
- Worker isolated with strict timeouts, low concurrency, resource bounds and no Internet by default for document conversion.
- Health checks, restart policies, deploy lock, canary/health check, versioned rollback.

## CI/CD
1. PR: install from lockfile, lint, types, unit/integration, E2E smoke, build, dependency scanning.
2. Release: produce multi-stage images in CI; SBOM/signing optional after basics; publish to registry with SHA-tag and digest.
3. Server: deploy by digest only, no source compilation, no shared compose shutdown.
4. Check health and core journeys; failed deployment triggers deliberate rollback to prior digest, not uncontrolled retries.
5. Database migration requires a reviewed backward-compatible plan and backup.

## Threat model — file processing
Attacker may upload polyglot/corrupt files, zip bombs, giant image dimensions, encrypted PDFs, deeply nested content, path traversal names, huge metadata, QR logo SVG, or run repeated requests to exhaust a shared host.

Controls:
- Browser-first operations never send files to our API; tell user accurately.
- Server routes only if needed; validation by magic bytes + parser, MIME allowlist, byte and pixel/page limits, quotas, concurrency caps, request timeouts and rate limits.
- Sandbox server conversion executable (non-root, read-only mounts, no outbound network, short timeout, tmpfs quota).
- Never pass user paths to shell: use subprocess argument arrays and fixed binaries, not shell interpolation.
- No untrusted HTML templates in server conversion by default.
- No public file storage; delete on expiry and on error, sweep orphans.
- Do not record file contents, names, passphrases, QR payloads, raw cookies, access tokens in telemetry.
- Run automated vulnerability checks and keep parsing/conversion libraries patched.

## Frontend safety
CSP initially report-only with review, then enforced. Secure headers, `Referrer-Policy`, cookie policy once cookies exist. Do not render untrusted HTML (`dangerouslySetInnerHTML`) or user-supplied remote URLs. Sanitized download filenames; object URL cleanup. SVG logo handling requires sanitization or disallow uploads in v1.

## Restore and incident response
Before production: documented previous digest, safe rollback command scoped to Toolbox, disk high-water alerts, request rate/latency, worker OOM rate and temporary storage monitor. Restore of persistent DB only relevant once DB enabled.

## Security references
https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
https://docs.docker.com/reference/compose-file/services/
https://nextjs.org/docs/app/guides/self-hosting
