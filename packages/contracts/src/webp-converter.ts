import { webpConverterLimits } from "@toolbox/core";
import { z } from "zod";

export const webpConverterFileSchema = z
  .object({
    name: z.string().min(1).max(255),
    size: z.number().int().min(1).max(webpConverterLimits.fileBytes),
    type: z.enum(["", "image/png", "image/jpeg"]),
  })
  .strict();

export const webpConverterFilesSchema = z
  .array(webpConverterFileSchema)
  .min(1)
  .max(webpConverterLimits.files)
  .superRefine((files, context) => {
    if (files.reduce((total, file) => total + file.size, 0) > webpConverterLimits.totalInputBytes)
      context.addIssue({ code: "custom", message: "Total image size is over 32 MiB." });
  });

export const webpConverterSettingsSchema = z
  .object({ quality: z.number().int().min(10).max(95) })
  .strict();
