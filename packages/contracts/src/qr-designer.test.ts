import { describe, expect, it } from "vitest";
import {
  qrDesignerLogoSchema,
  qrDesignerPayloadSchema,
  qrDesignerSettingsSchema,
} from "./index.js";
import { qrDesignerSettingsDefaults } from "./qr-designer.js";

describe("QR designer contracts", () => {
  it("accepts bounded payloads, strict settings and raster logo metadata", () => {
    expect(qrDesignerPayloadSchema.safeParse({ mode: "text", payload: "hello" }).success).toBe(
      true,
    );
    expect(qrDesignerSettingsSchema.safeParse(qrDesignerSettingsDefaults).success).toBe(true);
    expect(
      qrDesignerLogoSchema.safeParse({ name: "logo.png", size: 128, type: "image/png" }).success,
    ).toBe(true);
  });

  it("rejects extra keys, SVG logos and unsupported content modes", () => {
    expect(qrDesignerPayloadSchema.safeParse({ mode: "html", payload: "<script>" }).success).toBe(
      false,
    );
    expect(
      qrDesignerSettingsSchema.safeParse({ ...qrDesignerSettingsDefaults, color: "red" }).success,
    ).toBe(false);
    expect(
      qrDesignerLogoSchema.safeParse({ name: "logo.svg", size: 128, type: "image/svg+xml" })
        .success,
    ).toBe(false);
    expect(
      qrDesignerPayloadSchema.safeParse({ mode: "url", payload: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(
      qrDesignerSettingsSchema.safeParse({
        ...qrDesignerSettingsDefaults,
        gradient: true,
        background: "#000000",
        foreground: "#ff3000",
        gradientEnd: "#008c00",
      }).success,
    ).toBe(false);
  });
});
