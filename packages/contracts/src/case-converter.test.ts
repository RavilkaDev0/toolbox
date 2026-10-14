import { caseConverterLimits } from "@toolbox/core";
import { describe, expect, it } from "vitest";
import { caseConverterSettingsSchema } from "./case-converter.js";

describe("case converter contract", () => {
  it("accepts supported locale and mode settings with Unicode text", () => {
    expect(
      caseConverterSettingsSchema.safeParse({ text: "Привет 😀", mode: "title", locale: "ru" })
        .success,
    ).toBe(true);
  });

  it("rejects unknown modes, locales, extra fields and oversized text", () => {
    expect(
      caseConverterSettingsSchema.safeParse({ text: "text", mode: "camel", locale: "en-US" })
        .success,
    ).toBe(false);
    expect(
      caseConverterSettingsSchema.safeParse({ text: "text", mode: "lowercase", locale: "xx" })
        .success,
    ).toBe(false);
    expect(
      caseConverterSettingsSchema.safeParse({
        text: "x".repeat(caseConverterLimits.maximumInputCodeUnits + 1),
        mode: "lowercase",
        locale: "default",
      }).success,
    ).toBe(false);
    expect(
      caseConverterSettingsSchema.safeParse({
        text: "text",
        mode: "uppercase",
        locale: "default",
        secret: "unexpected",
      }).success,
    ).toBe(false);
  });
});
