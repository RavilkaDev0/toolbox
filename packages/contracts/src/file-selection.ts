import { z } from "zod";

export const fileSelectionLimitsSchema = z.object({
  maxFiles: z.number().int().min(1).max(100),
  maxBytes: z
    .number()
    .int()
    .min(1)
    .max(100 * 1024 * 1024),
});
export const fileMetadataSchema = z.object({
  name: z.string().min(1).max(255),
  size: z
    .number()
    .int()
    .min(1)
    .max(100 * 1024 * 1024),
});
