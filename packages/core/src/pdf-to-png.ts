import { PdfProcessingError, pdfDocumentLimits } from "./merge-pdf.js";

export const pdfToPngDpis = [96, 192] as const;
export type PdfToPngDpi = (typeof pdfToPngDpis)[number];
export type PdfToPngBackground = "transparent" | "white";

export const pdfToPngLimits = {
  fileBytes: pdfDocumentLimits.fileBytes,
  pages: pdfDocumentLimits.filePages,
  pagePixels: 8_000_000,
  pageSidePixels: 8_192,
  totalPixels: 120_000_000,
  imageBytes: 16 * 1024 * 1024,
  archiveBytes: 32 * 1024 * 1024,
  jobMilliseconds: pdfDocumentLimits.jobMilliseconds,
} as const;

export type PdfToPngDimensions = {
  width: number;
  height: number;
  pixels: number;
};

export function pdfToPngDimensions(
  widthPoints: number,
  heightPoints: number,
  rotation: number,
  dpi: PdfToPngDpi,
): PdfToPngDimensions {
  if (
    !Number.isFinite(widthPoints) ||
    !Number.isFinite(heightPoints) ||
    widthPoints <= 0 ||
    heightPoints <= 0 ||
    !Number.isSafeInteger(rotation) ||
    rotation % 90 !== 0 ||
    !pdfToPngDpis.includes(dpi)
  )
    throw new PdfProcessingError("INVALID_PDF");

  const quarterTurn = Math.abs(rotation % 180) === 90;
  const scale = dpi / 72;
  const width = Math.ceil((quarterTurn ? heightPoints : widthPoints) * scale);
  const height = Math.ceil((quarterTurn ? widthPoints : heightPoints) * scale);
  const pixels = width * height;
  if (
    !Number.isSafeInteger(pixels) ||
    width > pdfToPngLimits.pageSidePixels ||
    height > pdfToPngLimits.pageSidePixels ||
    pixels > pdfToPngLimits.pagePixels
  )
    throw new PdfProcessingError("RESOURCE_LIMIT");
  return { width, height, pixels };
}

export function assertPdfToPngPages(pages: readonly number[], pageCount: number) {
  if (
    !Array.isArray(pages) ||
    !Number.isInteger(pageCount) ||
    pageCount < 1 ||
    pageCount > pdfToPngLimits.pages ||
    pages.length < 1 ||
    pages.length > pageCount
  )
    throw new PdfProcessingError("RESOURCE_LIMIT");

  let previous = 0;
  for (const page of pages) {
    if (!Number.isSafeInteger(page) || page < 1 || page > pageCount || page <= previous)
      throw new PdfProcessingError("INVALID_PDF");
    previous = page;
  }
}

export function assertPdfToPngOutputSize(bytes: number, archive: boolean) {
  const maximum = archive ? pdfToPngLimits.archiveBytes : pdfToPngLimits.imageBytes;
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > maximum)
    throw new PdfProcessingError("RESOURCE_LIMIT");
}
