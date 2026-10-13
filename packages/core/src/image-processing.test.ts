import { describe, expect, it } from "vitest";
import { assertImageFileExtension, createImageConvertedNames } from "./image-processing.js";

function expectCode(action: () => void, code: string) {
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected ${code} error`);
}

describe("shared image filename rules", () => {
  it("accepts the extension corresponding to content while allowing extensionless names", () => {
    expect(() => assertImageFileExtension("photo.JPEG", "jpeg")).not.toThrow();
    expect(() => assertImageFileExtension("photo.png", "png")).not.toThrow();
    expect(() => assertImageFileExtension("photo.webp", "webp")).not.toThrow();
    expect(() => assertImageFileExtension("photo", "jpeg")).not.toThrow();
    expectCode(() => assertImageFileExtension("photo.webp", "png"), "UNSUPPORTED_FORMAT");
  });

  it("creates safe and collision-free converted names", () => {
    expect(
      createImageConvertedNames(
        [{ name: "../portrait.png" }, { name: "portrait.PNG" }, { name: "..." }],
        ["webp", "webp", "png"],
      ),
    ).toEqual(["portrait-converted.webp", "portrait-converted-2.webp", "image-03-converted.png"]);
  });
});
