import { assertImageFileMetadata, ImageInputError } from "./image-input.js";
import {
  assertImageFileExtension,
  assertImageProcessingDimensions,
  createImageConvertedNames,
  imageProcessingLimits,
} from "./image-processing.js";

export const webpConverterLimits = {
  files: 10,
  fileBytes: imageProcessingLimits.fileBytes,
  totalInputBytes: 32 * 1024 * 1024,
  side: imageProcessingLimits.side,
  pixels: imageProcessingLimits.pixels,
  outputBytes: imageProcessingLimits.outputBytes,
  batchOutputBytes: 32 * 1024 * 1024,
  archiveBytes: 33 * 1024 * 1024,
  previewSide: 360,
  operationMs: 60_000,
} as const;

export type WebpInputFormat = "jpeg" | "png";
export type WebpConverterSettings = { quality: number };
export type WebpConverterInfo = {
  format: WebpInputFormat;
  width: number;
  height: number;
};
export type WebpConverterErrorCode =
  | "INVALID_IMAGE"
  | "UNSUPPORTED_FORMAT"
  | "LIMIT_EXCEEDED"
  | "CANCELLED"
  | "CONVERSION_FAILED"
  | "INVALID_SETTINGS";

const messages: Record<WebpConverterErrorCode, string> = {
  INVALID_IMAGE: "A file is empty or damaged. Choose a valid JPEG or PNG image.",
  UNSUPPORTED_FORMAT: "Choose static JPEG or PNG images. The file type must match its content.",
  LIMIT_EXCEEDED:
    "Choose up to 10 images, 16 MiB each and 32 MiB total. Each image is limited to 8 megapixels, 8,192 px per side and 24 MiB output; a batch is limited to 32 MiB output.",
  CANCELLED: "Conversion cancelled. Your selected images are still available.",
  CONVERSION_FAILED:
    "This browser could not encode WebP. Your files are unchanged; try a supported browser or smaller images.",
  INVALID_SETTINGS: "Choose JPEG/WebP quality from 10 to 95.",
};

export class WebpConverterError extends Error {
  constructor(readonly code: WebpConverterErrorCode) {
    super(messages[code]);
    this.name = "WebpConverterError";
  }
}

export const defaultWebpConverterSettings: WebpConverterSettings = { quality: 80 };

export function assertWebpConverterSelection(
  files: readonly { name: string; size: number; type: string }[],
): void {
  if (files.length === 0) throw new WebpConverterError("INVALID_IMAGE");
  if (files.length > webpConverterLimits.files) throw new WebpConverterError("LIMIT_EXCEEDED");
  let totalBytes = 0;
  for (const file of files) {
    try {
      assertImageFileMetadata(file, webpConverterLimits.fileBytes);
    } catch (error) {
      if (error instanceof ImageInputError) throw new WebpConverterError(error.code);
      throw error;
    }
    if (file.type && file.type !== "image/jpeg" && file.type !== "image/png")
      throw new WebpConverterError("UNSUPPORTED_FORMAT");
    totalBytes += file.size;
    if (totalBytes > webpConverterLimits.totalInputBytes)
      throw new WebpConverterError("LIMIT_EXCEEDED");
  }
}

export function assertWebpConverterDimensions(width: number, height: number): void {
  try {
    assertImageProcessingDimensions(width, height);
  } catch (error) {
    if (error instanceof ImageInputError) throw new WebpConverterError(error.code);
    throw error;
  }
}

export function assertWebpConverterFileExtension(name: string, format: WebpInputFormat): void {
  try {
    assertImageFileExtension(name, format);
  } catch (error) {
    if (error instanceof ImageInputError) throw new WebpConverterError(error.code);
    throw error;
  }
}

export function createWebpConverterOutputNames(files: readonly { name: string }[]): string[] {
  try {
    return createImageConvertedNames(
      files,
      files.map(() => "webp" as const),
    );
  } catch (error) {
    if (error instanceof ImageInputError) throw new WebpConverterError("INVALID_SETTINGS");
    throw error;
  }
}
