import { assertImageDimensions, ImageInputError, imageInputLimits } from "./image-input.js";

export type { ImageInfo } from "./image-input.js";
export {
  assertImageDimensions,
  ImageInputError as ImagePdfError,
  inspectImage,
} from "./image-input.js";

export const imagePdfLimits = {
  files: 10,
  fileBytes: 8 * 1024 * 1024,
  totalBytes: 32 * 1024 * 1024,
  side: imageInputLimits.side,
  pixels: imageInputLimits.pixels,
  totalPixels: 24_000_000,
  encodedBytes: 48 * 1024 * 1024,
  outputBytes: 64 * 1024 * 1024,
} as const;

export type ImagePdfOptions = {
  pageSize: "auto" | "a4" | "letter";
  orientation: "portrait" | "landscape";
  margin: 0 | 10 | 20;
  placement: "fit" | "fill";
};
export const defaultImagePdfOptions: ImagePdfOptions = {
  pageSize: "a4",
  orientation: "portrait",
  margin: 10,
  placement: "fit",
};
export type ImagePdfErrorCode = import("./image-input.js").ImageInputErrorCode;

export function assertImageSelection(
  files: readonly { size: number; name: string; type: string }[],
) {
  if (!files.length) throw new ImageInputError("INVALID_IMAGE");
  if (
    files.length > imagePdfLimits.files ||
    files.reduce((n, f) => n + f.size, 0) > imagePdfLimits.totalBytes
  )
    throw new ImageInputError("LIMIT_EXCEEDED");
  for (const file of files) {
    if (
      !Number.isSafeInteger(file.size) ||
      file.size < 1 ||
      !file.name.length ||
      file.name.length > 255
    )
      throw new ImageInputError("INVALID_IMAGE");
    if (file.size > imagePdfLimits.fileBytes) throw new ImageInputError("LIMIT_EXCEEDED");
    if (file.type && !["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new ImageInputError("UNSUPPORTED_FORMAT");
  }
}
export function imagePageLayout(width: number, height: number, options: ImagePdfOptions) {
  assertImageDimensions(width, height);
  const mm = 72 / 25.4;
  const margin = options.pageSize === "auto" ? 0 : options.margin * mm;
  let pageWidth: number;
  let pageHeight: number;
  if (options.pageSize === "auto") {
    pageWidth = width * 0.75;
    pageHeight = height * 0.75;
  } else {
    [pageWidth, pageHeight] = options.pageSize === "a4" ? [210 * mm, 297 * mm] : [612, 792];
    if (options.orientation === "landscape") [pageWidth, pageHeight] = [pageHeight, pageWidth];
  }
  const contentWidth = pageWidth - 2 * margin;
  const contentHeight = pageHeight - 2 * margin;
  const scale = (options.placement === "fill" ? Math.max : Math.min)(
    contentWidth / width,
    contentHeight / height,
  );
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  return {
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    contentHeight,
    width: drawWidth,
    height: drawHeight,
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
  };
}

export { moveItem as moveImage } from "./ordering.js";
