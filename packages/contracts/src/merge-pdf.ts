import { pdfMergeLimits } from "@toolbox/core";
import { z } from "zod";

export const pdfMergeFileSchema = z
  .object({
    name: z.string().min(1).max(255),
    size: z.number().int().min(1).max(pdfMergeLimits.fileBytes),
    type: z.enum(["", "application/pdf"]),
  })
  .strict();
