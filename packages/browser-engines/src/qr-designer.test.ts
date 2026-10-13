import { QrDesignerError, qrDesignerPresets } from "@toolbox/core";
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

  it("renders actual vector modules, a quiet zone and gradient colors without embedding the payload", () => {
    const payload = "https://private.example/path";
    const matrix = encodeQrMatrix("url", payload, qrDesignerPresets.garden);
    const svg = buildQrSvg(matrix, qrDesignerPresets.garden);
    expect(svg).toContain("<path");
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
