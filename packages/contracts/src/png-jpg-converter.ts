import { pngJpgConverterLimits } from "@toolbox/core";
import { z } from "zod";

export const pngJpgConverterFileSchema = z
  .object({
    name: z.string().min(1).max(255),
    size: z.number().int().min(1).max(pngJpgConverterLimits.fileBytes),
    type: z.enum(["", "image/png", "image/jpeg"]),
  })
  .strict();

export const pngJpgConverterFilesSchema = z
  .array(pngJpgConverterFileSchema)
  .min(1)
  .max(pngJpgConverterLimits.files)
  .superRefine((files, context) => {
    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalBytes > pngJpgConverterLimits.totalInputBytes)
      context.addIssue({ code: "custom", message: "Total image size is over 32 MiB." });
  });

export const pngJpgConverterSettingsSchema = z
  .object({
    quality: z.number().int().min(10).max(95),
    backgroundColor: z.string().regex(/^#[\da-f]{6}$/i),
  })
  .strict();
