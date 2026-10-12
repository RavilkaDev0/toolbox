import { type ImageInfo, ImageInputError, inspectImage } from "./image-input.js";

export const imageCompressorLimits = {
  files: 1,
  fileBytes: 16 * 1024 * 1024,
  side: 8192,
  pixels: 8_000_000,
  outputBytes: 24 * 1024 * 1024,
} as const;

export type ImageCompressionFormat = "jpeg" | "png" | "webp";
export type ImageCompressionOptions = { format: ImageCompressionFormat; quality: number };
export const defaultImageCompressionQuality = 80;

export type ImageCompressionErrorCode =
  | "INVALID_IMAGE"
  | "UNSUPPORTED_FORMAT"
  | "LIMIT_EXCEEDED"
  | "CANCELLED"
  | "CONVERSION_FAILED";

const messages: Record<ImageCompressionErrorCode, string> = {
  INVALID_IMAGE: "This image is empty or damaged. Choose a valid JPEG, PNG or WebP image.",
  UNSUPPORTED_FORMAT:
    "The file type does not match its image content, or it is not a static JPEG, PNG or WebP image.",
  LIMIT_EXCEEDED: "Choose one image under 16 MiB and 8 megapixels, or an output under 24 MiB.",
  CANCELLED: "Compression cancelled. Your selected image is still available.",
  CONVERSION_FAILED:
    "The browser could not encode this format. Choose another output format or try again.",
};

export class ImageCompressorError extends Error {
  constructor(readonly code: ImageCompressionErrorCode) {
    super(messages[code]);
    this.name = "ImageCompressorError";
  }
}

export function assertCompressorSelection(
  files: readonly { name: string; size: number; type: string }[],
): void {
  if (!files.length) throw new ImageCompressorError("INVALID_IMAGE");
  if (files.length !== imageCompressorLimits.files)
    throw new ImageCompressorError("LIMIT_EXCEEDED");
  for (const file of files) assertCompressorFile(file);
}

export function assertCompressorFile(file: { name: string; size: number; type: string }): void {
  if (
    !file.name.length ||
    file.name.length > 255 ||
    !Number.isSafeInteger(file.size) ||
    file.size < 1
  )
    throw new ImageCompressorError("INVALID_IMAGE");
  if (file.size > imageCompressorLimits.fileBytes) throw new ImageCompressorError("LIMIT_EXCEEDED");
  if (file.type && !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new ImageCompressorError("UNSUPPORTED_FORMAT");
}

export function assertCompressorDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    throw new ImageCompressorError("INVALID_IMAGE");
  if (
    width > imageCompressorLimits.side ||
    height > imageCompressorLimits.side ||
    width * height > imageCompressorLimits.pixels
  )
    throw new ImageCompressorError("LIMIT_EXCEEDED");
}

export function compressionFormatForImage(info: ImageInfo): ImageCompressionFormat {
  return info.kind;
}

export function compressionMimeType(format: ImageCompressionFormat): string {
  return format === "jpeg" ? "image/jpeg" : `image/${format}`;
}

export function compressionExtension(format: ImageCompressionFormat): string {
  return format === "jpeg" ? "jpg" : format;
}

export function inspectCompressorImage(bytes: Uint8Array): ImageInfo {
  try {
    const info = inspectImage(bytes);
    assertCompressorDimensions(info.width, info.height);
    return info;
  } catch (error) {
    if (error instanceof ImageInputError) throw new ImageCompressorError(error.code);
    throw error;
  }
}
