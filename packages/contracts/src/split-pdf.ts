import { pdfSplitLimits } from "@toolbox/core";
import { z } from "zod";

export { staticPdfFileSchema as pdfSplitFileSchema } from "./static-pdf.js";

export const pdfSplitSettingsSchema = z
  .object({
    mode: z.enum(["extract", "split"]),
    pages: z
      .array(z.number().int().min(1).max(pdfSplitLimits.pages))
      .min(1)
      .max(pdfSplitLimits.pages),
  })
  .strict()
  .superRefine(({ pages }, context) => {
    if (new Set(pages).size !== pages.length)
      context.addIssue({ code: "custom", message: "Duplicate pages are not allowed." });
  });
