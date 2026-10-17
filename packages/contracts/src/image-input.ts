import { imageInputMimeTypes, imageProcessingLimits } from "@toolbox/core";
import { z } from "zod";

export const imageFileSchema = z
  .object({
    name: z.string().min(1).max(255),
    size: z.number().int().min(1).max(imageProcessingLimits.fileBytes),
    type: z.enum(["", ...imageInputMimeTypes]),
  })
  .strict();
