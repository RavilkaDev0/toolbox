import { describe, expect, it } from "vitest";
import { PdfProcessingError } from "./merge-pdf.js";
import {
  assertPdfToPngOutputSize,
  assertPdfToPngPages,
  pdfToPngDimensions,
  pdfToPngLimits,
} from "./pdf-to-png.js";

describe("PDF to PNG limits and sizing", () => {
  it("converts PDF points to output pixels and accounts for page rotation", () => {
    expect(pdfToPngDimensions(612, 792, 0, 96)).toEqual({
      width: 816,
      height: 1056,
      pixels: 861696,
    });
    expect(pdfToPngDimensions(612, 792, 90, 96)).toEqual({
      width: 1056,
      height: 816,
      pixels: 861696,
    });
    expect(pdfToPngDimensions(595, 842, 270, 192)).toEqual({
      width: 2246,
      height: 1587,
      pixels: 3564402,
    });
    expect(pdfToPngDimensions(612.1, 792.1, 0, 96).width).toBe(817);
  });

  it("rejects invalid geometry and dimensions outside the memory bounds", () => {
    expect(() => pdfToPngDimensions(0, 792, 0, 96)).toThrow(PdfProcessingError);
    expect(() => pdfToPngDimensions(612, 792, 45, 96)).toThrow(PdfProcessingError);
    expect(() => pdfToPngDimensions(14400, 792, 0, 96)).toThrow(
      expect.objectContaining({ code: "RESOURCE_LIMIT" }),
    );
  });

  it("accepts ordered in-range page selections and rejects duplicates, unsorted and oversized selections", () => {
    expect(() => assertPdfToPngPages([1, 3, 5], 5)).not.toThrow();
    for (const pages of [[], [0], [6], [2, 1], [1, 1]])
      expect(() => assertPdfToPngPages(pages, 5)).toThrow(PdfProcessingError);
    expect(() => assertPdfToPngPages([1], pdfToPngLimits.pages + 1)).toThrow(PdfProcessingError);
  });

  it("enforces single PNG and multi-page ZIP output ceilings", () => {
    expect(() => assertPdfToPngOutputSize(pdfToPngLimits.imageBytes, false)).not.toThrow();
    expect(() => assertPdfToPngOutputSize(pdfToPngLimits.imageBytes + 1, false)).toThrow(
      PdfProcessingError,
    );
    expect(() => assertPdfToPngOutputSize(pdfToPngLimits.archiveBytes, true)).not.toThrow();
    expect(() => assertPdfToPngOutputSize(pdfToPngLimits.archiveBytes + 1, true)).toThrow(
      PdfProcessingError,
    );
  });
});
