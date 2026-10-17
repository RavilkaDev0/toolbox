import { describe, expect, it } from "vitest";
import {
  assertQrDesignerSettings,
  assertQrLogoMetadata,
  assertQrPayload,
  assertQrUrl,
  QrDesignerError,
  qrContrastRatio,
  qrDesignerLimits,
  qrDesignerPresets,
} from "./qr-designer.js";

describe("QR designer rules", () => {
  it("bounds UTF-8 payloads and rejects empty or malformed Unicode input", () => {
    expect(assertQrPayload("你好 😀")).toBeGreaterThan("你好 😀".length);
    expect(() => assertQrPayload("")).toThrowError(QrDesignerError);
    expect(() => assertQrPayload("\ud800")).toThrowError(/invalid Unicode/i);
    expect(() => assertQrPayload("x".repeat(qrDesignerLimits.payloadBytes + 1))).toThrowError(
      /too large/i,
    );
  });

  it("accepts only complete HTTP(S) URLs", () => {
    expect(() => assertQrUrl("https://example.com/path?q=1")).not.toThrow();
    expect(() => assertQrUrl("javascript:alert(1)")).toThrowError(/http/i);
    expect(() => assertQrUrl("example.com")).toThrowError(/http/i);
  });

  it("checks WCAG contrast on both gradient stops and validates bounded settings", () => {
    expect(qrContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 4);
    expect(() => assertQrDesignerSettings(qrDesignerPresets.classic)).not.toThrow();
    expect(() =>
      assertQrDesignerSettings({
        ...qrDesignerPresets.classic,
        size: qrDesignerLimits.sizeMax + 1,
      }),
    ).toThrowError(/settings/i);
    expect(() =>
      assertQrDesignerSettings({
        ...qrDesignerPresets.classic,
        gradient: true,
        gradientEnd: "#aaaaaa",
      }),
    ).toThrowError(/contrast/i);
    expect(() =>
      assertQrDesignerSettings({
        ...qrDesignerPresets.classic,
        background: "#000000",
        foreground: "#ff3000",
        gradientEnd: "#008c00",
        gradient: true,
      }),
    ).toThrowError(/contrast/i);
  });

  it("accepts supported logo metadata and rejects spoofed or oversized types", () => {
    expect(() =>
      assertQrLogoMetadata({ name: "logo.png", size: 1024, type: "image/png" }),
    ).not.toThrow();
    expect(() =>
      assertQrLogoMetadata({ name: "logo.svg", size: 1024, type: "image/svg+xml" }),
    ).toThrowError(/PNG or JPEG/i);
    expect(() =>
      assertQrLogoMetadata({
        name: "logo.png",
        size: qrDesignerLimits.logoFileBytes + 1,
        type: "image/png",
      }),
    ).toThrowError(/1 MiB/i);
  });
});
