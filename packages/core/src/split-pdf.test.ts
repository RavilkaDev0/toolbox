import { describe, expect, it } from "vitest";
import { assertSelectedPages, parsePageRanges, pdfSplitLimits } from "./split-pdf.js";

describe("Split PDF page selection", () => {
  it("parses individual pages, lists, ranges, all and deduplicates into source order", () => {
    expect(parsePageRanges("1", 10)).toEqual({ ok: true, pages: [1] });
    expect(parsePageRanges("1,3,5", 10)).toEqual({ ok: true, pages: [1, 3, 5] });
    expect(parsePageRanges("1-5", 5)).toEqual({ ok: true, pages: [1, 2, 3, 4, 5] });
    expect(parsePageRanges("5,1-3,2,8-10", 10)).toEqual({
      ok: true,
      pages: [1, 2, 3, 5, 8, 9, 10],
    });
    expect(parsePageRanges(" all ", 3)).toEqual({ ok: true, pages: [1, 2, 3] });
    expect(parsePageRanges("1,1", 1)).toEqual({ ok: true, pages: [1] });
  });
  it("rejects empty, malformed, descending, zero, oversized and out-of-range selections", () => {
    for (const [input, code] of [
      ["", "EMPTY"],
      ["1,,2", "INVALID_SYNTAX"],
      ["1-", "INVALID_SYNTAX"],
      ["-2", "INVALID_SYNTAX"],
      ["3-1", "INVALID_SYNTAX"],
      ["0", "OUT_OF_RANGE"],
      ["1-11", "OUT_OF_RANGE"],
      ["1x", "INVALID_SYNTAX"],
      ["1".repeat(100), "TOO_LONG"],
    ]) {
      expect(parsePageRanges(input, 10)).toEqual({ ok: false, code });
    }
    expect(parsePageRanges("1", 0)).toEqual({ ok: false, code: "OUT_OF_RANGE" });
  });
  it("validates strictly ascending normalized selections and output limits", () => {
    expect(() => assertSelectedPages([1, 3, 5], 5)).not.toThrow();
    for (const pages of [[], [2, 1], [1, 1], [0], [6]])
      expect(() => assertSelectedPages(pages, 5)).toThrow();
    expect(() => assertSelectedPages([1], pdfSplitLimits.pages + 1)).toThrow();
  });
});
