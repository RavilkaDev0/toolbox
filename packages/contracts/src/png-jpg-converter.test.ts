import { describe, expect, it } from "vitest";
import { pngJpgConverterFilesSchema, pngJpgConverterSettingsSchema } from "./png-jpg-converter.js";

describe("PNG/JPG converter contracts", () => {
  it("validates bounded batches and explicit JPEG background settings", () => {
    expect(
      pngJpgConverterFilesSchema.safeParse([
        { name: "scan.png", size: 256, type: "image/png" },
        { name: "photo.jpeg", size: 512, type: "image/jpeg" },
      ]).success,
    ).toBe(true);
    expect(
      pngJpgConverterSettingsSchema.safeParse({ quality: 85, backgroundColor: "#ffffff" }).success,
    ).toBe(true);
  });

  it("rejects misleading or unsupported file metadata and oversized batches", () => {
    expect(
      pngJpgConverterFilesSchema.safeParse([{ name: "scan.webp", size: 1, type: "image/webp" }])
        .success,
    ).toBe(false);
    expect(
      pngJpgConverterFilesSchema.safeParse([
        { name: "scan.png", size: 1, type: "image/png", path: "private" },
      ]).success,
    ).toBe(false);
    expect(
      pngJpgConverterFilesSchema.safeParse(
        Array.from({ length: 11 }, (_, index) => ({
          name: `scan-${index}.png`,
          size: 1,
          type: "image/png",
        })),
      ).success,
    ).toBe(false);
    expect(
      pngJpgConverterFilesSchema.safeParse([
        { name: "a.png", size: 16 * 1024 * 1024, type: "image/png" },
        { name: "b.png", size: 16 * 1024 * 1024 + 1, type: "image/png" },
      ]).success,
    ).toBe(false);
  });

  it("rejects invalid JPEG quality and non-hex background values", () => {
    for (const settings of [
      { quality: 9, backgroundColor: "#ffffff" },
      { quality: 96, backgroundColor: "#ffffff" },
      { quality: 80.5, backgroundColor: "#ffffff" },
      { quality: 80, backgroundColor: "black" },
      { quality: 80, backgroundColor: "#fff" },
    ])
      expect(pngJpgConverterSettingsSchema.safeParse(settings).success).toBe(false);
  });
});
