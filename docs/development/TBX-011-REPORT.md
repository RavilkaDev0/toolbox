# TBX-011 — PNG/JPG Converter

**State:** locally verified in the deferred final suite; the exact-head shared-branch GitHub validation is pending. The catalog entry remains draft.

The `/tools/png-jpg-converter` route performs PNG→JPEG and JPEG→PNG conversion locally in the browser. The selected image's actual signature determines its format, and input MIME type and extension must agree. PNG transparency is flattened onto an editable background (white by default); JPEG quality is exposed only for PNG→JPEG. Multiple files are processed sequentially and downloaded as a ZIP, while a single output downloads directly. The UI checks the produced bytes, dimensions and decode before offering the result.

The implementation keeps pure limits and filename rules in `packages/core`, strict settings and file metadata schemas in `packages/contracts`, browser decoding/encoding/output verification in `packages/browser-engines`, and worker lifecycle, accessibility and page states in `apps/web`. It reuses the already-installed `fflate@0.8.3` (MIT) only for batch ZIP output; there is no new dependency, backend processing or upload route.

Limits are 1–10 files, 16 MiB per input, 32 MiB total input, 8 megapixels and 8,192 pixels per edge, 24 MiB per output, 32 MiB aggregate uncompressed batch output, and a 33 MiB ZIP cap. The engine handles one full decode/canvas at a time and bounds previews to a 360-pixel longest edge. An 8-megapixel RGBA surface alone uses about 32 MiB, before browser codecs and copies; mobile browsers can still run short of memory near the cap.

## Evidence captured so far

Synthetic, non-personal fixtures exercise portrait/landscape, transparency, noisy images, file limits, bad signatures and unsupported WebP. The final Chromium/WebKit suite verified real JPEG and ZIP downloads, signatures/dimensions, preview transparency, limits, cancellation/retry and mobile layout. Desktop and mobile evidence is in `docs/evidence/tbx-011/`.

One Chromium performance run measured sequential JPEG→PNG output:

| Input | Input size | PNG output | Elapsed |
| --- | ---: | ---: | ---: |
| `landscape.jpg` | 2,619 B | 7,326 B | 669 ms |
| `noise-800.jpg` | 289,744 B | 1,637,606 B | 659 ms |
| `noise-2000.jpg` | 1,807,723 B | 10,229,573 B | 1,289 ms |

These are single Chromium measurements on synthetic fixtures, not cross-device performance guarantees. JPEG→PNG may increase file size; the UI does not promise compression.

## Verification state

- Focused unit tests: 12/12 passed across core, contracts and browser engine.
- `pnpm lint`: passed; `pnpm typecheck`: passed.
- The initial Chromium/WebKit run exposed a misplaced keyboard-quality assertion for JPEG input. The assertion was moved to PNG→JPEG; the final all-tool run then passed all 159 unit/integration tests and 133 Playwright scenarios.
- Final local `pnpm lint`, `pnpm typecheck`, `pnpm test` and standalone production `pnpm build` passed. A separate standalone server smoke served `/` and `/tools` successfully; desktop/mobile screenshots were inspected.

The final audit must verify PNG/JPEG outputs, batch ordering and ZIP contents, alpha flattening, cancellation/retry/reset, downloads, mobile layout, keyboard operation, and that user image bytes cause no upload request. No physical-device testing or broad image-decoder fuzzing has been performed.
