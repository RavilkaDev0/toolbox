import type { ImageResizeOptions } from "@toolbox/core";
import { imageResizerLimits } from "@toolbox/core";
import { z } from "zod";

const imageResizeOutputSchema = {
  format: z.enum(["jpeg", "png", "webp"]),
  quality: z.number().int().min(10).max(95),
};

export const imageResizeOptionsSchema: z.ZodType<ImageResizeOptions> = z.discriminatedUnion(
  "mode",
  [
    z
      .object({
        mode: z.literal("pixels"),
        width: z.number().int().min(1).max(imageResizerLimits.side),
        height: z.number().int().min(1).max(imageResizerLimits.side),
        lockAspectRatio: z.boolean(),
        editedDimension: z.enum(["width", "height"]),
        ...imageResizeOutputSchema,
      })
      .strict(),
    z
      .object({
        mode: z.literal("percentage"),
        percentage: z.number().int().min(1).max(imageResizerLimits.maxPercent),
        ...imageResizeOutputSchema,
      })
      .strict(),
  ],
);
