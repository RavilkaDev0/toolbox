# TBX-013 — Advanced QR Designer

## Implementation status

The browser-local QR Designer is implemented on `feat/tbx-005-tool-suite`. It is deliberately still **draft** in the catalog. In local development and the isolated Playwright server only, `TOOLBOX_UI_FIXTURES=1` exposes the draft route so the feature can be tested before publication. No production catalog, static route or other tool status has been changed.

The UI supports text and HTTP(S) URLs, three presets, size and quiet-zone controls, all four error-correction levels, contrast-checked colors and gradients, four module styles, three finder styles, and a constrained raster logo with nine positions. Live preview is debounced. A visible result and downloads appear only after an independent local `jsqr` pass decodes the rendered SVG and the PNG output back to the exact entered value. SVG output contains actual vector paths/shapes; it does not wrap a screenshot. When a logo is present, only the normalized PNG logo is raster content.

## Architecture and security

Pure payload, URL, contrast, preset and resource rules live in `packages/core`; strict Zod schemas live in `packages/contracts`; encoding, SVG, logo sanitization and scan gating live in `packages/browser-engines`; the tool UI and Blob URL lifecycle live in `apps/web`. The engine and its dependencies load through a dynamic import when the tool opens. No backend endpoint, upload, analytics, database or new service is used.

Limits: 2,048 UTF-8 payload bytes (actual QR capacity also depends on version/error correction); one PNG/JPEG logo, 1 MiB, 512 px per side and 0.25 MP; output 256–1,024 px, PNG ≤5 MiB, SVG ≤4 MiB; quiet zone 4–12 modules; foreground and both gradient stops require ≥4.5:1 contrast. Header signatures and dimensions are checked before decode and decoded logo dimensions checked again. The tool normalizes logo data to PNG before embedding. URL mode requires complete HTTP(S), rejects whitespace padding and control characters, and does not visit the URL. Text and file contents never leave the browser.

The main remaining execution risk is bounded synchronous main-thread work during matrix encoding, SVG assembly and QR scanning. AbortController handles asynchronous decode/render waits and generation tokens discard stale results, but JavaScript cannot preempt a synchronous pass. The output canvas is capped at 1 MP (4 MiB RGBA); a second temporary surface is used to decode the actual PNG. Work, mobile responsiveness and memory are pending measurement in the final cross-browser phase. A successful bundled scan does not guarantee every real camera will scan a heavily stylized design.

## Dependencies

Two exact browser-engine dependencies were added:

- `nayuki-qr-code-generator@1.8.0` — MIT, zero runtime dependencies, about 51 KB unpacked. It supplies the QR versions, Reed–Solomon correction and raw module matrix. The small npm wrapper is old, so the upstream source and its checked-in algorithm need review during upgrades. [Upstream repository](https://github.com/nayuki/QR-Code-generator), [package](https://www.npmjs.com/package/nayuki-qr-code-generator).
- `jsqr@1.4.0` — Apache-2.0, zero runtime dependencies, about 280 KB unpacked. It is the independent local decoder that gates exports. Its release cadence is old; tests will protect our browser use, and upgrades should compare another maintained decoder. [Upstream repository](https://github.com/cozmo/jsQR), [package](https://www.npmjs.com/package/jsqr).

Both packages are imported only through the QR tool's dynamic browser-engine import; neither is added to server processing. A combined styling package was considered but would provide less direct control over the required logo positioning and SVG safety constraints. The version-pinned lockfile was updated. No other dependency was introduced.

## Checks recorded so far

- `pnpm run build:packages` — passed, compiling core, contracts, UI and browser engines.
- `pnpm --filter @toolbox/web run typecheck` — passed after separate T012 follow-up fixes (`f6c8a65`, `17c7f08`). The first attempt exposed T012 WebP API mismatches and a possibly-undefined E2E pixel value; those were fixed without running tests.
- Targeted `pnpm exec biome check` on touched source/config files — passed; `git diff --check` — passed.
- Unit, contract, browser, standalone-production, screenshot and performance tests — **not run yet**, per the accepted implementation-first/final-testing-last workflow.
- Codebase Memory MCP was attempted for route/ownership context but the configured server returned `Transport closed`. Repository docs and source were reviewed directly. The shadcn component audit checklist and version-pinned QR encoder/decoder docs were consulted.

The unit and Playwright tests are present in source, including Chromium/WebKit configurations, but their assertions have not yet been proven by a run. No functional or production-readiness claim is made before final verification. Screenshots, output sizes, throughput and memory data must be added to this report after the final runs.

## Remaining risks

- Confirm actual Unicode/emoji round trips and logo scan behavior in Chromium and WebKit.
- Verify all preset/style/ECC variants either scan and export or block downloads with a useful message.
- Validate cancellation during browser image decode/render, repeat/reset cleanup, and stale-result handling.
- Measure generation time, PNG/SVG size and peak memory for short, Unicode and dense payloads on desktop and mobile viewports.
- Inspect final desktop/mobile screenshots, run standalone production tests and finish all required final workspace gates before changing this tool's status to published.
