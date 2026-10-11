import { describe, expect, it } from "vitest";
import { assertPdfRotateOutputSize, normalizePdfRotation, pdfRotateLimits } from "./rotate-pdf.js";

describe("Rotate PDF rules", () => {
  it("applies left, right and 180-degree turns relative to every valid starting angle", () => {
    const cases = [
      [0, -90, 270],
      [0, 90, 90],
      [0, 180, 180],
      [90, -90, 0],
      [90, 90, 180],
      [90, 180, 270],
      [180, -90, 90],
      [180, 90, 270],
      [180, 180, 0],
      [270, -90, 180],
      [270, 90, 0],
      [270, 180, 90],
    ] as const;
    for (const [current, delta, expected] of cases)
      expect(normalizePdfRotation(current, delta)).toBe(expected);
  });

  it("supports repeated operations and refuses malformed angles", () => {
    expect(normalizePdfRotation(normalizePdfRotation(90, 90), 90)).toBe(270);
    for (const [current, delta] of [
      [45, 90],
      [-90, 90],
      [0, 45],
      [0, 0],
      [0, 360],
    ])
      expect(() => normalizePdfRotation(current ?? 0, delta ?? 0)).toThrow(RangeError);
  });

  it("uses the existing static-PDF bounds for rotation", () => {
    expect(pdfRotateLimits).toEqual({
      fileBytes: 8 * 1024 * 1024,
      pages: 100,
      outputBytes: 8 * 1024 * 1024,
      jobMilliseconds: 45_000,
    });
    expect(() => assertPdfRotateOutputSize(1)).not.toThrow();
    expect(() => assertPdfRotateOutputSize(pdfRotateLimits.outputBytes)).not.toThrow();
    for (const size of [
      0,
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      pdfRotateLimits.outputBytes + 1,
    ])
      expect(() => assertPdfRotateOutputSize(size)).toThrowError();
  });
});
