import { assertImageFileMetadata, ImageInputError } from "./image-input.js";
import {
  assertImageProcessingDimensions,
  type ImageFormat,
  imageFormatExtension,
  imageFormatMimeType,
  imageProcessingLimits,
} from "./image-processing.js";

export const imageResizerLimits = {
  files: 1,
  ...imageProcessingLimits,
  maxPercent: 400,
  operationMs: 30_000,
} as const;

export type ImageSize = { width: number; height: number };
export type ImageResizeGeometry =
  | {
      mode: "pixels";
      width: number;
      height: number;
      lockAspectRatio: boolean;
      editedDimension: "width" | "height";
    }
  | { mode: "percentage"; percentage: number };
export type ImageResizeOptions = ImageResizeGeometry & {
  format: ImageFormat;
  quality: number;
};

export type ImageResizerErrorCode =
  | "INVALID_IMAGE"
  | "UNSUPPORTED_FORMAT"
  | "LIMIT_EXCEEDED"
  | "CANCELLED"
  | "CONVERSION_FAILED"
  | "INVALID_SETTINGS";

const messages: Record<ImageResizerErrorCode, string> = {
  INVALID_IMAGE: "This image is empty or damaged. Choose a valid JPEG, PNG or WebP image.",
  UNSUPPORTED_FORMAT:
    "The file type does not match its image content, or it is not a static JPEG, PNG or WebP image.",
  LIMIT_EXCEEDED:
    "The image or requested dimensions exceed the 16 MiB, 8 megapixel, 8,192 pixel or 24 MiB output limit.",
  CANCELLED: "Resize cancelled. Your selected image is still available.",
  CONVERSION_FAILED:
    "The browser could not resize this image. Choose another output format or try again.",
  INVALID_SETTINGS: "Enter whole pixel dimensions or a percentage from 1 to 400.",
};

export class ImageResizerError extends Error {
  constructor(readonly code: ImageResizerErrorCode) {
    super(messages[code]);
    this.name = "ImageResizerError";
  }
}

export function assertImageResizerSelection(
  files: readonly { name: string; size: number; type: string }[],
): void {
  if (!files.length) throw new ImageResizerError("INVALID_IMAGE");
  if (files.length !== imageResizerLimits.files) throw new ImageResizerError("LIMIT_EXCEEDED");
  for (const file of files) {
    try {
      assertImageFileMetadata(file, imageResizerLimits.fileBytes);
    } catch (error) {
      if (error instanceof ImageInputError) throw new ImageResizerError(error.code);
      throw error;
    }
  }
}

export function calculateImageResizeDimensions(
  source: ImageSize,
  geometry: ImageResizeGeometry,
): ImageSize {
  assertDimensions(source);
  let width: number;
  let height: number;
  if (geometry.mode === "percentage") {
    if (
      !Number.isInteger(geometry.percentage) ||
      geometry.percentage < 1 ||
      geometry.percentage > imageResizerLimits.maxPercent
    )
      throw new ImageResizerError("INVALID_SETTINGS");
    width = Math.max(1, Math.round((source.width * geometry.percentage) / 100));
    height = Math.max(1, Math.round((source.height * geometry.percentage) / 100));
  } else {
    if (
      !Number.isInteger(geometry.width) ||
      !Number.isInteger(geometry.height) ||
      geometry.width < 1 ||
      geometry.height < 1
    )
      throw new ImageResizerError("INVALID_SETTINGS");
    width = geometry.width;
    height = geometry.height;
    if (geometry.lockAspectRatio) {
      if (geometry.editedDimension === "width")
        height = Math.max(1, Math.round((width * source.height) / source.width));
      else width = Math.max(1, Math.round((height * source.width) / source.height));
    }
  }
  assertDimensions({ width, height });
  return { width, height };
}

function assertDimensions(size: ImageSize): void {
  try {
    assertImageProcessingDimensions(size.width, size.height);
  } catch (error) {
    if (error instanceof ImageInputError) {
      if (error.code === "INVALID_IMAGE") throw new ImageResizerError("INVALID_SETTINGS");
      throw new ImageResizerError(error.code);
    }
    throw error;
  }
}

export function imageResizeMimeType(format: ImageFormat): string {
  return imageFormatMimeType(format);
}

export function imageResizeExtension(format: ImageFormat): string {
  return imageFormatExtension(format);
}
