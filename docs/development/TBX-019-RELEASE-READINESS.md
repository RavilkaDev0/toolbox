# TBX-019 — Release Readiness & Final Hardening

**Audit date:** 2026-10-17
**Branch:** `feat/tbx-005-tool-suite` → `dev`
**Draft PR:** [#5](https://github.com/RavilkaDev0/toolbox/pull/5)
**Release verdict:** **NO-GO until the owner closes the release blockers below.** This change does not merge or deploy the site.

## Scope and evidence

This is a risk-based review of the existing 15-tool platform. No conversion engine was rewritten and no application dependency was added. Code paths were checked against the repository's module boundaries, Codebase Memory graph, existing tool reports, browser tests and current release workflow. The standalone image smoke is part of the required GitHub `validate` check; use the current PR head and its check run for its exact output and bundle measurements.

Focused local verification completed during this change:

- `vitest run apps/web/app/_lib/site-url.test.ts`: 9 tests passed.
- Playwright Chromium and WebKit, `homepage.spec.ts` plus `release-readiness.spec.ts`: 8 tests passed (four in each browser), covering metadata discovery, legal drafts, homepage accessibility and 390px mobile layout.
- Playwright MCP inspected the local homepage accessibility tree; it showed the search, all five categories, catalog entry points and legal links. A local Chromium route pass covered home, catalog, Images to PDF, Merge PDF and all legal pages at 390px: all returned 200, with no horizontal overflow, page errors or console errors.
- Desktop (1440px) and mobile (390px) screenshots were reviewed for the homepage, catalog, Images to PDF and Merge PDF. The mobile shots use a 390px viewport; the development-only Next.js indicator is hidden. [Home desktop](../evidence/tbx-019/home-desktop.png) · [Home mobile](../evidence/tbx-019/home-mobile-390.png) · [Catalog desktop](../evidence/tbx-019/catalog-desktop.png) · [Catalog mobile](../evidence/tbx-019/catalog-mobile-390.png) · [Images to PDF desktop](../evidence/tbx-019/images-to-pdf-desktop.png) · [Images to PDF mobile](../evidence/tbx-019/images-to-pdf-mobile-390.png) · [Merge PDF desktop](../evidence/tbx-019/merge-pdf-desktop.png) · [Merge PDF mobile](../evidence/tbx-019/merge-pdf-mobile-390.png).
- Direct `tsc --noEmit` for the web app passed after Next route type generation. Biome and `git diff --check` passed.
- The standalone Chromium smoke script was also exercised against the local development server and passed; only the hosted run can verify production CSP and container behavior.
- A direct dependency audit could not run on this Windows shell: the available pnpm is 11.25.0 while this workspace requires 12.11.2. GitHub Dependabot alerts are disabled for the repository. The exact pnpm audit now runs in hosted `validate`.
- Docker is not installed in this local environment. The hosted `validate` job builds and starts the standalone image, then runs `apps/web/scripts/smoke-standalone.mjs` inside that container.

The final `validate` run for this report's head is recorded by the check on [PR #5](https://github.com/RavilkaDev0/toolbox/pull/5). Its log includes `pnpm audit`, the frozen install, the four required quality gates, the production image build and standalone smoke output.

## Confirmed gaps and fixes

| Confirmed gap | Change |
| --- | --- |
| Canonicals were relative and no production origin was configured. | `SITE_URL` is validated as a public HTTPS origin. Production builds fail when it is absent or invalid. Canonicals are absolute; local development omits canonicals until an origin is set. The production build cannot emit localhost canonicals. |
| No robots or sitemap routes existed. | `/robots.txt` points to the configured sitemap, blocks development fixtures, and `/sitemap.xml` lists the home, catalog, categories and currently published tools. Legal drafts are excluded from the sitemap and marked `noindex`. |
| Open Graph and Twitter metadata were not defined across the site. | Root and route metadata now include unique titles and descriptions, Open Graph website metadata, Twitter cards and absolute canonical URLs when `SITE_URL` is configured. No production domain or brand image was invented. |
| Public privacy, terms and support pages were absent. | Added `/privacy`, `/terms` and `/contact` as clearly marked, non-indexable owner-review drafts. They state current browser processing and explicitly disclose unknown hosting log practices instead of claiming infrastructure-wide non-retention. |
| The standalone smoke depended on copying static files by hand. | Added a multi-stage Docker build that installs from the frozen lockfile, builds the web app, copies standalone output plus `.next/static` and `public`, runs as the unprivileged `node` user, disables build/runtime Next telemetry and defines `/healthz` health checks. |
| No production response security headers were configured. | Added `nosniff`, a strict referrer policy, frame denial and a minimal permissions policy. Production CSP allows only same-origin assets plus the data/blob sources required for local previews and workers. `X-Powered-By` is disabled. |
| The CI runner/action versions were approaching runtime and OS transitions; browser binaries were downloaded on each run. | Updated checkout, setup-node, pnpm, cache and artifact actions to their current Node 24-compatible majors; pinned Ubuntu 24.04 during the announced `ubuntu-latest` migration; added Playwright browser caching without caching `node_modules` or reducing coverage. |
| The home page repeated all 15 tool cards already available from search, categories and `/tools`. | Removed the duplicate grid. The home page keeps search, five category routes and visible catalog links, while the catalog remains the complete entry point to every published tool. The category count now uses singular grammar for a single tool. |

## Security review

### Browser data flow and input handling

The web app has no conversion upload route. Existing tool flows process files in browser workers or browser APIs; the existing Chromium/WebKit scenarios monitor requests and verify that user files are not posted to the app. The new release smoke checks page and asset delivery only. It does not submit file content to the standalone server.

Existing PDF and image engines use bounded schemas and content/signature inspection before decoding. The static PDF policy rejects encrypted files and unsupported active features rather than trying to execute or bypass them. These controls and actual sample-file checks are recorded in the TBX-004 through TBX-018 reports; this audit did not alter those engines. The server container contains the web app only and does not add an upload API, database, Redis, Compose stack or host integration.

The QR SVG path validates color/settings, limits logo dimensions and accepts only bounded PNG data URLs produced by the rasterization step; an injection-shaped data URL is covered by a unit test. The password generator uses `crypto.getRandomValues` with rejection sampling, checks the selected character classes, and fails closed when secure randomness is unavailable. Neither path uses `Math.random` or places the QR payload in generated SVG markup.

Workers and result URLs have explicit termination/revocation paths in the affected tools, with cancellation, retry, stale-result and cleanup scenarios in the existing browser tests. The release change adds no persistent client storage. Mobile devices can still run out of memory while decoding large local files; current per-tool limits reduce that risk but cannot guarantee a device's available memory.

### Headers and CSP

The enforced production CSP allows same-origin scripts, styles and connections. It allows inline scripts because Next.js static App Router output uses inline bootstrap data, and it does not allow `unsafe-eval`. `blob:` and `data:` are limited to workers, local image previews and fonts needed by the browser tools. This is a practical static-site policy, not nonce-based CSP; a future move to request-time rendering should re-evaluate nonces and CSP compatibility.

HSTS is intentionally absent because no public domain, TLS termination point or reverse-proxy configuration was supplied. The owner must verify HTTPS and set transport headers at the chosen edge before release. The standalone smoke verifies the emitted CSP and headers against the packaged production server, alongside route, static asset, worker, local font, PDF.js, sitemap and 404 checks.

### Dependencies and vulnerabilities

TBX-019 adds no runtime or development package. Existing PDF, image and QR dependencies remain pinned in `pnpm-lock.yaml`. A pnpm audit gate now fails on high or critical advisories. The GitHub Dependabot alerts endpoint returned 403 because alerts are disabled, so the CI audit is the current advisory evidence; enable Dependabot alerts as a repository-owner follow-up. Review any moderate/low findings shown in the same run before release as well.

## SEO and indexability

- `SITE_URL` must be a bare public HTTPS origin; credentials, paths, query strings, fragments, HTTP public origins and production loopback origins are rejected.
- The homepage, catalog, all five categories and published tool pages emit absolute canonicals and route-specific Open Graph/Twitter titles and descriptions when built with the real domain.
- The sitemap derives its tool list from the published registry. Catalog query variants resolve to the catalog canonical. Unknown tool routes retain real 404 behavior.
- `/privacy`, `/terms` and `/contact` are directly reachable but remain `noindex` until their owner-provided details are reviewed. Development fixtures are not in the sitemap and are blocked by robots.
- CI uses the reserved `.invalid` hostname only as a test origin. It is not a proposed production domain. No custom social-preview image is configured in this change.

The sitemap and canonical routes cannot be production-ready until the owner supplies the actual site origin and uses it for the production build.

## Production packaging and CI

`Dockerfile` is a two-stage, lockfile-driven build on the repository's Node 24 line. Its default image runs `apps/web/server.js` as `node`, binds the container port, checks `/healthz` and includes the complete generated static tree. `.dockerignore` excludes source-control metadata, build output, fixtures and environment files. The workflow starts a clean container and runs the standalone smoke inside it. The smoke checks every sitemap route, legal pages, absolute canonicals, SEO metadata, security headers, the real 404, all HTML-referenced static assets, local fonts, emitted web workers and the PDF.js client runtime. It prints total chunk bytes, largest chunk and homepage script bytes.

GitHub Actions caches the pnpm store through setup-node and caches only Playwright browser binaries keyed to the lockfile and Playwright version. It still installs OS browser dependencies, runs the full Chromium/WebKit suite once, and runs the full build. The CI container build necessarily rebuilds the web package in its isolated image; it does not rerun the test suite.

The local machine has no Docker CLI, so no local image run is claimed. The hosted container build and smoke are required before treating packaging as verified. Production deployment must still use an immutable image digest and a reviewed rollback procedure from the repository's deployment policy.

## Release blockers and owner actions

1. Supply the real public HTTPS origin, set `SITE_URL` in the production build environment, and verify canonical URLs, robots and sitemap against that origin. Do not use the `.invalid` CI value in production.
2. Supply the publisher's legal name, intended jurisdiction, effective date, applicable terms and monitored support/privacy contacts. Have the owner or qualified counsel approve the draft text, then remove `noindex` only after those pages are complete.
3. Identify the production host, CDN/security providers, request-log fields, access and retention. Update the privacy notice to match those actual practices. Confirm that no analytics or embedded service has been enabled outside this repository.
4. Verify HTTPS termination and configure HSTS at the reviewed edge. Confirm the production CSP still permits the real font, worker and local preview paths.
5. Review the current `validate` check and audit output on PR #5. Resolve every high/critical advisory and review remaining advisories before approval. Enable Dependabot alerts.
6. Before release, follow the documented host preflight, image-digest, health-check and rollback process. This audit did not access or change any production or unrelated server project.

## Remaining risks

- No production domain, legal owner identity, host/logging profile, support contact or jurisdiction was supplied.
- Dependabot alerts are disabled; local pnpm is older than the workspace requirement and Docker is unavailable locally. Hosted CI is the authoritative audit/package evidence for this branch.
- No physical low-memory mobile-device run or adversarial PDF corpus/fuzz campaign was repeated because TBX-019 changes no conversion engine. The existing bounded-input tests and tool reports remain the evidence for those engines.
- The CSP retains `unsafe-inline` for static Next.js bootstrap code. It blocks external script sources and `unsafe-eval`, but does not provide nonce-based inline-script protection.
- No production HSTS or edge configuration can be verified before the owner identifies the host and TLS termination.

## Dependencies and references

No application dependency was added. Packaging uses the official Node 24.21.0 image and existing pinned pnpm 12.11.2 workspace. The standalone copy layout follows [Next.js self-hosting documentation](https://nextjs.org/docs/app/guides/self-hosting); the multi-stage and non-root runtime follow [Docker build guidance](https://docs.docker.com/build/building/multi-stage/).

The action majors were checked against the official [checkout](https://github.com/actions/checkout/releases), [setup-node](https://github.com/actions/setup-node/releases), [cache](https://github.com/actions/cache/releases), [upload-artifact](https://github.com/actions/upload-artifact/releases) and [pnpm/action-setup](https://github.com/pnpm/action-setup/releases) release pages. Ubuntu 24.04 is pinned while GitHub migrates `ubuntu-latest` to 26.04 beginning 2026-10-19 and through 2026-11-19; see the [runner image announcement](https://github.com/actions/runner-images/issues/14748).
