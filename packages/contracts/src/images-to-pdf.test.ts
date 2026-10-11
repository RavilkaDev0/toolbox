import { defaultImagePdfOptions } from "@toolbox/core";
import { expect, it } from "vitest";
import { imagePdfOptionsSchema } from "./images-to-pdf.js";

it("accepts only bounded, known PDF settings", () => {
  expect(imagePdfOptionsSchema.parse(defaultImagePdfOptions)).toEqual(defaultImagePdfOptions);
  for (const options of [
    { ...defaultImagePdfOptions, margin: -1 },
    { ...defaultImagePdfOptions, margin: 100 },
    { ...defaultImagePdfOptions, pageSize: "a3" },
    { ...defaultImagePdfOptions, placement: "stretch" },
    { ...defaultImagePdfOptions, unknown: true },
  ])
    expect(imagePdfOptionsSchema.safeParse(options).success).toBe(false);
});
