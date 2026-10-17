import { describe, expect, it } from "vitest";
import {
  analyzeText,
  assertWordCounterText,
  WordCounterError,
  wordCounterLimits,
} from "./word-counter.js";

describe("word counter", () => {
  it("returns zero metrics for empty input", () => {
    expect(analyzeText("")).toMatchObject({
      wordCount: 0,
      charactersWithWhitespace: 0,
      charactersWithoutWhitespace: 0,
      paragraphCount: 0,
      lineCount: 0,
      sentenceCount: 0,
      utf16CodeUnits: 0,
      unicodeCodePoints: 0,
    });
  });

  it("segments English words and sentences and counts line and paragraph boundaries", () => {
    const result = analyzeText("Hello, world!\r\n\r\nAgain.", "en-US");
    expect(result.wordCount).toBe(3);
    expect(result.sentenceCount).toBe(2);
    expect(result.lineCount).toBe(3);
    expect(result.paragraphCount).toBe(2);
  });

  it("handles Cyrillic, CJK, emoji, combining marks and punctuation", () => {
    const russian = analyzeText("Привет, мир!", "ru-RU");
    expect(russian.wordCount).toBe(2);
    expect(russian.sentenceCount).toBe(1);

    const cjk = analyzeText("私は世界です。", "ja-JP");
    expect(cjk.wordCount > 0).toBe(true);
    expect(cjk.sentenceCount).toBe(1);

    const unicode = analyzeText("e\u0301 😀", "en-US");
    expect(unicode.utf16CodeUnits).toBe(5);
    expect(unicode.unicodeCodePoints).toBe(4);
    expect(unicode.charactersWithWhitespace).toBe(3);
    expect(unicode.charactersWithoutWhitespace).toBe(2);
    expect(unicode.characterCountUnit).toBe("grapheme clusters");
  });

  it("counts Unicode whitespace consistently and treats CRLF, LF and CR as line endings", () => {
    const result = analyzeText(" one \r\n\t\r two\n\n three ", "en-US");
    expect(result.lineCount).toBe(5);
    expect(result.paragraphCount).toBe(3);
    expect(result.charactersWithoutWhitespace < result.charactersWithWhitespace).toBe(true);
  });

  it("falls back to code points and documented approximate token rules without Intl.Segmenter", () => {
    const original = Object.getOwnPropertyDescriptor(Intl, "Segmenter");
    try {
      if (original) Object.defineProperty(Intl, "Segmenter", { ...original, value: undefined });
      const result = analyzeText("e\u0301 😀. Next sentence");
      expect(result.usesIntlSegmenter).toBe(false);
      expect(result.characterCountUnit).toBe("Unicode code points");
      expect(result.charactersWithWhitespace).toBe(result.unicodeCodePoints);
      expect(result.wordCount).toBe(3);
      expect(result.sentenceCount).toBe(2);
    } finally {
      if (original) Object.defineProperty(Intl, "Segmenter", original);
    }
  });

  it("enforces the input bound before analysis", () => {
    expect(() =>
      assertWordCounterText("x".repeat(wordCounterLimits.maximumUtf16CodeUnits + 1)),
    ).toThrowError(WordCounterError);
    expect(() => assertWordCounterText(123 as unknown as string)).toThrowError(WordCounterError);
  });
});
