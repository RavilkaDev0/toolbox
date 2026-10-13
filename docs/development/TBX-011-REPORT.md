# TBX-011 — PNG/JPG Converter

**State:** implementation complete; final regression pending. This is not a production-readiness claim. The active workflow override defers broad checks until TBX-018.

The `/tools/png-jpg-converter` route performs PNG→JPEG and JPEG→PNG conversion locally in the browser. The selected image's actual signature determines its format, and input MIME type and extension must agree. PNG transparency is flattened onto an editable background (white by default); JPEG quality is exposed only for PNG→JPEG. Multiple files are processed sequentially and downloaded as a ZIP, while a single output downloads directly. The UI checks the produced bytes, dimensions and decode before offering the result.

The implementation keeps pure limits and filename rules in `packages/core`, strict settings and file metadata schemas in `packages/contracts`, browser decoding/encoding/output verification in `packages/browser-engines`, and worker lifecycle, accessibility and page states in `apps/web`. It reuses the already-installed `fflate@0.8.3` (MIT) only for batch ZIP output; there is no new dependency, backend processing or upload route.

Limits are 1–10 files, 16 MiB per input, 32 MiB total input, 8 megapixels and 8,192 pixels per edge, 24 MiB per output, 32 MiB aggregate uncompressed batch output, and a 33 MiB ZIP cap. The engine handles one full decode/canvas at a time and bounds previews to a 360-pixel longest edge. An 8-megapixel RGBA surface alone uses about 32 MiB, before browser codecs and copies; mobile browsers can still run short of memory near the cap.

## Evidence captured so far

Synthetic, non-personal fixtures exercise portrait/landscape, transparency, noisy images, file limits, bad signatures and unsupported WebP. The initial broad run produced real JPEG and ZIP downloads, verified signatures/dimensions and preview transparency. Desktop evidence is in `docs/evidence/tbx-011/`; mobile screenshot capture remains for final browser verification.

One Chromium performance run measured sequential JPEG→PNG output:

| Input | Input size | PNG output | Elapsed |
| --- | ---: | ---: | ---: |
| `landscape.jpg` | 2,619 B | 7,326 B | 594 ms |
| `noise-800.jpg` | 289,744 B | 1,637,606 B | 491 ms |
| `noise-2000.jpg` | 1,807,723 B | 10,229,573 B | 1,508 ms |

These are single Chromium measurements on synthetic fixtures, not cross-device performance guarantees. JPEG→PNG may increase file size; the UI does not promise compression.

## Verification state

- Focused unit tests: 12/12 passed across core, contracts and browser engine.
- `pnpm lint`: passed; `pnpm typecheck`: passed.
- The pre-override broad run completed all 99 Vitest tests successfully and passed 102 of 104 Playwright scenarios. The two failures were the same assertion in Chromium and WebKit: the mobile cancellation scenario expected the JPEG quality slider to respond to keyboard input for a JPEG source, where the control is correctly disabled. The assertion was moved to the PNG→JPEG scenario, where quality applies. That correction has not yet been rerun; the whole suite remains unverified until the final phase.
- `pnpm build`, mobile screenshot inspection, production standalone checks, and final Chromium/WebKit runs are deferred until TBX-018.

The final audit must verify PNG/JPEG outputs, batch ordering and ZIP contents, alpha flattening, cancellation/retry/reset, downloads, mobile layout, keyboard operation, and that user image bytes cause no upload request. No physical-device testing or broad image-decoder fuzzing has been performed.
