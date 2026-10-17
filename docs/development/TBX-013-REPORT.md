# TBX-013 — Advanced QR Designer

## Implementation status

The browser-local QR Designer is implemented on `feat/tbx-005-tool-suite`. It is deliberately still **draft** in the catalog. In local development and the isolated Playwright server only, `TOOLBOX_UI_FIXTURES=1` exposes the draft route so the feature can be tested before publication. No production catalog, static route or other tool status has been changed.

The UI supports text and HTTP(S) URLs, three presets, size and quiet-zone controls, all four error-correction levels, contrast-checked colors and gradients, four module styles, three finder styles, and a constrained raster logo with nine positions. Live preview is debounced. A visible result and downloads appear only after an independent local `jsqr` pass decodes the rendered SVG and the PNG output back to the exact entered value. SVG output contains actual vector paths/shapes; it does not wrap a screenshot. When a logo is present, only the normalized PNG logo is raster content.

## Architecture and security

Pure payload, URL, contrast, preset and resource rules live in `packages/core`; strict Zod schemas live in `packages/contracts`; encoding, SVG, logo sanitization and scan gating live in `packages/browser-engines`; the tool UI and Blob URL lifecycle live in `apps/web`. The engine and its dependencies load through a dynamic import when the tool opens. No backend endpoint, upload, analytics, database or new service is used.

Limits: 2,048 UTF-8 payload bytes (actual QR capacity also depends on version/error correction); one PNG/JPEG logo, 1 MiB, 512 px per side and 0.25 MP; output 256–1,536 px, PNG ≤5 MiB, SVG ≤4 MiB; quiet zone 4–12 modules; foreground and both gradient stops require ≥4.5:1 contrast. Header signatures and dimensions are checked before decode and decoded logo dimensions checked again. The tool normalizes logo data to PNG before embedding. URL mode requires complete HTTP(S), rejects whitespace padding and control characters, and does not visit the URL. Text and file contents never leave the browser.

The main remaining execution risk is bounded synchronous main-thread work during matrix encoding, SVG assembly and QR scanning. AbortController handles asynchronous decode/render waits and generation tokens discard stale results, but JavaScript cannot preempt a synchronous pass. The tested output canvas is capped at 1,536 × 1,536 (about 2.36 MP / 9 MiB RGBA); scan verification temporarily holds additional bounded pixel surfaces and decoder working data, for about 27 MiB of explicit RGBA surfaces at peak, plus browser and decoder overhead. Final Chromium/WebKit tests passed dense payloads at this cap and mobile scenarios, but no physical-device timing or comparable cross-browser heap peak was measured. A successful bundled scan does not guarantee every real camera will scan a heavily stylized design.

## Dependencies

Two exact browser-engine dependencies were added:

- `nayuki-qr-code-generator@1.8.0` — MIT, zero runtime dependencies, about 51 KB unpacked. It supplies the QR versions, Reed–Solomon correction and raw module matrix. The small npm wrapper is old, so the upstream source and its checked-in algorithm need review during upgrades. [Upstream repository](https://github.com/nayuki/QR-Code-generator), [package](https://www.npmjs.com/package/nayuki-qr-code-generator).
- `jsqr@1.4.0` — Apache-2.0, zero runtime dependencies, about 280 KB unpacked. It is the independent local decoder that gates exports. Its release cadence is old; tests will protect our browser use, and upgrades should compare another maintained decoder. [Upstream repository](https://github.com/cozmo/jsQR), [package](https://www.npmjs.com/package/jsqr).

Both packages are imported only through the QR tool's dynamic browser-engine import; neither is added to server processing. A combined styling package was considered but would provide less direct control over the required logo positioning and SVG safety constraints. The version-pinned lockfile was updated. No other dependency was introduced.

## Final local checks

- `pnpm run build:packages` — passed, compiling core, contracts, UI and browser engines.
- `pnpm --filter @toolbox/web run typecheck` — passed after separate T012 follow-up fixes (`f6c8a65`, `17c7f08`). The first attempt exposed T012 WebP API mismatches and a possibly-undefined E2E pixel value; those were fixed without running tests.
- Targeted `pnpm exec biome check` on touched source/config files — passed; `git diff --check` — passed.
- The final combined suite passed 159 unit/integration tests and 133 Playwright Chromium/WebKit scenarios, including dense payloads, PNG/SVG decode verification, invalid logos, keyboard cancellation/reset, mobile layouts, and no upload requests. `pnpm lint`, `pnpm typecheck`, and standalone production `pnpm build` passed.
- Desktop/mobile screenshots and actual scan-verified output sizes (11.7 KiB PNG, 3.9 KiB SVG) are in `docs/evidence/tbx-013/`.
- Exact-head GitHub validation remains pending. The six TBX-013–018 tools remain draft until the final shared-branch `validate` passes.
- Quantitative generation latency and cross-browser heap peak were not measured. Treat synchronous dense-code work and variation among physical cameras as remaining limitations, not as passing performance claims.

## Remaining risks

- Browser coverage verifies actual Unicode/dense payload scans, logo validation, QR settings, cancellation/reset cleanup and mobile layouts in Chromium and WebKit.
- Quantitative browser latency and physical low-memory device heap measurements remain unverified; canvas/decoder bounds are documented above.
- The tool remains draft pending the exact-head shared-branch GitHub `validate`; no claim is made that every physical camera scans every stylized output.
