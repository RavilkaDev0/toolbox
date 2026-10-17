import { pdfRotateLimits } from "@toolbox/core";
import { z } from "zod";

export { staticPdfFileSchema as pdfRotateFileSchema } from "./static-pdf.js";

export const pdfRotateSettingsSchema = z
  .object({
    pages: z
      .array(z.number().int().min(1).max(pdfRotateLimits.pages))
      .min(1)
      .max(pdfRotateLimits.pages),
    delta: z.union([z.literal(-90), z.literal(90), z.literal(180)]),
  })
  .strict()
  .superRefine(({ pages }, context) => {
    if (new Set(pages).size !== pages.length)
      context.addIssue({ code: "custom", message: "Duplicate pages are not allowed." });
    for (let index = 1; index < pages.length; index++) {
      if ((pages[index] ?? 0) <= (pages[index - 1] ?? 0))
        context.addIssue({ code: "custom", message: "Pages must be in source order." });
    }
  });
