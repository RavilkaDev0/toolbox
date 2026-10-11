import { expect, it } from "vitest";
import { pdfRotateFileSchema, pdfRotateSettingsSchema } from "./rotate-pdf.js";

it("validates bounded static PDF metadata and strict rotation settings", () => {
  expect(pdfRotateFileSchema.safeParse({ name: "x.pdf", size: 100, type: "" }).success).toBe(true);
  expect(
    pdfRotateFileSchema.safeParse({ name: "x.pdf", size: 9 * 1024 * 1024, type: "application/pdf" })
      .success,
  ).toBe(false);
  expect(pdfRotateSettingsSchema.safeParse({ pages: [1, 3], delta: 90 }).success).toBe(true);
  for (const input of [
    { pages: [], delta: 90 },
    { pages: [1, 1], delta: -90 },
    { pages: [2, 1], delta: 180 },
    { pages: [101], delta: 90 },
    { pages: [1], delta: 45 },
    { pages: [1], delta: 90, mode: "all" },
  ])
    expect(pdfRotateSettingsSchema.safeParse(input).success).toBe(false);
});
