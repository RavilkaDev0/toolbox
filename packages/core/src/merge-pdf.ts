export const pdfMergeLimits = {
  files: 10,
  fileBytes: 8 * 1024 * 1024,
  totalBytes: 24 * 1024 * 1024,
  filePages: 100,
  pages: 200,
  outputBytes: 48 * 1024 * 1024,
  objects: 20_000,
  nodes: 100_000,
  depth: 32,
  imagePixels: 12_000_000,
  totalImagePixels: 24_000_000,
  pageSide: 14_400,
  jobMilliseconds: 45_000,
} as const;
// Shared viewer ceilings; generation limits remain owned by each tool.
export const pdfPreviewLimits = { bytes: 64 * 1024 * 1024, pages: 200, pixels: 12_000_000 };
export type PdfMergeErrorCode =
  | "INVALID_PDF"
  | "DOCUMENT_PROTECTED"
  | "UNSUPPORTED_FEATURE"
  | "RESOURCE_LIMIT"
  | "CANCELLED"
  | "MERGE_FAILED";
const messages: Record<PdfMergeErrorCode, string> = {
  INVALID_PDF: "A PDF is empty, damaged or has the wrong type. Choose a valid PDF and retry.",
  DOCUMENT_PROTECTED:
    "Encrypted PDFs are not supported. Export an unprotected copy using an authorized PDF editor.",
  UNSUPPORTED_FEATURE:
    "This PDF contains forms, annotations, actions or attachments. Export a plain static PDF first. Signed PDFs are not supported.",
  RESOURCE_LIMIT:
    "This selection exceeds the limits or processing time. Use smaller PDFs or split the batch.",
  CANCELLED: "Operation cancelled. Your selected documents are still available.",
  MERGE_FAILED: "The browser could not merge these PDFs. Try smaller documents, then retry.",
};
export class PdfMergeError extends Error {
  constructor(readonly code: PdfMergeErrorCode) {
    super(messages[code]);
    this.name = "PdfMergeError";
  }
}
export function assertPdfSelection(
  files: readonly { size: number; name: string; type: string }[],
  merging = false,
) {
  if (!files.length || (merging && files.length < 2)) throw new PdfMergeError("INVALID_PDF");
  if (files.length > pdfMergeLimits.files) throw new PdfMergeError("RESOURCE_LIMIT");
  let total = 0;
  for (const file of files) {
    if (
      !Number.isSafeInteger(file.size) ||
      file.size < 1 ||
      !file.name.length ||
      file.name.length > 255 ||
      (file.type && file.type !== "application/pdf")
    )
      throw new PdfMergeError("INVALID_PDF");
    total += file.size;
    if (file.size > pdfMergeLimits.fileBytes || total > pdfMergeLimits.totalBytes)
      throw new PdfMergeError("RESOURCE_LIMIT");
  }
}
export function assertPdfSignature(bytes: Uint8Array) {
  const header = new TextDecoder("ascii").decode(bytes.subarray(0, 8));
  const tail = new TextDecoder("ascii").decode(bytes.subarray(Math.max(0, bytes.length - 1024)));
  const end = tail.lastIndexOf("%%EOF");
  const trailing = tail.slice(end + 5);
  if (
    !/^%PDF-(1\.[0-7]|2\.0)/.test(header) ||
    end < 0 ||
    !Array.from(trailing).every((character) =>
      [0, 9, 10, 12, 13, 32].includes(character.charCodeAt(0)),
    )
  )
    throw new PdfMergeError("INVALID_PDF");
}
export function assertPdfPageCount(count: number, total = count) {
  if (!Number.isInteger(count) || count < 1) throw new PdfMergeError("INVALID_PDF");
  if (count > pdfMergeLimits.filePages || total > pdfMergeLimits.pages)
    throw new PdfMergeError("RESOURCE_LIMIT");
}
export { moveItem as moveDocument } from "./ordering.js";
export function assertPdfOutputSize(bytes: number) {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > pdfMergeLimits.outputBytes)
    throw new PdfMergeError("RESOURCE_LIMIT");
}
