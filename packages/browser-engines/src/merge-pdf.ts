import { pdfMergeFileSchema } from "@toolbox/contracts";
import {
  assertPdfOutputSize,
  assertPdfPageCount,
  assertPdfSelection,
  assertPdfSignature,
  PdfMergeError,
  pdfMergeLimits,
} from "@toolbox/core";
import type { PDFDocument, PDFObject, PDFPage } from "pdf-lib";

export type PdfDocumentInfo = { pages: number };
export type PdfMergeResult = { blob: Blob; pages: number };
export type PdfMergeRequest = { action: "inspect" | "merge"; files: File[] };
export type PdfMergeResponse =
  | { type: "inspected"; documents: PdfDocumentInfo[] }
  | { type: "result"; result: PdfMergeResult }
  | { type: "error"; code: PdfMergeError["code"] };
function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new PdfMergeError("CANCELLED");
}
const blockedKeys = new Set([
  "AcroForm",
  "Annots",
  "OpenAction",
  "AA",
  "A",
  "JS",
  "JavaScript",
  "XFA",
  "EmbeddedFiles",
  "EF",
  "AF",
  "RichMediaContent",
  "Collection",
  "ByteRange",
  "OCProperties",
]);
const blockedNames = new Set([
  "JavaScript",
  "Launch",
  "GoToR",
  "GoToE",
  "URI",
  "SubmitForm",
  "ImportData",
  "Rendition",
  "Movie",
  "Sound",
  "RichMedia",
  "EmbeddedFile",
  "Filespec",
  "Sig",
  "Action",
  "OCG",
  "OCMD",
]);
async function inspectStructure(document: PDFDocument, signal?: AbortSignal) {
  const { PDFArray, PDFDict, PDFName, PDFNumber, PDFRawStream, PDFRef } = await import("pdf-lib");
  const objects = document.context.enumerateIndirectObjects();
  if (objects.length > pdfMergeLimits.objects) throw new PdfMergeError("RESOURCE_LIMIT");
  const seen = new Set<PDFObject>();
  let nodes = 0;
  let pixels = 0;
  function walk(input: PDFObject, depth: number) {
    if (++nodes > pdfMergeLimits.nodes || depth > pdfMergeLimits.depth)
      throw new PdfMergeError("RESOURCE_LIMIT");
    const value = input instanceof PDFRef ? document.context.lookup(input) : input;
    if (!value) throw new PdfMergeError("INVALID_PDF");
    if (seen.has(value)) return;
    seen.add(value);
    if (value instanceof PDFName && blockedNames.has(value.decodeText()))
      throw new PdfMergeError("UNSUPPORTED_FEATURE");
    if (value instanceof PDFRawStream) {
      if (
        value.dict.has(PDFName.of("F")) ||
        value.dict.has(PDFName.of("FFilter")) ||
        value.dict.has(PDFName.of("FDecodeParms"))
      )
        throw new PdfMergeError("UNSUPPORTED_FEATURE");
      walk(value.dict, depth + 1);
    } else if (value instanceof PDFDict) {
      if (value.get(PDFName.of("Subtype"))?.toString() === "/Image") {
        const width = value.lookup(PDFName.of("Width"));
        const height = value.lookup(PDFName.of("Height"));
        if (!(width instanceof PDFNumber) || !(height instanceof PDFNumber))
          throw new PdfMergeError("INVALID_PDF");
        const w = width.asNumber();
        const h = height.asNumber();
        if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w < 1 || h < 1)
          throw new PdfMergeError("INVALID_PDF");
        pixels += w * h;
        if (w * h > pdfMergeLimits.imagePixels || pixels > pdfMergeLimits.totalImagePixels)
          throw new PdfMergeError("RESOURCE_LIMIT");
      }
      for (const [key, entry] of value.entries()) {
        // Parent objects are checked through the bounded indirect-object list.
        const annotations =
          key.decodeText() === "Annots" ? document.context.lookup(entry) : undefined;
        const emptyAnnotations = annotations instanceof PDFArray && annotations.size() === 0;
        if (blockedKeys.has(key.decodeText()) && !emptyAnnotations)
          throw new PdfMergeError("UNSUPPORTED_FEATURE");
        if (key.decodeText() !== "Parent" && key.decodeText() !== "P") walk(entry, depth + 1);
      }
    } else if (value instanceof PDFArray)
      for (const entry of value.asArray()) walk(entry, depth + 1);
  }
  for (const [, object] of objects) {
    cancelled(signal);
    walk(object, 0);
  }
}
async function loadPdf(file: File, signal?: AbortSignal): Promise<PDFDocument> {
  cancelled(signal);
  if (!pdfMergeFileSchema.safeParse({ name: file.name, size: file.size, type: file.type }).success)
    throw new PdfMergeError("INVALID_PDF");
  const bytes = new Uint8Array(await file.arrayBuffer());
  assertPdfSignature(bytes);
  const { PDFDocument, EncryptedPDFError } = await import("pdf-lib");
  cancelled(signal);
  try {
    const document = await PDFDocument.load(bytes, {
      updateMetadata: false,
      throwOnInvalidObject: true,
      capNumbers: true,
      parseSpeed: 100,
    });
    if (document.isEncrypted) throw new PdfMergeError("DOCUMENT_PROTECTED");
    cancelled(signal);
    assertPdfPageCount(document.getPageCount());
    await inspectStructure(document, signal);
    const resourceMemo = new Map<PDFObject, string>();
    for (const page of document.getPages()) {
      const box = page.getMediaBox();
      if (
        ![box.x, box.y, box.width, box.height, page.getRotation().angle].every(Number.isFinite) ||
        box.width <= 0 ||
        box.height <= 0
      )
        throw new PdfMergeError("INVALID_PDF");
      if (box.width > pdfMergeLimits.pageSide || box.height > pdfMergeLimits.pageSide)
        throw new PdfMergeError("RESOURCE_LIMIT");
      await pageIdentity(page, resourceMemo);
    }
    return document;
  } catch (error) {
    if (error instanceof PdfMergeError) throw error;
    // pdf-lib's ES5 Error subclasses can lose their prototype; also match its fixed message.
    const protectedDocument =
      error instanceof EncryptedPDFError ||
      (error instanceof Error && error.message === new EncryptedPDFError().message);
    throw new PdfMergeError(protectedDocument ? "DOCUMENT_PROTECTED" : "INVALID_PDF");
  }
}
export async function inspectPdfs(files: readonly File[], signal?: AbortSignal) {
  assertPdfSelection(files);
  const documents: PdfDocumentInfo[] = [];
  let pages = 0;
  for (const file of files) {
    const pdf = await loadPdf(file, signal);
    pages += pdf.getPageCount();
    assertPdfPageCount(pdf.getPageCount(), pages);
    documents.push({ pages: pdf.getPageCount() });
  }
  return documents;
}
function byteFingerprint(bytes: Uint8Array) {
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return `${bytes.byteLength}:${hash}`;
}
async function pageIdentity(page: PDFPage, memo: Map<PDFObject, string>) {
  const { PDFArray, PDFDict, PDFName, PDFRawStream, PDFRef } = await import("pdf-lib");
  const ancestors = new Set<PDFObject>();
  function fingerprint(input: PDFObject): string {
    const value = input instanceof PDFRef ? page.doc.context.lookup(input) : input;
    if (!value) throw new PdfMergeError("INVALID_PDF");
    const cached = memo.get(value);
    if (cached) return cached;
    if (ancestors.has(value)) return "cycle";
    ancestors.add(value);
    let data: string;
    if (value instanceof PDFRawStream)
      data = `${fingerprint(value.dict)}:${byteFingerprint(value.getContents())}`;
    else if (value instanceof PDFDict)
      data = JSON.stringify(
        value
          .entries()
          .sort(([a], [b]) => a.decodeText().localeCompare(b.decodeText()))
          .map(([key, entry]) => [key.decodeText(), fingerprint(entry)]),
      );
    else if (value instanceof PDFArray) data = JSON.stringify(value.asArray().map(fingerprint));
    else data = value.toString();
    ancestors.delete(value);
    const result = byteFingerprint(new TextEncoder().encode(data));
    memo.set(value, result);
    return result;
  }
  const contents = page.doc.context.lookup(page.node.Contents());
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => page.doc.context.lookup(ref))
      : contents
        ? [contents]
        : [];
  const hashes = streams.map((stream) => {
    if (!(stream instanceof PDFRawStream)) throw new PdfMergeError("INVALID_PDF");
    return byteFingerprint(stream.getContents());
  });
  const resources = page.node.Resources();
  return JSON.stringify([
    page.getMediaBox(),
    page.getCropBox(),
    page.getBleedBox(),
    page.getTrimBox(),
    page.getArtBox(),
    page.getRotation().angle,
    hashes,
    resources ? fingerprint(resources) : null,
    page.doc.context.lookup(page.node.get(PDFName.of("UserUnit")))?.toString() ?? null,
  ]);
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
    const source = await loadPdf(file, signal);
    assertPdfPageCount(source.getPageCount(), identities.length + source.getPageCount());
    const resourceMemo = new Map<PDFObject, string>();
    for (const page of source.getPages()) identities.push(await pageIdentity(page, resourceMemo));
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
  if (checked.getPageCount() !== identities.length) throw new PdfMergeError("MERGE_FAILED");
  const resourceMemo = new Map<PDFObject, string>();
  for (const [index, page] of checked.getPages().entries()) {
    cancelled(signal);
    if ((await pageIdentity(page, resourceMemo)) !== identities[index])
      throw new PdfMergeError("MERGE_FAILED");
  }
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    pages: checked.getPageCount(),
  };
}
