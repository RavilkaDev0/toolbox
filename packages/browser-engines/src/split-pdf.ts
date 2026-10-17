import { pdfSplitSettingsSchema } from "@toolbox/contracts";
import {
  assertPdfOutputSize,
  assertSelectedPages,
  PdfProcessingError,
  pdfSplitLimits,
} from "@toolbox/core";
import type { PDFObject } from "pdf-lib";
import { loadStaticPdf, staticPdfBytesIdentity, staticPdfPageIdentity } from "./static-pdf.js";

export type PdfSplitSettings = { mode: "extract" | "split"; pages: number[] };
export type PdfSplitInfo = { pages: number; bytes: number };
export type PdfSplitResult = {
  blob: Blob;
  mode: "extract" | "split";
  pages: number;
  files: number;
};
export type PdfSplitRequest =
  | { action: "inspect"; file: File }
  | ({ action: "extract" | "split"; file: File } & PdfSplitSettings);
export type PdfSplitResponse =
  | { type: "inspected"; info: PdfSplitInfo }
  | { type: "result"; result: PdfSplitResult }
  | { type: "error"; code: PdfProcessingError["code"] };

function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new PdfProcessingError("CANCELLED");
}

export async function inspectPdf(file: File, signal?: AbortSignal): Promise<PdfSplitInfo> {
  const document = await loadStaticPdf(file, signal);
  return { pages: document.getPageCount(), bytes: file.size };
}

async function validateSettings(
  file: File,
  mode: "extract" | "split",
  pages: readonly number[],
  signal?: AbortSignal,
) {
  const parsed = pdfSplitSettingsSchema.safeParse({ mode, pages });
  if (!parsed.success) throw new PdfProcessingError("INVALID_PDF");
  const source = await loadStaticPdf(file, signal);
  assertSelectedPages(parsed.data.pages, source.getPageCount());
  return { source, selectedPages: parsed.data.pages };
}

async function copyAndVerifyPages(
  source: Awaited<ReturnType<typeof loadStaticPdf>>,
  selectedPages: readonly number[],
  outputLimit: number,
  signal?: AbortSignal,
) {
  cancelled(signal);
  const { PDFDocument } = await import("pdf-lib");
  const expected: string[] = [];
  const sourceMemo = new Map<PDFObject, string>();
  for (const number of selectedPages) {
    const page = source.getPage(number - 1);
    if (!page) throw new PdfProcessingError("INVALID_PDF");
    expected.push(await staticPdfPageIdentity(page, sourceMemo));
  }
  const output = await PDFDocument.create();
  output.setProducer("Toolbox Split PDF");
  output.setCreator("Toolbox");
  const pages = await output.copyPages(
    source,
    selectedPages.map((number) => number - 1),
  );
  for (const page of pages) output.addPage(page);
  cancelled(signal);
  const bytes = new Uint8Array(await output.save({ objectsPerTick: 10, addDefaultPage: false }));
  if (bytes.byteLength > outputLimit) throw new PdfProcessingError("RESOURCE_LIMIT");
  const checked = await PDFDocument.load(bytes, {
    updateMetadata: false,
    throwOnInvalidObject: true,
    capNumbers: true,
  });
  if (checked.getPageCount() !== selectedPages.length) throw new PdfProcessingError("SPLIT_FAILED");
  const outputMemo = new Map<PDFObject, string>();
  for (const [index, page] of checked.getPages().entries()) {
    cancelled(signal);
    if ((await staticPdfPageIdentity(page, outputMemo)) !== expected[index])
      throw new PdfProcessingError("SPLIT_FAILED");
  }
  return bytes;
}

export async function extractPdfPages(
  file: File,
  pages: readonly number[],
  signal?: AbortSignal,
): Promise<PdfSplitResult> {
  const { source, selectedPages } = await validateSettings(file, "extract", pages, signal);
  const bytes = await copyAndVerifyPages(
    source,
    selectedPages,
    pdfSplitLimits.extractBytes,
    signal,
  );
  assertPdfOutputSize(bytes.byteLength);
  return {
    blob: new Blob([bytes], { type: "application/pdf" }),
    mode: "extract",
    pages: selectedPages.length,
    files: 1,
  };
}

type ZipEntryCheck = { name: string; bytes: number; identity: string };
function entryName(page: number) {
  return `page-${String(page).padStart(3, "0")}.pdf`;
}

export async function splitPdfPages(
  file: File,
  pages: readonly number[],
  signal?: AbortSignal,
): Promise<PdfSplitResult> {
  const { source, selectedPages } = await validateSettings(file, "split", pages, signal);
  const [{ PDFDocument }, { unzipSync, Zip, ZipPassThrough }] = await Promise.all([
    import("pdf-lib"),
    import("fflate"),
  ]);
  const entries: ZipEntryCheck[] = [];
  let archiveBytes = 0;
  const archiveParts: Uint8Array[] = [];
  const zip = new Zip((error, chunk) => {
    if (error || !chunk) throw new PdfProcessingError("SPLIT_FAILED");
    archiveBytes += chunk.byteLength;
    if (archiveBytes > pdfSplitLimits.archiveBytes) throw new PdfProcessingError("RESOURCE_LIMIT");
    archiveParts.push(chunk);
  });

  let totalPdfBytes = 0;
  const sourceMemo = new Map<PDFObject, string>();
  for (const pageNumber of selectedPages) {
    cancelled(signal);
    const sourcePage = source.getPage(pageNumber - 1);
    if (!sourcePage) throw new PdfProcessingError("INVALID_PDF");
    const expectedPage = await staticPdfPageIdentity(sourcePage, sourceMemo);
    const bytes = await copyAndVerifyPages(
      source,
      [pageNumber],
      pdfSplitLimits.pagePdfBytes,
      signal,
    );
    const singlePage = await PDFDocument.load(bytes, {
      updateMetadata: false,
      throwOnInvalidObject: true,
      capNumbers: true,
    });
    const isolatedPage = singlePage.getPage(0);
    if (
      singlePage.getPageCount() !== 1 ||
      !isolatedPage ||
      (await staticPdfPageIdentity(isolatedPage, new Map())) !== expectedPage
    )
      throw new PdfProcessingError("SPLIT_FAILED");

    totalPdfBytes += bytes.byteLength;
    if (totalPdfBytes > pdfSplitLimits.archiveBytes) throw new PdfProcessingError("RESOURCE_LIMIT");
    const name = entryName(pageNumber);
    const entry: ZipEntryCheck = {
      name,
      bytes: bytes.byteLength,
      identity: staticPdfBytesIdentity(bytes),
    };
    entries.push(entry);
    const stream = new ZipPassThrough(name);
    stream.mtime = new Date("2000-01-01T00:00:00.000Z");
    zip.add(stream);
    stream.push(bytes, true);
  }
  cancelled(signal);
  zip.end();
  if (archiveParts.length === 0) throw new PdfProcessingError("SPLIT_FAILED");
  const archive = new Uint8Array(archiveBytes);
  let offset = 0;
  for (const part of archiveParts) {
    archive.set(part, offset);
    offset += part.byteLength;
  }
  archiveParts.length = 0;
  let unzipped: Record<string, Uint8Array>;
  try {
    unzipped = unzipSync(archive);
  } catch {
    throw new PdfProcessingError("SPLIT_FAILED");
  }
  const outputNames = Object.keys(unzipped);
  if (outputNames.length !== entries.length || entries.length !== selectedPages.length)
    throw new PdfProcessingError("SPLIT_FAILED");
  for (const expected of entries) {
    const contents = unzipped[expected.name];
    if (!contents || contents.byteLength !== expected.bytes)
      throw new PdfProcessingError("SPLIT_FAILED");
    let hash = 2166136261;
    for (const byte of contents) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
    if (`${String(contents.byteLength)}:${String(hash)}` !== expected.identity)
      throw new PdfProcessingError("SPLIT_FAILED");
  }
  cancelled(signal);
  return {
    blob: new Blob([archive], { type: "application/zip" }),
    mode: "split",
    pages: selectedPages.length,
    files: entries.length,
  };
}
