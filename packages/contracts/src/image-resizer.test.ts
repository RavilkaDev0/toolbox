import { describe, expect, it } from "vitest";
import { imageFileSchema } from "./image-input.js";
import { imageResizeOptionsSchema } from "./image-resizer.js";

describe("image resizer contracts", () => {
  it("accepts one bounded supported image metadata record", () => {
    expect(
      imageFileSchema.safeParse({ name: "photo.webp", size: 1024, type: "image/webp" }).success,
    ).toBe(true);
    expect(imageFileSchema.safeParse({ name: "", size: 1, type: "image/jpeg" }).success).toBe(
      false,
    );
    expect(
      imageFileSchema.safeParse({ name: "photo.gif", size: 1, type: "image/gif" }).success,
    ).toBe(false);
  });

  it("strictly validates pixel, ratio and percentage resize settings", () => {
    expect(
      imageResizeOptionsSchema.safeParse({
        mode: "pixels",
        width: 120,
        height: 60,
        lockAspectRatio: true,
        editedDimension: "width",
        format: "webp",
        quality: 80,
      }).success,
    ).toBe(true);
    expect(
      imageResizeOptionsSchema.safeParse({
        mode: "percentage",
        percentage: 400,
        format: "png",
        quality: 80,
      }).success,
    ).toBe(true);
    expect(
      imageResizeOptionsSchema.safeParse({
        mode: "percentage",
        percentage: 401,
        format: "png",
        quality: 80,
      }).success,
    ).toBe(false);
    expect(
      imageResizeOptionsSchema.safeParse({
        mode: "pixels",
        width: 120,
        height: 60,
        lockAspectRatio: true,
        editedDimension: "width",
        format: "gif",
        quality: 100,
      }).success,
    ).toBe(false);
    expect(
      imageResizeOptionsSchema.safeParse({
        mode: "pixels",
        width: 120,
        height: 60,
        lockAspectRatio: true,
        editedDimension: "width",
        format: "jpeg",
        quality: 80,
        extra: true,
      }).success,
    ).toBe(false);
  });
});
