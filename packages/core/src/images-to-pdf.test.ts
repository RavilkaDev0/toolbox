import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertImageDimensions,
  assertImageSelection,
  defaultImagePdfOptions,
  imagePageLayout,
  imagePdfLimits,
  inspectImage,
  moveImage,
} from "./images-to-pdf.js";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(resolve("apps/web/e2e/fixtures/images", name)));
describe("image PDF rules", () => {
  it("rejects hidden WebP dimension mismatch and duplicate JPEG frame headers", () => {
    const webp = fixture("transparent.webp");
    expect(inspectImage(webp)).toEqual({ kind: "webp", width: 120, height: 240 });
    const spoofed = webp.slice();
    spoofed.set([0, 0, 0], 24);
    expect(() => inspectImage(spoofed)).toThrow();
    const jpeg = fixture("landscape.jpg");
    const start = jpeg.findIndex((byte, index) => byte === 255 && jpeg[index + 1] === 192);
    expect(start).toBeGreaterThan(0);
    const length = new DataView(jpeg.buffer).getUint16(start + 2) + 2;
    const duplicate = new Uint8Array(jpeg.length + length);
    duplicate.set(jpeg.subarray(0, start + length));
    duplicate.set(jpeg.subarray(start, start + length), start + length);
    duplicate.set(jpeg.subarray(start + length), start + 2 * length);
    expect(() => inspectImage(duplicate)).toThrow();
  });
  it("accepts exact decoded bounds and rejects oversized or empty dimensions", () => {
    expect(() => assertImageDimensions(4000, 3000)).not.toThrow();
    expect(() => assertImageDimensions(8192, 1)).not.toThrow();
    for (const [width, height] of [
      [4001, 3000],
      [8193, 1],
      [0, 1],
      [1.5, 1],
    ])
      expect(() => assertImageDimensions(width ?? 0, height ?? 0)).toThrow();
  });
  it("fits and fills proportionally inside real A4 margins", () => {
    const fit = imagePageLayout(240, 120, defaultImagePdfOptions);
    expect(fit.pageWidth).toBeCloseTo(595.2756);
    expect(fit.pageHeight).toBeCloseTo(841.8898);
    expect(fit.width / fit.height).toBe(2);
    expect(fit.x).toBeCloseTo((10 * 72) / 25.4);
    const fill = imagePageLayout(240, 120, { ...defaultImagePdfOptions, placement: "fill" });
    expect(fill.width / fill.height).toBe(2);
    expect(fill.height).toBeCloseTo(fill.contentHeight);
    expect(fill.x).toBeLessThan(0);
  });
  it("uses Letter landscape and ignores inapplicable Auto options", () => {
    expect(
      imagePageLayout(100, 100, {
        ...defaultImagePdfOptions,
        pageSize: "letter",
        orientation: "landscape",
      }),
    ).toMatchObject({ pageWidth: 792, pageHeight: 612 });
    expect(
      imagePageLayout(240, 120, {
        ...defaultImagePdfOptions,
        pageSize: "auto",
        orientation: "landscape",
        placement: "fill",
        margin: 20,
      }),
    ).toMatchObject({ pageWidth: 180, pageHeight: 90, x: 0, y: 0, margin: 0 });
  });
  it("moves files without losing identity or mutating the source", () => {
    const files = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(moveImage(files, 2, 0)).toEqual([files[2], files[0], files[1]]);
    expect(moveImage(files, -1, 0)).toEqual(files);
    expect(moveImage(files, 0, 3)).toEqual(files);
    expect(files.map((f) => f.id)).toEqual([1, 2, 3]);
  });
  it("reads real JPEG, PNG and both WebP headers", () => {
    expect(inspectImage(fixture("landscape.jpg"))).toEqual({
      kind: "jpeg",
      width: 240,
      height: 120,
    });
    expect(inspectImage(fixture("transparent.png"))).toEqual({
      kind: "png",
      width: 120,
      height: 240,
    });
    for (const name of ["square.webp", "lossy.webp"])
      expect(inspectImage(fixture(name))).toEqual({ kind: "webp", width: 160, height: 160 });
  });
  it("rejects unsupported, animated, empty, damaged and excessive dimensions", () => {
    for (const bytes of [
      new Uint8Array(),
      new Uint8Array([71, 73, 70]),
      fixture("animated.webp"),
      fixture("damaged.png"),
      fixture("corrupt-pixels.png"),
      fixture("oversized.png"),
    ])
      expect(() => inspectImage(bytes)).toThrow();
  });
  it("enforces file count, per-file and aggregate bytes including exact boundaries", () => {
    const file = { name: "a.jpg", size: imagePdfLimits.fileBytes, type: "image/jpeg" };
    expect(() => assertImageSelection([file])).not.toThrow();
    for (const files of [
      [],
      [{ ...file, size: 0 }],
      [{ ...file, size: file.size + 1 }],
      Array(11).fill({ ...file, size: 1 }),
      Array(5).fill(file),
      [{ ...file, type: "image/gif" }],
      [{ ...file, name: "a".repeat(256) }],
    ])
      expect(() => assertImageSelection(files)).toThrow();
  });
});
