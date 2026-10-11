import { pdfRotateSettingsSchema } from "@toolbox/contracts";
import {
  assertPdfRotateOutputSize,
  assertSelectedPages,
  normalizePdfRotation,
  PdfProcessingError,
} from "@toolbox/core";
import type { PDFObject } from "pdf-lib";
import { loadStaticPdf, staticPdfPageIdentity } from "./static-pdf.js";

export type PdfRotateInfo = { pages: number; bytes: number; rotations: number[] };
export type PdfRotateResult = { blob: Blob; pages: number; rotatedPages: number[] };
export type PdfRotateRequest =
  | { action: "inspect"; file: File }
  | { action: "rotate"; file: File; pages: number[]; delta: -90 | 90 | 180 };
export type PdfRotateResponse =
  | { type: "inspected"; info: PdfRotateInfo }
  | { type: "result"; result: PdfRotateResult }
  | { type: "error"; code: PdfProcessingError["code"] };

function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new PdfProcessingError("CANCELLED");
}

function readRotations(document: Awaited<ReturnType<typeof loadStaticPdf>>) {
  const rotations = document.getPages().map((page) => page.getRotation().angle);
  try {
    for (const angle of rotations) normalizePdfRotation(angle, 90);
  } catch {
    throw new PdfProcessingError("INVALID_PDF");
  }
  return rotations;
}

export async function inspectRotatePdf(file: File, signal?: AbortSignal): Promise<PdfRotateInfo> {
  const document = await loadStaticPdf(file, signal);
  return {
    pages: document.getPageCount(),
    bytes: file.size,
    rotations: readRotations(document),
  };
}

export async function rotatePdfPages(
  file: File,
  pages: readonly number[],
  delta: number,
  signal?: AbortSignal,
): Promise<PdfRotateResult> {
  cancelled(signal);
  const parsed = pdfRotateSettingsSchema.safeParse({ pages, delta });
  if (!parsed.success) throw new PdfProcessingError("INVALID_PDF");
  const source = await loadStaticPdf(file, signal);
  assertSelectedPages(parsed.data.pages, source.getPageCount());
  const sourcePages = source.getPages();
  const sourceRotations = readRotations(source);
  const expectedIdentities: string[] = [];
  const sourceMemo = new Map<PDFObject, string>();
  for (const page of sourcePages) {
    cancelled(signal);
    expectedIdentities.push(
      await staticPdfPageIdentity(page, sourceMemo, { includeRotation: false }),
    );
  }
  const expectedRotations = sourceRotations.map((angle) => angle);
  const { degrees, PDFDocument } = await import("pdf-lib");
  for (const pageNumber of parsed.data.pages) {
    cancelled(signal);
    const page = source.getPage(pageNumber - 1);
    if (!page) throw new PdfProcessingError("INVALID_PDF");
    const nextAngle = normalizePdfRotation(page.getRotation().angle, parsed.data.delta);
    page.setRotation(degrees(nextAngle));
    expectedRotations[pageNumber - 1] = nextAngle;
  }
  cancelled(signal);
  const bytes = new Uint8Array(await source.save({ objectsPerTick: 10, addDefaultPage: false }));
  assertPdfRotateOutputSize(bytes.byteLength);
  cancelled(signal);
  let output: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    output = await PDFDocument.load(bytes, {
      updateMetadata: false,
      throwOnInvalidObject: true,
      capNumbers: true,
    });
  } catch {
    throw new PdfProcessingError("ROTATE_FAILED");
  }
  if (output.getPageCount() !== source.getPageCount())
    throw new PdfProcessingError("ROTATE_FAILED");
  const outputMemo = new Map<PDFObject, string>();
  for (const [index, page] of output.getPages().entries()) {
    cancelled(signal);
    if (
      page.getRotation().angle !== expectedRotations[index] ||
      (await staticPdfPageIdentity(page, outputMemo, { includeRotation: false })) !==
        expectedIdentities[index]
    )
      throw new PdfProcessingError("ROTATE_FAILED");
  }
  return {
    blob: new Blob([bytes], { type: "application/pdf" }),
    pages: output.getPageCount(),
    rotatedPages: parsed.data.pages,
  };
}
