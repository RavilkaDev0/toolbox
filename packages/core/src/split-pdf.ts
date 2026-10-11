import { PdfProcessingError, pdfDocumentLimits } from "./merge-pdf.js";

export const pdfSplitLimits = {
  fileBytes: pdfDocumentLimits.fileBytes,
  pages: pdfDocumentLimits.filePages,
  extractBytes: 8 * 1024 * 1024,
  pagePdfBytes: 8 * 1024 * 1024,
  archiveBytes: 8 * 1024 * 1024,
  entries: pdfDocumentLimits.filePages,
  jobMilliseconds: pdfDocumentLimits.jobMilliseconds,
} as const;

export type PageRangeErrorCode = "EMPTY" | "INVALID_SYNTAX" | "OUT_OF_RANGE" | "TOO_LONG";
export type PageRangeResult =
  | { ok: true; pages: number[] }
  | { ok: false; code: PageRangeErrorCode };

function positivePage(token: string, pageCount: number): number | null {
  if (!token.length) return null;
  let value = 0;
  for (const char of token) {
    const digit = char.charCodeAt(0) - 48;
    if (digit < 0 || digit > 9) return null;
    value = value * 10 + digit;
    if (value > pageCount) return Number.POSITIVE_INFINITY;
  }
  return value;
}

export function parsePageRanges(input: string, pageCount: number): PageRangeResult {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > pdfSplitLimits.pages)
    return { ok: false, code: "OUT_OF_RANGE" };
  const value = input.trim();
  if (!value) return { ok: false, code: "EMPTY" };
  if (value.length > pageCount * 8) return { ok: false, code: "TOO_LONG" };
  if (value.toLowerCase() === "all")
    return { ok: true, pages: Array.from({ length: pageCount }, (_, index) => index + 1) };

  const parts = value.split(",");
  const selected = new Uint8Array(pageCount);
  for (const part of parts) {
    const range = part.trim().split("-");
    if (range.length < 1 || range.length > 2) return { ok: false, code: "INVALID_SYNTAX" };
    const startToken = range[0]?.trim() ?? "";
    const start = positivePage(startToken, pageCount);
    const endToken = range[1]?.trim();
    const end = endToken === undefined ? start : positivePage(endToken, pageCount);
    if (start === null || end === null) return { ok: false, code: "INVALID_SYNTAX" };
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1)
      return { ok: false, code: "OUT_OF_RANGE" };
    if (end < start) return { ok: false, code: "INVALID_SYNTAX" };
    for (let page = start; page <= end; page++) selected[page - 1] = 1;
  }
  const pages = Array.from(selected, (isSelected, index) => (isSelected ? index + 1 : 0)).filter(
    (page) => page > 0,
  );
  return pages.length ? { ok: true, pages } : { ok: false, code: "EMPTY" };
}

export function assertSelectedPages(pages: readonly number[], pageCount: number) {
  if (
    !Array.isArray(pages) ||
    pages.length < 1 ||
    pages.length > pdfSplitLimits.entries ||
    !Number.isInteger(pageCount) ||
    pageCount < 1 ||
    pageCount > pdfSplitLimits.pages
  )
    throw new PdfProcessingError("RESOURCE_LIMIT");
  let previous = 0;
  for (const page of pages) {
    if (!Number.isSafeInteger(page) || page < 1 || page > pageCount || page <= previous)
      throw new PdfProcessingError("INVALID_PDF");
    previous = page;
  }
}
