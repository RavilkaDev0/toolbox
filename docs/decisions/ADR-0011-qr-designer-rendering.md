# ADR-0011: QR Designer uses a matrix encoder and verified owned SVG renderer

## Status

Accepted for TBX-013 implementation; publication awaits the final TBX-018 verification pass.

## Context

Toolbox needs styled QR codes with controllable module shapes, finder styles, gradients and logo positions. User text and logo files are untrusted. Downloadable SVG must remain vector output and must not execute markup or load remote resources. Decorative choices and logos can make an otherwise valid QR unscannable.

## Decision

Use `nayuki-qr-code-generator@1.8.0` to encode text into an actual QR module matrix. Render the matrix as tightly bounded SVG paths and shapes with application-owned markup. Accept only PNG/JPEG logo files; validate signature and dimensions, decode and normalize through canvas, then embed the normalized PNG as an inline raster data URI. Use `jsqr@1.4.0` as a second, independent implementation to decode both the rendered SVG rasterization and PNG output. Do not expose downloads unless both results match the exact source text.

Keep pure limits/settings in core, strict schemas in contracts, browser encoding/rendering in browser-engines and page state in apps/web. Load the QR engine dynamically when its tool route opens. Preserve QR Designer as draft until final acceptance evidence is green; Wi-Fi and Contact QR remain draft.

## Consequences

- Vector QR modules and user-configurable positions remain under direct control; no payload string is serialized into SVG.
- PNG and SVG are verified locally, but a decoder pass cannot promise compatibility with every real-world scanner.
- The generator and decoder are each exact-version dependencies with no runtime dependencies. Their maintenance cadence requires review on upgrade.
- Canvas and scan work is capped but includes synchronous main-thread steps that can briefly affect mobile responsiveness. Measure this before publication; move work to a worker only if real measurements require it.
- Logo file data and text remain local. Embedded logo raster data makes the SVG self-contained.
