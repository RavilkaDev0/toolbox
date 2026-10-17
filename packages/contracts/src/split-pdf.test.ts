import { expect, it } from "vitest";
import { pdfSplitFileSchema, pdfSplitSettingsSchema } from "./split-pdf.js";

it("validates bounded static-PDF metadata and strict extraction settings", () => {
  expect(pdfSplitFileSchema.safeParse({ name: "x.pdf", size: 100, type: "" }).success).toBe(true);
  expect(
    pdfSplitFileSchema.safeParse({ name: "x.pdf", size: 9 * 1024 * 1024, type: "application/pdf" })
      .success,
  ).toBe(false);
  expect(pdfSplitSettingsSchema.safeParse({ mode: "extract", pages: [1, 3] }).success).toBe(true);
  for (const input of [
    { mode: "zip", pages: [1] },
    { mode: "extract", pages: [] },
    { mode: "split", pages: [1, 1] },
    { mode: "split", pages: [101] },
    { mode: "extract", pages: [1], name: "hostile" },
  ])
    expect(pdfSplitSettingsSchema.safeParse(input).success).toBe(false);
});
