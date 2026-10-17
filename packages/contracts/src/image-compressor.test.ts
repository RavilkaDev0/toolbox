import { describe, expect, it } from "vitest";
import { imageCompressionOptionsSchema, imageCompressorFileSchema } from "./image-compressor.js";

describe("image compressor contracts", () => {
  it("accepts bounded metadata and rejects invalid format/size", () => {
    expect(
      imageCompressorFileSchema.safeParse({ name: "photo.jpg", size: 10, type: "" }).success,
    ).toBe(true);
    expect(
      imageCompressorFileSchema.safeParse({ name: "photo.gif", size: 10, type: "image/gif" })
        .success,
    ).toBe(false);
    expect(
      imageCompressorFileSchema.safeParse({ name: "photo.jpg", size: 0, type: "image/jpeg" })
        .success,
    ).toBe(false);
  });

  it("strictly bounds format and lossy quality", () => {
    expect(imageCompressionOptionsSchema.safeParse({ format: "jpeg", quality: 80 }).success).toBe(
      true,
    );
    expect(imageCompressionOptionsSchema.safeParse({ format: "png", quality: 100 }).success).toBe(
      false,
    );
    expect(imageCompressionOptionsSchema.safeParse({ format: "gif", quality: 80 }).success).toBe(
      false,
    );
    expect(
      imageCompressionOptionsSchema.safeParse({ format: "webp", quality: 80, extra: true }).success,
    ).toBe(false);
  });
});
