import { pdfToPngDpis, pdfToPngLimits } from "@toolbox/core";
import { z } from "zod";

export { staticPdfFileSchema as pdfToPngFileSchema } from "./static-pdf.js";

export const pdfToPngSettingsSchema = z
  .object({
    mode: z.enum(["all", "selected"]),
    pages: z.array(z.number().int().min(1).max(pdfToPngLimits.pages)).max(pdfToPngLimits.pages),
    dpi: z.union([z.literal(pdfToPngDpis[0]), z.literal(pdfToPngDpis[1])]),
    background: z.enum(["transparent", "white"]),
  })
  .strict()
  .superRefine(({ mode, pages }, context) => {
    if (mode === "all" && pages.length > 0)
      context.addIssue({
        code: "custom",
        message: "All-page settings must not include a page list.",
      });
    if (mode === "selected" && pages.length === 0)
      context.addIssue({ code: "custom", message: "Select at least one page." });
    if (pages.some((page, index) => index > 0 && page <= (pages[index - 1] ?? 0)))
      context.addIssue({
        code: "custom",
        message: "Selected pages must be unique and in source order.",
      });
  });

export type PdfToPngSettings = z.infer<typeof pdfToPngSettingsSchema>;
