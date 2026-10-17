import {
  assertQrDesignerSettings,
  assertQrPayload,
  assertQrUrl,
  QrDesignerError,
  qrDesignerLimits,
  qrDesignerPresets,
} from "@toolbox/core";
import { z } from "zod";

export const qrDesignerSettingsSchema = z
  .object({
    size: z.number().int().min(qrDesignerLimits.sizeMin).max(qrDesignerLimits.sizeMax),
    quietZone: z
      .number()
      .int()
      .min(qrDesignerLimits.quietZoneMin)
      .max(qrDesignerLimits.quietZoneMax),
    errorCorrection: z.enum(["L", "M", "Q", "H"]),
    foreground: z.string().regex(/^#[\da-f]{6}$/i),
    background: z.string().regex(/^#[\da-f]{6}$/i),
    dotStyle: z.enum(["square", "rounded", "dots", "diamond"]),
    eyeStyle: z.enum(["square", "rounded", "circle"]),
    gradient: z.boolean(),
    gradientEnd: z.string().regex(/^#[\da-f]{6}$/i),
    logoPercent: z
      .number()
      .int()
      .min(qrDesignerLimits.logoPercentMin)
      .max(qrDesignerLimits.logoPercentMax),
    logoPosition: z.enum([
      "center",
      "top",
      "right",
      "bottom",
      "left",
      "top-left",
      "top-right",
      "bottom-left",
      "bottom-right",
    ]),
  })
  .strict()
  .superRefine((settings, context) => {
    try {
      assertQrDesignerSettings(settings);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof QrDesignerError ? error.message : "Invalid QR settings.",
      });
    }
  });

export const qrDesignerPayloadSchema = z
  .object({
    mode: z.enum(["text", "url"]),
    payload: z.string().min(1).max(qrDesignerLimits.payloadBytes),
  })
  .strict()
  .superRefine((value, context) => {
    try {
      assertQrPayload(value.payload);
      if (value.mode === "url") assertQrUrl(value.payload);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof QrDesignerError ? error.message : "Invalid QR content.",
      });
    }
  });

export const qrDesignerLogoSchema = z
  .object({
    name: z.string().min(1).max(255),
    size: z.number().int().min(1).max(qrDesignerLimits.logoFileBytes),
    type: z.enum(["image/png", "image/jpeg"]),
  })
  .strict();

export const qrDesignerPresetSchema = z.enum(["classic", "garden", "studio"]);
export const qrDesignerSettingsDefaults = qrDesignerPresets.classic;
