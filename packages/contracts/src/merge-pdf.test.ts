import { expect, it } from "vitest";
import { pdfMergeFileSchema } from "./merge-pdf.js";

it("accepts bounded PDF metadata and rejects additional/hostile properties", () => {
  const file = { name: "synthetic.pdf", size: 1024, type: "application/pdf" };
  expect(pdfMergeFileSchema.safeParse(file).success).toBe(true);
  for (const input of [
    { ...file, size: 0 },
    { ...file, size: 9 * 1024 * 1024 },
    { ...file, type: "image/png" },
    { ...file, name: "" },
    { ...file, untrusted: true },
  ])
    expect(pdfMergeFileSchema.safeParse(input).success).toBe(false);
});
