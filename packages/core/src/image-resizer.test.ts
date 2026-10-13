import { describe, expect, it } from "vitest";
import {
  assertImageResizerSelection,
  calculateImageResizeDimensions,
  ImageResizerError,
  imageResizerLimits,
} from "./image-resizer.js";

describe("image resizer rules", () => {
  it("rounds a locked ratio in either edited dimension", () => {
    expect(
      calculateImageResizeDimensions(
        { width: 240, height: 120 },
        {
          mode: "pixels",
          width: 101,
          height: 120,
          lockAspectRatio: true,
          editedDimension: "width",
        },
      ),
    ).toEqual({ width: 101, height: 51 });
    expect(
      calculateImageResizeDimensions(
        { width: 240, height: 120 },
        {
          mode: "pixels",
          width: 240,
          height: 61,
          lockAspectRatio: true,
          editedDimension: "height",
        },
      ),
    ).toEqual({ width: 122, height: 61 });
  });

  it("allows explicit unlocked dimensions and integer percentage scaling", () => {
    expect(
      calculateImageResizeDimensions(
        { width: 240, height: 120 },
        { mode: "pixels", width: 90, height: 40, lockAspectRatio: false, editedDimension: "width" },
      ),
    ).toEqual({ width: 90, height: 40 });
    expect(
      calculateImageResizeDimensions(
        { width: 41, height: 81 },
        { mode: "percentage", percentage: 50 },
      ),
    ).toEqual({ width: 21, height: 41 });
  });

  it("rejects empty, fractional, over-side and over-pixel dimensions before canvas allocation", () => {
    expect(() =>
      calculateImageResizeDimensions(
        { width: 240, height: 120 },
        { mode: "pixels", width: 0, height: 20, lockAspectRatio: false, editedDimension: "width" },
      ),
    ).toThrowError(ImageResizerError);
    expect(() =>
      calculateImageResizeDimensions(
        { width: 240, height: 120 },
        {
          mode: "pixels",
          width: 10.5,
          height: 20,
          lockAspectRatio: false,
          editedDimension: "width",
        },
      ),
    ).toThrowError(/whole pixel dimensions/);
    expect(() =>
      calculateImageResizeDimensions(
        { width: 240, height: 120 },
        {
          mode: "pixels",
          width: imageResizerLimits.side + 1,
          height: 1,
          lockAspectRatio: false,
          editedDimension: "width",
        },
      ),
    ).toThrowError(/8,192 pixel/);
    expect(() =>
      calculateImageResizeDimensions(
        { width: 240, height: 120 },
        {
          mode: "pixels",
          width: 4000,
          height: 2001,
          lockAspectRatio: false,
          editedDimension: "width",
        },
      ),
    ).toThrowError(/8 megapixel/);
    expect(() =>
      calculateImageResizeDimensions(
        { width: 0, height: 120 },
        { mode: "percentage", percentage: 50 },
      ),
    ).toThrowError();
  });

  it("bounds percentages and accepts one bounded image only", () => {
    expect(() =>
      calculateImageResizeDimensions(
        { width: 100, height: 100 },
        { mode: "percentage", percentage: 0 },
      ),
    ).toThrowError();
    expect(() =>
      calculateImageResizeDimensions(
        { width: 100, height: 100 },
        { mode: "percentage", percentage: 401 },
      ),
    ).toThrowError();
    expect(() =>
      calculateImageResizeDimensions(
        { width: 100, height: 100 },
        { mode: "percentage", percentage: 12.5 },
      ),
    ).toThrowError();
    const file = { name: "photo.webp", size: 100, type: "image/webp" };
    expect(() => assertImageResizerSelection([file])).not.toThrow();
    expect(() => assertImageResizerSelection([])).toThrowError(/empty or damaged/);
    expect(() => assertImageResizerSelection([file, file])).toThrowError(/limit/);
    expect(() => assertImageResizerSelection([{ ...file, type: "image/gif" }])).toThrowError(
      /static JPEG/,
    );
    expect(() =>
      assertImageResizerSelection([{ ...file, size: imageResizerLimits.fileBytes + 1 }]),
    ).toThrowError(/16 MiB/);
  });
});
