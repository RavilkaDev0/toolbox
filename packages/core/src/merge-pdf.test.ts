import { describe, expect, it } from "vitest";
import {
  assertPdfOutputSize,
  assertPdfPageCount,
  assertPdfSelection,
  assertPdfSignature,
  moveDocument,
  pdfMergeLimits,
} from "./merge-pdf.js";

describe("Merge PDF rules", () => {
  it("bounds output bytes including exact limits", () => {
    expect(() => assertPdfOutputSize(pdfMergeLimits.outputBytes)).not.toThrow();
    for (const bytes of [0, NaN, 1.5, pdfMergeLimits.outputBytes + 1])
      expect(() => assertPdfOutputSize(bytes)).toThrow();
  });
  const file = { name: "synthetic.pdf", type: "application/pdf", size: pdfMergeLimits.fileBytes };
  it("enforces real file/aggregate/count bounds and two-file merge minimum", () => {
    expect(() => assertPdfSelection([file])).not.toThrow();
    expect(() => assertPdfSelection([file, file, file], true)).not.toThrow();
    for (const files of [
      [],
      [{ ...file, size: 0 }],
      [{ ...file, size: file.size + 1 }],
      [{ ...file, type: "text/plain" }],
      [file, file, file, file],
      Array.from({ length: 11 }, () => ({ ...file, size: 1 })),
    ])
      expect(() => assertPdfSelection(files)).toThrow();
    expect(() => assertPdfSelection([file], true)).toThrow();
  });
  it("checks header/version/end marker without accepting a renamed non-PDF", () => {
    const bytes = (value: string) => new TextEncoder().encode(value);
    expect(() => assertPdfSignature(bytes("%PDF-1.7\n%%EOF\n"))).not.toThrow();
    for (const value of [
      "",
      "%PDF-1.7",
      "%PDF-1.7\n%%EOFZIP",
      "%PDF-9.0\n%%EOF",
      "x%PDF-1.7\n%%EOF",
    ])
      expect(() => assertPdfSignature(bytes(value))).toThrow();
  });
  it("bounds pages and keeps document identity/order without mutation", () => {
    expect(() => assertPdfPageCount(100, 200)).not.toThrow();
    for (const count of [0, 101, 1.2]) expect(() => assertPdfPageCount(count)).toThrow();
    expect(() => assertPdfPageCount(100, 201)).toThrow();
    const documents = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(moveDocument(documents, 2, 0)).toEqual([documents[2], documents[0], documents[1]]);
    expect(moveDocument(documents, -1, 0)).toEqual(documents);
    expect(documents.map((d) => d.id)).toEqual([1, 2, 3]);
  });
});
