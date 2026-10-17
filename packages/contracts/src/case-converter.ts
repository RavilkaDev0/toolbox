import { caseConverterLimits, caseConverterLocales, caseConverterModes } from "@toolbox/core";
import { z } from "zod";

export const caseConverterTextSchema = z.string().max(caseConverterLimits.maximumInputCodeUnits);
export const caseConverterModeSchema = z.enum(caseConverterModes);
export const caseConverterLocaleSchema = z.enum(caseConverterLocales);
export const caseConverterSettingsSchema = z
  .object({
    text: caseConverterTextSchema,
    mode: caseConverterModeSchema,
    locale: caseConverterLocaleSchema,
  })
  .strict();

export type CaseConverterSettingsInput = z.infer<typeof caseConverterSettingsSchema>;
