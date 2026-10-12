import type { PdfToPngSettings } from "@toolbox/contracts";
import { pdfToPngFileSchema, pdfToPngSettingsSchema } from "@toolbox/contracts";
import {
  assertPdfSignature,
  assertPdfToPngOutputSize,
  assertPdfToPngPages,
  PdfProcessingError,
  pdfToPngDimensions,
  pdfToPngLimits,
} from "@toolbox/core";
import { Zip, ZipPassThrough } from "fflate";
import { loadStaticPdf } from "./static-pdf.js";

export type PdfToPngInfo = { bytes: number; pages: number };
export type PdfToPngProgress = { completed: number; total: number; page: number };
export type PdfToPngImageInfo = { page: number; width: number; height: number; bytes: number };
export type PdfToPngResult = {
  blob: Blob;
  preview: Blob;
  format: "png" | "zip";
  pages: number[];
  images: PdfToPngImageInfo[];
  durationMs: number;
};

function cancellationError(signal: AbortSignal): PdfProcessingError {
  return signal.reason instanceof PdfProcessingError
    ? signal.reason
    : new PdfProcessingError("CANCELLED");
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw cancellationError(signal);
}

function asProcessingError(error: unknown): PdfProcessingError {
  if (error instanceof PdfProcessingError) return error;
  if (error && typeof error === "object" && "name" in error && error.name === "PasswordException")
    return new PdfProcessingError("DOCUMENT_PROTECTED");
  if (error instanceof DOMException && error.name === "AbortError")
    return new PdfProcessingError("CANCELLED");
  return new PdfProcessingError("RENDER_FAILED");
}

function waitWithCancellation<T>(
  task: Promise<T>,
  signal: AbortSignal,
  cancelTask: () => void = () => {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      cancelTask();
      reject(cancellationError(signal));
      return;
    }
    const abort = () => {
      cancelTask();
      reject(cancellationError(signal));
    };
    const cleanUp = () => signal.removeEventListener("abort", abort);
    signal.addEventListener("abort", abort, { once: true });
    task.then(
      (value) => {
        cleanUp();
        resolve(value);
      },
      (error: unknown) => {
        cleanUp();
        reject(error);
      },
    );
  });
}

function validateFileMetadata(file: File) {
  if (file.size > pdfToPngLimits.fileBytes) throw new PdfProcessingError("RESOURCE_LIMIT");
  if (!pdfToPngFileSchema.safeParse({ name: file.name, size: file.size, type: file.type }).success)
    throw new PdfProcessingError("INVALID_PDF");
}

async function validateStaticPdf(file: File, signal: AbortSignal) {
  const document = await loadStaticPdf(file, signal);
  return document.getPageCount();
}

async function loadPdf(file: File, port: Worker, signal: AbortSignal) {
  throwIfAborted(signal);
  validateFileMetadata(file);
  const checkedPages = await validateStaticPdf(file, signal);
  throwIfAborted(signal);
  const bytes = new Uint8Array(await file.arrayBuffer());
  throwIfAborted(signal);
  assertPdfSignature(bytes);
  const pdfjs = await import("pdfjs-dist");
  throwIfAborted(signal);
  const worker = pdfjs.PDFWorker.create({ port });
  const loading = pdfjs.getDocument({
    data: bytes,
    worker,
    maxImageSize: 12_000_000,
    enableXfa: false,
    disableRange: true,
    disableAutoFetch: true,
    disableStream: true,
    verbosity: 0,
    useWasm: false,
    stopAtErrors: true,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  });
  let rejectPassword: (error: PdfProcessingError) => void = () => {};
  const passwordRequired = new Promise<never>((_resolve, reject) => {
    rejectPassword = reject;
  });
  loading.onPassword = () => rejectPassword(new PdfProcessingError("DOCUMENT_PROTECTED"));
  let document: Awaited<typeof loading.promise> | undefined;
  try {
    document = await waitWithCancellation(
      Promise.race([loading.promise, passwordRequired]),
      signal,
    );
    if (document.numPages < 1) throw new PdfProcessingError("INVALID_PDF");
    if (document.numPages > pdfToPngLimits.pages) throw new PdfProcessingError("RESOURCE_LIMIT");
    if (document.numPages !== checkedPages) throw new PdfProcessingError("INVALID_PDF");
    return { document, loading, worker };
  } catch (error) {
    try {
      await loading.destroy();
    } finally {
      worker.destroy();
    }
    if (signal.aborted) throw cancellationError(signal);
    throw asProcessingError(error);
  }
}

export async function inspectPdfToPng(
  file: File,
  port: Worker,
  signal: AbortSignal,
): Promise<PdfToPngInfo> {
  const opened = await loadPdf(file, port, signal);
  try {
    throwIfAborted(signal);
    return { bytes: file.size, pages: opened.document.numPages };
  } finally {
    await opened.loading.destroy();
    opened.worker.destroy();
  }
}

function selectedPages(settings: PdfToPngSettings, pageCount: number) {
  const parsed = pdfToPngSettingsSchema.safeParse(settings);
  if (!parsed.success) throw new PdfProcessingError("INVALID_PDF");
  const pages =
    settings.mode === "all" ? Array.from({ length: pageCount }, (_, i) => i + 1) : settings.pages;
  assertPdfToPngPages(pages, pageCount);
  return pages;
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new PdfProcessingError("RENDER_FAILED"));
    }, "image/png");
  });
}

export async function renderPdfToPng(
  file: File,
  settings: PdfToPngSettings,
  canvas: HTMLCanvasElement,
  port: Worker,
  signal: AbortSignal,
  onProgress: (progress: PdfToPngProgress) => void,
): Promise<PdfToPngResult> {
  const started = performance.now();
  const parsedSettings = pdfToPngSettingsSchema.safeParse(settings);
  if (!parsedSettings.success) throw new PdfProcessingError("INVALID_PDF");
  const validSettings = parsedSettings.data;
  const opened = await loadPdf(file, port, signal);
  const pages = selectedPages(validSettings, opened.document.numPages);
  const images: PdfToPngImageInfo[] = [];
  const zipChunks: Array<Uint8Array<ArrayBuffer>> = [];
  let zipBytes = 0;
  let zipFailure: PdfProcessingError | undefined;
  let resolveZip: (() => void) | undefined;
  const zipCompletePromise = new Promise<void>((resolve) => {
    resolveZip = resolve;
  });
  const zip =
    pages.length > 1
      ? new Zip((error, chunk, final) => {
          if (error) zipFailure = new PdfProcessingError("RENDER_FAILED");
          else if (chunk.byteLength) {
            zipBytes += chunk.byteLength;
            if (zipBytes > pdfToPngLimits.archiveBytes)
              zipFailure = new PdfProcessingError("RESOURCE_LIMIT");
            else zipChunks.push(chunk);
          }
          if (final || zipFailure) resolveZip?.();
        })
      : null;
  let preview: Blob | undefined;
  let output: Blob | undefined;
  let activeRender:
    | ReturnType<Awaited<ReturnType<typeof opened.document.getPage>>["render"]>
    | undefined;

  try {
    const pagePlans = [] as Array<{ page: number; width: number; height: number; pixels: number }>;
    let totalPixels = 0;
    for (const pageNumber of pages) {
      throwIfAborted(signal);
      if (performance.now() - started > pdfToPngLimits.jobMilliseconds)
        throw new PdfProcessingError("RESOURCE_LIMIT");
      const page = await waitWithCancellation(opened.document.getPage(pageNumber), signal);
      try {
        const [x1 = Number.NaN, y1 = Number.NaN, x2 = Number.NaN, y2 = Number.NaN] = page.view;
        const dimensions = pdfToPngDimensions(x2 - x1, y2 - y1, page.rotate, validSettings.dpi);
        totalPixels += dimensions.pixels;
        if (totalPixels > pdfToPngLimits.totalPixels)
          throw new PdfProcessingError("RESOURCE_LIMIT");
        pagePlans.push({ page: pageNumber, ...dimensions });
      } finally {
        page.cleanup();
      }
    }

    for (const [index, plan] of pagePlans.entries()) {
      throwIfAborted(signal);
      if (performance.now() - started > pdfToPngLimits.jobMilliseconds)
        throw new PdfProcessingError("RESOURCE_LIMIT");
      const page = await waitWithCancellation(opened.document.getPage(plan.page), signal);
      canvas.width = plan.width;
      canvas.height = plan.height;
      const canvasContext = canvas.getContext("2d", {
        alpha: validSettings.background === "transparent",
      });
      if (!canvasContext) throw new PdfProcessingError("RENDER_FAILED");
      const viewport = page.getViewport({ scale: validSettings.dpi / 72 });
      if (Math.ceil(viewport.width) !== plan.width || Math.ceil(viewport.height) !== plan.height)
        throw new PdfProcessingError("INVALID_PDF");
      activeRender = page.render({
        canvas: null,
        canvasContext,
        viewport,
        annotationMode: (await import("pdfjs-dist")).AnnotationMode.DISABLE,
        background: validSettings.background === "white" ? "#ffffff" : "rgba(0,0,0,0)",
      });
      try {
        await waitWithCancellation(activeRender.promise, signal, () => activeRender?.cancel());
      } finally {
        activeRender = undefined;
        page.cleanup();
      }
      throwIfAborted(signal);
      const png = await waitWithCancellation(canvasPng(canvas), signal);
      if (png.type !== "image/png") throw new PdfProcessingError("RENDER_FAILED");
      assertPdfToPngOutputSize(png.size, false);
      if (index === 0) preview = png;
      const imageInfo = {
        page: plan.page,
        width: plan.width,
        height: plan.height,
        bytes: png.size,
      };
      images.push(imageInfo);

      if (zip) {
        const entry = new ZipPassThrough(`page-${String(plan.page).padStart(3, "0")}.png`);
        entry.mtime = new Date(Date.UTC(1980, 0, 1));
        zip.add(entry);
        entry.push(new Uint8Array(await png.arrayBuffer()), true);
        if (zipFailure) throw zipFailure;
        if (zipBytes > pdfToPngLimits.archiveBytes) throw new PdfProcessingError("RESOURCE_LIMIT");
      } else output = png;

      onProgress({ completed: index + 1, total: pagePlans.length, page: plan.page });
      canvas.width = 0;
      canvas.height = 0;
      if (performance.now() - started > pdfToPngLimits.jobMilliseconds)
        throw new PdfProcessingError("RESOURCE_LIMIT");
    }

    if (zip) {
      zip.end();
      await waitWithCancellation(zipCompletePromise, signal, () => zip.terminate());
      if (zipFailure) throw zipFailure;
      output = new Blob(zipChunks, { type: "application/zip" });
      assertPdfToPngOutputSize(output.size, true);
    }
    if (!output || !preview) throw new PdfProcessingError("RENDER_FAILED");
    return {
      blob: output,
      preview,
      format: pages.length === 1 ? "png" : "zip",
      pages,
      images,
      durationMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    if (signal.aborted) throw cancellationError(signal);
    throw asProcessingError(error);
  } finally {
    activeRender?.cancel();
    if (zip) zip.terminate();
    canvas.width = 0;
    canvas.height = 0;
    await opened.loading.destroy();
    opened.worker.destroy();
  }
}
