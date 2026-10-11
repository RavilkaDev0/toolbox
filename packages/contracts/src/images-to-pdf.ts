import { type ImagePdfOptions, imagePdfLimits } from "@toolbox/core";
import { z } from "zod";

export const imagePdfOptionsSchema: z.ZodType<ImagePdfOptions> = z
  .object({
    pageSize: z.enum(["auto", "a4", "letter"]),
    orientation: z.enum(["portrait", "landscape"]),
    margin: z.union([z.literal(0), z.literal(10), z.literal(20)]),
    placement: z.enum(["fit", "fill"]),
  })
  .strict();
export const imagePdfFileSchema = z
  .object({
    name: z.string().min(1).max(255),
    size: z.number().int().min(1).max(imagePdfLimits.fileBytes),
    type: z.enum(["", "image/jpeg", "image/png", "image/webp"]),
  })
  .strict();
