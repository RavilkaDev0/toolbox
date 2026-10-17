import { pdfToPngFileSchema, pdfToPngSettingsSchema } from "@toolbox/contracts";
import { pdfToPngLimits } from "@toolbox/core";
import { describe, expect, it } from "vitest";

describe("PDF to PNG contracts", () => {
  it("accepts All or an ordered, bounded page selection and supported render settings", () => {
    expect(
      pdfToPngSettingsSchema.safeParse({
        mode: "all",
        pages: [],
        dpi: 96,
        background: "transparent",
      }).success,
    ).toBe(true);
    expect(
      pdfToPngSettingsSchema.safeParse({
        mode: "selected",
        pages: [1, 3, 5],
        dpi: 192,
        background: "white",
      }).success,
    ).toBe(true);
    for (const pages of [[], [1, 1], [3, 2], [pdfToPngLimits.pages + 1]])
      expect(
        pdfToPngSettingsSchema.safeParse({
          mode: "selected",
          pages,
          dpi: 96,
          background: "transparent",
        }).success,
      ).toBe(false);
  });

  it("rejects malformed metadata and input types while allowing browsers with an empty PDF MIME", () => {
    expect(pdfToPngFileSchema.safeParse({ name: "sample.pdf", size: 1, type: "" }).success).toBe(
      true,
    );
    expect(
      pdfToPngFileSchema.safeParse({
        name: "sample.pdf",
        size: pdfToPngLimits.fileBytes + 1,
        type: "application/pdf",
      }).success,
    ).toBe(false);
    expect(
      pdfToPngFileSchema.safeParse({ name: "sample.jpg", size: 10, type: "image/jpeg" }).success,
    ).toBe(false);
  });
});
