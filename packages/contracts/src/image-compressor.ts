import type { ImageCompressionOptions } from "@toolbox/core";
import { z } from "zod";
import { imageFileSchema } from "./image-input.js";

export const imageCompressorFileSchema = imageFileSchema;

export const imageCompressionOptionsSchema: z.ZodType<ImageCompressionOptions> = z
  .object({
    format: z.enum(["jpeg", "png", "webp"]),
    quality: z.number().int().min(10).max(95),
  })
  .strict();
