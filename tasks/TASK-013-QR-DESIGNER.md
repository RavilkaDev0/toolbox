# TASK-013 — Advanced QR Designer

## State

Implementation is on the shared `feat/tbx-005-tool-suite` branch. The catalog entry remains **draft** until the final TBX-018 verification phase. Local preview access is enabled only in the isolated development/test environment (`TOOLBOX_UI_FIXTURES=1`); production routing and catalog visibility still require publication.

## Acceptance criteria

- Create codes from bounded plain text or complete HTTP(S) URLs, including Unicode and emoji.
- Provide live preview, output size, 4–12 module quiet zone, L/M/Q/H error correction, contrast-checked foreground/background, optional two-color gradient, four distinct module shapes, three finder marker shapes and three named design presets.
- Accept one optional PNG or JPEG logo, verify its signature and dimensions before decode, normalize it to PNG, constrain its size and offer nine bounded positions.
- Independently decode both the rendered SVG and the actual PNG file in the browser. Do not show download links if either decoded payload differs from the input.
- Download a true vector SVG QR and a PNG. The optional logo is the only raster object embedded in the SVG.
- Support retry, cancellation, reset, keyboard navigation, touch and narrow mobile layouts. Do not display invented progress.
- Keep payloads, logo contents and generated output in the browser. Do not send them to server routes or analytics.
- Keep QR Designer hidden from production until final acceptance tests pass. Wi-Fi QR and Contact QR remain draft.

## Ownership and design

- `packages/core`: bounded settings, presets, UTF-8 payload and URL rules, contrast calculation, logo metadata and readable error codes.
- `packages/contracts`: strict Zod schemas for payload mode, settings, preset and logo metadata.
- `packages/browser-engines`: QR encoding, safe vector SVG construction, local raster rendering, independent scan verification and logo normalization.
- `apps/web`: locally lazy-loaded tool UI, preview, downloads and stale-result/resource lifecycle.
- The existing catch-all route exposes this draft tool only to local development and tests with `TOOLBOX_UI_FIXTURES=1`. Production still uses the published-only catalog and static paths.

The app uses Nayuki's QR Code generator for the standards implementation and `jsqr` to independently inspect the browser-rendered design. A small owned SVG renderer gives the tool constrained control of finder styles, module styles and logo positions without placing payload text in SVG markup. A verified PNG logo is embedded as an inlined raster data URI; SVG logos and external resources are rejected. PNG and SVG outputs are withheld unless both scan to the exact text.

## Resource limits and threat model

Inputs are untrusted. The payload limit is 2,048 UTF-8 bytes; the selected error-correction level may have a lower actual QR capacity, in which case encoding fails clearly. URL mode rejects non-HTTP(S), leading/trailing whitespace and control characters. Settings accept enumerated options, bounded integers and explicit `#RRGGBB` values; both gradient endpoints need at least 4.5:1 contrast against the background.

The single optional logo is limited to 1 MiB, PNG/JPEG, 512 pixels on each side and 262,144 total pixels. Magic bytes and dimensions are checked before browser decode; the decoded dimensions are checked again. Re-encoding through canvas produces a sanitized PNG before SVG embedding. No user text, filename, URL or arbitrary markup is interpolated into the SVG. SVG resources contain no remote fonts, URLs, scripts or `foreignObject` elements.

PNG output is at most 1,536 × 1,536 pixels and 5 MiB; SVG output is at most 4 MiB. At the maximum canvas size, one RGBA pixel surface is about 9 MiB; scan verification temporarily holds a second bounded surface and decoder working data (about 27 MiB of explicit RGBA surfaces at peak, plus browser and decoder overhead). The maximum QR is 177 × 177 modules before the quiet zone. Matrix encoding, SVG assembly and the scanner's pixel pass are synchronous browser work; AbortController can stop pending image decode/render steps and run IDs discard stale results, but JavaScript cannot preempt a synchronous pass already executing. This bounded main-thread work is a remaining mobile responsiveness risk to measure on both supported engines. Canvases, ImageBitmap, Blob URLs and stale results are released on completion, replacement, cancellation, reset or unmount.

Files and content are never uploaded or logged. Navigating to an encoded URL is not part of generation. Browser/device camera scanners may behave differently from the bundled independent decoder; scan verification is a gate, not a guarantee for every camera. QR codes are not encrypted and may encode sensitive text visibly.

## Verification plan

Written unit/contract coverage checks UTF-8 and malformed Unicode, URL schemes, bounds, color contrast, presets, strict schemas, actual matrix versions/capacity, vector output and injection resistance. Playwright coverage uses the existing synthetic PNG logo fixture and tests short URL, Unicode/emoji, a 2,000-byte dense payload, scan-gated PNG/SVG downloads, safe logo normalization, invalid SVG and oversized logo, retry/cancel/reset, keyboard actions, mobile width, console errors, output signatures and absence of non-GET requests. The same scenarios are configured for Chromium and WebKit; the dense case records only payload byte count, elapsed generation time and PNG size.

The final suite after TBX-018 passed unit/integration and Chromium/WebKit scenarios, including dense-payload local scan verification and mobile interactions. Desktop/mobile evidence and resource bounds are recorded in the report. Browser latency and physical-device heap measurements were not captured, so those remain explicit performance risks. The catalog stays draft pending exact-head GitHub validation.
