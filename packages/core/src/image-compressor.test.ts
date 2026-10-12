import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertCompressorDimensions,
  assertCompressorFile,
  assertCompressorSelection,
  compressionExtension,
  compressionFormatForImage,
  compressionMimeType,
  imageCompressorLimits,
  inspectCompressorImage,
} from "./image-compressor.js";

const fixtureBytes = (name: string) =>
  new Uint8Array(readFileSync(resolve("apps/web/e2e/fixtures/images", name)));

describe("image compressor rules", () => {
  it("accepts a single bounded image and rejects invalid metadata", () => {
    assertCompressorFile({ name: "photo.jpg", size: 1, type: "image/jpeg" });
    expect(() => assertCompressorFile({ name: "empty.png", size: 0, type: "image/png" })).toThrow();
    expect(() =>
      assertCompressorFile({
        name: "large.jpg",
        size: imageCompressorLimits.fileBytes + 1,
        type: "image/jpeg",
      }),
    ).toThrow(/Choose one image/);
    expect(() => assertCompressorFile({ name: "photo.gif", size: 4, type: "image/gif" })).toThrow(
      /static JPEG, PNG or WebP/,
    );
  });

  it("requires exactly one file for a bounded compression operation", () => {
    const file = { name: "photo.jpg", size: 10, type: "image/jpeg" };
    expect(() => assertCompressorSelection([file])).not.toThrow();
    expect(() => assertCompressorSelection([])).toThrow(/empty or damaged/);
    expect(() => assertCompressorSelection([file, file])).toThrow(/Choose one image/);
  });

  it("bounds decoded image dimensions before browser decode", () => {
    assertCompressorDimensions(2000, 2000);
    expect(() => assertCompressorDimensions(8193, 1)).toThrow(/Choose one image/);
    expect(() => assertCompressorDimensions(4000, 2001)).toThrow(/Choose one image/);
    expect(() => assertCompressorDimensions(0, 4)).toThrow(/empty or damaged/);
  });

  it.each([
    ["landscape.jpg", "jpeg", "image/jpeg", "jpg"],
    ["transparent.png", "png", "image/png", "png"],
    ["square.webp", "webp", "image/webp", "webp"],
  ] as const)("inspects real %s signatures and format labels", (name, format, mime, extension) => {
    const info = inspectCompressorImage(fixtureBytes(name));
    expect(compressionFormatForImage(info)).toBe(format);
    expect(compressionMimeType(format)).toBe(mime);
    expect(compressionExtension(format)).toBe(extension);
  });

  it("rejects damaged and animated image content using its real signature", () => {
    expect(() => inspectCompressorImage(fixtureBytes("damaged.png"))).toThrow(/damaged/);
    expect(() => inspectCompressorImage(fixtureBytes("animated.webp"))).toThrow(
      /static JPEG, PNG or WebP/,
    );
  });
});
