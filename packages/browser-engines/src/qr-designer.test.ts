import {
  buildContactVCard,
  buildWifiQrPayload,
  QrDesignerError,
  qrDesignerPresets,
} from "@toolbox/core";
import { describe, expect, it } from "vitest";
import { buildQrSvg, encodeQrMatrix } from "./qr-designer.js";

describe("QR designer browser engine primitives", () => {
  it("encodes URLs, Unicode and dense text with the selected Reed–Solomon level", () => {
    const classic = qrDesignerPresets.classic;
    const url = encodeQrMatrix("url", "https://example.com/path?q=1", classic);
    const unicode = encodeQrMatrix("text", "Hello, 世界 👋", classic);
    const dense = encodeQrMatrix("text", "x".repeat(900), { ...classic, errorCorrection: "L" });
    expect(url.size).toBeGreaterThanOrEqual(21);
    expect(url.size).toBe(17 + 4 * url.version);
    expect(unicode.size).toBe(17 + 4 * unicode.version);
    expect(dense.version).toBeGreaterThan(unicode.version);
    expect(() =>
      encodeQrMatrix("text", "x".repeat(2048), { ...classic, errorCorrection: "H" }),
    ).toThrowError(QrDesignerError);
  });

  it("encodes the shared Wi-Fi payload using the same QR matrix pipeline", () => {
    const payload = buildWifiQrPayload({
      ssid: "Toolbox Guest",
      security: "wpa3",
      password: "valid passphrase",
      hidden: true,
    });
    const settings = { ...qrDesignerPresets.classic, errorCorrection: "L" as const };
    const matrix = encodeQrMatrix("text", payload, settings);
    const svg = buildQrSvg(matrix, settings);
    expect(matrix.version).toBeGreaterThan(0);
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("valid passphrase");
  });

  it("encodes a validated vCard contact with the same QR matrix pipeline", () => {
    const vcard = buildContactVCard({
      fullName: "Ada Lovelace",
      organization: "Toolbox",
      jobTitle: "Engineer",
      phone: "+44 20 7946 0958",
      email: "ada@example.org",
      website: "https://example.org/ada",
      address: "London",
    });
    const settings = { ...qrDesignerPresets.classic, errorCorrection: "L" as const };
    const matrix = encodeQrMatrix("text", vcard, settings);
    const svg = buildQrSvg(matrix, settings);
    expect(matrix.version).toBeGreaterThan(0);
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("Ada Lovelace");
    expect(svg).not.toContain("ada@example.org");
  });

  it("renders actual vector modules, a quiet zone and gradient colors without embedding the payload", () => {
    const payload = "https://private.example/path";
    const matrix = encodeQrMatrix("url", payload, qrDesignerPresets.garden);
    const svg = buildQrSvg(matrix, qrDesignerPresets.garden);
    expect(svg).toMatch(/<(?:path|circle)\b/);
    expect(svg).toContain("<circle");
    expect(svg).toContain("linearGradient");
    expect(svg).toContain(`viewBox="0 0 ${matrix.size + 16} ${matrix.size + 16}"`);
    expect(svg).not.toContain(payload);
    expect(svg).not.toContain("<script");
  });

  it("uses the logo only as bounded raster data and rejects markup injection", () => {
    const matrix = encodeQrMatrix("text", "logo test", qrDesignerPresets.classic);
    const svg = buildQrSvg(matrix, qrDesignerPresets.classic, {
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
      width: 20,
      height: 10,
    });
    expect(svg).toContain('<image href="data:image/png;base64,');
    expect(() =>
      buildQrSvg(matrix, qrDesignerPresets.classic, {
        dataUrl: 'data:image/png;base64,AA=="/><script>alert(1)</script>',
        width: 20,
        height: 10,
      }),
    ).toThrowError(QrDesignerError);
  });
});
