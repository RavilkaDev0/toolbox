import { type ImageCompressionOptions, imageCompressorLimits } from "@toolbox/core";
import { z } from "zod";

export const imageCompressorFileSchema = z
  .object({
    name: z.string().min(1).max(255),
    size: z.number().int().min(1).max(imageCompressorLimits.fileBytes),
    type: z.enum(["", "image/jpeg", "image/png", "image/webp"]),
  })
  .strict();

export const imageCompressionOptionsSchema: z.ZodType<ImageCompressionOptions> = z
  .object({
    format: z.enum(["jpeg", "png", "webp"]),
    quality: z.number().int().min(10).max(95),
  })
  .strict();
