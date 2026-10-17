import {
  assertImageFileMetadata,
  type ImageInfo,
  ImageInputError,
  inspectImage,
} from "./image-input.js";
import {
  assertImageProcessingDimensions,
  type ImageFormat,
  imageFormatExtension,
  imageFormatMimeType,
  imageProcessingLimits,
} from "./image-processing.js";

export const imageCompressorLimits = {
  files: 1,
  ...imageProcessingLimits,
} as const;

export type ImageCompressionFormat = ImageFormat;
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
  try {
    assertImageFileMetadata(file, imageCompressorLimits.fileBytes);
  } catch (error) {
    if (error instanceof ImageInputError) throw new ImageCompressorError(error.code);
    throw error;
  }
}

export function assertCompressorDimensions(width: number, height: number): void {
  try {
    assertImageProcessingDimensions(width, height);
  } catch (error) {
    if (error instanceof ImageInputError) throw new ImageCompressorError(error.code);
    throw error;
  }
}

export function compressionFormatForImage(info: ImageInfo): ImageCompressionFormat {
  return info.kind;
}

export function compressionMimeType(format: ImageCompressionFormat): string {
  return imageFormatMimeType(format);
}

export function compressionExtension(format: ImageCompressionFormat): string {
  return imageFormatExtension(format);
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
