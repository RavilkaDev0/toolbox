import { describe, expect, it } from "vitest";
import {
  assertWebpConverterDimensions,
  assertWebpConverterSelection,
  createWebpConverterOutputNames,
  webpConverterLimits,
} from "./webp-converter.js";

function expectCode(action: () => void, code: string) {
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected ${code} error`);
}

describe("WebP converter rules", () => {
  it("accepts bounded JPEG/PNG batches and rejects empty, unsupported and oversized selections", () => {
    expect(() =>
      assertWebpConverterSelection([
        { name: "photo.jpg", size: 120, type: "image/jpeg" },
        { name: "logo.png", size: 240, type: "image/png" },
      ]),
    ).not.toThrow();
    expectCode(() => assertWebpConverterSelection([]), "INVALID_IMAGE");
    expectCode(
      () => assertWebpConverterSelection([{ name: "empty.png", size: 0, type: "image/png" }]),
      "INVALID_IMAGE",
    );
    expectCode(
      () => assertWebpConverterSelection([{ name: "source.webp", size: 10, type: "image/webp" }]),
      "UNSUPPORTED_FORMAT",
    );
    expectCode(
      () =>
        assertWebpConverterSelection([
          { name: "a.png", size: webpConverterLimits.fileBytes, type: "image/png" },
          { name: "b.png", size: webpConverterLimits.fileBytes, type: "image/png" },
          { name: "c.png", size: 1, type: "image/png" },
        ]),
      "LIMIT_EXCEEDED",
    );
    expectCode(
      () =>
        assertWebpConverterSelection([
          { name: "large.png", size: webpConverterLimits.fileBytes + 1, type: "image/png" },
        ]),
      "LIMIT_EXCEEDED",
    );
    expectCode(
      () =>
        assertWebpConverterSelection(
          Array.from({ length: 11 }, (_, index) => ({
            name: `image-${index}.jpg`,
            size: 1,
            type: "image/jpeg",
          })),
        ),
      "LIMIT_EXCEEDED",
    );
  });

  it("bounds decoded pixels and generates safe WebP output names in selection order", () => {
    expectCode(() => assertWebpConverterDimensions(8193, 1), "LIMIT_EXCEEDED");
    expect(createWebpConverterOutputNames([{ name: "../art.png" }, { name: "art.jpg" }])).toEqual([
      "art-converted.webp",
      "art-converted-2.webp",
    ]);
  });
});
