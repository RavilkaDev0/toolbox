import {
  assertPasswordGeneratorOptions,
  type PasswordGeneratorOptions,
  passwordGeneratorLimits,
} from "@toolbox/core";
import { z } from "zod";

export const passwordGeneratorOptionsSchema = z
  .object({
    length: z
      .number()
      .int()
      .min(passwordGeneratorLimits.minimumLength)
      .max(passwordGeneratorLimits.maximumLength),
    uppercase: z.boolean(),
    lowercase: z.boolean(),
    digits: z.boolean(),
    symbols: z.boolean(),
    avoidAmbiguous: z.boolean(),
  })
  .strict()
  .superRefine((options, context) => {
    try {
      assertPasswordGeneratorOptions(options);
    } catch {
      context.addIssue({ code: "custom", message: "Invalid password generator options." });
    }
  });

export type PasswordGeneratorOptionsInput = PasswordGeneratorOptions;
