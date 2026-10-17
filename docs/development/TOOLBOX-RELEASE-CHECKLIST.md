# Toolbox Public Release Checklist

Use this checklist for the reviewed `dev` → `main` release. TBX-019 is **NO-GO** until all owner-supplied and verification items below are complete.

## Go criteria

- [ ] Owner supplies the production HTTPS origin; set `SITE_URL` during the production build. Verify every canonical and sitemap URL uses that origin and contains no localhost or `.invalid` host.
- [ ] Publisher identity, jurisdiction, effective date, terms and monitored support/privacy contacts are provided and approved. Complete the three release-draft pages, then remove their `noindex` metadata.
- [ ] Owner verifies the selected host, CDN/security providers, access logs, logged fields, log access and retention. The Privacy Policy describes that actual setup and any later analytics or embedded services.
- [ ] Production HTTPS and TLS termination are confirmed. Add HSTS at the reviewed edge. Confirm CSP allows the deployed local fonts, previews, PDF.js and worker resources.
- [ ] `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass on the release candidate. Chromium/WebKit tests include real local processing and no-upload checks.
- [ ] `pnpm audit` reports no unresolved high or critical advisory; lower-severity advisories are reviewed and dispositioned. Dependabot alerts are enabled.
- [ ] The standalone container builds from the release commit, runs non-root, passes `/healthz`, serves all published routes and static assets, and passes the release smoke checks for canonicals, sitemap, workers, fonts, PDF.js and 404 behavior.
- [ ] CI `validate` is green on the exact up-to-date release head. Review unresolved PR conversations and the final self-review.
- [ ] Publish and deploy only an immutable image digest through the reviewed Toolbox-only process. Confirm backup, health monitoring and a rollback digest/command before production traffic changes.

## No-Go conditions

Do not release while the production origin, publisher/contact/legal details or host/logging disclosure is unknown; while a required CI check is failing or missing; while a high/critical advisory remains unresolved; or while the standalone production package fails a route, asset, CSP, health or browser-processing check.

No item in this checklist authorizes a merge, deployment, access to another server project, or a change to shared infrastructure by itself.
