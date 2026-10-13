import { describe, expect, it } from "vitest";
import { webpConverterFilesSchema, webpConverterSettingsSchema } from "./webp-converter.js";

describe("WebP converter contracts", () => {
  it("accepts bounded JPEG/PNG batches and lossy encoder quality", () => {
    expect(
      webpConverterFilesSchema.safeParse([
        { name: "photo.jpg", size: 256, type: "image/jpeg" },
        { name: "logo.png", size: 512, type: "image/png" },
      ]).success,
    ).toBe(true);
    expect(webpConverterSettingsSchema.safeParse({ quality: 80 }).success).toBe(true);
  });

  it("rejects unknown fields, WebP as input, extra files and unsafe quality", () => {
    expect(
      webpConverterFilesSchema.safeParse([{ name: "source.webp", size: 1, type: "image/webp" }])
        .success,
    ).toBe(false);
    expect(
      webpConverterFilesSchema.safeParse([
        { name: "photo.jpg", size: 1, type: "image/jpeg", path: "private" },
      ]).success,
    ).toBe(false);
    expect(
      webpConverterFilesSchema.safeParse([
        { name: "large.jpg", size: 16 * 1024 * 1024 + 1, type: "image/jpeg" },
      ]).success,
    ).toBe(false);
    expect(
      webpConverterFilesSchema.safeParse(
        Array.from({ length: 11 }, (_, index) => ({
          name: `image-${index}.png`,
          size: 1,
          type: "image/png",
        })),
      ).success,
    ).toBe(false);
    expect(webpConverterSettingsSchema.safeParse({ quality: 96 }).success).toBe(false);
    expect(webpConverterSettingsSchema.safeParse({ quality: 80, lossless: true }).success).toBe(
      false,
    );
  });
});
