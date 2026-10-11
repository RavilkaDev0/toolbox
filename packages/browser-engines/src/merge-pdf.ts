import {
  assertPdfOutputSize,
  assertPdfPageCount,
  assertPdfSelection,
  PdfProcessingError,
} from "@toolbox/core";
import type { PDFObject } from "pdf-lib";
import { loadStaticPdf, staticPdfPageIdentity } from "./static-pdf.js";

export type PdfDocumentInfo = { pages: number };
export type PdfMergeResult = { blob: Blob; pages: number };
export type PdfMergeRequest = { action: "inspect" | "merge"; files: File[] };
export type PdfMergeResponse =
  | { type: "inspected"; documents: PdfDocumentInfo[] }
  | { type: "result"; result: PdfMergeResult }
  | { type: "error"; code: PdfProcessingError["code"] };

function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new PdfProcessingError("CANCELLED");
}

export async function inspectPdfs(files: readonly File[], signal?: AbortSignal) {
  assertPdfSelection(files);
  const documents: PdfDocumentInfo[] = [];
  let pages = 0;
  for (const file of files) {
    const pdf = await loadStaticPdf(file, signal);
    pages += pdf.getPageCount();
    assertPdfPageCount(pdf.getPageCount(), pages);
    documents.push({ pages: pdf.getPageCount() });
  }
  return documents;
}

export async function mergePdfs(
  files: readonly File[],
  signal?: AbortSignal,
): Promise<PdfMergeResult> {
  assertPdfSelection(files, true);
  cancelled(signal);
  const { PDFDocument } = await import("pdf-lib");
  const output = await PDFDocument.create();
  output.setProducer("Toolbox Merge PDF");
  output.setCreator("Toolbox");
  const identities: string[] = [];
  for (const file of files) {
    const source = await loadStaticPdf(file, signal);
    assertPdfPageCount(source.getPageCount(), identities.length + source.getPageCount());
    const resourceMemo = new Map<PDFObject, string>();
    for (const page of source.getPages())
      identities.push(await staticPdfPageIdentity(page, resourceMemo));
    const pages = await output.copyPages(source, source.getPageIndices());
    cancelled(signal);
    for (const page of pages) output.addPage(page);
  }
  const bytes = await output.save({ objectsPerTick: 10, addDefaultPage: false });
  cancelled(signal);
  assertPdfOutputSize(bytes.byteLength);
  const checked = await PDFDocument.load(bytes, {
    updateMetadata: false,
    throwOnInvalidObject: true,
  });
  if (checked.getPageCount() !== identities.length) throw new PdfProcessingError("MERGE_FAILED");
  const resourceMemo = new Map<PDFObject, string>();
  for (const [index, page] of checked.getPages().entries()) {
    cancelled(signal);
    if ((await staticPdfPageIdentity(page, resourceMemo)) !== identities[index])
      throw new PdfProcessingError("MERGE_FAILED");
  }
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    pages: checked.getPageCount(),
  };
}
