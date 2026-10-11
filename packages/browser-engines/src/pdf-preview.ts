import { ImagePdfError, imagePdfLimits } from "@toolbox/core";
import { checkCancelled } from "./images-to-pdf.js";

// Only generated PDFs enter this viewer. A new document is released after each page.
export async function renderPdfPage(
  blob: Blob,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  port: Worker,
  signal: AbortSignal,
) {
  if (
    blob.type !== "application/pdf" ||
    blob.size > imagePdfLimits.outputBytes ||
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > imagePdfLimits.files
  )
    throw new ImagePdfError("INVALID_IMAGE");
  const pdfjs = await import("pdfjs-dist");
  checkCancelled(signal);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  checkCancelled(signal);
  const worker = pdfjs.PDFWorker.create({ port });
  const loading = pdfjs.getDocument({
    data: bytes,
    worker,
    maxImageSize: imagePdfLimits.pixels,
    useWasm: false,
    stopAtErrors: true,
    isOffscreenCanvasSupported: typeof OffscreenCanvas === "function",
    isImageDecoderSupported: false,
  });
  type PdfPage = Awaited<ReturnType<Awaited<typeof loading.promise>["getPage"]>>;
  let render: ReturnType<PdfPage["render"]> | undefined;
  let rejectCancellation: (error: ImagePdfError) => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    rejectCancellation = reject;
  });
  const cancel = () => {
    render?.cancel();
    rejectCancellation(new ImagePdfError("CANCELLED"));
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const document = await Promise.race([loading.promise, cancelled]);
    const page = await Promise.race([document.getPage(pageNumber), cancelled]);
    checkCancelled(signal);
    const original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: Math.min(640 / original.width, 800 / original.height),
    });
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    render = page.render({ canvas, viewport });
    await Promise.race([render.promise, cancelled]);
    checkCancelled(signal);
  } finally {
    signal.removeEventListener("abort", cancel);
    try {
      await loading.destroy();
    } finally {
      worker.destroy();
    }
  }
}
