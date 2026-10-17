# TBX-014 — Wi-Fi QR report

## Implementation state

Implementation is committed as `672e218` on `feat/tbx-005-tool-suite`. The catalog entry is published after the final combined local suite and exact-head GitHub validation passed. The publication follow-up CI result is recorded in Draft PR #5.

## Design

- `packages/core/src/wifi-qr.ts` builds and parses bounded Wi-Fi QR payloads, validates credential modes, and escapes backslash, semicolon, comma, colon and quote characters.
- `packages/contracts/src/wifi-qr.ts` exposes strict Zod validation.
- `apps/web/app/tools/wifi-qr/` owns client-only SSID/password state, hidden-network and reveal controls, cancellation/reset, object URL cleanup, local preview and PNG/SVG downloads.
- The workspace lazily imports the existing `@toolbox/browser-engines/qr-designer` only when Generate is used. That engine independently decodes both rendered formats before returning them. No QR dependency, service, upload endpoint or second encoder was added.
- The Next route and metadata use the existing published-tool catalog. The route is statically generated for production after publication.

## Compatibility and limits

The generated payload follows the widely used ZXing Wi-Fi format. WPA/WPA2 and transition networks use `T:WPA`. WPA3-Personal uses Android's `T:SAE` extension; some current Android readers recognize it, but older and other-device scanners may not. Open networks use `T:nopass`; WEP accepts 5/13 printable ASCII characters or 10/26 hexadecimal digits. The option text and page instructions explain that device support varies.

SSID is limited to 32 UTF-8 bytes. WPA passwords accept 8–63 UTF-8 bytes or a 64-digit hexadecimal PSK; SAE accepts 8–63 UTF-8 bytes. QR payloads are also bounded by the shared 2,048-byte rule and the actual encoder capacity at level L. The shared renderer emits a 512px PNG and bounded SVG. The final browser suite verified the exports and supported WPA3/WEP/open cases in Chromium and WebKit. No dedicated latency or peak-memory benchmark was run.

## Privacy and threat notes

SSID and password are held only in React client state and the short-lived payload needed for QR creation. They are not placed in server props, URL state, storage or analytics. The UI does not log them, and processing makes no upload request. Reset clears the form, output and object URLs; edits/cancel invalidate stale work and abort the renderer. Any recipient of the QR can read its credentials, which the UI warns about before generation. QR image files themselves cannot conceal the encoded password.

The format is de-facto rather than universally implemented. WPA3 SAE support varies by scanner, and WEP is obsolete and retained only for compatibility with legacy networks.

## Written tests and checks

Written coverage includes core tests for escaping and parse round trips, WPA/SAE/WEP/open formats, Unicode byte bounds, password rules and malformed payloads; strict contract tests; a shared-engine test that encodes Wi-Fi text through the existing matrix pipeline; and Playwright scenarios for actual verified PNG/SVG downloads, reset, WEP/WPA3/open modes, mobile overflow, keyboard password reveal, and absence of upload requests.

The deferred final run passed all 159 unit/integration tests and 133 Playwright Chromium/WebKit scenarios across the full suite, including the Wi-Fi QR scenarios for output verification, credential modes, mobile sizing, keyboard controls, reset and no uploads. Final `pnpm lint`, `pnpm typecheck`, `pnpm test` and standalone production `pnpm build` passed. Performance/heap measurements and physical-device scanner testing were not performed; WPA3 support varies by scanner as described above.

No dependency was added. Codebase Memory returned `Transport closed`; architecture review used the repository sources and `rg`. The shadcn component audit found no missing dependency and the available import/type checks passed.

## References

- [ZXing Wi-Fi network configuration format](https://github.com/zxing/zxing/wiki/Barcode-Contents#wi-fi-network-config-android-ios-11)
- [Android WifiUriParser source](https://android.googlesource.com/platform/modules/Wifi/+/refs/heads/main/framework/java/android/net/wifi/WifiUriParser.java)
