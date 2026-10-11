import { imagePdfFileSchema, imagePdfOptionsSchema } from "@toolbox/contracts";
import {
  assertImageDimensions,
  assertImageSelection,
  type ImageInfo,
  ImagePdfError,
  type ImagePdfOptions,
  imagePageLayout,
  imagePdfLimits,
  inspectImage,
} from "@toolbox/core";

export type PreparedImage = { width: number; height: number; thumbnail: Blob };
export type ImagePdfResult = {
  blob: Blob;
  pages: number;
  sizes: { width: number; height: number }[];
};
export type ImagePdfRequest = {
  action: "prepare" | "convert";
  files: File[];
  options: ImagePdfOptions;
};
export type ImagePdfResponse =
  | { type: "prepared"; images: PreparedImage[] }
  | { type: "result"; result: ImagePdfResult }
  | { type: "error"; code: ImagePdfError["code"] }
  | { type: "rasterize"; file: File; info: ImageInfo; thumbnail: boolean };
export type RasterizeReply =
  | { action: "rasterized"; image: PreparedImage }
  | { action: "rasterize-error"; code: ImagePdfError["code"] };
export type ImageRasterizer = (
  file: File,
  info: ImageInfo,
  thumbnail: boolean,
  signal?: AbortSignal,
) => Promise<PreparedImage>;

export function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new ImagePdfError("CANCELLED");
}
export async function inspectFiles(
  files: readonly File[],
  signal?: AbortSignal,
): Promise<ImageInfo[]> {
  assertImageSelection(files);
  const infos: ImageInfo[] = [];
  let pixels = 0;
  for (const file of files) {
    checkCancelled(signal);
    if (
      !imagePdfFileSchema.safeParse({ name: file.name, size: file.size, type: file.type }).success
    )
      throw new ImagePdfError("INVALID_IMAGE");
    const info = inspectImage(new Uint8Array(await file.arrayBuffer()));
    checkCancelled(signal);
    const mime = `image/${info.kind === "jpeg" ? "jpeg" : info.kind}`;
    if (file.type && file.type !== mime) throw new ImagePdfError("UNSUPPORTED_FORMAT");
    pixels += info.width * info.height;
    if (pixels > imagePdfLimits.totalPixels) throw new ImagePdfError("LIMIT_EXCEEDED");
    infos.push(info);
  }
  return infos;
}

export async function rasterizeImage(
  file: File,
  info: ImageInfo,
  thumbnail: boolean,
  signal?: AbortSignal,
): Promise<PreparedImage> {
  checkCancelled(signal);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImagePdfError("INVALID_IMAGE");
  }
  let canvas: OffscreenCanvas | HTMLCanvasElement | undefined;
  try {
    checkCancelled(signal);
    assertImageDimensions(bitmap.width, bitmap.height);
    if (bitmap.width * bitmap.height !== info.width * info.height)
      throw new ImagePdfError("INVALID_IMAGE");
    const width = bitmap.width;
    const height = bitmap.height;
    const scale = thumbnail ? Math.min(1, 320 / Math.max(width, height)) : 1;
    canvas =
      typeof OffscreenCanvas === "function"
        ? new OffscreenCanvas(1, 1)
        : document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context || !("drawImage" in context)) throw new ImagePdfError("CONVERSION_FAILED");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = !thumbnail && info.kind === "jpeg" ? "image/jpeg" : "image/png";
    const blob =
      "convertToBlob" in canvas
        ? await canvas.convertToBlob({ type, quality: 0.95 })
        : await new Promise<Blob>((resolve, reject) => {
            (canvas as HTMLCanvasElement).toBlob(
              (value) => (value ? resolve(value) : reject(new ImagePdfError("CONVERSION_FAILED"))),
              type,
              0.95,
            );
          });
    checkCancelled(signal);
    return { width, height, thumbnail: blob };
  } finally {
    bitmap.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

export async function prepareImages(
  files: readonly File[],
  signal?: AbortSignal,
  rasterize: ImageRasterizer = rasterizeImage,
): Promise<PreparedImage[]> {
  const infos = await inspectFiles(files, signal);
  const images: PreparedImage[] = [];
  for (const [index, file] of files.entries()) {
    const info = infos[index];
    if (!info) throw new ImagePdfError("INVALID_IMAGE");
    images.push(await rasterize(file, info, true, signal));
  }
  return images;
}

export async function imagesToPdf(
  files: readonly File[],
  inputOptions: unknown,
  signal?: AbortSignal,
  rasterize: ImageRasterizer = rasterizeImage,
): Promise<ImagePdfResult> {
  const parsed = imagePdfOptionsSchema.safeParse(inputOptions);
  if (!parsed.success) throw new ImagePdfError("INVALID_IMAGE");
  const infos = await inspectFiles(files, signal);
  checkCancelled(signal);
  const { PDFDocument, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, rgb } =
    await import("pdf-lib");
  checkCancelled(signal);
  const pdf = await PDFDocument.create();
  pdf.setProducer("Toolbox Images to PDF");
  pdf.setCreator("Toolbox");
  const sizes: ImagePdfResult["sizes"] = [];
  let encodedBytes = 0;
  for (const [index, file] of files.entries()) {
    const info = infos[index];
    if (!info) throw new ImagePdfError("INVALID_IMAGE");
    const normalized = await rasterize(file, info, false, signal);
    encodedBytes += normalized.thumbnail.size;
    if (encodedBytes > imagePdfLimits.encodedBytes) throw new ImagePdfError("LIMIT_EXCEEDED");
    const bytes = await normalized.thumbnail.arrayBuffer();
    checkCancelled(signal);
    const image = info.kind === "jpeg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    const layout = imagePageLayout(normalized.width, normalized.height, parsed.data);
    const page = pdf.addPage([layout.pageWidth, layout.pageHeight]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: layout.pageWidth,
      height: layout.pageHeight,
      color: rgb(1, 1, 1),
    });
    page.pushOperators(
      pushGraphicsState(),
      rectangle(layout.margin, layout.margin, layout.contentWidth, layout.contentHeight),
      clip(),
      endPath(),
    );
    page.drawImage(image, { x: layout.x, y: layout.y, width: layout.width, height: layout.height });
    page.pushOperators(popGraphicsState());
    sizes.push({ width: layout.pageWidth, height: layout.pageHeight });
    // Flush each image before the next decode to avoid retaining all PNG pixel arrays.
    await pdf.flush();
    checkCancelled(signal);
  }
  const bytes = await pdf.save({ objectsPerTick: 10 });
  checkCancelled(signal);
  if (bytes.byteLength > imagePdfLimits.outputBytes) throw new ImagePdfError("LIMIT_EXCEEDED");
  const checked = await PDFDocument.load(bytes, { updateMetadata: false });
  if (
    checked.getPageCount() !== files.length ||
    checked.getPages().some((page, index) => {
      const size = sizes[index];
      return (
        !size ||
        Math.abs(page.getWidth() - size.width) > 0.01 ||
        Math.abs(page.getHeight() - size.height) > 0.01
      );
    })
  )
    throw new ImagePdfError("CONVERSION_FAILED");
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    pages: checked.getPageCount(),
    sizes,
  };
}
