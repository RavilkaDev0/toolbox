import { describe, expect, it } from "vitest";
import {
  assertPngJpgConverterDimensions,
  assertPngJpgConverterSelection,
  assertPngJpgFileExtension,
  createPngJpgOutputNames,
  PngJpgConverterError,
  pngJpgConverterLimits,
  pngJpgOutputFormat,
} from "./png-jpg-converter.js";

describe("PNG/JPG converter rules", () => {
  it("accepts a bounded PNG/JPEG batch and calculates the opposite output format", () => {
    assertPngJpgConverterSelection([
      { name: "scan.png", size: 128, type: "image/png" },
      { name: "photo.jpeg", size: 256, type: "image/jpeg" },
    ]);
    expect(pngJpgOutputFormat("png")).toBe("jpeg");
    expect(pngJpgOutputFormat("jpeg")).toBe("png");
  });

  it("rejects empty, unsupported, too many and over-budget file selections", () => {
    expect(() => assertPngJpgConverterSelection([])).toThrowError(PngJpgConverterError);
    expect(() =>
      assertPngJpgConverterSelection([{ name: "animated.webp", size: 1, type: "image/webp" }]),
    ).toThrowError(/Choose PNG or JPEG/);
    const png = { name: "photo.png", size: 1, type: "image/png" };
    expect(() =>
      assertPngJpgConverterSelection(
        Array.from({ length: pngJpgConverterLimits.files + 1 }, () => png),
      ),
    ).toThrowError(/up to 10/);
    expect(() =>
      assertPngJpgConverterSelection([{ ...png, size: pngJpgConverterLimits.fileBytes + 1 }]),
    ).toThrowError(/16 MiB/);
    expect(() =>
      assertPngJpgConverterSelection([
        { ...png, size: pngJpgConverterLimits.totalInputBytes / 2 },
        { ...png, size: pngJpgConverterLimits.totalInputBytes / 2 + 1 },
      ]),
    ).toThrowError(/32 MiB total/);
  });

  it("checks actual file extension against detected content and rejects unsafe dimensions", () => {
    expect(() => assertPngJpgFileExtension("scan.PNG", "png")).not.toThrow();
    expect(() => assertPngJpgFileExtension("scan.jpeg", "jpeg")).not.toThrow();
    expect(() => assertPngJpgFileExtension("scan.jpg", "png")).toThrowError(PngJpgConverterError);
    expect(() => assertPngJpgFileExtension("scan.gif", "jpeg")).toThrowError(PngJpgConverterError);
    expect(() => assertPngJpgConverterDimensions(120, 240)).not.toThrow();
    expect(() => assertPngJpgConverterDimensions(8193, 1)).toThrowError(/8,192 px per side/);
    expect(() => assertPngJpgConverterDimensions(4000, 2001)).toThrowError(/8 megapixels/);
  });

  it("creates safe, correctly suffixed and collision-free batch names", () => {
    expect(
      createPngJpgOutputNames(
        [
          { name: "../report.png" },
          { name: "report.png" },
          { name: "C:\\temp\\report.jpg" },
          { name: "<bad>|name.PNG" },
        ],
        ["jpeg", "jpeg", "png", "jpeg"],
      ),
    ).toEqual([
      "report-converted.jpg",
      "report-converted-2.jpg",
      "report-converted.png",
      "_bad__name-converted.jpg",
    ]);
  });
});
