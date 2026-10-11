import { PdfProcessingError, pdfDocumentLimits } from "./merge-pdf.js";

export const pdfRotateLimits = {
  fileBytes: pdfDocumentLimits.fileBytes,
  pages: pdfDocumentLimits.filePages,
  outputBytes: 8 * 1024 * 1024,
  jobMilliseconds: pdfDocumentLimits.jobMilliseconds,
} as const;

export type PdfRotationDelta = -90 | 90 | 180;

export function normalizePdfRotation(currentAngle: number, delta: number): number {
  if (
    !Number.isInteger(currentAngle) ||
    ![0, 90, 180, 270].includes(currentAngle) ||
    ![-90, 90, 180].includes(delta)
  )
    throw new RangeError("PDF rotations must use quarter turns.");
  return (((currentAngle + delta) % 360) + 360) % 360;
}

export function assertPdfRotateOutputSize(bytes: number) {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > pdfRotateLimits.outputBytes)
    throw new PdfProcessingError("RESOURCE_LIMIT");
}
