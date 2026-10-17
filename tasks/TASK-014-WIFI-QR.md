# TASK-014 — Wi-Fi QR

## State

Implementation is recorded on the shared `feat/tbx-005-tool-suite` branch. The catalog entry is published after the suite's final verification and exact-head gate passed. The current publication-follow-up CI result is recorded in Draft PR #5.

## Acceptance criteria

- Build a locally generated Wi-Fi QR payload for secured WPA personal, WPA3 SAE, WEP, and open networks.
- Bound SSID to 32 UTF-8 bytes; validate credential lengths and WEP key shapes without echoing secrets in errors.
- Escape backslash, semicolon, comma, colon, and quotation mark fields; preserve valid Unicode.
- Support hidden SSIDs, show/hide password, clear credentials on reset, and warn that anyone who scans the QR can read its credentials.
- Parse generated payloads back to their exact fields before asking the shared QR Designer engine to encode, render, and independently scan-check the PNG/SVG outputs.
- Keep sensitive input in client state only: no persistence, URL parameters, server props, analytics, logs, or upload requests.
- Cover validation, encoding, reset/cancel, actual downloads, mobile layout, keyboard use, and no-upload behavior with unit/integration/E2E tests. The deferred final local suite passed these cases in Chromium and WebKit.

## Design and compatibility

`packages/core` owns bounded options, the de-facto ZXing-compatible Wi-Fi payload format and its parser. `packages/contracts` owns a strict schema. The client workspace builds the payload and calls the existing lazy-loaded `@toolbox/browser-engines/qr-designer` engine with classic high-capacity styling and no logo. No separate QR encoder or dependency is added.

`T:WPA` covers WPA/WPA2 and transition networks; QR readers and network negotiation determine whether WPA3 transition works. Android's current `WifiUriParser` also recognizes `T:SAE` for WPA3-Personal, but older or other-device scanners may not. WEP uses common 5/13-character ASCII or 10/26-digit hexadecimal keys. The format remains a de-facto convention, so device support cannot be guaranteed.

## Security and resource limits

SSID: 1–32 UTF-8 bytes. WPA/SAE password: 8–63 UTF-8 bytes, with WPA additionally accepting a 64-digit hex pre-shared key. WEP: 5 or 13 printable ASCII bytes, or 10/26 hex digits. Payloads are additionally subject to the existing 2,048-byte QR Designer limit and the actual QR capacity at error-correction level L. The output is one 512px PNG and one bounded SVG from the shared renderer.

Password and SSID values stay in client memory only. Inputs are cleared on Reset, generation is abortable, stale results are discarded and object URLs are revoked on change/reset/unmount. The QR is itself a plaintext credential disclosure to anyone able to scan it. The generated image cannot be protected from copying.
