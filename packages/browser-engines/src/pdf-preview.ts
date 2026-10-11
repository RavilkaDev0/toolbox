import { pdfPreviewLimits } from "@toolbox/core";

function checkCancelled(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("PDF preview cancelled", "AbortError");
}

// Only generated or inspected static PDFs enter this bounded, canvas-only viewer.
export async function renderPdfPage(
  blob: Blob,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  port: Worker,
  signal: AbortSignal,
) {
  if (
    (blob.type !== "" && blob.type !== "application/pdf") ||
    blob.size > pdfPreviewLimits.bytes ||
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > pdfPreviewLimits.pages
  )
    throw new Error("Invalid PDF preview input");
  const pdfjs = await import("pdfjs-dist");
  checkCancelled(signal);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  checkCancelled(signal);
  const worker = pdfjs.PDFWorker.create({ port });
  const loading = pdfjs.getDocument({
    data: bytes,
    worker,
    maxImageSize: pdfPreviewLimits.pixels,
    enableXfa: false,
    disableAutoFetch: true,
    disableStream: true,
    // Library warnings can include PDF data; errors still reject and reach the UI.
    verbosity: 0,
    useWasm: false,
    stopAtErrors: true,
    isOffscreenCanvasSupported: typeof OffscreenCanvas === "function",
    isImageDecoderSupported: false,
  });
  type PdfPage = Awaited<ReturnType<Awaited<typeof loading.promise>["getPage"]>>;
  let render: ReturnType<PdfPage["render"]> | undefined;
  let rejectCancellation: (error: DOMException) => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    rejectCancellation = reject;
  });
  const cancel = () => {
    render?.cancel();
    rejectCancellation(new DOMException("PDF preview cancelled", "AbortError"));
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
    render = page.render({ canvas, viewport, annotationMode: pdfjs.AnnotationMode.DISABLE });
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
