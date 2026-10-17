import { afterEach, describe, expect, it } from "vitest";
import { CaseConverterError, caseConverterLimits, convertTextCase } from "./case-converter.js";

const originalSegmenter = Object.getOwnPropertyDescriptor(Intl, "Segmenter");

afterEach(() => {
  if (originalSegmenter) Object.defineProperty(Intl, "Segmenter", originalSegmenter);
});

describe("case converter", () => {
  it("preserves punctuation, whitespace, line endings, emoji and uncased symbols", () => {
    const text = "  hELLO, 🌍!\r\ncrème brûlée…\t";
    expect(convertTextCase(text, "uppercase", "en-US")).toBe("  HELLO, 🌍!\r\nCRÈME BRÛLÉE…\t");
    expect(convertTextCase(text, "lowercase", "en-US")).toBe("  hello, 🌍!\r\ncrème brûlée…\t");
  });

  it("uses locale-sensitive Turkish and German case mappings", () => {
    expect(convertTextCase("Iİ", "lowercase", "tr")).toBe("ıi");
    expect(convertTextCase("istanbul", "uppercase", "tr")).toBe("İSTANBUL");
    expect(convertTextCase("straße", "uppercase", "de")).toBe("STRASSE");
  });

  it("applies the documented simple word-based title rules", () => {
    expect(convertTextCase("hELLO, WORLD! don't STOP", "title", "en-US")).toBe(
      "Hello, World! Don't Stop",
    );
    expect(convertTextCase("  МОСКВА — ÉCOLE\n東京 42ABC", "title", "ru")).toBe(
      "  Москва — École\n東京 42Abc",
    );
  });

  it("lowers sentence segments and capitalizes the first cased grapheme", () => {
    expect(convertTextCase("hELLO, WORLD! SECOND LINE? 123 wow.", "sentence", "en-US")).toBe(
      "Hello, world! Second line? 123 Wow.",
    );
    expect(convertTextCase("e\u0301COLE.", "sentence", "en-US")).toBe("E\u0301cole.");
  });

  it("toggles cased graphemes without dropping combining marks or emoji", () => {
    const text = "e\u0301COLE 😀 ß";
    expect(convertTextCase(text, "toggle", "en-US")).toBe("E\u0301cole 😀 SS");
    expect(convertTextCase("ABC xyz", "toggle", "en-US")).toBe("abc XYZ");
  });

  it("uses bounded documented fallbacks when Intl.Segmenter is unavailable", () => {
    if (originalSegmenter)
      Object.defineProperty(Intl, "Segmenter", { ...originalSegmenter, value: undefined });
    expect(convertTextCase("hELLO, WORLD! don't STOP", "title", "en-US")).toBe(
      "Hello, World! Don't Stop",
    );
    expect(convertTextCase("hELLO. WORLD!", "sentence", "en-US")).toBe("Hello. World!");
    expect(convertTextCase("e\u0301 😀", "toggle", "en-US")).toBe("E\u0301 😀");
  });

  it("rejects oversized and invalid runtime input without returning partial output", () => {
    expect(() =>
      convertTextCase("x".repeat(caseConverterLimits.maximumInputCodeUnits + 1), "uppercase"),
    ).toThrowError(CaseConverterError);
    expect(() => convertTextCase("text", "other" as never)).toThrowError(CaseConverterError);
    expect(() => convertTextCase("text", "uppercase", "xx" as never)).toThrowError(
      CaseConverterError,
    );
  });
});
